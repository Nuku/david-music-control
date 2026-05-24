import { getSetting, MODULE_ID } from './settings.js';

const PLAYBACK_SYNC_SOCKET_TYPE = 'playbackSync';
const PLAYBACK_SYNC_REQUEST = 'request';
const PLAYBACK_SYNC_REPORT = 'report';
const PLAYBACK_SYNC_APPLY = 'apply';
const PLAYBACK_SYNC_LATE_JOIN = 'lateJoin';
const PLAYBACK_SYNC_DEBOUNCE_MS = 150;
const PLAYBACK_SYNC_TIMEOUT_MS = 1500;
const PLAYBACK_SYNC_APPLY_TIMEOUT_MS = 1000;
const PLAYBACK_SYNC_POLL_MS = 100;
const PLAYBACK_SYNC_TARGET_LEAD_SECONDS = 0.05;
const PLAYBACK_SYNC_SEEK_TOLERANCE_SECONDS = 0.15;

let playbackSyncSequence = 0;
const pendingPlaybackSyncs = new Map();
const activePlaybackSyncs = new Map();

function getModuleSocketEvent() {
	return `module.${MODULE_ID}`;
}

function isPlaybackSyncEnabled() {
	return !!getSetting('syncPlaylistPlayback');
}

function getPlaylistSoundKey(sound) {
	if (!sound?.parent?.id || !sound?.id) return null;
	return `${sound.parent.id}.${sound.id}`;
}

function isRelevantPlaybackChange(sound, changed = {}) {
	if (!sound?.parent?.id || !sound?.id) return false;
	if ('playing' in changed) return sound.playing || sound.pausedTime != null;
	if ('pausedTime' in changed) return true;
	return false;
}

function getPlaybackInstance(sound) {
	return sound?.sound ?? null;
}

function asFiniteNumber(value) {
	const numeric = Number(value);
	return Number.isFinite(numeric) ? numeric : null;
}

function getPlaybackCurrentTime(playback) {
	if (!playback) return null;

	const directTime = asFiniteNumber(playback.currentTime);
	if (directTime != null) return directTime;

	const nodeTime = asFiniteNumber(playback.node?.currentTime);
	if (nodeTime != null) return nodeTime;

	const innerNodeTime = asFiniteNumber(playback._node?.currentTime);
	if (innerNodeTime != null) return innerNodeTime;

	if (typeof playback.seek === 'function') {
		try {
			const seekTime = asFiniteNumber(playback.seek());
			if (seekTime != null) return seekTime;
		} catch (_error) {}
	}

	return null;
}

function isPlaybackPlaying(playback) {
	if (!playback) return null;
	if (typeof playback.playing === 'boolean') return playback.playing;

	if (typeof playback.playing === 'function') {
		try {
			const value = playback.playing();
			if (typeof value === 'boolean') return value;
		} catch (_error) {}
	}

	if (typeof playback.paused === 'boolean') return !playback.paused;
	if (typeof playback.node?.paused === 'boolean') return !playback.node.paused;
	if (typeof playback._node?.paused === 'boolean') return !playback._node.paused;
	return null;
}

function isPlaybackLoaded(playback) {
	if (!playback) return false;
	if (typeof playback.loaded === 'boolean') return playback.loaded;
	if (typeof playback.state === 'string') return ['loaded', 'playing', 'paused'].includes(playback.state);

	const readyState = playback.node?.readyState ?? playback._node?.readyState;
	return Number.isFinite(readyState) ? readyState >= 2 : false;
}

function readLocalPlaybackState(sound) {
	const playback = getPlaybackInstance(sound);
	return {
		available: !!playback,
		currentTime: getPlaybackCurrentTime(playback),
		playing: isPlaybackPlaying(playback),
		loaded: isPlaybackLoaded(playback),
		documentPlaying: !!sound?.playing,
		pausedTime: asFiniteNumber(sound?.pausedTime),
	};
}

function isPlaybackReadyForReport(session, state) {
	if (!session.desiredPlaying) {
		return state.available || state.currentTime != null || state.pausedTime != null;
	}

	if (!state.available) return false;
	if (state.playing === true) return true;
	if (state.loaded && state.currentTime != null) return true;
	return false;
}

function sleep(ms) {
	return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getActiveUserIds() {
	return game.users.contents.filter((user) => user.active).map((user) => user.id);
}

function resolvePlaylistSound({ playlistId, soundId }) {
	return game.playlists.get(playlistId)?.sounds.get(soundId) ?? null;
}

function getCurrentlyPlayingPlaylistSounds() {
	return game.playlists.contents.flatMap((playlist) =>
		playlist.sounds.contents.filter((sound) => sound.playing)
	);
}

async function collectPlaybackReport(session) {
	const deadline = Date.now() + PLAYBACK_SYNC_TIMEOUT_MS;
	let state = readLocalPlaybackState(resolvePlaylistSound(session));

	while (Date.now() < deadline && !isPlaybackReadyForReport(session, state)) {
		await sleep(PLAYBACK_SYNC_POLL_MS);
		state = readLocalPlaybackState(resolvePlaylistSound(session));
	}

	return {
		type: PLAYBACK_SYNC_SOCKET_TYPE,
		action: PLAYBACK_SYNC_REPORT,
		sessionId: session.sessionId,
		userId: game.user.id,
		currentTime: state.currentTime,
		playing: state.playing,
		loaded: state.loaded,
		timestamp: Date.now(),
	};
}

function queuePlaybackSync(sound, userId) {
	const key = getPlaylistSoundKey(sound);
	if (!key) return;

	const existingTimer = pendingPlaybackSyncs.get(key);
	if (existingTimer) window.clearTimeout(existingTimer);

	const timer = window.setTimeout(() => {
		pendingPlaybackSyncs.delete(key);
		const liveSound = resolvePlaylistSound({ playlistId: sound.parent.id, soundId: sound.id });
		if (!liveSound) return;
		void startPlaybackSync(liveSound, userId);
	}, PLAYBACK_SYNC_DEBOUNCE_MS);

	pendingPlaybackSyncs.set(key, timer);
}

async function startPlaybackSync(sound, userId) {
	if (!game.user.isGM || !isPlaybackSyncEnabled()) return;

	const session = {
		type: PLAYBACK_SYNC_SOCKET_TYPE,
		action: PLAYBACK_SYNC_REQUEST,
		sessionId: `${Date.now()}:${++playbackSyncSequence}`,
		initiatorId: game.user.id,
		playlistId: sound.parent.id,
		soundId: sound.id,
		desiredPlaying: !!sound.playing,
		desiredPausedTime: asFiniteNumber(sound.pausedTime),
		expectedUserIds: new Set(getActiveUserIds()),
		responses: new Map(),
		timeoutId: null,
	};

	activePlaybackSyncs.set(session.sessionId, session);
	game.socket?.emit(getModuleSocketEvent(), session);

	session.timeoutId = window.setTimeout(() => {
		void finalizePlaybackSync(session.sessionId);
	}, PLAYBACK_SYNC_TIMEOUT_MS);

	const localReport = await collectPlaybackReport(session);
	recordPlaybackReport(localReport);
}

async function syncCurrentPlaybackForUser(userId) {
	if (!game.user.isGM || !isPlaybackSyncEnabled()) return;

	for (const sound of getCurrentlyPlayingPlaylistSounds()) {
		await startPlaybackSync(sound, userId);
	}
}

function recordPlaybackReport(report) {
	const session = activePlaybackSyncs.get(report?.sessionId);
	if (!session) return;

	session.responses.set(report.userId, report);
	if (session.responses.size >= session.expectedUserIds.size) {
		void finalizePlaybackSync(session.sessionId);
	}
}

function projectPlaybackTime(report, now, desiredPlaying) {
	const currentTime = asFiniteNumber(report?.currentTime);
	if (currentTime == null) return null;
	if (!desiredPlaying) return Math.max(0, currentTime);

	const timestamp = asFiniteNumber(report?.timestamp) ?? now;
	const drift = Math.max(0, (now - timestamp) / 1000);
	return Math.max(0, currentTime + drift);
}

function computeSyncTarget(session) {
	const now = Date.now();
	const projectedTimes = [...session.responses.values()]
		.map((report) => projectPlaybackTime(report, now, session.desiredPlaying))
		.filter((time) => time != null);

	if (projectedTimes.length > 0) {
		const furthestTime = Math.max(...projectedTimes);
		return session.desiredPlaying
			? furthestTime + PLAYBACK_SYNC_TARGET_LEAD_SECONDS
			: furthestTime;
	}

	if (session.desiredPausedTime != null) return Math.max(0, session.desiredPausedTime);
	return session.desiredPlaying ? PLAYBACK_SYNC_TARGET_LEAD_SECONDS : 0;
}

async function finalizePlaybackSync(sessionId) {
	const session = activePlaybackSyncs.get(sessionId);
	if (!session) return;

	activePlaybackSyncs.delete(sessionId);
	if (session.timeoutId) window.clearTimeout(session.timeoutId);

	const command = {
		type: PLAYBACK_SYNC_SOCKET_TYPE,
		action: PLAYBACK_SYNC_APPLY,
		sessionId: session.sessionId,
		playlistId: session.playlistId,
		soundId: session.soundId,
		desiredPlaying: session.desiredPlaying,
		targetTime: computeSyncTarget(session),
	};

	game.socket?.emit(getModuleSocketEvent(), command);
	await applyPlaybackSync(command);
}

function setPlaybackCurrentTime(playback, targetTime) {
	if (!playback) return false;
	const clampedTime = Math.max(0, Number(targetTime) || 0);

	if (typeof playback.seek === 'function') {
		try {
			playback.seek(clampedTime);
			return true;
		} catch (_error) {}
	}

	for (const candidate of [playback, playback.node, playback._node]) {
		if (!candidate || !('currentTime' in candidate)) continue;
		try {
			candidate.currentTime = clampedTime;
			return true;
		} catch (_error) {}
	}

	return false;
}

async function forcePlaybackState(playback, shouldPlay) {
	if (!playback) return;

	if (shouldPlay) {
		if (typeof playback.play === 'function') {
			try {
				await playback.play();
			} catch (_error) {}
		}
		return;
	}

	if (typeof playback.pause === 'function') {
		try {
			await playback.pause();
		} catch (_error) {}
	}
}

async function applyPlaybackSync(command) {
	const deadline = Date.now() + PLAYBACK_SYNC_APPLY_TIMEOUT_MS;
	let sound = resolvePlaylistSound(command);
	let playback = getPlaybackInstance(sound);

	while (Date.now() < deadline && !playback) {
		await sleep(PLAYBACK_SYNC_POLL_MS);
		sound = resolvePlaylistSound(command);
		playback = getPlaybackInstance(sound);
	}

	if (!playback) return;

	const currentTime = getPlaybackCurrentTime(playback);
	const targetTime = asFiniteNumber(command.targetTime);
	if (targetTime != null && (currentTime == null || Math.abs(currentTime - targetTime) > PLAYBACK_SYNC_SEEK_TOLERANCE_SECONDS)) {
		setPlaybackCurrentTime(playback, targetTime);
	}

	const isPlaying = isPlaybackPlaying(playback);
	if (command.desiredPlaying && isPlaying === false) {
		await forcePlaybackState(playback, true);
	}
	if (!command.desiredPlaying && isPlaying === true) {
		await forcePlaybackState(playback, false);
	}
}

Hooks.once('ready', () => {
	game.socket?.on(getModuleSocketEvent(), (data) => {
		if (data?.type !== PLAYBACK_SYNC_SOCKET_TYPE) return;

		if (data.action === PLAYBACK_SYNC_LATE_JOIN) {
			void syncCurrentPlaybackForUser(data.userId);
			return;
		}

		if (data.action === PLAYBACK_SYNC_REQUEST) {
			void collectPlaybackReport(data).then((report) => {
				game.socket?.emit(getModuleSocketEvent(), report);
			});
			return;
		}

		if (data.action === PLAYBACK_SYNC_REPORT) {
			recordPlaybackReport(data);
			return;
		}

		if (data.action === PLAYBACK_SYNC_APPLY) {
			void applyPlaybackSync(data);
		}
	});

	if (isPlaybackSyncEnabled()) {
		window.setTimeout(() => {
			game.socket?.emit(getModuleSocketEvent(), {
				type: PLAYBACK_SYNC_SOCKET_TYPE,
				action: PLAYBACK_SYNC_LATE_JOIN,
				userId: game.user.id,
			});
		}, 1000);
	}
});

Hooks.on('updatePlaylistSound', (sound, changed, _options, userId) => {
	if (!game.user.isGM || !isPlaybackSyncEnabled()) return;
	if (!isRelevantPlaybackChange(sound, changed)) return;
	queuePlaybackSync(sound, userId);
});

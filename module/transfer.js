import { MODULE_ID, getSetting, setSetting } from './settings.js';
import { parseMusic } from './music-manager.js';

/* -------------------------------------------- */
/*  Export                                      */
/* -------------------------------------------- */

export function buildMusicConfigExportData() {
	const combatPlaylists = game.playlists.contents.filter((p) => p.getFlag(MODULE_ID, 'combat'));
	const defaultPlaylistId = getSetting('defaultPlaylist');
	const traitRules = getSetting('traitRules') ?? [];

	const playlists = combatPlaylists.map((playlist) => ({
		name: playlist.name,
		default: playlist.id === defaultPlaylistId,
		mode: playlist.mode,
		sounds: playlist.sounds.contents.map((sound) => ({
			name: sound.name,
			path: sound.path,
			volume: sound.volume,
			repeat: sound.repeat,
			streaming: sound.streaming,
		})),
	}));

	// Resolve trait rules to names so they survive across worlds.
	const resolvedTraitRules = traitRules.map((rule) => {
		const sound = parseMusic(rule.music);
		const playlist = 'error' in sound ? null : sound.parent ?? sound;
		const track = playlist && sound !== playlist ? sound : null;
		return {
			trait: rule.trait,
			priority: rule.priority,
			playlistName: playlist?.name ?? '',
			trackName: track?.name ?? '',
		};
	});

	// Resolve victory music to names.
	const resolveVictoryMusic = (key) => {
		const flag = getSetting(key);
		if (!flag) return null;
		const sound = parseMusic(flag);
		if ('error' in sound) return null;
		const playlist = sound.parent ?? sound;
		const track = sound.documentName === 'PlaylistSound' ? sound : null;
		return { playlistName: playlist.name, trackName: track?.name ?? '' };
	};

	const data = {
		world: game.world.id,
		version: game.modules.get(MODULE_ID)?.version ?? '?',
		exportedAt: new Date().toISOString(),
		playlists,
		traitRules: resolvedTraitRules,
		victoryMusic: {
			generic: resolveVictoryMusic('victoryMusicGeneric'),
			trivial: resolveVictoryMusic('victoryMusicTrivial'),
			boss: resolveVictoryMusic('victoryMusicBoss'),
		},
	};

	return data;
}

export function stringifyMusicConfig(data = buildMusicConfigExportData()) {
	return JSON.stringify(data, null, 2);
}

export async function exportMusicConfig() {
	const json = stringifyMusicConfig();
	saveDataToFile(json, 'application/json', `${game.world.id}.music.json`);
	ui.notifications.info('PF2 Director | Music config exported.');
}

/* -------------------------------------------- */
/*  Import                                      */
/* -------------------------------------------- */

export function parseMusicConfigText(text) {
	let data;
	try {
		data = JSON.parse(text);
	} catch {
		throw new Error('PF2 Director | Invalid JSON file.');
	}

	if (!data.playlists || !Array.isArray(data.playlists)) {
		throw new Error('PF2 Director | Not a valid music export file.');
	}

	return data;
}

export async function importMusicConfigFromText(text) {
	const data = parseMusicConfigText(text);
	await applyImport(data);
}

export function importMusicConfig() {
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = '.json';
	input.style.display = 'none';
	document.body.appendChild(input);

	input.addEventListener('change', async (ev) => {
		document.body.removeChild(input);
		const file = ev.target.files[0];
		if (!file) return;
		const text = await file.text();
		try {
			await importMusicConfigFromText(text);
		} catch (error) {
			ui.notifications.error(error.message || 'PF2 Director | Import failed.');
			return;
		}
	});

	// Clean up if user cancels without selecting a file.
	input.addEventListener('cancel', () => {
		document.body.removeChild(input);
	});

	input.click();
}

export async function applyImport(data) {
	ui.notifications.info('PF2 Director | Importing music config...');
	let defaultPlaylistId = '';

	// Build a name→playlist map as we go so trait resolution sees newly created playlists.
	const playlistMap = new Map();

	for (const playlistData of data.playlists) {
		let playlist = game.playlists.contents.find((p) => p.name === playlistData.name);
		if (!playlist) {
			playlist = await Playlist.create({ name: playlistData.name, mode: playlistData.mode ?? -1 });
		} else {
			await playlist.update({ mode: playlistData.mode ?? playlist.mode });
		}

		await playlist.setFlag(MODULE_ID, 'combat', true);
		if (playlistData.default) defaultPlaylistId = playlist.id;
		playlistMap.set(playlistData.name, playlist);

		for (const soundData of playlistData.sounds) {
			const existing = playlist.sounds.contents.find((s) => s.name === soundData.name);
			if (!existing) {
				await playlist.createEmbeddedDocuments('PlaylistSound', [{
					name: soundData.name,
					path: soundData.path,
					volume: soundData.volume ?? 0.8,
					repeat: soundData.repeat ?? true,
					streaming: soundData.streaming ?? false,
				}]);
			} else {
				await existing.update({ path: soundData.path });
			}
		}
	}

	if (defaultPlaylistId) await setSetting('defaultPlaylist', defaultPlaylistId);

	// Resolve trait rules using the map we built during import.
	if (data.traitRules?.length) {
		const resolvedRules = data.traitRules.map((rule) => {
			const playlist = playlistMap.get(rule.playlistName);
			const track = rule.trackName
				? playlist?.sounds.contents.find((s) => s.name === rule.trackName)
				: null;
			const music = track
				? (playlist.id + '.' + track.id)
				: playlist?.id ?? '';
			return {
				trait: rule.trait,
				priority: rule.priority,
				playlistId: playlist?.id ?? '',
				trackId: track?.id ?? '',
				music,
			};
		}).filter((r) => r.music);
		await setSetting('traitRules', resolvedRules);
	}

	// Resolve victory music using the playlist map.
	if (data.victoryMusic) {
		const resolveVictory = (entry) => {
			if (!entry?.playlistName) return '';
			const playlist = playlistMap.get(entry.playlistName) ?? game.playlists.contents.find((p) => p.name === entry.playlistName);
			if (!playlist) return '';
			const track = entry.trackName ? playlist.sounds.contents.find((s) => s.name === entry.trackName) : null;
			return track ? (playlist.id + '.' + track.id) : playlist.id;
		};
		const generic = resolveVictory(data.victoryMusic.generic);
		const trivial = resolveVictory(data.victoryMusic.trivial);
		const boss = resolveVictory(data.victoryMusic.boss);
		if (generic) await setSetting('victoryMusicGeneric', generic);
		if (trivial) await setSetting('victoryMusicTrivial', trivial);
		if (boss) await setSetting('victoryMusicBoss', boss);
	}

	ui.notifications.info('PF2 Director | Import complete!');
}

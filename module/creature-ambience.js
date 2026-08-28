import { MODULE_ID } from './settings.js';

const SOCKET_EVENT = `module.${MODULE_ID}`;
const SOCKET_TYPE = 'creatureAmbiencePlay';
const SCENE_FLAG = 'enablePassiveCreatureSounds';
const CREATURE_SOUNDS_MODULE_ID = 'pf2e-creature-sounds';
const WAYFINDER_MODULE_ID = 'wayfinder';
const CREATURE_SOUNDS_SETTINGS = {
	CREATURE_SOUNDS: 'creatureSounds_enable',
	CREATURE_ATTACK_SOUNDS: 'creatureSounds_attack_enable',
	CREATURE_HURT_SOUNDS: 'creatureSounds_hurt_enable',
	CUSTOM_SOUND_SETS: 'custom_sound_sets',
};
const CREATURE_SOUND_NONE = 'none';
const ATTACK_WEIGHT = 0.7;
const NEARBY_SOURCE_WEIGHT = 0.65;
const BASE_VOLUME = 0.65;
const DOOR_ATTENUATION = 0.5;
const DISTANCE_ATTENUATION = 0.99;
const MIN_AUDIBLE_VOLUME = 0.1;
const PLAYBACK_VOLUME_EXPONENT = 2;
const SHORT_RETRY_MIN_SECONDS = 1;
const SHORT_RETRY_MAX_SECONDS = 10;
const NORMAL_RETRY_MIN_SECONDS = 31;
const NORMAL_RETRY_MAX_SECONDS = 60;
const KEYWORD_NAME_SCORE = 5;
const KEYWORD_BLURB_SCORE = 4;
const TRAIT_SCORE = 1;
const OPEN_DOOR_STATE = 1;

let ambienceTimerId = null;
let ambienceCycleToken = 0;
let builtinSoundDatabasePromise = null;

function logDebug(...args) {
	if (!game.settings.get(MODULE_ID, 'creatureAmbienceDebug')) return;
	console.log('[PF2 Director: Creature Ambience]', ...args);
}

function isFeatureEnabled() {
	return game.settings.get(MODULE_ID, 'enableCreatureAmbience');
}

function isSceneCreatureAmbienceEnabled(scene = canvas?.scene) {
	return scene?.getFlag?.(MODULE_ID, SCENE_FLAG) !== false;
}

function isForceLocalDebugEnabled() {
	return game.settings.get(MODULE_ID, 'creatureAmbienceForceLocalDebug');
}

function isCombatActive() {
	return !!game.combat?.started;
}

function isEndCreditsActive() {
	try {
		return !!game.settings.get(MODULE_ID, 'endCreditsActive');
	} catch (_error) {
		return false;
	}
}

function isCreatureSoundsEnabled() {
	const module = game.modules.get(CREATURE_SOUNDS_MODULE_ID);
	if (!module?.active) return false;
	return !!game.settings.get(CREATURE_SOUNDS_MODULE_ID, CREATURE_SOUNDS_SETTINGS.CREATURE_SOUNDS);
}

function randomIntInclusive(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rollRetrySeconds(kind) {
	if (kind === 'short') return randomIntInclusive(SHORT_RETRY_MIN_SECONDS, SHORT_RETRY_MAX_SECONDS);
	return randomIntInclusive(NORMAL_RETRY_MIN_SECONDS, NORMAL_RETRY_MAX_SECONDS);
}

function clearAmbienceTimer() {
	if (ambienceTimerId !== null) window.clearTimeout(ambienceTimerId);
	ambienceTimerId = null;
}

function scheduleNextCycle(kind = 'normal') {
	clearAmbienceTimer();
	if (!game.user.isGM || !isFeatureEnabled() || !isSceneCreatureAmbienceEnabled()) return;
	if (isEndCreditsActive()) {
		logDebug('Creature ambience is quiet while end credits are active.');
		return;
	}
	const seconds = rollRetrySeconds(kind);
	const token = ambienceCycleToken;
	logDebug(`Scheduling next ${kind} creature ambience check in ${seconds}s.`);
	ambienceTimerId = window.setTimeout(() => {
		if (token !== ambienceCycleToken) return;
		void runCreatureAmbienceCycle();
	}, seconds * 1000);
}

function getConnectedPlayers() {
	return game.users.filter((user) => user.active && !user.isGM);
}

function getConnectedGMs() {
	return game.users.filter((user) => user.active && user.isGM);
}

function actorIsPlayerObserved(actor) {
	if (!actor) return true;
	const observerLevel = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 2;
	return game.users.some((user) => !user.isGM && actor.testUserPermission?.(user, observerLevel));
}

function actorCanMakeAmbientSound(actor) {
	if (!actor) return false;
	if (actor.type === 'loot') return false;
	const hpValue = Number(actor.system?.attributes?.hp?.value);
	if (Number.isFinite(hpValue) && hpValue <= 0) return false;
	return true;
}

function tokenIsPartyAllied(token) {
	const alliance = String(
		token?.alliance ??
			token?.document?.alliance ??
			token?.actor?.alliance ??
			token?.actor?.system?.details?.alliance ??
			''
	).trim().toLowerCase();
	return alliance === 'party';
}

function getTokenCenter(tokenDocument) {
	const tokenObject = tokenDocument?.object;
	if (tokenObject?.center) return tokenObject.center;
	const size = canvas.dimensions?.size ?? canvas.grid?.size ?? 100;
	if (typeof tokenDocument?.x !== 'number' || typeof tokenDocument?.y !== 'number') return null;
	const width = (Number(tokenDocument.width) || 1) * size;
	const height = (Number(tokenDocument.height) || 1) * size;
	return {
		x: tokenDocument.x + width / 2,
		y: tokenDocument.y + height / 2,
	};
}

function getActiveSceneTokens() {
	if (!canvas?.ready || !canvas.scene || !canvas.tokens?.placeables) return [];
	return canvas.tokens.placeables.filter((token) => token?.document?.parent === canvas.scene);
}

function getEligibleSourceTokens() {
	return getActiveSceneTokens().filter(
		(token) => token.actor && actorCanMakeAmbientSound(token.actor) && !actorIsPlayerObserved(token.actor) && !tokenIsPartyAllied(token)
	);
}

function getControlledPlayerTokens() {
	if (!canvas?.tokens?.controlled?.length) return [];
	return canvas.tokens.controlled.filter((token) => token.actor && actorIsPlayerObserved(token.actor));
}

function getPlacedPlayerObservedTokens(sourceToken = null) {
	return getActiveSceneTokens().filter((token) => {
		if (!token.actor) return false;
		if (sourceToken && token.document.id === sourceToken.document.id) return false;
		return actorIsPlayerObserved(token.actor);
	});
}

function getEligibleListenerTokensForUser(user, sourceToken) {
	const observerLevel = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 2;
	return getActiveSceneTokens().filter((token) => {
		if (!token.actor) return false;
		if (token.document.id === sourceToken.document.id) return false;
		return token.actor.testUserPermission?.(user, observerLevel);
	});
}

function chooseSourceToken() {
	const candidates = getEligibleSourceTokens();
	if (!candidates.length) return null;
	const controlledPlayerTokens = getControlledPlayerTokens();
	if (controlledPlayerTokens.length && Math.random() < NEARBY_SOURCE_WEIGHT) {
		let bestCandidate = null;
		let bestDistance = Number.POSITIVE_INFINITY;
		for (const sourceToken of candidates) {
			const sourceCenter = getTokenCenter(sourceToken.document);
			if (!sourceCenter) continue;
			for (const playerToken of controlledPlayerTokens) {
				const playerCenter = getTokenCenter(playerToken.document);
				if (!playerCenter) continue;
				const distance = Math.hypot(sourceCenter.x - playerCenter.x, sourceCenter.y - playerCenter.y);
				if (distance < bestDistance) {
					bestDistance = distance;
					bestCandidate = sourceToken;
				}
			}
		}
		if (bestCandidate) {
			logDebug(`Biased source pick chose nearby creature ${bestCandidate.name} at distance ${bestDistance.toFixed(2)}.`);
			return bestCandidate;
		}
	}
	return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
}

function chooseSoundType() {
	return Math.random() < ATTACK_WEIGHT ? 'attack' : 'hurt';
}

function getActorName(actor) {
	return actor?.flags?.babele?.originalName || actor?.name || '';
}

function getHashCode(str) {
	let hash = 0;
	if (!str.length) return hash;
	for (let index = 0; index < str.length; index += 1) {
		const char = str.charCodeAt(index);
		hash = (hash << 5) - hash + char;
		hash &= hash;
	}
	return hash;
}

async function loadBuiltinCreatureSoundDatabase() {
	if (builtinSoundDatabasePromise) return builtinSoundDatabasePromise;
	builtinSoundDatabasePromise = (async () => {
		const response = await fetch(`modules/${CREATURE_SOUNDS_MODULE_ID}/dist/pf2e-creature-sounds.js`);
		if (!response.ok) throw new Error(`Unable to load ${CREATURE_SOUNDS_MODULE_ID} bundle.`);
		const source = await response.text();
		const parsed = Function(`"use strict"; ${extractCreatureSoundDatabaseProgram(source)}; return creature_sounds_db;`)();
		return Object.fromEntries(
			Object.entries(parsed).map(([key, value]) => [
				key,
				{
					...value,
					id: key,
				},
			])
		);
	})();
	return builtinSoundDatabasePromise;
}

function extractCreatureSoundDatabaseProgram(source) {
	const functionMarker = 'function getActorName';
	const dbMarker = 'const creature_sounds_db =';
	const endMarker = 'const soundDatabase = Object.fromEntries';
	const functionIndex = source.indexOf(functionMarker);
	const dbIndex = source.indexOf(dbMarker);
	const endIndex = source.indexOf(endMarker, dbIndex);
	if (functionIndex === -1 || dbIndex === -1 || endIndex === -1) {
		throw new Error('Unable to locate PF2e Creature Sounds database.');
	}
	const startIndex = source.indexOf('const ', functionIndex);
	if (startIndex === -1 || startIndex > dbIndex) {
		throw new Error('Unable to locate PF2e Creature Sounds data definitions.');
	}
	const program = source.slice(startIndex, endIndex).trim();
	if (!program) throw new Error('Unable to parse PF2e Creature Sounds database.');
	return program;
}

function getCustomSoundDatabase() {
	const raw = game.settings.get(CREATURE_SOUNDS_MODULE_ID, CREATURE_SOUNDS_SETTINGS.CUSTOM_SOUND_SETS);
	if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
	return {};
}

function extractTraits(actor) {
	const rollOptions = actor?.flags?.pf2e?.rollOptions?.all ?? {};
	const traits = [];
	for (const key of Object.keys(rollOptions)) {
		if (!key.startsWith('self:trait:') && !key.startsWith('origin:trait:')) continue;
		traits.push(key.slice(key.lastIndexOf(':') + 1));
	}
	const gender = actor?.type === 'character' ? getGenderFromPronouns(actor) : getGenderFromBlurb(actor);
	if (gender) traits.push(gender);
	return traits;
}

function getGenderFromPronouns(actor) {
	const pronouns = actor?.system?.details?.gender?.value;
	if (!pronouns) return null;
	if (/\b(she|her)\b/i.test(pronouns)) return 'female';
	if (/\b(he|him)\b/i.test(pronouns)) return 'male';
	return null;
}

function getGenderFromBlurb(actor) {
	const blurb = actor?.system?.details?.blurb;
	if (!blurb) return null;
	if (/\bfemale\b/i.test(blurb)) return 'female';
	if (/\bmale\b/i.test(blurb)) return 'male';
	return null;
}

function extractSize(actor) {
	const rollOptions = actor?.flags?.pf2e?.rollOptions?.all ?? {};
	for (const key of Object.keys(rollOptions)) {
		const match = key.match(/^(self|origin):size:(\d+)$/);
		if (!match) continue;
		const size = Number.parseInt(match[2], 10);
		if (Number.isFinite(size)) return size;
	}
	return -1;
}

function getMatchingSoundSetByName(soundDatabase, creatureName) {
	for (const soundSet of Object.values(soundDatabase)) {
		if (soundSet?.creatures?.includes?.(creatureName)) return soundSet;
	}
	return null;
}

function scoreSoundSets(soundDatabase, actor) {
	const scores = new Map();
	const traits = extractTraits(actor);
	const creatureSize = extractSize(actor);
	const blurb = actor?.type === 'npc' ? actor?.system?.details?.blurb : null;
	for (const soundSet of Object.values(soundDatabase)) {
		let score = 0;
		for (const keyword of soundSet.keywords ?? []) {
			const regex = new RegExp(`\\b${keyword}\\b`, 'i');
			if (regex.test(getActorName(actor))) score += KEYWORD_NAME_SCORE;
			if (blurb && regex.test(blurb)) score += KEYWORD_BLURB_SCORE;
		}
		score += (soundSet.traits ?? []).filter((trait) => traits.includes(trait)).length * TRAIT_SCORE;
		if (score > 0 && soundSet.size !== -1 && creatureSize !== -1) {
			score += (2 - Math.abs(creatureSize - soundSet.size)) / 10;
		}
		scores.set(soundSet, score);
	}
	return scores;
}

function getMatchingSoundSetByScore(soundDatabase, actor) {
	const scores = scoreSoundSets(soundDatabase, actor);
	let highestScore = 1;
	let candidates = [];
	for (const [soundSet, score] of scores.entries()) {
		if (score > highestScore) {
			highestScore = score;
			candidates = [soundSet];
		} else if (score === highestScore) {
			candidates.push(soundSet);
		}
	}
	if (!candidates.length) return null;
	const hash = Math.abs(getHashCode(getActorName(actor)));
	return candidates[hash % candidates.length] ?? null;
}

async function findCreatureSoundSet(actor) {
	const builtinSoundDatabase = await loadBuiltinCreatureSoundDatabase();
	const customSoundDatabase = getCustomSoundDatabase();
	const chosenSoundSet = actor?.flags?.[CREATURE_SOUNDS_MODULE_ID]?.soundset;
	if (chosenSoundSet) {
		if (chosenSoundSet === CREATURE_SOUND_NONE) return null;
		if (builtinSoundDatabase[chosenSoundSet]) return builtinSoundDatabase[chosenSoundSet];
		if (customSoundDatabase[chosenSoundSet]) return customSoundDatabase[chosenSoundSet];
	}
	return getMatchingSoundSetByName(builtinSoundDatabase, getActorName(actor)) ?? getMatchingSoundSetByScore(builtinSoundDatabase, actor);
}

function getSoundsOfType(soundSet, soundType) {
	if (soundType === 'attack') return soundSet.attack_sounds ?? [];
	if (soundType === 'hurt') return soundSet.hurt_sounds ?? [];
	return [];
}

async function resolveCreatureSound(actor, soundType) {
	if (!actor?.system?.attributes?.emitsSound) return null;
	const typeSetting =
		soundType === 'attack'
			? CREATURE_SOUNDS_SETTINGS.CREATURE_ATTACK_SOUNDS
			: CREATURE_SOUNDS_SETTINGS.CREATURE_HURT_SOUNDS;
	if (!game.settings.get(CREATURE_SOUNDS_MODULE_ID, typeSetting)) return null;
	const soundSet = await findCreatureSoundSet(actor);
	if (!soundSet) return null;
	const sounds = getSoundsOfType(soundSet, soundType).filter((entry) => typeof entry === 'string' && entry.trim());
	if (!sounds.length) return null;
	return sounds[Math.floor(Math.random() * sounds.length)] ?? null;
}

function getSceneGridMetrics() {
	const sceneRect = canvas.dimensions?.sceneRect;
	const size = canvas.grid?.size ?? canvas.dimensions?.size ?? 0;
	if (!sceneRect || !size) return null;
	return {
		sceneRect,
		size,
		columns: Math.max(1, Math.floor(sceneRect.width / size)),
		rows: Math.max(1, Math.floor(sceneRect.height / size)),
	};
}

function snapPointToGridNode(point, metrics) {
	const col = Math.max(0, Math.min(metrics.columns - 1, Math.floor((point.x - metrics.sceneRect.x) / metrics.size)));
	const row = Math.max(0, Math.min(metrics.rows - 1, Math.floor((point.y - metrics.sceneRect.y) / metrics.size)));
	return { col, row };
}

function gridNodeCenter(node, metrics) {
	return {
		x: metrics.sceneRect.x + node.col * metrics.size + metrics.size / 2,
		y: metrics.sceneRect.y + node.row * metrics.size + metrics.size / 2,
	};
}

function nodeKey(node) {
	return `${node.col},${node.row}`;
}

function getSoundBlockingWalls() {
	return canvas.scene?.walls?.contents?.filter((wall) => Number(wall.sound ?? wall.document?.sound ?? 0) !== 0) ?? [];
}

function orientation(ax, ay, bx, by, cx, cy) {
	return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

function onSegment(ax, ay, bx, by, cx, cy) {
	return (
		Math.min(ax, bx) - 1e-6 <= cx &&
		cx <= Math.max(ax, bx) + 1e-6 &&
		Math.min(ay, by) - 1e-6 <= cy &&
		cy <= Math.max(ay, by) + 1e-6
	);
}

function segmentsIntersect(a1, a2, b1, b2) {
	const o1 = orientation(a1.x, a1.y, a2.x, a2.y, b1.x, b1.y);
	const o2 = orientation(a1.x, a1.y, a2.x, a2.y, b2.x, b2.y);
	const o3 = orientation(b1.x, b1.y, b2.x, b2.y, a1.x, a1.y);
	const o4 = orientation(b1.x, b1.y, b2.x, b2.y, a2.x, a2.y);
	if (Math.abs(o1) < 1e-6 && onSegment(a1.x, a1.y, a2.x, a2.y, b1.x, b1.y)) return true;
	if (Math.abs(o2) < 1e-6 && onSegment(a1.x, a1.y, a2.x, a2.y, b2.x, b2.y)) return true;
	if (Math.abs(o3) < 1e-6 && onSegment(b1.x, b1.y, b2.x, b2.y, a1.x, a1.y)) return true;
	if (Math.abs(o4) < 1e-6 && onSegment(b1.x, b1.y, b2.x, b2.y, a2.x, a2.y)) return true;
	return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
}

function evaluateStepWalls(fromPoint, toPoint, walls) {
	let closedDoors = 0;
	for (const wall of walls) {
		const [x1, y1, x2, y2] = wall.c ?? wall.document?.c ?? [];
		if (![x1, y1, x2, y2].every(Number.isFinite)) continue;
		if (!segmentsIntersect(fromPoint, toPoint, { x: x1, y: y1 }, { x: x2, y: y2 })) continue;
		const doorType = Number(wall.door ?? wall.document?.door ?? 0);
		if (doorType > 0) {
			const doorState = Number(wall.ds ?? wall.document?.ds ?? 0);
			if (doorState !== OPEN_DOOR_STATE) closedDoors += 1;
			continue;
		}
		return { blocked: true, closedDoors: 0 };
	}
	return { blocked: false, closedDoors };
}

function findPathBetweenPoints(startPoint, endPoint) {
	const metrics = getSceneGridMetrics();
	if (!metrics) return null;
	if (canvas.grid?.isGridless) return null;
	const start = snapPointToGridNode(startPoint, metrics);
	const goal = snapPointToGridNode(endPoint, metrics);
	const walls = getSoundBlockingWalls();
	const open = [start];
	const openSet = new Set([nodeKey(start)]);
	const cameFrom = new Map();
	const gScore = new Map([[nodeKey(start), 0]]);
	const doorCounts = new Map([[nodeKey(start), 0]]);
	const heuristic = (node) => Math.hypot(goal.col - node.col, goal.row - node.row);
	const fScore = new Map([[nodeKey(start), heuristic(start)]]);
	const directions = [
		{ dc: -1, dr: -1 },
		{ dc: 0, dr: -1 },
		{ dc: 1, dr: -1 },
		{ dc: -1, dr: 0 },
		{ dc: 1, dr: 0 },
		{ dc: -1, dr: 1 },
		{ dc: 0, dr: 1 },
		{ dc: 1, dr: 1 },
	];
	let safety = 0;
	while (open.length) {
		safety += 1;
		if (safety > 200000) return null;
		let currentIndex = 0;
		for (let index = 1; index < open.length; index += 1) {
			if ((fScore.get(nodeKey(open[index])) ?? Number.POSITIVE_INFINITY) < (fScore.get(nodeKey(open[currentIndex])) ?? Number.POSITIVE_INFINITY)) {
				currentIndex = index;
			}
		}
		const current = open.splice(currentIndex, 1)[0];
		const currentKey = nodeKey(current);
		openSet.delete(currentKey);
		if (current.col === goal.col && current.row === goal.row) {
			const path = [];
			let traceKey = currentKey;
			path.push(current);
			while (cameFrom.has(traceKey)) {
				const previous = cameFrom.get(traceKey);
				path.unshift(previous);
				traceKey = nodeKey(previous);
			}
			return {
				nodes: path,
				squares: gScore.get(currentKey) ?? 0,
				closedDoors: doorCounts.get(currentKey) ?? 0,
			};
		}
		for (const direction of directions) {
			const neighbor = { col: current.col + direction.dc, row: current.row + direction.dr };
			if (neighbor.col < 0 || neighbor.row < 0 || neighbor.col >= metrics.columns || neighbor.row >= metrics.rows) continue;
			const currentPoint = gridNodeCenter(current, metrics);
			const neighborPoint = gridNodeCenter(neighbor, metrics);
			const stepWalls = evaluateStepWalls(currentPoint, neighborPoint, walls);
			if (stepWalls.blocked) continue;
			const stepSquares = Math.hypot(direction.dc, direction.dr);
			const tentativeScore = (gScore.get(currentKey) ?? Number.POSITIVE_INFINITY) + stepSquares;
			const neighborKey = nodeKey(neighbor);
			if (tentativeScore >= (gScore.get(neighborKey) ?? Number.POSITIVE_INFINITY)) continue;
			cameFrom.set(neighborKey, current);
			gScore.set(neighborKey, tentativeScore);
			doorCounts.set(neighborKey, (doorCounts.get(currentKey) ?? 0) + stepWalls.closedDoors);
			fScore.set(neighborKey, tentativeScore + heuristic(neighbor));
			if (!openSet.has(neighborKey)) {
				open.push(neighbor);
				openSet.add(neighborKey);
			}
		}
	}
	return null;
}

function computeAudibility(sourceToken, listenerToken) {
	const sourceCenter = getTokenCenter(sourceToken.document);
	const listenerCenter = getTokenCenter(listenerToken.document);
	if (!sourceCenter || !listenerCenter) return null;
	const path = findPathBetweenPoints(sourceCenter, listenerCenter);
	if (!path) return null;
	return path;
}

function computeVolume(pathResult) {
	return BASE_VOLUME * Math.pow(DOOR_ATTENUATION, pathResult.closedDoors) * Math.pow(DISTANCE_ATTENUATION, pathResult.squares);
}

function computePlaybackVolume(volume) {
	const clamped = Math.max(0, Math.min(1, Number(volume) || 0));
	return Math.pow(clamped, PLAYBACK_VOLUME_EXPONENT);
}

function triggerLocalSoundPlayback({ src, volume }) {
	try {
		if (isEndCreditsActive()) {
			logDebug(`Ignoring creature ambience playback for ${src} because end credits are active.`);
			return;
		}
		if (!isSceneCreatureAmbienceEnabled()) {
			logDebug(`Ignoring creature ambience playback for ${src} because passive creature sounds are disabled for this scene.`);
			return;
		}
		const playbackVolume = computePlaybackVolume(volume);
		logDebug(
			`Local playback requested for ${src} at computed volume ${Math.max(0, Math.min(1, volume)).toFixed(4)} and playback volume ${playbackVolume.toFixed(4)}.`
		);
		foundry.audio.AudioHelper.play(
			{
				src,
				volume: playbackVolume,
				autoplay: true,
				loop: false,
			},
			false
		);
	} catch (error) {
		console.warn('[PF2 Director] Failed to play creature ambience sound:', error);
	}
}

function emitSoundToUser(userId, src, volume, sourceToken, listenerToken, pathResult) {
	const payload = {
		type: SOCKET_TYPE,
		userId,
		src,
		volume,
		sourceTokenId: sourceToken.document.id,
		listenerTokenId: listenerToken.document.id,
		closedDoors: pathResult.closedDoors,
		squares: pathResult.squares,
	};
	if (userId === game.user.id) {
		logDebug(
			`Direct local playback shortcut for source token ${payload.sourceTokenId} to listener ${payload.listenerTokenId} at volume ${Number(payload.volume ?? 0).toFixed(4)}.`
		);
		triggerLocalSoundPlayback(payload);
		return;
	}
	game.socket?.emit(SOCKET_EVENT, payload);
}

async function findBestListenerResultForUser(user, sourceToken) {
	const listeners = getEligibleListenerTokensForUser(user, sourceToken);
	return findBestListenerResultAcrossTokens(sourceToken, listeners);
}

function getForcedLocalDebugUser(sourceToken) {
	if (!game.user?.isGM || !isForceLocalDebugEnabled()) return null;
	const controlledListeners = getControlledPlayerTokens().filter((token) => token.document.id !== sourceToken.document.id);
	const listeners = controlledListeners.length ? controlledListeners : getPlacedPlayerObservedTokens(sourceToken);
	if (!listeners.length) return null;
	return {
		user: game.user,
		listeners,
		forcedLocalDebug: true,
	};
}

function findBestListenerResultAcrossTokens(sourceToken, listeners) {
	if (!listeners.length) return null;
	let best = null;
	for (const listener of listeners) {
		const pathResult = computeAudibility(sourceToken, listener);
		if (!pathResult) continue;
		if (!best || pathResult.squares < best.pathResult.squares) {
			best = { listener, pathResult };
		}
	}
	return best;
}

async function runCreatureAmbienceCycle() {
	clearAmbienceTimer();
	if (!game.user.isGM || !isFeatureEnabled() || !isSceneCreatureAmbienceEnabled()) return;
	if (isEndCreditsActive()) {
		logDebug('Skipping creature ambience because end credits are active.');
		return;
	}
	if (isCombatActive()) {
		logDebug('Skipping creature ambience because combat is active.');
		scheduleNextCycle('normal');
		return;
	}
	if (!isCreatureSoundsEnabled()) {
		logDebug('Skipping creature ambience because PF2e Creature Sounds is disabled.');
		scheduleNextCycle('normal');
		return;
	}
	if (!canvas?.ready || !canvas.scene) {
		logDebug('Skipping creature ambience because there is no active ready canvas.');
		scheduleNextCycle('short');
		return;
	}
	const sourceToken = chooseSourceToken();
	if (!sourceToken) {
		logDebug('No eligible non-player creature token was found.');
		scheduleNextCycle('short');
		return;
	}
	const soundType = chooseSoundType();
	const src = await resolveCreatureSound(sourceToken.actor, soundType);
	if (!src) {
		logDebug(`Source ${sourceToken.name} had no ${soundType} sound available.`);
		scheduleNextCycle('short');
		return;
	}
	const players = getConnectedPlayers();
	let anyListenerFound = false;
	const pendingPlayerPlaybacks = [];
	let loudestAudibleResult = null;
	let usedForcedLocalDebug = false;
	const listenerEntries = players.map((user) => ({
		user,
		listeners: getEligibleListenerTokensForUser(user, sourceToken),
		forcedLocalDebug: false,
	}));
	if (!listenerEntries.length) {
		const forcedLocalDebug = getForcedLocalDebugUser(sourceToken);
		if (forcedLocalDebug) {
			listenerEntries.push(forcedLocalDebug);
			usedForcedLocalDebug = true;
			logDebug(`No connected players were found; forcing local debug playback through GM ${game.user.name}.`);
		} else {
			logDebug('No connected players were found for creature ambience.');
			scheduleNextCycle('short');
			return;
		}
	}
	for (const entry of listenerEntries) {
		const bestResult = findBestListenerResultAcrossTokens(sourceToken, entry.listeners);
		if (!bestResult) {
			if (entry.listeners.length) anyListenerFound = true;
			continue;
		}
		anyListenerFound = true;
		const volume = computeVolume(bestResult.pathResult);
		if (volume <= 0) continue;
		pendingPlayerPlaybacks.push({
			user: entry.user,
			volume,
			listener: bestResult.listener,
			pathResult: bestResult.pathResult,
		});
		if (!loudestAudibleResult || volume > loudestAudibleResult.volume) {
			loudestAudibleResult = {
				volume,
				user: entry.user,
				listener: bestResult.listener,
				pathResult: bestResult.pathResult,
			};
		}
	}
	if (!anyListenerFound) {
		logDebug('No players had any eligible observed tokens on the active scene.');
		scheduleNextCycle('short');
		return;
	}
	if (!loudestAudibleResult) {
		logDebug(`No valid audible path was found for source ${sourceToken.name}.`);
		scheduleNextCycle('short');
		return;
	}
	if (loudestAudibleResult.volume < MIN_AUDIBLE_VOLUME) {
		logDebug(
			`Loudest player-heard ambience from ${sourceToken.name} was only ${loudestAudibleResult.volume.toFixed(4)}, below ${MIN_AUDIBLE_VOLUME.toFixed(1)}.`
		);
		scheduleNextCycle('short');
		return;
	}
	for (const playback of pendingPlayerPlaybacks) {
		logDebug(
			`Playing ${soundType} ambience from ${sourceToken.name} for ${playback.user.name}: ${playback.pathResult.squares.toFixed(2)} squares, ${playback.pathResult.closedDoors} closed doors, volume ${playback.volume.toFixed(4)}.`
		);
		emitSoundToUser(playback.user.id, src, playback.volume, sourceToken, playback.listener, playback.pathResult);
	}
	if (loudestAudibleResult && !usedForcedLocalDebug) {
		for (const gm of getConnectedGMs()) {
			logDebug(
				`Mirroring ${soundType} ambience from ${sourceToken.name} for GM ${gm.name} at player-max volume ${loudestAudibleResult.volume.toFixed(4)}.`
			);
			emitSoundToUser(
				gm.id,
				src,
				loudestAudibleResult.volume,
				sourceToken,
				loudestAudibleResult.listener,
				loudestAudibleResult.pathResult
			);
		}
	}
	scheduleNextCycle('normal');
}

function restartCreatureAmbience() {
	ambienceCycleToken += 1;
	clearAmbienceTimer();
	if (!game.user.isGM || !isFeatureEnabled()) return;
	if (isEndCreditsActive()) return;
	scheduleNextCycle('normal');
}

Hooks.once('ready', () => {
	game.socket?.on(SOCKET_EVENT, (data) => {
		if (data?.type !== SOCKET_TYPE) return;
		if (data.userId !== game.user.id) return;
		if (typeof data.src !== 'string' || !data.src.trim()) return;
		if (isEndCreditsActive()) {
			logDebug(`Ignoring creature ambience playback for ${data.src} because end credits are active.`);
			return;
		}
		logDebug(
			`Socket playback received for source token ${data.sourceTokenId ?? '?'} to listener ${data.listenerTokenId ?? '?'} at volume ${Number(data.volume ?? 0).toFixed(4)}.`
		);
		triggerLocalSoundPlayback(data);
	});
	restartCreatureAmbience();
});

Hooks.on('canvasReady', () => {
	restartCreatureAmbience();
});

Hooks.on('combatStart', () => {
	restartCreatureAmbience();
});

Hooks.on('deleteCombat', () => {
	restartCreatureAmbience();
});

Hooks.on('updateCombat', () => {
	restartCreatureAmbience();
});

Hooks.on('updateScene', (scene, changes) => {
	if (scene?.id !== canvas?.scene?.id) return;
	if (Object.prototype.hasOwnProperty.call(changes?.flags?.[MODULE_ID] ?? {}, SCENE_FLAG)) restartCreatureAmbience();
});

function createSceneCreatureSoundsGroup(scene) {
	const enabled = isSceneCreatureAmbienceEnabled(scene);
	const row = document.createElement('div');
	row.className = 'form-group';
	row.innerHTML = `
		<label>Passive Creature Sounds</label>
		<div class="form-fields">
			<input type="checkbox" name="flags.${MODULE_ID}.${SCENE_FLAG}" ${enabled ? 'checked' : ''} />
		</div>
		<p class="hint">Allow PF2 Director to play ambient creature sounds in this scene. Enabled by default.</p>
	`;
	return row;
}

function appendSceneCreatureSoundsSetting(rendered, scene) {
	const root = rendered?.[game.system?.id] ?? rendered?.main ?? Object.values(rendered ?? {})[0];
	if (!root || root.querySelector?.(`[name="flags.${MODULE_ID}.${SCENE_FLAG}"]`)) return rendered;
	root.appendChild(createSceneCreatureSoundsGroup(scene));
	return rendered;
}

function prepareSceneConfig() {
	const target = "CONFIG.Scene.sheetClasses.base['pf2e.SceneConfigPF2e'].cls.prototype._renderHTML";
	const sceneConfigClass = CONFIG.Scene?.sheetClasses?.base?.['pf2e.SceneConfigPF2e']?.cls;
	if (!sceneConfigClass?.prototype?._renderHTML) {
		console.warn('[PF2 Director] Could not find the PF2e Scene Configuration renderer.');
		return;
	}

	if (globalThis.libWrapper?.register) {
		globalThis.libWrapper.register(MODULE_ID, target, async function (wrapped, ...args) {
			const rendered = await wrapped(...args);
			return appendSceneCreatureSoundsSetting(rendered, this.document);
		}, 'WRAPPER');
		return;
	}

	const originalRenderHTML = sceneConfigClass.prototype._renderHTML;
	sceneConfigClass.prototype._renderHTML = async function (...args) {
		const rendered = await originalRenderHTML.apply(this, args);
		return appendSceneCreatureSoundsSetting(rendered, this.document);
	};
}

Hooks.once('ready', prepareSceneConfig);

// Classic SceneConfig fallback for runtimes that still emit this hook.
Hooks.on('renderSceneConfig', (_app, html) => {
	const root = html instanceof HTMLElement ? html : html?.[0];
	if (!root || root.querySelector(`[name="flags.${MODULE_ID}.${SCENE_FLAG}"]`)) return;
	const basicTab = root.querySelector('.tab[data-tab="basic"]');
	(basicTab ?? root.querySelector('form'))?.appendChild(createSceneCreatureSoundsGroup(_app?.object ?? _app?.document));
});

Hooks.on('updateSetting', (setting) => {
	if (
		!setting?.key?.startsWith(`${MODULE_ID}.enableCreatureAmbience`) &&
		!setting?.key?.startsWith(`${MODULE_ID}.creatureAmbienceDebug`) &&
		!setting?.key?.startsWith(`${MODULE_ID}.endCreditsActive`)
	) return;
	restartCreatureAmbience();
});

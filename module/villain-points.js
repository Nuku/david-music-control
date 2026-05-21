import { MODULE_ID, getSetting, setSetting } from './settings.js';

const FLAG_SCOPE = MODULE_ID;
const GAP_MS = 12 * 60 * 60 * 1000;
const HERO_POINT_PATH = 'system.resources.heroPoints.value';
const pendingHeroPointUpdates = new Map();

function isFeatureEnabled() {
	return game.settings.get(MODULE_ID, 'enableVillainPoints');
}

function cloneState(state = {}) {
	return {
		heroPointUses: Math.max(0, Number(state.heroPointUses) || 0),
		villainPoints: Math.max(0, Number(state.villainPoints) || 0),
		lastResetGapEnd: Math.max(0, Number(state.lastResetGapEnd) || 0),
	};
}

function getState() {
	const raw = getSetting('villainPointState');
	if (raw && typeof raw === 'object' && !Array.isArray(raw)) return cloneState(raw);
	if (typeof raw !== 'string' || !raw) return cloneState();
	try {
		return cloneState(JSON.parse(raw));
	} catch (_error) {
		return cloneState();
	}
}

async function saveState(state) {
	await setSetting('villainPointState', JSON.stringify(cloneState(state)));
}

function getMessageTimestamp(message) {
	if (!message) return 0;
	const raw = Number(message.timestamp ?? message._source?.timestamp ?? message.date?.getTime?.() ?? 0);
	return Number.isFinite(raw) ? raw : 0;
}

function getRecentMessages(limit = 5) {
	return game.messages.contents
		.slice()
		.sort((a, b) => getMessageTimestamp(b) - getMessageTimestamp(a))
		.slice(0, limit);
}

function findResetGapEndTimestamp(messages = getRecentMessages()) {
	const sorted = messages
		.slice()
		.sort((a, b) => getMessageTimestamp(a) - getMessageTimestamp(b))
		.filter((message) => getMessageTimestamp(message) > 0);

	for (let index = 1; index < sorted.length; index += 1) {
		const older = getMessageTimestamp(sorted[index - 1]);
		const newer = getMessageTimestamp(sorted[index]);
		if (newer - older >= GAP_MS) return newer;
	}

	return 0;
}

async function maybeResetFromRecentMessages() {
	if (!isFeatureEnabled() || !game.user.isGM) return getState();

	const state = getState();
	const gapEnd = findResetGapEndTimestamp();
	if (!gapEnd || gapEnd <= state.lastResetGapEnd) return state;

	const nextState = {
		heroPointUses: 0,
		villainPoints: 0,
		lastResetGapEnd: gapEnd,
	};
	await saveState(nextState);
	ui.notifications.info('Villain points reset after a 12+ hour gap in the last five chat messages.');
	return nextState;
}

function getHeroPointValue(actor) {
	return Math.max(0, Number(foundry.utils.getProperty(actor, HERO_POINT_PATH)) || 0);
}

function rememberPriorHeroPoints(actor, changes) {
	if (!isFeatureEnabled()) return;
	if (actor?.type !== 'character') return;
	if (foundry.utils.getProperty(changes, HERO_POINT_PATH) === undefined) return;
	pendingHeroPointUpdates.set(actor.id, getHeroPointValue(actor));
}

async function handleHeroPointSpend(actor) {
	if (!isFeatureEnabled() || !game.user.isGM) return;
	if (actor?.type !== 'character') return;

	const previous = pendingHeroPointUpdates.get(actor.id);
	pendingHeroPointUpdates.delete(actor.id);
	if (!Number.isFinite(previous)) return;

	const current = getHeroPointValue(actor);
	const spent = Math.max(0, previous - current);
	if (spent <= 0) return;

	const state = await maybeResetFromRecentMessages();
	const beforeUses = state.heroPointUses;
	const afterUses = beforeUses + spent;
	const awarded = Math.floor(afterUses / 2) - Math.floor(beforeUses / 2);
	const nextState = {
		...state,
		heroPointUses: afterUses,
		villainPoints: state.villainPoints + Math.max(0, awarded),
	};
	await saveState(nextState);

	if (awarded > 0) {
		ui.notifications.info(
			`${actor.name} spent ${spent} hero point${spent === 1 ? '' : 's'}. The GM gains ${awarded} villain point${awarded === 1 ? '' : 's'} (${nextState.villainPoints} total).`
		);
	}
}

function getMessageRolls(message) {
	if (Array.isArray(message?.rolls) && message.rolls.length > 0) return message.rolls.filter(Boolean);
	if (message?.roll) return [message.roll];
	return [];
}

function getPrimaryRoll(message) {
	return getMessageRolls(message)[0] ?? null;
}

function getRollFormula(roll) {
	return String(roll?.formula ?? roll?._formula ?? '').trim();
}

function isD20Roll(roll) {
	const formula = getRollFormula(roll).toLowerCase();
	if (/\bd20\b/.test(formula)) return true;
	const faces = roll?.dice?.map((die) => Number(die.faces)).filter(Number.isFinite) ?? [];
	return faces.length === 1 && faces[0] === 20;
}

function canUseVillainReroll(message) {
	if (!isFeatureEnabled() || !game.user.isGM) return false;
	if (message.flags?.pf2e?.context?.isReroll) return false;
	const rolls = getMessageRolls(message);
	if (rolls.length !== 1) return false;
	const roll = rolls[0];
	if (!roll || !Number.isFinite(Number(roll.total))) return false;
	return isD20Roll(roll);
}

function buildVillainLabel(villainPoints) {
	return villainPoints === 1 ? '1 villain point' : `${villainPoints} villain points`;
}

function injectVillainRerollControl(message, root) {
	if (root.querySelector('.dmc-villain-point-controls')) return;

	const wrapper = document.createElement('div');
	wrapper.className = 'dmc-villain-point-controls';

	const state = getState();
	const disabled = state.villainPoints <= 0 ? ' disabled' : '';
	wrapper.innerHTML = `
		<label>Villain Point</label>
		<div class="dmc-roll-retag-row">
			<button type="button" data-action="dmc-villain-reroll"${disabled}>Use ${buildVillainLabel(state.villainPoints)}</button>
		</div>
	`;

	wrapper.querySelector('[data-action="dmc-villain-reroll"]')?.addEventListener('click', async (event) => {
		event.preventDefault();
		event.stopPropagation();
		await createVillainRerollMessage(message);
	});

	root.appendChild(wrapper);
}

function getHeroPointResourceClone(actor) {
	const resource = actor?.getResource?.('hero-points');
	if (!resource) return null;
	return {
		...resource,
		slug: 'hero-points',
		value: Math.max(1, Number(resource.value) || 0),
	};
}

async function performPf2eVillainReroll(message) {
	const rerollApi = game.pf2e?.Check?.rerollFromMessage;
	const actor = message.actor?.isOfType?.('familiar') ? message.actor.master : message.actor;
	if (typeof rerollApi !== 'function' || !actor?.updateResource || !actor?.getResource) {
		throw new Error('PF2e reroll API is unavailable.');
	}

	const originalGetResource = actor.getResource.bind(actor);
	const originalUpdateResource = actor.updateResource.bind(actor);
	const originalHeroPoints = originalGetResource('hero-points');
	const fakeHeroPointResource = getHeroPointResourceClone(actor);

	actor.getResource = function getResourceProxy(slug, ...args) {
		if (slug === 'hero-points' && fakeHeroPointResource) return { ...fakeHeroPointResource };
		return originalGetResource(slug, ...args);
	};

	actor.updateResource = async function updateResourceProxy(slug, value, ...args) {
		if (slug === 'hero-points' && fakeHeroPointResource) {
			return originalHeroPoints ?? { ...fakeHeroPointResource, value };
		}
		return originalUpdateResource(slug, value, ...args);
	};

	try {
		await rerollApi.call(game.pf2e.Check, message, { keep: 'new', resource: 'hero-points' });
	} finally {
		actor.getResource = originalGetResource;
		actor.updateResource = originalUpdateResource;
	}
}

async function createVillainRerollMessage(message) {
	if (!canUseVillainReroll(message)) {
		ui.notifications.warn('That message cannot use a villain point reroll.');
		return null;
	}

	const state = await maybeResetFromRecentMessages();
	if (state.villainPoints <= 0) {
		ui.notifications.warn('No villain points are available.');
		return null;
	}

	await performPf2eVillainReroll(message);

	await saveState({
		...state,
		villainPoints: Math.max(0, state.villainPoints - 1),
	});

	ui.notifications.info(`Villain point spent. ${Math.max(0, state.villainPoints - 1)} remaining.`);
	return true;
}

Hooks.on('preUpdateActor', (actor, changes) => {
	rememberPriorHeroPoints(actor, changes);
});

Hooks.on('updateActor', (actor) => {
	handleHeroPointSpend(actor);
});

Hooks.on('renderChatMessage', (message, html) => {
	const root = html instanceof HTMLElement ? html : html[0];
	if (!root) return;
	if (!canUseVillainReroll(message)) return;
	injectVillainRerollControl(message, root.querySelector('.message-content') ?? root);
});

Hooks.on('createChatMessage', () => {
	if (!isFeatureEnabled() || !game.user.isGM) return;
	void maybeResetFromRecentMessages();
});

import { MODULE_ID, getSetting, setSetting } from './settings.js';

const FLAG_SCOPE = MODULE_ID;
const SOCKET_EVENT = `module.${MODULE_ID}`;
const VILLAIN_NOTICE_SOCKET_TYPE = 'villainPointNotice';
const GAP_MS = 12 * 60 * 60 * 1000;
const HERO_POINT_PATH = 'system.resources.heroPoints.value';
const MYTHIC_POINT_PATH = 'system.resources.mythicPoints.value';
const pendingPointUpdates = new Map();
const recentDetectedPointSpends = new Map();
const processedPointRerollMessages = new Map();
const DOOM_FADE_IN_MS = 180;
const DOOM_HOLD_MS = 1100;
const DOOM_FADE_OUT_MS = 950;
const pendingVillainRerolls = [];
const REROLL_MATCH_WINDOW_MS = 5000;
const VILLAIN_POINT_WIDGET_ID = 'dmc-villain-point-widget';
const POINT_SPEND_BACKFILL_WINDOW_MS = 8000;

const DOOM_MESSAGES = [
	'The forces arrayed against you are taking notice of your resistance to fate.',
	'Something old and patient smiles in the dark between your heartbeats.',
	'The tapestry of doom tightens another thread around you.',
	'Your defiance has not gone unseen by the hungry things beyond the veil.',
	'Fate recoils from your resistance, and darker powers lean in closer.',
	'The hour grows more hostile. Your struggle has earned the enemy\'s regard.',
	'An unseen malice marks this moment and stores it away for later.',
	'The world dims as if some vast intelligence has turned its eye upon you.',
	'What hunts heroes has begun to count your refusals.',
	'The dark remembers every hand raised against inevitability.',
];

const VILLAIN_SPEND_MESSAGES = [
	'The dark answers your defiance with delighted laughter.',
	'Something cruel and patient spends what your resistance has earned.',
	'The shadow behind the curtain pulls one thread and fate shudders.',
	'The hungry things beyond the veil accept their due.',
	'An unseen will presses down, and destiny buckles for a moment.',
	'The enemy of your fortune leans close and chooses this instant.',
	'What watched you gather strength now spends it with a smile.',
	'The dark cashes in your borrowed reprieve.',
	'The laughter comes closer. The bargain has been invoked.',
	'The doom you awakened now reaches back through the dice.',
];

function isFeatureEnabled() {
	return game.settings.get(MODULE_ID, 'enableVillainPoints');
}

function getActorFromSpeaker(speaker) {
	if (!speaker) return null;
	const scene = speaker.scene ? game.scenes?.get(speaker.scene) : game.scenes?.current;
	const token = scene?.tokens?.get?.(speaker.token) ?? canvas?.tokens?.placeables?.find((placeable) => placeable.document.id === speaker.token)?.document;
	return token?.actor ?? (speaker.actor ? game.actors?.get(speaker.actor) : null);
}

function cloneState(state = {}) {
	return {
		heroPointUses: Math.max(0, Number(state.heroPointUses) || 0),
		villainPoints: Math.max(0, Number(state.villainPoints) || 0),
		lastResetGapEnd: Math.max(0, Number(state.lastResetGapEnd) || 0),
	};
}

function pick(array) {
	return array[Math.floor(Math.random() * array.length)] ?? null;
}

function getAudioHelper() {
	return globalThis.AudioHelper ?? foundry?.audio?.AudioHelper ?? null;
}

function getHeroPointRate() {
	return Math.max(1, Number(getSetting('villainPointHeroPointRate')) || 2);
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
	refreshVillainPointWidget();
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

function playDreadSound() {
	const src = String(getSetting('villainPointNoticeSound') ?? '').trim();
	if (!src) return;
	try {
		getAudioHelper()?.play?.(
			{
				src,
				volume: Number(getSetting('villainPointNoticeVolume') ?? 0.7) || 0.7,
				autoplay: true,
				loop: false,
			},
			false
		);
	} catch (error) {
		console.warn('[PF2 Director] Could not play villain point dread sound:', error);
	}
}

function showDoomOverlay(message) {
	document.getElementById('dmc-villain-doom-overlay')?.remove();

	const overlay = document.createElement('div');
	overlay.id = 'dmc-villain-doom-overlay';
	overlay.innerHTML = `<div class="dmc-villain-doom-text">${message}</div>`;
	document.body.appendChild(overlay);

	requestAnimationFrame(() => {
		overlay.classList.add('is-visible');
		window.setTimeout(() => overlay.classList.add('is-fading'), DOOM_FADE_IN_MS + DOOM_HOLD_MS);
		window.setTimeout(() => overlay.remove(), DOOM_FADE_IN_MS + DOOM_HOLD_MS + DOOM_FADE_OUT_MS + 80);
	});
}

function triggerLocalVillainNotice(message) {
	showDoomOverlay(message);
	playDreadSound();
}

async function broadcastVillainPointNotice(message) {
	game.socket?.emit(SOCKET_EVENT, {
		type: VILLAIN_NOTICE_SOCKET_TYPE,
		message,
	});
	triggerLocalVillainNotice(message);

	if (!game.user.isGM) return;
	await ChatMessage.create({
		speaker: { alias: 'The Gathering Dark' },
		content: `<p><em>${message}</em></p>`,
	});
}

function getHeroPointValue(actor) {
	return Math.max(0, Number(foundry.utils.getProperty(actor, HERO_POINT_PATH)) || 0);
}

function getMythicPointValue(actor) {
	return Math.max(0, Number(foundry.utils.getProperty(actor, MYTHIC_POINT_PATH)) || 0);
}

function rememberPriorPointValues(actor, changes) {
	if (!isFeatureEnabled()) return;
	if (actor?.type !== 'character') return;
	const heroChanged = foundry.utils.getProperty(changes, HERO_POINT_PATH) !== undefined;
	const mythicChanged = foundry.utils.getProperty(changes, MYTHIC_POINT_PATH) !== undefined;
	if (!heroChanged && !mythicChanged) return;

	pendingPointUpdates.set(actor.id, {
		heroPoints: getHeroPointValue(actor),
		mythicPoints: getMythicPointValue(actor),
	});
}

async function handlePointSpend(actor) {
	if (!isFeatureEnabled() || !game.user.isGM) return;
	if (actor?.type !== 'character') return;

	const previous = pendingPointUpdates.get(actor.id);
	pendingPointUpdates.delete(actor.id);
	if (!previous || typeof previous !== 'object') return;

	const previousHero = Math.max(0, Number(previous.heroPoints) || 0);
	const previousMythic = Math.max(0, Number(previous.mythicPoints) || 0);
	const currentHero = getHeroPointValue(actor);
	const currentMythic = getMythicPointValue(actor);
	const heroSpent = Math.max(0, previousHero - currentHero);
	const mythicSpent = Math.max(0, previousMythic - currentMythic);
	const spent = heroSpent + mythicSpent;
	if (spent <= 0) return;
	recentDetectedPointSpends.set(actor.id, Date.now());

	await applyTrackedPointUse(actor, spent, { heroSpent, mythicSpent });
}

async function applyTrackedPointUse(actor, spent, options = {}) {
	const heroSpent = Math.max(0, Number(options.heroSpent) || 0);
	const mythicSpent = Math.max(0, Number(options.mythicSpent) || 0);
	const sourceLabel = typeof options.sourceLabel === 'string' ? options.sourceLabel : null;

	const state = await maybeResetFromRecentMessages();
	const beforeUses = state.heroPointUses;
	const afterUses = beforeUses + spent;
	const heroPointRate = getHeroPointRate();
	const awarded = Math.floor(afterUses / heroPointRate) - Math.floor(beforeUses / heroPointRate);
	const nextState = {
		...state,
		heroPointUses: afterUses,
		villainPoints: state.villainPoints + Math.max(0, awarded),
	};
	await saveState(nextState);

	if (awarded > 0) {
		for (let index = 0; index < awarded; index += 1) {
			await broadcastVillainPointNotice(pick(DOOM_MESSAGES) ?? DOOM_MESSAGES[0]);
		}
		const spentLabel =
			sourceLabel
				? sourceLabel
				: heroSpent > 0 && mythicSpent > 0
				? `${heroSpent} hero point${heroSpent === 1 ? '' : 's'} and ${mythicSpent} mythic point${mythicSpent === 1 ? '' : 's'}`
				: heroSpent > 0
					? `${heroSpent} hero point${heroSpent === 1 ? '' : 's'}`
					: `${mythicSpent} mythic point${mythicSpent === 1 ? '' : 's'}`;
		ui.notifications.info(
			`${actor.name} spent ${spentLabel}. The GM gains ${awarded} villain point${awarded === 1 ? '' : 's'} after every ${heroPointRate} hero or mythic point use${heroPointRate === 1 ? '' : 's'} (${nextState.villainPoints} total).`
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
	if (getState().villainPoints <= 0) return false;
	if (message.flags?.pf2e?.context?.isReroll) return false;
	const rolls = getMessageRolls(message);
	if (rolls.length !== 1) return false;
	const roll = rolls[0];
	if (!roll || !Number.isFinite(Number(roll.total))) return false;
	return isD20Roll(roll);
}

function isVillainRerollMessage(message) {
	return !!message.getFlag?.(FLAG_SCOPE, 'villainPointReroll');
}

function findPendingVillainRerollIndex(message) {
	if (!messageLooksLikeReroll(message) && !message?.flags?.pf2e?.context?.isReroll) return -1;

	return pendingVillainRerolls.findIndex((entry) => {
		if (entry?.resolved) return false;
		if (entry.sourceMessageId && entry.sourceMessageId === message.id) return false;
		const messageTimestamp = getMessageTimestamp(message);
		if (messageTimestamp && messageTimestamp < (entry.createdAt ?? 0) - 1000) return false;

		const sameUser = entry.userId && message.user?.id && entry.userId === message.user.id;
		const sameSpeaker =
			entry.speakerActorId &&
			(entry.speakerActorId === message.speaker?.actor || entry.speakerTokenId === message.speaker?.token);

		if (!sameUser && !sameSpeaker) return false;
		return true;
	});
}

function extractChatMessageFromRerollResult(result) {
	if (!result) return null;
	if (result instanceof ChatMessage) return result;

	const candidates = [
		result.message,
		result.chatMessage,
		result.document,
		result?.data?.message,
		result?.data?.chatMessage,
	];

	for (const candidate of candidates) {
		if (!candidate) continue;
		if (candidate instanceof ChatMessage) return candidate;
		if (typeof candidate === 'string') {
			const message = game.messages.get(candidate);
			if (message) return message;
		}
		if (candidate.id) {
			const message = game.messages.get(candidate.id);
			if (message) return message;
		}
	}

	return null;
}

function messageLooksLikeReroll(message) {
	const content = String(message?.content ?? '');
	if (!content) return false;
	return content.includes('reroll-discard') || content.includes('reroll-second');
}

function getPointRerollTypeFromMessage(message) {
	const flavor = String(message?.flavor ?? '').toLowerCase();
	if (flavor.includes('mythic point')) return 'mythic';
	if (flavor.includes('hero point')) return 'hero';
	return null;
}

async function maybeBackfillPointUseFromReroll(message) {
	if (!isFeatureEnabled() || !game.user.isGM) return;
	if (!message || isVillainRerollMessage(message)) return;
	if (!messageLooksLikeReroll(message) && !message.flags?.pf2e?.context?.isReroll) return;
	if (processedPointRerollMessages.has(message.id)) return;

	const rerollType = getPointRerollTypeFromMessage(message);
	if (!rerollType) return;

	const actor = message.actor?.isOfType?.('familiar') ? message.actor.master : message.actor;
	if (actor?.type !== 'character') return;

	const lastDetected = recentDetectedPointSpends.get(actor.id) ?? 0;
	if (Date.now() - lastDetected <= POINT_SPEND_BACKFILL_WINDOW_MS) {
		processedPointRerollMessages.set(message.id, Date.now());
		return;
	}

	processedPointRerollMessages.set(message.id, Date.now());
	await applyTrackedPointUse(actor, 1, {
		heroSpent: rerollType === 'hero' ? 1 : 0,
		mythicSpent: rerollType === 'mythic' ? 1 : 0,
		sourceLabel: `${rerollType} point reroll`,
	});
}

async function applyVillainRerollDecoration(message, pendingVillainReroll) {
	if (!message || !pendingVillainReroll) return false;

	const rerollIndicator = /<i[^>]*class="[^"]*reroll-indicator[^"]*"[^>]*><\/i>/i;
	const currentFlavor = String(message.flavor ?? '');
	const villainIcon = '<i class="fas fa-skull reroll-indicator dmc-villain-reroll-indicator" data-tooltip="Villain Point Reroll"></i>';
	const nextFlavor = rerollIndicator.test(currentFlavor)
		? currentFlavor.replace(rerollIndicator, villainIcon)
		: `${villainIcon}${currentFlavor}`;

	await message.update({
		flavor: nextFlavor,
		flags: {
			[FLAG_SCOPE]: {
				villainPointReroll: {
					sourceMessageId: pendingVillainReroll.sourceMessageId,
					createdBy: pendingVillainReroll.userId,
				},
			},
		},
	});

	pendingVillainReroll.resolved = true;
	return true;
}

function decorateVillainRerollCard(message, root) {
	if (!isVillainRerollMessage(message)) return;

	root.classList.add('dmc-villain-reroll-message');
	const content = root.querySelector('.message-content') ?? root;
	content.classList.add('dmc-villain-reroll-card');

	if (!content.querySelector('.dmc-villain-reroll-banner')) {
		const banner = document.createElement('div');
		banner.className = 'dmc-villain-reroll-banner';
		banner.innerHTML = '<i class="fas fa-skull"></i><span>Villain Point Reroll</span>';
		content.prepend(banner);
	}
}

function buildVillainLabel(villainPoints) {
	return villainPoints === 1 ? '1 villain point' : `${villainPoints} villain points`;
}

function getSavedVillainPointWidgetPosition() {
	const raw = String(getSetting('villainPointWidgetPosition') ?? '').trim();
	if (!raw) return null;

	try {
		const parsed = JSON.parse(raw);
		const right = Number(parsed?.right);
		const top = Number(parsed?.top);
		if (!Number.isFinite(right) || !Number.isFinite(top)) return null;
		return { right, top };
	} catch (_error) {
		return null;
	}
}

async function saveVillainPointWidgetPosition(position) {
	await setSetting(
		'villainPointWidgetPosition',
		JSON.stringify({
			right: Math.max(0, Math.round(Number(position?.right) || 0)),
			top: Math.max(0, Math.round(Number(position?.top) || 0)),
		})
	);
}

function applyVillainPointWidgetPosition(widget, position = getSavedVillainPointWidgetPosition()) {
	if (!widget || !position) return;
	widget.style.right = `${Math.max(0, position.right)}px`;
	widget.style.top = `${Math.max(0, position.top)}px`;
}

function enableVillainPointWidgetDragging(widget) {
	const handle = widget?.querySelector('.dmc-villain-point-widget-header');
	if (!widget || !handle) return;

	handle.addEventListener('pointerdown', (event) => {
		if (event.button !== 0) return;
		const rect = widget.getBoundingClientRect();
		const startX = event.clientX;
		const startY = event.clientY;
		const startRight = Math.max(0, window.innerWidth - rect.right);
		const startTop = Math.max(0, rect.top);

		widget.classList.add('is-dragging');
		handle.setPointerCapture?.(event.pointerId);
		event.preventDefault();

		const onMove = (moveEvent) => {
			const deltaX = moveEvent.clientX - startX;
			const deltaY = moveEvent.clientY - startY;
			const maxRight = Math.max(0, window.innerWidth - rect.width);
			const maxTop = Math.max(0, window.innerHeight - rect.height);
			const nextRight = Math.min(maxRight, Math.max(0, startRight - deltaX));
			const nextTop = Math.min(maxTop, Math.max(0, startTop + deltaY));
			widget.style.right = `${nextRight}px`;
			widget.style.top = `${nextTop}px`;
		};

		const onUp = async (upEvent) => {
			handle.releasePointerCapture?.(event.pointerId);
			widget.classList.remove('is-dragging');
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointercancel', onUp);
			await saveVillainPointWidgetPosition({
				right: parseFloat(widget.style.right) || 0,
				top: parseFloat(widget.style.top) || 0,
			});
			upEvent.preventDefault();
		};

		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointercancel', onUp);
	});
}

function getVillainPointWidget() {
	return document.getElementById(VILLAIN_POINT_WIDGET_ID);
}

function removeVillainPointWidget() {
	getVillainPointWidget()?.remove();
}

function shouldShowVillainPointWidget() {
	return isFeatureEnabled() && !!game.user?.isGM;
}

function updateVillainPointWidget() {
	const widget = getVillainPointWidget();
	if (!widget) return;

	const villainPoints = getState().villainPoints;
	widget.querySelector('.dmc-villain-point-widget-value')?.replaceChildren(String(villainPoints));
	widget.querySelector('.dmc-villain-point-widget-hint')?.replaceChildren(buildVillainLabel(villainPoints));
}

function createVillainPointWidget() {
	if (!shouldShowVillainPointWidget()) {
		removeVillainPointWidget();
		return null;
	}

	const existing = getVillainPointWidget();
	if (existing) {
		updateVillainPointWidget();
		return existing;
	}

	const widget = document.createElement('section');
	widget.id = VILLAIN_POINT_WIDGET_ID;
	widget.className = 'dmc-villain-point-widget';
	widget.innerHTML = `
		<div class="dmc-villain-point-widget-header">
			<i class="fas fa-skull"></i>
			<span>Villain Points</span>
		</div>
		<div class="dmc-villain-point-widget-body">
			<button type="button" data-action="decrease-villain-points" aria-label="Remove villain point">-</button>
			<div class="dmc-villain-point-widget-readout">
				<strong class="dmc-villain-point-widget-value">0</strong>
				<span class="dmc-villain-point-widget-hint">0 villain points</span>
			</div>
			<button type="button" data-action="increase-villain-points" aria-label="Add villain point">+</button>
		</div>
	`;

	widget.querySelector('[data-action="decrease-villain-points"]')?.addEventListener('click', async (event) => {
		event.preventDefault();
		await removeVillainPoints(1);
	});

	widget.querySelector('[data-action="increase-villain-points"]')?.addEventListener('click', async (event) => {
		event.preventDefault();
		await addVillainPoints(1);
	});

	document.body.appendChild(widget);
	applyVillainPointWidgetPosition(widget);
	enableVillainPointWidgetDragging(widget);
	updateVillainPointWidget();
	return widget;
}

function refreshVillainPointWidget() {
	if (!shouldShowVillainPointWidget()) {
		removeVillainPointWidget();
		return;
	}

	createVillainPointWidget();
	updateVillainPointWidget();
}

function injectVillainRerollControl(message, root) {
	if (root.querySelector('.dmc-villain-point-controls')) return;

	const wrapper = document.createElement('div');
	wrapper.className = 'dmc-villain-point-controls';

	wrapper.innerHTML = `
		<label>Villain Point</label>
		<div class="dmc-roll-retag-row">
			<button type="button" data-action="dmc-villain-reroll">Use ${buildVillainLabel(getState().villainPoints)}</button>
		</div>
	`;

	wrapper.querySelector('[data-action="dmc-villain-reroll"]')?.addEventListener('click', async (event) => {
		event.preventDefault();
		event.stopPropagation();
		await createVillainRerollMessage(message);
	});

	root.appendChild(wrapper);
}

function isFriendlyAllianceMessage(message) {
	const actor = message?.actor ?? getActorFromSpeaker(message?.speaker);
	const scene = message?.speaker?.scene ? game.scenes?.get(message.speaker.scene) : game.scenes?.current;
	const tokenDocument = message?.speaker?.token ? scene?.tokens?.get?.(message.speaker.token) ?? canvas?.tokens?.placeables?.find((placeable) => placeable.document.id === message.speaker.token)?.document : null;
	const alliance = String(
		tokenDocument?.alliance ??
			tokenDocument?.document?.alliance ??
			actor?.alliance ??
			actor?.system?.details?.alliance ??
			''
	).trim().toLowerCase();
	return alliance === 'party';
}

function getVillainRerollKeepMode(message) {
	return isFriendlyAllianceMessage(message) ? 'lower' : 'higher';
}

async function performPf2eVillainReroll(message) {
	const rerollApi = game.pf2e?.Check?.rerollFromMessage;
	const actor = message.actor?.isOfType?.('familiar') ? message.actor.master : message.actor;
	if (typeof rerollApi !== 'function' || !actor) {
		throw new Error('PF2e reroll API is unavailable.');
	}

	const pendingVillainReroll = {
		sourceMessageId: message.id,
		userId: game.user.id,
		speakerActorId: message.speaker?.actor ?? null,
		speakerTokenId: message.speaker?.token ?? null,
		createdAt: Date.now(),
		resolved: false,
	};

	pendingVillainRerolls.push(pendingVillainReroll);
	const rerollOptions = { keep: getVillainRerollKeepMode(message) };
	const rerollResult = await rerollApi.call(game.pf2e.Check, message, rerollOptions);
	const returnedMessage = extractChatMessageFromRerollResult(rerollResult);
	if (returnedMessage && !pendingVillainReroll.resolved) {
		await applyVillainRerollDecoration(returnedMessage, pendingVillainReroll);
	}
	const updatedSourceMessage = game.messages.get(message.id);
	if (updatedSourceMessage && !pendingVillainReroll.resolved && messageLooksLikeReroll(updatedSourceMessage)) {
		await applyVillainRerollDecoration(updatedSourceMessage, pendingVillainReroll);
	}
	await finalizePendingVillainReroll(pendingVillainReroll);
}

async function decorateVillainRerollMessage(message) {
	if (!messageLooksLikeReroll(message) && !message.flags?.pf2e?.context?.isReroll) return;
	if (isVillainRerollMessage(message)) return;
	const pendingIndex = findPendingVillainRerollIndex(message);
	if (pendingIndex === -1) return;
	const pendingVillainReroll = pendingVillainRerolls[pendingIndex];
	await applyVillainRerollDecoration(message, pendingVillainReroll);
	pendingVillainRerolls.splice(pendingIndex, 1);
}

async function handleUpdatedVillainRerollMessage(message, changes) {
	if (!messageLooksLikeReroll(message) && !message?.flags?.pf2e?.context?.isReroll) return;
	if (isVillainRerollMessage(message)) return;
	const pendingIndex = findPendingVillainRerollIndex(message);
	if (pendingIndex === -1) return;
	const pendingVillainReroll = pendingVillainRerolls[pendingIndex];
	await applyVillainRerollDecoration(message, pendingVillainReroll);
	pendingVillainRerolls.splice(pendingIndex, 1);
}

async function finalizePendingVillainReroll(pendingVillainReroll) {
	if (!pendingVillainReroll || pendingVillainReroll.resolved) return;

	const deadline = (pendingVillainReroll.createdAt ?? Date.now()) + REROLL_MATCH_WINDOW_MS;

	while (Date.now() <= deadline && !pendingVillainReroll.resolved) {
		const sourceMessage = game.messages.get(pendingVillainReroll.sourceMessageId);
		if (sourceMessage && !isVillainRerollMessage(sourceMessage) && messageLooksLikeReroll(sourceMessage)) {
			await applyVillainRerollDecoration(sourceMessage, pendingVillainReroll);
			break;
		}

		const rerollMessage = game.messages.contents.find((message) => {
			if (isVillainRerollMessage(message)) return false;
			return findPendingVillainRerollIndex(message) !== -1;
		});

		if (rerollMessage) {
			await applyVillainRerollDecoration(rerollMessage, pendingVillainReroll);
			break;
		}

		await new Promise((resolve) => window.setTimeout(resolve, 100));
	}

	const pendingIndex = pendingVillainRerolls.indexOf(pendingVillainReroll);
	if (pendingIndex !== -1) pendingVillainRerolls.splice(pendingIndex, 1);
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
	await broadcastVillainPointNotice(pick(VILLAIN_SPEND_MESSAGES) ?? VILLAIN_SPEND_MESSAGES[0]);

	ui.notifications.info(`Villain point spent. ${Math.max(0, state.villainPoints - 1)} remaining.`);
	return true;
}

async function setVillainPoints(value) {
	const state = getState();
	const nextState = {
		...state,
		villainPoints: Math.max(0, Number(value) || 0),
	};
	await saveState(nextState);
	return nextState;
}

async function addVillainPoints(amount = 1) {
	const state = getState();
	const increase = Math.max(0, Number(amount) || 0);
	const nextState = await setVillainPoints(state.villainPoints + increase);
	for (let index = 0; index < increase; index += 1) {
		await broadcastVillainPointNotice(pick(DOOM_MESSAGES) ?? DOOM_MESSAGES[0]);
	}
	return nextState;
}

async function removeVillainPoints(amount = 1) {
	const state = getState();
	return setVillainPoints(state.villainPoints - (Number(amount) || 0));
}

async function resetVillainPointState() {
	const nextState = {
		heroPointUses: 0,
		villainPoints: 0,
		lastResetGapEnd: 0,
	};
	await saveState(nextState);
	return nextState;
}

Hooks.on('preUpdateActor', (actor, changes) => {
	rememberPriorPointValues(actor, changes);
});

Hooks.on('updateActor', (actor) => {
	handlePointSpend(actor);
	refreshVillainPointWidget();
});

Hooks.on('renderChatMessage', (message, html) => {
	const root = html instanceof HTMLElement ? html : html[0];
	if (!root) return;
	decorateVillainRerollCard(message, root);
	if (!canUseVillainReroll(message)) return;
	injectVillainRerollControl(message, root.querySelector('.message-content') ?? root);
});

Hooks.on('createChatMessage', () => {
	if (!isFeatureEnabled() || !game.user.isGM) return;
	void maybeResetFromRecentMessages();
});

Hooks.on('createChatMessage', (message) => {
	if (!isFeatureEnabled() || !game.user.isGM) return;
	void decorateVillainRerollMessage(message);
	void maybeBackfillPointUseFromReroll(message);
});

Hooks.on('updateChatMessage', (message, changes) => {
	if (!isFeatureEnabled() || !game.user.isGM) return;
	void handleUpdatedVillainRerollMessage(message, changes);
	void maybeBackfillPointUseFromReroll(message);
});

Hooks.on('renderSidebarTab', () => {
	refreshVillainPointWidget();
});

Hooks.once('ready', () => {
	const module = game.modules.get(MODULE_ID);
	if (module) {
		module.api = {
			...(module.api ?? {}),
			villainPoints: {
				getState,
				set: setVillainPoints,
				add: addVillainPoints,
				remove: removeVillainPoints,
				reset: resetVillainPointState,
			},
		};
	}

	game.socket?.on(SOCKET_EVENT, (data) => {
		if (data?.type !== VILLAIN_NOTICE_SOCKET_TYPE) return;
		if (typeof data.message !== 'string' || !data.message.trim()) return;
		triggerLocalVillainNotice(data.message);
	});

	refreshVillainPointWidget();

	window.setInterval(() => {
		const cutoff = Date.now() - 30000;
		for (let index = pendingVillainRerolls.length - 1; index >= 0; index -= 1) {
			if ((pendingVillainRerolls[index]?.createdAt ?? 0) < cutoff) {
				pendingVillainRerolls.splice(index, 1);
			}
		}
		for (const [messageId, timestamp] of processedPointRerollMessages.entries()) {
			if (timestamp < cutoff) processedPointRerollMessages.delete(messageId);
		}
		for (const [actorId, timestamp] of recentDetectedPointSpends.entries()) {
			if (timestamp < cutoff) recentDetectedPointSpends.delete(actorId);
		}
	}, 10000);
});

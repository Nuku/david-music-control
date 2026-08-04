import { MODULE_ID } from './settings.js';

const FLAG_SCOPE = MODULE_ID;
const RETYPE_FLAG = 'rollRetyping';
const HALF_DAMAGE_FLAG = 'halfDamage';
const AUTO_APPLY_SUPPRESS_MS = 4000;
const AUTO_APPLY_CANDIDATE_MS = 10000;
const HALF_DAMAGE_REQUEST_MS = 5000;
const SOCKET_EVENT = `module.${MODULE_ID}`;
const autoAppliedMessageIds = new Set();
const pendingAutoApplyMessageIds = new Map();
const suppressedAutoApplyMessageIds = new Set();
const pendingHalfDamageRequests = [];
const DAMAGE_TYPES = [
	'acid',
	'bludgeoning',
	'bleed',
	'chaotic',
	'cold',
	'electricity',
	'evil',
	'fire',
	'force',
	'good',
	'lawful',
	'mental',
	'piercing',
	'poison',
	'positive',
	'negative',
	'slashing',
	'sonic',
	'spirit',
	'vitality',
	'void',
];

const HEALING_TYPES = ['healing', 'vitality', 'void'];
const suppressedAutoApplyActors = new Map();

function isFeatureEnabled() {
	return game.settings.get(MODULE_ID, 'enableUntypedRollRetyping');
}

function isHalfDamageEnabled() {
	return game.settings.get(MODULE_ID, 'enableHalfDamageButton');
}

function getAutoApplyDamageMode() {
	if (!game.modules?.get('pf2e-target-helper')?.active) return 'none';
	return game.settings.get(MODULE_ID, 'autoApplyDamage') || 'none';
}

function getMessageRolls(message) {
	if (Array.isArray(message.rolls) && message.rolls.length > 0) return message.rolls.filter(Boolean);
	if (message.roll) return [message.roll];
	return [];
}

function getPrimaryRoll(message) {
	return getMessageRolls(message)[0] ?? null;
}

function isPf2eDamageSourceMessage(message) {
	return message?.flags?.pf2e?.context?.type !== 'damage-roll';
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

function isEligibleMessage(message) {
	if (!isFeatureEnabled()) return false;
	const rolls = getMessageRolls(message);
	if (rolls.length !== 1) return false;
	const roll = rolls[0];
	if (!roll || !Number.isFinite(Number(roll.total))) return false;
	if (isD20Roll(roll)) return false;
	return true;
}

function getActorFromSpeaker(speaker) {
	if (!speaker) return null;
	const scene = speaker.scene ? game.scenes?.get(speaker.scene) : game.scenes?.current;
	const token = scene?.tokens?.get?.(speaker.token) ?? canvas?.tokens?.placeables?.find((placeable) => placeable.document.id === speaker.token)?.document;
	return token?.actor ?? (speaker.actor ? game.actors?.get(speaker.actor) : null);
}

function getSourceActor(message) {
	const flags = message.getFlag(FLAG_SCOPE, RETYPE_FLAG);
	if (flags?.source?.actorId) return game.actors?.get(flags.source.actorId) ?? null;
	return getActorFromSpeaker(message.speaker);
}

function getSpeakerActorId(message) {
	return message?.speaker?.actor ?? null;
}

function getMessageItemIdentifier(message) {
	const itemUuid = message?.item?.uuid ?? message?.flags?.pf2e?.origin?.uuid ?? message?.flags?.pf2e?.context?.item?.uuid ?? null;
	if (itemUuid) return itemUuid;
	return message?.item?.id ?? message?.flags?.pf2e?.origin?.id ?? message?.flags?.pf2e?.context?.item?.id ?? null;
}

function suppressNextAutoApplyForSpeaker(message) {
	const actorId = getSpeakerActorId(message);
	if (!actorId) return;
	suppressedAutoApplyActors.set(actorId, Date.now() + AUTO_APPLY_SUPPRESS_MS);
}

function consumeAutoApplySuppression(message) {
	const actorId = getSpeakerActorId(message);
	if (!actorId) return false;
	const expiresAt = suppressedAutoApplyActors.get(actorId);
	if (!expiresAt) return false;
	if (expiresAt < Date.now()) {
		suppressedAutoApplyActors.delete(actorId);
		return false;
	}
	suppressedAutoApplyActors.delete(actorId);
	return true;
}

function suppressAutoApplyForMessageId(messageId) {
	if (!messageId) return;
	suppressedAutoApplyMessageIds.add(messageId);
}

function prunePendingAutoApplyMessages() {
	const now = Date.now();
	for (const [messageId, expiresAt] of pendingAutoApplyMessageIds.entries()) {
		if (expiresAt < now) pendingAutoApplyMessageIds.delete(messageId);
	}
}

function markMessagePendingAutoApply(message) {
	if (!message?.id) return;
	if (message?.flags?.pf2e?.context?.type !== 'damage-roll') return;
	prunePendingAutoApplyMessages();
	pendingAutoApplyMessageIds.set(message.id, Date.now() + AUTO_APPLY_CANDIDATE_MS);
}

function isMessagePendingAutoApply(message) {
	if (!message?.id) return false;
	prunePendingAutoApplyMessages();
	const expiresAt = pendingAutoApplyMessageIds.get(message.id);
	if (!expiresAt) return false;
	if (expiresAt < Date.now()) {
		pendingAutoApplyMessageIds.delete(message.id);
		return false;
	}
	return true;
}

function consumeAutoApplyMessageSuppression(message) {
	if (!message?.id) return false;
	if (!suppressedAutoApplyMessageIds.has(message.id)) return false;
	suppressedAutoApplyMessageIds.delete(message.id);
	return true;
}

function canInteractWithMessage(message) {
	if (game.user.isGM) return true;
	if (message.user?.id === game.user.id) return true;
	const actor = getSourceActor(message);
	return actor?.isOwner ?? false;
}

function isCurrentUserActiveGM() {
	return game.user?.isGM && game.users?.activeGM?.id === game.user.id;
}

function getSelectedTargets() {
	return Array.from(game.user.targets ?? []).map((token) => ({
		actorId: token.actor?.id ?? null,
		tokenId: token.document?.id ?? null,
		sceneId: token.scene?.id ?? canvas?.scene?.id ?? null,
		name: token.name ?? token.actor?.name ?? 'Unknown Target',
	}));
}

function getSourceData(message) {
	const actor = getActorFromSpeaker(message.speaker);
	return {
		actorId: actor?.id ?? null,
		tokenId: message.speaker?.token ?? null,
		sceneId: message.speaker?.scene ?? canvas?.scene?.id ?? null,
		itemId: null,
		name: actor?.name ?? message.speaker?.alias ?? message.alias ?? 'Unknown Source',
	};
}

function getStoredTargets(message) {
	const flags = message.getFlag(FLAG_SCOPE, RETYPE_FLAG);
	if (Array.isArray(flags?.targets) && flags.targets.length > 0) return flags.targets;
	return [];
}

function extractRollContext(message) {
	const roll = getPrimaryRoll(message);
	if (!roll) return null;
	return {
		originalMessageId: message.id,
		originalUserId: message.user?.id ?? null,
		speaker: foundry.utils.deepClone(message.speaker ?? {}),
		whisper: [...(message.whisper ?? [])],
		blind: !!message.blind,
		rollFormula: getRollFormula(roll) || null,
		rollTotal: Number(roll.total) || 0,
		rollJson: typeof roll.toJSON === 'function' ? roll.toJSON() : null,
		source: getSourceData(message),
		targets: getStoredTargets(message).length > 0 ? getStoredTargets(message) : getSelectedTargets(),
		pf2eContext: foundry.utils.deepClone(message.flags?.pf2e ?? {}),
		flavor: message.flavor ?? null,
	};
}

function buildDamageTypeOptions(selected = '') {
	return DAMAGE_TYPES.map((type) => `<option value="${type}"${type === selected ? ' selected' : ''}>${type}</option>`).join('');
}

function buildOriginalStatus(message) {
	const flags = message.getFlag(FLAG_SCOPE, RETYPE_FLAG);
	if (!flags?.derivedMessageId) return '';
	const mode = flags.mode === 'healing' ? 'healing' : 'damage';
	const label = flags.damageType ? `${flags.damageType} ${mode}` : mode;
	return `<p class="dmc-roll-retag-status">Reinterpreted as <strong>${label}</strong> in <a class="content-link" draggable="true" data-uuid="ChatMessage.${flags.derivedMessageId}" data-id="${flags.derivedMessageId}">linked card</a>.</p>`;
}

function injectRetypingControls(message, root) {
	if (!canInteractWithMessage(message)) return;
	if (root.querySelector('.dmc-roll-retag-controls')) return;

	const wrapper = document.createElement('div');
	wrapper.className = 'dmc-roll-retag-controls';
	const status = buildOriginalStatus(message);
	if (status) {
		wrapper.innerHTML = status;
		root.appendChild(wrapper);
		return;
	}

	wrapper.innerHTML = `
		<label>Reinterpret Roll</label>
		<div class="dmc-roll-retag-row">
			<select name="dmc-roll-mode">
				<option value="damage">Damage</option>
				<option value="healing">Healing</option>
			</select>
			<select name="dmc-roll-type">
				${buildDamageTypeOptions('fire')}
			</select>
			<button type="button" data-action="dmc-create-derived-roll">Apply As...</button>
		</div>
	`;

	const modeSelect = wrapper.querySelector('[name="dmc-roll-mode"]');
	const typeSelect = wrapper.querySelector('[name="dmc-roll-type"]');
	const syncTypes = () => {
		if (!typeSelect) return;
		const mode = modeSelect?.value || 'damage';
		const options = mode === 'healing' ? HEALING_TYPES : DAMAGE_TYPES;
		const preferred = mode === 'healing' ? 'healing' : 'fire';
		typeSelect.innerHTML = options
			.map((type) => `<option value="${type}"${type === preferred ? ' selected' : ''}>${type}</option>`)
			.join('');
	};
	modeSelect?.addEventListener('change', syncTypes);

	wrapper.querySelector('[data-action="dmc-create-derived-roll"]')?.addEventListener('click', async (event) => {
		event.preventDefault();
		event.stopPropagation();
		const mode = wrapper.querySelector('[name="dmc-roll-mode"]')?.value || 'damage';
		const damageType = wrapper.querySelector('[name="dmc-roll-type"]')?.value || 'fire';
		await createDerivedRollMessage(message, { mode, damageType });
	});

	root.appendChild(wrapper);
}

function getDamageRollClass() {
	return game.pf2e?.DamageRoll
		?? CONFIG?.PF2E?.DamageRoll
		?? CONFIG?.Dice?.rolls?.find?.((rollClass) => rollClass?.name === 'DamageRoll')
		?? Roll;
}

function halveFormulaPreservingSuffix(formula) {
	const text = String(formula ?? '').trim();
	if (!text) return '(0)[untyped]';

	const match = text.match(/^(.*?)(\s*\[[^\]]+\])$/);
	if (!match) return `(${text}) / 2`;

	const [, body, suffix] = match;
	return `((${body.trim()}) / 2)${suffix}`;
}

function getDamageInstanceFormulas(roll) {
	const instances = Array.isArray(roll?.instances) ? roll.instances : [];
	const formulas = instances
		.map((instance) => String(instance?._formula ?? instance?.formula ?? '').trim())
		.filter(Boolean);
	if (formulas.length > 0) return formulas;

	const fallback = getRollFormula(roll);
	return fallback ? [fallback] : [];
}

function splitDamageFormulaSuffix(formula) {
	const text = String(formula ?? '').trim();
	const match = text.match(/^(.*?)(\s*\[[^\]]+\])$/);
	if (!match) return { body: text, suffix: '' };
	return { body: match[1].trim(), suffix: match[2] };
}

function buildHalfDamageFormula(roll) {
	const instances = Array.isArray(roll?.instances) ? roll.instances : [];
	const instanceFormulas = getDamageInstanceFormulas(roll);
	if (instances.length > 0 && instances.length === instanceFormulas.length) {
		const formulas = instances.map((instance, index) => {
			const total = Number(instance?.total);
			const { suffix } = splitDamageFormulaSuffix(instanceFormulas[index]);
			if (!Number.isFinite(total)) return null;
			return `((${total}) / 2)${suffix}`;
		}).filter(Boolean);
		if (formulas.length === 1) return formulas[0];
		if (formulas.length > 1) return `{${formulas.join(', ')}}`;
	}

	const total = Number(roll?.total);
	if (Number.isFinite(total)) {
		const fallbackFormula = getRollFormula(roll);
		const { suffix } = splitDamageFormulaSuffix(fallbackFormula);
		return `((${total}) / 2)${suffix}`;
	}

	if (instanceFormulas.length === 0) return null;
	if (instanceFormulas.length === 1) return halveFormulaPreservingSuffix(instanceFormulas[0]);
	return `{${instanceFormulas.map((formula) => halveFormulaPreservingSuffix(formula)).join(', ')}}`;
}

function getHalfDamageTarget(message) {
	if (message?.target?.actor && message?.target?.token) {
		return {
			actor: message.target.actor.uuid,
			token: message.target.token.uuid,
		};
	}

	const selectedTarget = game.user.targets?.first?.()?.document;
	if (selectedTarget?.actor && selectedTarget?.uuid) {
		return {
			actor: selectedTarget.actor.uuid,
			token: selectedTarget.uuid,
		};
	}

	return null;
}

async function getDamageTargetActor(message) {
	if (message?.target?.actor) return message.target.actor;

	const target = message?.flags?.pf2e?.target ?? message?.flags?.pf2e?.context?.target ?? null;
	if (!target) return null;

	const actorCandidates = [target.actor].filter(Boolean);
	for (const actorRef of actorCandidates) {
		try {
			const resolved = await fromUuid(actorRef);
			if (resolved?.actor) return resolved.actor;
			if (resolved?.type) return resolved;
		} catch (_error) {
			// Fall through to token-based resolution.
		}
	}

	const tokenCandidates = [target.token].filter(Boolean);
	for (const tokenRef of tokenCandidates) {
		try {
			const resolved = await fromUuid(tokenRef);
			if (resolved?.actor) return resolved.actor;
		} catch (_error) {
			const scene = canvas?.scene ?? null;
			const tokenDoc = scene?.tokens?.get?.(tokenRef) ?? null;
			if (tokenDoc?.actor) return tokenDoc.actor;
		}
	}

	return null;
}

function cloneDamageFlagsAsHalfDamage(message, sourceMessage) {
	const original = foundry.utils.deepClone(message.flags ?? {});
	const pf2e = foundry.utils.deepClone(original.pf2e ?? {});
	const context = foundry.utils.deepClone(pf2e.context ?? {});
	const target = getHalfDamageTarget(sourceMessage);

	context.type = 'damage-roll';
	if (context.outcome === 'criticalSuccess') context.outcome = 'success';
	if (context.unadjustedOutcome === 'criticalSuccess') context.unadjustedOutcome = 'success';
	if (target) {
		context.target = target;
		pf2e.target = target;
	}

	pf2e.context = context;
	original.pf2e = pf2e;
	original[FLAG_SCOPE] = {
		...(original[FLAG_SCOPE] ?? {}),
		[HALF_DAMAGE_FLAG]: {
			derivedFromMessageId: message.id,
			createdBy: game.user.id,
		},
	};

	return original;
}

function getHalfDamageFlavor(message) {
	const existingFlavor = String(message.flavor ?? '').trim();
	const note = '<p class="dmc-roll-retag-status">Half damage</p>';
	return existingFlavor ? `${existingFlavor}${note}` : note;
}

function prunePendingHalfDamageRequests() {
	const now = Date.now();
	for (let index = pendingHalfDamageRequests.length - 1; index >= 0; index -= 1) {
		if ((pendingHalfDamageRequests[index]?.expiresAt ?? 0) < now) {
			pendingHalfDamageRequests.splice(index, 1);
		}
	}
}

function queueHalfDamageRequest(request) {
	prunePendingHalfDamageRequests();
	pendingHalfDamageRequests.push({
		...request,
		expiresAt: Date.now() + HALF_DAMAGE_REQUEST_MS,
	});
}

function findPendingHalfDamageRequest(message) {
	prunePendingHalfDamageRequests();
	const actorId = getSpeakerActorId(message);
	const itemId = getMessageItemIdentifier(message);
	const userId = message?.user?.id ?? null;

	for (let index = 0; index < pendingHalfDamageRequests.length; index += 1) {
		const request = pendingHalfDamageRequests[index];
		if (request.actorId && actorId && request.actorId !== actorId) continue;
		if (request.itemId && itemId && request.itemId !== itemId) continue;
		if (request.userId && userId && request.userId !== userId) continue;
		pendingHalfDamageRequests.splice(index, 1);
		return request;
	}

	return null;
}

function normalizeOutcomeValue(value) {
	if (value === 'criticalSuccess') return 'success';
	if (value === 'success') return 'success';
	if (value === 'failure') return 'success';
	if (value === 'criticalFailure') return 'success';
	return value;
}

function normalizeHalfDamageOutcomes(value) {
	if (Array.isArray(value)) {
		return value.map((entry) => normalizeHalfDamageOutcomes(entry));
	}

	if (value && typeof value === 'object') {
		const clone = foundry.utils.deepClone(value);
		for (const [key, nested] of Object.entries(clone)) {
			if (key === 'outcome' || key === 'unadjustedOutcome' || key === 'degreeOfSuccess') {
				clone[key] = normalizeOutcomeValue(nested);
			} else {
				clone[key] = normalizeHalfDamageOutcomes(nested);
			}
		}
		return clone;
	}

	return value;
}

function forceTargetHelperHalfDamage(flags) {
	const helper = foundry.utils.deepClone(flags?.['pf2e-target-helper'] ?? {});
	const damageRows = foundry.utils.deepClone(helper.damageRows ?? {});

	for (const collectionKey of ['targets', 'splashTargets']) {
		const collection = damageRows[collectionKey];
		if (!collection || typeof collection !== 'object') continue;
		for (const entry of Object.values(collection)) {
			if (!entry || typeof entry !== 'object') continue;
			entry.outcome = 'success';
			if ('unadjustedOutcome' in entry) entry.unadjustedOutcome = 'success';
			if ('degreeOfSuccess' in entry) entry.degreeOfSuccess = 'success';
		}
	}

	helper.damageRows = damageRows;
	return helper;
}

function forceHalfDamageContextOnSource(source) {
	const originalFlags = foundry.utils.deepClone(source.flags ?? {});
	const pf2e = normalizeHalfDamageOutcomes(foundry.utils.deepClone(originalFlags.pf2e ?? {}));
	const context = foundry.utils.deepClone(pf2e.context ?? {});

	context.outcome = 'success';
	context.unadjustedOutcome = 'success';
	context.type ??= 'damage-roll';
	pf2e.context = context;
	originalFlags.pf2e = pf2e;
	if (originalFlags['pf2e-target-helper']) {
		originalFlags['pf2e-target-helper'] = forceTargetHelperHalfDamage(originalFlags);
	}
	originalFlags[FLAG_SCOPE] = {
		...(originalFlags[FLAG_SCOPE] ?? {}),
		[HALF_DAMAGE_FLAG]: {
			...(originalFlags[FLAG_SCOPE]?.[HALF_DAMAGE_FLAG] ?? {}),
			forcedOutcome: 'success',
			createdBy: game.user.id,
		},
	};

	return originalFlags;
}

function waitForNextDamageMessage(sourceMessage, timeoutMs = 2000, onMatch = null) {
	return new Promise((resolve) => {
		let settled = false;
		let timeoutId = null;

		const finish = (message) => {
			if (settled) return;
			settled = true;
			Hooks.off('createChatMessage', onCreateChatMessage);
			if (timeoutId !== null) window.clearTimeout(timeoutId);
			resolve(message ?? null);
		};

		const onCreateChatMessage = (createdMessage) => {
			const contextType = createdMessage?.flags?.pf2e?.context?.type;
			const sameActor = createdMessage?.speaker?.actor && sourceMessage?.speaker?.actor
				? createdMessage.speaker.actor === sourceMessage.speaker.actor
				: true;
			if (contextType === 'damage-roll' && sameActor) {
				onMatch?.(createdMessage);
				finish(createdMessage);
			}
		};

		Hooks.on('createChatMessage', onCreateChatMessage);
		timeoutId = window.setTimeout(() => finish(null), timeoutMs);
	});
}

async function resolveCreatedDamageMessage(sourceMessage, result) {
	if (result?.id) return game.messages?.get?.(result.id) ?? result;
	if (result?.message?.id) return game.messages?.get?.(result.message.id) ?? result.message;
	if (result?.chatMessage?.id) return game.messages?.get?.(result.chatMessage.id) ?? result.chatMessage;
	return null;
}

function getSourceDamageButton(root) {
	const buttons = Array.from(root.querySelectorAll('button'));
	return buttons.find((button) => {
		if (button.classList.contains('dmc-half-damage-button')) return false;
		const action = String(button.dataset?.action ?? '').toLowerCase();
		const text = String(button.textContent ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
		return action === 'damage' || text === 'damage' || text === 'roll damage';
	}) ?? null;
}

async function createHalfDamageFromSourceMessage(message, root) {
	const damageButton = getSourceDamageButton(root);
	if (!(damageButton instanceof HTMLElement)) return null;

	queueHalfDamageRequest({
		actorId: getSpeakerActorId(message),
		itemId: getMessageItemIdentifier(message),
		userId: game.user.id,
	});
	game.socket?.emit?.(SOCKET_EVENT, {
		type: 'dmc-half-damage-request',
		actorId: getSpeakerActorId(message),
		itemId: getMessageItemIdentifier(message),
		userId: game.user.id,
	});
	damageButton.click();
	return true;
}

function getApplyDamageButton(root) {
	const buttons = Array.from(root.querySelectorAll('button'));
	return buttons.find((button) => {
		const text = String(button.textContent ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
		if (button.classList.contains('dmc-half-damage-button')) return false;
		if (button.disabled) return false;
		return text === 'damage' || text === 'full damage' || text === 'apply damage';
	}) ?? null;
}

function getDamageButtonByMultiplier(root, multiplier) {
	const normalized = String(multiplier);
	return Array.from(root.querySelectorAll('button')).find((button) => {
		if (button.classList.contains('dmc-half-damage-button')) return false;
		if (button.disabled) return false;
		return String(button.dataset?.action ?? '') === 'applyDamage'
			&& String(button.dataset?.multiplier ?? '') === normalized;
	}) ?? null;
}

function getOutcomeAutoApplyButton(section) {
	const outcome = String(section.dataset?.outcome ?? '').trim();
	switch (outcome) {
		case 'criticalFailure':
			return getDamageButtonByMultiplier(section, 2);
		case 'failure':
			return getDamageButtonByMultiplier(section, 1);
		case 'success':
			return getDamageButtonByMultiplier(section, 0.5);
		case 'criticalSuccess':
			return null;
		default:
			return getApplyDamageButton(section);
	}
}

function isForcedHalfDamageMessage(message) {
	return message?.getFlag?.(FLAG_SCOPE, HALF_DAMAGE_FLAG)?.forcedOutcome === 'success';
}

function getTargetDamageSections(root) {
	return Array.from(root.querySelectorAll(
		'.all-main-targets-damage-application .damage-application, '
		+ '.all-splash-targets-damage-application .damage-application'
	));
}

function normalizeRenderedHalfDamageCard(root) {
	const allDamageSections = getTargetDamageSections(root);
	for (const section of allDamageSections) {
		const fullButton = getDamageButtonByMultiplier(section, 1);
		const halfButton = getDamageButtonByMultiplier(section, 0.5);
		const doubleButton = getDamageButtonByMultiplier(section, 2);
		fullButton?.classList?.remove?.('dmc-forced-half-active');
		halfButton?.classList?.add?.('dmc-forced-half-active');
		doubleButton?.classList?.remove?.('dmc-forced-half-active');
	}

	for (const section of allDamageSections) section.dataset.outcome = 'success';
}

function shouldUseOutcomeBasedAutoApply(_root, targetSections) {
	if (!Array.isArray(targetSections) || targetSections.length === 0) return false;
	return targetSections.some((section) => {
		const outcome = String(section.dataset?.outcome ?? '').trim();
		return outcome === 'criticalFailure'
			|| outcome === 'failure'
			|| outcome === 'success'
			|| outcome === 'criticalSuccess';
	});
}

async function shouldAutoApplyTargetSection(section, mode) {
	if (!(section instanceof HTMLElement)) return false;
	if (mode === 'always') return true;
	if (mode !== 'npc') return false;

	const isNpcFlag = String(section.dataset?.isnpc ?? '').toLowerCase();
	if (isNpcFlag === 'true') return true;
	if (isNpcFlag === 'false') return false;

	const actorId = section.dataset?.actorid ?? null;
	if (actorId) {
		const actor = game.actors?.get?.(actorId) ?? null;
		if (actor) return actor.type === 'npc';
	}

	return false;
}

async function getAutoApplyDamageButtons(message, root, mode) {
	const targetSections = await waitForTargetDamageApplications(root);
	if (targetSections.length > 0) {
		const forceHalf = isForcedHalfDamageMessage(message);
		const useOutcomeButtons = shouldUseOutcomeBasedAutoApply(root, targetSections);
		const buttons = [];
		for (const section of targetSections) {
			if (!(await shouldAutoApplyTargetSection(section, mode))) continue;
			const button = forceHalf
				? getDamageButtonByMultiplier(section, 0.5)
				: (useOutcomeButtons
					? getOutcomeAutoApplyButton(section)
					: getApplyDamageButton(section));
			if (button instanceof HTMLElement) buttons.push(button);
		}
		if (buttons.length > 0) return buttons;
	}

	if (mode === 'npc') {
		const targetActor = await getDamageTargetActor(message);
		if (targetActor?.type !== 'npc') return [];
	}

	const damageApplication = await waitForDamageApplication(root);
	if (!(damageApplication instanceof HTMLElement)) return [];
	const button = getApplyDamageButton(damageApplication);
	return button instanceof HTMLElement ? [button] : [];
}

function waitForDamageApplication(root, timeoutMs = 500) {
	return new Promise((resolve) => {
		const immediate = root.querySelector('.damage-application');
		if (immediate instanceof HTMLElement) {
			resolve(immediate);
			return;
		}

		const observer = new MutationObserver(() => {
			const found = root.querySelector('.damage-application');
			if (!(found instanceof HTMLElement)) return;
			observer.disconnect();
			if (timeoutId !== null) window.clearTimeout(timeoutId);
			resolve(found);
		});

		let timeoutId = window.setTimeout(() => {
			observer.disconnect();
			resolve(null);
		}, timeoutMs);

		observer.observe(root, { childList: true, subtree: true });
	});
}

function waitForTargetDamageApplications(root, timeoutMs = 500) {
	return new Promise((resolve) => {
		const getSections = () => getTargetDamageSections(root);
		const immediate = getSections();
		if (immediate.length > 0) {
			resolve(immediate);
			return;
		}

		const observer = new MutationObserver(() => {
			const found = getSections();
			if (found.length === 0) return;
			observer.disconnect();
			if (timeoutId !== null) window.clearTimeout(timeoutId);
			resolve(found);
		});

		let timeoutId = window.setTimeout(() => {
			observer.disconnect();
			resolve([]);
		}, timeoutMs);

		observer.observe(root, { childList: true, subtree: true });
	});
}

async function shouldAutoApplyDamage(message) {
	if (!isCurrentUserActiveGM()) return false;
	if (message?.flags?.pf2e?.context?.type !== 'damage-roll') return false;
	if (autoAppliedMessageIds.has(message.id)) return false;
	if (consumeAutoApplyMessageSuppression(message)) return false;
	if (consumeAutoApplySuppression(message)) return false;

	const mode = getAutoApplyDamageMode();
	if (mode === 'none') return false;
	if (mode === 'always') return true;
	if (mode !== 'npc') return false;

	const targetActor = await getDamageTargetActor(message);
	return targetActor?.type === 'npc';
}

async function maybeAutoApplyDamage(message, root) {
	if (!isCurrentUserActiveGM()) return;
	if (message?.flags?.pf2e?.context?.type !== 'damage-roll') return;
	if (autoAppliedMessageIds.has(message.id)) return;
	if (!isMessagePendingAutoApply(message)) return;
	if (consumeAutoApplyMessageSuppression(message)) return;
	if (consumeAutoApplySuppression(message)) return;

	const mode = getAutoApplyDamageMode();
	if (mode === 'none') return;

	const damageButtons = await getAutoApplyDamageButtons(message, root, mode);
	if (damageButtons.length === 0) return;
	autoAppliedMessageIds.add(message.id);

	window.setTimeout(() => {
		for (const button of damageButtons) button.click();
	}, 50);
}

function injectHalfDamageButton(message, root) {
	if (!isHalfDamageEnabled()) return;
	if (!isPf2eDamageSourceMessage(message)) return;
	if (!canInteractWithMessage(message)) return;
	if (message.getFlag(FLAG_SCOPE, HALF_DAMAGE_FLAG)?.derivedFromMessageId) return;
	if (root.querySelector('.damage-application')) return;
	if (root.querySelector('.dmc-half-damage-button')) return;

	const damageButton = getSourceDamageButton(root);
	if (!(damageButton instanceof HTMLElement)) return;
	const actionRow = damageButton.parentElement;
	if (!(actionRow instanceof HTMLElement)) return;

	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'dmc-half-damage-button';
	button.textContent = 'Half';
	button.addEventListener('click', async (event) => {
		event.preventDefault();
		event.stopPropagation();

		const derived = await createHalfDamageFromSourceMessage(message, root);
		if (!derived) {
			ui.notifications.warn('Half damage could not be rolled from that card.');
			return;
		}

		ui.notifications.info('Created half-damage card.');
	});

	damageButton.insertAdjacentElement('afterend', button);
}

function getStandardDamageFormula(total, mode, damageType) {
	const numericTotal = Math.abs(Number(total) || 0);
	if (mode === 'healing') {
		if (damageType === 'vitality' || damageType === 'void') return `(${numericTotal})[${damageType}]`;
		return `(${numericTotal})[healing]`;
	}
	return damageType ? `(${numericTotal})[${damageType}]` : `${numericTotal}`;
}

async function createStandardDamageMessage(context, { mode, damageType }) {
	const DamageRollClass = getDamageRollClass();
	const formula = getStandardDamageFormula(context.rollTotal, mode, damageType);
	const roll = await new DamageRollClass(formula).evaluate({ async: true });
	const flavor = `Reinterpreted ${context.rollFormula ?? context.rollTotal} as ${damageType} ${mode}`;
	const flags = {
		[FLAG_SCOPE]: {
			[RETYPE_FLAG]: {
				derivedFromMessageId: context.originalMessageId,
				mode,
				damageType,
				source: context.source,
				targets: context.targets,
				rollFormula: context.rollFormula,
				rollTotal: context.rollTotal,
				rollJson: context.rollJson,
				pf2eContext: context.pf2eContext,
				createdBy: game.user.id,
			},
		},
	};

	return await roll.toMessage({
		speaker: context.speaker,
		whisper: context.whisper,
		blind: context.blind,
		flavor,
		flags,
	});
}

async function createDerivedRollMessage(message, { mode, damageType }) {
	if (!canInteractWithMessage(message)) {
		ui.notifications.warn('You do not have permission to reinterpret that roll.');
		return null;
	}

	const context = extractRollContext(message);
	if (!context) {
		ui.notifications.warn('That roll could not be reinterpreted.');
		return null;
	}

	const derived = await createStandardDamageMessage(context, { mode, damageType });
	await message.setFlag(FLAG_SCOPE, RETYPE_FLAG, {
		derivedMessageId: derived.id,
		mode,
		damageType,
		source: context.source,
		targets: context.targets,
	});
	ui.notifications.info(`Created ${damageType} ${mode} card from ${context.rollTotal}.`);
	return derived;
}

Hooks.on('renderChatMessage', (message, html) => {
	const root = html instanceof HTMLElement ? html : html[0];
	if (!root) return;
	if (isForcedHalfDamageMessage(message)) normalizeRenderedHalfDamageCard(root);

	const contentRoot = root.querySelector('.message-content') ?? root;
	if (isEligibleMessage(message)) injectRetypingControls(message, contentRoot);
	injectHalfDamageButton(message, root);
	void maybeAutoApplyDamage(message, root);
});

Hooks.on('createChatMessage', (message) => {
	markMessagePendingAutoApply(message);
});

Hooks.on('preCreateChatMessage', (message) => {
	if (message?.flags?.pf2e?.context?.type !== 'damage-roll') return;
	const request = findPendingHalfDamageRequest(message);
	if (!request) return;

	const nextFlags = forceHalfDamageContextOnSource(message.toObject());
	message.updateSource({
		flags: nextFlags,
		flavor: getHalfDamageFlavor(message),
	});
});

Hooks.once('ready', () => {
	game.socket?.on?.(SOCKET_EVENT, (payload) => {
		if (payload?.type !== 'dmc-half-damage-request') return;
		queueHalfDamageRequest({
			actorId: payload.actorId ?? null,
			itemId: payload.itemId ?? null,
			userId: payload.userId ?? null,
		});
	});
});

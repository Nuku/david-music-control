import { MODULE_ID } from './settings.js';

const FLAG_SCOPE = MODULE_ID;
const RETYPE_FLAG = 'rollRetyping';
const HALF_DAMAGE_FLAG = 'halfDamage';
const AUTO_APPLY_SUPPRESS_MS = 4000;
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

function canInteractWithMessage(message) {
	if (game.user.isGM) return true;
	if (message.user?.id === game.user.id) return true;
	const actor = getSourceActor(message);
	return actor?.isOwner ?? false;
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

function waitForNextDamageMessage(sourceMessage, timeoutMs = 2000) {
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
			if (contextType === 'damage-roll' && sameActor) finish(createdMessage);
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

	const pendingMessage = waitForNextDamageMessage(message);
	suppressNextAutoApplyForSpeaker(message);
	damageButton.click();
	const created = null;
	const damageMessage = await resolveCreatedDamageMessage(message, created) ?? await pendingMessage;
	if (!damageMessage) return null;

	const roll = getPrimaryRoll(damageMessage);
	if (!roll) return null;

	const DamageRollClass = getDamageRollClass();
	const formula = buildHalfDamageFormula(roll);
	if (!formula) return null;

	const halfRoll = await new DamageRollClass(formula).evaluate({ async: true });
	const halfMessage = await halfRoll.toMessage({
		speaker: foundry.utils.deepClone(damageMessage.speaker ?? {}),
		whisper: [...(damageMessage.whisper ?? [])],
		blind: !!damageMessage.blind,
		flavor: getHalfDamageFlavor(damageMessage),
		flags: cloneDamageFlagsAsHalfDamage(damageMessage, message),
	});

	await damageMessage.delete();
	return halfMessage;
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
	const targetSections = Array.from(root.querySelectorAll('.all-main-targets-damage-application .damage-application'));
	if (targetSections.length > 0) {
		const buttons = [];
		for (const section of targetSections) {
			if (!(await shouldAutoApplyTargetSection(section, mode))) continue;
			const button = getApplyDamageButton(section);
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

function waitForDamageApplication(root, timeoutMs = 2000) {
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

async function shouldAutoApplyDamage(message) {
	if (!game.user.isGM || game.user !== game.user.activeGM) return false;
	if (message?.flags?.pf2e?.context?.type !== 'damage-roll') return false;
	if (consumeAutoApplySuppression(message)) return false;

	const mode = getAutoApplyDamageMode();
	if (mode === 'none') return false;
	if (mode === 'always') return true;
	if (mode !== 'npc') return false;

	const targetActor = await getDamageTargetActor(message);
	return targetActor?.type === 'npc';
}

async function maybeAutoApplyDamage(message, root) {
	if (!game.user.isGM || game.user !== game.user.activeGM) return;
	if (message?.flags?.pf2e?.context?.type !== 'damage-roll') return;
	if (consumeAutoApplySuppression(message)) return;

	const mode = getAutoApplyDamageMode();
	if (mode === 'none') return;

	const damageButtons = await getAutoApplyDamageButtons(message, root, mode);
	if (damageButtons.length === 0) return;

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

	const contentRoot = root.querySelector('.message-content') ?? root;
	if (isEligibleMessage(message)) injectRetypingControls(message, contentRoot);
	injectHalfDamageButton(message, root);
	void maybeAutoApplyDamage(message, root);
});

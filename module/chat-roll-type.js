import { MODULE_ID } from './settings.js';

const FLAG_SCOPE = MODULE_ID;
const RETYPE_FLAG = 'rollRetyping';
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

function isFeatureEnabled() {
	return game.settings.get(MODULE_ID, 'enableUntypedRollRetyping');
}

function getMessageRolls(message) {
	if (Array.isArray(message.rolls) && message.rolls.length > 0) return message.rolls.filter(Boolean);
	if (message.roll) return [message.roll];
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

	if (!isEligibleMessage(message)) return;
	injectRetypingControls(message, root.querySelector('.message-content') ?? root);
});

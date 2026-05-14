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

	wrapper.querySelector('[data-action="dmc-create-derived-roll"]')?.addEventListener('click', async (event) => {
		event.preventDefault();
		event.stopPropagation();
		const mode = wrapper.querySelector('[name="dmc-roll-mode"]')?.value || 'damage';
		const damageType = wrapper.querySelector('[name="dmc-roll-type"]')?.value || 'fire';
		await createDerivedRollMessage(message, { mode, damageType });
	});

	root.appendChild(wrapper);
}

function formatTargets(targets = []) {
	if (!Array.isArray(targets) || targets.length === 0) return 'No targets captured';
	return targets.map((target) => target.name ?? target.actorId ?? target.tokenId ?? 'Unknown').join(', ');
}

function buildDerivedCardContent(context, { mode, damageType }) {
	const verb = mode === 'healing' ? 'healing' : 'damage';
	const sourceName = context.source?.name ?? context.speaker?.alias ?? 'Unknown Source';
	const flavor = context.flavor ? `<p class="dmc-derived-roll-subtitle">${foundry.utils.escapeHTML(String(context.flavor))}</p>` : '';
	return `
		<div class="dmc-derived-roll-card" data-dmc-derived-card="true">
			<div class="dmc-derived-roll-header">
				<div class="dmc-derived-roll-title">Reinterpreted Roll</div>
				<div class="dmc-derived-roll-badge">${damageType} ${verb}</div>
			</div>
			<div class="dmc-derived-roll-total">${context.rollTotal}</div>
			<p class="dmc-derived-roll-meta">${context.rollFormula ?? 'Flat total'}</p>
			${flavor}
			<p class="dmc-derived-roll-source"><strong>Source:</strong> ${sourceName}</p>
			<p class="dmc-derived-roll-targets"><strong>Targets:</strong> ${formatTargets(context.targets)}</p>
			<div class="dmc-derived-roll-actions">
				<button type="button" data-action="dmc-apply-derived-roll">Apply to Captured Targets</button>
			</div>
		</div>
	`;
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

	const content = buildDerivedCardContent(context, { mode, damageType });
	const chatData = {
		user: game.user.id,
		speaker: context.speaker,
		whisper: context.whisper,
		blind: context.blind,
		content,
		flavor: `Reinterpreted as ${damageType} ${mode}`,
		flags: {
			[FLAG_SCOPE]: {
				[RETYPE_FLAG]: {
					derivedFromMessageId: message.id,
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
		},
	};

	const derived = await ChatMessage.create(chatData);
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

function getDerivedData(message) {
	return message.getFlag(FLAG_SCOPE, RETYPE_FLAG);
}

function resolveTargets(targets = []) {
	return targets
		.map((target) => {
			const scene = target.sceneId ? game.scenes?.get(target.sceneId) : canvas?.scene;
			const token = scene?.tokens?.get?.(target.tokenId) ?? null;
			const actor = token?.actor ?? (target.actorId ? game.actors?.get(target.actorId) : null);
			return { actor, token, target };
		})
		.filter((entry) => entry.actor);
}

async function applyDerivedToActor(actor, amount, mode, damageType) {
	if (!actor) return;
	if (typeof actor.applyDamage === 'function') {
		const signed = mode === 'healing' ? -Math.abs(amount) : Math.abs(amount);
		await actor.applyDamage({ value: signed, damageType, token: actor.getActiveTokens?.()[0] ?? null });
		return;
	}

	const hp = actor.system?.attributes?.hp;
	if (!hp) return;
	const max = Number(hp.max ?? 0);
	const current = Number(hp.value ?? 0);
	const next = mode === 'healing'
		? Math.min(max, current + Math.abs(amount))
		: Math.max(0, current - Math.abs(amount));
	await actor.update({ 'system.attributes.hp.value': next });
}

async function applyDerivedRoll(message) {
	const data = getDerivedData(message);
	if (!data?.targets?.length) {
		ui.notifications.warn('No captured targets are available on this derived roll.');
		return;
	}

	const resolved = resolveTargets(data.targets);
	if (!resolved.length) {
		ui.notifications.warn('None of the captured targets could be resolved.');
		return;
	}

	for (const entry of resolved) {
		await applyDerivedToActor(entry.actor, Number(data.rollTotal) || 0, data.mode || 'damage', data.damageType || '');
	}

	await message.setFlag(FLAG_SCOPE, RETYPE_FLAG, {
		...data,
		appliedAt: Date.now(),
		appliedBy: game.user.id,
	});

	ui.notifications.info(`Applied ${data.rollTotal} ${data.damageType ?? ''} ${data.mode ?? 'damage'} to ${resolved.length} target(s).`);
}

Hooks.on('renderChatMessage', (message, html) => {
	const root = html instanceof HTMLElement ? html : html[0];
	if (!root) return;

	const derivedData = getDerivedData(message);
	if (derivedData?.derivedFromMessageId) {
		root.querySelector('[data-action="dmc-apply-derived-roll"]')?.addEventListener('click', async (event) => {
			event.preventDefault();
			event.stopPropagation();
			await applyDerivedRoll(message);
		});
		return;
	}

	if (!isEligibleMessage(message)) return;
	injectRetypingControls(message, root.querySelector('.message-content') ?? root);
});

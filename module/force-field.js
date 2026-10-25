import { MODULE_ID } from './settings.js';

const EFFECT_SLUG = 'effect-force-field';
const MAX_HP_BY_RECHARGE = new Map([
	[2, 6],  // Commercial
	[3, 14], // Tactical
	[4, 20], // Advanced
	[5, 26], // Superior
	[6, 32], // Elite
	[7, 37], // Ultimate
	[8, 42], // Paragon
]);
const RECHARGE_BY_MAX_HP = new Map([...MAX_HP_BY_RECHARGE].map(([recharge, maximum]) => [maximum, recharge]));
const MAX_HP_BY_QUALITY = new Map([
	['commercial', 6], ['tactical', 14], ['advanced', 20], ['superior', 26],
	['elite', 32], ['ultimate', 37], ['paragon', 42],
]);
const DAMAGE_TYPES = new Set([
	'bludgeoning', 'piercing', 'slashing',
	'acid', 'cold', 'electricity', 'fire', 'force', 'sonic',
	'positive', 'negative', 'vitality', 'void', 'plasma', 'radiation',
]);
const WRAPPED = Symbol.for(`${MODULE_ID}.forceFieldApplyDamage`);

function supportsForceField() {
	return ['pf2e', 'sf2e'].includes(game.system?.id);
}

function getForceField(actor) {
	return actor?.items?.find((item) => item.type === 'effect' && (item.slug ?? item.system?.slug) === EFFECT_SLUG);
}

function maximumFromSource(effect) {
	const systemId = game.system?.id;
	const origin = effect.flags?.[systemId]?.origin;
	const sourceUuid = origin?.uuid ?? origin?.item?.uuid ?? effect.flags?.core?.sourceId;
	const source = sourceUuid ? fromUuidSync(sourceUuid) : null;
	const sourceItems = source ? [source] : [...(effect.parent?.items ?? [])].filter((item) => item.type !== 'effect' && /force.?field/i.test(item.name ?? ''));
	const maxima = new Set();
	for (const item of sourceItems) {
		const match = `${item.name ?? ''} ${item.slug ?? ''}`.toLowerCase().match(/\b(commercial|tactical|advanced|superior|elite|ultimate|paragon)\b/);
		if (match) maxima.add(MAX_HP_BY_QUALITY.get(match[1]));
	}
	return maxima.size === 1 ? [...maxima][0] : null;
}

function maximumFor(effect) {
	const savedMaximum = Number(effect.getFlag?.(MODULE_ID, 'forceFieldMaximum'));
	if (Number.isFinite(savedMaximum) && MAX_HP_BY_RECHARGE.has(RECHARGE_BY_MAX_HP.get(savedMaximum))) return savedMaximum;

	const badge = effect.system?.badge;
	const explicitMaximum = Number(badge?.max);
	if (Number.isFinite(explicitMaximum) && MAX_HP_BY_RECHARGE.has(RECHARGE_BY_MAX_HP.get(explicitMaximum))) return explicitMaximum;

	const sourceMaximum = maximumFromSource(effect);
	if (sourceMaximum) return sourceMaximum;

	const current = Number(badge?.value);
	return RECHARGE_BY_MAX_HP.has(current) ? current : null;
}

async function rememberMaximum(effect) {
	if (!supportsForceField() || !effect?.parent || (effect.slug ?? effect.system?.slug) !== EFFECT_SLUG) return;
	const maximum = maximumFor(effect);
	if (!maximum || effect.getFlag?.(MODULE_ID, 'forceFieldMaximum') === maximum) return;
	await effect.setFlag(MODULE_ID, 'forceFieldMaximum', maximum);
}

function ownerIds(actor) {
	return [...(game.users ?? [])]
		.filter((user) => !user.isGM && actor.testUserPermission?.(user, 'OWNER'))
		.map((user) => user.id);
}

async function whisperRecharge(actor, amount, current, maximum) {
	const whisper = ownerIds(actor);
	if (!whisper.length) return;
	await ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor }),
		whisper,
		content: `<p><strong>Force Field recharged:</strong> +${amount} HP (${current}/${maximum}).</p>`,
	});
}

async function announceAbsorption(actor, absorbed, remainingDamage, fieldHP, maximumHP) {
	const outcome = remainingDamage === 0
		? `absorbed all ${absorbed} damage`
		: `absorbed ${absorbed} damage; ${remainingDamage} damage reached ${actor.name}`;
	const fieldStatus = fieldHP > 0 ? `The field has ${fieldHP}/${maximumHP} HP remaining.` : 'The field has been depleted.';
	await ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor }),
		content: `<p><strong>Force Field:</strong> ${outcome}. ${fieldStatus}</p>`,
	});
}

function installDamageHandling() {
	const classes = CONFIG.PF2E?.Actor?.documentClasses ?? {};
	const prototypes = new Set(['character', 'npc', 'hazard'].map((type) => classes[type]?.prototype).filter(Boolean));
	for (const prototype of prototypes) {
		if (prototype[WRAPPED] || typeof prototype.applyDamage !== 'function') continue;
		const original = prototype.applyDamage;
		prototype.applyDamage = async function (args) {
			const effect = supportsForceField() ? getForceField(this) : null;
			const instances = args?.damage?.instances;
			const badgeValue = Number(effect?.system?.badge?.value ?? 0);
			if (!effect || !Array.isArray(instances) || badgeValue <= 0) return original.call(this, args);

			await rememberMaximum(effect);
			const originalTotals = new Map(instances.map((instance) => [instance, instance._total]));
			const originalTotal = Number(args.damage.total ?? args.damage._total ?? 0);
			const maximumHP = maximumFor(effect) ?? badgeValue;
			const updatedTotals = new Map();
			let absorbed = 0;
			for (const instance of instances) {
				const amount = Math.max(0, Math.floor(Number(instance._total) || 0));
				if (!DAMAGE_TYPES.has(instance.type) || amount <= 0) continue;
				const remaining = badgeValue - absorbed;
				if (remaining <= 0) continue;
				const blocked = Math.min(amount, remaining);
				absorbed += blocked;
				updatedTotals.set(instance, amount - blocked);
			}
			if (absorbed <= 0) return original.call(this, args);

			const remainingInstances = instances.filter((instance) => Number(updatedTotals.get(instance) ?? instance._total) > 0);
			const remainingDamage = remainingInstances.reduce((total, instance) => total + Number(updatedTotals.get(instance) ?? instance._total), 0);
			try {
				await effect.update({ 'system.badge.value': badgeValue - absorbed });
				for (const [instance, total] of updatedTotals) instance._total = total;
				args.damage._total = remainingDamage;
				Hooks.callAll('pf2-director.forceFieldDamaged', {
					actor: this,
					effect,
					absorbed,
					remaining: badgeValue - absorbed,
				});
				const result = await original.call(this, args);
				await announceAbsorption(this, absorbed, remainingDamage, badgeValue - absorbed, maximumHP);
				return result;
			} finally {
				for (const [instance, total] of originalTotals) instance._total = total;
				args.damage._total = originalTotal;
			}
		};
		Object.defineProperty(prototype, WRAPPED, { value: true });
	}
}

async function regenerateForceField(combatant) {
	if (!supportsForceField() || !game.user?.isGM || game.users?.activeGM?.id !== game.user.id) return;
	const actor = combatant?.actor;
	const effect = getForceField(actor);
	if (!effect) return;

	const maximum = maximumFor(effect);
	if (!maximum) return;
	const recharge = RECHARGE_BY_MAX_HP.get(maximum);
	const current = Math.max(0, Number(effect.system?.badge?.value) || 0);
	const next = Math.min(maximum, current + recharge);
	const gained = next - current;
	if (gained <= 0) return;

	await effect.update({ 'system.badge.value': next });
	Hooks.callAll('pf2-director.forceFieldRegenerated', { actor, effect, gained, current: next, maximum });
	await whisperRecharge(actor, gained, next, maximum);
}

Hooks.once('init', installDamageHandling);
Hooks.on('createItem', (item) => void rememberMaximum(item));
Hooks.on('pf2e.startTurn', regenerateForceField);

import { MODULE_ID } from './settings.js';

const TAUNT_EFFECT_UUID = 'Compendium.pf2e.feat-effects.Item.FlyWq9znOHvpISNW';
const TAUNT_TARGETS_FLAG = 'tauntTargets';

function getTauntEffectUuid() {
	return TAUNT_EFFECT_UUID.replace('Compendium.pf2e.', `Compendium.${getSystemId()}.`);
}

function getSystemId() {
	return game.system?.id ?? 'pf2e';
}

function getSystemFlags(message) {
	return message?.flags?.[getSystemId()] ?? null;
}

function isCurrentUserActiveGM() {
	return game.user?.isGM && game.users?.activeGM?.id === game.user.id;
}

function getItemSlug(message) {
	const systemFlags = getSystemFlags(message);
	return String(
		message?.item?.slug
		?? systemFlags?.context?.item?.slug
		?? systemFlags?.origin?.slug
		?? ''
	)
		.trim()
		.toLowerCase();
}

function getItemName(message) {
	const systemFlags = getSystemFlags(message);
	return String(
		message?.item?.name
		?? systemFlags?.context?.item?.name
		?? systemFlags?.origin?.name
		?? ''
	)
		.trim()
		.toLowerCase();
}

function getMessageMarkup(message) {
	return `${message?.flavor ?? ''}\n${message?.content ?? ''}`;
}

function isTauntMessage(message) {
	const slug = getItemSlug(message);
	if (slug === 'taunt') return true;

	const name = getItemName(message);
	if (name === 'taunt') return true;

	const markup = getMessageMarkup(message);
	return (markup.includes(TAUNT_EFFECT_UUID) || markup.includes(getTauntEffectUuid())) && /\btaunt\b/i.test(markup);
}

function getSelectedCreatureTargetUuids() {
	return Array.from(game.user?.targets ?? [])
		.map((target) => target?.document ?? target)
		.filter((target) => target?.actor?.isOfType?.('creature'))
		.map((target) => target.uuid)
		.filter((uuid) => typeof uuid === 'string' && uuid.length > 0);
}

async function resolveTargetActor(uuid) {
	if (typeof uuid !== 'string' || !uuid) return null;

	try {
		const resolved = await fromUuid(uuid);
		return resolved?.actor ?? null;
	} catch (_error) {
		return null;
	}
}

function hasTauntEffect(actor) {
	return actor?.items?.some((item) => {
		const sourceId = item.getFlag?.('core', 'sourceId') ?? item.flags?.core?.sourceId ?? null;
		return sourceId === TAUNT_EFFECT_UUID || sourceId === getTauntEffectUuid()
			|| item.flags?.[MODULE_ID]?.taunt === true || item.slug === 'effect-taunt';
	}) ?? false;
}

async function createTauntEffectSource(message) {
	const uuid = getTauntEffectUuid();
	let effect = await fromUuid(uuid).catch(() => null);
	if (!effect && getSystemId() !== 'pf2e') {
		const pack = game.packs?.get(`${getSystemId()}.feat-effects`);
		const index = await pack?.getIndex({ fields: ['system.slug'] });
		const entry = index?.find((item) => item.system?.slug === 'effect-taunt');
		if (entry) effect = await pack.getDocument(entry._id);
	}
	// SF2e does not ship the Guardian's Taunt effect. Keep the same rule
	// elements locally so cross-system characters do not need PF2e installed.
	let source;
	if (effect) {
		source = effect.toObject();
	} else {
		const response = await fetch(`modules/${MODULE_ID}/module/data/taunt-effect.json`);
		if (!response.ok) throw new Error('Could not load the bundled Taunt effect.');
		source = await response.json();
	}
	delete source._id;
	source.flags ??= {};
	source.flags.core ??= {};
	if (effect) source.flags.core.sourceId = effect.uuid ?? uuid;
	source.flags[MODULE_ID] = { ...source.flags[MODULE_ID], taunt: true };
	const scene = game.scenes?.get(message.speaker?.scene);
	const token = scene?.tokens?.get(message.speaker?.token);
	const actor = message.actor ?? token?.actor ?? game.actors?.get(message.speaker?.actor);
	if (!actor?.uuid) throw new Error('Could not resolve the creature using Taunt.');
	source.system.context = {
		origin: {
			actor: actor.uuid,
			token: token?.uuid ?? null,
			item: message.item?.uuid ?? null,
			spellcasting: null,
			rollOptions: getSystemFlags(message)?.context?.options ?? [],
		},
	};
	return source;
}

Hooks.on('preCreateChatMessage', (message) => {
	if (!isTauntMessage(message)) return;

	const targetUuids = getSelectedCreatureTargetUuids();
	if (targetUuids.length <= 1) return;

	message.updateSource({
		flags: {
			[MODULE_ID]: {
				[TAUNT_TARGETS_FLAG]: targetUuids,
			},
		},
	});
});

Hooks.on('createChatMessage', (message) => {
	void (async () => {
		if (!isCurrentUserActiveGM()) return;
		if (!isTauntMessage(message)) return;

		const targetUuids = message.getFlag(MODULE_ID, TAUNT_TARGETS_FLAG);
		if (!Array.isArray(targetUuids) || targetUuids.length <= 1) return;

		await new Promise((resolve) => window.setTimeout(resolve, 150));

		const effectSource = await createTauntEffectSource(message);
		if (!effectSource) return;

		for (const uuid of targetUuids) {
			const actor = await resolveTargetActor(uuid);
			if (!actor?.isOfType?.('creature')) continue;
			if (hasTauntEffect(actor)) continue;
			await actor.createEmbeddedDocuments('Item', [foundry.utils.deepClone(effectSource)]);
		}
	})().catch((error) => {
		console.error('PF2 Director | Could not apply Taunt.', error);
		ui.notifications.error('PF2 Director could not apply Taunt. See the console for details.');
	});
});

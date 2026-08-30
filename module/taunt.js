import { MODULE_ID } from './settings.js';

const TAUNT_EFFECT_UUID = 'Compendium.pf2e.feat-effects.Item.FlyWq9znOHvpISNW';
const TAUNT_TARGETS_FLAG = 'tauntTargets';

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
	return markup.includes(TAUNT_EFFECT_UUID) && /\btaunt\b/i.test(markup);
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
		return sourceId === TAUNT_EFFECT_UUID;
	}) ?? false;
}

async function createTauntEffectSource() {
	const effect = await fromUuid(TAUNT_EFFECT_UUID);
	if (!effect) return null;

	const source = effect.toObject();
	delete source._id;
	source.flags ??= {};
	source.flags.core ??= {};
	source.flags.core.sourceId = TAUNT_EFFECT_UUID;
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

		const effectSource = await createTauntEffectSource();
		if (!effectSource) return;

		for (const uuid of targetUuids) {
			const actor = await resolveTargetActor(uuid);
			if (!actor?.isOfType?.('creature')) continue;
			if (hasTauntEffect(actor)) continue;
			await actor.createEmbeddedDocuments('Item', [foundry.utils.deepClone(effectSource)]);
		}
	})();
});

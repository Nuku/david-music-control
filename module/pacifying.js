import { MODULE_ID } from './settings.js';

const PACIFYING_SLUG = 'pacifying';
const PACIFIED_SOURCE_ID = `Compendium.${MODULE_ID}.pacified`;
const SOCKET_NAME = `module.${MODULE_ID}`;
const processedTargets = new Set();
const pendingReactionPrompts = new Map();

function isActiveGM() {
	return game.user?.isGM && game.users?.activeGM?.id === game.user.id;
}

function getDamageItem(message) {
	return message?.item ?? message?.flags?.pf2e?.context?.item ?? message?.flags?.pf2e?.context?.self?.item ?? message?.flags?.pf2e?.origin?.item ?? null;
}

function getDamageItemUuids(message) {
	const candidates = [
		message?.item,
		message?.flags?.pf2e?.context?.item,
		message?.flags?.pf2e?.context?.self?.item,
		message?.flags?.pf2e?.origin?.item,
		message?.flags?.pf2e?.origin?.uuid,
	];
	return candidates
		.map((candidate) => typeof candidate === 'string' ? candidate : candidate?.uuid)
		.filter((uuid) => typeof uuid === 'string' && uuid.length > 0);
}

function hasPacifyingRune(item) {
	const properties = [
		...(item?.system?.runes?.property ?? []),
		...(item?.system?.propertyRunes ?? []),
	];
	return properties.some((property) => {
		const slug = typeof property === 'string' ? property : property?.slug ?? property?.value;
		return String(slug ?? '').toLowerCase() === PACIFYING_SLUG;
	});
}

async function isPacifyingDamage(message) {
	if (message?.flags?.pf2e?.context?.type !== 'damage-roll') return false;
	const item = getDamageItem(message);
	if (hasPacifyingRune(item)) return true;
	for (const uuid of getDamageItemUuids(message)) {
		const resolved = await fromUuid(uuid).catch(() => null);
		if (hasPacifyingRune(resolved)) return true;
	}
	const markup = `${message?.flavor ?? ''}\n${message?.content ?? ''}`;
	return /(?:pacifying|pacified)/i.test(markup) && /weapon|strike/i.test(markup);
}

function getActorFromUuid(uuid) {
	if (!uuid) return null;
	const document = globalThis.fromUuidSync?.(uuid);
	return document?.actor ?? (document?.isOfType?.('creature') ? document : null);
}

function getAttackerActor(message) {
	const speaker = message?.speaker;
	const scene = speaker?.scene ? game.scenes?.get(speaker.scene) : game.scenes?.current;
	const token = scene?.tokens?.get?.(speaker?.token);
	return token?.actor ?? (speaker?.actor ? game.actors?.get(speaker.actor) : null);
}

async function confirmPacifyingReaction(actor) {
	const title = 'Use Pacifying Reaction?';
	const content = `<p>${actor?.name ?? 'The attacker'} damaged a creature with a Pacifying weapon. Use the reaction to force a DC 20 Will save?</p>`;
	if (foundry.applications?.api?.DialogV2) {
		return foundry.applications.api.DialogV2.confirm({
			window: { title },
			content,
			yes: { label: 'Use Reaction', icon: 'fas fa-hand-paper' },
			no: { label: 'Do Not Use' },
		}).catch(() => false);
	}
	return new Promise((resolve) => {
		new Dialog({
			title,
			content,
			buttons: {
				yes: { label: 'Use Reaction', callback: () => resolve(true) },
				no: { label: 'Do Not Use', callback: () => resolve(false) },
			},
			default: 'yes',
			close: () => resolve(false),
		}).render(true);
	});
}

function getReactionUser(actor) {
	const owners = Array.from(game.users ?? []).filter((user) => user.active && actor?.testUserPermission?.(user, 'OWNER'));
	return owners.find((user) => !user.isGM) ?? owners[0] ?? game.users?.activeGM ?? game.user;
}

function createPromptId() {
	return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

async function promptForReaction(actor) {
	const user = getReactionUser(actor);
	if (!user || user.id === game.user?.id) return confirmPacifyingReaction(actor);

	const requestId = createPromptId();
	return new Promise((resolve) => {
		const timeout = window.setTimeout(() => {
			pendingReactionPrompts.delete(requestId);
			resolve(false);
		}, 30000);
		pendingReactionPrompts.set(requestId, { resolve, timeout });
		game.socket.emit(SOCKET_NAME, {
			type: 'pacifying-reaction-prompt',
			requestId,
			userId: user.id,
			gmId: game.user.id,
			actorUuid: actor?.uuid,
		});
	});
}

function getTargetActors(button) {
	const actors = [];
	const targetElement = button?.closest?.('[data-target-uuid], [data-token-uuid], [data-actor-uuid]');
	const uuid = targetElement?.dataset?.targetUuid ?? targetElement?.dataset?.tokenUuid ?? targetElement?.dataset?.actorUuid;
	const directActor = getActorFromUuid(uuid);
	if (directActor) actors.push(directActor);

	for (const target of game.user?.targets ?? []) {
		const actor = target?.actor ?? target?.document?.actor;
		if (actor?.isOfType?.('creature')) actors.push(actor);
	}
	return Array.from(new Map(actors.map((actor) => [actor.uuid, actor])).values());
}

function hasPacifiedEffect(actor) {
	return actor.items?.some((item) => {
		const sourceId = item.getFlag?.('core', 'sourceId') ?? item.flags?.core?.sourceId;
		return sourceId === PACIFIED_SOURCE_ID || item.slug === 'pacified';
	}) ?? false;
}

function createPacifiedEffectSource() {
	return {
		name: 'Pacified',
		type: 'effect',
		img: 'icons/svg/target.svg',
		system: {
			description: {
				value: '<p>The creature takes a –2 penalty to attack rolls on attacks that lack the nonlethal trait. The creature receives a clear psychic warning that it should stop making attacks that could kill.</p>',
			},
			duration: { value: 1, unit: 'minutes', sustained: false, expiry: 'turn-start' },
			rules: [{
				key: 'FlatModifier',
				label: 'Pacified',
				selector: 'attack-roll',
				value: -2,
				type: 'untyped',
				predicate: [{ not: 'item:trait:nonlethal' }],
			}],
			slug: 'pacified',
			traits: { value: ['mental'], otherTags: [] },
			unidentified: false,
		},
		flags: { core: { sourceId: PACIFIED_SOURCE_ID } },
	};
}

async function pacifyTarget(actor, message) {
	if (!actor?.isOfType?.('creature') || hasPacifiedEffect(actor)) return;
	const key = `${message.id}:${actor.uuid}`;
	if (processedTargets.has(key)) return;
	processedTargets.add(key);

	const save = await actor.saves?.will?.roll?.({
		dc: 20,
		token: actor.getActiveTokens?.(true, true)?.shift() ?? null,
		title: `Pacifying Will Save — ${actor.name}`,
		identifier: `pacifying-${message.id}`,
	});
	const degree = Number(save?.options?.degreeOfSuccess ?? save?.degreeOfSuccess?.value ?? save?.degreeOfSuccess);
	if (!Number.isFinite(degree) || degree >= 2) return;

	await actor.createEmbeddedDocuments('Item', [createPacifiedEffectSource()]);
}

async function announcePacifyingReaction(actor) {
	const speaker = actor ? ChatMessage.getSpeaker({ actor }) : undefined;
	await ChatMessage.create({
		speaker,
		content: `<p><strong>Pacifying Reaction Used</strong></p><p>${actor?.name ?? 'The attacker'} uses the Pacifying reaction. Each damaged creature must attempt a <strong>DC 20 Will save</strong>.</p>`,
	});
}

game.socket.on(SOCKET_NAME, (data) => {
	if (data?.type === 'pacifying-reaction-prompt' && data.userId === game.user?.id) {
		const actor = getActorFromUuid(data.actorUuid);
		if (!actor) return;
		void confirmPacifyingReaction(actor).then((useReaction) => {
			game.socket.emit(SOCKET_NAME, {
				type: 'pacifying-reaction-response',
				requestId: data.requestId,
				gmId: data.gmId,
				useReaction,
			});
		});
		return;
	}

	if (data?.type !== 'pacifying-reaction-response' || !isActiveGM() || data.gmId !== game.user?.id) return;
	const pending = pendingReactionPrompts.get(data.requestId);
	if (!pending) return;
	window.clearTimeout(pending.timeout);
	pendingReactionPrompts.delete(data.requestId);
	pending.resolve(data.useReaction === true);
});

Hooks.on('renderChatMessage', (message, html) => {
	if (!isActiveGM() || message?.flags?.pf2e?.context?.type !== 'damage-roll') return;
	const root = html instanceof HTMLElement ? html : html?.[0];
	if (!root || root.dataset.pacifyingListener === 'true') return;
	void isPacifyingDamage(message).then((isPacifying) => {
		if (!isPacifying || !root.isConnected || root.dataset.pacifyingListener === 'true') return;
		root.dataset.pacifyingListener = 'true';
		root.addEventListener('click', (event) => {
			const button = event.target?.closest?.('[data-action="applyDamage"], [data-action="apply-damage"], .damage-application button');
			if (!button) return;
			const targets = getTargetActors(button);
			const attacker = getAttackerActor(message);
			window.setTimeout(() => {
				void promptForReaction(attacker).then((useReaction) => {
					if (!useReaction) return;
					void announcePacifyingReaction(attacker);
					for (const actor of targets) void pacifyTarget(actor, message);
				});
			}, 250);
		}, { capture: true });
	});
});

export { createPacifiedEffectSource };

import { MODULE_ID } from './settings.js';

const PACIFYING_SLUG = 'pacifying';
const PACIFIED_SOURCE_ID = `Compendium.${MODULE_ID}.pacified`;
const SOCKET_NAME = `module.${MODULE_ID}`;
const processedTargets = new Set();
const promptedMessages = new Set();
const pendingReactionPrompts = new Map();
const PACIFYING_DEBUG = true;

function debug(...args) {
	if (PACIFYING_DEBUG) console.debug('[PF2 Director][Pacifying]', ...args);
}

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
	if (message?.flags?.pf2e?.context?.type !== 'damage-roll') {
		debug('Ignored message with non-damage context', message?.id, message?.flags?.pf2e?.context?.type);
		return false;
	}
	const item = getDamageItem(message);
	if (hasPacifyingRune(item)) {
		debug('Detected Pacifying from message item', message.id, item?.name ?? item?.uuid);
		return true;
	}
	for (const uuid of getDamageItemUuids(message)) {
		const resolved = await fromUuid(uuid).catch(() => null);
		debug('Resolved damage item candidate', message.id, uuid, resolved?.name ?? null, hasPacifyingRune(resolved));
		if (hasPacifyingRune(resolved)) return true;
	}
	const markup = `${message?.flavor ?? ''}\n${message?.content ?? ''}`;
	const detected = /(?:pacifying|pacified)/i.test(markup) && /weapon|strike/i.test(markup);
	debug('Markup Pacifying detection', message.id, detected);
	return detected;
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

function getReactionUser(actor, message) {
	const messageUser = game.users?.get(message?.user?.id ?? message?.user);
	if (messageUser?.active) return messageUser;
	const owners = Array.from(game.users ?? []).filter((user) => user.active && actor?.testUserPermission?.(user, 'OWNER'));
	return owners.find((user) => !user.isGM) ?? owners[0] ?? game.users?.activeGM ?? game.user;
}

function createPromptId() {
	return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

async function promptForReaction(actor, message) {
	const user = getReactionUser(actor, message);
	debug('Routing reaction prompt', {
		messageId: message?.id,
		attacker: actor?.name ?? null,
		messageUser: message?.user?.id ?? message?.user ?? null,
		routedUser: user?.name ?? user?.id ?? null,
		localUser: game.user?.name ?? game.user?.id,
	});
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

function isRenderedPacifyingDamage(button) {
	const card = button?.closest?.('li.chat-message');
	const markup = card?.innerHTML ?? '';
	return /pacifying/i.test(markup) && /data-action=["']applyDamage|damage-roll|Damage Roll/i.test(markup);
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

function getActorsFromUuids(uuids) {
	return Array.from(new Map((uuids ?? [])
		.map((uuid) => getActorFromUuid(uuid))
		.filter((actor) => actor?.isOfType?.('creature'))
		.map((actor) => [actor.uuid, actor])).values());
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

	if (data?.type === 'pacifying-apply-request' && isActiveGM()) {
		const message = game.messages?.get(data.messageId);
		const attacker = getActorFromUuid(data.attackerUuid) ?? getAttackerActor(message);
		const targets = getActorsFromUuids(data.targetUuids);
		if (!message || targets.length === 0) return;
		void isPacifyingDamage(message).then((isPacifying) => {
			if (!isPacifying) return;
			void announcePacifyingReaction(attacker);
			for (const actor of targets) void pacifyTarget(actor, message);
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

function completePacifyingReaction(attacker, message, targets) {
	debug('Reaction accepted; completing Pacifying', {
		messageId: message?.id,
		attacker: attacker?.name ?? null,
		targets: targets.map((target) => target.name),
		localIsGM: isActiveGM(),
	});
	if (isActiveGM()) {
		void announcePacifyingReaction(attacker);
		for (const actor of targets) void pacifyTarget(actor, message);
		return;
	}
	game.socket.emit(SOCKET_NAME, {
		type: 'pacifying-apply-request',
		messageId: message.id,
		attackerUuid: attacker?.uuid,
		targetUuids: targets.map((actor) => actor.uuid),
	});
}

Hooks.once('ready', () => {
	debug('Registering document damage-button listeners', game.user?.name ?? game.user?.id);
	const handleDamageButton = (event) => {
		const button = event.target?.closest?.('[data-action="applyDamage"], [data-action="apply-damage"], .damage-application button');
		if (!button || promptedMessages.has(button.closest?.('li.chat-message')?.dataset?.messageId)) return;
		const card = button.closest?.('li.chat-message');
		const messageId = card?.dataset?.messageId;
		const message = messageId ? game.messages?.get(messageId) : null;
		debug('Captured damage button', event.type, { messageId, messageFound: !!message, contextType: message?.flags?.pf2e?.context?.type, renderedPacifying: isRenderedPacifyingDamage(button) });
		if (!message || (message.flags?.pf2e?.context?.type !== 'damage-roll' && !isRenderedPacifyingDamage(button))) return;
		promptedMessages.add(messageId);
		const targets = getTargetActors(button);
		const attacker = getAttackerActor(message);
		debug('Accepted Pacifying candidate card', { messageId, attacker: attacker?.name ?? null, targets: targets.map((target) => target.name) });
		void isPacifyingDamage(message).then((isPacifying) => {
			isPacifying ||= isRenderedPacifyingDamage(button);
			debug('Final Pacifying detection result', messageId, isPacifying);
			if (!isPacifying) return;
			window.setTimeout(() => {
				void promptForReaction(attacker, message).then((useReaction) => {
					if (!useReaction) return;
					completePacifyingReaction(attacker, message, targets);
				});
			}, 250);
		});
	};
	document.addEventListener('pointerdown', handleDamageButton, { capture: true });
	document.addEventListener('click', handleDamageButton, { capture: true });
});

export { createPacifiedEffectSource };

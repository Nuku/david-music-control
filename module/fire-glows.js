import { MODULE_ID } from './settings.js';

const pending = new Map();

function isPersistentFire(item) {
	return item.type === 'condition'
		&& (item.slug ?? item.system?.slug) === 'persistent-damage'
		&& item.system?.persistent?.damageType === 'fire';
}

function isFireGlow(item) {
	return item.type === 'effect' && item.flags?.[MODULE_ID]?.fireGlows === true;
}

function createEffect() {
	return {
		name: 'Fire Glows',
		type: 'effect',
		img: 'icons/svg/fire.svg',
		flags: { [MODULE_ID]: { fireGlows: true } },
		system: {
			slug: 'fire-glows',
			description: { value: '<p>Persistent fire damage sheds torch light: 15 feet of bright light and 30 feet of dim light in all directions.</p>' },
			duration: { value: -1, unit: 'unlimited', sustained: false, expiry: null },
			rules: [{
				key: 'TokenLight',
				value: {
					bright: 15, dim: 30, angle: 360,
					color: '#ff9b30', alpha: 0.5,
					animation: { type: 'torch', speed: 5, intensity: 5 },
				},
			}],
		},
	};
}

async function reconcileActor(actor) {
	if (!actor?.items || !game.user?.isGM || game.users?.activeGM?.id !== game.user.id) return;
	if (!['pf2e', 'sf2e'].includes(game.system?.id)) return;
	const effects = actor.items.filter(isFireGlow);
	const burning = game.settings.get(MODULE_ID, 'fireGlows') && actor.items.some(isPersistentFire);
	if (burning && effects.length === 0) {
		await actor.createEmbeddedDocuments('Item', [createEffect()]);
	} else {
		// Retain one owned effect while burning; remove only our effects when extinguished.
		const excess = burning ? effects.slice(1) : effects;
		if (excess.length) await actor.deleteEmbeddedDocuments('Item', excess.map((effect) => effect.id));
	}
}

function queueActor(actor) {
	if (!actor?.uuid) return Promise.resolve();
	const previous = pending.get(actor.uuid) ?? Promise.resolve();
	const task = previous.then(() => reconcileActor(actor)).catch((error) => {
		console.error('PF2 Director | Fire Glows reconciliation failed', actor.name, error);
	});
	pending.set(actor.uuid, task);
	void task.then(() => {
		if (pending.get(actor.uuid) === task) pending.delete(actor.uuid);
	});
	return task;
}

function reconcileAll() {
	const actors = new Map();
	for (const actor of game.actors ?? []) actors.set(actor.uuid, actor);
	for (const scene of game.scenes ?? []) {
		for (const token of scene.tokens ?? []) {
			if (token.actor) actors.set(token.actor.uuid, token.actor);
		}
	}
	return Promise.all([...actors.values()].map(queueActor));
}

for (const hook of ['createItem', 'updateItem', 'deleteItem']) {
	Hooks.on(hook, (item) => {
		// Inspect every condition update: a fire condition may have just changed damage type.
		if (item.type === 'condition') return queueActor(item.actor);
	});
}
Hooks.once('ready', reconcileAll);
Hooks.on('canvasReady', reconcileAll);
Hooks.on('createToken', (token) => queueActor(token.actor));
Hooks.on('updateSetting', (setting) => {
	if (setting.key === `${MODULE_ID}.fireGlows`) return reconcileAll();
});

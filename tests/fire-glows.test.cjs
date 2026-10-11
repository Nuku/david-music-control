const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../module/fire-glows.js'), 'utf8')
	.replace("import { MODULE_ID } from './settings.js';", "const MODULE_ID = 'test';");

function setup({ enabled = true, activeGM = true, systemId = 'pf2e' } = {}) {
	const hooks = new Map();
	let created = 0;
	const actor = {
		uuid: 'Actor.test', items: [],
		async createEmbeddedDocuments(_type, sources) {
			await Promise.resolve();
			for (const source of sources) this.items.push({ ...source, id: `effect-${++created}` });
		},
		async deleteEmbeddedDocuments(_type, ids) {
			this.items = this.items.filter((item) => !ids.includes(item.id));
		},
	};
	const game = {
		system: { id: systemId },
		user: { id: 'gm', isGM: true }, users: { activeGM: { id: activeGM ? 'gm' : 'other' } },
		settings: { get: () => enabled }, actors: [actor], scenes: [],
	};
	vm.runInNewContext(source, {
		game, console: { error: assert.fail },
		Hooks: { on: (name, fn) => hooks.set(name, fn), once: (name, fn) => hooks.set(name, fn) },
	});
	const add = (damageType, id = damageType) => {
		const item = { id, type: 'condition', slug: 'persistent-damage', system: { persistent: { damageType } }, actor };
		actor.items.push(item);
		return item;
	};
	return { actor, game, hooks, add, created: () => created, setEnabled: (value) => { enabled = value; } };
}

for (const systemId of ['pf2e', 'sf2e']) {
test(`${systemId}: only fire creates the requested light, and overlapping hooks do not duplicate it`, async () => {
	const s = setup({ systemId });
	await s.hooks.get('createItem')(s.add('acid'));
	assert.equal(s.created(), 0);
	const fire = s.add('fire');
	await Promise.all([s.hooks.get('createItem')(fire), s.hooks.get('updateItem')(fire)]);
	assert.equal(s.created(), 1);
	const effect = s.actor.items.find((item) => item.type === 'effect');
	assert.equal(effect.system.duration.unit, 'unlimited');
	assert.deepEqual(JSON.parse(JSON.stringify(effect.system.rules[0])), {
		key: 'TokenLight', value: {
			bright: 15, dim: 30, angle: 360, color: '#ff9b30', alpha: 0.5,
			animation: { type: 'torch', speed: 5, intensity: 5 },
		},
	});
});

test(`${systemId}: light persists until the last fire condition ends and preserves unrelated effects`, async () => {
	const s = setup({ systemId });
	const first = s.add('fire', 'first');
	const last = s.add('fire', 'last');
	s.add('acid');
	s.actor.items.push({ id: 'unrelated', type: 'effect', system: { slug: 'fire-glows' } });
	await s.hooks.get('createItem')(first);
	s.actor.items = s.actor.items.filter((item) => item !== first);
	await s.hooks.get('deleteItem')(first);
	assert.equal(s.actor.items.filter((item) => item.flags?.test?.fireGlows).length, 1);
	last.system.persistent.damageType = 'cold';
	await s.hooks.get('updateItem')(last);
	assert.equal(s.actor.items.filter((item) => item.flags?.test?.fireGlows).length, 0);
	assert.ok(s.actor.items.some((item) => item.id === 'unrelated'));
});

test(`${systemId}: enabling reconciles unlinked tokens; disabling cleans up owned effects`, async () => {
	const s = setup({ enabled: false, systemId });
	s.add('fire');
	s.game.actors = [];
	s.game.scenes = [{ tokens: [{ actor: s.actor }] }];
	await s.hooks.get('ready')();
	assert.equal(s.created(), 0);
	s.setEnabled(true);
	await s.hooks.get('updateSetting')({ key: 'test.fireGlows' });
	assert.equal(s.created(), 1);
	s.setEnabled(false);
	await s.hooks.get('updateSetting')({ key: 'test.fireGlows' });
	assert.equal(s.actor.items.filter((item) => item.type === 'effect').length, 0);
});

test(`${systemId}: only the active GM mutates actors`, async () => {
	const s = setup({ activeGM: false, systemId });
	await s.hooks.get('createItem')(s.add('fire'));
	await s.hooks.get('ready')();
	assert.equal(s.created(), 0);
});
}

test('unsupported systems do not receive effects', async () => {
	const s = setup({ systemId: 'dnd5e' });
	await s.hooks.get('createItem')(s.add('fire'));
	assert.equal(s.created(), 0);
});

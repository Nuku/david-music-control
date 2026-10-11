const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../module/automatic-token-level.js'), 'utf8')
	.replace("import { MODULE_ID } from './settings.js';", "const MODULE_ID = 'test';");

function setup({ isGM = true, accepted = true, enabled = true } = {}) {
	const hooks = new Map();
	const levels = [
		{ id: 'lower', name: 'Lower', elevation: { bottom: 0, top: 20 } },
		{ id: 'upper', name: 'Upper', elevation: { bottom: 20, top: 40 } },
	];
	levels.get = (id) => levels.find((level) => level.id === id);
	const updates = [];
	const views = [];
	let prompts = 0;
	const token = {
		id: 'token', uuid: 'Scene.test.Token.token', name: 'Test Token',
		level: 'upper', elevation: 20,
		parent: { levels, view: async (options) => views.push(options) },
		update: async (changes, options) => {
			if (hooks.get('preUpdateToken')(token, changes, options, 'user') === false) return;
			updates.push(changes);
			Object.assign(token, changes);
		},
	};
	token.parent.tokens = [token];
	vm.runInNewContext(source, {
		Hooks: { on: (name, callback) => hooks.set(name, callback) },
		game: { user: { id: 'user', isGM }, settings: { get: () => enabled } },
		canvas: { scene: token.parent }, console,
		foundry: {
			utils: { deepClone: structuredClone },
			applications: { api: { DialogV2: { confirm: async () => { prompts++; return accepted; } } } },
		},
		ui: { notifications: { warn: assert.fail, error: assert.fail } },
	});
	return { hooks, token, updates, views, prompts: () => prompts };
}

test('ordinary drag preserves level and elevation, including redundant elevation', async () => {
	for (const isGM of [true, false]) {
		for (const extra of [{}, { elevation: 20 }]) {
			const state = setup({ isGM });
			await state.token.update({ x: 100, y: 200, ...extra }, {});
			assert.equal(state.token.level, 'upper');
			assert.equal(state.token.elevation, 20);
			assert.equal(state.prompts(), 0);
			assert.equal(state.updates.length, 1);
		}
	}
});

test('actual GM elevation transition is snapped and committed with movement', async () => {
	const { token, updates } = setup();
	await token.update({ x: 100, elevation: 3 }, {});
	assert.deepEqual(updates, [{ x: 100, elevation: 0, level: 'lower' }]);
});

test('overlapping ranges retain the current level on elevation changes and scene load', async () => {
	const { token, hooks, updates } = setup();
	token.parent.levels[0].elevation.top = 25;
	await token.update({ elevation: 22 }, {});
	await hooks.get('canvasReady')({ scene: token.parent });
	assert.equal(token.level, 'upper');
	assert.equal(token.elevation, 22);
	assert.equal(updates.length, 1);
});

test('scene load still reconciles a genuinely mismatched token', async () => {
	const { token, hooks, updates } = setup();
	token.elevation = 10;
	await hooks.get('canvasReady')({ scene: token.parent });
	assert.equal(token.level, 'lower');
	assert.equal(updates.length, 1);
});

test('accepted player transition completes without prompting recursively', async () => {
	const state = setup({ isGM: false });
	await state.token.update({ x: 100, elevation: 3 }, {});
	await new Promise(setImmediate);
	assert.equal(state.prompts(), 1);
	assert.equal(state.updates.length, 1);
	assert.equal(state.token.level, 'lower');
	assert.equal(state.token.elevation, 0);
	assert.equal(state.token.x, 100);
	assert.equal(state.views[0].level, 'lower');
});

test('declined player transition leaves the token in place', async () => {
	const state = setup({ isGM: false, accepted: false });
	await state.token.update({ x: 100, elevation: 3 }, {});
	await new Promise(setImmediate);
	assert.equal(state.prompts(), 1);
	assert.equal(state.updates.length, 0);
	assert.equal(state.token.level, 'upper');
	assert.equal(state.token.elevation, 20);
	assert.equal(state.token.x, undefined);
});

test('disabled auto-level and updates from other users are left alone', () => {
	for (const [options, userId] of [[{ enabled: false }, 'user'], [{}, 'other']]) {
		const { hooks, token } = setup(options);
		const changes = { x: 100, elevation: 3 };
		hooks.get('preUpdateToken')(token, changes, {}, userId);
		assert.deepEqual(changes, { x: 100, elevation: 3 });
	}
});

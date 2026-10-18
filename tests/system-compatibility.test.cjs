const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
function load(file, globals = {}) {
	const source = fs.readFileSync(path.join(root, 'module', file), 'utf8')
		.replace(/^import .*;\r?\n/gm, "const MODULE_ID = 'pf2-david-music-control';\n");
	const context = vm.createContext({ Hooks: { on() {}, once() {} }, console, ...globals });
	vm.runInContext(source, context);
	return context;
}
const bundled = JSON.parse(fs.readFileSync(path.join(root, 'module/data/taunt-effect.json'), 'utf8'));
const actor = { uuid: 'Actor.guardian' };
const message = { actor, speaker: {}, item: { uuid: 'Actor.guardian.Item.taunt' }, flags: {} };

test('manifest declares the supported systems', () => {
	const manifest = JSON.parse(fs.readFileSync(path.join(root, 'module.json'), 'utf8'));
	assert.deepEqual(manifest.relationships.systems.map((system) => system.id), ['pf2e', 'sf2e', 'dnd5e']);
});

for (const systemId of ['pf2e', 'sf2e']) {
	test(`${systemId}: Taunt uses the native effect and retains the attacking creature`, async () => {
		const uuid = `Compendium.${systemId}.feat-effects.Item.FlyWq9znOHvpISNW`;
		const context = load('taunt.js', {
			game: { system: { id: systemId } },
			fromUuid: async (requested) => {
				assert.equal(requested, uuid);
				return { uuid, toObject: () => structuredClone(bundled) };
			},
		});
		const effect = await context.createTauntEffectSource(message);
		assert.equal(effect.flags.core.sourceId, uuid);
		assert.equal(effect.system.context.origin.actor, actor.uuid);
		assert.equal(effect.system.context.origin.item, message.item.uuid);
		assert.equal(context.hasTauntEffect({ items: [{ flags: effect.flags }] }), true);
	});
}

test('SF2e: missing PF2e content falls back to a working local Taunt effect', async () => {
	const context = load('taunt.js', {
		game: { system: { id: 'sf2e' }, packs: new Map() },
		fromUuid: async () => null,
		fetch: async (url) => {
			assert.equal(url, 'modules/pf2-david-music-control/module/data/taunt-effect.json');
			return { ok: true, json: async () => structuredClone(bundled) };
		},
	});
	const effect = await context.createTauntEffectSource(message);
	assert.equal(effect.system.duration.value, 1);
	assert.equal(effect.system.context.origin.actor, actor.uuid);
	assert.equal(effect.system.rules.find((rule) => rule.selector === 'attack-roll').value, -1);
	assert.equal(context.hasTauntEffect({ items: [{ flags: effect.flags }] }), true);
	assert.doesNotMatch(JSON.stringify(effect), /Compendium\.pf2e|PF2E\.SpecificRule/);
});

test('SF2e: Taunt resolves a native effect with a different document ID', async () => {
	const pack = {
		getIndex: async () => [{ _id: 'sf-native', system: { slug: 'effect-taunt' } }],
		getDocument: async (id) => {
			assert.equal(id, 'sf-native');
			return { uuid: 'Compendium.sf2e.feat-effects.Item.sf-native', toObject: () => structuredClone(bundled) };
		},
	};
	const context = load('taunt.js', {
		game: { system: { id: 'sf2e' }, packs: new Map([['sf2e.feat-effects', pack]]) },
		fromUuid: async () => null,
	});
	assert.equal((await context.createTauntEffectSource(message)).flags.core.sourceId, 'Compendium.sf2e.feat-effects.Item.sf-native');
});

test('roll retyping offers system and homebrew damage types and uses SF2e DamageRoll', () => {
	class DamageRoll {}
	const context = load('chat-roll-type.js', {
		game: { system: { id: 'sf2e' }, sf2e: { DamageRoll } },
		CONFIG: { PF2E: { damageTypes: { fire: 'Fire', radiation: 'Radiation', custom: 'Custom' } } },
	});
	assert.match(context.buildDamageTypeOptions(), /value="radiation"/);
	assert.match(context.buildDamageTypeOptions(), /value="custom"/);
	assert.doesNotMatch(context.buildDamageTypeOptions(), /value="chaotic"/);
	assert.equal(context.getDamageRollClass(), DamageRoll);
});

test('SF2e villain reroll uses the selected system API with the proper binding', async () => {
	let called = false;
	let decorated;
	class ChatMessage {
		id = 'rerolled';
		async update(changes) { decorated = changes; }
	}
	const rerolled = new ChatMessage();
	const checkApi = { async rerollFromMessage(rollMessage, options) {
		assert.equal(this, checkApi);
		assert.equal(rollMessage, message);
		assert.equal(options.keep, 'higher');
		called = true;
		return rerolled;
	} };
	const context = load('villain-points.js', {
		ChatMessage,
		game: { system: { id: 'sf2e' }, sf2e: { Check: checkApi }, user: { id: 'gm' }, messages: { get() {} } },
	});
	await context.performPf2eVillainReroll(message);
	assert.equal(called, true);
	assert.match(decorated.flavor, /Villain Point Reroll/);
});

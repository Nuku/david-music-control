const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

test('the terrain tool skips off-center pins and places each feature at its hex center', async () => {
	const source = fs.readFileSync(path.join(__dirname, '../module/hex-terrain-features.js'), 'utf8')
		.replace(/^import .*;\r?\n/, "const MODULE_ID = 'pf2-david-music-control';\n");
	const folder = { id: 'map-folder', name: 'The Wilds', type: 'JournalEntry' };
	const journals = [];
	const scene = {
		id: 'scene',
		name: folder.name,
		notes: [{ x: 9, y: 7 }],
		async createEmbeddedDocuments(type, data) {
			assert.equal(type, 'Note');
			this.notes.push(...data);
			return data;
		},
	};
	const grid = {
		isHexagonal: true,
		getOffsetRange: () => [0, -1, 1, 10],
		getOffset: ({ x }) => ({ i: 0, j: Math.floor(x / 10) }),
		getCenterPoint: ({ j }) => ({ x: j * 10 + 5, y: j % 2 ? 10 : 5 }),
	};
	const rolls = [1, 3, 4, 6, 7, 9, 10, 20];
	const notifications = [];
	const controls = { notes: { tools: {} } };
	vm.runInNewContext(source, {
		Hooks: { on: (hook, register) => {
			assert.equal(hook, 'getSceneControlButtons');
			register(controls);
		} },
		game: { user: { isGM: true }, folders: [folder], journal: journals },
		canvas: { ready: true, scene, grid, dimensions: { sceneRect: { contains: (x) => x >= 0 && x < 90 } } },
		foundry: { applications: { api: { DialogV2: { confirm: async () => true } } } },
		CONFIG: { JournalEntry: { noteIcons: { Obelisk: 'obelisk.svg', Cave: 'cave.svg', Chest: 'chest.svg' } } },
		CONST: { DOCUMENT_OWNERSHIP_LEVELS: { NONE: 0 } },
		Math: Object.assign(Object.create(Math), {
			random: () => {
				assert.ok(rolls.length, 'unexpected extra terrain roll');
				return (rolls.shift() - 0.5) / 20;
			},
		}),
		ui: { notifications: { info: (message) => notifications.push(message) } },
		JournalEntry: { createDocuments: async (data) => {
			const created = Array.from(data, (entry, index) => ({
				...entry,
				id: `entry-${index}`,
				getFlag: (moduleId, key) => entry.flags[moduleId][key],
			}));
			journals.push(...created);
			return created;
		} },
	});

	await controls.notes.tools.generateTerrainFeatures.onChange();

	assert.deepEqual(rolls, []);
	assert.deepEqual(scene.notes[0], { x: 9, y: 7 });
	assert.deepEqual(scene.notes.slice(1).map((note) => [note.x, note.y, note.text, note.texture.src]), [
		[15, 10, 'Landmark', 'obelisk.svg'],
		[25, 5, 'Landmark', 'obelisk.svg'],
		[35, 10, 'Secret', 'cave.svg'],
		[45, 5, 'Secret', 'cave.svg'],
		[55, 10, 'Resource', 'chest.svg'],
		[65, 5, 'Resource', 'chest.svg'],
	]);
	assert.deepEqual(scene.notes.slice(1).map((note) => note.entryId), journals.map((entry) => entry.id));
	assert.ok(journals.every((entry) => entry.folder === folder.id && entry.ownership.default === 0));
	assert.match(notifications[0], /2 Standard, 1 skipped/);

	rolls.push(10, 20);
	await controls.notes.tools.generateTerrainFeatures.onChange();
	assert.deepEqual(rolls, []);
	assert.equal(scene.notes.length, 7);
	assert.equal(journals.length, 6);
	assert.match(notifications[1], /2 Standard, 7 skipped/);
});

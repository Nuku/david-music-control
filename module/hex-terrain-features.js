import { MODULE_ID } from './settings.js';

const TOOL_NAME = 'generateTerrainFeatures';
const TERRAIN_FEATURES = [
	{ max: 3, name: 'Landmark', icon: 'Obelisk', description: 'A feature of some significance that distinguishes the hex as noteworthy.' },
	{ max: 6, name: 'Secret', icon: 'Cave', description: 'The hex contains a secret the party uncovers upon exploring the hex.' },
	{ max: 9, name: 'Resource', icon: 'Chest', description: 'The hex contains some valuable resource appropriate to the terrain.' },
];
const generatingScenes = new Set();

Hooks.on('getSceneControlButtons', (controls) => {
	const tools = controls.notes?.tools;
	if (!game.user.isGM || !tools) return;
	tools[TOOL_NAME] = {
		name: TOOL_NAME,
		title: 'Generate Terrain Features',
		icon: 'fa-solid fa-dice-d20',
		order: Math.max(0, ...Object.values(tools).map((tool) => tool.order ?? 0)) + 1,
		button: true,
		onChange: generateTerrainFeatures,
	};
});

function hexKey({ i, j }) {
	return `${i},${j}`;
}

function occupiedHexes(scene, grid) {
	return new Set(scene.notes.map((note) => hexKey(grid.getOffset({ x: note.x, y: note.y }))));
}

function rollTerrainFeatures(scene, grid, bounds) {
	const occupied = occupiedHexes(scene, grid);
	const [firstRow, firstColumn, endRow, endColumn] = grid.getOffsetRange(bounds);
	const features = [];
	let standard = 0;
	let skipped = 0;

	for (let i = firstRow; i < endRow; i++) {
		for (let j = firstColumn; j < endColumn; j++) {
			const center = grid.getCenterPoint({ i, j });
			if (!bounds.contains(center.x, center.y)) continue;
			const key = hexKey({ i, j });
			if (occupied.has(key)) {
				skipped++;
				continue;
			}

			const roll = Math.floor(Math.random() * 20) + 1;
			const feature = TERRAIN_FEATURES.find(({ max }) => roll <= max);
			if (feature) features.push({ key, center, feature });
			else standard++;
		}
	}

	return { features, standard, skipped };
}

async function createTerrainNotes(scene, grid, features) {
	if (!features.length) return { notes: [], skipped: 0 };

	const folder = game.folders.find((entry) => entry.type === 'JournalEntry' && !entry.folder && entry.name === scene.name)
		?? await Folder.create({ name: scene.name, type: 'JournalEntry' });

	// Reuse matching journals if a previous attempt created the entries before saving the pins.
	const journalKey = ({ key, name }) => `${key}:${name}`;
	const journals = new Map();
	for (const entry of game.journal) {
		const terrain = entry.getFlag(MODULE_ID, 'hexTerrainFeature');
		if (terrain?.sceneId === scene.id && entry.folder?.id === folder.id) {
			journals.set(journalKey(terrain), entry);
		}
	}

	const pending = features.filter(({ key, feature }) => !journals.has(journalKey({ key, name: feature.name })));
	if (pending.length) {
		const created = await JournalEntry.createDocuments(pending.map(({ key, feature }) => ({
			name: feature.name,
			folder: folder.id,
			ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE },
			pages: [{ name: feature.name, type: 'text', text: { content: `<p>${feature.description}</p>` } }],
			flags: { [MODULE_ID]: { hexTerrainFeature: { sceneId: scene.id, key, name: feature.name } } },
		})));
		for (const entry of created) journals.set(journalKey(entry.getFlag(MODULE_ID, 'hexTerrainFeature')), entry);
	}

	const occupied = occupiedHexes(scene, grid);
	const data = features.filter(({ key }) => !occupied.has(key)).map(({ key, center, feature }) => ({
		x: center.x,
		y: center.y,
		entryId: journals.get(journalKey({ key, name: feature.name })).id,
		text: feature.name,
		texture: { src: CONFIG.JournalEntry.noteIcons[feature.icon] },
	}));
	const notes = data.length ? await scene.createEmbeddedDocuments('Note', data) : [];
	return { notes, skipped: features.length - data.length };
}

async function generateTerrainFeatures() {
	if (!game.user.isGM) return;
	const { scene, grid, dimensions } = canvas;
	if (!canvas.ready || !scene || !grid?.isHexagonal || !dimensions?.sceneRect) {
		ui.notifications.warn('Open a hex-grid scene to generate terrain features.');
		return;
	}
	if (generatingScenes.has(scene.id)) return;

	generatingScenes.add(scene.id);
	try {
		const accepted = await foundry.applications.api.DialogV2.confirm({
			window: { title: 'Generate Terrain Features' },
			content: '<p>Roll on the Random Terrain Feature table for every hex without a Map Note? Landmark, Secret, and Resource results will add GM-only journal pins.</p>',
			rejectClose: false,
		});
		if (!accepted) return;
		if (!canvas.ready || canvas.scene !== scene || canvas.grid !== grid || canvas.dimensions !== dimensions) {
			ui.notifications.warn('The viewed map changed. Open the terrain generator again.');
			return;
		}

		const { features, standard, skipped } = rollTerrainFeatures(scene, grid, dimensions.sceneRect);
		const result = await createTerrainNotes(scene, grid, features);
		const counts = TERRAIN_FEATURES.map(({ name }) => `${result.notes.filter((note) => note.text === name).length} ${name}`);
		ui.notifications.info(`Terrain features: ${counts.join(', ')}, ${standard} Standard, ${skipped + result.skipped} skipped.`);
	} catch (error) {
		console.error(`[${MODULE_ID}] Could not generate terrain features.`, error);
		ui.notifications.error('Terrain feature generation did not finish. Check the console for details.');
	} finally {
		generatingScenes.delete(scene.id);
	}
}

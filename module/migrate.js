import { MODULE_ID } from './settings.js';

const OLD_IDS = ['combat-music-master', 'david-music-control'];
const MIGRATION_VERSION = '2.4.23';
const END_CREDITS_OLD_ID = 'end-credits';
const END_CREDITS_SETTING_MAP = [
	['creditsActive', 'endCreditsActive', false],
	['playlistId', 'endCreditsPlaylistId', ''],
	['soundId', 'endCreditsSoundId', ''],
	['backgroundImage', 'endCreditsBackgroundImage', ''],
	['bgOpacity', 'endCreditsBgOpacity', 1.0],
];

async function migrateFlags(doc) {
	for (const oldId of OLD_IDS) {
		if (oldId === MODULE_ID) continue;
		const oldFlags = doc.flags?.[oldId];
		if (!oldFlags || Object.keys(oldFlags).length === 0) continue;
		// Copy all old flags to new ID.
		const updates = {};
		for (const [key, value] of Object.entries(oldFlags)) {
			updates[`flags.${MODULE_ID}.${key}`] = value;
		}
		// Clear old flags.
		for (const key of Object.keys(oldFlags)) {
			updates[`flags.${oldId}.-=${key}`] = null;
		}
		await doc.update(updates);
		console.log(`PF2 Director | Migrated flags from ${oldId} on ${doc.name ?? doc.id}`);
	}
}

async function migrateEndCreditsSettings() {
	const oldStorage = game.settings.storage.get('world');
	if (!oldStorage) return;

	let migratedAny = false;

	for (const [oldKey, newKey, defaultValue] of END_CREDITS_SETTING_MAP) {
		const oldSetting = oldStorage.get(`${END_CREDITS_OLD_ID}.${oldKey}`);
		if (!oldSetting) continue;

		const oldValue = oldSetting.value;
		if (oldValue === undefined) continue;

		const newValue = game.settings.get(MODULE_ID, newKey);
		if (newValue !== defaultValue) continue;
		if (oldValue === defaultValue) continue;

		await game.settings.set(MODULE_ID, newKey, oldValue);
		migratedAny = true;
		console.log(`PF2 Director | Migrated end credits setting ${oldKey} -> ${newKey}`);
	}

	if (migratedAny) {
		console.log('PF2 Director | End credits settings migrated from end-credits.');
	}
}

export async function migrate() {
	if (!game.user.isGM) return;

	// Check if this migration version has already run.
	const migratedVersion = game.settings.get(MODULE_ID, 'migrated');
	if (migratedVersion === MIGRATION_VERSION) return;

	console.log('PF2 Director | Checking for flag migration...');

	// Migrate all scene tokens across all scenes.
	for (const scene of game.scenes.contents) {
		for (const token of scene.tokens.contents) {
			await migrateFlags(token);
		}
	}

	// Migrate all actors and their prototype tokens.
	for (const actor of game.actors.contents) {
		await migrateFlags(actor);
		// Prototype token flags live on the actor document under prototypeToken.flags.
		for (const oldId of OLD_IDS) {
			if (oldId === MODULE_ID) continue;
			const oldFlags = actor.prototypeToken?.flags?.[oldId];
			if (!oldFlags || Object.keys(oldFlags).length === 0) continue;
			const updates = { prototypeToken: { flags: {} } };
			updates.prototypeToken.flags[MODULE_ID] = { ...oldFlags };
			updates.prototypeToken.flags[oldId] = Object.fromEntries(
				Object.keys(oldFlags).map((k) => [`-=${k}`, null])
			);
			await actor.update(updates);
			console.log(`PF2 Director | Migrated prototype token flags from ${oldId} on ${actor.name}`);
		}
	}

	// Migrate any active combats.
	for (const combat of game.combats.contents) {
		await migrateFlags(combat);
	}

	await migrateEndCreditsSettings();

	// Mark migration as done so it never runs again.
	await game.settings.set(MODULE_ID, 'migrated', MIGRATION_VERSION);
	console.log('PF2 Director | Migration complete.');
}

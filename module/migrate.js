import { MODULE_ID } from './settings.js';

const OLD_IDS = ['combat-music-master', 'david-music-control'];

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
		console.log(`David Music Control | Migrated flags from ${oldId} on ${doc.name ?? doc.id}`);
	}
}

export async function migrate() {
	if (!game.user.isGM) return;

	// Check if this migration version has already run.
	const migratedVersion = game.settings.get(MODULE_ID, 'migrated');
	if (migratedVersion === '2.3.0') return;

	console.log('David Music Control | Checking for flag migration...');

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
			console.log(`David Music Control | Migrated prototype token flags from ${oldId} on ${actor.name}`);
		}
	}

	// Migrate any active combats.
	for (const combat of game.combats.contents) {
		await migrateFlags(combat);
	}

	// Mark migration as done so it never runs again.
	await game.settings.set(MODULE_ID, 'migrated', '2.3.0');
	console.log('David Music Control | Migration complete.');
}

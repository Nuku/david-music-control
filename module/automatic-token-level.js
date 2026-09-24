import { MODULE_ID } from './settings.js';

/**
 * Keep a token's built-in scene level aligned with its elevation. Scene levels
 * and their elevation ranges are core Foundry data; no level-management module
 * is required.
 */
Hooks.on('updateToken', async (token, changes) => {
	if (!game.user?.isGM || !game.settings.get(MODULE_ID, 'autoTokenLevel')) return;
	if (!Object.hasOwn(changes ?? {}, 'elevation')) return;

	const elevation = Number(token.elevation);
	if (!Number.isFinite(elevation)) return;

	const levels = token.parent?.levels ?? [];
	const targetLevel = levels.find((level) => {
		const bottom = Number(level.elevation?.bottom);
		const top = Number(level.elevation?.top);
		return Number.isFinite(bottom) && Number.isFinite(top) && elevation >= bottom && elevation <= top;
	});
	if (!targetLevel || token.level === targetLevel.id) return;

	try {
		await token.update({ level: targetLevel.id });
	} catch (error) {
		console.error(`${MODULE_ID} | Could not update token level for ${token.name}`, error);
	}
});

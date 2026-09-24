import { MODULE_ID } from './settings.js';

function getLevelForElevation(scene, elevation) {
	return (scene?.levels ?? []).find((level) => {
		const bottom = Number(level.elevation?.bottom);
		const top = Number(level.elevation?.top);
		return Number.isFinite(bottom) && Number.isFinite(top) && elevation >= bottom && elevation <= top;
	});
}

async function synchronizeTokenLevel(token, elevation = token?.elevation) {
	if (!token || !game.user?.isGM || !game.settings.get(MODULE_ID, 'autoTokenLevel')) return;

	elevation = Number(elevation);
	if (!Number.isFinite(elevation)) return;

	const targetLevel = getLevelForElevation(token.parent, elevation);
	const targetLevelId = targetLevel?.id ?? targetLevel?._id;
	if (!targetLevelId || token.level === targetLevelId) return;

	try {
		await token.update({ level: targetLevelId });
	} catch (error) {
		console.error(`${MODULE_ID} | Could not update token level for ${token.name}`, error);
	}
}

async function synchronizeSceneTokenLevels(scene = canvas?.scene) {
	if (!game.user?.isGM || !game.settings.get(MODULE_ID, 'autoTokenLevel')) return;
	for (const token of scene?.tokens ?? []) await synchronizeTokenLevel(token);
}

/**
 * Keep a token's built-in scene level aligned with its elevation. Scene levels
 * and their elevation ranges are core Foundry data; no level-management module
 * is required.
 */
Hooks.on('updateToken', async (token, changes) => {
	if (!Object.hasOwn(changes ?? {}, 'elevation')) return;
	await synchronizeTokenLevel(token, changes.elevation);
});

// Correct tokens that were already at a mismatched elevation when this setting
// was enabled or when a scene was loaded.
Hooks.on('canvasReady', (canvasInstance) => synchronizeSceneTokenLevels(canvasInstance?.scene));
Hooks.on('updateSetting', (setting) => {
	if (setting?.key === `${MODULE_ID}.autoTokenLevel` && setting.value) synchronizeSceneTokenLevels();
});

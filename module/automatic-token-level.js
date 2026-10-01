import { MODULE_ID } from './settings.js';

const activeTransitionPrompts = new Set();

function escapeHTML(value) {
	return String(value ?? '').replace(/[&<>"']/g, (character) => ({
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;',
	}[character]));
}

function getLevelForElevation(scene, elevation) {
	return (scene?.levels ?? []).find((level) => {
		const bottom = Number(level.elevation?.bottom);
		const top = Number(level.elevation?.top);
		return Number.isFinite(bottom) && Number.isFinite(top) && elevation >= bottom && elevation <= top;
	});
}

function snapElevationToNearbyBoundary(level, elevation) {
	const bottom = Number(level.elevation?.bottom);
	const top = Number(level.elevation?.top);
	const bottomDistance = Math.abs(elevation - bottom);
	const topDistance = Math.abs(top - elevation);

	if (bottomDistance < topDistance && bottomDistance < 5) return bottom;
	if (topDistance < bottomDistance && topDistance < 5) return top;
	return elevation;
}

async function confirmLevelTransition(token, targetLevel, changes) {
	const targetLevelId = targetLevel?.id ?? targetLevel?._id;
	const currentLevel = token.parent?.levels?.get?.(token.level);
	const tokenName = escapeHTML(token.name);
	const targetLevelName = escapeHTML(targetLevel.name);
	const currentLevelName = escapeHTML(currentLevel?.name ?? 'this level');
	const targetElevation = Number(changes.elevation);
	const accepted = foundry.applications?.api?.DialogV2
		? await foundry.applications.api.DialogV2.confirm({
			window: { title: 'Move to Another Level?' },
			content: `<p>Moving <strong>${tokenName}</strong> to <strong>${targetLevelName}</strong> will change the viewed level. Continue?</p>`,
			yes: { label: `Move to ${targetLevelName}`, icon: 'fas fa-stairs' },
			no: { label: `Stay on ${currentLevelName}` },
		}).catch(() => false)
		: await new Promise((resolve) => {
			new Dialog({
				title: 'Move to Another Level?',
				content: `<p>Moving <strong>${tokenName}</strong> to <strong>${targetLevelName}</strong> will change the viewed level. Continue?</p>`,
				buttons: {
					yes: { label: `Move to ${targetLevelName}`, callback: () => resolve(true) },
					no: { label: `Stay on ${currentLevelName}`, callback: () => resolve(false) },
				},
				default: 'no',
				close: () => resolve(false),
			}).render(true);
		});

	if (!accepted) return;

	try {
		const destinationLevelId = targetLevel.id ?? targetLevel._id;
		const elevation = snapElevationToNearbyBoundary(targetLevel, targetElevation);
		await token.update({ ...changes, elevation, level: destinationLevelId }, { pf2DirectorLevelTransition: true });
		await token.parent?.view?.({ level: destinationLevelId, controlledTokens: [token.id] });
	} catch (error) {
		console.warn(`${MODULE_ID} | Could not complete player level transition`, error);
		ui.notifications.warn('PF2 Director could not change the token level. The token stayed where it was.');
	}
}

async function synchronizeTokenLevel(token, elevation = token?.elevation) {
	if (!token || !game.user?.isGM || !game.settings.get(MODULE_ID, 'autoTokenLevel')) return;

	elevation = Number(elevation);
	if (!Number.isFinite(elevation)) return;

	const targetLevel = getLevelForElevation(token.parent, elevation);
	const targetLevelId = targetLevel?.id ?? targetLevel?._id;
	if (!targetLevelId || token.level === targetLevelId) return;
	const snappedElevation = snapElevationToNearbyBoundary(targetLevel, elevation);

	try {
		await token.update({ level: targetLevelId, elevation: snappedElevation });
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
Hooks.on('updateToken', async (token, changes, options, userId) => {
	if (options?.pf2DirectorLevelTransition || (userId && userId !== game.user?.id)) return;
	if (!Object.hasOwn(changes ?? {}, 'elevation')) return;
	await synchronizeTokenLevel(token, changes.elevation);
});

// Intercept player-requested transitions before Foundry commits the movement.
// A decline therefore leaves both the token and the player's viewed level as-is.
Hooks.on('preUpdateToken', (token, changes, _options, userId) => {
	if (
		!game.settings.get(MODULE_ID, 'autoTokenLevel') ||
		game.user?.isGM ||
		(userId && userId !== game.user?.id) ||
		!Object.hasOwn(changes ?? {}, 'elevation')
	) return;

	const elevation = Number(changes.elevation);
	if (!Number.isFinite(elevation)) return;
	const targetLevel = getLevelForElevation(token.parent, elevation);
	const targetLevelId = targetLevel?.id ?? targetLevel?._id;
	if (!targetLevelId || token.level === targetLevelId) return;

	const promptKey = token.uuid ?? token.id;
	if (activeTransitionPrompts.has(promptKey)) return false;
	activeTransitionPrompts.add(promptKey);
	const proposedChanges = foundry.utils.deepClone(changes);
	void confirmLevelTransition(token, targetLevel, proposedChanges)
		.catch((error) => {
			console.error(`${MODULE_ID} | Could not prompt for token level transition`, error);
			ui.notifications.error('PF2 Director could not confirm the level change. The token stayed where it was.');
		})
		.finally(() => activeTransitionPrompts.delete(promptKey));
	return false;
});

// Correct tokens that were already at a mismatched elevation when this setting
// was enabled or when a scene was loaded.
Hooks.on('canvasReady', (canvasInstance) => synchronizeSceneTokenLevels(canvasInstance?.scene));
Hooks.on('updateSetting', (setting) => {
	if (setting?.key === `${MODULE_ID}.autoTokenLevel` && setting.value) synchronizeSceneTokenLevels();
});

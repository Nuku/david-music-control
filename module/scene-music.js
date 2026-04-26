import { getSetting } from './settings.js';
import { getCombatMusic } from './music-manager.js';

function findScenePlaylist(scene) {
	if (!scene) return null;
	const candidates = [scene.name, scene.navName].filter(Boolean).map((n) => n.trim().toLowerCase());
	return game.playlists.contents.find((p) =>
		candidates.includes(p.name.trim().toLowerCase())
	) ?? null;
}

function stopNonCombatMusic() {
	const combatIds = new Set(getCombatMusic().map((p) => p.id));
	for (const playlist of game.playlists.playing) {
		if (!combatIds.has(playlist.id)) playlist.stopAll();
	}
}

export async function handleSceneChange(scene) {
	if (!getSetting('playSceneMusic')) return;
	if (!scene) return;
	if (game.combat?.started) return;

	const playlist = findScenePlaylist(scene);

	// Stop any non-combat music currently playing.
	stopNonCombatMusic();

	if (!playlist) return;

	console.log(`David Music Control | Starting scene music: ${playlist.name}`);
	await playlist.playAll();
}

Hooks.on('canvasReady', () => {
	if (!game.user.isGM) return;
	handleSceneChange(game.scenes.active);
});

Hooks.on('updateScene', (scene, changes) => {
	if (!game.user.isGM) return;
	if (!('active' in changes) || !changes.active) return;
	handleSceneChange(scene);
});

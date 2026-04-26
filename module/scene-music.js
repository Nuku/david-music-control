import { MODULE_ID, getSetting } from './settings.js';

function findScenePlaylist(scene) {
	if (!scene) return null;
	const candidates = [scene.name, scene.navName].filter(Boolean).map((n) => n.trim().toLowerCase());
	return game.playlists.contents.find((p) =>
		candidates.includes(p.name.trim().toLowerCase())
	) ?? null;
}

function anythingPlaying() {
	return game.playlists.playing.length > 0;
}

export function playSceneMusic(scene) {
	if (!getSetting('playSceneMusic')) return;
	if (!scene) return;
	if (game.combat?.started) return;
	if (anythingPlaying()) return;

	const playlist = findScenePlaylist(scene);
	if (!playlist) return;

	console.log(`David Music Control | Starting scene music: ${playlist.name}`);
	playlist.playAll();
}

export function stopSceneMusic(previousScene) {
	if (!getSetting('playSceneMusic')) return;
	if (!previousScene) return;
	const playlist = findScenePlaylist(previousScene);
	if (!playlist) return;
	if (!playlist.playing) return;
	playlist.stopAll();
}

Hooks.on('canvasReady', () => {
	if (!game.user.isGM) return;
	playSceneMusic(game.scenes.active);
});

Hooks.on('updateScene', (scene, changes) => {
	if (!game.user.isGM) return;
	if (!('active' in changes)) return;
	if (!changes.active) return;
	// A new scene became active — try to play its music.
	playSceneMusic(scene);
});

import { getSetting } from './settings.js';
import { getCombatMusic } from './music-manager.js';

function findScenePlaylist(scene) {
	if (!scene) return null;
	const candidates = [scene.name, scene.navName].filter(Boolean).map((n) => n.trim().toLowerCase());
	return game.playlists.contents.find((p) =>
		candidates.includes(p.name.trim().toLowerCase())
	) ?? null;
}

function findSceneFolder(scene) {
	if (!scene) return null;
	const candidates = [scene.name, scene.navName].filter(Boolean).map((n) => n.trim().toLowerCase());
	const folder = game.folders.contents.find((f) =>
		f.type === 'Playlist' && candidates.includes(f.name.trim().toLowerCase())
	) ?? null;
	if (!folder) return null;
	// Get all playlists in this folder.
	const playlists = game.playlists.contents.filter((p) => p.folder?.id === folder.id);
	return playlists.length > 0 ? { folder, playlists } : null;
}

function stopNonCombatMusic() {
	const combatIds = new Set(getCombatMusic().map((p) => p.id));
	for (const playlist of game.playlists.playing) {
		if (!combatIds.has(playlist.id)) playlist.stopAll();
	}
}

async function promptPlaylistSelection(scene, playlists) {
	// Use DialogV2 if available (v14+), fall back to Dialog (v13).
	if (foundry.applications?.api?.DialogV2) {
		const options = playlists.map((p) => `<option value="${p.id}">${p.name}</option>`).join('');
		const result = await foundry.applications.api.DialogV2.prompt({
			window: { title: `Scene Music — ${scene.name}` },
			content: `
				<p>Multiple playlists found for this scene. Which would you like to play?</p>
				<div class="form-group">
					<select name="playlist" style="width:100%">${options}</select>
				</div>
			`,
			ok: {
				label: 'Play',
				icon: 'fas fa-play',
				callback: (event, button) => button.form.elements.playlist.value,
			},
		}).catch(() => null);
		return result ? (game.playlists.get(result) ?? null) : null;
	}

	// v13 fallback.
	const options = playlists.map((p) => `<option value="${p.id}">${p.name}</option>`).join('');
	return new Promise((resolve) => {
		new Dialog({
			title: `Scene Music — ${scene.name}`,
			content: `
				<p>Multiple playlists found for this scene. Which would you like to play?</p>
				<div class="form-group">
					<select id="cmm-playlist-select" style="width:100%">${options}</select>
				</div>
			`,
			buttons: {
				play: {
					icon: '<i class="fas fa-play"></i>',
					label: 'Play',
					callback: (html) => {
						const root = html instanceof HTMLElement ? html : html[0];
						const id = root.querySelector('#cmm-playlist-select').value;
						resolve(game.playlists.get(id) ?? null);
					},
				},
				cancel: {
					icon: '<i class="fas fa-times"></i>',
					label: 'Cancel',
					callback: () => resolve(null),
				},
			},
			default: 'play',
			close: () => resolve(null),
		}).render(true);
	});
}

export async function handleSceneChange(scene) {
	if (!getSetting('playSceneMusic')) return;
	if (!scene) return;
	if (game.combat?.started) return;

	// Stop any non-combat music currently playing.
	stopNonCombatMusic();

	// Step 1: Look for a playlist matching the scene name.
	const playlist = findScenePlaylist(scene);
	if (playlist) {
		console.log(`David Music Control | Starting scene music: ${playlist.name}`);
		await playlist.playAll();
		return;
	}

	// Step 2: Look for a folder matching the scene name.
	const folderMatch = findSceneFolder(scene);
	if (!folderMatch) return;

	// If only one playlist in the folder, just play it.
	if (folderMatch.playlists.length === 1) {
		console.log(`David Music Control | Starting scene music from folder: ${folderMatch.playlists[0].name}`);
		await folderMatch.playlists[0].playAll();
		return;
	}

	// Multiple playlists — ask the GM.
	const chosen = await promptPlaylistSelection(scene, folderMatch.playlists);
	if (chosen) {
		console.log(`David Music Control | Starting scene music (chosen): ${chosen.name}`);
		await chosen.playAll();
	}
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

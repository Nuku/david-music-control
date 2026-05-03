import { getSetting } from './settings.js';
import { getCombatMusic } from './music-manager.js';

const LEADING_ARTICLES = /^(the|a|an)\s+/i;
const LEADING_PREFIX = /^[\w\d]+\s*[-–—]\s*/; // e.g. "H - ", "01 - ", "A - "

function normalize(name) {
	return name.trim()
		.replace(LEADING_PREFIX, '')  // strip "H - "
		.replace(LEADING_ARTICLES, '') // strip "The "
		.trim()
		.toLowerCase();
}

function getCandidates(scene) {
	const names = [scene.name, scene.navName].filter(Boolean).map((n) => n.trim());
	const candidates = new Set();
	for (const name of names) {
		const words = name.split(/\s+/);
		// Left-trim: "Agent Castle Eastside" -> "Agent Castle" -> "Agent"
		for (let i = words.length; i > 0; i--) {
			candidates.add(words.slice(0, i).join(' ').toLowerCase());
		}
		// Right-trim: "Agent Castle Eastside" -> "Castle Eastside" -> "Eastside"
		for (let i = 0; i < words.length; i++) {
			candidates.add(words.slice(i).join(' ').toLowerCase());
		}
		// Same on normalized name.
		const normalized = normalize(name);
		const normWords = normalized.split(/\s+/);
		for (let i = normWords.length; i > 0; i--) {
			candidates.add(normWords.slice(0, i).join(' '));
		}
		for (let i = 0; i < normWords.length; i++) {
			candidates.add(normWords.slice(i).join(' '));
		}
	}
	// Remove empty strings.
	candidates.delete('');
	return [...candidates];
}

function findScenePlaylist(scene) {
	if (!scene) return null;
	const candidates = getCandidates(scene);
	// Exact match first.
	for (const candidate of candidates) {
		const match = game.playlists.contents.find((p) => p.name.trim().toLowerCase() === candidate);
		if (match) return match;
	}
	// Normalized subset fallback: strip prefix/articles from playlist name and compare.
	const sceneNorms = new Set(getCandidates(scene).map((c) => normalize(c)).filter(Boolean));
	return game.playlists.contents.find((p) => sceneNorms.has(normalize(p.name))) ?? null;
}

function findSceneFolder(scene) {
	if (!scene) return null;
	const candidates = getCandidates(scene);

	const tryFolder = (name) => {
		const folder = game.folders.contents.find((f) =>
			f.type === 'Playlist' && f.name.trim().toLowerCase() === name
		);
		if (!folder) return null;
		const playlists = game.playlists.contents.filter((p) => p.folder?.id === folder.id);
		return playlists.length > 0 ? { folder, playlists } : null;
	};

	// Exact match first.
	for (const candidate of candidates) {
		const result = tryFolder(candidate);
		if (result) return result;
	}

	// Normalized fallback.
	const sceneNorms = new Set(getCandidates(scene).map((c) => normalize(c)).filter(Boolean));
	for (const norm of sceneNorms) {
		const folder = game.folders.contents.find((f) =>
			f.type === 'Playlist' && normalize(f.name) === norm
		);
		if (!folder) continue;
		const playlists = game.playlists.contents.filter((p) => p.folder?.id === folder.id);
		if (playlists.length > 0) return { folder, playlists };
	}

	return null;
}

function stopNonCombatMusic() {
	const combatIds = new Set(getCombatMusic().map((p) => p.id));
	for (const playlist of game.playlists.playing) {
		if (!combatIds.has(playlist.id)) playlist.stopAll();
	}
}

function addPlaylistChoice(playlists, playlist) {
	if (!playlist || playlists.some((p) => p.id === playlist.id)) return playlists;
	return [playlist, ...playlists];
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

export async function handleSceneChange(scene, { ignoreSettingCheck = false } = {}) {
	if (!ignoreSettingCheck && !getSetting('playSceneMusic')) return;
	if (!scene) return;
	if (game.combat?.started) return;

	// Step 1: Hold the first direct playlist match, then keep looking for folder choices.
	const playlist = findScenePlaylist(scene);

	// Step 2: Look for a folder matching the scene name.
	const folderMatch = findSceneFolder(scene);
	const choices = addPlaylistChoice(folderMatch?.playlists ?? [], playlist);
	if (!choices.length) return;

	// If there is only one playlist, just play it.
	if (choices.length === 1) {
		console.log(`David Music Control | Starting scene music: ${choices[0].name}`);
		stopNonCombatMusic();
		await choices[0].playAll();
		return;
	}

	// Multiple playlists — ask the GM.
	const chosen = await promptPlaylistSelection(scene, choices);
	if (chosen) {
		console.log(`David Music Control | Starting scene music (chosen): ${chosen.name}`);
		stopNonCombatMusic();
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

// Inject "Play Scene Music" button into the playlist sidebar.
Hooks.on('renderPlaylistDirectory', (app, html) => {
	if (!game.user.isGM && !game.user.hasPermission('PLAYLIST_CREATE')) return;

	const root = html instanceof HTMLElement ? html : html[0];
	if (!root) return;

	// Don't inject twice.
	if (root.querySelector('#cmm-scene-music-btn')) return;

	const btn = document.createElement('button');
	btn.id = 'cmm-scene-music-btn';
	btn.type = 'button';
	btn.innerHTML = '<i class="fas fa-music"></i> Play Scene Music';
	btn.addEventListener('click', async () => {
		const icon = btn.querySelector('i');
		icon.className = 'fas fa-spinner fa-spin';
		btn.disabled = true;
		try {
			await handleSceneChange(game.scenes.active, { ignoreSettingCheck: true });
		} finally {
			icon.className = 'fas fa-music';
			btn.disabled = false;
		}
	});

	// Try various known locations in v13's playlist sidebar.
	const footer = root.querySelector('.directory-footer');
	const header = root.querySelector('.directory-header');
	const searchRow = root.querySelector('.search-filter')?.closest('div, li, header')
		?? root.querySelector('.directory-search')?.closest('div, li, header');

	if (footer) {
		footer.prepend(btn);
	} else if (searchRow) {
		searchRow.after(btn);
	} else if (header) {
		header.append(btn);
	} else {
		root.prepend(btn);
	}
});

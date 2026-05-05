export const MODULE_ID = 'pf2-david-music-control';
import { exportMusicConfig, importMusicConfig } from './transfer.js';

const settings = {
	defaultPlaylist: {
		name: 'Default Playlist',
		hint: 'Select the default playlist, otherwise one will be selected at random. Reload to update the list.',
		scope: 'world',
		config: false,
		type: String,
		default: '',
	},
	pauseAmbience: {
		name: 'Pause Ambience Sounds',
		hint: 'When combat starts, all ambience sound is paused. It resumes once combat finishes.',
		scope: 'world',
		config: true,
		type: Boolean,
		default: true,
	},
	playSceneMusic: {
		name: 'Play Scene Music',
		hint: 'When entering a scene, if nothing is playing, look for a playlist matching the scene name and play it.',
		scope: 'world',
		config: true,
		type: Boolean,
		default: false,
	},
	enableCultSystem: {
		name: 'Enable PF2e Cult System',
		hint: 'Adds a Cult tab to PF2e party sheets for tracking cult statistics, phase notes, and level checks.',
		scope: 'world',
		config: true,
		type: Boolean,
		default: false,
		requiresReload: true,
	},
	pauseTrack: {
		name: 'Pause Tracks',
		hint: 'When switching tracks, pause old tracks instead of stopping them, unless they are a playlist.',
		scope: 'world',
		config: true,
		type: Boolean,
		default: true,
		requiresReload: true,
	},
	fireworksOnVictory: {
		name: 'Fireworks on Victory',
		hint: 'On Foundry V14+, show colorful victory fireworks based on encounter XP when combat ends.',
		scope: 'world',
		config: true,
		type: Boolean,
		default: false,
	},
	traitRules: {
		name: 'Trait Music Rules',
		scope: 'world',
		config: false,
		type: Array,
		default: [],
	},
	traitMappings: {
		name: 'Trait Music Mappings',
		scope: 'world',
		config: false,
		type: String,
		default: '[]',
	},
	migrated: {
		name: 'Migrated',
		scope: 'world',
		config: false,
		type: String,
		default: '',
	},
	victoryMusicGeneric: {
		name: 'Victory Music (Generic)',
		scope: 'world',
		config: false,
		type: String,
		default: '',
	},
	victoryMusicTrivial: {
		name: 'Victory Music (Trivial)',
		scope: 'world',
		config: false,
		type: String,
		default: '',
	},
	victoryMusicBoss: {
		name: 'Victory Music (Boss)',
		scope: 'world',
		config: false,
		type: String,
		default: '',
	},
};

export function getSetting(name) {
	return game.settings.get(MODULE_ID, name);
}

export function setSetting(name, value) {
	return game.settings.set(MODULE_ID, name, value);
}

Hooks.once('setup', () => {
	for (const [key, setting] of Object.entries(settings)) {
		game.settings.register(MODULE_ID, key, setting);
	}
});

// Inject Export/Import buttons directly into the settings UI after Pause Tracks.
Hooks.on('renderSettingsConfig', (app, html) => {
	if (!game.user.isGM) return;

	const root = html instanceof HTMLElement ? html : html[0];
	if (!root) return;

	// Find our module's section header first, then look for pauseTrack within it.
	const allInputs = root.querySelectorAll('input, select');
	let pauseTrackInput = null;
	for (const el of allInputs) {
		if (el.name === `${MODULE_ID}.pauseTrack`) { pauseTrackInput = el; break; }
	}
	if (!pauseTrackInput) return;

	const row = pauseTrackInput.closest('.form-group') ?? pauseTrackInput.closest('div');
	if (!row) return;

	// Don't inject twice.
	if (row.nextElementSibling?.classList.contains('cmm-transfer-row')) return;

	const wrapper = document.createElement('div');
	wrapper.className = 'form-group cmm-transfer-row';
	wrapper.innerHTML = `
		<label>Music Config</label>
		<div class="form-fields" style="gap: 0.5rem;">
			<button type="button" id="cmm-export-btn" style="flex:1">
				<i class="fas fa-file-export"></i> Export
			</button>
			<button type="button" id="cmm-import-btn" style="flex:1">
				<i class="fas fa-file-import"></i> Import
			</button>
		</div>
		<p class="hint">Export or import combat playlists and trait rules as a JSON file.</p>
	`;
	row.after(wrapper);

	wrapper.querySelector('#cmm-export-btn').addEventListener('click', () => {
		exportMusicConfig();
	});

	wrapper.querySelector('#cmm-import-btn').addEventListener('click', () => {
		importMusicConfig();
	});
});

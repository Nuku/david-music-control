export const MODULE_ID = 'pf2-david-music-control';
import { exportMusicConfig, importMusicConfig } from './transfer.js';

class VictoryFireworksImageConfig extends FormApplication {
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id: 'dmc-victory-fireworks-image-config',
			title: 'Victory Fireworks Image',
			template: 'modules/pf2-david-music-control/templates/victory-fireworks-image-config.hbs',
			width: 520,
			height: 'auto',
			closeOnSubmit: true,
		});
	}

	getData() {
		return {
			victoryFireworksTexture: game.settings.get(MODULE_ID, 'victoryFireworksTexture') ?? '',
		};
	}

	activateListeners(html) {
		super.activateListeners(html);
		html.find('[data-action="clear-image"]').on('click', () => {
			html.find('[name="victoryFireworksTexture"]').val('');
		});
	}

	async _updateObject(_event, formData) {
		await game.settings.set(MODULE_ID, 'victoryFireworksTexture', formData.victoryFireworksTexture ?? '');
		ui.notifications.info('Victory fireworks image saved.');
	}
}

class VillainPointDreadSoundConfig extends FormApplication {
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id: 'dmc-villain-point-dread-sound-config',
			title: 'Villain Point Dread Sound',
			template: 'modules/pf2-david-music-control/templates/villain-point-dread-sound-config.hbs',
			width: 520,
			height: 'auto',
			closeOnSubmit: true,
		});
	}

	getData() {
		const volume = Number(game.settings.get(MODULE_ID, 'villainPointNoticeVolume') ?? 0.7);
		return {
			villainPointNoticeSound: game.settings.get(MODULE_ID, 'villainPointNoticeSound') ?? '',
			villainPointNoticeVolume: volume,
			volumePct: Math.round(volume * 100),
		};
	}

	activateListeners(html) {
		super.activateListeners(html);

		html.find('[data-action="clear-audio"]').on('click', () => {
			html.find('[name="villainPointNoticeSound"]').val('');
		});

		html.find('[data-action="test-audio"]').on('click', () => {
			const src = String(html.find('[name="villainPointNoticeSound"]').val() ?? '').trim();
			if (!src) return;
			const volume = parseFloat(html.find('[name="villainPointNoticeVolume"]').val()) || 0.7;
			try {
				getAudioHelper()?.play?.({ src, volume, autoplay: true, loop: false }, false);
			} catch (error) {
				console.warn('[PF2 Director] Could not play villain point dread preview:', error);
			}
		});

		html.find('[name="villainPointNoticeVolume"]').on('input', (event) => {
			html.find('.dmc-volume-label').text(`${Math.round(Number(event.target.value || 0) * 100)}%`);
		});
	}

	async _updateObject(_event, formData) {
		const selectedSound = String(this.element?.find?.('[name="villainPointNoticeSound"]').val?.() ?? formData.villainPointNoticeSound ?? '').trim();
		await game.settings.set(MODULE_ID, 'villainPointNoticeSound', selectedSound);
		await game.settings.set(
			MODULE_ID,
			'villainPointNoticeVolume',
			Math.max(0, Math.min(1, parseFloat(formData.villainPointNoticeVolume) || 0.7))
		);
		ui.notifications.info('Villain point dread sound saved.');
	}
}

function getAudioHelper() {
	return globalThis.AudioHelper ?? foundry?.audio?.AudioHelper ?? null;
}

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
	enableCreatureAmbience: {
		name: 'Enable Creature Ambience',
		hint: 'Periodically plays PF2e Creature Sounds creature noises for players who have a path to a nearby observed actor, with closed doors and distance muffling the result.',
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
	},
	enableFullRest: {
		name: 'Enable Full Rest',
		hint: 'Adds a Recover button to PF2e party sheets that fully restores party members and removes Wounded.',
		scope: 'world',
		config: true,
		type: Boolean,
		default: false,
	},
	enableAtWillRecharge: {
		name: 'Enable At-Will Recharge',
		hint: 'Automatically restores uses for PF2e items named with "(at will)" immediately after they are used.',
		scope: 'world',
		config: true,
		type: Boolean,
		default: true,
	},
	enableUntypedRollRetyping: {
		name: 'Enable Roll Retyping',
		hint: 'Allows GMs and eligible players to reinterpret non-d20 roll chat cards as typed damage or healing and create a derived follow-up card.',
		scope: 'world',
		config: true,
		type: Boolean,
		default: false,
	},
	creatureAmbienceDebug: {
		name: 'Creature Ambience Debug Logging',
		hint: 'Log creature ambience scheduling, pathfinding, and per-user playback decisions to the browser console.',
		scope: 'client',
		config: true,
		type: Boolean,
		default: false,
	},
	enableVillainPoints: {
		name: 'Enable Villain Points',
		hint: 'Tracks spent hero points from character sheets, grants 1 villain point for every 2 hero point uses, and lets the GM spend villain points on chat rerolls.',
		scope: 'world',
		config: true,
		type: Boolean,
		default: false,
	},
	villainPointHeroPointRate: {
		name: 'Hero Points Per Villain Point',
		hint: 'How many hero point uses are required before the GM gains 1 villain point.',
		scope: 'world',
		config: true,
		type: Number,
		range: { min: 1, max: 10, step: 1 },
		default: 2,
	},
	pauseTrack: {
		name: 'Pause Tracks',
		hint: 'When switching tracks, pause old tracks instead of stopping them, unless they are a playlist.',
		scope: 'world',
		config: true,
		type: Boolean,
		default: true,
	},
	syncPlaylistPlayback: {
		name: 'Sync Playlist Playback',
		hint: 'When a playlist track starts, pauses, or resumes, wait briefly for connected clients and snap them to the same playback position.',
		scope: 'world',
		config: true,
		type: Boolean,
		default: false,
	},
	fireworksOnVictory: {
		name: 'Fireworks on Victory',
		hint: 'On Foundry V14+, show colorful victory fireworks based on encounter XP when combat ends.',
		scope: 'world',
		config: true,
		type: Boolean,
		default: false,
	},
	victoryFireworksTexture: {
		name: 'Victory Fireworks Image',
		hint: 'Stored custom particle image for victory fireworks.',
		scope: 'world',
		config: false,
		type: String,
		default: '',
	},
	traitRules: {
		name: 'Trait Music Rules',
		hint: 'Stored PF2e trait-based music rules.',
		scope: 'world',
		config: false,
		type: String,
		default: '[]',
	},
	villainPointNoticeSound: {
		name: 'Villain Point Dread Sound',
		hint: 'Optional audio file to play for all connected users whenever the GM gains a villain point.',
		scope: 'world',
		config: false,
		type: String,
		default: '',
	},
	villainPointNoticeVolume: {
		name: 'Villain Point Dread Volume',
		hint: 'How loud the villain-point dread sound should be for connected users.',
		scope: 'world',
		config: false,
		type: Number,
		range: { min: 0, max: 1, step: 0.05 },
		default: 0.7,
	},
	villainPointState: {
		name: 'Villain Point State',
		hint: 'Stored villain point counters and reset markers.',
		scope: 'world',
		config: false,
		type: String,
		default: '{}',
	},
	villainPointWidgetPosition: {
		name: 'Villain Point Widget Position',
		hint: 'Stored client position for the floating GM villain point widget.',
		scope: 'client',
		config: false,
		type: String,
		default: '',
	},
	migrated: {
		name: 'Migrated',
		hint: 'Internal migration marker.',
		scope: 'world',
		config: false,
		type: String,
		default: '',
	},
	victoryMusicGeneric: {
		name: 'Victory Music (Generic)',
		hint: 'Stored generic victory music selection.',
		scope: 'world',
		config: false,
		type: String,
		default: '',
	},
	victoryMusicTrivial: {
		name: 'Victory Music (Trivial)',
		hint: 'Stored trivial victory music selection.',
		scope: 'world',
		config: false,
		type: String,
		default: '',
	},
	victoryMusicBoss: {
		name: 'Victory Music (Boss)',
		hint: 'Stored boss victory music selection.',
		scope: 'world',
		config: false,
		type: String,
		default: '',
	},
};

export function getSetting(name) {
	const value = game.settings.get(MODULE_ID, name);
	if (name !== 'traitRules') return value;
	if (Array.isArray(value)) return value;
	if (typeof value !== 'string' || !value) return [];
	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed) ? parsed : [];
	} catch (_error) {
		return [];
	}
}

export function setSetting(name, value) {
	if (name === 'traitRules') {
		return game.settings.set(MODULE_ID, name, JSON.stringify(value ?? []));
	}
	return game.settings.set(MODULE_ID, name, value);
}

Hooks.once('setup', () => {
	for (const [key, setting] of Object.entries(settings)) {
		try {
			game.settings.register(MODULE_ID, key, setting);
		} catch (error) {
			console.error(`PF2 Director | Failed to register setting ${key}`, error);
		}
	}

	try {
		game.settings.registerMenu(MODULE_ID, 'victoryFireworksImageMenu', {
			name: 'Victory Fireworks Image',
			label: 'Configure Image',
			hint: 'Choose an optional custom particle image for victory fireworks. Keep the image small for performance.',
			icon: 'fas fa-image',
			type: VictoryFireworksImageConfig,
			restricted: true,
		});
	} catch (error) {
		console.error('PF2 Director | Failed to register menu victoryFireworksImageMenu', error);
	}

	try {
		game.settings.registerMenu(MODULE_ID, 'villainPointDreadSoundMenu', {
			name: 'Villain Point Dread Sound',
			label: 'Configure Sound',
			hint: 'Choose an optional audio cue and volume for villain point dread moments.',
			icon: 'fas fa-skull',
			type: VillainPointDreadSoundConfig,
			restricted: true,
		});
	} catch (error) {
		console.error('PF2 Director | Failed to register menu villainPointDreadSoundMenu', error);
	}
});

function findSettingsRow(root, key) {
	const field = root.querySelector(`[name="${MODULE_ID}.${key}"]`);
	if (field) return field.closest('.form-group') ?? field.closest('div');
	const button = root.querySelector(`button[data-key="${MODULE_ID}.${key}"]`);
	return button?.closest('.form-group') ?? button?.closest('div') ?? null;
}

function createSection(title, description = '') {
	const section = document.createElement('section');
	section.className = 'dmc-settings-section';
	section.innerHTML = `
		<header class="dmc-settings-header">
			<h3>${title}</h3>
			${description ? `<p>${description}</p>` : ''}
		</header>
		<div class="dmc-settings-section-body"></div>
	`;
	return section;
}

function buildTransferRow() {
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

	wrapper.querySelector('#cmm-export-btn').addEventListener('click', () => {
		exportMusicConfig();
	});

	wrapper.querySelector('#cmm-import-btn').addEventListener('click', () => {
		importMusicConfig();
	});

	return wrapper;
}

function appendRows(root, container, keys) {
	for (const key of keys) {
		const row = findSettingsRow(root, key);
		if (row) container.appendChild(row);
	}
}

// Group module settings and inject Export/Import buttons into the settings UI.
Hooks.on('renderSettingsConfig', (_app, html) => {
	const root = html instanceof HTMLElement ? html : html[0];
	if (!root) return;
	const existingModuleContainer = root.querySelector('.dmc-settings-section .dmc-settings-section-body')?.closest('.dmc-settings-section')?.parentElement;

	root.querySelectorAll('.dmc-settings-section').forEach((section) => {
		const body = section.querySelector('.dmc-settings-section-body');
		if (!body) return;
		while (body.firstChild) (existingModuleContainer ?? root).appendChild(body.firstChild);
		section.remove();
	});
	root.querySelectorAll('.dmc-settings-header').forEach((header) => {
		if (!header.closest('.dmc-settings-section')) header.remove();
	});
	root.querySelectorAll('.cmm-transfer-row').forEach((row) => row.remove());

	const sectionConfigs = [
		{
			title: 'Music',
			description: 'Combat playlists, scene matching, synchronization, and victory audio behavior.',
			keys: ['combatMusicMenu', 'traitMusicMenu', 'victoryMusicMenu', 'pauseAmbience', 'playSceneMusic', 'enableCreatureAmbience', 'pauseTrack', 'syncPlaylistPlayback', 'fireworksOnVictory', 'victoryFireworksImageMenu'],
			gmOnly: true,
			extraRow: game.user.isGM ? buildTransferRow() : null,
		},
		{
			title: 'PF2e Tools',
			description: 'Optional PF2e-specific utilities for party management and chat workflows.',
			keys: ['enableCultSystem', 'enableFullRest', 'enableAtWillRecharge', 'enableUntypedRollRetyping', 'creatureAmbienceDebug'],
		},
		{
			title: 'Villain Points',
			description: 'Hero-point conversion, rerolls, and synchronized dread cues for the table.',
			keys: ['enableVillainPoints', 'villainPointHeroPointRate', 'villainPointDreadSoundMenu'],
			gmOnly: true,
		},
		{
			title: 'Dramatic Health Display',
			description: 'Overlay position, visibility rules, and per-user sound feedback for HP changes.',
			keys: ['dramaticHealthBarPosition', 'dramaticHealthShowNumbers', 'dramaticHealthShowAlways', 'dramaticHealthMinChangePercent', 'dramaticHealthDebugMode', 'dramaticHealthSoundConfig'],
		},
		{
			title: 'End Credits',
			description: 'Credits music, background media, memoriam source, and live start or stop control.',
			keys: ['endCreditsMusicConfig', 'endCreditsImageConfig', 'endCreditsMemoriamFolder', 'endCreditsToggle'],
			gmOnly: true,
		},
	];

	const firstRow = sectionConfigs.flatMap((section) => section.keys).map((key) => findSettingsRow(root, key)).find(Boolean);
	if (!firstRow) return;
	const moduleContainer = firstRow.parentElement;
	if (!moduleContainer) return;

	const fragment = document.createDocumentFragment();
	for (const config of sectionConfigs) {
		if (config.gmOnly && !game.user.isGM) continue;
		const section = createSection(config.title, config.description);
		const body = section.querySelector('.dmc-settings-section-body');
		appendRows(root, body, config.keys);
		if (config.extraRow) body.appendChild(config.extraRow);
		if (body.childElementCount) fragment.appendChild(section);
	}

	moduleContainer.prepend(fragment);
});

import { MODULE_ID } from './settings.js';

const SHOW_MS = 3800;
const FADE_MS = 580;
const BAR_MOVE_MS = 700;

const hpCache = new Map();
const activePanels = new Map();

function dhdLog(...args) {
	if (game.settings.get(MODULE_ID, 'dramaticHealthDebugMode')) {
		console.log('[PF2 Director: DHD]', ...args);
	}
}

function dhdHpClass(pct) {
	if (pct > 0.66) return 'dhb-hp-high';
	if (pct > 0.33) return 'dhb-hp-mid';
	return 'dhb-hp-low';
}

function userCanSeeBar(token) {
	if (!token?.document) return false;
	if (game.user.isGM) return true;

	const mode = token.document.displayBars;
	const M = CONST.TOKEN_DISPLAY_MODES;

	switch (mode) {
		case M.NONE: return false;
		case M.ALWAYS: return true;
		case M.HOVER: return true;
		case M.OWNER:
		case M.OWNER_HOVER: return token.document.isOwner;
		case M.CONTROL: return token.isControlled;
		default: return false;
	}
}

function sceneTokensFor(actor) {
	if (!canvas?.ready || !canvas.tokens?.placeables) return [];
	return canvas.tokens.placeables.filter((token) => token.actor?.id === actor.id);
}

function playAudio(src, volume) {
	if (!src?.trim()) return;
	try {
		AudioHelper.play({ src, volume: volume ?? 0.7, autoplay: true, loop: false }, false);
	} catch (error) {
		console.warn(`[PF2 Director: DHD] Could not play audio "${src}":`, error);
	}
}

function maybePlayDamageSound() {
	if (!game.settings.get(MODULE_ID, 'dramaticHealthEnableSounds')) return;
	playAudio(
		game.settings.get(MODULE_ID, 'dramaticHealthDamageSound'),
		game.settings.get(MODULE_ID, 'dramaticHealthSoundVolume')
	);
}

function maybePlayHealSound() {
	if (!game.settings.get(MODULE_ID, 'dramaticHealthEnableSounds')) return;
	playAudio(
		game.settings.get(MODULE_ID, 'dramaticHealthHealSound'),
		game.settings.get(MODULE_ID, 'dramaticHealthSoundVolume')
	);
}

class DramaticHealthSoundConfig extends FormApplication {
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id: 'pf2-director-dhb-sound-config',
			title: 'Dramatic Health Display - Sound Settings',
			template: `modules/${MODULE_ID}/templates/dramatic-health-sound-config.hbs`,
			width: 520,
			height: 'auto',
			closeOnSubmit: true,
		});
	}

	async getData() {
		const volume = game.settings.get(MODULE_ID, 'dramaticHealthSoundVolume');
		return {
			enableSounds: game.settings.get(MODULE_ID, 'dramaticHealthEnableSounds'),
			damageSound: game.settings.get(MODULE_ID, 'dramaticHealthDamageSound'),
			healSound: game.settings.get(MODULE_ID, 'dramaticHealthHealSound'),
			soundVolume: volume,
			volumePct: Math.round(volume * 100),
		};
	}

	activateListeners(html) {
		super.activateListeners(html);

		html.find('.dhb-btn-browse').on('click', (event) => {
			const target = event.currentTarget.dataset.target;
			new FilePicker({
				type: 'audio',
				current: html.find(`[name="${target}"]`).val(),
				callback: (path) => html.find(`[name="${target}"]`).val(path),
			}).browse();
		});

		html.find('.dhb-btn-test').on('click', (event) => {
			const target = event.currentTarget.dataset.target;
			const src = html.find(`[name="${target}"]`).val()?.trim();
			const volume = parseFloat(html.find('[name="soundVolume"]').val()) || 0.7;
			playAudio(src, volume);
		});

		html.find('[name="soundVolume"]').on('input', (event) => {
			html.find('.dhb-vol-label').text(`${Math.round(event.target.value * 100)}%`);
		});
	}

	async _updateObject(_event, formData) {
		await game.settings.set(MODULE_ID, 'dramaticHealthEnableSounds', !!formData.enableSounds);
		await game.settings.set(MODULE_ID, 'dramaticHealthDamageSound', formData.damageSound ?? '');
		await game.settings.set(MODULE_ID, 'dramaticHealthHealSound', formData.healSound ?? '');
		await game.settings.set(MODULE_ID, 'dramaticHealthSoundVolume', parseFloat(formData.soundVolume) || 0.7);
		ui.notifications.info('Dramatic Health Display: sound settings saved.');
	}
}

function getContainer() {
	let element = document.getElementById('dhb-container');
	if (!element) {
		element = document.createElement('div');
		element.id = 'dhb-container';
		document.body.appendChild(element);
	}
	element.className = `dhb-pos-${game.settings.get(MODULE_ID, 'dramaticHealthBarPosition')}`;
	return element;
}

function applyBarEffect(panel, isDamage) {
	const track = panel.querySelector('.dhb-bar-track');
	if (!track) return;

	track.classList.remove('dhb-bar-track-damage', 'dhb-bar-track-heal');
	void track.offsetWidth;
	track.classList.add(isDamage ? 'dhb-bar-track-damage' : 'dhb-bar-track-heal');
}

function buildPanel(actor, oldPct, newPct, newHp, maxHp, delta, showNumbers) {
	const isDamage = delta < 0;
	const sign = isDamage ? '' : '+';
	const portrait = actor.img || 'icons/svg/mystery-man.svg';
	const numStyle = showNumbers ? '' : ' style="display:none"';

	const element = document.createElement('div');
	element.className = `dhb-panel ${isDamage ? 'dhb-is-damage' : 'dhb-is-heal'}`;
	element.dataset.aid = actor.id;
	element.innerHTML = `
		<div class="dhb-portrait">
			<img src="${portrait}" alt="" />
			<div class="dhb-portrait-flash"></div>
		</div>
		<div class="dhb-info">
			<div class="dhb-name">${actor.name}</div>
			<div class="dhb-bar-track">
				<div class="dhb-bar-ghost" style="width:${oldPct * 100}%"></div>
				<div class="dhb-bar-fill ${dhdHpClass(oldPct)}" style="width:${oldPct * 100}%"></div>
			</div>
			<div class="dhb-hp-text"${numStyle}>
				${newHp} <span class="dhb-hp-sep">/</span> ${maxHp}
			</div>
		</div>
		<div class="dhb-delta ${isDamage ? 'dhb-delta-damage' : 'dhb-delta-heal'}"${numStyle}>
			${sign}${delta}
		</div>
	`;

	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			const fill = element.querySelector('.dhb-bar-fill');
			if (!fill) return;
			fill.style.transition = `width ${BAR_MOVE_MS}ms cubic-bezier(0.4,0,0.2,1), background-color 0.4s ease`;
			fill.style.width = `${newPct * 100}%`;
			fill.className = `dhb-bar-fill ${dhdHpClass(newPct)}`;
			applyBarEffect(element, isDamage);
		});
	});

	return element;
}

function scheduleDismiss(actorId) {
	const entry = activePanels.get(actorId);
	if (!entry) return;
	clearTimeout(entry.timeoutId);
	entry.timeoutId = setTimeout(() => dismissPanel(actorId), SHOW_MS);
}

function dismissPanel(actorId) {
	const entry = activePanels.get(actorId);
	if (!entry) return;
	entry.element.classList.add('dhb-exiting');
	setTimeout(() => {
		entry.element.remove();
		activePanels.delete(actorId);
		const container = document.getElementById('dhb-container');
		if (container && !container.hasChildNodes()) container.remove();
	}, FADE_MS);
}

function showHealthBar(actor, oldHp, newHp, maxHp) {
	const delta = newHp - oldHp;
	if (delta === 0) return;

	const safeMax = maxHp > 0 ? maxHp : 1;
	const minPct = (game.settings.get(MODULE_ID, 'dramaticHealthMinChangePercent') || 0) / 100;
	if (minPct > 0 && Math.abs(delta) / safeMax < minPct) {
		dhdLog(`[${actor.name}] Change of ${delta} is below ${minPct * 100}% threshold; skipping.`);
		return;
	}

	const oldPct = Math.max(0, Math.min(1, oldHp / safeMax));
	const newPct = Math.max(0, Math.min(1, newHp / safeMax));
	const isDamage = delta < 0;
	const showNumbers = game.settings.get(MODULE_ID, 'dramaticHealthShowNumbers');
	const container = getContainer();

	if (activePanels.has(actor.id)) {
		const entry = activePanels.get(actor.id);
		const panel = entry.element;
		const sign = isDamage ? '' : '+';

		panel.className = `dhb-panel ${isDamage ? 'dhb-is-damage' : 'dhb-is-heal'}`;

		const fill = panel.querySelector('.dhb-bar-fill');
		const ghost = panel.querySelector('.dhb-bar-ghost');
		if (fill && ghost) {
			const fromPct = entry.currentPct;
			ghost.style.width = `${fromPct * 100}%`;
			fill.style.transition = 'none';
			fill.style.width = `${fromPct * 100}%`;
			void fill.offsetWidth;
			fill.style.transition = `width ${BAR_MOVE_MS}ms cubic-bezier(0.4,0,0.2,1), background-color 0.4s ease`;
			fill.style.width = `${newPct * 100}%`;
			fill.className = `dhb-bar-fill ${dhdHpClass(newPct)}`;
		}
		applyBarEffect(panel, isDamage);

		const hpText = panel.querySelector('.dhb-hp-text');
		if (hpText) {
			hpText.style.display = showNumbers ? '' : 'none';
			if (showNumbers) hpText.innerHTML = `${newHp} <span class="dhb-hp-sep">/</span> ${maxHp}`;
		}

		const deltaEl = panel.querySelector('.dhb-delta');
		if (deltaEl) {
			deltaEl.style.display = showNumbers ? '' : 'none';
			if (showNumbers) {
				deltaEl.textContent = `${sign}${delta}`;
				deltaEl.className = `dhb-delta ${isDamage ? 'dhb-delta-damage' : 'dhb-delta-heal'}`;
				deltaEl.style.animation = 'none';
				void deltaEl.offsetWidth;
				deltaEl.style.animation = '';
			}
		}

		const flash = panel.querySelector('.dhb-portrait-flash');
		if (flash) {
			flash.style.animation = 'none';
			void flash.offsetWidth;
			flash.style.animation = '';
		}

		entry.currentPct = newPct;
	} else {
		const panel = buildPanel(actor, oldPct, newPct, newHp, maxHp, delta, showNumbers);
		container.appendChild(panel);
		activePanels.set(actor.id, { element: panel, timeoutId: null, currentPct: newPct });
	}

	scheduleDismiss(actor.id);

	if (isDamage) maybePlayDamageSound();
	else maybePlayHealSound();

	dhdLog(`[${actor.name}] ${oldHp} -> ${newHp} (${delta > 0 ? '+' : ''}${delta}) | ${Math.round(newPct * 100)}%`);
}

Hooks.once('init', () => {
	game.settings.register(MODULE_ID, 'dramaticHealthBarPosition', {
		name: 'Health Bar Position',
		hint: 'Where on screen the animated health bars appear.',
		scope: 'client',
		config: true,
		type: String,
		choices: {
			'bottom-center': 'Bottom Center',
			'bottom-left': 'Bottom Left',
			'bottom-right': 'Bottom Right',
		},
		default: 'bottom-center',
	});

	game.settings.register(MODULE_ID, 'dramaticHealthShowNumbers', {
		name: 'Show Number Change',
		hint: 'Display the HP delta and current HP values on the health bar. Uncheck to show only the bar graphic.',
		scope: 'world',
		config: true,
		type: Boolean,
		default: true,
	});

	game.settings.register(MODULE_ID, 'dramaticHealthShowAlways', {
		name: 'Show For Everyone',
		hint: 'Show health bar overlays to all connected players regardless of token bar visibility permissions.',
		scope: 'world',
		config: true,
		type: Boolean,
		default: false,
	});

	game.settings.register(MODULE_ID, 'dramaticHealthMinChangePercent', {
		name: 'Minimum Change % to Show',
		hint: 'Only show the overlay when the HP change is at least this percentage of max HP. 0 shows all changes.',
		scope: 'world',
		config: true,
		type: Number,
		range: { min: 0, max: 100, step: 1 },
		default: 0,
	});

	game.settings.register(MODULE_ID, 'dramaticHealthDebugMode', {
		name: 'Debug Logging',
		hint: 'Print health bar activity to the browser console.',
		scope: 'client',
		config: true,
		type: Boolean,
		default: false,
	});

	const hidden = { scope: 'client', config: false };
	game.settings.register(MODULE_ID, 'dramaticHealthEnableSounds', { ...hidden, type: Boolean, default: false });
	game.settings.register(MODULE_ID, 'dramaticHealthDamageSound', { ...hidden, type: String, default: '' });
	game.settings.register(MODULE_ID, 'dramaticHealthHealSound', { ...hidden, type: String, default: '' });
	game.settings.register(MODULE_ID, 'dramaticHealthSoundVolume', { ...hidden, type: Number, default: 0.7 });

	game.settings.registerMenu(MODULE_ID, 'dramaticHealthSoundConfig', {
		name: 'Dramatic Health Sounds',
		label: 'Configure Sounds',
		hint: 'Choose audio files to play on damage and healing for this player.',
		icon: 'fas fa-heart-pulse',
		type: DramaticHealthSoundConfig,
		restricted: false,
	});
});

Hooks.once('ready', async () => {
	await loadTemplates([`modules/${MODULE_ID}/templates/dramatic-health-sound-config.hbs`]);

	for (const actor of game.actors) {
		const hp = actor.system?.attributes?.hp;
		if (hp !== undefined) hpCache.set(actor.id, { value: hp.value ?? 0, max: hp.max ?? 1 });
	}
	dhdLog(`HP cache seeded with ${hpCache.size} actors.`);
});

Hooks.on('updateActor', (actor, changes) => {
	const newVal = foundry.utils.getProperty(changes, 'system.attributes.hp.value');
	if (newVal === undefined) return;

	const cached = hpCache.get(actor.id);
	const oldVal = cached?.value ?? actor.system?.attributes?.hp?.value ?? 0;
	const maxHp = actor.system?.attributes?.hp?.max ?? cached?.max ?? 1;
	hpCache.set(actor.id, { value: newVal, max: maxHp });

	const showAlways = game.settings.get(MODULE_ID, 'dramaticHealthShowAlways');
	if (!showAlways) {
		const tokens = sceneTokensFor(actor);
		const shouldShow = game.user.isGM || tokens.some(userCanSeeBar);
		if (!shouldShow) {
			dhdLog(`[${actor.name}] HP changed but the bar is not visible to this user; skipping.`);
			return;
		}
	}

	showHealthBar(actor, oldVal, newVal, maxHp);
});

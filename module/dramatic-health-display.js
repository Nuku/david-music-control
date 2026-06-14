import { MODULE_ID } from './settings.js';

const SHOW_MS = 3800;
const FADE_MS = 580;
const BAR_MOVE_MS = 850;

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

function setFillWidth(fill, pct) {
	fill.style.width = `${Math.max(pct, 0.01) * 100}%`;
}

function animateBarFill(fill, fromPct, toPct) {
	fill.className = `dhb-bar-fill ${dhdHpClass(fromPct)}`;
	fill.style.transition = 'none';
	setFillWidth(fill, fromPct);
	void fill.getBoundingClientRect();
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			fill.style.transition = `width ${BAR_MOVE_MS}ms cubic-bezier(0.22, 1, 0.36, 1), background-color 0.35s ease`;
			fill.className = `dhb-bar-fill ${dhdHpClass(toPct)}`;
			setFillWidth(fill, toPct);
		});
	});
}

function buildPanel(actor, oldPct, newPct, delta) {
	const isDamage = delta < 0;

	const element = document.createElement('div');
	element.className = `dhb-panel ${isDamage ? 'dhb-is-damage' : 'dhb-is-heal'}`;
	element.dataset.aid = actor.id;
	element.innerHTML = `
			<div class="dhb-bar-track">
				<div class="dhb-bar-fill ${dhdHpClass(oldPct)}" style="width:${oldPct * 100}%"></div>
			</div>
	`;

	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			const fill = element.querySelector('.dhb-bar-fill');
			if (!fill) return;
			animateBarFill(fill, oldPct, newPct);
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
	const container = getContainer();

	if (activePanels.has(actor.id)) {
		const entry = activePanels.get(actor.id);
		const panel = entry.element;

		panel.className = `dhb-panel ${isDamage ? 'dhb-is-damage' : 'dhb-is-heal'}`;

		const fill = panel.querySelector('.dhb-bar-fill');
		if (fill) {
			const fromPct = entry.currentPct;
			animateBarFill(fill, fromPct, newPct);
		}
		applyBarEffect(panel, isDamage);

		entry.currentPct = newPct;
	} else {
		const panel = buildPanel(actor, oldPct, newPct, delta);
		container.appendChild(panel);
		activePanels.set(actor.id, { element: panel, timeoutId: null, currentPct: newPct });
	}

	scheduleDismiss(actor.id);

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
		hint: 'Internal setting retained for compatibility.',
		scope: 'world',
		config: false,
		type: Boolean,
		default: false,
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

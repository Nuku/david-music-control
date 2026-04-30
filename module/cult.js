import { MODULE_ID, getSetting } from './settings.js';

const CULT_FLAG = 'cult';
const CULT_TAB = 'dmc-cult';
const LEVEL_MODIFIERS = {
	1: 5,
	2: 6,
	3: 8,
	4: 9,
	5: 10,
	6: 12,
	7: 13,
	8: 14,
	9: 16,
	10: 17,
	11: 18,
	12: 20,
	13: 21,
	14: 22,
	15: 24,
	16: 25,
	17: 26,
	18: 28,
	19: 29,
	20: 30,
};
const FERVOR_RANKS = [
	{ rank: 'Apathetic', min: 0, max: 2, checkDc: 1, bonus: -2 },
	{ rank: 'Observant', min: 3, max: 4, checkDc: 0, bonus: -1 },
	{ rank: 'Inspired', min: 5, max: 7, checkDc: 0, bonus: 0 },
	{ rank: 'Reverent', min: 8, max: 9, checkDc: 0, bonus: 1 },
	{ rank: 'Fanatical', min: 10, max: Infinity, checkDc: 1, bonus: 2 },
];
const SIZE_RANKS = [
	{ rank: 'Small', membership: 'dozens or fewer', modifier: 1, min: 1, max: 9 },
	{ rank: 'Medium', membership: 'dozens', modifier: 2, min: 10, max: 29 },
	{ rank: 'Large', membership: 'hundreds', modifier: 3, min: 30, max: 59 },
	{ rank: 'Huge', membership: 'thousands', modifier: 4, min: 60, max: 99 },
	{ rank: 'Gargantuan', membership: 'tens of thousands', modifier: 5, min: 100, max: Infinity },
];
const CULT_EVENTS = [
	{
		name: 'False Gods',
		range: '0 or less',
		min: -Infinity,
		max: 0,
		summary: 'Followers conclude the pantheon consists of charlatans. A moderate combat encounter occurs this phase; afterward, the cult loses 1d10 RP.',
		actions: [{ action: 'roll-rp-loss', label: 'Roll 1d10 RP Loss', formula: '1d10', field: 'recruitmentPoints' }],
	},
	{
		name: 'Infectious Nihilism',
		range: '1',
		min: 1,
		max: 1,
		summary: 'During this phase, flat-check failures are treated as critical failures.',
	},
	{
		name: 'Empty Pews',
		range: '2-3',
		min: 2,
		max: 3,
		summary: 'When the cult earns FP or RP this phase, it earns 1 extra. At phase end, it loses 1d6 FP and 1d6 RP.',
		actions: [{ action: 'roll-empty-pews', label: 'Roll Phase-End Losses' }],
	},
	{
		name: 'Persistent Petitions',
		range: '4-5',
		min: 4,
		max: 5,
		summary: 'A random PC hears prayers equal to the cult Size modifier. Each unanswered prayer costs 1d4 FP at phase end.',
		actions: [{ action: 'set-prayers', label: 'Set Prayer Count' }],
	},
	{
		name: 'Business as Usual',
		range: '6-7',
		min: 6,
		max: 7,
		summary: 'No special event or conditions apply this phase.',
	},
	{
		name: 'Cult Rivalry',
		range: '8-9',
		min: 8,
		max: 9,
		summary: 'A rival cult interferes. At phase end, it attempts a DC 9 flat check, modified by Assist the Pantheon results.',
	},
	{
		name: 'Wave of Evangelism',
		range: '10-11',
		min: 10,
		max: 11,
		summary: 'During this phase, success when Recruiting Adherents is treated as a critical success.',
	},
	{
		name: 'Zealous Schism',
		range: '12',
		min: 12,
		max: 12,
		summary: 'Teach Doctrine DCs increase by 2. Any d4 rolled for maximum FP change is treated as 4. A critical failure costs half the cult RP at phase end.',
	},
	{
		name: 'Cult Collaboration',
		range: '13',
		min: 13,
		max: 13,
		summary: 'During this phase, success when Creating Wonders is treated as a critical success.',
	},
	{
		name: 'Divine Renaissance',
		range: '14 or more',
		min: 14,
		max: Infinity,
		summary: 'Increase the number of cult activities the cult can perform during this phase by 2.',
		actions: [{ action: 'add-activity-bonus', label: 'Apply +2 Activities' }],
	},
];

function getDefaultCultData(actor) {
	return {
		name: `${actor.name} Cult`,
		level: actor.level ?? 1,
		fervorPoints: 5,
		recruitmentPoints: 1,
		mythicPoints: 0,
		agenda: '',
		mantles: '',
		activities: '',
		notes: '',
		gmNotes: '',
		activityBonus: 0,
		pendingPrayers: 0,
		currentEvent: null,
	};
}

function getCultData(actor) {
	return { ...getDefaultCultData(actor), ...(actor.getFlag(MODULE_ID, CULT_FLAG) ?? {}) };
}

function getCultStats(data) {
	const level = clampNumber(data.level, 1, 20);
	const recruitmentPoints = Math.max(0, Number(data.recruitmentPoints) || 0);
	const fervorPoints = Math.max(0, Number(data.fervorPoints) || 0);
	const size = SIZE_RANKS.find((rank) => recruitmentPoints >= rank.min && recruitmentPoints <= rank.max) ?? {
		rank: 'Failed',
		membership: 'none',
		modifier: 1,
	};
	const fervorRatio = Math.floor(fervorPoints / size.modifier);
	const fervor = FERVOR_RANKS.find((rank) => fervorRatio >= rank.min && fervorRatio <= rank.max) ?? FERVOR_RANKS[0];
	const levelModifier = LEVEL_MODIFIERS[level] ?? LEVEL_MODIFIERS[1];
	const totalModifier = levelModifier + fervor.bonus;
	const maxMythicPoints = Math.max(3, size.modifier);

	return {
		level,
		levelModifier,
		totalModifier,
		size,
		fervor,
		fervorRatio,
		maxMythicPoints,
		activityCount: Math.max(1, size.modifier + (Number(data.activityBonus) || 0)),
		inCrisis: fervorPoints === 0 || recruitmentPoints === 0,
	};
}

function clampNumber(value, min, max) {
	return Math.min(max, Math.max(min, Number(value) || min));
}

function renderCultSheet(app, html) {
	if (!getSetting('enableCultSystem')) return;

	const actor = app.actor ?? app.document;
	if (actor?.type !== 'party') return;

	const root = html instanceof HTMLElement ? html : html?.[0];
	if (!root || root.querySelector('[data-dmc-cult-root]')) return;

	const data = getCultData(actor);
	const stats = getCultStats(data);
	const isGM = game.user.isGM;
	const previewAsPlayer = !!app._dmcCultPreviewAsPlayer;
	const tab = buildCultTab(actor, data, stats, isGM, previewAsPlayer);

	injectCultTab(app, root, tab);
	activateCultControls(app, root, actor, isGM);
}

function injectCultTab(app, root, tab) {
	const nav = findTabNav(root);
	const contentContainer = findTabContentContainer(root);

	if (!nav || !contentContainer) {
		tab.content.hidden = false;
		tab.content.classList.add('active');
		root.append(tab.content);
		return;
	}

	nav.append(tab.nav);
	contentContainer.append(tab.content);
	tab.nav.addEventListener('click', (event) => {
		event.preventDefault();
		app._dmcCultActive = true;
		activateTab(root, tab.nav, tab.content);
	});
	nav.querySelectorAll('[data-tab]').forEach((navItem) => {
		if (navItem === tab.nav) return;
		navItem.addEventListener('click', () => {
			app._dmcCultActive = false;
			tab.nav.classList.remove('active');
			tab.content.classList.remove('active');
			tab.content.hidden = true;
		});
	});

	if (app._dmcCultActive) activateTab(root, tab.nav, tab.content);
}

function findTabNav(root) {
	const navs = Array.from(root.querySelectorAll('nav, .tabs, .sheet-tabs'));
	return navs.find((nav) => nav.querySelector('[data-tab]')) ?? null;
}

function findTabContentContainer(root) {
	const panes = Array.from(root.querySelectorAll('[data-tab]')).filter((element) => !element.matches('a, button'));
	const activePane = panes.find((pane) => pane.classList.contains('active')) ?? panes[0];
	return activePane?.parentElement ?? null;
}

function activateTab(root, navItem, content) {
	const tabName = navItem.dataset.tab;
	const nav = navItem.parentElement;
	nav?.querySelectorAll('[data-tab]').forEach((item) => item.classList.toggle('active', item === navItem));

	const container = content.parentElement;
	container?.querySelectorAll('[data-tab]').forEach((pane) => {
		if (pane.matches('a, button')) return;
		const active = pane.dataset.tab === tabName;
		pane.classList.toggle('active', active);
		pane.hidden = !active;
	});
}

function buildCultTab(actor, data, stats, isGM, previewAsPlayer) {
	const canEdit = isGM && !previewAsPlayer;
	const disabled = canEdit ? '' : 'disabled';
	const readonly = canEdit ? '' : 'readonly';
	const nav = document.createElement('a');
	nav.dataset.tab = CULT_TAB;
	nav.className = 'item';
	nav.innerHTML = '<i class="fas fa-eye"></i> Cult';

	const content = document.createElement('section');
	content.dataset.tab = CULT_TAB;
	content.dataset.dmcCultRoot = 'true';
	content.className = 'tab dmc-cult-tab';
	content.hidden = true;
	content.innerHTML = `
		<div class="dmc-cult-header">
			${canEdit
				? `<label class="dmc-cult-name-edit">
					<span>Cult Name</span>
					<input type="text" name="name" value="${escapeHtml(data.name)}">
				</label>`
				: `<div class="dmc-cult-name-display">
					<span>Cult Name</span>
					<strong>${escapeHtml(data.name)}</strong>
				</div>`
			}
			<div class="dmc-cult-actions">
				${isGM ? `<button type="button" data-action="toggle-player-preview"><i class="fas fa-user"></i> ${previewAsPlayer ? 'GM View' : 'Player View'}</button>` : ''}
				<button type="button" data-action="cult-roll" title="Roll Cult Level Check">
					<i class="fas fa-dice-d20"></i>
					<span>${formatModifier(stats.totalModifier)}</span>
				</button>
			</div>
		</div>
		<div class="dmc-cult-layout">
			<div class="dmc-cult-main">
				<div class="dmc-cult-stats">
					${statCard('Level', buildLevelControl(data.level, stats, canEdit))}
					${statCard('Fervor', `${stats.fervor.rank}<small>${data.fervorPoints} FP / size ${stats.size.modifier}</small>`)}
					${statCard('Size', `${stats.size.rank}<small>${data.recruitmentPoints} RP, ${stats.size.membership}</small>`)}
					${statCard('Mythic Points', `${Number(data.mythicPoints) || 0} / ${stats.maxMythicPoints}`)}
					${statCard('Activities', `${stats.activityCount}<small>${stats.size.modifier} base${Number(data.activityBonus) ? `, ${formatModifier(Number(data.activityBonus))} event` : ''}</small>`)}
					${statCard('Control DC Adj.', `${formatModifier(stats.size.modifier + stats.fervor.checkDc)}<small>size + fervor</small>`)}
				</div>
				<div class="dmc-cult-edit-grid">
					<label>
						<span>Fervor Points</span>
						<input type="number" name="fervorPoints" min="0" value="${Number(data.fervorPoints) || 0}" ${disabled}>
					</label>
					<label>
						<span>Recruitment Points</span>
						<input type="number" name="recruitmentPoints" min="0" value="${Number(data.recruitmentPoints) || 0}" ${disabled}>
					</label>
					<label>
						<span>Mythic Points</span>
						<input type="number" name="mythicPoints" min="0" max="${stats.maxMythicPoints}" value="${Number(data.mythicPoints) || 0}" ${disabled}>
					</label>
					<label>
						<span>Activity Bonus</span>
						<input type="number" name="activityBonus" value="${Number(data.activityBonus) || 0}" ${disabled}>
					</label>
					<label>
						<span>Pending Prayers</span>
						<input type="number" name="pendingPrayers" min="0" value="${Number(data.pendingPrayers) || 0}" ${disabled}>
					</label>
				</div>
				<div class="dmc-cult-notes">
					${textArea('Agenda', 'agenda', data.agenda, readonly)}
					${textArea('Mantles', 'mantles', data.mantles, readonly)}
					${textArea('Activities', 'activities', data.activities, readonly)}
					${textArea('Notes', 'notes', data.notes, readonly)}
					${canEdit ? textArea('GM Notes', 'gmNotes', data.gmNotes, '') : ''}
				</div>
			</div>
			${isGM && !previewAsPlayer ? buildEventsPanel(data, stats, canEdit) : ''}
		</div>
		${stats.inCrisis ? '<p class="dmc-cult-warning"><i class="fas fa-triangle-exclamation"></i> Cult in crisis: FP or RP is 0.</p>' : ''}
	`;
	content.dataset.actorId = actor.id;
	return { nav, content };
}

function buildEventsPanel(data, stats, canEdit) {
	const event = data.currentEvent?.name ? data.currentEvent : null;
	return `
		<aside class="dmc-cult-events">
			<header>
				<h3>Events</h3>
				<button type="button" data-action="roll-cult-event" ${canEdit ? '' : 'disabled'}>
					<i class="fas fa-dice"></i> Roll Event
				</button>
			</header>
			<p class="dmc-cult-event-mod">Event modifier: ${formatModifier(stats.fervor.bonus)} from ${stats.fervor.rank} fervor.</p>
			${event
				? `<div class="dmc-cult-event-current">
					<strong>${escapeHtml(event.name)}</strong>
					<span>Result ${event.total} (${event.roll} ${formatModifier(event.modifier)})</span>
					<p>${escapeHtml(event.summary)}</p>
					<div class="dmc-cult-event-buttons">${buildEventButtons(event, canEdit)}</div>
				</div>`
				: '<p>No cult event rolled for this phase.</p>'
			}
		</aside>
	`;
}

function buildEventButtons(event, canEdit) {
	const definition = CULT_EVENTS.find((candidate) => candidate.name === event.name);
	const buttons = definition?.actions ?? [];
	if (!buttons.length) return '<small>No automatic effect buttons for this event.</small>';
	return buttons.map((button) => `
		<button type="button" data-action="${button.action}" ${canEdit ? '' : 'disabled'}>
			${escapeHtml(button.label)}
		</button>
	`).join('');
}

function statCard(label, value) {
	return `
		<div class="dmc-cult-stat">
			<span>${label}</span>
			<strong>${value}</strong>
		</div>
	`;
}

function buildLevelControl(level, stats, canEdit) {
	const input = canEdit
		? `<input type="number" name="level" min="1" max="20" value="${stats.level}">`
		: `<button type="button" data-action="cult-roll" class="dmc-cult-level-roll">${stats.level}</button>`;
	return `
		<div class="dmc-cult-level">
			${input}
			<button type="button" data-action="cult-roll" title="Roll Cult Level Check">
				<i class="fas fa-dice-d20"></i>
			</button>
		</div>
		<small>${formatModifier(stats.levelModifier)} level, ${formatModifier(stats.fervor.bonus)} fervor</small>
	`;
}

function textArea(label, name, value, readonly) {
	return `
		<label class="dmc-cult-text">
			<span>${label}</span>
			<textarea name="${name}" rows="3" ${readonly}>${escapeHtml(value ?? '')}</textarea>
		</label>
	`;
}

function activateCultControls(app, root, actor, isGM) {
	root.querySelectorAll('[data-action="cult-roll"]').forEach((button) => {
		button.addEventListener('click', () => rollCultLevelCheck(actor));
	});

	root.querySelector('[data-action="toggle-player-preview"]')?.addEventListener('click', () => {
		app._dmcCultActive = true;
		app._dmcCultPreviewAsPlayer = !app._dmcCultPreviewAsPlayer;
		app.render(true);
	});

	if (!isGM) return;
	root.querySelectorAll('[data-dmc-cult-root] input, [data-dmc-cult-root] textarea').forEach((input) => {
		input.addEventListener('change', () => updateCultData(app, actor, root));
	});
	root.querySelector('[data-action="roll-cult-event"]')?.addEventListener('click', () => rollCultEvent(app, actor));
	root.querySelector('[data-action="add-activity-bonus"]')?.addEventListener('click', () => applyCultData(app, actor, { activityBonus: 2 }));
	root.querySelector('[data-action="set-prayers"]')?.addEventListener('click', () => {
		const stats = getCultStats(getCultData(actor));
		return applyCultData(app, actor, { pendingPrayers: stats.size.modifier });
	});
	root.querySelector('[data-action="roll-rp-loss"]')?.addEventListener('click', () => rollAndApplyLoss(app, actor, '1d10', 'recruitmentPoints', 'False Gods RP Loss'));
	root.querySelector('[data-action="roll-empty-pews"]')?.addEventListener('click', () => rollEmptyPewsLoss(app, actor));
}

async function updateCultData(app, actor, root) {
	const panel = root.querySelector('[data-dmc-cult-root]');
	if (!panel) return;

	const data = {};
	for (const input of panel.querySelectorAll('input[name], textarea[name]')) {
		const value = input.type === 'number' ? Number(input.value) || 0 : input.value;
		data[input.name] = value;
	}

	app._dmcCultActive = true;
	await actor.setFlag(MODULE_ID, CULT_FLAG, { ...getCultData(actor), ...data });
}

async function applyCultData(app, actor, updates) {
	app._dmcCultActive = true;
	await actor.setFlag(MODULE_ID, CULT_FLAG, { ...getCultData(actor), ...updates });
}

async function rollCultEvent(app, actor) {
	const data = getCultData(actor);
	const stats = getCultStats(data);
	const roll = await new Roll('2d6').evaluate({ async: true });
	const diceTotal = roll.total;
	const total = diceTotal + stats.fervor.bonus;
	const event = CULT_EVENTS.find((candidate) => total >= candidate.min && total <= candidate.max);
	const currentEvent = {
		name: event.name,
		roll: diceTotal,
		modifier: stats.fervor.bonus,
		total,
		summary: event.summary,
	};

	await roll.toMessage({
		speaker: ChatMessage.getSpeaker({ actor }),
		flavor: `${data.name} Cult Event: ${event.name} (${diceTotal} ${formatModifier(stats.fervor.bonus)} = ${total})`,
	});
	await applyCultData(app, actor, { currentEvent });
}

async function rollAndApplyLoss(app, actor, formula, field, label) {
	const roll = await new Roll(formula).evaluate({ async: true });
	const data = getCultData(actor);
	const nextValue = Math.max(0, (Number(data[field]) || 0) - roll.total);
	await roll.toMessage({
		speaker: ChatMessage.getSpeaker({ actor }),
		flavor: `${data.name}: ${label}`,
	});
	await applyCultData(app, actor, { [field]: nextValue });
}

async function rollEmptyPewsLoss(app, actor) {
	const fpRoll = await new Roll('1d6').evaluate({ async: true });
	const rpRoll = await new Roll('1d6').evaluate({ async: true });
	const data = getCultData(actor);
	await fpRoll.toMessage({
		speaker: ChatMessage.getSpeaker({ actor }),
		flavor: `${data.name}: Empty Pews FP Loss`,
	});
	await rpRoll.toMessage({
		speaker: ChatMessage.getSpeaker({ actor }),
		flavor: `${data.name}: Empty Pews RP Loss`,
	});
	await applyCultData(app, actor, {
		fervorPoints: Math.max(0, (Number(data.fervorPoints) || 0) - fpRoll.total),
		recruitmentPoints: Math.max(0, (Number(data.recruitmentPoints) || 0) - rpRoll.total),
	});
}

async function rollCultLevelCheck(actor) {
	const data = getCultData(actor);
	const stats = getCultStats(data);
	const formula = `1d20 + ${stats.levelModifier} + ${stats.fervor.bonus}`;
	const flavor = `${data.name} Cult Level Check (${formatModifier(stats.levelModifier)} level, ${formatModifier(stats.fervor.bonus)} fervor)`;
	await new Roll(formula).toMessage({
		speaker: ChatMessage.getSpeaker({ actor }),
		flavor,
	});
}

function formatModifier(value) {
	return value >= 0 ? `+${value}` : `${value}`;
}

function escapeHtml(value) {
	const element = document.createElement('textarea');
	element.textContent = String(value ?? '');
	return element.innerHTML;
}

Hooks.on('renderActorSheet', renderCultSheet);
Hooks.on('renderPartySheetPF2e', renderCultSheet);

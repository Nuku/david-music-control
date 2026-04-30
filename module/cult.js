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
		activityCount: Math.max(1, size.modifier),
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
	const tab = buildCultTab(actor, data, stats, isGM);

	injectCultTab(root, tab);
	activateCultControls(root, actor, isGM);
}

function injectCultTab(root, tab) {
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
		activateTab(root, tab.nav, tab.content);
	});
	nav.querySelectorAll('[data-tab]').forEach((navItem) => {
		if (navItem === tab.nav) return;
		navItem.addEventListener('click', () => {
			tab.nav.classList.remove('active');
			tab.content.classList.remove('active');
			tab.content.hidden = true;
		});
	});
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

function buildCultTab(actor, data, stats, isGM) {
	const disabled = isGM ? '' : 'disabled';
	const readonly = isGM ? '' : 'readonly';
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
			<label>
				<span>Cult Name</span>
				<input type="text" name="name" value="${escapeHtml(data.name)}" ${readonly}>
			</label>
			<button type="button" data-action="cult-roll" title="Roll Cult Level Check">
				<i class="fas fa-dice-d20"></i>
				<span>${formatModifier(stats.totalModifier)}</span>
			</button>
		</div>
		<div class="dmc-cult-stats">
			${statCard('Level', buildLevelControl(data.level, stats, isGM))}
			${statCard('Fervor', `${stats.fervor.rank}<small>${data.fervorPoints} FP / size ${stats.size.modifier}</small>`)}
			${statCard('Size', `${stats.size.rank}<small>${data.recruitmentPoints} RP, ${stats.size.membership}</small>`)}
			${statCard('Mythic Points', `${Number(data.mythicPoints) || 0} / ${stats.maxMythicPoints}`)}
			${statCard('Activities', `${stats.activityCount}<small>per cult phase</small>`)}
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
		</div>
		${textArea('Agenda', 'agenda', data.agenda, readonly)}
		${textArea('Mantles', 'mantles', data.mantles, readonly)}
		${textArea('Activities', 'activities', data.activities, readonly)}
		${textArea('Notes', 'notes', data.notes, readonly)}
		${isGM ? textArea('GM Notes', 'gmNotes', data.gmNotes, '') : ''}
		${stats.inCrisis ? '<p class="dmc-cult-warning"><i class="fas fa-triangle-exclamation"></i> Cult in crisis: FP or RP is 0.</p>' : ''}
	`;
	content.dataset.actorId = actor.id;
	return { nav, content };
}

function statCard(label, value) {
	return `
		<div class="dmc-cult-stat">
			<span>${label}</span>
			<strong>${value}</strong>
		</div>
	`;
}

function buildLevelControl(level, stats, isGM) {
	const input = isGM
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

function activateCultControls(root, actor, isGM) {
	root.querySelectorAll('[data-action="cult-roll"]').forEach((button) => {
		button.addEventListener('click', () => rollCultLevelCheck(actor));
	});

	if (!isGM) return;
	root.querySelectorAll('[data-dmc-cult-root] input, [data-dmc-cult-root] textarea').forEach((input) => {
		input.addEventListener('change', () => updateCultData(actor, root));
	});
}

async function updateCultData(actor, root) {
	const panel = root.querySelector('[data-dmc-cult-root]');
	if (!panel) return;

	const data = {};
	for (const input of panel.querySelectorAll('input[name], textarea[name]')) {
		const value = input.type === 'number' ? Number(input.value) || 0 : input.value;
		data[input.name] = value;
	}

	await actor.setFlag(MODULE_ID, CULT_FLAG, data);
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

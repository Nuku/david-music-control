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
const STANDARD_DCS_BY_LEVEL = {
	1: 15,
	2: 16,
	3: 18,
	4: 19,
	5: 20,
	6: 22,
	7: 23,
	8: 24,
	9: 26,
	10: 27,
	11: 28,
	12: 30,
	13: 31,
	14: 32,
	15: 34,
	16: 35,
	17: 36,
	18: 38,
	19: 39,
	20: 40,
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
const MANTLES = {
	creator: {
		name: 'Creator',
		benefit: 'When Creating Wonders, the cult\'s proficiency when calculating progress becomes expert at 1st level, master at 7th level, and legendary at 15th level.',
		miracles: 'Create a permanent item, stage an extraordinary performance, invent something precious to future generations.',
	},
	leader: {
		name: 'Leader',
		benefit: 'The cult can reroll any die result of 1 on a d4 when calculating Recruitment Points gained from Recruit Adherents. The cult must use the second result.',
		miracles: 'Ally with a powerful being, inspire others through courage, achieve a political marvel.',
	},
	mentor: {
		name: 'Mentor',
		benefit: 'The cult can reroll any one die, using either result, to randomly determine Fervor Points gained or lost by Teach Doctrine.',
		miracles: 'Adopt an unlikely student whose legendary potential you help unlock, lead others in a cunning plan, share knowledge that changes the odds or perspective.',
	},
	mystic: {
		name: 'Mystic',
		benefit: 'Once per phase, a mystic can increase the die result of one d4 roll by 1, maximum 4, when calculating Mythic Points gained by Overseeing Rites.',
		miracles: 'Perform a potent ritual, unravel an enigma, create a way to tap into an esoteric source of power.',
	},
	rebel: {
		name: 'Rebel',
		benefit: 'When rolling for a random event, roll twice, choose one event, and ignore the other. If the pantheon cannot agree, the rebel chooses. If both rolls are the same event, roll a third event; both the original and third events occur.',
		miracles: 'Challenge tradition, subvert expected heroic tropes, complicate a situation in a way that still ends in your success.',
	},
	warrior: {
		name: 'Warrior',
		benefit: 'The cult can Assist the Pantheon one additional time per cult phase. In addition, the cult loses the minimum FP on a critical failure to Assist the Pantheon.',
		miracles: 'Stand strong against a terrible foe, accept a dangerous challenge, exceed your limits to overcome a daunting obstacle.',
	},
};
const CULT_ACTIVITIES = [
	{
		key: 'assist-pantheon',
		name: 'Assist Pantheon',
		description: 'The cult helps the pantheon with a defined task at the edges of the adventure.',
		text: [
			'Requirements: The cult\'s Fervor isn\'t apathetic.',
			'The cult is tasked with directly helping the pantheon with a task, such as investigating an organization, recovering a rare book, exploring a region, or thwarting a specific foe. This usually doesn\'t involve the adherents fighting alongside the PCs or following them in a massive pack; instead, adherents might report to the PCs with useful leads, prepare potential battlefields in a way that favors their patrons, fire arrows that distract a beast, leave a pilfered key where the PCs can find it, or provide similar assistance at the adventure\'s periphery.',
			'The pantheon defines the task, working with the GM to refine it if need be. The cult attempts a check against a standard DC of the PCs\' level.',
			'Critical Success: As success, but the cult grants a +2 circumstance bonus to the triggering checks. This increases to +3 if the cult\'s level is 7 or higher, and it increases to +4 if the cult\'s level is 15 or higher.',
			'Success: Adherents disperse to assist the pantheon in its upcoming endeavors. The PCs can invoke the cult up to three times while pursuing the task; the cult Aids the PC, granting the PC a +1 circumstance bonus to the triggering check before rolling. The number of times the PCs can gain this Aid increases to four times if the cult is Medium or Large, and it increases to five times if the cult is Huge or Gargantuan.',
			'Failure: As success, but the cult can Aid the PCs only once.',
			'Critical Failure: Tragedy befalls some of the adherents as they provide support, such as being captured by foes, stepped on by a giant, or shipwrecked. The cult loses 1d4 Fervor Points and 1d4 Recruitment Points.',
			'Special: At the GM\'s discretion, the cult might cache a useful tool where the PCs will find it rather than granting a circumstance bonus to a check. This might be a fistful of arrows made of a special material, a coiled rope stowed near where the PCs have to make a hasty escape down a cliffside, or a similar boon. The item\'s level shouldn\'t exceed half the cult\'s level.',
		],
	},
	{
		key: 'create-wonders',
		name: 'Create Wonders',
		description: 'The cult works on manuscripts, magic items, buildings, or other projects.',
		text: [
			'Requirements: The cult\'s Fervor isn\'t apathetic.',
			'The cult is directed to create anything from manuscripts to magic items to buildings. When scheduling this activity, identify up to three projects the cult works on; any items they create must either have common rarity or be items for which the PCs have access or a formula. During the cult phase, the cult attempts a number of checks to Craft equal to twice the cult\'s Size modifier. The PCs decide at the beginning of the phase how to divide these checks between multiple projects.',
			'Each check represents the initial 2 days of work plus 18 additional days of labor. For the purposes of tracking progress, the cult\'s proficiency is trained, which increases to expert at 7th level and increases to master at 15th level. At the end of the phase, the PCs can choose to conclude the cult\'s Crafting and pay the projects\' remaining costs to finish the project, or they can leave the project unfinished - likely continuing work during subsequent cult phases.',
			'Recommended prices for real estate appear in the Housing Costs table of Pathfinder Lost Omens Travel Guide, ranging from 100 gp for a thatch hut to 15,000 gp for a fine villa.',
		],
	},
	{
		key: 'oversee-rites',
		name: 'Oversee Rites',
		description: 'The cult performs special rites to empower the pantheon.',
		text: [
			'Requirements: The cult\'s Fervor isn\'t apathetic.',
			'The cult performs special rites to empower their pantheon - anything from prayers to fasting to magical rituals that channel the world\'s energies into their hero-gods. The cult attempts a check against the standard DC of the PCs\' level.',
			'Critical Success: The cult gains 1d4 Mythic Points (minimum 2), and the cult gains 1d4 Fervor Points.',
			'Success: The cult gains 1d4-1 Mythic Points (minimum 1).',
			'Failure: The cult\'s rites have minimal effect, earning the cult only 1d4-2 Mythic Points (minimum 0).',
			'Critical Failure: The rites backfire horribly, such as causing a magical explosion, invoking spirits that possess ritualists, or accidentally conjuring a hostile fiend. The cult loses 1d4 FP and 1d4 RP.',
		],
	},
	{
		key: 'recruit-adherents',
		name: 'Recruit Adherents',
		description: 'The cult focuses on evangelism and attracting new members.',
		text: [
			'Under your direction, the cult focuses on evangelism and developing its reputation to attract new members. The cult attempts a check against a standard DC of the cult\'s level.',
			'Critical Success: The cult\'s messaging resonates spectacularly! The cult gains 2d4+4 Recruitment Points.',
			'Success: The cult\'s efforts result in a steady stream of new recruits. The cult gains 2d4 Recruitment Points.',
			'Failure: The evangelism changes few minds, earning the cult only 1d4 Recruitment Points.',
			'Critical Failure: Whether due to pushy apostles, poor messaging, or unintended scandals, recent evangelism disillusions followers. The cult loses 1d4 Recruitment Points.',
		],
	},
	{
		key: 'teach-doctrine',
		name: 'Teach Doctrine',
		description: 'The pantheon reinforces, revises, or teaches its edicts and anathema.',
		text: [
			'You reinforce the pantheon\'s edicts and anathema. This might involve directly teaching disciples or training higher-rank adherents in how to instruct their disciples. You might also create sacred literature to guide the cult, introducing new lore or revising troublesome canon. Choose whether to increase or decrease the cult\'s Fervor Points, then the cult attempts a check against a standard DC of the cult\'s level. The result determines the maximum amount by which you can change the cult\'s Fervor Point total, though you can choose to change the FP total by a lesser amount after rolling.',
			'Critical Success: The cult embraces your teachings. Roll 2d4+2. You add or subtract a number of FP from the cult that doesn\'t exceed the roll\'s result.',
			'Success: As critical success, but roll 1d4+1.',
			'Failure: As critical success, but roll 1d4-1.',
			'Critical Failure: The teachings inadvertently introduce contradictions and spark arguments that will fuel arguments for months to come. Roll 1d10 and either add or subtract the result (determined randomly) from the cult\'s FP total.',
		],
	},
];
const CULT_EVENTS = [
	{
		name: 'False Gods',
		range: '0 or less',
		min: -Infinity,
		max: 0,
		summary: 'Discouraged adherents have come to a terrible conclusion: their pantheon consists of charlatans! Several followers arm themselves and hone their skills before launching an attack at some point during this cult phase. This is a moderate combat encounter, and the followers wait to strike until the PCs have expended some of their daily resources. Whatever the result, the cult loses 1d10 RP to reflect the followers who perish in the fight or flee in the aftermath.',
		actions: [{ action: 'roll-rp-loss', label: 'Roll 1d10 RP Loss', formula: '1d10', field: 'recruitmentPoints' }],
	},
	{
		name: 'Infectious Nihilism',
		range: '1',
		min: 1,
		max: 1,
		summary: 'Uninspired adherents spend more time complaining among themselves than working toward the cult\'s ends. During this cult phase, any flat check that results in a failure is treated as a critical failure instead.',
	},
	{
		name: 'Empty Pews',
		range: '2-3',
		min: 2,
		max: 3,
		summary: 'Followers lose interest and stop attending services. However, the right miracle or attention might reinvigorate the cult like never before. During this cult phase, any time the cult earns 1 or more RP, it earns 1 additional RP. Likewise, any time the cult earns 1 or more FP, it earns 1 additional FP. At the end of the phase, the cult loses 1d6 FP and 1d6 RP.',
		actions: [{ action: 'roll-empty-pews', label: 'Roll Phase-End Losses' }],
	},
	{
		name: 'Persistent Petitions',
		range: '4-5',
		min: 4,
		max: 5,
		summary: 'Followers bombard the pantheon with prayers and requests for small miracles, doubting their patrons\' power the more these prayers go unanswered. During this cult phase, a PC chosen at random hears a number of their followers\' prayers equal to the cult\'s Size modifier. They can fulfill one prayer by spending 3 actions and expending 1 Mythic Point within the next hour. At the end of the cult phase, the cult loses 1d4 FP for each prayer that went unanswered.',
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
		summary: 'The growth and miraculous claims of the PCs\' cult have drawn the attention of another cult, jealous of their new rival. At the end of this phase, the rival cult attempts a DC 9 flat check to steal an important relic, lure away followers, or inflict other kinds of damage against the PCs\' cult. The PCs\' cult can Assist the Pantheon one or more times during this phase, dedicating the effort toward fending off the rival cult rather than granting the PCs Aid on checks. For each success, increase the flat check DC by 2. For each critical success, increase the flat check DC by 1d4+1. Critical Success: as success, but the cult loses 2d4+1 FP and 2d4+1 RP. Success: the cult loses 1d4+1 FP and 1d4+1 RP. Failure: the rival cult\'s plot fails. Critical Failure: the rivals are thwarted so decisively that the PCs\' cult gains 1d4+1 FP.',
		actions: [
			{ action: 'roll-rivalry-dc-bonus', label: 'Roll Crit Success DC Bonus' },
			{ action: 'roll-rivalry-check', label: 'Roll Rival Flat Check' },
			{ action: 'apply-rivalry-critical-success', label: 'Apply Critical Success' },
			{ action: 'apply-rivalry-success', label: 'Apply Success' },
			{ action: 'apply-rivalry-critical-failure', label: 'Apply Critical Failure' },
		],
	},
	{
		name: 'Wave of Evangelism',
		range: '10-11',
		min: 10,
		max: 11,
		summary: 'Adherents can\'t help but spread word of their patrons\' wonders. During this phase, treat any success when Recruiting Adherents as a critical success.',
	},
	{
		name: 'Zealous Schism',
		range: '12',
		min: 12,
		max: 12,
		summary: 'A topic captures the congregation\'s imagination yet exposes a doctrinal flaw that fuels intense disagreement and debate for the duration of the cult phase. During this phase, increase the DC of all checks to Teach Doctrine by 2, and treat any d4 rolled to determine the maximum FP change as a 4. However, a critical failure has devastating variant results: the cult loses half of its Recruitment Points at the end of the cult phase, representing a splinter faith that departs the cult in outrage.',
	},
	{
		name: 'Cult Collaboration',
		range: '13',
		min: 13,
		max: 13,
		summary: 'Impressed by the cult\'s zeal, another faith proposes collaboration toward a common goal. During this cult phase, treat any success when Creating Wonders as a critical success.',
	},
	{
		name: 'Divine Renaissance',
		range: '14 or more',
		min: 14,
		max: Infinity,
		summary: 'The figurative stars align, and the cult overflows with energy, enthusiasm, and focus. Increase the number of cult activities the cult can perform during this phase by 2.',
		actions: [{ action: 'add-activity-bonus', label: 'Apply +2 Activities' }],
	},
];

function getDefaultCultData(actor) {
	return {
		name: '',
		level: actor.level ?? 1,
		fervorPoints: 5,
		recruitmentPoints: 1,
		mythicPoints: 0,
		agenda: '',
		mantles: '',
		activities: '',
		notes: '',
		gmNotes: '',
		mantleAssignments: {},
		activityBonus: 0,
		pendingPrayers: 0,
		rivalryAssistSuccesses: 0,
		rivalryAssistCriticalSuccesses: 0,
		rivalryDcBonus: 0,
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
	const members = getPartyMembers(actor);
	const isGM = game.user.isGM;
	const previewAsPlayer = !!app._dmcCultPreviewAsPlayer;
	const tab = buildCultTab(actor, data, stats, members, isGM, previewAsPlayer);

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

function buildCultTab(actor, data, stats, members, isGM, previewAsPlayer) {
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
					<input type="text" data-action="cult-name" value="${escapeHtml(data.name)}">
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
					<label>
						<span>Rivalry Successes</span>
						<input type="number" name="rivalryAssistSuccesses" min="0" value="${Number(data.rivalryAssistSuccesses) || 0}" ${disabled}>
					</label>
					<label>
						<span>Rivalry Crits</span>
						<input type="number" name="rivalryAssistCriticalSuccesses" min="0" value="${Number(data.rivalryAssistCriticalSuccesses) || 0}" ${disabled}>
					</label>
				</div>
				<div class="dmc-cult-notes">
					${textArea('Agenda', 'agenda', data.agenda, readonly)}
					${textArea('Activities', 'activities', data.activities, readonly)}
					${textArea('Notes', 'notes', data.notes, readonly)}
					${canEdit ? textArea('GM Notes', 'gmNotes', data.gmNotes, '') : ''}
				</div>
				${buildMantlesPanel(members, data, canEdit)}
			</div>
			${buildEventsPanel(data, stats, canEdit, isGM && !previewAsPlayer)}
		</div>
		${stats.inCrisis ? '<p class="dmc-cult-warning"><i class="fas fa-triangle-exclamation"></i> Cult in crisis: FP or RP is 0.</p>' : ''}
	`;
	content.dataset.actorId = actor.id;
	return { nav, content };
}

function getPartyMembers(party) {
	const members = party.members?.contents ?? party.members;
	if (Array.isArray(members) && members.length) {
		return members.filter((member) => member?.type === 'character');
	}

	const memberRefs = [
		party.system?.details?.members,
		party.system?.members,
		party.flags?.[game.system?.id ?? 'pf2e']?.members,
	].flatMap((refs) => (Array.isArray(refs) ? refs : []));
	const resolved = memberRefs
		.map((ref) => {
			if (ref instanceof Actor) return ref;
			if (typeof ref === 'string' && !ref.includes('.')) return game.actors.get(ref);
			if (typeof ref?.id === 'string') return game.actors.get(ref.id);
			if (typeof ref?.actor === 'string') return game.actors.get(ref.actor);
			return null;
		})
		.filter((member) => member?.type === 'character');
	if (resolved.length) return resolved;

	const worldParty = game.actors.party ?? game.actors.find?.((actor) => actor.type === 'party');
	return worldParty?.id === party.id
		? game.actors.contents.filter((actor) => actor.type === 'character' && actor.hasPlayerOwner)
		: [];
}

function buildMantlesPanel(members, data, canEdit) {
	const assignments = data.mantleAssignments ?? {};
	const rows = members.map((member) => buildMantleRow(member, assignments[member.id], canEdit)).join('');
	return `
		<section class="dmc-cult-mantles">
			<header>
				<h3>Mantles</h3>
				<small>Each PC chooses one mantle. More than one PC can choose the same mantle.</small>
			</header>
			${rows || '<p>No party PCs found.</p>'}
		</section>
	`;
}

function buildMantleRow(member, mantleKey, canEdit) {
	const mantle = MANTLES[mantleKey];
	const canChoose = canEdit || member.isOwner;
	return `
		<article class="dmc-cult-mantle-row" data-member-id="${member.id}">
			<div class="dmc-cult-mantle-pc">
				<strong>${escapeHtml(member.name)}</strong>
				<select data-action="select-mantle" data-member-id="${member.id}" ${canChoose ? '' : 'disabled'}>
					<option value="">Choose Mantle</option>
					${Object.entries(MANTLES).map(([key, option]) => `
						<option value="${key}" ${key === mantleKey ? 'selected' : ''}>${option.name}</option>
					`).join('')}
				</select>
			</div>
			<div class="dmc-cult-mantle-details">
				${mantle
					? `<strong>${mantle.name}</strong>
						<p><b>Cult Benefit:</b> ${escapeHtml(mantle.benefit)}</p>
						<p><b>Miracles:</b> ${escapeHtml(mantle.miracles)}</p>`
					: '<p>No mantle selected.</p>'
				}
			</div>
		</article>
	`;
}

function buildEventsPanel(data, stats, canEdit, showEventControls) {
	const event = data.currentEvent?.name ? data.currentEvent : null;
	return `
		<aside class="dmc-cult-events">
			${showEventControls ? `<section class="dmc-cult-event-section">
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
						<div class="dmc-cult-event-buttons">${buildEventButtons(event, canEdit, data)}</div>
					</div>`
					: '<p>No cult event rolled for this phase.</p>'
				}
			</section>` : ''}
			<section class="dmc-cult-activities">
				<header>
					<h3>Activities</h3>
				</header>
				<div class="dmc-cult-activity-list">
					${CULT_ACTIVITIES.map((activity) => `
						<button type="button" data-action="share-cult-activity" data-activity="${activity.key}" title="${escapeHtml(activity.description)}">
							${escapeHtml(activity.name)}
						</button>
					`).join('')}
				</div>
			</section>
		</aside>
	`;
}

function buildEventButtons(event, canEdit, data) {
	const definition = CULT_EVENTS.find((candidate) => candidate.name === event.name);
	const buttons = definition?.actions ?? [];
	if (!buttons.length) return '<small>No automatic effect buttons for this event.</small>';
	const rivalryDc = 9 + (Number(data.rivalryAssistSuccesses) || 0) * 2 + (Number(data.rivalryDcBonus) || 0);
	const rivalryControls = event.name === 'Cult Rivalry' ? `
		<div class="dmc-cult-rivalry-dc">
			<small>Rival flat check DC: ${rivalryDc}</small>
		</div>
	` : '';
	return buttons.map((button) => `
		<button type="button" data-action="${button.action}" ${canEdit ? '' : 'disabled'}>
			${escapeHtml(button.label)}
		</button>
	`).join('') + rivalryControls;
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
	root.querySelector('[data-action="cult-name"]')?.addEventListener('change', (event) => {
		return applyCultData(app, actor, { name: event.currentTarget.value });
	});
	root.querySelectorAll('[data-action="select-mantle"]').forEach((select) => {
		select.addEventListener('change', () => updateMantleAssignment(app, actor, select));
	});
	root.querySelectorAll('[data-action="share-cult-activity"]').forEach((button) => {
		button.addEventListener('click', () => shareCultActivity(actor, button.dataset.activity));
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
	root.querySelector('[data-action="roll-rivalry-dc-bonus"]')?.addEventListener('click', () => rollRivalryDcBonus(app, actor));
	root.querySelector('[data-action="roll-rivalry-check"]')?.addEventListener('click', () => rollRivalryFlatCheck(actor));
	root.querySelector('[data-action="apply-rivalry-critical-success"]')?.addEventListener('click', () => applyRivalryLoss(app, actor, '2d4+1', 'Cult Rivalry Critical Success Loss'));
	root.querySelector('[data-action="apply-rivalry-success"]')?.addEventListener('click', () => applyRivalryLoss(app, actor, '1d4+1', 'Cult Rivalry Success Loss'));
	root.querySelector('[data-action="apply-rivalry-critical-failure"]')?.addEventListener('click', () => applyRivalryCriticalFailure(app, actor));
}

async function updateMantleAssignment(app, actor, select) {
	const member = game.actors.get(select.dataset.memberId);
	if (!game.user.isGM && !member?.isOwner) return;

	const data = getCultData(actor);
	const assignments = { ...(data.mantleAssignments ?? {}) };
	if (select.value) assignments[select.dataset.memberId] = select.value;
	else delete assignments[select.dataset.memberId];

	await applyCultData(app, actor, { mantleAssignments: assignments });
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
		rivalryDcBonus: Number(data.rivalryDcBonus) || 0,
	};

	await roll.toMessage({
		speaker: ChatMessage.getSpeaker({ actor }),
		flavor: `${data.name} Cult Event: ${event.name} (${diceTotal} ${formatModifier(stats.fervor.bonus)} = ${total})`,
	});
	await applyCultData(app, actor, { currentEvent });
}

async function shareCultActivity(actor, activityKey) {
	const activity = CULT_ACTIVITIES.find((candidate) => candidate.key === activityKey);
	if (!activity) return;

	const data = getCultData(actor);
	const stats = getCultStats(data);
	const cultName = data.name?.trim() || actor.name;
	const standardDc = STANDARD_DCS_BY_LEVEL[stats.level] ?? STANDARD_DCS_BY_LEVEL[1];
	await ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor }),
		flavor: `${cultName}: ${activity.name}`,
		content: `
			<h3>${escapeHtml(activity.name)}</h3>
			${activity.text.map((line) => `<p>${formatActivityLine(line)}</p>`).join('')}
			<hr>
			<p><strong>Estimated standard DC:</strong> DC ${standardDc} for cult level ${stats.level}.</p>
		`,
	});
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

async function rollRivalryDcBonus(app, actor) {
	const data = getCultData(actor);
	const critCount = Number(data.rivalryAssistCriticalSuccesses) || 0;
	if (!critCount) {
		ui.notifications.warn('Enter at least one Rivalry Crit before rolling the DC bonus.');
		return;
	}

	const roll = await new Roll(`${critCount}d4 + ${critCount}`).evaluate({ async: true });
	const bonus = (Number(data.rivalryAssistSuccesses) || 0) * 2 + roll.total;
	await roll.toMessage({
		speaker: ChatMessage.getSpeaker({ actor }),
		flavor: `${data.name}: Cult Rivalry critical-success DC bonus`,
	});
	await applyCultData(app, actor, {
		rivalryDcBonus: bonus,
		currentEvent: data.currentEvent ? { ...data.currentEvent, rivalryDcBonus: bonus } : data.currentEvent,
	});
}

async function rollRivalryFlatCheck(actor) {
	const data = getCultData(actor);
	const dc = 9 + (Number(data.rivalryAssistSuccesses) || 0) * 2 + (Number(data.rivalryDcBonus) || 0);
	const roll = await new Roll('1d20').evaluate({ async: true });
	const total = roll.total;
	const degree =
		total === 20 && total >= dc ? 'Critical Success'
			: total === 1 && total < dc ? 'Critical Failure'
				: total >= dc + 10 ? 'Critical Success'
					: total >= dc ? 'Success'
						: total <= dc - 10 ? 'Critical Failure'
							: 'Failure';

	await roll.toMessage({
		speaker: ChatMessage.getSpeaker({ actor }),
		flavor: `${data.name}: Rival Cult Flat Check vs DC ${dc} (${degree})`,
	});
}

async function applyRivalryLoss(app, actor, formula, label) {
	const fpRoll = await new Roll(formula).evaluate({ async: true });
	const rpRoll = await new Roll(formula).evaluate({ async: true });
	const data = getCultData(actor);
	await fpRoll.toMessage({
		speaker: ChatMessage.getSpeaker({ actor }),
		flavor: `${data.name}: ${label} FP`,
	});
	await rpRoll.toMessage({
		speaker: ChatMessage.getSpeaker({ actor }),
		flavor: `${data.name}: ${label} RP`,
	});
	await applyCultData(app, actor, {
		fervorPoints: Math.max(0, (Number(data.fervorPoints) || 0) - fpRoll.total),
		recruitmentPoints: Math.max(0, (Number(data.recruitmentPoints) || 0) - rpRoll.total),
	});
}

async function applyRivalryCriticalFailure(app, actor) {
	const roll = await new Roll('1d4+1').evaluate({ async: true });
	const data = getCultData(actor);
	await roll.toMessage({
		speaker: ChatMessage.getSpeaker({ actor }),
		flavor: `${data.name}: Cult Rivalry Critical Failure FP Gain`,
	});
	await applyCultData(app, actor, {
		fervorPoints: (Number(data.fervorPoints) || 0) + roll.total,
	});
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

function formatActivityLine(line) {
	const escaped = escapeHtml(line);
	return escaped.replace(/^([^:]+):/, '<strong>$1:</strong>');
}

Hooks.on('renderActorSheet', renderCultSheet);
Hooks.on('renderPartySheetPF2e', renderCultSheet);

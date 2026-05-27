import { MODULE_ID } from './settings.js';
const SUBSYSTEMS_MODULE_ID = 'pf2e-subsystems';
const STANDARD_DCS_BY_LEVEL = {
	'-2': 12, '-1': 13, 0: 14, 1: 15, 2: 16, 3: 18, 4: 19, 5: 20, 6: 22, 7: 23, 8: 24, 9: 26,
	10: 27, 11: 28, 12: 30, 13: 31, 14: 32, 15: 34, 16: 35, 17: 36, 18: 38, 19: 39, 20: 40,
	21: 42, 22: 44, 23: 46, 24: 48, 25: 50, 26: 52,
};
const PF2_SKILLS = [
	'acrobatics', 'arcana', 'athletics', 'crafting', 'deception', 'diplomacy', 'intimidation',
	'medicine', 'nature', 'occultism', 'performance', 'religion', 'society', 'stealth',
	'survival', 'thievery', 'perception',
];
const LORE_SKILLS = [
	'art lore', 'engineering lore', 'scouting lore', 'warfare lore', 'alcohol lore', 'poetry lore',
	'history lore', 'underworld lore', 'sailing lore', 'library lore',
];
const GENERATOR_BANKS = {
	influence: {
		names: ['Reserved Oracle', 'Battle-Worn Envoy', 'Ashen Archivist', 'Sea-Bound Hero', 'Veiled Witness'],
		titles: ['a keeper of dangerous memories', 'a celebrated local power', 'an exacting patron of truth', 'a difficult ally with sharp expectations'],
		discoveries: ['notice hidden tells', 'study old scars and symbols', 'recognize a revealing contradiction', 'read the room for subtle reactions'],
		skillPrompts: ['to discuss their ideals', 'to appeal to shared duty', 'to impress with cultural knowledge', 'to read the emotional undercurrent'],
		milestones: [
			'The figure opens up and shares a personal truth that gives the PCs new leverage.',
			'The figure offers concrete assistance and points the PCs toward a deeper understanding.',
			'The figure grants rare insight or a valuable boon tied to the situation.',
		],
	},
	research: {
		names: ['Lost Correspondence', 'Heroic Testaments', 'Ruined Survey', 'Temple Fragments', 'Courtly Records'],
		topics: ['Annotated Margins', 'Dusty Ledgers', 'Witness Accounts', 'Sealed Fragments'],
		topicDescriptions: [
			'Hidden context is buried in the source material and only careful analysis reveals what matters.',
			'The source is incomplete, contradictory, or coded, requiring interpretation as much as observation.',
			'The material is rich with clues, but extracting them takes time and methodical work.',
		],
		breakpoints: [
			'The PCs uncover a useful historical connection that reframes the problem.',
			'The PCs identify a practical lead that points them toward the next stage of the investigation.',
			'The PCs uncover a decisive truth that changes how they understand the subject.',
			'The PCs piece together the larger pattern and gain a powerful strategic advantage.',
		],
	},
	infiltration: {
		names: ['Veiled Festival Escape', 'Silent Archive Break-In', 'Watchtower Prisoner Rescue', 'Masked Court Extraction'],
		objectives: ['Reach the target, secure them, and get out cleanly.', 'Slip inside, accomplish the objective, and escape before suspicion turns violent.'],
		obstacles: ['Blend With the Crowd', 'Locate the Target', 'Bypass the Lock', 'Escape Unnoticed'],
		obstacleDescriptions: [
			'The PCs must move naturally and avoid drawing attention while chaos unfolds around them.',
			'The PCs search, question bystanders, or follow subtle evidence without revealing their purpose.',
			'The PCs need to remove a final barrier using force, finesse, or misdirection.',
			'With the objective secured, the PCs must withdraw before the situation collapses around them.',
		],
		complications: ['Suspicious Reveler', 'Nervous Witness'],
		complicationDescriptions: [
			'An onlooker presses the PCs with unwanted attention at the worst possible time.',
			'Tension rises and the crowd starts to notice that something is wrong.',
		],
		opportunities: ['Helpful Bystander', 'Momentary Distraction'],
		opportunityDescriptions: [
			'Someone nearby recognizes the PCs or misreads their intent in a way that could help.',
			'The environment offers a brief opening the PCs can exploit to cancel out a mistake.',
		],
	},
};

function randomId() {
	return foundry.utils.randomID();
}

function randomChoice(array) {
	return array[Math.floor(Math.random() * array.length)];
}

function clampLevel(level) {
	return Math.max(-1, Math.min(26, Number(level) || 1));
}

function standardDcForLevel(level) {
	return STANDARD_DCS_BY_LEVEL[String(clampLevel(level))] ?? STANDARD_DCS_BY_LEVEL[1];
}

function variedDc(level, offset = 0) {
	return standardDcForLevel(level) + offset;
}

function getSuggestedPartyLevel() {
	const activeParty = game.actors?.find?.((actor) => actor.type === 'party' && actor.active);
	const partyMembers = activeParty?.members ?? [];
	if (partyMembers.length > 0) {
		const total = partyMembers.reduce((sum, actor) => sum + (actor?.system?.details?.level?.value ?? actor?.level ?? 0), 0);
		return Math.max(1, Math.round(total / partyMembers.length));
	}
	const playerCharacters = game.actors?.filter?.((actor) => actor.hasPlayerOwner && actor.type === 'character') ?? [];
	if (playerCharacters.length > 0) {
		const total = playerCharacters.reduce((sum, actor) => sum + (actor?.system?.details?.level?.value ?? actor?.level ?? 0), 0);
		return Math.max(1, Math.round(total / playerCharacters.length));
	}
	return game.user?.character?.system?.details?.level?.value ?? 1;
}

function getGeneratorSkillPool(includeLore = false) {
	return includeLore ? [...PF2_SKILLS, ...LORE_SKILLS] : [...PF2_SKILLS];
}

function pickDistinctSkills(count, includeLore = false) {
	const pool = foundry.utils.shuffle(getGeneratorSkillPool(includeLore));
	return pool.slice(0, Math.max(1, count));
}

function buildSkillEntries(skills, level, offsets = []) {
	return skills.map((skill, index) => ({
		id: randomId(),
		skill,
		lore: /\blore\b/i.test(skill),
		dc: variedDc(level, offsets[index] ?? 0),
	}));
}

function buildGeneratedInfluenceEvent(name, level) {
	const bank = GENERATOR_BANKS.influence;
	const npcName = name || randomChoice(bank.names);
	const discoverySkills = buildSkillEntries(pickDistinctSkills(4, true), level, [-2, 0, 1, 2]);
	const influenceSkills = buildSkillEntries(pickDistinctSkills(4, true), level, [-1, 0, 1, 3]).map((entry) => ({
		...entry,
		name: randomChoice(bank.skillPrompts),
	}));
	const milestones = [3, 5, 7].map((points, index) => ({
		id: randomId(),
		position: index + 1,
		name: `Influence ${points}`,
		hidden: true,
		description: `<p>${randomChoice(bank.milestones)}</p>`,
		points,
	}));
	const weaknessId = randomId();
	const resistanceId = randomId();
	const eventId = randomId();
	return {
		influence: {
			[eventId]: {
				id: eventId,
				position: 1,
				name: npcName,
				version: '0.8.9',
				background: '',
				pins: { sidebar: 'premise' },
				premise: `<p>${npcName} is ${randomChoice(bank.titles)}.</p>`,
				gmNotes: '',
				hidden: false,
				perception: 0,
				will: 0,
				influencePoints: 0,
				timeLimit: { current: 0, max: null },
				discoveries: makeOrderedCollection(discoverySkills, (entry, index) => ({
					id: entry.id,
					position: index + 1,
					hidden: false,
					skill: entry.skill,
					dc: entry.dc,
					lore: entry.lore,
				})),
				influenceSkills: makeOrderedCollection(influenceSkills, (entry, index) => ({
					id: entry.id,
					position: index + 1,
					name: entry.name,
					hidden: true,
					skill: entry.skill,
					dc: entry.dc,
					lore: entry.lore,
				})),
				influence: makeOrderedCollection(milestones, (entry) => entry),
				weaknesses: {
					[weaknessId]: {
						id: weaknessId,
						position: 1,
						name: 'Weakness',
						hidden: true,
						description: `<p>${npcName} responds well to careful empathy and shared purpose.</p>`,
						modifier: { used: false, value: 1 },
					},
				},
				resistances: {
					[resistanceId]: {
						id: resistanceId,
						position: 1,
						name: 'Resistance',
						hidden: true,
						description: `<p>${npcName} reacts poorly to blunt pressure or careless disrespect.</p>`,
						modifier: { used: false, value: 1 },
					},
				},
				penalties: {},
			},
		},
		chase: {},
		research: {},
		infiltration: {},
	};
}

function buildGeneratedResearchEvent(name, level) {
	const bank = GENERATOR_BANKS.research;
	const eventName = name || randomChoice(bank.names);
	const topics = Array.from({ length: 4 }, (_, index) => ({
		id: randomId(),
		position: index + 1,
		name: randomChoice(bank.topics),
		hidden: true,
		description: randomChoice(['north wing', 'sealed archive', 'private collection', 'collapsed alcove']),
		currentResearchPoints: 0,
		maximumResearchPoints: index < 2 ? 10 : 5,
		skillChecks: {
			[randomId()]: {
				id: randomId(),
				hidden: true,
				description: '',
				skills: makeOrderedCollection(buildSkillEntries(pickDistinctSkills(3, true), level, [-2, 0, 2]), (entry) => ({
					id: entry.id,
					skill: entry.skill,
					lore: entry.lore,
					dc: entry.dc,
					basic: false,
				})),
			},
		},
	}));
	const breakpoints = [5, 10, 15, 20].map((value, index) => ({
		id: randomId(),
		position: index + 1,
		hidden: true,
		breakpoint: value,
		description: `<p>${randomChoice(bank.breakpoints)}</p>`,
	}));
	const eventId = randomId();
	return {
		influence: {},
		chase: {},
		research: {
			[eventId]: {
				id: eventId,
				position: 1,
				name: eventName,
				version: '0.8.9',
				background: '',
				pins: { sidebar: 'premise' },
				premise: `<p>${eventName} contains clues that reward careful, repeated study.</p>`,
				gmNotes: '',
				tags: [],
				hidden: false,
				timeLimit: { current: 0, unit: 'year', max: null },
				started: false,
				researchPoints: 0,
				researchChecks: makeOrderedCollection(topics, (topic) => topic),
				researchBreakpoints: makeOrderedCollection(breakpoints, (point) => point),
				researchEvents: {},
			},
		},
		infiltration: {},
	};
}

function buildGeneratedInfiltrationEvent(name, level) {
	const bank = GENERATOR_BANKS.infiltration;
	const eventName = name || randomChoice(bank.names);
	const objectiveId = randomId();
	const obstacleNames = bank.obstacles;
	const objectiveDescription = randomChoice(bank.objectives);
	const obstacles = obstacleNames.map((obstacleName, index) => {
		const skillEntries = buildSkillEntries(pickDistinctSkills(index === 0 ? 4 : 5, true), level, [-2, 0, 0, 1, 2]);
		const skillCheckId = randomId();
		return {
			id: randomId(),
			img: 'icons/svg/cowled.svg',
			name: obstacleName,
			position: index + 1,
			hidden: false,
			individual: false,
			infiltrationPoints: { current: 0, max: index < 2 ? 2 : 3 },
			infiltrationPointData: {},
			skillChecks: {
				[skillCheckId]: {
					id: skillCheckId,
					hidden: true,
					description: '',
					dcAdjustments: [],
					difficulty: { leveledDC: false, DC: skillEntries[0]?.dc ?? variedDc(level) },
					skills: makeOrderedCollection(skillEntries, (entry) => ({
						id: entry.id,
						skill: entry.skill,
						lore: entry.lore,
						difficulty: { leveledDC: false, DC: entry.dc },
					})),
				},
			},
			description: `<p>${bank.obstacleDescriptions[index % bank.obstacleDescriptions.length]}</p>`,
		};
	});
	const complications = bank.complications.map((complicationName, index) => {
		const skillEntries = buildSkillEntries(pickDistinctSkills(3, true), level, [0, 1, 2]);
		const skillCheckId = randomId();
		return {
			id: randomId(),
			position: index + 1,
			hidden: true,
			name: complicationName,
			infiltrationPoints: { current: 0, max: 0 },
			trigger: index === 0 ? 'The PCs reach 5 Awareness Points for the first time.' : 'The PCs reach 10 Awareness Points for the first time.',
			skillChecks: {
				[skillCheckId]: {
					id: skillCheckId,
					hidden: true,
					description: '',
					dcAdjustments: [],
					difficulty: { leveledDC: false, DC: skillEntries[0]?.dc ?? variedDc(level) },
					skills: makeOrderedCollection(skillEntries, (entry) => ({
						id: entry.id,
						skill: entry.skill,
						lore: entry.lore,
						difficulty: { leveledDC: false, DC: entry.dc },
					})),
				},
			},
			description: `<p>${bank.complicationDescriptions[index % bank.complicationDescriptions.length]}</p>`,
			results: {
				criticalSuccess: { degreeOfSuccess: 'criticalSuccess', description: '', inUse: false, nrOutcomes: 0 },
				success: { degreeOfSuccess: 'success', description: 'The PCs avert suspicion and keep moving.', inUse: true, nrOutcomes: 0 },
				failure: { degreeOfSuccess: 'failure', description: 'The party accrues 1 AP.', awarenessPoints: 1, inUse: true, nrOutcomes: 0 },
				criticalFailure: { degreeOfSuccess: 'criticalFailure', description: 'The party accrues 2 AP.', awarenessPoints: 2, inUse: true, nrOutcomes: 0 },
			},
			resultsOutcome: '',
		};
	});
	const opportunities = bank.opportunities.map((opportunityName, index) => ({
		id: randomId(),
		position: index + 1,
		hidden: true,
		name: opportunityName,
		requirements: index === 0 ? 'A PC fails an obstacle check.' : 'The situation briefly shifts in the PCs’ favor.',
		description: `<p>${bank.opportunityDescriptions[index % bank.opportunityDescriptions.length]}</p>`,
	}));
	const eventId = randomId();
	return {
		influence: {},
		chase: {},
		research: {},
		infiltration: {
			[eventId]: {
				id: eventId,
				position: 1,
				name: eventName,
				version: '0.8.9',
				background: '',
				awarenessPoints: {
					current: 0,
					hidden: 0,
					breakpoints: {
						'1': { id: '1', breakpoint: 5, dcIncrease: null, description: '<p>Attention starts to focus on the PCs.</p>', position: 1, hidden: true, inUse: false },
						'2': { id: '2', breakpoint: 10, dcIncrease: 1, description: '<p>The opposition grows suspicious; obstacle DCs increase by 1.</p>', position: 2, hidden: true, inUse: false },
						'3': { id: '3', breakpoint: 15, dcIncrease: null, description: '<p>The infiltration begins to collapse around the PCs.</p>', position: 3, hidden: true, inUse: false },
					},
				},
				objectives: {
					[objectiveId]: {
						id: objectiveId,
						name: eventName,
						position: 1,
						hidden: false,
						obstacles: makeOrderedCollection(obstacles, (obstacle) => obstacle),
					},
				},
				preparations: { activities: {} },
				complications: makeOrderedCollection(complications, (entry) => entry),
				opportunities: makeOrderedCollection(opportunities, (entry) => entry),
				pins: { sidebar: 'premise' },
				premise: `<p>${objectiveDescription}</p>`,
				gmNotes: '',
				hidden: false,
				started: false,
				edgePoints: {},
			},
		},
	};
}

function buildGeneratedSubsystemExport(type, name, level) {
	const normalizedType = String(type ?? '').toLowerCase();
	const safeLevel = clampLevel(level);
	if (normalizedType === 'research') return buildGeneratedResearchEvent(name, safeLevel);
	if (normalizedType === 'infiltration') return buildGeneratedInfiltrationEvent(name, safeLevel);
	return buildGeneratedInfluenceEvent(name, safeLevel);
}

function normalizeWhitespace(value) {
	return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function splitPlainTextLines(text) {
	return String(text ?? '')
		.replace(/\r/g, '')
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean);
}

function makeOrderedCollection(items, mapper) {
	return Object.fromEntries(items.map((item, index) => {
		const entry = mapper(item, index);
		return [entry.id, entry];
	}));
}

function parseDcSkillList(segment) {
	const matches = [...segment.matchAll(/DC\s+(\d+)\s+([^,]+?)(?=(?:,\s*DC\s+\d+\s+)|$)/gi)];
	return matches.map((match) => {
		const skillText = normalizeWhitespace(match[2]);
		const lore = /\blore\b/i.test(skillText);
		return {
			skill: skillText.toLowerCase(),
			dc: Number(match[1]),
			lore,
		};
	});
}

function parseInfluenceSkillList(segment) {
	const matches = [...segment.matchAll(/DC\s+(\d+)\s+([^,(]+?)(?:\s*\(([^)]*)\))?(?=(?:,\s*DC\s+\d+\s+)|$)/gi)];
	return matches.map((match) => {
		const skillText = normalizeWhitespace(match[2]);
		const lore = /\blore\b/i.test(skillText);
		return {
			name: normalizeWhitespace(match[3] ?? ''),
			skill: skillText.toLowerCase(),
			dc: Number(match[1]),
			lore,
		};
	});
}

function parseSkillOptions(segment) {
	const matches = [...segment.matchAll(/DC\s+(\d+)\s+([^,]+?)(?:\s+to\s+([^,]+?))?(?=(?:,\s*or\s+DC\s+\d+\s+)|(?:,\s*DC\s+\d+\s+)|$)/gi)];
	return matches.map((match) => {
		const skillText = normalizeWhitespace(match[2]);
		return {
			skill: skillText.toLowerCase(),
			dc: Number(match[1]),
			lore: /\blore\b/i.test(skillText),
			description: normalizeWhitespace(match[3] ?? ''),
		};
	});
}

function isIgnorableTraitLine(line) {
	return /^[a-z][a-z\s-]{2,}$/i.test(line) && !/[.:;]/.test(line) && (line.match(/\s+/g)?.length ?? 0) <= 5;
}

function parseInfluenceThresholds(lines) {
	const entries = [];
	let current = null;
	const stopLabels = new Set(['resistances', 'weaknesses', 'background', 'appearance', 'personality']);

	for (const line of lines) {
		const influenceMatch = line.match(/^Influence\s+(\d+)\s*(.*)$/i);
		if (influenceMatch) {
			if (current) {
				current.description = normalizeWhitespace(current.descriptionLines.join(' '));
				delete current.descriptionLines;
				entries.push(current);
			}
			current = {
				points: Number(influenceMatch[1]),
				descriptionLines: [],
			};
			const remainder = normalizeWhitespace(influenceMatch[2] ?? '');
			if (remainder) current.descriptionLines.push(remainder);
			continue;
		}

		if (!current) continue;

		const lower = line.toLowerCase();
		if ([...stopLabels].some((label) => lower.startsWith(label))) break;
		if (isIgnorableTraitLine(line)) continue;

		current.descriptionLines.push(line);
	}

	if (current) {
		current.description = normalizeWhitespace(current.descriptionLines.join(' '));
		delete current.descriptionLines;
		entries.push(current);
	}

	return entries;
}

function extractLabeledSection(text, label, nextLabels) {
	const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const nextPattern = nextLabels
		.map((next) => next.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
		.join('|');
	const pattern = new RegExp(`${escapedLabel}\\s+([\\s\\S]*?)(?=\\n(?:${nextPattern})\\b|$)`, 'i');
	const match = text.match(pattern);
	return normalizeWhitespace(match?.[1] ?? '');
}

function slugifyName(value) {
	return normalizeWhitespace(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function parseResearchTopics(lines) {
	const topics = [];
	for (let i = 0; i < lines.length; i += 1) {
		const name = lines[i];
		const description = lines[i + 1] ?? '';
		const maxLine = lines[i + 2] ?? '';
		const checksLine = lines[i + 3] ?? '';
		if (!/^Maximum RP\s+\d+/i.test(maxLine) || !/^Research Checks\b/i.test(checksLine)) continue;

		const maximumResearchPoints = Number(maxLine.match(/^Maximum RP\s+(\d+)/i)?.[1] ?? 0);
		const skillOptions = parseSkillOptions(checksLine.replace(/^Research Checks\s*/i, ''));
		topics.push({
			name,
			description,
			maximumResearchPoints,
			skillOptions,
		});
		i += 3;
	}
	return topics;
}

function parseResearchBreakpoints(lines) {
	const breakpoints = [];
	for (const line of lines) {
		const match = line.match(/^(\d+)\s+Research Points?\s+(.+)$/i);
		if (!match) continue;
		breakpoints.push({
			breakpoint: Number(match[1]),
			description: normalizeWhitespace(match[2]),
		});
	}
	return breakpoints;
}

function parseResearchSummaryLine(line) {
	const match = line.match(/^Research Checks\s+(.+)$/i);
	if (!match) return [];
	return match[1]
		.split(/\s*,\s*/)
		.map((entry) => {
			const itemMatch = entry.match(/^(.+?)\s*\(([^)]+)\)$/);
			if (!itemMatch) return { name: normalizeWhitespace(entry), location: '' };
			return {
				name: normalizeWhitespace(itemMatch[1]),
				location: normalizeWhitespace(itemMatch[2]),
			};
		});
}

function escapeHtml(value) {
	return String(value ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}

function wrapParagraphs(lines) {
	const chunks = lines
		.map((line) => normalizeWhitespace(line))
		.filter(Boolean)
		.map((line) => `<p>${escapeHtml(line)}</p>`);
	return chunks.join('');
}

function collectSectionBlocks(lines, suffix) {
	const blocks = [];
	let current = null;
	for (const line of lines) {
		if (line.endsWith(suffix)) {
			if (current) blocks.push(current);
			current = { title: line.slice(0, -suffix.length).trim(), lines: [] };
			continue;
		}
		if (current) current.lines.push(line);
	}
	if (current) blocks.push(current);
	return blocks;
}

function parseOutcomeLines(lines) {
	const outcomes = {
		criticalSuccess: { degreeOfSuccess: 'criticalSuccess', description: '', inUse: false, nrOutcomes: 0 },
		success: { degreeOfSuccess: 'success', description: '', inUse: false, nrOutcomes: 0 },
		failure: { degreeOfSuccess: 'failure', description: '', inUse: false, nrOutcomes: 0 },
		criticalFailure: { degreeOfSuccess: 'criticalFailure', description: '', inUse: false, nrOutcomes: 0 },
	};

	const outcomePatterns = [
		['criticalSuccess', /^Critical Success\s+(.+)$/i],
		['success', /^Success\s+(.+)$/i],
		['criticalFailure', /^Critical Failure\s+(.+)$/i],
		['failure', /^Failure\s+(.+)$/i],
	];

	for (const line of lines) {
		for (const [key, pattern] of outcomePatterns) {
			const match = line.match(pattern);
			if (!match) continue;
			outcomes[key].description = match[1];
			outcomes[key].inUse = true;
			const apMatch = match[1].match(/accrues?\s+(\d+)\s+AP/i);
			if (apMatch) outcomes[key].awarenessPoints = Number(apMatch[1]);
			break;
		}
	}

	return outcomes;
}

function parseInfiltrationBreakpointLines(lines) {
	const result = {};
	let current = null;
	for (const line of lines) {
		const match = line.match(/^(\d+)\s+Awareness Points:\s*(.+)$/i);
		if (match) {
			if (current) {
				current.description = wrapParagraphs(current.descriptionLines);
				delete current.descriptionLines;
				result[current.id] = current;
			}
			const breakpoint = Number(match[1]);
			const text = match[2];
			const dcMatch = text.match(/Increase the DC(?:s)? .* by (\d+)/i);
			current = {
				id: String(Object.keys(result).length + 1),
				breakpoint,
				dcIncrease: dcMatch ? Number(dcMatch[1]) : null,
				position: Object.keys(result).length + 1,
				hidden: true,
				inUse: false,
				descriptionLines: [text],
			};
			continue;
		}
		if (current) current.descriptionLines.push(line);
	}
	if (current) {
		current.description = wrapParagraphs(current.descriptionLines);
		delete current.descriptionLines;
		result[current.id] = current;
	}
	return result;
}

function parseInfiltrationObstacleBlock(block, position) {
	const pointsLine = block.lines.find((line) => /^Infiltration Points\s+/i.test(line)) ?? '';
	const pointsMatch = pointsLine.match(/^Infiltration Points\s+(\d+)\s+\((group|individual)\)$/i);
	const overcomeLine = block.lines.find((line) => /^Overcome\s+/i.test(line)) ?? '';
	const skillOptions = parseSkillOptions(overcomeLine.replace(/^Overcome\s*/i, ''));
	const narrativeLines = block.lines.filter((line) =>
		!/^Infiltration Points\s+/i.test(line) &&
		!/^Overcome\s+/i.test(line)
	);
	const outcomes = parseOutcomeLines(narrativeLines);
	const descriptionLines = narrativeLines.filter((line) =>
		!/^Success\s+/i.test(line) &&
		!/^Failure\s+/i.test(line) &&
		!/^Critical Failure\s+/i.test(line) &&
		!/^Critical Success\s+/i.test(line)
	);
	const appendedOutcomeLines = [];
	for (const key of ['success', 'failure', 'criticalFailure', 'criticalSuccess']) {
		if (outcomes[key].description) {
			const label =
				key === 'criticalFailure' ? 'Critical Failure' :
				key === 'criticalSuccess' ? 'Critical Success' :
				key === 'failure' ? 'Failure' : 'Success';
			appendedOutcomeLines.push(`${label}: ${outcomes[key].description}`);
		}
	}
	return {
		id: randomId(),
		img: 'icons/svg/cowled.svg',
		name: block.title,
		position,
		hidden: false,
		individual: pointsMatch?.[2]?.toLowerCase() === 'individual',
		infiltrationPoints: {
			current: 0,
			max: Number(pointsMatch?.[1] ?? 1),
		},
		infiltrationPointData: {},
		skillChecks: {
			[randomId()]: {
				id: randomId(),
				skills: makeOrderedCollection(skillOptions, (option) => ({
					id: randomId(),
					lore: option.lore,
					difficulty: { leveledDC: false, DC: option.dc },
					skill: option.skill,
				})),
				hidden: true,
				description: '',
				dcAdjustments: [],
				difficulty: { leveledDC: false, DC: skillOptions[0]?.dc ?? null },
			},
		},
		description: wrapParagraphs([...descriptionLines, ...appendedOutcomeLines]),
	};
}

function parseInfiltrationComplicationBlock(block, position) {
	const triggerLine = block.lines.find((line) => /^Trigger\s+/i.test(line)) ?? '';
	const overcomeLine = block.lines.find((line) => /^Overcome\s+/i.test(line)) ?? '';
	const skillOptions = parseSkillOptions(overcomeLine.replace(/^Overcome\s*/i, ''));
	const narrativeLines = block.lines.filter((line) =>
		!/^Trigger\s+/i.test(line) &&
		!/^Overcome\s+/i.test(line)
	);
	const outcomes = parseOutcomeLines(narrativeLines);
	const descriptionLines = narrativeLines.filter((line) =>
		!/^Success\s+/i.test(line) &&
		!/^Failure\s+/i.test(line) &&
		!/^Critical Failure\s+/i.test(line) &&
		!/^Critical Success\s+/i.test(line)
	);
	const complicationId = randomId();
	const skillCheckId = randomId();
	return {
		id: complicationId,
		position,
		hidden: true,
		name: block.title,
		infiltrationPoints: { current: 0, max: 0 },
		trigger: triggerLine.replace(/^Trigger\s*/i, ''),
		skillChecks: {
			[skillCheckId]: {
				id: skillCheckId,
				skills: makeOrderedCollection(skillOptions, (option) => ({
					id: randomId(),
					skill: option.skill,
					lore: option.lore,
					difficulty: { leveledDC: false, DC: option.dc },
				})),
				hidden: true,
				description: '',
				dcAdjustments: [],
				difficulty: { leveledDC: false, DC: skillOptions[0]?.dc ?? null },
			},
		},
		description: wrapParagraphs(descriptionLines),
		results: outcomes,
		resultsOutcome: '',
	};
}

function parseInfiltrationOpportunityBlock(block, position) {
	const triggerLine = block.lines.find((line) => /^Trigger\s+/i.test(line)) ?? '';
	const overcomeLine = block.lines.find((line) => /^Overcome\s+/i.test(line)) ?? '';
	const narrativeLines = block.lines.filter((line) =>
		!/^Trigger\s+/i.test(line) &&
		!/^Overcome\s+/i.test(line)
	);
	return {
		id: randomId(),
		position,
		hidden: true,
		name: block.title,
		requirements: triggerLine.replace(/^Trigger\s*/i, ''),
		description: wrapParagraphs([
			overcomeLine ? `Overcome ${overcomeLine.replace(/^Overcome\s*/i, '')}` : '',
			...narrativeLines,
		]),
	};
}

function buildInfluenceExportFromJournalText(text) {
	const lines = splitPlainTextLines(text);
	if (!lines.length) throw new Error('PF2 Director | Paste journal text first.');

	const fullText = lines.join('\n');
	const name = lines[0];
	const levelMatch = fullText.match(/\bLevel\s+(\d+)\b/i);
	const perceptionMatch = fullText.match(/\bPerception\s*\+?(-?\d+)\b/i);
	const willMatch = fullText.match(/\bWill\s*\+?(-?\d+)\b/i);
	const discoveryLine = lines.find((line) => /^Discovery DC\b/i.test(line));
	const influenceSkillsLine = lines.find((line) => /^Influence Skills\b/i.test(line));

	if (!name || !levelMatch) {
		throw new Error('PF2 Director | Could not find the creature name and level in pasted text.');
	}

	const discoveries = parseDcSkillList(discoveryLine?.replace(/^Discovery\s*/i, '') ?? '');
	const influenceSkills = parseInfluenceSkillList(
		influenceSkillsLine?.replace(/^Influence Skills\s*/i, '') ?? '',
	);
	const influenceEntries = parseInfluenceThresholds(lines);

	const resistanceText = extractLabeledSection(fullText, 'Resistances', ['Weaknesses', 'Background', 'Appearance', 'Personality']);
	const weaknessText = extractLabeledSection(fullText, 'Weaknesses', ['Background', 'Appearance', 'Personality']);
	const background = extractLabeledSection(fullText, 'Background', ['Appearance', 'Personality']);
	const appearance = extractLabeledSection(fullText, 'Appearance', ['Personality']);
	const personality = extractLabeledSection(fullText, 'Personality', []);

	const record = {
		id: randomId(),
		position: 1,
		name,
		version: '0.8.9',
		background: '',
		pins: {
			sidebar: 'premise',
		},
		premise: '',
		gmNotes: '',
		hidden: false,
		perception: perceptionMatch ? Number(perceptionMatch[1]) : 0,
		will: willMatch ? Number(willMatch[1]) : 0,
		influencePoints: influenceEntries[0]?.points ?? 0,
		timeLimit: {
			current: 0,
			max: null,
		},
		discoveries: makeOrderedCollection(discoveries, (item, index) => ({
			id: randomId(),
			position: index + 1,
			hidden: false,
			skill: item.skill,
			dc: item.dc,
			lore: item.lore,
		})),
		influenceSkills: makeOrderedCollection(influenceSkills, (item, index) => ({
			id: randomId(),
			position: index + 1,
			name: item.name,
			hidden: true,
			skill: item.skill,
			dc: item.dc,
			lore: item.lore,
		})),
		influence: makeOrderedCollection(influenceEntries, (item, index) => ({
			id: randomId(),
			position: index + 1,
			name: `Influence ${item.points}`,
			hidden: true,
			description: `<p>${item.description}</p>`,
			points: item.points,
		})),
		weaknesses: weaknessText ? (() => {
			const id = randomId();
			return {
				[id]: {
					id,
				position: 1,
				name: 'Weaknesses',
				hidden: true,
				description: `<p>${weaknessText}</p>`,
				modifier: {
					used: false,
					value: 0,
				},
				},
			};
		})() : {},
		resistances: resistanceText ? (() => {
			const id = randomId();
			return {
				[id]: {
					id,
				position: 1,
				name: 'Resistances',
				hidden: true,
				description: `<p>${resistanceText}</p>`,
				modifier: {
					used: false,
					value: 0,
				},
				},
			};
		})() : {},
		penalties: {},
	};

	if (background || appearance || personality) {
		record.gmNotes = [background && `Background: ${background}`, appearance && `Appearance: ${appearance}`, personality && `Personality: ${personality}`]
			.filter(Boolean)
			.join('\n\n');
	}

	return {
		influence: {
			[record.id]: record,
		},
		chase: {},
		research: {},
		infiltration: {},
	};
}

function buildResearchExportFromJournalText(text) {
	const lines = splitPlainTextLines(text);
	if (!lines.length) throw new Error('PF2 Director | Paste journal text first.');

	const researchHeaderIndex = lines.findIndex((line) => /^Research\s+\d+$/i.test(line));
	if (researchHeaderIndex === -1) {
		throw new Error('PF2 Director | Could not find the research header in pasted text.');
	}

	const topics = parseResearchTopics(lines.slice(0, researchHeaderIndex));
	const name = lines[researchHeaderIndex - 1];
	const researchLevel = Number(lines[researchHeaderIndex].match(/^Research\s+(\d+)$/i)?.[1] ?? 0);
	const summaryLine = lines.find((line) => /^Research Checks\s+.+\(.+\)/i.test(line)) ?? '';
	const breakpointLines = lines.slice(researchHeaderIndex + 1);
	const breakpoints = parseResearchBreakpoints(breakpointLines);
	const topicSummaries = parseResearchSummaryLine(summaryLine);

	if (!name) {
		throw new Error('PF2 Director | Could not determine the research entry name from pasted text.');
	}

	const topicLocationMap = new Map(topicSummaries.map((topic) => [slugifyName(topic.name), topic.location]));
	const record = {
		id: randomId(),
		position: 1,
		name,
		version: '0.8.9',
		background: '',
		pins: {
			sidebar: 'premise',
		},
		premise: '',
		gmNotes: '',
		tags: [],
		hidden: false,
		timeLimit: {
			current: 0,
			unit: 'year',
			max: null,
		},
		started: false,
		researchPoints: 0,
		researchChecks: makeOrderedCollection(topics, (topic, index) => {
			const skillCheckId = randomId();
			return {
				id: randomId(),
				position: index + 1,
				skillChecks: {
					[skillCheckId]: {
						id: skillCheckId,
						skills: makeOrderedCollection(topic.skillOptions, (option) => ({
							id: randomId(),
							lore: option.lore,
							dc: option.dc,
							basic: false,
							skill: option.skill,
						})),
						hidden: true,
						description: '',
					},
				},
				name: topic.name,
				hidden: true,
				description: topicLocationMap.get(slugifyName(topic.name)) || topic.description || '',
				currentResearchPoints: 0,
				maximumResearchPoints: topic.maximumResearchPoints,
			};
		}),
		researchBreakpoints: makeOrderedCollection(breakpoints, (breakpoint, index) => ({
			id: randomId(),
			position: index + 1,
			hidden: true,
			breakpoint: breakpoint.breakpoint,
			description: `<p>${breakpoint.description}</p>`,
		})),
		researchEvents: {},
	};

	return {
		influence: {},
		chase: {},
		research: {
			[record.id]: record,
		},
		infiltration: {},
	};
}

function buildInfiltrationExportFromJournalText(text) {
	const lines = splitPlainTextLines(text);
	if (!lines.length) throw new Error('PF2 Director | Paste journal text first.');

	const obstaclesIndex = lines.findIndex((line) => /^Obstacles$/i.test(line));
	if (obstaclesIndex === -1) {
		throw new Error('PF2 Director | Could not find the Obstacles section in pasted infiltration text.');
	}
	const complicationsIndex = lines.findIndex((line) => /^Complications$/i.test(line));
	const opportunitiesIndex = lines.findIndex((line) => /^Opportunities$/i.test(line));

	const awarenessLines = lines.slice(0, obstaclesIndex).filter((line) => /Awareness Points:/i.test(line) || !/^Track Awareness Point thresholds/i.test(line));
	const awarenessBreakpoints = parseInfiltrationBreakpointLines(awarenessLines);

	const objectiveIntroLines = lines.slice(obstaclesIndex + 1, complicationsIndex > -1 ? complicationsIndex : lines.length);
	const objectiveDescriptionLines = [];
	for (const line of objectiveIntroLines) {
		if (line.endsWith('Obstacle')) break;
		objectiveDescriptionLines.push(line);
	}
	const objectiveName = objectiveDescriptionLines.length > 0
		? normalizeWhitespace(objectiveDescriptionLines[0].replace(/^The PCs’ objective is to\s*/i, '').replace(/^The PCs' objective is to\s*/i, ''))
		: 'Main Objective';

	const obstacleBlocks = collectSectionBlocks(
		lines.slice(obstaclesIndex + 1, complicationsIndex > -1 ? complicationsIndex : lines.length),
		' Obstacle',
	);
	const complicationBlocks = complicationsIndex > -1
		? collectSectionBlocks(lines.slice(complicationsIndex + 1, opportunitiesIndex > -1 ? opportunitiesIndex : lines.length), ' Complication')
		: [];
	const opportunityBlocks = opportunitiesIndex > -1
		? collectSectionBlocks(lines.slice(opportunitiesIndex + 1), ' Opportunity')
		: [];

	const firstLine = lines[0] ?? '';
	const nameCandidate = /^Track Awareness Point thresholds/i.test(firstLine) ? 'New Infiltration' : firstLine || 'New Infiltration';
	const objectiveId = randomId();
	const record = {
		id: randomId(),
		position: 1,
		name: nameCandidate,
		version: '0.8.9',
		background: '',
		awarenessPoints: {
			current: 0,
			hidden: 0,
			breakpoints: awarenessBreakpoints,
		},
		objectives: {
			[objectiveId]: {
				id: objectiveId,
				name: objectiveName || 'Main Objective',
				position: 1,
				hidden: false,
				obstacles: makeOrderedCollection(obstacleBlocks, (block, index) => parseInfiltrationObstacleBlock(block, index + 1)),
			},
		},
		preparations: {
			activities: {},
		},
		complications: makeOrderedCollection(complicationBlocks, (block, index) => parseInfiltrationComplicationBlock(block, index + 1)),
		opportunities: makeOrderedCollection(opportunityBlocks, (block, index) => parseInfiltrationOpportunityBlock(block, index + 1)),
		pins: {
			sidebar: 'premise',
		},
		premise: '',
		gmNotes: '',
		hidden: false,
		started: false,
		edgePoints: {},
	};

	return {
		influence: {},
		chase: {},
		research: {},
		infiltration: {
			[record.id]: record,
		},
	};
}

function buildSubsystemExportFromJournalText(text) {
	const normalized = String(text ?? '');
	if (/\bAwareness Points\b/i.test(normalized) && /\bObstacles\b/i.test(normalized)) {
		return buildInfiltrationExportFromJournalText(text);
	}
	if (/\bResearch Checks\b/i.test(normalized) && /\bResearch\s+\d+\b/i.test(normalized)) {
		return buildResearchExportFromJournalText(text);
	}
	return buildInfluenceExportFromJournalText(text);
}

function hasLiveSubsystemModule() {
	return game.modules.get(SUBSYSTEMS_MODULE_ID)?.active === true;
}

function getPrimarySubsystemRecord(data) {
	for (const key of ['influence', 'research', 'infiltration']) {
		const record = Object.values(data?.[key] ?? {})[0];
		if (record) return { type: key, record };
	}
	return null;
}

function getSubsystemExportFilename(data) {
	const primary = getPrimarySubsystemRecord(data);
	const name = primary?.record?.name || game.world.id || 'subsystems';
	const slug = name.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'subsystems';
	return `${slug}.subsystems.json`;
}

function downloadSubsystemExportData(data) {
	const json = JSON.stringify(data, null, 2);
	saveDataToFile(json, 'application/json', getSubsystemExportFilename(data));
	ui.notifications.info('PF2 Director | Subsystem export downloaded.');
}

async function createLiveSubsystemFromExportData(data) {
	if (!hasLiveSubsystemModule()) {
		throw new Error('PF2 Director | PF2e Subsystems must be enabled to create live subsystem data.');
	}

	if (Object.keys(data.influence ?? {}).length > 0) {
		const sourceInfluence = Object.values(data.influence)[0];
		const setting = game.settings.get(SUBSYSTEMS_MODULE_ID, 'influence');
		const eventId = randomId();
		await setting.updateSource({
			events: {
				[eventId]: {
					...sourceInfluence,
					id: eventId,
					influencePoints: 0,
					timeLimit: {
						max: sourceInfluence.timeLimit.max,
					},
					discoveries: Object.values(sourceInfluence.discoveries).reduce((acc, discovery) => {
						const id = randomId();
						acc[id] = { ...discovery, id };
						return acc;
					}, {}),
					influenceSkills: Object.values(sourceInfluence.influenceSkills).reduce((acc, skill) => {
						const id = randomId();
						acc[id] = { ...skill, id, hidden: true };
						return acc;
					}, {}),
					influence: Object.values(sourceInfluence.influence).reduce((acc, influence) => {
						const id = randomId();
						acc[id] = { ...influence, id, hidden: true };
						return acc;
					}, {}),
					weaknesses: Object.values(sourceInfluence.weaknesses).reduce((acc, weakness) => {
						const id = randomId();
						acc[id] = {
							...weakness,
							id,
							hidden: true,
							modifier: { value: weakness.modifier.value },
						};
						return acc;
					}, {}),
					resistances: Object.values(sourceInfluence.resistances).reduce((acc, resistance) => {
						const id = randomId();
						acc[id] = {
							...resistance,
							id,
							hidden: true,
							modifier: { value: resistance.modifier.value },
						};
						return acc;
					}, {}),
					penalties: Object.values(sourceInfluence.penalties).reduce((acc, penalty) => {
						const id = randomId();
						acc[id] = {
							...penalty,
							id,
							hidden: true,
							modifier: { value: penalty.modifier?.value ?? 0 },
						};
						return acc;
					}, {}),
				},
			},
		});
		await game.settings.set(SUBSYSTEMS_MODULE_ID, 'influence', setting);
		ui.notifications.info(`PF2 Director | Created live Influence subsystem: ${sourceInfluence.name}`);
		return;
	}

	if (Object.keys(data.research ?? {}).length > 0) {
		const sourceResearch = Object.values(data.research)[0];
		const setting = game.settings.get(SUBSYSTEMS_MODULE_ID, 'research');
		const eventId = randomId();
		await setting.updateSource({
			events: {
				[eventId]: {
					...sourceResearch,
					id: eventId,
					timeLimit: {
						unit: sourceResearch.timeLimit.unit,
						max: sourceResearch.timeLimit.max,
					},
					started: false,
					researchPoints: 0,
					researchChecks: Object.values(sourceResearch.researchChecks).reduce((acc, check) => {
						const checkId = randomId();
						acc[checkId] = {
							...check,
							id: checkId,
							currentResearchPoints: 0,
							skillChecks: Object.values(check.skillChecks).reduce((skillAcc, skillCheck) => {
								const skillCheckId = randomId();
								skillAcc[skillCheckId] = {
									...skillCheck,
									id: skillCheckId,
									skills: Object.values(skillCheck.skills).reduce((entryAcc, skill) => {
										const skillId = randomId();
										entryAcc[skillId] = { ...skill, id: skillId };
										return entryAcc;
									}, {}),
								};
								return skillAcc;
							}, {}),
						};
						return acc;
					}, {}),
					researchBreakpoints: Object.values(sourceResearch.researchBreakpoints).reduce((acc, breakpoint) => {
						const id = randomId();
						acc[id] = { ...breakpoint, id, hidden: true };
						return acc;
					}, {}),
					researchEvents: Object.values(sourceResearch.researchEvents).reduce((acc, event) => {
						const id = randomId();
						acc[id] = { ...event, id, hidden: true };
						return acc;
					}, {}),
				},
			},
		});
		await game.settings.set(SUBSYSTEMS_MODULE_ID, 'research', setting);
		ui.notifications.info(`PF2 Director | Created live Research subsystem: ${sourceResearch.name}`);
		return;
	}

	if (Object.keys(data.infiltration ?? {}).length > 0) {
		const sourceInfiltration = Object.values(data.infiltration)[0];
		const setting = game.settings.get(SUBSYSTEMS_MODULE_ID, 'infiltration');
		const eventId = randomId();
		await setting.updateSource({
			events: {
				[eventId]: {
					...sourceInfiltration,
					id: eventId,
					awarenessPoints: {
						...sourceInfiltration.awarenessPoints,
						breakpoints: Object.values(sourceInfiltration.awarenessPoints.breakpoints).reduce((acc, breakpoint) => {
							const id = randomId();
							acc[id] = { ...breakpoint, id, inUse: false };
							return acc;
						}, {}),
					},
					objectives: Object.values(sourceInfiltration.objectives).reduce((objectiveAcc, objective) => {
						const objectiveId = randomId();
						objectiveAcc[objectiveId] = {
							...objective,
							id: objectiveId,
							obstacles: Object.values(objective.obstacles).reduce((obstacleAcc, obstacle) => {
								const obstacleId = randomId();
								obstacleAcc[obstacleId] = {
									...obstacle,
									id: obstacleId,
									infiltrationPoints: { current: 0, max: obstacle.infiltrationPoints.max },
									infiltrationPointData: {},
									skillChecks: Object.values(obstacle.skillChecks).reduce((skillCheckAcc, skillCheck) => {
										const skillCheckId = randomId();
										skillCheckAcc[skillCheckId] = {
											...skillCheck,
											id: skillCheckId,
											skills: Object.values(skillCheck.skills).reduce((skillAcc, skill) => {
												const skillId = randomId();
												skillAcc[skillId] = { ...skill, id: skillId };
												return skillAcc;
											}, {}),
										};
										return skillCheckAcc;
									}, {}),
								};
								return obstacleAcc;
							}, {}),
						};
						return objectiveAcc;
					}, {}),
					complications: Object.values(sourceInfiltration.complications).reduce((acc, complication) => {
						const id = randomId();
						acc[id] = {
							...complication,
							id,
							infiltrationPoints: { current: 0, max: complication.infiltrationPoints.max ?? 0 },
							skillChecks: Object.values(complication.skillChecks).reduce((skillCheckAcc, skillCheck) => {
								const skillCheckId = randomId();
								skillCheckAcc[skillCheckId] = {
									...skillCheck,
									id: skillCheckId,
									skills: Object.values(skillCheck.skills).reduce((skillAcc, skill) => {
										const skillId = randomId();
										skillAcc[skillId] = { ...skill, id: skillId };
										return skillAcc;
									}, {}),
								};
								return skillCheckAcc;
							}, {}),
						};
						return acc;
					}, {}),
					opportunities: Object.values(sourceInfiltration.opportunities).reduce((acc, opportunity) => {
						const id = randomId();
						acc[id] = { ...opportunity, id };
						return acc;
					}, {}),
				},
			},
		});
		await game.settings.set(SUBSYSTEMS_MODULE_ID, 'infiltration', setting);
		ui.notifications.info(`PF2 Director | Created live Infiltration subsystem: ${sourceInfiltration.name}`);
		return;
	}

	throw new Error('PF2 Director | No supported subsystem data was found to create live.');
}

async function createLiveSubsystemFromJournalText(text) {
	return createLiveSubsystemFromExportData(buildSubsystemExportFromJournalText(text));
}

function downloadSubsystemExport(text) {
	downloadSubsystemExportData(buildSubsystemExportFromJournalText(text));
}

class JournalTransferApp extends FormApplication {
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id: 'dmc-journal-transfer',
			title: 'PF2 Director Subsystem Export',
			template: 'modules/pf2-david-music-control/templates/journal-transfer.hbs',
			width: 700,
			height: 'auto',
			closeOnSubmit: false,
			resizable: true,
			classes: ['dmc-journal-transfer-app'],
		});
	}

	getData() {
		return {
			journalText: '',
			generatedLevel: getSuggestedPartyLevel(),
			generatedName: '',
			generatorTypes: [
				{ value: 'influence', label: 'Influence' },
				{ value: 'research', label: 'Research' },
				{ value: 'infiltration', label: 'Infiltration' },
			],
			subsystemsEnabled: hasLiveSubsystemModule(),
		};
	}

	activateListeners(html) {
		super.activateListeners(html);

		const buildGeneratedData = () => {
			const type = String(html.find('[name="generatedType"]').val() ?? 'influence');
			const name = String(html.find('[name="generatedName"]').val() ?? '').trim();
			const level = Number(html.find('[name="generatedLevel"]').val() ?? getSuggestedPartyLevel());
			return buildGeneratedSubsystemExport(type, name, level);
		};

		html.find('[data-action="export-journal-text"]').on('click', (event) => {
			event.preventDefault();
			const journalText = String(html.find('[name="journalText"]').val() ?? '').trim();
			try {
				downloadSubsystemExport(journalText);
			} catch (error) {
				ui.notifications.error(error.message || 'PF2 Director | Could not build subsystem export.');
			}
		});

		html.find('[data-action="preview-journal-json"]').on('click', (event) => {
			event.preventDefault();
			const journalText = String(html.find('[name="journalText"]').val() ?? '').trim();
			const output = html.find('[name="journalJson"]').get(0);
			try {
				output.value = JSON.stringify(buildSubsystemExportFromJournalText(journalText), null, 2);
			} catch (error) {
				ui.notifications.error(error.message || 'PF2 Director | Could not build subsystem export.');
			}
		});

		html.find('[data-action="create-live-subsystem"]').on('click', async (event) => {
			event.preventDefault();
			const journalText = String(html.find('[name="journalText"]').val() ?? '').trim();
			try {
				await createLiveSubsystemFromJournalText(journalText);
			} catch (error) {
				ui.notifications.error(error.message || 'PF2 Director | Could not create live subsystem data.');
			}
		});

		html.find('[data-action="preview-generated-json"]').on('click', (event) => {
			event.preventDefault();
			const output = html.find('[name="generatedJson"]').get(0);
			try {
				output.value = JSON.stringify(buildGeneratedData(), null, 2);
			} catch (error) {
				ui.notifications.error(error.message || 'PF2 Director | Could not generate subsystem data.');
			}
		});

		html.find('[data-action="download-generated-subsystem"]').on('click', (event) => {
			event.preventDefault();
			try {
				downloadSubsystemExportData(buildGeneratedData());
			} catch (error) {
				ui.notifications.error(error.message || 'PF2 Director | Could not generate subsystem export.');
			}
		});

		html.find('[data-action="create-generated-live-subsystem"]').on('click', async (event) => {
			event.preventDefault();
			try {
				await createLiveSubsystemFromExportData(buildGeneratedData());
			} catch (error) {
				ui.notifications.error(error.message || 'PF2 Director | Could not create live subsystem data.');
			}
		});
	}

	async _updateObject(_event, _formData) {}
}

let transferApp = null;
const injectedJournalButtons = new WeakSet();

function getTransferApp() {
	if (!transferApp) transferApp = new JournalTransferApp();
	return transferApp;
}

function extractRenderElement(html, app) {
	let element = html instanceof HTMLElement ? html : html?.[0];
	if (!element) return null;

	if (!element.classList?.contains('application') && !element.classList?.contains('window-app')) {
		const appRoot = element.closest?.('.application, .window-app');
		if (appRoot) {
			element = appRoot;
		} else {
			const appId = app?.options?.id || app?.id;
			if (appId) element = document.getElementById(appId) || element;
		}
	}

	return element;
}

function injectJournalTransferButton(sheet, html) {
	if (!game.user.isGM) return;

	const root = extractRenderElement(html, sheet);
	if (!root) return;

	const header = root.querySelector('.window-header');
	if (!header) return;
	if (header.querySelector('.dmc-journal-transfer-button')) return;
	if (injectedJournalButtons.has(header)) return;

	const button = document.createElement('a');
	button.className = 'header-button control dmc-journal-transfer-button';
	button.dataset.tooltip = 'PF2 Director Transfer';
	button.setAttribute('aria-label', 'PF2 Director Transfer');
	button.innerHTML = '<i class="fas fa-file-arrow-up"></i>';
	button.addEventListener('click', (event) => {
		event.preventDefault();
		event.stopPropagation();
		getTransferApp().render(true, { focus: true });
	});

	const closeButton = header.querySelector('.close, [data-action="close"], .header-button.close');
	if (closeButton) header.insertBefore(button, closeButton);
	else header.appendChild(button);

	injectedJournalButtons.add(header);
}

function handleJournalRender(sheet, html) {
	injectJournalTransferButton(sheet, html);
}

Hooks.on('getApplicationHeaderButtons', (app, buttons) => {
	if (!game.user.isGM) return;
	const docName = app?.document?.documentName ?? app?.object?.documentName;
	if (docName !== 'JournalEntry') return;

	if (buttons.some((button) => button.class === 'dmc-journal-transfer-button')) return;

	buttons.unshift({
		label: 'PF2 Director Transfer',
		class: 'dmc-journal-transfer-button',
		icon: 'fas fa-file-arrow-up',
		onclick: () => getTransferApp().render(true, { focus: true }),
	});
});

Hooks.on('renderJournalSheet', handleJournalRender);
Hooks.on('renderJournalEntrySheet', handleJournalRender);
Hooks.on('renderJournalEntrySheet5e', handleJournalRender);
Hooks.on('renderMetaMorphicJournalEntrySheet', handleJournalRender);
Hooks.on('renderEnhancedJournal', handleJournalRender);

Hooks.on('closeApplication', (app) => {
	if (app !== transferApp) return;
	transferApp = null;
});

Hooks.once('ready', () => {
	game[MODULE_ID] ??= {};
	game[MODULE_ID].openTransferApp = () => getTransferApp().render(true, { focus: true });
});

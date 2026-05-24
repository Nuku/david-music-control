import { MODULE_ID } from './settings.js';
import {
	exportMusicConfig,
	importMusicConfig,
	importMusicConfigFromText,
	stringifyMusicConfig,
} from './transfer.js';

function randomId() {
	return foundry.utils.randomID();
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

function buildSubsystemExportFromJournalText(text) {
	const normalized = String(text ?? '');
	if (/\bResearch Checks\b/i.test(normalized) && /\bResearch\s+\d+\b/i.test(normalized)) {
		return buildResearchExportFromJournalText(text);
	}
	return buildInfluenceExportFromJournalText(text);
}

function downloadSubsystemExport(text) {
	const json = JSON.stringify(buildSubsystemExportFromJournalText(text), null, 2);
	const name = splitPlainTextLines(text)[0] || game.world.id || 'subsystems';
	saveDataToFile(json, 'application/json', `${name.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'subsystems'}.subsystems.json`);
	ui.notifications.info('PF2 Director | Subsystem export downloaded.');
}

class JournalTransferApp extends FormApplication {
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id: 'dmc-journal-transfer',
			title: 'PF2 Director Transfer',
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
			json: stringifyMusicConfig(),
			journalText: '',
		};
	}

	activateListeners(html) {
		super.activateListeners(html);

		html.find('[data-action="export-file"]').on('click', (event) => {
			event.preventDefault();
			exportMusicConfig();
		});

		html.find('[data-action="import-file"]').on('click', (event) => {
			event.preventDefault();
			importMusicConfig();
		});

		html.find('[data-action="refresh-json"]').on('click', (event) => {
			event.preventDefault();
			this.render();
		});

		html.find('[data-action="copy-json"]').on('click', async (event) => {
			event.preventDefault();
			const textarea = html.find('[name="musicJson"]').get(0);
			const value = textarea?.value?.trim() ?? '';
			if (!value) return;
			try {
				await navigator.clipboard.writeText(value);
				ui.notifications.info('PF2 Director | JSON copied to clipboard.');
			} catch (error) {
				console.warn('PF2 Director | Could not write to clipboard:', error);
				textarea?.focus();
				textarea?.select();
				ui.notifications.warn('PF2 Director | Clipboard write failed. JSON selected instead.');
			}
		});

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
	}

	async _updateObject(_event, formData) {
		const payload = String(formData.musicJson ?? '').trim();
		if (!payload) {
			ui.notifications.warn('PF2 Director | Paste a music config JSON payload first.');
			return;
		}

		try {
			await importMusicConfigFromText(payload);
			this.render();
		} catch (error) {
			ui.notifications.error(error.message || 'PF2 Director | Import failed.');
		}
	}
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

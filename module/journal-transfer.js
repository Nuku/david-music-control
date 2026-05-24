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

function parseInfluenceThresholds(lines) {
	const joined = lines.join('\n');
	const matches = [...joined.matchAll(/Influence\s+(\d+)\s+([\s\S]*?)(?=\nInfluence\s+\d+\s+|$)/g)];
	return matches.map((match) => ({
		points: Number(match[1]),
		description: normalizeWhitespace(match[2]),
	}));
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
			hidden: false,
			skill: item.skill,
			dc: item.dc,
			lore: item.lore,
		})),
		influence: makeOrderedCollection(influenceEntries, (item, index) => ({
			id: randomId(),
			position: index + 1,
			name: `Influence ${item.points}`,
			hidden: false,
			description: `<p>${item.description}</p>`,
			influence: item.points,
		})),
		weaknesses: weaknessText ? (() => {
			const id = randomId();
			return {
				[id]: {
					id,
				position: 1,
				name: 'Weaknesses',
				hidden: false,
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
				hidden: false,
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

function downloadSubsystemExport(text) {
	const json = JSON.stringify(buildInfluenceExportFromJournalText(text), null, 2);
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
				output.value = JSON.stringify(buildInfluenceExportFromJournalText(journalText), null, 2);
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

function getTransferApp() {
	if (!transferApp) transferApp = new JournalTransferApp();
	return transferApp;
}

function isJournalApp(app) {
	const docName = app?.document?.documentName ?? app?.object?.documentName;
	return docName === 'JournalEntry';
}

Hooks.on('getApplicationHeaderButtons', (app, buttons) => {
	if (!game.user.isGM) return;
	if (!isJournalApp(app)) return;

	if (buttons.some((button) => button.class === 'dmc-journal-transfer-button')) return;

	buttons.unshift({
		label: 'PF2 Director Transfer',
		class: 'dmc-journal-transfer-button',
		icon: 'fas fa-file-arrow-up',
		onclick: () => getTransferApp().render(true, { focus: true }),
	});
});

Hooks.on('closeApplication', (app) => {
	if (app !== transferApp) return;
	transferApp = null;
});

Hooks.once('ready', () => {
	game[MODULE_ID] ??= {};
	game[MODULE_ID].openTransferApp = () => getTransferApp().render(true, { focus: true });
});

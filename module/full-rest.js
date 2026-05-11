import { MODULE_ID, getSetting } from './settings.js';

function isEnabled() {
	return game.user.isGM && getSetting('enableFullRest');
}

function getPartyMembers() {
	const party = game.actors?.party ?? game.actors?.find((actor) => actor.type === 'party');
	if (party?.members?.length) {
		return party.members.filter((member) => member?.type === 'character');
	}

	return game.actors.filter((actor) => actor.type === 'character' && actor.hasPlayerOwner);
}

async function fullRestoreActor(actor) {
	const result = { name: actor.name, hpHealed: 0, fpRestored: 0 };

	const hpData = actor.system?.attributes?.hp;
	if (hpData) {
		const maxHp = hpData.max ?? 0;
		const currentHp = hpData.value ?? 0;
		const healed = maxHp - currentHp;
		if (healed > 0) {
			await actor.update({ 'system.attributes.hp.value': maxHp });
			result.hpHealed = healed;
		}

		const wounded = actor.itemTypes?.condition?.find((condition) => condition.slug === 'wounded');
		if (wounded) await wounded.delete();
	}

	const focusData = actor.system?.resources?.focus;
	if (focusData) {
		const maxFocus = focusData.max ?? 0;
		const currentFocus = focusData.value ?? 0;
		const restored = maxFocus - currentFocus;
		if (restored > 0) {
			await actor.update({ 'system.resources.focus.value': maxFocus });
			result.fpRestored = restored;
		}
	}

	return result;
}

function buildReportHtml(results) {
	const healed = results.filter((result) => result.hpHealed > 0).sort((a, b) => b.hpHealed - a.hpHealed);
	const focused = results
		.filter((result) => result.fpRestored > 0)
		.sort((a, b) => b.fpRestored - a.fpRestored);
	const totalHp = results.reduce((sum, result) => sum + result.hpHealed, 0);
	const totalFp = results.reduce((sum, result) => sum + result.fpRestored, 0);
	const mostHealed = healed[0] ?? null;
	const mostFocused = focused[0] ?? null;

	const actorRow = (result, key, unit) => `
		<div class="rest-actor-row">
			<span class="rest-actor-name" title="${result.name}">${result.name}</span>
			<span class="rest-actor-value${result[key] === 0 ? ' zero' : ''}">+${result[key]} ${unit}</span>
		</div>
	`;

	const mvpBox = (actor, value, unit, icon) =>
		actor
			? `
				<div class="rest-mvp-box">
					<i class="fas ${icon}"></i>
					<div>
						<div class="mvp-label">Most ${unit === 'HP' ? 'Healed' : 'Focus Restored'}</div>
						<div class="mvp-name">${actor.name}</div>
						<div class="mvp-value">+${value} ${unit}</div>
					</div>
				</div>
			`
			: '';

	return `
		<div class="pf2e-full-rest-report">
			${mvpBox(mostHealed, mostHealed?.hpHealed, 'HP', 'fa-heart')}
			${mvpBox(mostFocused, mostFocused?.fpRestored, 'FP', 'fa-star')}
			<h3><i class="fas fa-heart"></i> HP Restored</h3>
			${
				healed.length
					? `
						<div class="rest-summary-grid">${healed.map((result) => actorRow(result, 'hpHealed', 'HP')).join('')}</div>
						<div class="rest-total-row">
							<span>Total HP Healed</span>
							<span style="color:#40916c">+${totalHp} HP</span>
						</div>
					`
					: '<p class="rest-no-data">Everyone was already at full health.</p>'
			}
			<h3><i class="fas fa-star"></i> Focus Points Restored</h3>
			${
				focused.length
					? `
						<div class="rest-summary-grid">${focused.map((result) => actorRow(result, 'fpRestored', 'FP')).join('')}</div>
						<div class="rest-total-row">
							<span>Total FP Restored</span>
							<span style="color:#40916c">+${totalFp} FP</span>
						</div>
					`
					: '<p class="rest-no-data">No focus points needed restoring.</p>'
			}
		</div>
	`;
}

async function showRestReport(results) {
	const content = buildReportHtml(results);

	if (foundry.applications?.api?.DialogV2) {
		await foundry.applications.api.DialogV2.prompt({
			window: {
				title: 'Full Rest - Party Report',
				contentClasses: ['pf2e-full-rest-dialog'],
				resizable: true,
			},
			content,
			ok: {
				label: 'Close',
				icon: 'fas fa-check',
			},
			position: {
				width: 460,
			},
		}).catch(() => null);
		return;
	}

	await Dialog.prompt({
		title: 'Full Rest - Party Report',
		content,
		label: 'Close',
		rejectClose: false,
		options: { width: 460, classes: ['dialog', 'pf2e-full-rest-dialog'] },
	});
}

async function doFullRest() {
	if (!game.user.isGM) {
		ui.notifications.warn('Only the GM can use Full Rest.');
		return;
	}

	const members = getPartyMembers();
	if (!members.length) {
		ui.notifications.warn('No party members found.');
		return;
	}

	ui.notifications.info(`Full Rest: restoring ${members.length} party member(s)...`);

	const results = [];
	for (const actor of members) {
		try {
			results.push(await fullRestoreActor(actor));
		} catch (error) {
			console.error(`${MODULE_ID} | Error restoring ${actor.name}:`, error);
			ui.notifications.error(`Error restoring ${actor.name}. Check the console.`);
		}
	}

	const totalHp = results.reduce((sum, result) => sum + result.hpHealed, 0);
	const totalFp = results.reduce((sum, result) => sum + result.fpRestored, 0);
	const chatLines = results
		.map((result) => {
			const parts = [];
			if (result.hpHealed > 0) parts.push(`+${result.hpHealed} HP`);
			if (result.fpRestored > 0) parts.push(`+${result.fpRestored} FP`);
			return parts.length
				? `<li><strong>${result.name}</strong>: ${parts.join(', ')}</li>`
				: `<li><strong>${result.name}</strong>: already fully rested</li>`;
		})
		.join('');

	await ChatMessage.create({
		speaker: { alias: 'Full Rest' },
		content: `
			<div style="font-family:'Signika',sans-serif;">
				<h3 style="border-bottom:1px solid #52b788;color:#2d6a4f;padding-bottom:4px;">
					<i class="fas fa-heart"></i> The party patches up after the fight...
				</h3>
				<ul style="margin:4px 0 8px 16px;padding:0;">${chatLines}</ul>
				<p style="color:#6c757d;font-size:11px;margin:0;">
					Total restored - HP: <strong>${totalHp}</strong> | Focus: <strong>${totalFp}</strong>
				</p>
			</div>`,
	});

	await showRestReport(results);
}

function injectPartySheetButton(_app, html) {
	if (!isEnabled()) return;
	if (html.find('.pf2e-full-rest-btn').length) return;

	const headerButtons = html.find('.window-header .header-buttons, .sheet-navigation, .party-header-actions');
	const button = $(`
		<button class="pf2e-full-rest-btn" type="button" title="Heal party to full HP and restore all focus points">
			<i class="fas fa-heart"></i> Recover
		</button>
	`);

	button.on('click', (event) => {
		event.preventDefault();
		event.stopPropagation();
		doFullRest();
	});

	if (headerButtons.length) headerButtons.first().prepend(button);
	else html.find('.window-header').append(button);
}

function registerApi() {
	const module = game.modules.get(MODULE_ID);
	if (!module) return;

	module.api = {
		...(module.api ?? {}),
		fullRest: {
			run: doFullRest,
		},
	};
}

Hooks.once('ready', registerApi);
Hooks.on('renderPartySheetPF2e', (_app, html) => {
	injectPartySheetButton(_app, html);
});
Hooks.on('renderApplication', (app, html) => {
	if (!app.constructor?.name?.toLowerCase().includes('party')) return;
	injectPartySheetButton(app, html);
});

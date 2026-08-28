import { MODULE_ID, getSetting, setSetting } from './settings.js';

const ITEM_PILES_ID = 'item-piles';
const PILE_FLAGS_PATH = 'flags.item-piles.data';

function itemPilesApi() {
	return game.modules.get(ITEM_PILES_ID)?.active ? globalThis.game?.itempiles?.API : null;
}

function getParty() {
	return game.actors?.party ?? game.actors?.find?.((actor) => actor.type === 'party');
}

function stashEnabled() {
	return !!getSetting('enablePartyStashMerchant') && !!itemPilesApi();
}

async function syncPartyStash() {
	if (!game.user.isGM) return;
	const party = getParty();
	const api = itemPilesApi();
	if (!party || !api) return;

	const enabled = !!getSetting('enablePartyStashMerchant');
	const currentFlags = foundry.utils.deepClone(foundry.utils.getProperty(party, PILE_FLAGS_PATH) ?? null);
	const managed = !!getSetting('partyStashItemPilesManaged');

	if (enabled) {
		if (api.isItemPileMerchant(party)) return;
		if (!managed) {
			await setSetting('partyStashItemPilesBackup', JSON.stringify(currentFlags));
			await setSetting('partyStashItemPilesManaged', true);
		}
		await party.update({
			[`${PILE_FLAGS_PATH}.enabled`]: true,
			[`${PILE_FLAGS_PATH}.type`]: 'merchant',
			[`${PILE_FLAGS_PATH}.infiniteQuantity`]: false,
			[`${PILE_FLAGS_PATH}.infiniteCurrencies`]: false,
			[`${PILE_FLAGS_PATH}.shareItemsEnabled`]: true,
			[`${PILE_FLAGS_PATH}.shareCurrenciesEnabled`]: true,
		});
		return;
	}

	if (!managed) return;
	let backup = null;
	try {
		backup = JSON.parse(getSetting('partyStashItemPilesBackup') || 'null');
	} catch (_error) {
		console.warn(`${MODULE_ID} | Party stash backup was invalid; removing the managed Item Piles flags.`);
	}

	const restore = backup
		? { [PILE_FLAGS_PATH]: backup }
		: { 'flags.item-piles.-=data': null };
	await party.update(restore);
	await setSetting('partyStashItemPilesBackup', '');
	await setSetting('partyStashItemPilesManaged', false);
}

async function openPartyStash(event) {
	event?.preventDefault?.();
	event?.stopPropagation?.();
	const party = getParty();
	const api = itemPilesApi();
	if (!party || !api || !stashEnabled()) return;
	try {
		await api.renderItemPileInterface(party, { useDefaultCharacter: true });
	} catch (error) {
		console.error(`${MODULE_ID} | Unable to open the party stash:`, error);
		ui.notifications.error('Unable to open the party stash. Check the console for details.');
	}
}

function addPartyStashHeaderButton(app, buttons) {
	if (!stashEnabled() || !Array.isArray(buttons)) return;
	const actor = app?.actor ?? app?.document;
	if (actor?.type !== 'party' || buttons.some((button) => button.class === 'dmc-party-stash')) return;
	buttons.unshift({
		label: 'Party Stash',
		class: 'dmc-party-stash',
		icon: 'fas fa-coins',
		onclick: () => openPartyStash(),
	});
}

function injectPartyStashButton(_app, html) {
	if (!stashEnabled()) return;
	const root = html instanceof HTMLElement ? html : html?.[0];
	if (!root || root.querySelector('.dmc-party-stash-btn')) return;

	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'dmc-party-stash-btn';
	button.title = 'Open the party stash merchant';
	button.innerHTML = '<i class="fas fa-coins"></i> Party Stash';
	button.addEventListener('click', openPartyStash);

	const headerButtons = root.querySelector('.window-header .header-buttons, .sheet-navigation, .party-header-actions');
	if (headerButtons) headerButtons.prepend(button);
	else root.querySelector('.window-header')?.append(button);
}

globalThis.PF2DirectorPartyStash = { sync: syncPartyStash };
Hooks.once('ready', syncPartyStash);
Hooks.on('getActorSheetHeaderButtons', addPartyStashHeaderButton);
Hooks.on('renderPartySheetPF2e', injectPartyStashButton);
Hooks.on('renderApplication', (app, html) => {
	if (app.constructor?.name?.toLowerCase().includes('party')) injectPartyStashButton(app, html);
});

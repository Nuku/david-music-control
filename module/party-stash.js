import { MODULE_ID, getSetting, setSetting } from './settings.js';

const ITEM_PILES_ID = 'item-piles';
const PILE_FLAGS_PATH = 'flags.item-piles.data';

function itemPilesApi() {
	return game.modules.get(ITEM_PILES_ID)?.active ? game.itempiles?.API : null;
}

function getParty() {
	return game.actors?.party ?? game.actors?.find?.((actor) => actor.type === 'party');
}

function stashEnabled() {
	const settingKey = `${MODULE_ID}.enablePartyStashMerchant`;
	const hasStoredSetting = game.settings.storage?.get('world')?.has(settingKey);
	const enabled = hasStoredSetting ? getSetting('enablePartyStashMerchant') : game.modules.get(ITEM_PILES_ID)?.active;
	return !!enabled && !!itemPilesApi();
}

async function restoreLegacyPartyMerchant() {
	if (!game.user.isGM || !itemPilesApi() || !getSetting('partyStashItemPilesManaged')) return;
	const party = getParty();
	if (!party) return;

	let backup = null;
	try {
		backup = JSON.parse(getSetting('partyStashItemPilesBackup') || 'null');
	} catch (_error) {
		console.warn(`${MODULE_ID} | Ignoring invalid legacy party stash backup.`);
	}

	await party.update(backup ? { [PILE_FLAGS_PATH]: backup } : { 'flags.item-piles.-=data': null });
	await setSetting('partyStashItemPilesBackup', '');
	await setSetting('partyStashItemPilesManaged', false);
}

function getMerchantStore(app) {
	return app?.svelte?.applicationShell?.store ?? null;
}

function usePartyStash(app, event) {
	event?.preventDefault?.();
	event?.stopPropagation?.();
	const party = getParty();
	const store = getMerchantStore(app);
	if (!party || !store?.updateRecipient) {
		ui.notifications.warn('The party stash is not available for this merchant.');
		return;
	}
	if (store.recipient?.id === party.id) return;
	store.updateRecipient(party);
	app.recipient = party;
}

function addMerchantPartyStashButton(app, html) {
	if (!stashEnabled() || !app?.merchant || app.merchant.type === 'party') return;
	const root = html instanceof HTMLElement ? html : html?.[0];
	if (!root || root.querySelector('.dmc-party-stash-merchant-btn')) return;

	const button = document.createElement('a');
	button.className = 'header-button control dmc-party-stash-merchant-btn';
	button.dataset.tooltip = 'Use Party Stash';
	button.setAttribute('role', 'button');
	button.innerHTML = '<i class="fas fa-coins"></i>';
	button.addEventListener('click', (event) => usePartyStash(app, event));

	const header = root.querySelector('header.window-header');
	const closeButton = header?.querySelector('.header-button.close');
	if (closeButton) closeButton.before(button);
}

Hooks.once('ready', restoreLegacyPartyMerchant);
Hooks.on('renderApplication', addMerchantPartyStashButton);

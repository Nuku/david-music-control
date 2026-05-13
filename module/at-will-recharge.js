import { getSetting } from './settings.js';

function isAtWill(item) {
	return /\(at will\)/i.test(item?.name ?? '');
}

async function maybeRestoreLocationUses(item, changes) {
	const changedUses = foundry.utils.getProperty(changes, 'system.location.uses.value');
	if (changedUses === undefined) return false;

	const uses = item.system?.location?.uses;
	if (!uses || !Number.isFinite(uses.max) || uses.max <= 0 || changedUses >= uses.max) return false;

	await item.update({ 'system.location.uses.value': uses.max });
	return true;
}

async function maybeRestoreFrequency(item, changes) {
	const changedValue = foundry.utils.getProperty(changes, 'system.frequency.value');
	if (changedValue === undefined) return false;

	const frequency = item.system?.frequency;
	if (!frequency || !Number.isFinite(frequency.max) || frequency.max <= 0 || changedValue >= frequency.max) return false;

	await item.update({ 'system.frequency.value': frequency.max });
	return true;
}

Hooks.on('updateItem', async (item, changes, _options, userId) => {
	if (!getSetting('enableAtWillRecharge')) return;
	if (game.user.id !== userId && !game.user.isGM) return;
	if (!item.isOwner || !isAtWill(item)) return;

	if (await maybeRestoreLocationUses(item, changes)) return;
	await maybeRestoreFrequency(item, changes);
});

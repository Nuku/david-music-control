import { MODULE_ID, getSetting } from './settings.js';

const disguiseFlag = 'dragonColorRandomization';
const pending = new Set();

function dragonType(actor) {
	const type = actor?.system?.details?.creatureType?.value
		?? actor?.system?.details?.creatureType
		?? actor?.system?.details?.type?.value
		?? actor?.system?.details?.type;
	const traits = actor?.system?.traits?.value ?? [];
	return /dragon/i.test(`${actor?.name ?? ''} ${type ?? ''} ${traits.join(' ')}`);
}

async function getDragonDisguises(actor) {
	const options = [];
	for (const pack of game.packs ?? []) {
		if (!pack.documentName || !['Actor', 'NPC'].includes(pack.documentName)) continue;
		try {
			const index = await pack.getIndex({ fields: ['name', 'img', 'type', 'system.details.creatureType', 'system.details.type', 'system.traits'] });
			for (const entry of index) {
				if (entry._id === actor.id || entry.name === actor.name) continue;
				const traits = entry.system?.traits?.value ?? [];
				const type = entry.system?.details?.creatureType?.value ?? entry.system?.details?.creatureType ?? entry.system?.details?.type?.value ?? entry.system?.details?.type ?? '';
				if (!/dragon/i.test(`${entry.name ?? ''} ${type} ${traits.join(' ')}`)) continue;
				options.push({ name: entry.name, img: entry.img, uuid: `Compendium.${pack.collection}.${entry._id}` });
			}
		} catch (error) {
			console.debug(`PF2 Director | Could not inspect dragon compendium ${pack.collection}`, error);
		}
	}
	return options;
}

Hooks.on('createToken', (token) => {
	if (!game.user.isGM || !getSetting('dragonColorRandomization') || !token.actor || !dragonType(token.actor)) return;
	const uuid = token.uuid;
	if (pending.has(uuid)) return;
	pending.add(uuid);
	void (async () => {
		try {
			const choices = await getDragonDisguises(token.actor);
			if (!choices.length || !token.parent || token.parent.tokens.get(token.id) !== token) return;
			const disguise = choices[Math.floor(Math.random() * choices.length)];
			await token.update({ name: disguise.name, texture: { src: disguise.img }, [`flags.${MODULE_ID}.${disguiseFlag}`]: disguise.uuid });
		} catch (error) {
			console.error('PF2 Director | Dragon color randomization failed:', error);
		} finally {
			pending.delete(uuid);
		}
	})();
});

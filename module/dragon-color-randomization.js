import { MODULE_ID, getSetting } from './settings.js';

const disguiseFlag = 'dragonColorRandomization';
const pending = new Set();
let dragonDisguisesPromise;

function hasUsableTokenArt(src) {
	if (typeof src !== 'string' || !src.trim()) return false;
	return !/(?:^|\/)(?:default-icons|icons\/svg)\//i.test(src.trim());
}

function dragonType(actor) {
	const type = actor?.system?.details?.creatureType?.value
		?? actor?.system?.details?.creatureType
		?? actor?.system?.details?.type?.value
		?? actor?.system?.details?.type;
	const traits = actor?.system?.traits?.value ?? [];
	return /dragon/i.test(`${actor?.name ?? ''} ${type ?? ''} ${traits.join(' ')}`);
}

async function loadDragonDisguises() {
	const options = [];
	for (const pack of game.packs ?? []) {
		if (!pack.documentName || !['Actor', 'NPC'].includes(pack.documentName)) continue;
		try {
			const index = await pack.getIndex({
				fields: [
					'name',
					'img',
					'type',
					'system.details.creatureType.value',
					'system.details.type.value',
					'system.traits.value',
					'prototypeToken.texture.src',
				],
			});
			for (const entry of index) {
				const traits = entry.system?.traits?.value ?? entry['system.traits.value'] ?? [];
				const type = entry.system?.details?.creatureType?.value ?? entry.system?.details?.creatureType ?? entry.system?.details?.type?.value ?? entry.system?.details?.type ?? '';
				if (!/dragon/i.test(`${entry.name ?? ''} ${type} ${traits.join(' ')}`)) continue;
				let img = entry.prototypeToken?.texture?.src ?? entry['prototypeToken.texture.src'];
				let actorImg = entry.img;
				if (!hasUsableTokenArt(img)) {
					const actorDocument = await pack.getDocument(entry._id);
					img = actorDocument?.prototypeToken?.texture?.src;
					actorImg = actorDocument?.img ?? actorImg;
				}
				if (!entry.name || !hasUsableTokenArt(img)) continue;
				options.push({
					name: entry.name,
					img,
					actorImg: hasUsableTokenArt(actorImg) ? actorImg : img,
					uuid: `Compendium.${pack.collection}.${entry._id}`,
					id: entry._id,
				});
			}
		} catch (error) {
			console.debug(`PF2 Director | Could not inspect dragon compendium ${pack.collection}`, error);
		}
	}
	return options;
}

function getDragonDisguises(actor) {
	dragonDisguisesPromise ??= loadDragonDisguises().catch((error) => {
		dragonDisguisesPromise = null;
		throw error;
	});
	return dragonDisguisesPromise.then((options) => options.filter((option) => option.id !== actor.id && option.name !== actor.name));
}

async function revealPendingToken(token) {
	const originalAlpha = token.getFlag(MODULE_ID, 'dragonColorRandomizationOriginalAlpha');
	if (originalAlpha === undefined) return;
	await token.update({
		alpha: originalAlpha,
		[`flags.${MODULE_ID}.-=dragonColorRandomizationOriginalAlpha`]: null,
	});
}

Hooks.on('preCreateToken', (token) => {
	if (!game.user.isGM || !getSetting('dragonColorRandomization') || !dragonType(token.actor)) return;
	const originalAlpha = token.alpha ?? 1;
	token.updateSource({
		alpha: 0,
		flags: { [MODULE_ID]: { dragonColorRandomizationOriginalAlpha: originalAlpha } },
	});
});

Hooks.on('createToken', (token) => {
	if (!game.user.isGM || !getSetting('dragonColorRandomization') || !token.actor || !dragonType(token.actor)) {
		void revealPendingToken(token).catch((error) => console.error('PF2 Director | Could not reveal pending dragon token:', error));
		return;
	}
	const uuid = token.uuid;
	if (pending.has(uuid)) return;
	pending.add(uuid);
	void (async () => {
		try {
			const choices = await getDragonDisguises(token.actor);
			if (!choices.length) {
				console.warn('PF2 Director | No dragon actors with usable token art were found in installed compendiums.');
			} else if (token.parent?.tokens?.get(token.id)) {
				const disguise = choices[Math.floor(Math.random() * choices.length)];
				await token.actor.update({ img: disguise.actorImg });
				await token.update({
					name: disguise.name,
					texture: { src: disguise.img },
					[`flags.${MODULE_ID}.${disguiseFlag}`]: disguise.uuid,
				});
			}
		} catch (error) {
			console.error('PF2 Director | Dragon color randomization failed:', error);
		} finally {
			await revealPendingToken(token).catch((error) => console.error('PF2 Director | Could not reveal randomized dragon token:', error));
			pending.delete(uuid);
		}
	})();
});

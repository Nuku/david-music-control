import { MODULE_ID, getSetting } from './settings.js';

const disguiseFlag = 'dragonColorRandomization';
const pending = new Set();
const usedDisguisesByActor = new Map();
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
	const seenImages = new Set();
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
					'prototypeToken.texture.scaleX',
					'prototypeToken.texture.scaleY',
				],
			});
			for (const entry of index) {
				const traits = entry.system?.traits?.value ?? entry['system.traits.value'] ?? [];
				const type = entry.system?.details?.creatureType?.value ?? entry.system?.details?.creatureType ?? entry.system?.details?.type?.value ?? entry.system?.details?.type ?? '';
				if (!/dragon/i.test(`${entry.name ?? ''} ${type} ${traits.join(' ')}`)) continue;
				let img = entry.prototypeToken?.texture?.src ?? entry['prototypeToken.texture.src'];
				let scaleX = entry.prototypeToken?.texture?.scaleX ?? entry['prototypeToken.texture.scaleX'];
				let scaleY = entry.prototypeToken?.texture?.scaleY ?? entry['prototypeToken.texture.scaleY'];
				let actorImg = entry.img;
				if (!hasUsableTokenArt(img) || scaleX === undefined || scaleY === undefined) {
					const actorDocument = await pack.getDocument(entry._id);
					img = actorDocument?.prototypeToken?.texture?.src ?? img;
					scaleX = actorDocument?.prototypeToken?.texture?.scaleX ?? scaleX;
					scaleY = actorDocument?.prototypeToken?.texture?.scaleY ?? scaleY;
					actorImg = actorDocument?.img ?? actorImg;
				}
				if (!entry.name || !hasUsableTokenArt(img) || seenImages.has(img)) continue;
				seenImages.add(img);
				options.push({
					name: entry.name,
					img,
					scaleX: Number.isFinite(Number(scaleX)) ? Number(scaleX) : 1,
					scaleY: Number.isFinite(Number(scaleY)) ? Number(scaleY) : 1,
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

function chooseDisguise(actor, choices) {
	const key = actor._stats?.compendiumSource ?? actor.uuid ?? actor.name;
	let used = usedDisguisesByActor.get(key);
	if (!used) {
		used = new Set();
		usedDisguisesByActor.set(key, used);
	}
	let available = choices.filter((choice) => !used.has(choice.img));
	if (!available.length) {
		used.clear();
		available = choices;
	}
	const choice = available[Math.floor(Math.random() * available.length)];
	used.add(choice.img);
	return choice;
}

async function revealPendingToken(token) {
	const currentToken = token.parent?.tokens?.get(token.id) ?? token;
	const originalAlpha = currentToken.getFlag(MODULE_ID, 'dragonColorRandomizationOriginalAlpha');
	if (originalAlpha === undefined) return;
	const changes = { alpha: originalAlpha };
	const ForcedDeletion = foundry?.data?.operators?.ForcedDeletion;
	if (ForcedDeletion) {
		changes[`flags.${MODULE_ID}.dragonColorRandomizationOriginalAlpha`] = new ForcedDeletion();
	} else {
		changes[`flags.${MODULE_ID}.-=dragonColorRandomizationOriginalAlpha`] = null;
	}
	await currentToken.update(changes);
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
			const currentImage = token.texture?.src;
			const choices = (await getDragonDisguises(token.actor)).filter((choice) => choice.img !== currentImage);
			if (choices.length < 2) {
				console.warn(`PF2 Director | Found ${choices.length} distinct dragon disguise image(s) for ${token.actor.name}.`);
			}
			if (!choices.length) {
				console.warn('PF2 Director | No dragon actors with usable token art were found in installed compendiums.');
			} else if (token.parent?.tokens?.get(token.id)) {
				const disguise = chooseDisguise(token.actor, choices);
				await token.actor.update({
					img: disguise.actorImg,
					'prototypeToken.texture.src': disguise.img,
					'prototypeToken.texture.scaleX': disguise.scaleX,
					'prototypeToken.texture.scaleY': disguise.scaleY,
				});
				const currentToken = token.parent.tokens.get(token.id) ?? token;
				await currentToken.update({
					name: disguise.name,
					'texture.src': disguise.img,
					'texture.scaleX': disguise.scaleX,
					'texture.scaleY': disguise.scaleY,
					[`flags.${MODULE_ID}.${disguiseFlag}`]: disguise.uuid,
					[`flags.${MODULE_ID}.dragonColorRandomizationImage`]: disguise.img,
				});
				const updatedToken = token.parent.tokens.get(token.id) ?? currentToken;
				updatedToken.object?.refresh?.();
				if (updatedToken.texture?.src !== disguise.img) {
					console.error(`PF2 Director | Token art did not update. Expected ${disguise.img}; token stores ${updatedToken.texture?.src}.`);
				}
			}
		} catch (error) {
			console.error('PF2 Director | Dragon color randomization failed:', error);
		} finally {
			await revealPendingToken(token).catch((error) => console.error('PF2 Director | Could not reveal randomized dragon token:', error));
			pending.delete(uuid);
		}
	})();
});

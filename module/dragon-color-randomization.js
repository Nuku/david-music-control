import { MODULE_ID, getSetting } from './settings.js';

const disguiseFlag = 'dragonColorRandomization';
const imageFlag = 'dragonColorRandomizationImage';
const originalAlphaFlag = 'dragonColorRandomizationOriginalAlpha';
const artOverrideKeys = new Set([
	'texture.src', 'texture.scaleX', 'texture.scaleY', 'texture.animation', 'ring', 'ring.subject',
]);
const pending = new Set();
const usedDisguisesByActor = new Map();
let dragonDisguisesPromise;

function hasUsableTokenArt(src) {
	if (typeof src !== 'string' || !src.trim()) return false;
	return !/(?:^|\/)(?:default-icons|icons\/svg)\//i.test(src.trim());
}

Hooks.once('init', () => {
	if (!['pf2e', 'sf2e'].includes(game.system.id)) return;
	const prototype = CONFIG.Token.documentClass.prototype;
	const applyActiveEffects = prototype.applyActiveEffects;
	if (typeof applyActiveEffects === 'function') {
		prototype.applyActiveEffects = function (phase, ...args) {
			const moduleFlags = this._source.flags?.[MODULE_ID];
			const effects = this.actor?.tokenActiveEffectChanges;
			const changes = effects?.[phase];
			if (!changes?.length || !moduleFlags?.[imageFlag]) {
				return applyActiveEffects.call(this, phase, ...args);
			}

			// V14 applies TokenImage rules after loading the scene token's saved art.
			// Keep the suppression local to this token, including when its actor is shared.
			effects[phase] = changes.filter(({ key }) => !artOverrideKeys.has(key) && !key?.startsWith?.('ring.subject.'));
			try {
				return applyActiveEffects.call(this, phase, ...args);
			} finally {
				effects[phase] = changes;
			}
		};
	} else {
		const prepareBaseData = prototype.prepareBaseData;
		prototype.prepareBaseData = function (...args) {
			const source = this._source;
			const tokenOverrides = source.flags?.[MODULE_ID]?.[imageFlag] && this.actor?.synthetics?.tokenOverrides;
			if (!tokenOverrides) return prepareBaseData.apply(this, args);

			// V13 reads these same appearance overrides during base data preparation.
			const synthetics = this.actor.synthetics;
			const { texture, ring, ...otherOverrides } = tokenOverrides;
			synthetics.tokenOverrides = otherOverrides;
			try {
				return prepareBaseData.apply(this, args);
			} finally {
				synthetics.tokenOverrides = tokenOverrides;
			}
		};
	}
});

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
					'prototypeToken.ring.subject.texture',
				],
			});
			for (const entry of index) {
				const traits = entry.system?.traits?.value ?? entry['system.traits.value'] ?? [];
				const type = entry.system?.details?.creatureType?.value ?? entry.system?.details?.creatureType ?? entry.system?.details?.type?.value ?? entry.system?.details?.type ?? '';
				if (!/dragon/i.test(`${entry.name ?? ''} ${type} ${traits.join(' ')}`)) continue;
				let img = entry.prototypeToken?.texture?.src ?? entry['prototypeToken.texture.src'];
				let scaleX = entry.prototypeToken?.texture?.scaleX ?? entry['prototypeToken.texture.scaleX'];
				let scaleY = entry.prototypeToken?.texture?.scaleY ?? entry['prototypeToken.texture.scaleY'];
				let ringTexture = entry.prototypeToken?.ring?.subject?.texture ?? entry['prototypeToken.ring.subject.texture'];
				let actorImg = entry.img;
				if (!hasUsableTokenArt(img) || scaleX === undefined || scaleY === undefined) {
					const actorDocument = await pack.getDocument(entry._id);
					img = actorDocument?.prototypeToken?.texture?.src ?? img;
					scaleX = actorDocument?.prototypeToken?.texture?.scaleX ?? scaleX;
					scaleY = actorDocument?.prototypeToken?.texture?.scaleY ?? scaleY;
					ringTexture = actorDocument?.prototypeToken?.ring?.subject?.texture ?? ringTexture;
					actorImg = actorDocument?.img ?? actorImg;
				}
				if (!entry.name || !hasUsableTokenArt(img) || seenImages.has(img)) continue;
				seenImages.add(img);
				options.push({
					name: entry.name,
					img,
					ringTexture: hasUsableTokenArt(ringTexture) ? ringTexture : null,
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
	const originalAlpha = currentToken.getFlag(MODULE_ID, originalAlphaFlag);
	if (originalAlpha === undefined) return;
	const changes = { alpha: originalAlpha };
	const ForcedDeletion = foundry?.data?.operators?.ForcedDeletion;
	if (ForcedDeletion) {
		changes[`flags.${MODULE_ID}.${originalAlphaFlag}`] = new ForcedDeletion();
	} else {
		changes[`flags.${MODULE_ID}.-=${originalAlphaFlag}`] = null;
	}
	await currentToken.update(changes);
}

Hooks.on('preCreateToken', (token) => {
	if (!game.user.isGM || !getSetting('dragonColorRandomization') || !dragonType(token.actor)) return;
	const originalAlpha = token.alpha ?? 1;
	token.updateSource({
		alpha: 0,
		flags: { [MODULE_ID]: { [originalAlphaFlag]: originalAlpha } },
	});
});

Hooks.on('createToken', (token, _options, userId) => {
	if (userId !== game.user.id) return;
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
				const currentToken = token.parent.tokens.get(token.id);
				await currentToken.update({
					name: disguise.name,
					texture: { src: disguise.img, scaleX: disguise.scaleX, scaleY: disguise.scaleY },
					'ring.subject.texture': disguise.ringTexture,
					[`flags.${game.system.id}.autoscale`]: false,
					[`flags.${MODULE_ID}.${disguiseFlag}`]: disguise.uuid,
					[`flags.${MODULE_ID}.${imageFlag}`]: disguise.img,
				});
				const updatedToken = token.parent.tokens.get(token.id) ?? currentToken;
				await updatedToken.actor?.update({ img: disguise.actorImg });
				if (updatedToken.texture?.src !== disguise.img) {
					console.error(`PF2 Director | Dragon disguise texture mismatch. Expected ${disguise.img}; saved ${updatedToken.toObject().texture?.src}; effective ${updatedToken.texture?.src}.`);
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

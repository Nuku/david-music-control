import { MODULE_ID } from './settings.js';

const SCENE_FLAG = 'disableRandomDoorLocks';
const WALL_FLAG = 'randomDoorChecked';
const TRAP_FLAG = 'randomDoorTrapped';
const TRAP_ACTOR_FLAG = 'randomDoorTrapActorId';
const TRAP_TRIGGERED_FLAG = 'randomDoorTrapTriggered';
const LOCKED_DOOR_STATE = 2;
const CLOSED_DOOR_STATE = 0;
const OPEN_DOOR_STATE = 1;
const SOCKET_EVENT = `module.${MODULE_ID}`;
const SOCKET_TYPE = 'dmc-random-door-request';
const HAZARD_ICON = 'systems/pf2e/icons/default-icons/hazard.svg';
const RANDOM_HAZARD_FLAG = 'randomDoorHazardBase';
const HAZARD_ATTACK_BONUS = [10, 11, 13, 14, 16, 17, 19, 20, 22, 23, 25, 26, 28, 29, 31, 32, 34, 35, 37, 38, 40, 41, 43, 44, 46, 47];
const HAZARD_DAMAGE = ['2d4+1', '2d6+3', '2d6+5', '2d10+7', '2d10+13', '4d8+10', '4d8+14', '4d8+18', '4d10+18', '4d10+22', '4d10+26', '4d12+26', '4d12+30', '6d10+27', '6d10+31', '6d10+35', '6d12+33', '6d12+35', '6d12+37', '6d12+41', '8d10+40', '8d10+44', '8d10+48', '8d10+52', '8d12+48', '8d12+52'];
const HAZARD_EXTREME_DC = [19, 19, 20, 22, 23, 25, 26, 27, 29, 30, 32, 33, 34, 36, 37, 39, 40, 41, 43, 44, 46, 47, 48, 50, 51, 52];
const HAZARD_HIGH_AC = [15, 16, 16, 18, 19, 21, 22, 24, 25, 27, 28, 30, 31, 33, 34, 36, 37, 39, 40, 42, 43, 45, 46, 48, 49, 51];
const HAZARD_HIGH_SAVE = [8, 9, 10, 11, 12, 14, 15, 17, 18, 19, 21, 22, 24, 25, 26, 28, 29, 30, 32, 33, 35, 36, 38, 39, 40, 42];
const HAZARD_HP = [12, 16, 24, 32, 44, 48, 52, 56, 60, 64, 68, 72, 80, 84, 88, 92, 96, 104, 112, 120, 128, 136, 148, 160, 172, 184];
const HAZARD_HARDNESS = [3, 4, 6, 8, 11, 12, 13, 14, 15, 16, 17, 18, 20, 21, 22, 23, 24, 26, 28, 30, 32, 34, 37, 40, 45, 48];
const DOOR_TRAPS = [
	{ name: 'Spring-Loaded Dart Trap', delivery: 'attack', damageType: 'piercing', attackName: 'Dart', trigger: 'A creature opens the door.', effect: 'The trap fires a dart at the creature that opened the door.' },
	{ name: 'Swinging Blade Trap', delivery: 'attack', damageType: 'slashing', attackName: 'Swinging Blade', trigger: 'A creature opens the door.', effect: 'A concealed blade swings at the creature that opened the door.' },
	{ name: 'Flame Jet Trap', delivery: 'reflex', damageType: 'fire', trigger: 'A creature opens the door.', effect: 'A jet of flame erupts beside the door.' },
	{ name: 'Acid Sprayer Trap', delivery: 'reflex', damageType: 'acid', trigger: 'A creature opens the door.', effect: 'A nozzle sprays burning acid at the creature that opened the door.' },
	{ name: 'Shocking Rune Trap', delivery: 'reflex', damageType: 'electricity', disableSkills: ['thievery', 'arcana', 'nature'], magical: true, trigger: 'A creature opens the door.', effect: 'A hidden rune discharges a crackling bolt of electricity.' },
	{ name: 'Crushing Lintel Trap', delivery: 'reflex', damageType: 'bludgeoning', trigger: 'A creature opens the door.', effect: 'A weighted stone lintel drops onto the creature that opened the door.' },
	{ name: 'Frost Vent Trap', delivery: 'reflex', damageType: 'cold', trigger: 'A creature opens the door.', effect: 'A freezing blast pours from a concealed vent.' },
	{ name: 'Poison Needle Trap', delivery: 'attack', damageType: 'piercing', attackName: 'Poison Needle', trigger: 'A creature opens the door.', effect: 'A poisoned needle snaps out at the creature that opened the door.' },
	{ name: 'Poison Gas Trap', delivery: 'poison-cloud', poisonExposure: 'inhaled', trigger: 'A creature opens the door.', effect: 'The trap releases an inhaled poison cloud in a 20-foot emanation from the door.' },
];

function isEnabled(scene = canvas?.scene) {
	return !!game.settings.get(MODULE_ID, 'randomlyLockedDoors') && scene?.getFlag?.(MODULE_ID, SCENE_FLAG) !== true;
}

function makeDoorLockMessage(wall) {
	void ChatMessage.create({
		speaker: ChatMessage.getSpeaker(),
		content: `<p>You find a locked door (Standard DC ${getPartyStandardDC()}).</p>`,
		flags: { [MODULE_ID]: { randomDoorLock: { sceneId: wall.parent.id, wallId: wall.id } } },
	});
}

function sendDoorLockRequest(sceneId, wallId, action) {
	game.socket?.emit?.(SOCKET_EVENT, { type: SOCKET_TYPE, sceneId, wallId, action, userId: game.user.id });
}

function getDirectlyConnectedDoors(scene, wall) {
	const [x1, y1, x2, y2] = wall.c ?? [];
	if (![x1, y1, x2, y2].every(Number.isFinite)) return [wall];
	const endpoints = [[x1, y1], [x2, y2]];
	return scene.walls.contents.filter((candidate) => {
		if (Number(candidate.door) < 1) return false;
		const [cx1, cy1, cx2, cy2] = candidate.c ?? [];
		if (![cx1, cy1, cx2, cy2].every(Number.isFinite)) return candidate.id === wall.id;
		return endpoints.some(([x, y]) => (x === cx1 && y === cy1) || (x === cx2 && y === cy2));
	});
}

async function handleDoorLockRequest(data) {
	if (!game.user.isGM || game.users.activeGM?.id !== game.user.id || data?.type !== SOCKET_TYPE) return;
	const requester = game.users.get(data.userId);
	const scene = game.scenes.get(data.sceneId);
	const wall = scene?.walls.get(data.wallId);
	if (!wall || Number(wall.door) < 1) return;
	if (!requester?.active || requester.isGM) return;

	if (data.action === 'attempt-open') {
		if (!isEnabled(scene)) return;
		if (Number(wall.ds) === LOCKED_DOOR_STATE) {
			if (wall.getFlag(MODULE_ID, WALL_FLAG)) makeDoorLockMessage(wall);
			return;
		}
		if (Number(wall.ds) === OPEN_DOOR_STATE || wall.getFlag(MODULE_ID, WALL_FLAG)) {
			if (Number(wall.ds) !== OPEN_DOOR_STATE) await wall.update({ ds: OPEN_DOOR_STATE });
			await notifyDoorTrapTriggered(wall);
			return;
		}

		const lockChance = Math.clamp(Number(game.settings.get(MODULE_ID, 'randomlyLockedDoorsChance')) || 0, 0, 100);
		const trapChance = Math.clamp(Number(game.settings.get(MODULE_ID, 'randomlyTrappedDoorsChance')) || 0, 0, 100);
		const locked = Math.random() * 100 < lockChance;
		const trapped = Math.random() * 100 < trapChance;
		const fate = locked ? LOCKED_DOOR_STATE : OPEN_DOOR_STATE;
		const connectedDoors = getDirectlyConnectedDoors(scene, wall);
		let trap = null;
		if (trapped) {
			try {
				trap = await createDoorTrap(scene, connectedDoors);
			} catch (error) {
				console.error(`[${MODULE_ID}] Failed to create a door trap actor:`, error);
			}
		}
		await Promise.all(connectedDoors.map((door) => door.update({
			ds: fate,
			[`flags.${MODULE_ID}.${WALL_FLAG}`]: true,
			[`flags.${MODULE_ID}.${TRAP_FLAG}`]: trapped && !!trap,
			...(trap ? {
				[`flags.${MODULE_ID}.${TRAP_ACTOR_FLAG}`]: trap.actorId,
				[`flags.${MODULE_ID}.randomDoorTrapTokenId`]: trap.tokenId,
			} : {}),
			[`flags.${MODULE_ID}.${TRAP_TRIGGERED_FLAG}`]: false,
		})));
		if (locked) makeDoorLockMessage(wall);
		if (trapped && trap) {
			await notifySearchingParty(scene, trap);
			if (!locked) await notifyDoorTrapTriggered(wall);
		}
		return;
	}

	if (
		['successful-thievery', 'successful-athletics'].includes(data.action) &&
		wall.getFlag(MODULE_ID, WALL_FLAG) && Number(wall.ds) === LOCKED_DOOR_STATE
	) {
		await wall.update({ ds: data.action === 'successful-athletics' ? OPEN_DOOR_STATE : CLOSED_DOOR_STATE });
		if (data.action === 'successful-athletics') await notifyDoorTrapTriggered(wall);
	}
}

async function applyGMSetDoorState(scene, wall, data) {
	const doors = data.includeConnected ? getDirectlyConnectedDoors(scene, wall) : [wall];
	let trap = null;
	if (data.trapState === 'trapped') {
		try {
			trap = await createDoorTrap(scene, doors);
		} catch (error) {
			console.error(`[${MODULE_ID}] Failed to create a door trap actor:`, error);
			ui.notifications.error('Could not create the door trap. Door settings were not changed.');
			return;
		}
		if (!trap) {
			ui.notifications.error('Could not create the door trap. Door settings were not changed.');
			return;
		}
	}

	const tokenIdsToDelete = data.trapState === 'clear'
		? [...new Set(doors.map((door) => door.getFlag(MODULE_ID, 'randomDoorTrapTokenId')).filter(Boolean))]
		: [];
	const lockState = data.lockState;
	const updates = doors.map((door) => {
		const update = { _id: door.id, [`flags.${MODULE_ID}.${WALL_FLAG}`]: true };
		if (lockState === 'locked') update.ds = LOCKED_DOOR_STATE;
		if (lockState === 'unlocked') update.ds = CLOSED_DOOR_STATE;
		if (data.trapState === 'trapped') {
			update[`flags.${MODULE_ID}.${TRAP_FLAG}`] = true;
			update[`flags.${MODULE_ID}.${TRAP_ACTOR_FLAG}`] = trap.actorId;
			update[`flags.${MODULE_ID}.randomDoorTrapTokenId`] = trap.tokenId;
			update[`flags.${MODULE_ID}.${TRAP_TRIGGERED_FLAG}`] = false;
		} else if (data.trapState === 'clear') {
			update[`flags.${MODULE_ID}.${TRAP_FLAG}`] = false;
			update[`flags.${MODULE_ID}.${TRAP_ACTOR_FLAG}`] = '';
			update[`flags.${MODULE_ID}.randomDoorTrapTokenId`] = '';
			update[`flags.${MODULE_ID}.${TRAP_TRIGGERED_FLAG}`] = false;
		}
		return update;
	});
	await scene.updateEmbeddedDocuments('Wall', updates);

	if (tokenIdsToDelete.length) await scene.deleteEmbeddedDocuments('Token', tokenIdsToDelete);
	if (lockState === 'locked') makeDoorLockMessage(wall);
	ui.notifications.info('Door settings updated.');
}

function openDoorSettingsDialog(wall) {
	const wallDocument = wall?.document ?? wall;
	if (!wallDocument || Number(wallDocument.door) < 1) return;
	new Dialog({
		title: `Set Door State: ${wallDocument.label ?? wallDocument.id}`,
		content: `<form>
			<div class="form-group"><label>Lock</label><select name="lockState"><option value="unchanged">Leave unchanged</option><option value="locked">Locked</option><option value="unlocked">Unlocked</option></select></div>
			<div class="form-group"><label>Trap</label><select name="trapState"><option value="unchanged">Leave unchanged</option><option value="trapped">Trapped (random hazard)</option><option value="clear">No trap</option></select></div>
			<div class="form-group"><label>Apply to touching doors</label><input type="checkbox" name="includeConnected" checked></div>
			<p class="hint">Touching doors will be marked as checked. Locked doors use the normal Thievery or Athletics prompt.</p>
		</form>`,
		buttons: {
			apply: {
				label: 'Apply',
				callback: (html) => {
					const form = html instanceof HTMLElement ? html.querySelector('form') : html?.[0]?.querySelector('form');
					if (!form) {
						ui.notifications.error('Could not read the door settings. Please reopen the dialog and try again.');
						return;
					}
					const values = new FormData(form);
					void applyGMSetDoorState(wallDocument.parent, wallDocument, {
						lockState: values.get('lockState'),
						trapState: values.get('trapState'),
						includeConnected: form.elements.includeConnected.checked,
					}).catch((error) => {
						console.error(`[${MODULE_ID}] Failed to apply GM door settings:`, error);
						ui.notifications.error('Could not apply the door settings. See the console for details.');
					});
				},
			},
			cancel: { label: 'Cancel' },
		},
	}).render(true);
}

Hooks.on('getWallPlaceableContextOptions', (_application, menuItems) => {
	if (!game.user.isGM || !game.settings.get(MODULE_ID, 'randomlyLockedDoors')) return;
	menuItems.push({
		name: 'Set Door Lock / Trap…',
		icon: '<i class="fas fa-lock"></i>',
		condition: function (...args) {
			const placeable = args.find((arg) => arg?.document?.parent?.walls) ?? this;
			return Number(placeable?.document?.door) >= 1;
		},
		callback: function (...args) {
			const placeable = args.find((arg) => arg?.document?.parent?.walls) ?? this;
			openDoorSettingsDialog(placeable);
		},
	});
});

Hooks.on('renderWallConfig', (app, html) => {
	const root = html instanceof HTMLElement ? html : html?.[0];
	const wall = app?.document ?? app?.object;
	if (!root || !game.user.isGM || !game.settings.get(MODULE_ID, 'randomlyLockedDoors') || Number(wall?.door) < 1) return;
	if (root.querySelector('[data-action="dmc-set-door-state"]')) return;
	const button = document.createElement('button');
	button.type = 'button';
	button.dataset.action = 'dmc-set-door-state';
	button.innerHTML = '<i class="fas fa-lock"></i> Set Door Lock / Trap…';
	button.addEventListener('click', (event) => {
		event.preventDefault();
		openDoorSettingsDialog(wall);
	});
	const footer = root.querySelector('.form-footer');
	if (footer) footer.before(button);
});

async function notifySearchingParty(scene, trap) {
	const partyActors = game.actors?.party?.members?.contents ?? game.actors?.party?.members ?? [];
	const characters = Array.from(partyActors).filter((actor) => actor?.type === 'character');
	const searchers = (characters.length ? characters : game.actors?.contents?.filter((actor) => actor.type === 'character' && actor.hasPlayerOwner) ?? [])
		.filter((actor) => {
			const activityId = actor.system?.exploration?.[0];
			return activityId && actor.items.get(activityId)?.slug === 'search';
		});
	const stealthDC = trap.stealthDC;
	if (!Number.isFinite(stealthDC)) return;

	for (const actor of searchers) {
		const result = await game.pf2e.Check.roll(
			new game.pf2e.CheckModifier('Seek (Exploration Search)', actor.perception, []),
			{
				actor,
				type: 'perception-check',
				traits: ['secret', 'concentrate'],
				rollMode: CONST.DICE_ROLL_MODES.PRIVATE,
				skipDialog: true,
				options: new Set([...actor.getRollOptions(), 'action:seek', 'concentrate', 'secret']),
				domains: ['all', 'check', 'perception', 'perception-check', 'wis-based'],
				dc: { value: stealthDC, slug: 'trap-stealth' },
			},
		);
		const degree = Number(result?.degreeOfSuccess ?? result?.options?.degreeOfSuccess);
		if (degree < 2) continue;

		const recipients = game.users.contents
			.filter((user) => !user.isGM && user.active && actor.testUserPermission(user, 'OWNER'))
			.map((user) => user.id);
		if (!recipients.length) continue;
		await ChatMessage.create({
			speaker: ChatMessage.getSpeaker({ actor }),
			content: '<p>You spot a trap ahead.</p>',
			whisper: recipients,
		});
	}
}

function getPartyStandardDC() {
	const partyActors = game.actors?.party?.members?.contents ?? game.actors?.party?.members ?? [];
	const characters = Array.from(partyActors).filter((actor) => actor?.type === 'character');
	const levels = (characters.length ? characters : game.actors?.contents?.filter((actor) => actor.type === 'character' && actor.hasPlayerOwner) ?? [])
		.map((actor) => Number(actor.level ?? actor.system?.details?.level?.value))
		.filter(Number.isFinite);
	if (!levels.length) return 14;
	return 14 + Math.ceil(levels.reduce((sum, level) => sum + level, 0) / levels.length);
}

function getDoorTrapLevel() {
	const partyActors = game.actors?.party?.members?.contents ?? game.actors?.party?.members ?? [];
	const characters = Array.from(partyActors).filter((actor) => actor?.type === 'character');
	const levels = (characters.length ? characters : game.actors?.contents?.filter((actor) => actor.type === 'character' && actor.hasPlayerOwner) ?? [])
		.map((actor) => Number(actor.level ?? actor.system?.details?.level?.value))
		.filter(Number.isFinite);
	const partyLevel = levels.length ? Math.floor(levels.reduce((sum, level) => sum + level, 0) / levels.length) : 0;
	return Math.clamp(partyLevel + Math.floor(Math.random() * 3) - 1, -1, 24);
}

function createDoorTrapAction(trap, level, damage, dc, attackBonus, poison) {
	const poisonEffect = poison
		? ` If the Strike hits and deals piercing damage, the target is exposed to @UUID[${poison.uuid}]{${poison.name}} (level ${poison.system.level.value}); immediately administer that injury poison and resolve its save and stages from the embedded poison item.`
		: '';
	const poisonSaveDC = poison ? getPoisonSaveDC(poison, dc) : dc;
	const effect = trap.delivery === 'attack'
		? `The trap makes a ${trap.attackName} Strike (+${attackBonus}) against the triggering creature. On a hit, it deals @Damage[${damage}[${trap.damageType}]] damage.${poisonEffect}`
		: trap.delivery === 'poison-cloud'
			? `${trap.effect} Each creature in the area is exposed to @UUID[${poison?.uuid ?? ''}]{${poison?.name ?? 'the inhaled poison'}} (level ${poison?.system?.level?.value ?? level}) and attempts a @Check[fortitude|dc:${poisonSaveDC}]. Resolve the poison's stages from the embedded poison item. The cloud deals no direct damage.`
			: `${trap.effect} The triggering creature attempts a @Check[reflex|dc:${dc}|basic] save, taking @Damage[${damage}[${trap.damageType}]] damage.`;
	return {
		name: trap.name,
		type: 'action',
		system: {
			actionType: { value: 'reaction' }, actions: { value: null }, category: null,
			description: { value: `<p><strong>Trigger</strong> ${trap.trigger}</p><hr /><p><strong>Effect</strong> ${effect}</p>` },
			publication: { license: 'ORC', remaster: true, title: 'PF2 Director' },
			rules: [], slug: null, traits: { rarity: 'common', value: [] },
		},
	};
}

function getPoisonSaveDC(poison, fallback) {
	const description = poison.system?.description?.value ?? '';
	const match = description.match(/DC\s*(\d+)\s*Fortitude/i);
	return match ? Number(match[1]) : fallback;
}

async function findAtLevelPoison(level, exposure) {
	const pack = game.packs.get('pf2e.equipment-srd');
	if (!pack) return null;
	const index = await pack.getIndex({ fields: ['system.level.value', 'system.traits.value'] });
	const poisons = index.contents.filter((entry) => {
		const traits = entry.system?.traits?.value ?? [];
		return entry.type === 'consumable' && traits.includes(exposure);
	});
	if (!poisons.length) return null;
	const atOrBelow = poisons.filter((entry) => Number(entry.system?.level?.value) <= level);
	const candidates = atOrBelow.length
		? atOrBelow.filter((entry) => Number(entry.system?.level?.value) === Math.max(...atOrBelow.map((item) => Number(item.system.level.value))))
		: poisons.filter((entry) => Number(entry.system?.level?.value) === Math.min(...poisons.map((item) => Number(item.system.level.value))));
	const selected = candidates[Math.floor(Math.random() * candidates.length)];
	return selected ? pack.getDocument(selected._id) : null;
}

function createDoorTrapDisableDescription(trap, dc) {
	const skills = trap.disableSkills ?? ['thievery'];
	const checks = skills.map((skill) =>
		`@Check[${skill}|dc:${dc}|name:Disable Door Trap|traits:action:disable-a-device]`
	);
	const choices = checks.length > 1 ? checks.join(', ') : checks[0];
	return `<p>${choices} to disable the mechanism.</p>`;
}

async function getRandomHazardBaseActor() {
	let actor = game.actors.contents.find((candidate) => candidate.getFlag(MODULE_ID, RANDOM_HAZARD_FLAG));
	if (actor) return actor;
	actor = game.actors.getName('Random Hazard');
	if (actor?.type === 'hazard') {
		await actor.setFlag(MODULE_ID, RANDOM_HAZARD_FLAG, true);
		return actor;
	}
	return Actor.create({
		name: 'Random Hazard', type: 'hazard', img: HAZARD_ICON,
		ownership: { default: 0 },
		flags: { [MODULE_ID]: { [RANDOM_HAZARD_FLAG]: true } },
		system: {
			attributes: { ac: { value: 10 }, hardness: 0, hasHealth: true, hp: { value: 1, max: 1, temp: 0, tempmax: 0, details: '' }, stealth: { value: 0, details: '' } },
			details: { description: '', disable: '', isComplex: false, level: { value: 0 }, reset: '', routine: '' },
			saves: { fortitude: { saveDetail: '', value: 0 }, reflex: { saveDetail: '', value: 0 }, will: { saveDetail: '', value: 0 } },
			traits: { rarity: 'common', size: { value: 'med' }, value: ['mechanical', 'trap'] },
		},
	}, { renderSheet: false });
}

async function createDoorTrap(scene, walls) {
	const doors = Array.isArray(walls) ? walls : [walls];
	const existingActorId = doors.map((door) => door.getFlag(MODULE_ID, TRAP_ACTOR_FLAG)).find((id) => id && game.actors.get(id));
	const existingTokenId = doors.map((door) => door.getFlag(MODULE_ID, 'randomDoorTrapTokenId'))
		.find((id) => id && scene.tokens.get(id));
	if (existingActorId && existingTokenId) {
		return { actorId: existingActorId, tokenId: existingTokenId, stealthDC: Number(game.actors.get(existingActorId).system?.attributes?.stealth?.dc) };
	}

	const level = getDoorTrapLevel();
	const index = level + 1;
	const trap = DOOR_TRAPS[Math.floor(Math.random() * DOOR_TRAPS.length)];
	const damage = trap.name === 'Poison Needle Trap' ? HAZARD_DAMAGE[Math.max(0, index - 2)] : HAZARD_DAMAGE[index];
	const dc = HAZARD_EXTREME_DC[index];
	const attackBonus = HAZARD_ATTACK_BONUS[index];
	const stealthDC = [18, 19, 20, 21, 23, 25, 26, 28, 30, 31, 33, 35, 36, 38, 40, 41, 43, 45, 46, 48, 50, 51, 53, 55, 56, 58][index];
	const disableDC = [15, 16, 17, 18, 20, 22, 23, 25, 27, 28, 30, 32, 33, 35, 37, 38, 40, 42, 43, 45, 47, 48, 50, 52, 53, 55][index];
	const name = `${trap.name} (Level ${level})`;
	const poison = trap.poisonExposure ? await findAtLevelPoison(level, trap.poisonExposure) : null;
	const items = [createDoorTrapAction(trap, level, damage, dc, attackBonus, poison)];
	if (poison) {
		const poisonSource = poison.toObject();
		delete poisonSource._id;
		items.push(poisonSource);
	}
	if (trap.delivery === 'attack') {
		items.push({
			name: trap.attackName,
			type: 'melee',
			system: {
				attack: { value: '' }, attackEffects: { custom: '', value: [] }, bonus: { value: attackBonus },
				damageRolls: { base: { damage, damageType: trap.damageType } },
				description: { value: 'This attack has no multiple attack penalty.' },
				range: null, rules: [], slug: null, subjectToMAP: false,
				traits: { rarity: 'common', value: [] },
			},
		});
	}

	const actor = await getRandomHazardBaseActor();
	if (!actor) return null;
	const trapSystem = {
			attributes: {
				ac: { value: HAZARD_HIGH_AC[index] },
				hardness: HAZARD_HARDNESS[index],
				hasHealth: true,
				hp: { value: HAZARD_HP[index], max: HAZARD_HP[index], temp: 0, tempmax: 0, details: 'to destroy the trap' },
				stealth: { value: stealthDC - 10, details: `<p>DC ${stealthDC} to notice the concealed trap</p>` },
			},
			details: {
				description: `<p>A concealed ${trap.name.toLowerCase()} is rigged between these connected doors.</p>`,
				disable: createDoorTrapDisableDescription(trap, disableDC),
				isComplex: false,
				level: { value: level },
				reset: '<p>The trap resets after it is manually rearmed.</p>',
				routine: '',
			},
			saves: {
				fortitude: { saveDetail: '', value: HAZARD_HIGH_SAVE[index] },
				reflex: { saveDetail: '', value: HAZARD_HIGH_SAVE[index] },
				will: { saveDetail: '', value: HAZARD_HIGH_SAVE[index] },
			},
			traits: { rarity: 'common', size: { value: 'med' }, value: trap.magical ? ['magical', 'trap'] : ['mechanical', 'trap'] },
		};

	const gridSize = Number(scene.grid.size) || 100;
	const centers = doors.map((door) => {
		const [x1, y1, x2, y2] = door.c ?? [];
		return { x: (x1 + x2) / 2, y: (y1 + y2) / 2, x1, y1, x2, y2 };
	});
	let centerX = centers.reduce((sum, point) => sum + point.x, 0) / centers.length;
	let centerY = centers.reduce((sum, point) => sum + point.y, 0) / centers.length;
	if (doors.length === 1) {
		const { x1, y1, x2, y2 } = centers[0];
		const dx = x2 - x1;
		const dy = y2 - y1;
		const length = Math.hypot(dx, dy) || 1;
		centerX -= dy / length * gridSize * 0.55;
		centerY += dx / length * gridSize * 0.55;
	}
	const token = {
		name, actorId: actor.id, actorLink: false,
		x: centerX - gridSize / 2,
		y: centerY - gridSize / 2,
		width: 1, height: 1, hidden: true,
		texture: { src: HAZARD_ICON },
		flags: { [MODULE_ID]: { randomDoorTrap: { wallIds: doors.map((door) => door.id), actorId: actor.id } } },
	};
	const [placedToken] = await scene.createEmbeddedDocuments('Token', [token]);
	if (!placedToken?.actor) return null;
	await placedToken.actor.update({
		name,
		img: HAZARD_ICON,
		system: trapSystem,
		flags: { [MODULE_ID]: { randomDoorTrap: { sceneId: scene.id, wallIds: doors.map((door) => door.id) } } },
	});
	await placedToken.actor.createEmbeddedDocuments('Item', items);
	return { actorId: actor.id, tokenId: placedToken?.id ?? null, stealthDC };
}

async function notifyDoorTrapTriggered(wall) {
	if (!wall.getFlag(MODULE_ID, TRAP_FLAG) || wall.getFlag(MODULE_ID, TRAP_TRIGGERED_FLAG)) return;
	const actorId = wall.getFlag(MODULE_ID, TRAP_ACTOR_FLAG);
	const actor = game.actors.get(actorId);
	if (!actor) return;
	const sharedTrapDoors = wall.parent?.walls?.contents?.filter((door) =>
		door.getFlag(MODULE_ID, TRAP_ACTOR_FLAG) === actorId
	) ?? [wall];
	await Promise.all(sharedTrapDoors.map((door) => door.setFlag(MODULE_ID, TRAP_TRIGGERED_FLAG, true)));
	const gms = game.users.filter((user) => user.isGM && user.active).map((user) => user.id);
	void ChatMessage.create({
		speaker: ChatMessage.getSpeaker(),
		content: `<p><strong>Door trap triggered:</strong> ${actor.name}. Use the hidden hazard actor beside the door to resolve its reaction.</p>`,
		whisper: gms,
	});
}

export function appendRandomDoorLockSetting(rendered, scene) {
	if (!game.settings.get(MODULE_ID, 'randomlyLockedDoors')) return rendered;
	const root = rendered?.[game.system?.id] ?? rendered?.main ?? Object.values(rendered ?? {})[0];
	if (!root || root.querySelector?.(`[name="flags.${MODULE_ID}.${SCENE_FLAG}"]`)) return rendered;
	const row = document.createElement('div');
	row.className = 'form-group';
	row.innerHTML = `
		<label>Disable Random Door Locks</label>
		<div class="form-fields"><input type="checkbox" name="flags.${MODULE_ID}.${SCENE_FLAG}" ${scene?.getFlag?.(MODULE_ID, SCENE_FLAG) === true ? 'checked' : ''}></div>
		<p class="hint">Prevent automatic random locks in this scene.</p>`;
	root.appendChild(row);
	return rendered;
}

Hooks.on('preUpdateWall', (wall, changes) => {
	if (!isEnabled(wall.parent) || Number(wall.door) < 1) return;
	if (!game.user.isGM && Number(changes.ds) === OPEN_DOOR_STATE && Number(wall.ds) !== OPEN_DOOR_STATE) {
		sendDoorLockRequest(wall.parent.id, wall.id, 'attempt-open');
		return false;
	}
});

async function rollDoorCheck(message, skill) {
	const actor = game.user.character ?? canvas.tokens.controlled.find((token) => token.actor?.isOwner)?.actor;
	const statistic = actor?.skills?.[skill];
	if (!statistic?.roll) {
		ui.notifications.warn(`Select a character with a ${skill} skill to roll.`);
		return;
	}
	const result = await statistic.roll({ dc: { value: getPartyStandardDC() } });
	if (Number(result?.degreeOfSuccess ?? result?.options?.degreeOfSuccess) < 2) return;

	const target = message.getFlag(MODULE_ID, 'randomDoorLock');
	const scene = game.scenes.get(target?.sceneId);
	const wall = scene?.walls.get(target?.wallId);
	if (!wall || Number(wall.ds) !== LOCKED_DOOR_STATE) {
		ui.notifications.info('That door is no longer locked.');
		return;
	}
	sendDoorLockRequest(scene.id, wall.id, skill === 'athletics' ? 'successful-athletics' : 'successful-thievery');
}

Hooks.once('ready', () => game.socket?.on?.(SOCKET_EVENT, handleDoorLockRequest));

Hooks.on('renderChatMessage', (message, html) => {
	if (!message.getFlag(MODULE_ID, 'randomDoorLock')) return;
	const root = html instanceof HTMLElement ? html : html?.[0];
	if (!root || root.querySelector('[data-action="dmc-door-check"]')) return;
	const controls = document.createElement('div');
	controls.className = 'dmc-door-check-buttons';
	controls.innerHTML = '<button type="button" data-action="dmc-door-check" data-skill="thievery">Thievery</button><button type="button" data-action="dmc-door-check" data-skill="athletics">Athletics</button>';
	(root.querySelector('.message-content') ?? root).appendChild(controls);
	const buttons = controls.querySelectorAll('[data-action="dmc-door-check"]');
	for (const button of buttons) button.addEventListener('click', async (event) => {
		event.preventDefault();
		const skill = event.currentTarget.dataset.skill;
		await rollDoorCheck(message, skill);
	});
});

Hooks.on('renderSceneConfig', (app, html) => {
	const root = html instanceof HTMLElement ? html : html?.[0];
	if (!root || !game.settings.get(MODULE_ID, 'randomlyLockedDoors') || root.querySelector(`[name="flags.${MODULE_ID}.${SCENE_FLAG}"]`)) return;
	const scene = app?.object ?? app?.document;
	const row = document.createElement('div');
	row.className = 'form-group';
	row.innerHTML = `<label>Disable Random Door Locks</label><div class="form-fields"><input type="checkbox" name="flags.${MODULE_ID}.${SCENE_FLAG}" ${scene?.getFlag?.(MODULE_ID, SCENE_FLAG) === true ? 'checked' : ''}></div><p class="hint">Prevent automatic random locks in this scene.</p>`;
	(root.querySelector('.tab[data-tab="basic"]') ?? root.querySelector('form'))?.appendChild(row);
});

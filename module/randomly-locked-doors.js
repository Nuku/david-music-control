import { MODULE_ID } from './settings.js';

const SCENE_FLAG = 'disableRandomDoorLocks';
const WALL_FLAG = 'randomDoorChecked';
const LOCKED_DOOR_STATE = 2;
const OPEN_DOOR_STATE = 1;
const SOCKET_EVENT = `module.${MODULE_ID}`;
const SOCKET_TYPE = 'dmc-random-door-request';

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

async function handleDoorLockRequest(data) {
	if (!game.user.isGM || game.users.activeGM?.id !== game.user.id || data?.type !== SOCKET_TYPE) return;
	const requester = game.users.get(data.userId);
	const scene = game.scenes.get(data.sceneId);
	const wall = scene?.walls.get(data.wallId);
	if (!requester?.active || requester.isGM || !wall || Number(wall.door) < 1) return;

	if (data.action === 'attempt-open') {
		if (!isEnabled(scene)) return;
		if (Number(wall.ds) === LOCKED_DOOR_STATE) {
			if (wall.getFlag(MODULE_ID, WALL_FLAG)) makeDoorLockMessage(wall);
			return;
		}
		if (Number(wall.ds) === OPEN_DOOR_STATE || wall.getFlag(MODULE_ID, WALL_FLAG)) {
			if (Number(wall.ds) !== OPEN_DOOR_STATE) await wall.update({ ds: OPEN_DOOR_STATE });
			return;
		}

		const chance = Math.clamp(Number(game.settings.get(MODULE_ID, 'randomlyLockedDoorsChance')) || 0, 0, 100);
		const locked = Math.random() * 100 < chance;
		await wall.update({ ds: locked ? LOCKED_DOOR_STATE : OPEN_DOOR_STATE, [`flags.${MODULE_ID}.${WALL_FLAG}`]: true });
		if (locked) makeDoorLockMessage(wall);
		return;
	}

	if (data.action === 'successful-check' && wall.getFlag(MODULE_ID, WALL_FLAG) && Number(wall.ds) === LOCKED_DOOR_STATE) {
		await wall.update({ ds: OPEN_DOOR_STATE });
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
	sendDoorLockRequest(scene.id, wall.id, 'successful-check');
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

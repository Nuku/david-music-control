function addMakeCurrentTurnOption(tracker, options) {
	const getCombatant = (entry) => {
		const id = entry?.dataset?.combatantId ?? entry?.[0]?.dataset?.combatantId;
		return (tracker.viewed ?? game.combat)?.combatants?.get(id);
	};

	options.unshift({
		name: 'Make Current Turn',
		icon: '<i class="fas fa-forward-step"></i>',
		condition: (entry) => {
			const combat = game.combat;
			const combatant = getCombatant(entry);
			return ['pf2e', 'sf2e', 'dnd5e'].includes(game.system?.id)
				&& game.user?.isGM
				&& combat?.started
				&& combatant?.combat?.id === combat.id
				&& combatant.id !== combat.combatant?.id;
		},
		callback: (entry) => {
			const combat = game.combat;
			const combatant = getCombatant(entry);
			if (!combat || combatant?.combat?.id !== combat.id) return;

			const turns = combat.turns;
			const turn = turns.findIndex((entry) => entry.id === combatant.id);
			if (turn < 0 || turn === combat.turn) return;

			return combat.update({ turn });
		},
	});
}

Hooks.on('getCombatantContextOptions', addMakeCurrentTurnOption);

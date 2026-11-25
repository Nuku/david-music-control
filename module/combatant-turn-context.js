function addSkipToTurnOption(tracker, options) {
	const getTargetTurn = (entry, combat) => {
		if (!game.user?.isGM || !combat?.started) return -1;
		if (!['pf2e', 'sf2e', 'dnd5e'].includes(game.system?.id)) return -1;

		const id = (entry?.[0] ?? entry)?.dataset?.combatantId;
		if (!id) return -1;

		const turn = combat.turns.findIndex((combatant) => combatant.id === id);
		return turn === combat.turn ? -1 : turn;
	};

	options.unshift({
		name: 'Skip to Turn',
		icon: '<i class="fas fa-forward-step"></i>',
		condition: (entry) => getTargetTurn(entry, tracker.viewed) >= 0,
		callback: (entry) => {
			const combat = tracker.viewed;
			const turn = getTargetTurn(entry, combat);
			if (turn >= 0) return combat.update({ turn });
		},
	});
}

Hooks.on('getCombatantContextOptions', addSkipToTurnOption);

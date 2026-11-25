function addSkipToTurnOption(tracker, options) {
	const label = 'Skip to Turn';
	if (options.some((option) => (option.label ?? option.name) === label)) return;

	const getTargetTurn = (entry, combat) => {
		if (!game.user?.isGM || !combat?.started) return -1;
		if (!['pf2e', 'sf2e', 'dnd5e'].includes(game.system?.id)) return -1;

		const id = (entry?.[0] ?? entry)?.dataset?.combatantId;
		if (!id) return -1;

		const turn = combat.turns.findIndex((combatant) => combatant.id === id);
		return turn === combat.turn ? -1 : turn;
	};

	const visible = (entry) => getTargetTurn(entry, tracker.viewed) >= 0;
	const skipToTurn = (entry) => {
		const combat = tracker.viewed;
		const turn = getTargetTurn(entry, combat);
		if (turn >= 0) return combat.update({ turn });
	};

	if (game.release.generation >= 14) {
		options.unshift({ label, icon: 'fa-solid fa-forward-step', visible, onClick: (_event, entry) => skipToTurn(entry) });
	} else {
		options.unshift({ name: label, icon: '<i class="fas fa-forward-step"></i>', condition: visible, callback: skipToTurn });
	}
}

Hooks.on('getCombatantContextOptions', addSkipToTurnOption);
// Foundry 14.368 derives this hook name from the tracker class.
Hooks.on('getCombatTrackerContextOptions', addSkipToTurnOption);

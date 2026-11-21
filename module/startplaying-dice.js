const id = "pf2-david-music-control-startplaying";
const name = "StartPlaying";
const diceTypes = ["d2", "d4", "d6", "d8", "d10", "d12", "d20", "d100"];

Hooks.once("diceSoNiceReady", (dice3d) => {
    dice3d.addColorset({
        name: id,
        description: name,
        foreground: "#e5f7ff",
        background: "#003f5e",
        outline: "#002538",
        texture: "none",
        material: "plastic",
        visibility: "hidden",
    });
    dice3d.addSystem({ id, name, group: name }, "default");

    for (const type of diceTypes) {
        dice3d.addDicePreset({
            type,
            system: id,
            colorset: id,
            labels: "",
            modelFile: `modules/pf2-david-music-control/module/dice/startplaying/${type}.glb`,
        });
    }
});

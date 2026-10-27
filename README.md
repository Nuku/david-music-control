# PF2 Director

![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/Nuku/david-music-control)
![GitHub Releases](https://img.shields.io/github/downloads/Nuku/david-music-control/latest/pf2-david-music-control.zip)
![GitHub All Releases](https://img.shields.io/github/downloads/Nuku/david-music-control/pf2-david-music-control.zip?label=downloads)

PF2 Director helps GMs run Foundry VTT sessions with automatic combat and scene music, dramatic health displays, vision tools, and end credits. Pathfinder Second Edition and Starfinder Second Edition worlds also get party utilities, chat actions, door hazards, and rules automation.

## Install and get started

In Foundry's **Add-on Modules** installer, use this manifest URL:

```text
https://raw.githubusercontent.com/Nuku/david-music-control/main/module.json
```

Enable **PF2 Director** in your world, then open **Configure Settings → PF2 Director**.

- **Foundry compatibility:** versions 13–14; verified for version 14.
- **Supported systems:** Pathfinder Second Edition (`pf2e`), Starfinder Second Edition (`sf2e`), and Dungeons & Dragons Fifth Edition (`dnd5e`).
- **Release information:** see [module.json](module.json) for the package version and [CHANGELOG.md](CHANGELOG.md) for recent changes.

For a first session:

1. In the **Music** section, open the **PF2 Director** playlist chooser. Check the playlists you want to use for combat; click a playlist name to star it as the default, then save.
2. Start a combat to use the selected music. Configure **Victory Music** if you want a closing track when the encounter is deleted.
3. Enable **Play Scene Music** if you want scene activation to look for matching playlists.
4. Browse the remaining settings and enable the tools your table wants. Most optional automation starts disabled. **At-Will Recharge** starts enabled in PF2e/SF2e; **Pause Ambience Sounds** and **Pause Tracks** also start enabled.

## Find a feature

- [Music and creature ambience](#music-and-creature-ambience)
- [Scene presentation and vision](#scene-presentation-and-vision)
- [PF2e and SF2e tools](#pf2e-and-sf2e-tools)
- [End credits](#end-credits)
- [Optional integrations](#optional-integrations)
- [Macros and integration hooks](#macros-and-integration-hooks)
- [Troubleshooting](#troubleshooting)

Combat and scene music, victory playback, enhanced vision, elevation-based level changes, dramatic health displays, end credits, diagnostics, and the **Make Current Turn** control are available across all three supported systems. The party, chat, creature ambience, fire-light, detected-token image, and door tools below are intended for PF2e/SF2e. The compendium prerequisite filter is PF2e-only.

## Music and creature ambience

### Combat music

The playlist chooser marks playlists as combat music and lets you star a default. For more control, use **Combat Music** in Token Configuration's header controls, **Trait Music Rules** in PF2e/SF2e, or **Set Encounter Music** in the combat tracker's context menu.

Token music supports:

- An **Active** switch and a playlist or individual track.
- Different selections at HP or other tracked-resource thresholds.
- **Priority** for competing music selections.
- **Turn Only** music and an encounter-wide **Combat Theme**.

The encounter's background music is selected in this order:

1. A manually assigned encounter override.
2. An active **Combat Theme** token, choosing among the highest-priority themes.
3. A matching trait rule for a non-friendly combatant, using the highest-priority matching rule.
4. The highest-priority choice among combat playlists and eligible token music with **Turn Only** off. Combat playlists have priority 0, the starred default has priority 1, and token music defaults to priority 10.

Tied themes or fallback candidates are chosen randomly. On a combatant's turn, its active personal music can interrupt the encounter background; the saved background resumes when the interruption ends.

**Pause Ambience Sounds** saves and pauses playing playlist audio at combat start. When the combat is deleted, the module stops its combat music, plays any configured victory selection, then resumes the saved audio after victory playback finishes. With no victory selection, it resumes immediately. **Pause Tracks** controls whether switched tracks are paused for later playback.

**Victory Music** offers generic, trivial, and boss selections. On Foundry 14, **Fireworks on Victory** adds bursts scaled from the encounter's calculated difficulty, with an optional custom particle image.

The **Music** settings also provide JSON export and import for combat playlist configuration, trait rules, and victory selections. Audio file paths are stored in the export; the media files themselves are not included.

### Scene music

Enable **Play Scene Music** to search when a scene activates or its canvas loads. You can also click **Play Scene Music** in the playlists sidebar without enabling automatic playback. Neither action replaces music during an active combat.

The search uses the scene name and navigation name to find a matching playlist and a matching playlist folder. It also tries shortened names and ignores common leading articles or prefixes. Playlists directly inside the matching folder join the choices.

- **One choice:** plays immediately.
- **Multiple choices:** asks the GM to choose.
- **No choice:** leaves current music playing.

Selecting a replacement stops playing non-combat playlists before starting it.

### Creature ambience — PF2e/SF2e

Enable **Enable Creature Ambience** with **PF2e Creature Sounds** active to play periodic creature noises. Each player's listener is their nearest suitable placed token with Observer or Owner permission. Distance and closed doors muffle the sound, and path checks determine whether it can be heard.

Scene configuration includes an ambience opt-out. Debug logging and a local GM test mode are available in settings; the latter allows testing without connected players.

## Scene presentation and vision

### Dramatic health display

HP changes show a brief portrait panel with an animated health bar and separate visual effects for damage and healing. Settings control screen position and the minimum change as a percentage of maximum HP.

Players normally see panels according to token bar permissions. **Show For Everyone** bypasses that restriction. The GM can see panels regardless of token bar permissions.

### Enhanced Vision

Enable **Enhanced Vision** to calculate vision from four slightly inset token corners. Each viewpoint respects wall collisions, allowing an unobstructed corner to see around a wall. This adds perception work, especially in scenes with many tokens. Reload the scene if changing the setting does not immediately update the view.

**Enhanced Vision Debug** draws viewpoints and wall collisions and logs their coordinates for troubleshooting.

### Elevation and scene levels

Enable **Automatically Update Token Level from Elevation** to assign tokens to the scene level containing their new elevation. This requires a scene with configured levels and elevation ranges. If ranges overlap, the token keeps its current level when that range still fits. Players must confirm transitions; declining cancels the move.

### Combat tracker and dice controls

During an active combat, GMs can right-click a combatant and choose **Make Current Turn** to change the active turn without changing the round or initiative.

Foundry's dice fulfillment choices also include **Digital Roll (PCG)** as an optional digital rolling method.

### Detected-token art and Fire Glows — PF2e/SF2e

Under **Vision**, enable **Use Custom Image for Detected Tokens** and choose an image to replace token art while a detection filter is active. The system's tint, fading, and rings remain in place.

**Fire Glows** gives actors with persistent fire damage a torch-animated light: 15 feet bright, 30 feet dim, and 360 degrees. An active GM manages the effect, including existing actors and unlinked scene tokens. Ending all persistent fire damage, or disabling the option, removes the effect and restores normal token lighting.

## PF2e and SF2e tools

Settings for these tools appear under **PF2e / SF2e Tools**, **Villain Points**, or **Doors**, as appropriate. Force Field, multi-target Taunt, and Pacifying automation work without a separate enable setting.

### Party management

| Tool | Where to use it | What it does |
| --- | --- | --- |
| Full Rest | Enable **Enable Full Rest**, then use **Recover** on the party sheet as GM | Restores character members to full HP and focus points, removes Wounded, and posts a summary and report. |
| Cluster Party | **Cluster Party** in a party token's Token Configuration, as GM | Combines party member token art into a crowd image, saves it under the world folder, and applies it to the party actor and token. |
| Cult | Enable **Enable Cult System**, then open the party sheet's **Cult** tab | Tracks cult name and level, Fervor, Recruitment, Mythic points, mantles, activities, phase notes, events, and level checks. |
| Party Stash merchant | **Use Party Stash** in an Item Piles merchant window | Changes **Shopping as** to the party actor, so purchases and sales use its inventory and funds. Requires Item Piles and an appropriate system integration. |

**Enable Item Piles Party Stash Merchant** defaults on when Item Piles is active. The GM can disable it in settings.

### Chat and item actions

- **Roll retyping:** enable **Enable Roll Retyping** to create typed damage or healing follow-up cards from eligible non-d20 rolls. Damage types come from the active system, including configured homebrew types.
- **Half damage:** enable **Enable Half Damage Button** to add Half actions to eligible damage cards and cards with damage actions, including strikes, spells, and impulses. It uses the original damage action and preserves its context in the resulting half-damage card.
- **Automatic damage application:** **Apply Damage Automatically** can activate compatible target-aware damage buttons for NPC targets or all targets. It defaults to nobody.
- **Automatic saves:** **Roll Toolbelt Saves Automatically** can roll saves on PF2e Toolbelt cards for NPC targets or everyone. It also defaults to nobody and requires Toolbelt's compatible card controls.
- **At-Will Recharge:** automatically restores innate spell uses and frequency-based uses for items named with `(at will)` or `at-will`. Enabled by default.
- **Multi-target Taunt:** when a Taunt chat action has multiple selected creature targets, applies the Taunt effect to targets without one and preserves the taunting creature as its origin. Uses the active system's effect when available, with a bundled fallback.
- **Pacifying rune:** after damage from a Pacifying weapon, prompts the attacker to use the reaction. If accepted, damaged creatures attempt DC 20 Will saves. Failure applies a 1-minute Pacified effect with a –2 penalty to attacks lacking the nonlethal trait.

### Villain points

Enable **Enable Villain Points** to track characters' hero and mythic point spending. Every two spent points grant the GM one villain point by default; **Hero Points Per Villain Point** changes that rate.

The GM gets a floating counter with manual adjustment and villain-point reroll buttons on eligible d20 chat messages. An optional dread sound and synchronized overlay accompany gains and spending. A gap of at least 12 hours between consecutive messages in the last five chat messages resets both the spending counter and villain points.

### Force Fields

An active **Effect: Force Field** (`effect-force-field`) uses its HP badge to absorb supported physical and energy damage. A public chat message reports absorption and remaining field HP, including fully absorbed hits.

At the start of the owner's turn, the field regenerates HP according to its quality, up to its maximum, and whispers player owners when HP returns. The module recognizes standard Commercial through Paragon field tiers. PF2e's **Force Shield** item does not use this HP badge and is unaffected.

[Integration hooks](#macros-and-integration-hooks) let other modules respond to absorption and recharge.

### Door locks and traps

Enable **Randomly Locked Doors** to check a door on a player's first attempt to open it. Lock and trap chances are independent and each defaults to 20%. Scenes can opt out in Scene Configuration, and doors sharing an endpoint share the generated outcome.

Locked doors offer chat checks: successful **Thievery** unlocks without opening; successful **Athletics** unlocks and opens. Traps create hidden hazard tokens on the door's level, scale to the party, and include mechanical, magical, and poison hazards. Party members using Search can spot them.

With the door feature enabled, GMs can also use **Set Door Lock / Trap…** in wall configuration or the wall context menu to choose lock and trap states manually, with an option to apply them to touching doors.

### Subsystem preparation

Open **PF2 Director Transfer** from a journal's header to parse subsystem text or generate content at a chosen level. The tools support **Influence**, **Research**, and **Infiltration**, including research-library entries.

Preview the JSON and download it for later use, or create a live subsystem when **PF2e Subsystems** is active. Parsing depends on recognizable headings and structure; review the preview before using the result.

### Compendium prerequisite search — PF2e only

The PF2e Compendium Browser gains a **Prerequisites** text filter on its **Feats** and **Campaign Features** tabs. It matches prerequisite text as you type.

## End credits

Use the **End Credits** settings to select music, a background image or video, background opacity, and an optional **In Memoriam** source-folder override. The GM can start or stop credits from settings or a macro.

Credits synchronize across connected clients, including players who join while they are running. Saved settings from the legacy `end-credits` module migrate into the integrated feature.

## Optional integrations

These modules are optional; enable the ones needed for your chosen features.

| Module | Enables |
| --- | --- |
| PF2e Creature Sounds (`pf2e-creature-sounds`) | Creature ambience sound selection. |
| PF2e Subsystems (`pf2e-subsystems`) | Creating live subsystem entries from parsed or generated data. JSON export works without it. |
| Item Piles (`item-piles`) | The Party Stash merchant button. For PF2e transactions, also activate **Item Piles: PF2e** (`itempiles-pf2e`) for pricing and currency support. |
| PF2e Toolbelt (`pf2e-toolbelt`) | Compatible target-aware card controls for automatic saves and damage application. |
| Trigger Engine (`trigger-engine`) | Listening for Force Field hooks through **On Hook Called** events. |

SF2e tools use the shared PF2e rules API. Each external dependency must also support your active system and Foundry version; listing an integration here does not establish SF2e compatibility for that dependency.

## Macros and integration hooks

Run these as GM in script macros after the world is ready.

**End credits:** prompt for confirmation or toggle immediately.

```js
game.modules.get("pf2-david-music-control").api.endCredits.prompt();
```

```js
game.modules.get("pf2-david-music-control").api.endCredits.toggle();
```

**Victory fireworks (Foundry 14):** derive intensity and burst anchors from the current combat, or supply an intensity.

```js
game.modules.get("pf2-david-music-control").api.victoryFireworks.trigger();
```

```js
game.modules.get("pf2-david-music-control").api.victoryFireworks.trigger({ intensity: 100 });
```

Without a current combat, the automatic intensity is 60.

**Force Field events:** use these names with Trigger Engine's **On Hook Called**, or subscribe with Foundry's `Hooks.on`.

| Hook | Payload fields |
| --- | --- |
| `pf2-director.forceFieldDamaged` | `actor`, `effect`, `absorbed`, `remaining` |
| `pf2-director.forceFieldRegenerated` | `actor`, `effect`, `gained`, `current`, `maximum` |

## Troubleshooting

- **No combat music:** confirm the playlists are checked in the playlist chooser. For token music, confirm **Active** is checked and the selected tracks still exist.
- **No scene music:** check scene, navigation, playlist, and playlist-folder names. The search leaves current playback alone if it finds no match and does not run during active combat.
- **No creature ambience:** confirm the sound module is active, the scene allows ambience, and a suitable listener token is placed. Use ambience debug logging or the local GM test option to inspect playback decisions.
- **Slow vision:** disable **Enhanced Vision** to compare, and use **Enhanced Vision Debug** only while investigating.
- **Other browser lag:** under **Diagnostics**, click **Run 10-Second Diagnostic**, reproduce the lag, then use **Copy Report** to capture the results.

Two smaller controls are also available: GMs can right-click a combatant and choose **Make Current Turn** to change the active turn without changing the round or initiative; Foundry's dice fulfillment choices include **Digital Roll (PCG)** as an optional digital rolling method.

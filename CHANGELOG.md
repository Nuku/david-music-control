# Changelog

## [2.4.71] - 2026-05-21

### Changed
- **Villain Points**: Hero-point tracking now also counts PF2e mythic point spends toward villain-point generation, so either resource can advance the same villain-point threshold.

## [2.4.70] - 2026-05-21

### Fixed
- **Villain Points**: Finalized villain-point reroll decoration so PF2e rerolls are recognized reliably across in-place and replacement chat-card flows, allowing the skull marker, doom banner, and themed styling to appear consistently.

### Changed
- **Villain Points**: Polished the villain reroll card presentation with a darker ceremonial banner, stronger atmospheric shading, and clearer emphasis on the kept reroll result.

## [2.4.62] - 2026-05-21

### Fixed
- **Villain Points**: Kept pending villain-reroll markers alive through asynchronous chat-message creation so the reroll card reliably gets its skull icon, doom banner, and themed styling.

## [2.4.61] - 2026-05-21

### Changed
- **Villain Points**: Villain-point reroll cards now carry a stronger doom-themed visual treatment, and the GM reroll button is hidden entirely when no villain points are available to spend.

## [2.4.60] - 2026-05-21

### Fixed
- **Villain Points**: Added an explicit Save button to the dread sound configuration dialog so the form reliably submits and persists the selected audio file and volume.

## [2.4.59] - 2026-05-21

### Fixed
- **Villain Points**: The dread sound picker now saves the selected audio path reliably by reading the live field value on submit instead of depending on custom-element form serialization.

## [2.4.58] - 2026-05-21

### Fixed
- **Villain Points**: Resolved dread sound preview and playback to Foundry's current audio helper API so the test button and live stingers work on runtimes without a global `AudioHelper`.

## [2.4.57] - 2026-05-21

### Fixed
- **Villain Points**: Switched the dread sound dialog to Foundry's native audio file-picker control so selecting a sound works reliably.

## [2.4.56] - 2026-05-21

### Changed
- **Villain Points**: Replaced the raw dread-sound path settings with a dedicated `Configure Sound` dialog that provides file browse, clear, test, and volume controls.

## [2.4.55] - 2026-05-21

### Added
- **Villain Points**: Gaining or spending villain points now triggers a synchronized doom stinger for all connected users, with a short screen-dim pulse, configurable dread audio, and randomized portent chat messages from `The Gathering Dark`.

## [2.4.54] - 2026-05-21

### Fixed
- **Villain Points**: GM villain-point rerolls now route through PF2e's own check reroll flow so they behave like hero-point rerolls on the chat card instead of posting a plain standalone reroll.

## [2.4.53] - 2026-05-21

### Added
- **Villain Points**: Added an optional world setting that tracks hero point spending from PF2e character sheets, grants the GM 1 villain point for every 2 hero point uses, resets both counters after a 12+ hour gap detected within the most recent 5 chat messages, and adds a GM-only villain-point reroll button to d20 chat messages.

## [2.4.52] - 2026-05-18

### Changed
- **Dramatic Health Display**: Damage now makes the health bar shiver briefly, while healing triggers a bright green medical scan sweep across the bar.

## [2.4.51] - 2026-05-18

### Added
- **Dramatic Health Display**: Integrated animated health bar overlays with configurable visibility thresholds, optional per-player damage/heal sounds, and a dedicated settings section in the module configuration.

## [2.4.50] - 2026-05-18

### Changed
- **Settings**: Consolidated the music-related settings into a single `Music` section so combat, scene, victory, configuration, and import/export controls are grouped together.

## [2.4.49] - 2026-05-18

### Changed
- **Branding**: Renamed the module's displayed title to **PF2 Director** while keeping the existing module ID and package paths unchanged.
- **Settings**: Grouped the module settings into clearer sections so the growing mix of music, PF2e tools, import/export, and end credits controls is easier to navigate.

## [2.4.48] - 2026-05-15

### Fixed
- **End credits**: When an `In Memoriam` folder is configured, credits now treat that folder as authoritative instead of falling back to dead actors from elsewhere in the world.

## [2.4.47] - 2026-05-14

### Changed
- **Roll Retyping**: The follow-up card now emits a standard PF2e damage or healing roll message instead of a custom module-owned chat card, so it works more naturally with existing damage-card workflows.

## [2.4.45] - 2026-05-13

### Added
- **At-Will Recharge**: Added an `Enable At-Will Recharge` setting, enabled by default, that automatically restores uses for PF2e items named with `(at will)` after activation.
- **Victory fireworks**: Added a `game.modules.get("pf2-david-music-control").api.victoryFireworks.trigger()` API so GMs can fire the effect from a macro, with optional custom intensity.

### Changed
- **Victory fireworks**: Celebration bursts now bias strongly toward friendly party token positions so the effect lands where players are already looking.

## [2.4.43] - 2026-05-12

### Changed
- **End credits**: Reduced how many random credits entries appear in a single run, including fewer executive producers, two roles per character, and smaller production, thanks, and disclaimer slices so later rerolls stay fresher.

## [2.4.42] - 2026-05-11

### Fixed
- **End credits**: Synced credits now loop back to the start correctly after reaching the end, without regenerating the randomized content.

## [2.4.41] - 2026-05-11

### Fixed
- **Combat Theme**: Theme tokens now update only the encounter-wide music layer, so HP threshold changes no longer cut in over another token's active personal turn track.

## [2.4.40] - 2026-05-11

### Added
- **End credits**: Randomized the opening title-card subtitle so the campaign tagline varies between credits runs.

## [2.4.39] - 2026-05-11

### Added
- **End credits**: Added an optional `In Memoriam` actor folder setting so credits can use a named folder or slash-separated folder path such as `Departed` or `NPCs/Departed` instead of relying on the world-wide dead-character scan.
- **End credits**: Expanded the random cast roles, production credits, special thanks, disclaimers, stingers, and epitaph pools so repeated credits runs vary more.

## [2.4.38] - 2026-05-11

### Changed
- **Full Rest**: The party rest report now uses `DialogV2` on Foundry V14+ and falls back to the legacy dialog API on older versions.

## [2.4.37] - 2026-05-11

### Changed
- **End credits**: The GM now generates one shared credits payload so every viewer sees the same credits content.
- **End credits**: Credits scroll progress now syncs from a shared GM start timestamp so connected players and late joiners stay aligned on roughly the same point.

## [2.4.36] - 2026-05-08

### Fixed
- **Full Rest**: Removed a legacy chat message `type` field that PF2e 8 rejects, so the `Recover` summary chat post now creates correctly.

## [2.4.35] - 2026-05-08

### Added
- **Full Rest**: Added an optional `Enable Full Rest` setting that adds a `Recover` button to PF2e party sheets for fully healing the party, restoring focus points, removing `Wounded`, and showing a summary report.

## [2.4.34] - 2026-05-07

### Changed
- **Victory fireworks**: Replaced the raw custom image path setting with a dedicated configuration dialog using Foundry's built-in file picker.

## [2.4.30] - 2026-05-07

### Fixed
- **Settings**: Removed an unsupported settings field from the victory fireworks image setting that could cause the module's settings section to disappear.

## [2.4.29] - 2026-05-07

### Changed
- **Victory fireworks**: Added an optional custom particle image setting for victory fireworks, with a Foundry file picker. Leaving it blank keeps the default particle image.

## [2.4.28] - 2026-05-07

### Changed
- **Victory music**: When a victory cue is configured, pre-combat ambience now resumes automatically after the victory music finishes.

## [2.4.27] - 2026-05-07

### Changed
- **Victory fireworks**: Extended the celebration duration so higher-XP victories linger longer instead of only increasing particle density.

## [2.4.26] - 2026-05-07

### Fixed
- **Module loading**: Removed a `MODULE_ID` initialization timing issue in the victory fireworks socket setup that could prevent the module from loading.
- **Settings resilience**: Hardened settings and menu registration so one failing registration no longer hides the entire module settings section.
- **Victory fireworks**: Switched victory fireworks to a visible particle texture and larger burst parameters so the effect actually shows up on combat end.

## [2.4.25] - 2026-05-05

### Fixed
- **Settings registration**: Stored hidden trait rule data as JSON text instead of a raw array so Module Settings continue to register correctly on Foundry V14.

## [2.4.24] - 2026-05-05

### Added
- **Victory fireworks**: Added a `Fireworks on Victory` setting that uses Foundry V14 particle generators to show colorful celebratory bursts based on encounter XP when combat ends.

### Changed
- **Compatibility**: Updated `module.json` to mark Foundry V14 as the verified compatibility target.

## [2.4.23] - 2026-05-05

### Fixed
- **End credits**: Stopping credits from the overlay now refreshes the Module Settings toggle correctly so credits can be started again without using the macro.

### Added
- **End credits**: Added a one-time migration that imports legacy `end-credits` module settings into this module's end credits settings when present.

## [2.4.22] - 2026-05-04

### Added
- **End credits**: Folded in cinematic scrolling end credits with GM controls, optional credits music, optional background image or video, late-join support, and a prompt API.

## [2.4.21] - 2026-05-03

### Changed
- **Scene music**: Direct playlist matches now stay available while folder matches are also gathered, so GMs can choose from all matching scene music options when more than one is found.

## [2.4.20] - 2026-05-02

### Fixed
- **Scene music**: Scene music lookup no longer stops currently playing music when no matching scene playlist or folder is found.

## [2.4.19] - 2026-05-01

### Changed
- **PF2e cult system**: Cult Activity chat cards now include the full activity text and an estimated standard DC for the cult's level.

## [2.4.18] - 2026-04-30

### Added
- **PF2e cult system**: Added Cult Activity buttons that players or GMs can click to share the selected activity and its description to chat.

## [2.4.17] - 2026-04-30

### Fixed
- **PF2e cult system**: Cult name editing now saves only to cult data and no longer changes the party actor name.

## [2.4.16] - 2026-04-30

### Fixed
- **PF2e cult system**: Cult names now default blank instead of using the party name, and mantle selections can be cleared back to no mantle.

## [2.4.15] - 2026-04-30

### Added
- **PF2e cult system**: Added structured per-PC mantle selection on the Cult tab, including each mantle's cult benefit and miracle examples. Players can select mantles for characters they own; GMs can edit all mantle assignments.

## [2.4.14] - 2026-04-30

### Changed
- **PF2e cult system**: Expanded cult event text and added Cult Rivalry controls for Assist bonuses, the rival flat check, and applying FP/RP outcomes.

## [2.4.13] - 2026-04-30

### Changed
- **PF2e cult system**: Improved the party sheet Cult tab layout, preserved the active Cult tab while GMs edit values, added a GM player-view preview, and added cult event rolling with effect buttons for simple event outcomes.

## [2.4.12] - 2026-04-30

### Added
- **PF2e cult system**: Added an optional GM-enabled Cult tab for PF2e party sheets, with editable cult statistics, derived Fervor and Size summaries, Mythic Point tracking, phase notes, and a cult level check roll.

## [2.4.11] - 2026-04-30

### Removed
- **Auto Walls prototype**: Removed the scene auto-walling tool and all related browser-side detector code.

## [2.4.10] - 2026-04-30

### Fixed
- **Auto Walls prototype**: Tightened grid-continuity detection and suppressed tiny isolated L-corners that could be mistaken for wall structure.

## [2.4.9] - 2026-04-30

### Added
- **Auto Walls prototype**: Added a grid-continuity wall candidate pass to recover longer grid-aligned wall spans that are too subtle or broken for the direct edge-run detector.

## [2.4.8] - 2026-04-30

### Added
- **Auto Walls prototype**: Added Auto Tune, which sweeps detector presets in-browser, scores wall-like structure, and previews the best candidate automatically.

## [2.4.7] - 2026-04-30

### Changed
- **Auto Walls prototype**: Added live detector tuning controls and stricter defaults to reduce short furniture/decor artifacts while previewing wall detection.

## [2.4.6] - 2026-04-30

### Fixed
- **Auto Walls prototype**: Correctly maps detected image coordinates onto the padded Foundry scene canvas so previews and created walls align with the map image.

## [2.4.5] - 2026-04-30

### Added
- **Auto Walls prototype**: Added a GM scene-control tool that previews browser-native wall and door detection for the active scene background and can apply the preview as Foundry Wall documents.

## [2.4.4] - 2026-04-29

### Fixed
- **Party token cluster**: Trimmed transparent padding from generated party images so the party view thumbnail displays at a usable size.

## [2.4.3] - 2026-04-29

### Fixed
- **Party token cluster**: Updated placed party tokens on the active scene after generating the cluster image and removed Foundry v13 FilePicker deprecation warnings.

## [2.4.2] - 2026-04-29

### Added
- **Party token cluster**: PF2e party tokens now have a Cluster Party button in Token Configuration. It builds a crowd-style token image from party member token art, lightly scales members by creature size, saves it in the world folder, and applies it to the party actor and token.

## [2.4.1] - 2026-04-28

### Fixed
- Fixed bugs.

## [2.4.0] - 2026-04-26

### Added
- **Victory Music**: After combat ends, plays a track based on how hard the fight was. Set a Generic track as a fallback, a Trivial track for easy encounters (under 40 XP per player), and a Boss track for severe/extreme encounters (120+ XP per player). Configured via a new Victory Music panel in Module Settings.

## [2.3.5] - 2026-04-26

### Added
- **Improved scene music matching**: After left-trimming words fails ("Agent Castle Eastside" → "Agent Castle" → "Agent"), the search now also tries right-trimming ("Castle Eastside" → "Eastside"). Combined with prefix/article stripping, this catches cases like "H - Farm" matching "The Farm".
- **Button feedback**: The Play Scene Music button now shows a spinner while searching, returning to normal once complete.

## [2.3.4] - 2026-04-26

### Added
- **Play Scene Music button**: A "Play Scene Music" button now appears in the playlist sidebar for GMs. Clicking it manually triggers the scene music search for the current scene, including the folder fallback and playlist selection dialog.

## [2.3.3] - 2026-04-26

### Added
- **Scene Music folder support**: If no playlist matches the scene name exactly, the module now looks for a playlist folder with that name and offers a selection dialog if multiple playlists are found within it.
- **Progressive scene name matching**: If no exact match is found, the module trims the last word from the scene name and tries again (e.g. "Agent Castle Eastside" → "Agent Castle" → "Agent") until something matches or all options are exhausted.
- **v14 compatibility**: Module now marked compatible up to Foundry v14. Dialog windows use the new DialogV2 API when available.

### Fixed
- Module settings (Pause Tracks, Play Scene Music etc.) were not appearing in the settings panel due to a corrupted settings registration.

## [2.3.2] - 2026-04-26

### Added
- **Play Scene Music**: When enabled in Module Settings, automatically plays a playlist matching the current scene's name (or navigation name) when you enter a scene. Stops when combat starts, resumes when combat ends. No matching playlist? Nothing plays.

## [2.3.1] - 2026-04-26

### Fixed
- Flag migration now correctly transfers prototype token music settings from older module versions.

## [2.3.0] - 2026-04-26

### Added
- Automatic migration of token and actor music settings from older versions of the module (combat-music-master, david-music-control) to the new module ID. Your existing setups will carry over seamlessly.

### Changed
- Module renamed to **David Music Control** (id: `pf2-david-music-control`)

---

## [2.2.0] - 2026-04-20

### Added
- **Export / Import**: Export your combat playlists, track settings, and trait rules to a JSON file named after your world. Import it into any other world and the module will recreate missing playlists and tracks automatically, including play mode (shuffle, sequential, etc).

---

## [2.1.0] - 2026-04-19

### Added
- **Combat Theme**: Mark a token as a Combat Theme to use their music as the encounter-wide background track whenever they're in a fight. Competes only against other tokens also marked as Combat Theme, losing gracefully to any token with personal turn music.
- **Boss phase music**: Combat Theme tokens can have multiple tracks set at different HP thresholds. As the boss takes damage and crosses a threshold, the track switches automatically — no turn change needed.
- **Trait-based music (PF2e)**: Set tracks to play based on the PF2e traits of hostile combatants. Encounter undead? Play the undead track. Run into constructs? Different sound. Configured via a new Trait Rules panel in Module Settings.
- **Encounter track interruption**: When a combatant with personal active music takes their turn, the encounter/boss/trait track pauses. When their turn ends, it resumes from where it left off.
- **Reconnect fix**: Closing and reopening the browser mid-combat no longer causes music to get stuck or fail to transition correctly.

---

## [2.0.2] - prior

### Base release
- Original Combat Music Master feature set: combat playlists, per-token music configuration, priority system, turn-only tracks, resource threshold track switching, ambience pausing.

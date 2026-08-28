# Changelog

## [2.4.189] - 2026-08-28

### Fixed
- **Item Piles party stash**: Fixed Party Stash button insertion for the legacy PF2e party-sheet header markup and unstored default settings.

## [2.4.188] - 2026-08-28

### Fixed
- **Item Piles party stash**: Added modern and legacy Foundry header integration paths so the Party Stash control appears on PF2e party sheets.

## [2.4.187] - 2026-08-28

### Fixed
- **Item Piles party stash**: Added the PF2e actor-sheet header hook so the Party Stash button appears in the modern party sheet header.

## [2.4.186] - 2026-08-28

### Added
- **Item Piles party stash**: Added a GM-controlled Party Stash merchant button to PF2e party sheets. When enabled, purchases use the party stash's inventory and currency, while sales return items and funds to the stash; it defaults on when Item Piles is active.

## [2.4.185] - 2026-08-28

### Fixed
- **Creature ambience**: Fixed the per-scene passive creature sounds setting not appearing in modern PF2e Scene Configuration.

## [2.4.184] - 2026-08-28

### Added
- **Creature ambience**: Added a per-scene setting to disable passive creature sounds, enabled by default.

## [2.4.183] - 2026-08-08

### Added
- **Diagnostics**: Added interaction tracing, token-hover probes, and per-callback module ownership near frame stalls.

## [2.4.182] - 2026-08-08

### Added
- **Diagnostics**: Performance reports now include a Copy Report button and selectable plain-text output.

## [2.4.181] - 2026-08-08

### Added
- **Diagnostics**: Slow runtime reports now include invocation caller sources and the active hook/module context.

## [2.4.180] - 2026-08-08

### Added
- **Diagnostics**: Added scene complexity metrics, a recent hook-event timeline, and temporary probes for actor preparation, token refresh, and vision initialization.

## [2.4.179] - 2026-08-08

### Added
- **Diagnostics**: Added temporary runtime probes for PIXI ticker, canvas rendering, perception updates, and Foundry application rendering.

## [2.4.178] - 2026-08-08

### Added
- **Diagnostics**: Timer and animation reports now include registration source locations, call counts, and worst single-callback duration.

## [2.4.177] - 2026-08-08

### Added
- **Diagnostics**: Performance diagnostics now tracks slow timers, intervals, and animation callbacks by their registering module when possible.

## [2.4.176] - 2026-08-08

### Added
- **Diagnostics**: Performance diagnostics now tracks the module or system that registered slow Foundry hook callbacks when browser attribution is unavailable.

## [2.4.166] - 2026-08-06

### Added
- **PF2e tools**: Added Pacifying property-rune automation with an attacker reaction prompt, the DC 20 Will save, and the Pacified effect's –2 penalty to attacks without the nonlethal trait.

## [2.4.163] - 2026-08-06

### Added
- **Diagnostics**: Added a settings button that captures recent and live frame stalls, long main-thread tasks, and slow Foundry hooks during a 10-second lag investigation.

## [2.4.161] - 2026-08-05

### Added
- **Vision**: Added an Enhanced Vision Debug setting that draws and logs center points, intended corners, wall collisions, and final viewpoints.

## [2.4.160] - 2026-08-05

### Fixed
- **Vision**: Enhanced Vision now traces each corner from the token center and places the viewpoint just before the closest wall, preventing wall bypasses while preserving around-corner sightlines.

## [2.4.158] - 2026-08-05

### Added
- **Vision**: Added an optional Enhanced Vision setting that calculates token vision from all four corners of each token footprint.

### Fixed
- **Vision**: Inset Enhanced Vision corner origins slightly so tokens touching walls cannot bypass wall collision from an origin exactly on the wall.

## [2.4.157] - 2026-08-05

### Fixed
- **PF2e tools**: Automatic Toolbelt save rolling now supports action cards whose visible target rows lack stored target UUID data.

## [2.4.156] - 2026-08-05

### Added
- **PF2e tools**: Added GM-controlled automatic rolling for PF2e Toolbelt saves, with Never, For NPCs, and For Everyone options.

## [2.4.155] - 2026-08-05

### Fixed
- **PF2e tools**: Automatic damage waits for every PF2e Toolbelt target save to resolve before applying damage.

## [2.4.153] - 2026-08-04

### Fixed
- **PF2e tools**: Half-damage and automatic damage now select PF2e Toolbelt target buttons using its outcome classes and target-specific actions.

## [2.4.152] - 2026-08-04

### Fixed
- **PF2e tools**: Automatic damage no longer depends on a specific target-helper module ID and remains available for compatible target-aware damage cards.

## [2.4.151] - 2026-08-04

### Fixed
- **PF2e tools**: Automatic and half damage now support PF2e Target Helper's main and splash target rows.

## [2.4.150] - 2026-07-18

### Fixed
- **PF2e tools**: Automatic damage application now only triggers for newly created damage cards, so logging in no longer reapplies old damage from chat history.

## [2.4.149] - 2026-07-11

### Fixed
- **Subsystem tools**: Influence journal-text export now splits chained Discovery and Influence skill DC entries correctly, preserving alternate skills and preventing malformed subsystem events from crashing when opened.

## [2.4.148] - 2026-07-04

### Fixed
- **PF2e tools**: Taunt now applies its Guardian taunt effect to every currently targeted creature instead of only the first target.

## [2.4.147] - 2026-06-27

### Fixed
- **Combat Music**: Personal turn music now still triggers even when no generic combat playlists are marked, and linked tokens can fall back to prototype-token music flags when they do not carry their own local override.

## [2.4.146] - 2026-06-27

### Fixed
- **End credits**: Creature ambience now falls quiet while the credits are running, including already-queued ambient playback messages.
- **Villain Points**: Alliance-based rerolls now resolve the original chat speaker's actor and token more reliably.

## [2.4.145] - 2026-06-26

### Fixed
- **Module load**: Fixed a syntax error in the villain point reroll path that prevented the module settings and floating villain point bar from loading.

## [2.4.144] - 2026-06-26

### Fixed
- **Villain Points**: Rerolls now follow PF2e's native keep-lower / keep-higher path directly, based on alliance.

## [2.4.141] - 2026-06-24

### Fixed
- **Villain Points**: Villain rerolls now preserve the actor's real hero points while still honoring the chosen keep mode for friendly and enemy alliances.

## [2.4.140] - 2026-06-20

### Removed
- **Music**: Removed the playlist playback sync system and its related settings so Foundry handles playback normally again.

## [2.4.139] - 2026-06-15

### Fixed
- **Villain Points**: Friendly alliance villain rerolls now use a normal reroll path that keeps the worse result, while enemy and other alliances keep the better result.

## [2.4.138] - 2026-06-15

### Changed
- **Dramatic health overlays**: Added the token portrait beside the bar and enlarged the display so the target is easier to identify during damage and healing.

## [2.4.115] - 2026-06-06

### Fixed
- **PF2e tools**: `Apply Damage Automatically: Only to NPCs` now resolves PF2e damage-card targets more reliably from actor refs, token UUIDs, and token ids.

## [2.4.114] - 2026-06-06

### Added
- **PF2e tools**: Added a GM-controlled `Apply Damage Automatically` setting for PF2e damage cards with `None`, `Only to NPCs`, and `Always` modes.

### Fixed
- **PF2e tools**: Automatic damage application now skips the temporary full-damage card created during the Half flow, so only the final half-damage card can auto-apply.

## [2.4.113] - 2026-06-06

### Fixed
- **PF2e tools**: Half damage now derives from the already-rolled damage totals when available, instead of re-rolling the original damage formula to produce the halved card.

## [2.4.112] - 2026-06-05

### Fixed
- **Music**: Creature ambience now ignores PF2e `loot` actors, so chests and loot-bundle actors are never selected as ambient sound sources.

## [2.4.111] - 2026-06-05

### Changed
- **Music**: Creature ambience now applies a stronger playback-volume curve so distance and door muffling produce a more noticeable loudness drop in practice.

## [2.4.110] - 2026-06-05

### Fixed
- **PF2e tools**: Half damage now creates a fresh half-damage chat card from the real PF2e damage roll instead of mutating the original full-damage card in place, so the displayed value and applied damage stay in sync.

## [2.4.109] - 2026-06-04

### Fixed
- **PF2e tools**: Half damage now detects rendered `Damage` and `Roll Damage` buttons by label, so the Half button appears reliably on strike cards and spell cards that can roll damage.

### Changed
- **Release files**: Removed old versioned zip archives from the repository so only the canonical `pf2-david-music-control.zip` remains tracked.

## [2.4.108] - 2026-06-04

### Fixed
- **PF2e tools**: Half damage now works from spell cards and other PF2e cards that already expose a normal Damage button, by reusing the same underlying damage action before rewriting the created card to half damage.

## [2.4.107] - 2026-06-04

### Fixed
- **PF2e tools**: Half damage now captures the strike's created damage card even when PF2e does not return a direct chat message object, preventing a normal damage roll from being left behind.

## [2.4.106] - 2026-06-04

### Fixed
- **PF2e tools**: Half damage now reuses the real PF2e damage card generated from the strike, so damage-only traits and flags such as adamantine carry over correctly.

## [2.4.105] - 2026-06-04

### Fixed
- **PF2e tools**: The Half button now appears on attack cards and rolls half damage directly from the strike, preserving the original one-roll damage flow while keeping PF2e traits and context more reliably intact.

## [2.4.104] - 2026-06-04

### Fixed
- **PF2e tools**: Half-damage follow-up cards now preserve the original PF2e damage context, flags, and trait typing much more reliably.

## [2.4.103] - 2026-05-27

### Changed
- **Subsystem tools**: Generated Influence events now include Diplomacy almost all the time, and when it appears its DC is biased toward either the easiest or hardest Influence check.

## [2.4.102] - 2026-05-27

### Fixed
- **Subsystem tools**: Lore skill ids now use PF2e-style hyphenated slugs such as `art-lore` in generated and parsed subsystem data.

## [2.4.101] - 2026-05-27

### Changed
- **Subsystem tools**: Generated Influence events now favor Perception plus a single knowledge skill for Discovery, and no longer offer Perception as an Influence skill.

## [2.4.99] - 2026-05-27

### Added
- **Subsystem export**: The journal export parser now recognizes infiltration-style subsystem text and can turn it into PF2e Subsystems export data.
- **Subsystem tools**: Added a new subsystem generator that can create Influence, Research, or Infiltration events from a chosen level using PF2e level-based DCs, with preview, download, and direct live creation when PF2e Subsystems is enabled.

### Changed
- **Subsystem tools**: The subsystem export window now includes clearer guidance for both pasted-journal conversion and fresh event generation workflows.

## [2.4.98] - 2026-05-25

### Changed
- **Music**: Ambient creature sounds now start from a lower base volume, and forced local debug playback no longer mirrors the same event back onto the GM a second time.

## [2.4.97] - 2026-05-25

### Fixed
- **Music**: Creature ambience no longer selects party-allied creatures as ambient sound sources.

## [2.4.96] - 2026-05-25

### Added
- **Music**: Added a client-side debug override that lets a GM locally test creature ambience through controlled player-facing tokens when no non-GM players are connected.

## [2.4.93] - 2026-05-25

### Changed
- **Music**: Ambient creature sounds now start louder before door and distance muffling are applied.

## [2.4.92] - 2026-05-25

### Fixed
- **Music**: Creature ambience now evaluates PF2e Creature Sounds' bundled data definitions before reading the sound database, avoiding runtime failures from unresolved upstream sound-set constants.

## [2.4.91] - 2026-05-25

### Fixed
- **Music**: Creature ambience now parses PF2e Creature Sounds' bundled sound database more reliably, avoiding startup failures when the upstream bundle formatting changes.

## [2.4.90] - 2026-05-25

### Changed
- **Music**: Ambient creature sounds now favor nearby living threats around currently controlled player tokens most of the time, and the setting text now explicitly explains that audibility is checked to a player's nearest Observer-or-owner token.

## [2.4.88] - 2026-05-25

### Changed
- **Manifest**: Added recommended module listings for PF2e Creature Sounds and PF2e Subsystems so the optional integrations are easier to discover during install.

## [2.4.87] - 2026-05-25

### Added
- **Music**: Added optional ambient creature sounds that use PF2e Creature Sounds, player-only audibility checks, door and distance muffling, and GM mirroring of the loudest player-heard result.

## [2.4.86] - 2026-05-25

### Added
- **Subsystem export**: When PF2e Subsystems is enabled, the journal export window can now create a new live influence or research subsystem entry directly instead of only downloading JSON.

### Changed
- **Subsystem export**: The journal export window is now fully subsystem-focused, with clearer instructions and removal of unrelated music transfer controls from that popup.

## [2.4.85] - 2026-05-25

### Changed
- **At-Will Recharge**: The auto-recharge name matcher now recognizes both `(at will)` and `at-will`.

## [2.4.84] - 2026-05-25

### Added
- **Dice**: Added a `Digital Roll (PCG)` dice fulfillment option to Foundry's Configure Dice settings.

## [2.4.81] - 2026-05-25

### Changed
- **Settings**: Reorganized the module settings into clearer sections for music, PF2e tools, villain points, dramatic health display, and end credits.

## [2.4.80] - 2026-05-24

### Changed
- **Villain Points**: The GM floating villain-point widget is now draggable by its header and remembers its last position per client.

## [2.4.79] - 2026-05-24

### Added
- **Villain Points**: Added a GM-only floating villain-point widget with always-visible `+` and `-` controls for fast manual correction of the current pool.

### Changed
- **Villain Points**: Manually adding a villain point from the GM widget now triggers the same synchronized dread sound, darkened screen pulse, and portent message as a normal villain-point gain.

### Fixed
- **Villain Points**: Added a hero/mythic reroll safety net so PF2e reroll messages explicitly labeled as hero-point or mythic-point rerolls can backfill one tracked spend when the underlying resource-drop detection misses it.

## [2.4.78] - 2026-05-24

### Changed
- **Subsystem export**: Focused the journal transfer tool on PF2e subsystem export workflows, with clearer subsystem-specific wording and removal of the old music-config copy/paste controls from that dialog.

### Fixed
- **Music**: Playlist playback sync now reacts to any playlist track start, pause, or resume instead of only GM-initiated changes.

## [2.4.77] - 2026-05-24

### Added
- **Subsystem export**: The journal transfer tool now detects research-style journal text and exports it into the PF2e subsystem research format.

### Fixed
- **Subsystem export**: Influence milestone parsing now preserves unlock text more cleanly and no longer spills later journal sections into the final milestone entry.
- **Subsystem export**: Research check exports now start each check at 0 current research points while preserving the pasted maximum RP values.

## [2.4.74] - 2026-05-24

### Added
- **Journal transfer**: Added a GM-only journal header button that opens the PF2 Director transfer dialog on demand instead of auto-expanding.
- **Subsystem export**: Added a plain-text journal parser that converts pasted influence-style journal text into a downloadable subsystem export JSON file.

### Changed
- **Transfer tools**: Split transfer logic into reusable import/export helpers so file-based, pasted-JSON, and journal-text export pipelines can all share the same dialog.

## [2.4.73] - 2026-05-23

### Fixed
- **Music**: Active-actor combat tracks now honor `Pause Tracks` during turn-to-turn handoffs, so personal tracks resume from their paused position instead of restarting.

## [2.4.72] - 2026-05-22

### Added
- **Music**: Added an optional `Sync Playlist Playback` world setting that resynchronizes GM-controlled playlist tracks across connected clients after play, pause, resume, track changes, and late joins or reloads.

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

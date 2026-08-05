# Foundry VTT - PF2 Director

![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/Nuku/david-music-control)
![GitHub Releases](https://img.shields.io/github/downloads/Nuku/david-music-control/latest/pf2-david-music-control.zip)
![GitHub All Releases](https://img.shields.io/github/downloads/Nuku/david-music-control/pf2-david-music-control.zip?label=downloads)

PF2 Director is a Foundry VTT module for encounter music control, scene presentation, PF2e table utilities, dramatic overlays, subsystem export tools, and cinematic end credits.

## Installation

Install from the manifest URL:

`https://raw.githubusercontent.com/Nuku/david-music-control/main/module.json`

Compatibility:

- Minimum Foundry version: `13`
- Verified Foundry version: `14`

## Feature Overview

PF2 Director currently includes:

- Combat music selection with per-token music, priorities, combat themes, encounter overrides, and a default combat playlist fallback
- Scene music lookup and manual scene-music playback from the playlists sidebar
- PF2e trait-based combat music rules
- Creature ambience using `pf2e-creature-sounds`, including audibility checks, distance and door muffling, and player-aware playback
- Victory music and Foundry V14 victory fireworks
- PF2e party utilities such as Full Rest, Cult tracking, and clustered party token art
- PF2e chat tools including roll retyping, villain-point rerolls, and explicit Half buttons for strikes, spells, impulses, and other cards that can roll damage
- Dramatic health display overlays with optional damage and healing sounds
- PF2e subsystem export and generation tools, including live creation support when `pf2e-subsystems` is installed
- Integrated end credits with configurable music, background media, and GM start or stop controls
- Optional Enhanced Vision, which calculates token vision from each of its four corners

### Enhanced Vision

When `Enhanced Vision` is enabled, tokens provide vision from all four corners of their footprint rather than only from the center. This can reveal more accurate sightlines around walls, at the cost of additional perception calculations.

## Music

### Combat Music

- Marks playlists as combat playlists and selects encounter music when combat starts
- Supports a default combat playlist when nothing else has higher priority
- Lets tokens define their own combat playlist, track, and priority
- Supports token rules such as HP or resource thresholds, turn-only tracks, and combat theme tokens
- Lets the GM set encounter music directly from the combat tracker
- Supports PF2e trait-based encounter music rules
- Pauses and restores non-combat ambience around combat
- Plays optional victory music after combat
- After victory music ends, automatically resumes the saved pre-combat ambience
- On Foundry V14+, can display colorful victory fireworks scaled from encounter difficulty

### Scene Music

- `Play Scene Music` can automatically look for music when a scene is activated
- A matching playlist by scene name is treated as a strong candidate, but the search continues through folders and other playlist options
- If multiple candidates are found, the GM gets a chooser
- If one candidate is found, it plays directly
- If no replacement is found, current music is left alone
- A manual `Play Scene Music` button is added to the playlists sidebar

### Creature Ambience

When `Enable Creature Ambience` is on:

- ambient creature noises are sourced from `pf2e-creature-sounds`
- audibility is checked to each player's nearest suitable token
- doors and distance reduce what each player hears
- the GM can enable debug logging and a local test override when no players are connected

## PF2e Tools

### Chat Tools

When enabled, PF2 Director adds several PF2e-specific chat actions:

- Roll retyping for eligible non-d20 chat cards, allowing typed damage or healing follow-up cards
- Half-damage buttons for PF2e cards that already expose a damage action, including strikes, spells, and impulses
- Half uses the same underlying PF2e damage action as the normal damage button, then rewrites the created damage card to half damage so traits and context carry over cleanly
- Villain-point reroll buttons on eligible d20 chat messages

### Cluster Party

PF2e party actors get a `Cluster Party` button in Token Configuration. It builds a combined crowd-style token image from party member token art, saves it in the world folder, and applies it to the party actor and token.

### Full Rest

When `Enable Full Rest` is on, PF2e party sheets gain a `Recover` button that:

- heals all party members to full HP
- restores all focus points
- removes the `Wounded` condition
- posts a chat summary and opens a rest report dialog

### At-Will Recharge

When `Enable At-Will Recharge` is on, PF2e items with `(at will)` in their name automatically restore their expended use immediately after activation. This applies to both innate spell uses and frequency-based actions.

### Villain Points

When `Enable Villain Points` is on:

- every time a PF2e character's hero or mythic point total drops, the module tracks that spend
- every configured number of tracked point spends grants the GM 1 villain point, defaulting to 2
- if the most recent 5 chat messages include a gap of 12 hours or more between consecutive messages, tracked point uses and villain points reset to 0
- the GM gets a villain-point reroll button on eligible d20 chat messages
- the GM gets a floating villain-point widget for manual adjustment
- the module can play an optional synchronized dread sound and overlay when villain points are gained or spent

### Cult System

When `Enable PF2e Cult System` is on, PF2e party sheets gain a `Cult` tab for tracking:

- cult name and level
- Fervor, Recruitment, and Mythic points
- mantles and activities
- phase notes and current event state
- cult level checks and related rolls

### Subsystem Export And Generation

PF2 Director includes subsystem tools for PF2e journals and GM prep:

- parses subsystem-style journal text into exportable subsystem JSON
- supports Influence, Research, and Infiltration style data
- can generate new subsystem content from a chosen level
- can download generated subsystem data as JSON
- can create live subsystem entries directly when `pf2e-subsystems` is installed and enabled

## Dramatic Health Display

The module includes a dramatic health overlay system that can:

- show large transient damage or healing panels when visible tokens lose or gain HP
- animate HP bars and deltas with configurable thresholds
- optionally show numbers or rely more on visual presentation
- play separate configurable audio for damage and healing

## Settings

The settings UI is grouped into sections for:

- Music
- PF2e Tools
- Villain Points
- Dramatic Health Display
- End Credits

Additional settings menus include:

- trait music rule configuration
- victory music configuration
- victory fireworks image configuration
- villain point dread sound configuration
- dramatic health sound configuration
- end credits music configuration
- end credits background image or video configuration
- end credits In Memoriam folder override
- end credits start or stop control

## End Credits

The module includes integrated end credits tools for campaign finales and session wrap-ups.

GMs can configure:

- optional credits music
- optional background image or video
- background opacity
- In Memoriam source folder

Credits can then be:

- started or stopped from Module Settings
- prompted with a GM confirmation flow
- controlled by macro or integration code

Macro / API entry points:

```js
game.modules.get("pf2-david-music-control").api.endCredits.prompt();
game.modules.get("pf2-david-music-control").api.endCredits.toggle();
```

Victory fireworks macro / API entry points:

```js
game.modules.get("pf2-david-music-control").api.victoryFireworks.trigger();
game.modules.get("pf2-david-music-control").api.victoryFireworks.trigger({ intensity: 100 });
```

Calling `trigger()` with no arguments uses the current combat to derive intensity and party-centered burst anchors. If no combat is active, it falls back to intensity `60`.

If the legacy `end-credits` module was previously used, this module migrates its saved settings into the integrated end credits feature.

## How Combat Selection Works

When combat starts, the module determines the best music candidate using these broad rules:

- combat playlists begin at baseline priority
- the configured default playlist can override that baseline
- tokens can raise priority with their own assigned music
- encounter-level overrides can replace the normal selection entirely

If multiple candidates tie at the top, one is selected from the tied results.

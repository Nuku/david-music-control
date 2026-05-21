# Foundry VTT - PF2 Director

![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/Nuku/david-music-control)
![GitHub Releases](https://img.shields.io/github/downloads/Nuku/david-music-control/latest/pf2-david-music-control.zip)
![GitHub All Releases](https://img.shields.io/github/downloads/Nuku/david-music-control/pf2-david-music-control.zip?label=downloads)

Control combat music, scene music, victory cues, PF2e party tools, and cinematic end credits in Foundry VTT.

## Installation

Install from the manifest URL:

`https://raw.githubusercontent.com/Nuku/david-music-control/main/module.json`

Compatibility:

- Minimum Foundry version: `13`
- Verified Foundry version: `14`

## Core Music Features

- Marks playlists as combat playlists and selects encounter music when combat starts.
- Supports a default combat playlist when nothing else has higher priority.
- Lets tokens define their own combat playlist, track, and priority.
- Supports token rules such as HP or resource thresholds, turn-only tracks, and combat theme tokens.
- Lets the GM set encounter music directly from the combat tracker.
- Supports PF2e trait-based encounter music rules.
- Pauses and restores non-combat ambience around combat.
- Plays optional victory music after combat.
- After victory music ends, automatically resumes the saved pre-combat ambience.
- On Foundry V14+, can display colorful victory fireworks scaled from the same XP logic used for victory music.

## Scene Music

- `Play Scene Music` can automatically look for music when a scene is activated.
- A matching playlist by scene name is treated as a strong candidate, but the search continues for matching folders and other playlist options.
- If multiple candidates are found, the GM gets a chooser.
- If one candidate is found, it plays directly.
- If no replacement is found, current music is left alone.
- A manual `Play Scene Music` button is added to the playlists sidebar.

## Configuration

Module Settings include:

- `Pause Ambience Sounds`
- `Pause Tracks`
- `Play Scene Music`
- `Fireworks on Victory`
- `Enable PF2e Cult System`
- `Enable Full Rest`
- `Enable At-Will Recharge`
- `Enable Villain Points`

The settings UI also includes:

- Export / Import for music configuration and trait rules
- End credits music configuration
- End credits background image or video configuration
- End credits In Memoriam folder override
- End credits start / stop control

## PF2e Party Tools

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

- every time a PF2e character's hero point total drops, the module counts that as hero point use
- every 2 tracked hero point uses grant the GM 1 villain point
- if the most recent 5 chat messages include a gap of 12 hours or more between consecutive messages, tracked hero point uses and villain points both reset to 0
- the GM gets a `Villain Point` button on d20 chat messages and can spend 1 point to post a reroll of that check

### Cult System

When `Enable PF2e Cult System` is on, PF2e party sheets gain a `Cult` tab for tracking:

- cult name and level
- Fervor, Recruitment, and Mythic points
- mantles and activities
- phase notes and current event state
- cult level checks and related rolls

## End Credits

The module includes integrated end credits tools for campaign finales and session wrap-ups.

GMs can configure:

- optional credits music
- optional background image or video
- background opacity

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

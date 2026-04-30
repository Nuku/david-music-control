# Changelog

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

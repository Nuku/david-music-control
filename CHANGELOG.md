# Changelog

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

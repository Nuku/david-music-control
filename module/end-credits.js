/**
 * End Credits
 *
 * Rolls cinematic scrolling credits featuring all connected players.
 *
 * Usage — create a macro:
 *   game.modules.get("pf2-david-music-control").api.endCredits.toggle();
 *
 * Late-joining players: the GM's toggle persists a world setting so any client
 * that connects while credits are running will start the overlay automatically
 * on their `ready` hook. Music is handled by Foundry's own playlist sync, so
 * late-joiners hear it too without any extra work.
 */

import { MODULE_ID } from './settings.js';
const SCROLL_SPEED = 0.55;
const SOCKET_EVENT = `module.${MODULE_ID}`;

// ── Local state ────────────────────────────────────────────────────────────

let creditsActive = false;
let rafId         = null;
let posY          = 0;

/**
 * Snapshot of sounds that were playing before credits started.
 * Each entry: { playlistId, soundId }
 * Stored only on the GM client; used to restore playback on stop.
 */
let pausedSnapshot = [];

function refreshSettingsToggleButton() {
  const btn = document.querySelector(`button[data-key="${MODULE_ID}.endCreditsToggle"]`);
  if (!btn) return;

  btn.innerHTML = creditsActive
    ? `<i class="fas fa-stop-circle"></i> Stop Credits`
    : `<i class="fas fa-film"></i> Start Credits`;
  btn.style.color = creditsActive ? "var(--color-level-error, #aa2222)" : "";
}

function setCreditsActive(active) {
  creditsActive = active;
  refreshSettingsToggleButton();
}

// ── Silly content ──────────────────────────────────────────────────────────

const SILLY_ROLES = [
  // Dice
  "Chief Dice Fumbler",
  "Senior Dice Blamer",
  "Director of Suspicious Dice Rolling",
  "Head of Dice Accusation",
  "Executive Dice Forgetter",
  "Natural 1 Enthusiast",
  "Dice Feng Shui Consultant",
  "Official Dice Superstition Coordinator",
  "Keeper of the Lucky Dice (That Aren't)",
  "Commissioner of Dice Rerolls That Also Failed",
  "Certified Dice Whisperer (Unverified)",
  "Head of Pre-Roll Rituals",
  "Senior Dice Blower",
  "Director of Blaming the Table",
  "Chief Dice Temperature Regulator",
  "Lead Dice Retirement Counsellor",
  "Executive Producer of Terrible Rolls",
  "Head of Rolling in Full View and Still Missing",
  "Director of Dice Jail Management",
  "Superintendent of Fumbles",

  // Rules
  "Head of Unnecessary Rule Lookups",
  "Chief Rules Lawyer (Unlicensed)",
  "Senior Rules Misrememberer",
  "Director of Citing the Wrong Edition",
  "Executive 'Actually, I Think You'll Find...'",
  "Head of Dramatic Rules Interpretations",
  "Assistant Contradictions Officer",
  "Chief 'We've Always Done It This Way' Officer",
  "Lead Condition Confusion Analyst",
  "Senior 'Let Me Just Check the Wiki' Officer",
  "Director of Making Up Rules That Sound Plausible",
  "Head of Arguing About Readied Actions",
  "Chief Adjacency Dispute Coordinator",
  "Executive Producer of Needless Rulings",
  "Keeper of the Outdated Reference Sheet",

  // Combat strategy (or lack thereof)
  "Director of Splitting the Party",
  "Senior Strategist (Retired After Round 1)",
  "Chief 'I Have a Plan' Officer (Plan Pending)",
  "Head of Charging Directly Into Traps",
  "Executive Flanking Forgetter",
  "Director of Attacking the Obviously Immune Enemy",
  "Lead 'Maybe if I Roll High Enough' Analyst",
  "Chief Overconfidence Consultant",
  "Senior Door-Kicker",
  "Head of Punching Things Until It Works",
  "Director of Standing in the Fireball",
  "Senior 'I'll Go First' Specialist (Went Last)",
  "Chief Action Economy Mismanager",
  "Lead 'Can I Intimidate It?' Researcher",
  "Executive Readied Action Forgetter",
  "Head of Accidentally Shooting Allies",
  "Director of Heroic Last Stands (Poorly Timed)",
  "Chief Tactical Retreat Denier",
  "Senior 'It Has How Many Hit Points?' Analyst",
  "Lead Overextension Coordinator",

  // Roleplay
  "Principal Character Voice Inconsistency Coordinator",
  "Head of Backstory Nobody Asked For",
  "Director of Asking NPCs Completely Off-Topic Questions",
  "Chief Intimidation Attempt Overseer (Failed)",
  "Executive Monologue Deliverer",
  "Head of In-Character Bickering",
  "Senior Dramatic Death Performance Artist",
  "Chief Unnecessary Deception Consultant",
  "Lead Accent Drifter",
  "Director of Suspiciously Convenient Backstory Reveals",
  "Head of Giving the Villain a Redemption Arc, Uninvited",
  "Chief 'My Character Would Never' Enforcement Officer",
  "Senior Dramatic Pause Coordinator",
  "Director of Speeches Nobody Asked For",
  "Lead Unnecessary Alias Creator",
  "Executive Sad Backstory Deliverer (Wrong Moment)",
  "Head of Falling in Love with Every NPC",
  "Chief Unnecessary Disguise Consultant",
  "Senior 'Actually My Character Speaks This Language' Officer",
  "Director of Unilateral Decisions That Affected Everyone",

  // Tavern and travel
  "Head of Provoking the Entire Tavern",
  "Senior Bar Tab Accumulator",
  "Chief 'Let's Ask the Locals' Coordinator",
  "Lead Unnecessary Gambling Enthusiast",
  "Director of Starting Conversations with Guards",
  "Executive 'We Should Rest Here' Officer",
  "Head of Getting Lost with a Map",
  "Senior Rations Complainer",
  "Chief 'Are We There Yet?' Correspondent",
  "Lead 'I Know a Shortcut' Navigator (Didn't)",
  "Director of Getting the Party Banned from Inns",
  "Senior 'What's the Worst That Could Happen?' Analyst",
  "Head of Buying Things Nobody Needed",
  "Executive Overencumbrance Denier",
  "Chief 'I'll Carry the Body' Volunteer",

  // Horses, animals, and pets
  "Head of Naming Horses at Length",
  "Senior Horse Abandonment Coordinator",
  "Chief Familiar Neglect Officer",
  "Director of Animal Companion Misuse",
  "Lead 'Can I Ride It?' Assessor",
  "Executive 'The Horse Is Fine' Denial Officer",
  "Head of Treating the Mount as a Character",
  "Senior Pack Mule Feelings Advocate",
  "Chief 'My Animal Would Never Bolt' Officer",

  // Loot and resources
  "Chief Loot Hoarder",
  "Head of Immediately Spending All Gold",
  "Director of Forgetting Their Spell Slots",
  "Senior Ration Counter",
  "Chief 'I Totally Have That Proficiency' Officer",
  "Executive Torch Forgetter",
  "Lead Potion Hoarder (Never Used Them)",
  "Head of Insisting the Rope Was Definitely Long Enough",
  "Director of Accidentally Selling Important Items",
  "Senior 'I'll Identify It Later' Procrastinator",
  "Chief 'We Can Come Back for It' Coordinator",
  "Lead Cursed Item Early Adopter",
  "Head of Arguing About Treasure Division",
  "Executive 'I Found It, I Keep It' Officer",
  "Senior 'How Much Is This Worth?' Appraiser (Wrong)",

  // GM interaction
  "Chief 'Can I Roll Perception?' Inquirer",
  "Senior 'What Does My Character Know About This?' Asker",
  "Head of Reading the GM's Face for Hints",
  "Director of Doing Exactly What the GM Didn't Want",
  "Executive Red Herring Chaser",
  "Lead Plot Hook Ignorer",
  "Chief Sidequester",
  "Senior 'Is This Important?' Interrogator",
  "Director of Befriending the Villain",
  "Head of Taking the Campaign Somewhere Unexpected",
  "Chief 'Was That Significant?' Asker",
  "Senior 'Can I Try Something Weird?' Applicant",
  "Director of Derailing the Carefully Planned Encounter",
  "Lead 'What If We Just...' Hypothetical Officer",
  "Executive 'The GM Seemed Nervous When I Asked' Analyst",
  "Head of Ignoring the Obvious Solution",
  "Chief 'I Thought That Guy Was a Clue' Investigator",
  "Senior Dramatic Misreading of Foreshadowing",
  "Director of Solving Problems the Long Way Round",
  "Lead 'We Should Burn It Down' Consultant",

  // Meta
  "Chief Session Note Forgetter",
  "Director of 'Wait, Didn't We Already Do This?'",
  "Senior Late Arrival Specialist",
  "Head of Phone Distractions (Combat Only)",
  "Executive 'Sorry, What Happened Last Session?' Officer",
  "Lead Character Sheet Misreader",
  "Chief 'My Backstory Has A Clause For This' Consultant",
  "Senior Bathroom Break Timer (Critical Moments Only)",
  "Director of Asking Questions Answered Two Minutes Ago",
  "Head of Falling Asleep During Exposition",
  "Chief 'Can We Wrap Up? I Have Work Tomorrow' Officer",
  "Senior 'I Thought We Were Playing Next Week' Correspondent",
  "Lead 'Should I Have Read the Module?' Self-Assessor",
  "Executive 'My Character Has Changed Since Session One' Revisionist",
  "Head of Forgetting What Level They Are",
];

// Crew pool — a large list we pick a random subset from each time
const CREW_POOL = [
  ["Dungeon Consultant",                  "A Very Ominous Dungeon"],
  ["Head of Monster Resources",           "An Uncooperative Dragon"],
  ["Director of Ambiance",               "That One Guttering Candle"],
  ["Chief Lore Keeper",                   "The Library of Unread Books"],
  ["Sound Design",                        "Your Collective Groaning"],
  ["Catering",                            "Whatever Was in the Bag"],
  ["Legal Counsel",                       "Arguing With the Rulebook"],
  ["Insurance",                           "Ha"],
  ["Weather Effects",                     "The GM Humming Ominously"],
  ["Animal Wrangler",                     "The Familiar No One Fed"],
  ["Continuity",                          "Nobody, Clearly"],
  ["Stunt Coordination",                  "The Fighter, Unasked"],
  ["Medical Advisor",                     "The Cleric (Eventually)"],
  ["Explosives Consultant",               "The Sorcerer, Probably"],
  ["Negotiation Coach",                   "Completely Unavailable"],
  ["Exit Strategy",                       "Still Being Workshopped"],
  ["Map Accuracy",                        "Not Guaranteed"],
  ["Torch Procurement",                   "Someone Else's Problem"],
  ["NPC Naming Department",               "Bob, Dave, and Also Bob"],
  ["Plot Hole Inspector",                 "Position Currently Vacant"],
  ["Trap Quality Assurance",              "Clearly Not Rigorous Enough"],
  ["Dramatic Lighting",                   "A Single Torch, Dying"],
  ["Script Supervision",                  "Unmonitored Since Act One"],
  ["Villain Motivation Consultant",       "Working on It"],
  ["Dramatic Music",                      "The GM's Spotify, Eventually"],
  ["Interior Design",                     "Dungeon Aesthetic Quarterly"],
  ["Door Safety Inspector",              "Retired After the Third Mimic"],
  ["Encounter Balancing",                 "In Retrospect, No"],
  ["Prophecy Drafting",                   "Intentionally Vague LLC"],
  ["Wardrobe",                            "What Everyone Could Afford"],
  ["Puzzle Design",                       "A Cry for Help"],
  ["Tavern Authenticity Consultant",      "Smells About Right"],
  ["Background NPC Coordinator",         "The Guy in the Corner"],
  ["Horse Continuity",                    "We Don't Talk About the Horse"],
  ["Villain Exit Choreography",           "They Got Away Again"],
  ["Dramatic Pause Timing",              "Off by Three Seconds"],
  ["Secret Door Placement",              "Somewhere They'll Never Look"],
  ["Crowd Simulation",                    "Six People and an Echo"],
  ["Loot Table Curator",                  "Optimistically"],
  ["Morale Officer",                      "The Dog, Technically"],
  ["Foreshadowing",                       "Several Hints Ignored"],
  ["Ominous Prophecy Delivery",          "Read Aloud Too Quickly"],
  ["Environmental Hazard Consultant",     "The Pit Was There for a Reason"],
  ["Inn Ambiance",                        "Suspicious, But Warm"],
  ["Session Pacing",                      "We Tried"],
  ["Final Boss Hype Coordinator",        "Building to Something"],
  ["Cliffhanger Management",             "Sorry"],
  ["Skeleton Procurement",               "An Ancient Burial Ground"],
  ["Arcane Special Effects",             "The Wizard, Who Did Not Ask"],
  ["Character Arc Consultant",           "Growth Was Attempted"],
  ["Miscellaneous Betrayals",            "You Know Who You Are"],
];

// Executive Producers — pick a few random ones
const EXEC_PRODUCERS = [
  "Whoever Brought Snacks",
  "The Player Who Read the Rulebook",
  "An Optimistic Game Master",
  "Three Separate Arguments About Grapple Rules",
  "One (1) Successful Diplomacy Check",
  "The Person Who Remembered to Level Up",
  "Several Whispered Conversations the GM Definitely Heard",
  "That One Homebrew Rule Everyone Forgot About",
  "The Character Sheet Made in the Car on the Way Over",
  "A Shared Delusion That This Would Go Smoothly",
  "The Power of Friendship (and High Initiative)",
  "Whoever Agreed to Track Initiative",
  "Unearned Confidence and Favourable Dice",
  "A GM Who Loves You All and Is Very Tired",
  "Nobody's Second Character Option, Somehow",
];

// Filmed on location entries
const FILMED_ON_LOCATION = [
  "Someone's Kitchen Table",
  "The Definitive Edition of the Battlemaps",
  "A Very Detailed Mental Image",
  "Roll20, More or Less",
  "A Kitchen Table That Has Seen Things",
  "The Imagination of Someone Who Read One History Book",
  "Three Sticky Notes and a Whiteboard",
  "A Map That Was Definitely to Scale",
  "Somewhere Dark and Slightly Damp",
  "A Location That Looked Better in the GM's Head",
];

const SPECIAL_THANKS = [
  "The dice (for occasionally cooperating)",
  "Natural 1s — for keeping things interesting",
  "Natural 20s — for appearing at the least dramatically satisfying moments",
  "The rules — for being occasionally remembered",
  "Snacks — for being there when nothing else was working",
  "Everyone who said 'I have a plan' and did not have a plan",
  "That one NPC everyone got oddly attached to",
  "Whoever kept forgetting their character sheet",
  "The villain, for waiting patiently while we argued about the door",
  "Every trap that was spotted on the second character's turn",
  "Session zero — remembered fondly, honored rarely",
  "The fifteen minutes spent naming the horse",
  "Off-topic conversations that somehow became canon",
  "Everyone who rolled Stealth with disadvantage and somehow passed",
  "The cleric, for healing people slightly too late",
  "The wizard, for using their biggest spell in the first encounter",
  "Whoever drew the map — it was very evocative",
  "The one NPC whose name the GM had to quietly look up every session",
  "The decision to split the party, which worked out fine, technically",
  "Everyone who remembered to use their reaction",
  "The improvised solution nobody expected to work",
  "The enemy that rolled minimum damage every single time",
  "All the plot threads that will definitely come up later",
  "The dead characters who made this possible",
  "The halfling who stood in the way of literally everything",
  "Everyone who took Perception as a dump stat and lived to regret it",
  "The table, for enduring everything that was placed upon it",
  "Tea, coffee, and whatever that third thing was",
  "The critical hit that changed everything",
  "The critical failure that changed everything else",
];

const DISCLAIMERS = [
  "No adventurers were permanently harmed in the making of this campaign.\n(Several were inconvenienced. Many rolled poorly.)",
  "All monsters appearing in this campaign are fictional.\nAny resemblance to actual monsters, living or undead, is purely coincidental.",
  "The events depicted are entirely fictional and occurred entirely within the imagination.\nThe dice results, however, were very real and very devastating.",
  "This campaign was filmed on location in a world that doesn't exist.\nAll decisions made by player characters were their own.",
  "The GM reserves the right to have definitely planned all of that.\nAny evidence to the contrary is circumstantial.",
  "No familiars were harmed during this production.\nSeveral were forgotten. That is a different matter.",
  "Any similarity to actual historical events is either coincidental\nor the result of someone having read half a Wikipedia article.",
  "The management is not responsible for emotional attachment to NPCs\nwho were introduced as comic relief and then killed off.",
  "All traps were tested by professionals.\nThe professionals were not consulted about the results.",
];

const STINGERS = [
  "The horse is still out there. Waiting.",
  "No one ever did go back for the loot in room 7.",
  "The blacksmith whose cart you overturned remembers.",
  "That guard you bribed is still thinking about it.",
  "The villain's apprentice took very detailed notes.",
  "The inn you burned down had a five-star rating.",
  "The rope was not, in fact, long enough.",
  "The NPC you ignored was the king.",
  "Someone, somewhere, is still holding that door open.",
  "The prophecy has been reinterpreted. Again.",
  "The familiar found its way home eventually.",
  "The mimic is still in there. Nobody checked.",
  "The treasure was behind the first door the whole time.",
  "Bob the guard filed a formal complaint.",
  "The mysterious stranger at the bar was exactly who you thought.",
  "The dice remember. The dice always remember.",
  "That random villager wrote a memoir. It sold well.",
  "The cursed item was never officially identified.",
  "The exit was to the left. It was always to the left.",
  "The shopkeeper is still waiting for payment.",
];

// ── Helpers ────────────────────────────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sp(n = 1) {
  return `<span class="ec-spacer" style="display:block;height:${n}em"></span>`;
}

function divider() {
  return `${sp(0.8)}<hr class="ec-divider">${sp(0.8)}`;
}

function sectionHeader(text) {
  return `<div class="ec-section-header">${text}</div>${sp(0.6)}`;
}

function creditRow(left, right) {
  return `
    <div class="ec-credit-row">
      <span class="ec-credit-left">${left}</span>
      <span class="ec-credit-dots"></span>
      <span class="ec-credit-right">${right}</span>
    </div>`;
}

// ── Music ──────────────────────────────────────────────────────────────────
// Foundry's playlist system is server-authoritative and syncs to all clients
// automatically — including late-joiners. So the GM just needs to
// play/stop; everyone hears it with no extra socket work needed.

/**
 * Snapshot every currently-playing sound across all playlists, pause them,
 * then start the credits track.
 */
function startMusic() {
  if (!game.user.isGM) return;

  // ── 1. Snapshot and pause everything currently playing ──────────────────
  pausedSnapshot = [];
  for (const playlist of game.playlists) {
    for (const sound of playlist.sounds) {
      if (sound.playing) {
        pausedSnapshot.push({ playlistId: playlist.id, soundId: sound.id });
        playlist.stopSound(sound);
      }
    }
  }
  if (pausedSnapshot.length) {
    console.log(`[End Credits] Paused ${pausedSnapshot.length} track(s) for credits.`);
  }

  // ── 2. Start the credits track ───────────────────────────────────────────
  const playlistId = game.settings.get(MODULE_ID, "endCreditsPlaylistId");
  const soundId    = game.settings.get(MODULE_ID, "endCreditsSoundId");
  if (!playlistId || !soundId) return;

  const playlist = game.playlists.get(playlistId);
  if (!playlist) { console.warn("[End Credits] Playlist not found:", playlistId); return; }

  const sound = playlist.sounds.get(soundId);
  if (!sound)  { console.warn("[End Credits] Track not found:", soundId); return; }

  playlist.playSound(sound);
}

/**
 * Stop the credits track, then resume whatever was playing before.
 */
function stopMusic() {
  if (!game.user.isGM) return;

  // ── 1. Stop the credits track ────────────────────────────────────────────
  const playlistId = game.settings.get(MODULE_ID, "endCreditsPlaylistId");
  const soundId    = game.settings.get(MODULE_ID, "endCreditsSoundId");
  if (playlistId && soundId) {
    const playlist = game.playlists.get(playlistId);
    const sound    = playlist?.sounds.get(soundId);
    if (sound?.playing) playlist.stopSound(sound);
  }

  // ── 2. Restore previously-playing sounds ─────────────────────────────────
  for (const { playlistId: pid, soundId: sid } of pausedSnapshot) {
    const playlist = game.playlists.get(pid);
    const sound    = playlist?.sounds.get(sid);
    if (sound && !sound.playing) {
      playlist.playSound(sound);
    }
  }
  if (pausedSnapshot.length) {
    console.log(`[End Credits] Restored ${pausedSnapshot.length} track(s).`);
  }
  pausedSnapshot = [];
}

// ── Image Config FormApplication ───────────────────────────────────────────

class EcImageConfig extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id:            "ec-image-config",
      title:         "End Credits — Background Image",
      template:      "modules/pf2-david-music-control/templates/end-credits-image-config.hbs",
      width:         500,
      height:        "auto",
      closeOnSubmit: true,
    });
  }

  getData() {
    return {
      backgroundImage: game.settings.get(MODULE_ID, "endCreditsBackgroundImage"),
      bgOpacity: Math.round((game.settings.get(MODULE_ID, "endCreditsBgOpacity") ?? 1.0) * 100),
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find("#ec-bg-browse").on("click", () => {
      new FilePicker({
        type:     "imagevideo",
        current:  html.find('[name="backgroundImage"]').val(),
        callback: path => html.find('[name="backgroundImage"]').val(path),
      }).browse();
    });

    html.find("#ec-bg-clear").on("click", () => {
      html.find('[name="backgroundImage"]').val("");
    });
  }

  async _updateObject(_event, formData) {
    await game.settings.set(MODULE_ID, "endCreditsBackgroundImage", formData.backgroundImage ?? "");
    await game.settings.set(MODULE_ID, "endCreditsBgOpacity", (parseFloat(formData.bgOpacity) || 100) / 100);
    ui.notifications.info("End Credits: background image saved.");
  }
}

// ── Music Config FormApplication ───────────────────────────────────────────

class EcMusicConfig extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id:            "ec-music-config",
      title:         "End Credits — Music Settings",
      template:      "modules/pf2-david-music-control/templates/end-credits-music-config.hbs",
      width:         480,
      height:        "auto",
      closeOnSubmit: true,
    });
  }

  getData() {
    const savedPlaylistId = game.settings.get(MODULE_ID, "endCreditsPlaylistId");
    const savedSoundId    = game.settings.get(MODULE_ID, "endCreditsSoundId");

    const playlists = game.playlists.map(p => ({
      id:       p.id,
      name:     p.name,
      selected: p.id === savedPlaylistId,
    }));

    const selectedPlaylist = game.playlists.get(savedPlaylistId);
    const sounds = selectedPlaylist
      ? selectedPlaylist.sounds.map(s => ({
          id:       s.id,
          name:     s.name,
          selected: s.id === savedSoundId,
        }))
      : [];

    return { playlists, sounds, savedPlaylistId, savedSoundId };
  }

  activateListeners(html) {
    super.activateListeners(html);

    // When playlist changes, reload the track list dynamically
    html.find("#ec-playlist-select").on("change", async ev => {
      const playlistId = ev.target.value;
      const playlist   = game.playlists.get(playlistId);
      const trackSel   = html.find("#ec-sound-select");
      trackSel.empty();

      if (!playlist || playlist.sounds.size === 0) {
        trackSel.append(`<option value="">— No tracks —</option>`);
        return;
      }

      trackSel.append(`<option value="">— Pick a track —</option>`);
      for (const sound of playlist.sounds) {
        trackSel.append(`<option value="${sound.id}">${sound.name}</option>`);
      }
    });
  }

  async _updateObject(_event, formData) {
    await game.settings.set(MODULE_ID, "endCreditsPlaylistId", formData.playlistId ?? "");
    await game.settings.set(MODULE_ID, "endCreditsSoundId",    formData.soundId    ?? "");
    ui.notifications.info("End Credits: music settings saved.");
  }
}

// ── Credits HTML builder ───────────────────────────────────────────────────

/**
 * Returns the non-GM user who owns this actor, if any.
 * Prefers someone currently active; falls back to any owner.
 */
function getPlayerForActor(actor) {
  const OWNER_LEVEL = 3;
  const ownership   = actor.ownership ?? {};
  const ownerIds    = Object.entries(ownership)
    .filter(([id, level]) => level >= OWNER_LEVEL && id !== "default")
    .map(([id]) => id);
  if (!ownerIds.length) return null;
  const nonGmUsers = game.users.filter(u => !u.isGM);
  return (
    nonGmUsers.find(u => ownerIds.includes(u.id) && u.active) ??
    nonGmUsers.find(u => ownerIds.includes(u.id)) ??
    null
  );
}

function buildCreditsHTML() {
  const gm        = game.users.find(u => u.isGM);
  const worldName = game.world.title || "This Campaign";
  const system    = game.system.title || "Unknown System";

  // Build cast from party members; fall back to non-GM users if no party
  const partyActor   = game.actors.party ?? game.actors.find(a => a.type === "party");
  const partyMembers = partyActor?.members ?? [];
  const castEntries  = partyMembers.map(m => ({ character: m, player: getPlayerForActor(m) }));
  const fallbackPlayers = game.users.filter(u => !u.isGM && u.name);

  let html = "";

  // ── Opening title ─────────────────────────────────────────────────────────
  html += sp(5);
  html += `<div class="ec-tagline">A ${system} Production</div>`;
  html += sp(1.5);
  html += `<div class="ec-world-title">${worldName}</div>`;
  html += sp(0.5);
  html += `<div class="ec-tagline">A Campaign in Several Parts,\nMost of Which Were Not Originally Planned</div>`;
  html += sp(2);

  if (gm) {
    html += `<div class="ec-role-connector">Written, Directed, and Desperately Improvised by</div>`;
    html += sp(0.4);
    html += `<div class="ec-player-name">${gm.name}</div>`;
    html += sp(0.5);
    html += `<div class="ec-role-connector">Executive Producer</div>`;
    html += sp(0.2);
    html += `<div class="ec-role">${gm.name}</div>`;
  }

  // ── Executive Producers ───────────────────────────────────────────────────
  html += divider();
  html += sectionHeader("Executive Producers");
  html += sp(0.5);
  for (const ep of shuffle(EXEC_PRODUCERS).slice(0, 4)) {
    html += `<div class="ec-role">${ep}</div>`;
    html += sp(0.3);
  }

  // ── Cast ──────────────────────────────────────────────────────────────────
  html += divider();
  html += sectionHeader("Cast of Adventurers");

  const rolePool = shuffle(SILLY_ROLES);
  let roleIndex  = 0;

  if (castEntries.length > 0) {
    for (const { character, player } of shuffle(castEntries)) {
      const rolesForPlayer = 2 + Math.floor(Math.random() * 2);
      html += sp(1);
      html += `<div class="ec-player-name">${character.name}</div>`;
      if (player) {
        html += sp(0.15);
        html += `<div class="ec-role-connector">played by ${player.name}</div>`;
      }
      html += sp(0.25);
      html += `<div class="ec-role-connector">as</div>`;
      html += sp(0.2);
      for (let i = 0; i < rolesForPlayer; i++) {
        html += `<div class="ec-role">${rolePool[roleIndex++ % rolePool.length]}</div>`;
      }
    }
  } else if (fallbackPlayers.length > 0) {
    for (const player of shuffle(fallbackPlayers)) {
      const rolesForPlayer = 2 + Math.floor(Math.random() * 2);
      html += sp(1);
      html += `<div class="ec-player-name">${player.name}</div>`;
      html += sp(0.25);
      html += `<div class="ec-role-connector">as</div>`;
      html += sp(0.2);
      for (let i = 0; i < rolesForPlayer; i++) {
        html += `<div class="ec-role">${rolePool[roleIndex++ % rolePool.length]}</div>`;
      }
    }
  } else {
    html += sp(1);
    html += `<div class="ec-role-connector">(No adventurers found to credit.\nThis speaks volumes.)</div>`;
  }

  // ── In Memoriam ───────────────────────────────────────────────────────────
  const EPITAPHS = [
    "Gone, but not forgotten",
    "Technically still on the character sheet",
    "Died as they lived — at an inopportune moment",
    "We said we'd make a memorial. We didn't.",
    "Their dice have been retired with honour",
    "Beloved by all, warned by none",
    "The cleric rolled a 2 on the death save. We don't talk about it.",
    "May their resurrection be swift and affordable",
    "Fell so that others could make the same mistake",
    "Remembered every session, learned from never",
  ];

  const isDead  = a => a.system?.attributes?.hp?.value === 0 || a.system?.attributes?.dying?.value > 0;
  const deadParty = partyMembers.filter(isDead);
  const deadActors = deadParty.length > 0
    ? deadParty
    : (game.actors?.filter(a => a.type === "character" && isDead(a)) ?? []);

  if (deadActors.length > 0) {
    html += divider();
    html += sectionHeader("In Memoriam");
    html += sp(0.5);
    html += `<div class="ec-fine-print" style="font-style:italic;margin-bottom:0.6em;">They fought bravely. They rolled poorly. They will be missed.</div>`;
    for (const actor of deadActors) {
      const player = getPlayerForActor(actor);
      html += sp(0.5);
      html += `<div class="ec-player-name" style="font-size:1.1em;">${actor.name}</div>`;
      if (player) {
        html += `<div class="ec-role-connector" style="font-size:0.8em;">played by ${player.name}</div>`;
      }
      html += `<div class="ec-role-connector" style="font-size:0.8em;margin-top:0.1em;">${pick(EPITAPHS)}</div>`;
    }
  }

  // ── Production crew ───────────────────────────────────────────────────────
  html += divider();
  html += sectionHeader("Production");
  html += sp(0.5);
  // Pick a random 14–18 entries from the full crew pool each time
  const crewCount = 14 + Math.floor(Math.random() * 5);
  for (const [role, name] of shuffle(CREW_POOL).slice(0, crewCount)) {
    html += creditRow(role, name);
    html += sp(0.15);
  }

  // ── Filmed on location ────────────────────────────────────────────────────
  html += divider();
  html += sectionHeader("Filmed on Location");
  html += sp(0.4);
  html += `<div class="ec-role">${pick(FILMED_ON_LOCATION)}</div>`;
  html += sp(0.3);
  html += `<div class="ec-fine-print">No locations were harmed in the making of this production.\nSeveral were looted.</div>`;

  // ── Special thanks ────────────────────────────────────────────────────────
  html += divider();
  html += sectionHeader("Special Thanks");
  html += sp(0.5);
  // Pick 10–14 at random so it's different each time
  const thanksCount = 10 + Math.floor(Math.random() * 5);
  for (const line of shuffle(SPECIAL_THANKS).slice(0, thanksCount)) {
    html += `<div class="ec-fine-print">${line}</div>`;
    html += sp(0.4);
  }

  // ── Disclaimers ───────────────────────────────────────────────────────────
  html += divider();
  // Pick 2–3 disclaimers
  const disclaimerCount = 2 + Math.floor(Math.random() * 2);
  for (const d of shuffle(DISCLAIMERS).slice(0, disclaimerCount)) {
    html += `<div class="ec-fine-print">${d}</div>`;
    html += sp(1);
  }

  // ── Sign-off ──────────────────────────────────────────────────────────────
  html += divider();
  html += sp(1);
  html += `<div class="ec-tagline">${worldName}</div>`;
  html += sp(0.4);
  html += `<div class="ec-fine-print">is a ${system} production.<br>
    All rights reserved.<br>
    Any rights not reserved were lost when somebody rolled a 1 on Arcana.</div>`;

  // ── Post-credits stinger ──────────────────────────────────────────────────
  html += sp(6);
  html += divider();
  html += sp(1);
  html += `<div class="ec-fine-print" style="font-style:italic;color:rgba(200,185,140,0.7);">${pick(STINGERS)}</div>`;
  html += sp(10);

  return html;
}

// ── Background builder ────────────────────────────────────────────────────

const VIDEO_EXTS = new Set(["mp4", "webm", "ogg", "mov"]);

function buildBackgroundHTML() {
  const src = game.settings.get(MODULE_ID, "endCreditsBackgroundImage")?.trim();
  if (!src) return "";   // no image selected — transparent overlay as before

  const ext = src.split(".").pop().toLowerCase();
  if (VIDEO_EXTS.has(ext)) {
    // Video files animate natively; muted required for autoplay in browsers
    const opacity = game.settings.get(MODULE_ID, "endCreditsBgOpacity") ?? 1.0;
    return `<video id="ec-bg" src="${src}" autoplay loop muted playsinline style="opacity:${opacity}"></video>`;
  }
  // Images (including GIFs, which animate automatically)
  const opacity = game.settings.get(MODULE_ID, "endCreditsBgOpacity") ?? 1.0;
  return `<img id="ec-bg" src="${src}" alt="" style="opacity:${opacity}" />`;
}

// ── Overlay lifecycle ──────────────────────────────────────────────────────

function startCredits() {
  if (creditsActive) return;
  setCreditsActive(true);

  // Leave the Foundry sidebar uncovered so players can still use chat,
  // compendiums, etc. while the credits roll. Read the sidebar width at
  // start time so we respect collapsed/resized states.
  const sidebar       = document.querySelector("#sidebar");
  const sidebarWidth  = sidebar ? sidebar.offsetWidth + 4 : 0;

  const overlay = document.createElement("div");
  overlay.id = "ec-overlay";
  overlay.style.right = `${sidebarWidth}px`;
  overlay.innerHTML = `
    ${buildBackgroundHTML()}
    <div id="ec-bg-dim"></div>
    <div id="ec-fade-top"></div>
    <div id="ec-inner">${buildCreditsHTML()}</div>
    <div id="ec-fade-bottom"></div>
    ${game.user.isGM ? `<button id="ec-stop-btn" title="Stop Credits">
      <i class="fas fa-stop-circle"></i> Stop Credits
    </button>` : ""}
  `;

  document.body.appendChild(overlay);
  document.getElementById("ec-stop-btn")?.addEventListener("click", () => apiToggle());

  const inner = document.getElementById("ec-inner");
  posY = window.innerHeight;
  inner.style.transform = `translateX(-50%) translateY(${posY}px)`;

  function tick() {
    if (!creditsActive) return;
    posY -= SCROLL_SPEED;
    const el = document.getElementById("ec-inner");
    if (!el) return;
    if (posY < -(el.offsetHeight + 40)) posY = window.innerHeight + 40;
    el.style.transform = `translateX(-50%) translateY(${posY}px)`;
    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);
}

function stopCredits() {
  if (!creditsActive) return;
  setCreditsActive(false);
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  document.getElementById("ec-overlay")?.remove();
}

// ── Socket ─────────────────────────────────────────────────────────────────

function initSocket() {
  game.socket.on(SOCKET_EVENT, ({ action }) => {
    if (action === "start") startCredits();
    if (action === "stop")  stopCredits();
  });
}

// ── Public API ─────────────────────────────────────────────────────────────

async function apiToggle() {
  if (!game.user.isGM) {
    ui.notifications.warn("End Credits: only the GM can start or stop the credits.");
    return;
  }

  const starting = !(creditsActive || game.settings.get(MODULE_ID, "endCreditsActive"));
  const action   = starting ? "start" : "stop";

  // Persist state so late-joining clients can catch up on their `ready` hook
  await game.settings.set(MODULE_ID, "endCreditsActive", starting);

  // Broadcast to all currently connected clients (they handle their own overlay)
  game.socket.emit(SOCKET_EVENT, { action });

  // GM handles their own overlay
  if (starting) startCredits();
  else          stopCredits();

  // GM handles music (Foundry syncs to everyone else automatically)
  if (starting) startMusic();
  else          stopMusic();
}

async function apiPrompt() {
  if (!game.user.isGM) {
    ui.notifications.warn("End Credits: only the GM can start or stop the credits.");
    return;
  }

  const running = creditsActive || game.settings.get(MODULE_ID, "endCreditsActive");
  const title = running ? "Stop End Credits?" : "Start End Credits?";
  const content = running
    ? "<p>Stop the scrolling end credits for all connected players?</p>"
    : "<p>Start the scrolling end credits for all connected players?</p>";

  if (foundry.applications?.api?.DialogV2) {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title },
      content,
      yes: { label: running ? "Stop Credits" : "Start Credits", icon: running ? "fas fa-stop-circle" : "fas fa-film" },
      no: { label: "Cancel" },
    });
    if (confirmed) return apiToggle();
    return;
  }

  return new Promise((resolve) => {
    new Dialog({
      title,
      content,
      buttons: {
        confirm: {
          icon: running ? '<i class="fas fa-stop-circle"></i>' : '<i class="fas fa-film"></i>',
          label: running ? "Stop Credits" : "Start Credits",
          callback: async () => resolve(await apiToggle()),
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel",
          callback: () => resolve(),
        },
      },
      default: "confirm",
      close: () => resolve(),
    }).render(true);
  });
}

function registerApi() {
  const module = game.modules.get(MODULE_ID);
  if (!module) return;
  module.api = {
    ...(module.api ?? {}),
    endCredits: {
      toggle: apiToggle,
      prompt: apiPrompt,
      start: async () => {
        if (!creditsActive) return apiToggle();
      },
      stop: async () => {
        if (creditsActive) return apiToggle();
      },
      isActive: () => creditsActive,
    },
    promptEndCredits: apiPrompt,
  };
}

// ── Init ───────────────────────────────────────────────────────────────────

Hooks.once("init", () => {
  // World settings — persisted so late-joiners know the current state
  const worldHidden = { scope: "world", config: false };
  game.settings.register(MODULE_ID, "endCreditsActive",          { ...worldHidden, type: Boolean, default: false });
  game.settings.register(MODULE_ID, "endCreditsPlaylistId",      { ...worldHidden, type: String,  default: "" });
  game.settings.register(MODULE_ID, "endCreditsSoundId",         { ...worldHidden, type: String,  default: "" });
  game.settings.register(MODULE_ID, "endCreditsBackgroundImage", { ...worldHidden, type: String,  default: "" });
  game.settings.register(MODULE_ID, "endCreditsBgOpacity",      { ...worldHidden, type: Number,  default: 1.0 });

  // Menu button — Music config (opens form)
  game.settings.registerMenu(MODULE_ID, "endCreditsMusicConfig", {
    name:       "End Credits Music",
    label:      "Configure Music",
    hint:       "Choose a playlist and track to play when the credits roll.",
    icon:       "fas fa-music",
    type:       EcMusicConfig,
    restricted: true,
  });

  // Menu button — Background image config
  game.settings.registerMenu(MODULE_ID, "endCreditsImageConfig", {
    name:       "End Credits Background",
    label:      "Configure Background",
    hint:       "Select an image or video to display behind the credits. Leave blank for the default transparent overlay.",
    icon:       "fas fa-image",
    type:       EcImageConfig,
    restricted: true,
  });

  // Menu button — Toggle credits (runs immediately, no form)
  // We register a dummy Application subclass; the real work is done in
  // renderSettingsConfig where we swap it for a live toggle button.
  game.settings.registerMenu(MODULE_ID, "endCreditsToggle", {
    name:       "End Credits",
    label:      "Start Credits",
    hint:       "Start or stop the scrolling end credits for all players.",
    icon:       "fas fa-film",
    type:       class EcToggleDummy extends FormApplication {
      render() { apiToggle(); }        // intercept — don't open a window
      async _updateObject() {}
    },
    restricted: true,
  });

  console.log("[End Credits] Initialized.");
});

Hooks.once("ready", () => {
  initSocket();

  // ── Late-join catch-up ────────────────────────────────────────────────────
  // If credits were already running when this client connected, start the
  // overlay now. Music is already playing server-side via Foundry's sync.
  if (game.settings.get(MODULE_ID, "endCreditsActive")) {
    console.log("[End Credits] Credits already active — starting overlay for late joiner.");
    startCredits();
  } else {
    refreshSettingsToggleButton();
  }

  // Expose public API
  registerApi();

  console.log(`[End Credits] Ready. Macro: game.modules.get("pf2-david-music-control").api.endCredits.toggle();`);
});

// ── Settings panel — live toggle button ────────────────────────────────────
//
// renderSettingsConfig fires every time the settings window opens (or re-renders).
// We find the row Foundry generated for our end credits menu entry and
// swap its static label for one that reflects the current live state, so the
// GM always sees "Start Credits" or "Stop Credits" accurately.

Hooks.on("renderSettingsConfig", (_app, html) => {
  if (!game.user.isGM) return;

  const root = html instanceof HTMLElement ? html : html[0];
  const btn = root?.querySelector(`button[data-key="${MODULE_ID}.endCreditsToggle"]`);
  if (!btn) return;

  refreshSettingsToggleButton();

  // Re-check label after the click fires (apiToggle is async, so wait a tick)
  btn.addEventListener("click", () => setTimeout(refreshSettingsToggleButton, 50));
});


/**
 * Quest data factories & normalization.
 *
 * Quests are plain serializable objects (not Foundry Documents) so the module
 * stays fully system-agnostic and portable. This module owns the canonical shape
 * and guarantees that data loaded from settings is always well-formed.
 */

import {
  QUEST_STATUS,
  OBJECTIVE_TYPE,
  REWARD_TYPE,
  BANNER_PRESETS
} from "../config.mjs";

/** Cheap unique id helper (Foundry provides randomID at runtime). */
function uid() {
  return foundry.utils.randomID(16);
}

/** @returns {object} A blank objective of the requested type. */
export function makeObjective(type = OBJECTIVE_TYPE.MANUAL, overrides = {}) {
  const base = {
    id: uid(),
    type,
    text: "",
    hidden: false,
    completed: false,
    sort: 0
  };

  if (type === OBJECTIVE_TYPE.KILL) {
    Object.assign(base, { target: "", current: 0, required: 1 });
  }
  if (type === OBJECTIVE_TYPE.TIMED) {
    // duration in seconds; deadline is an absolute epoch (ms) set when the quest starts.
    Object.assign(base, { duration: 600, deadline: null, expired: false });
  }
  return foundry.utils.mergeObject(base, overrides, { inplace: false });
}

/** @returns {object} A blank reward of the requested type. */
export function makeReward(type = REWARD_TYPE.TEXT, overrides = {}) {
  const base = {
    id: uid(),
    type,
    hidden: false,
    granted: false,
    sort: 0
  };

  if (type === REWARD_TYPE.TEXT) {
    Object.assign(base, { text: "" });
  }
  if (type === REWARD_TYPE.ITEM) {
    // Item rewards reference a source Item by UUID (world item or compendium entry).
    Object.assign(base, { itemUuid: "", itemName: "", itemImg: "", quantity: 1 });
  }
  return foundry.utils.mergeObject(base, overrides, { inplace: false });
}

/** @returns {object} A brand-new quest skeleton. */
export function makeQuest(overrides = {}) {
  const base = {
    id: uid(),
    name: game.i18n.localize("QUESTSYSTEM.NewQuestName"),
    img: "icons/sundries/scrolls/scroll-bound-brown.webp",
    status: QUEST_STATUS.INACTIVE,
    description: "",
    // Free-form note shared with (and editable by) every participant.
    notes: "",
    messages: {
      opening: "",
      completion: "",
      warning: ""
    },
    participants: {
      actors: [], // Actor ids
      users: []   // User ids
    },
    objectives: [],
    rewards: [],
    theme: "default",
    // Per-quest banner override (falls back to the theme preset when empty).
    banner: {
      background: "",
      duration: null
    },
    sort: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  return foundry.utils.mergeObject(base, overrides, { inplace: false });
}

/**
 * Normalize an arbitrary stored object into a guaranteed-valid quest. Defensive
 * against partial/legacy data so the UI never crashes on a malformed entry.
 * @param {object} raw
 * @returns {object}
 */
export function normalizeQuest(raw = {}) {
  const quest = makeQuest(raw);

  // Validate status.
  if (!Object.values(QUEST_STATUS).includes(quest.status)) {
    quest.status = QUEST_STATUS.INACTIVE;
  }

  // Validate theme.
  if (!BANNER_PRESETS[quest.theme]) quest.theme = "default";

  // Shared notes are always a plain string.
  if (typeof quest.notes !== "string") quest.notes = "";

  // Re-shape objectives & rewards through their factories to backfill fields.
  quest.objectives = (Array.isArray(raw.objectives) ? raw.objectives : [])
    .map((o) => makeObjective(o.type ?? OBJECTIVE_TYPE.MANUAL, o))
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

  quest.rewards = (Array.isArray(raw.rewards) ? raw.rewards : [])
    .map((r) => makeReward(r.type ?? REWARD_TYPE.TEXT, r))
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

  quest.participants.actors = Array.from(new Set(quest.participants.actors ?? []));
  quest.participants.users = Array.from(new Set(quest.participants.users ?? []));

  return quest;
}

/**
 * Compute progress for a quest's *visible* objectives.
 * @param {object} quest
 * @param {boolean} includeHidden Whether to count hidden objectives (GM view).
 * @returns {{done:number,total:number,pct:number}}
 */
export function questProgress(quest, includeHidden = false) {
  const objectives = quest.objectives.filter((o) => includeHidden || !o.hidden);
  const total = objectives.length;
  const done = objectives.filter((o) => o.completed).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, pct };
}

/**
 * Whether a given user can see a quest at all (assigned via user or owned actor).
 * GMs always see everything.
 * @param {object} quest
 * @param {User} user
 * @returns {boolean}
 */
export function isQuestVisibleTo(quest, user) {
  if (user.isGM) return true;
  // Hide quests that haven't begun from players.
  if (quest.status === QUEST_STATUS.INACTIVE) return false;

  if (quest.participants.users.includes(user.id)) return true;

  // Visible if the user owns any assigned actor.
  return quest.participants.actors.some((actorId) => {
    const actor = game.actors.get(actorId);
    return actor?.testUserPermission(user, "OWNER");
  });
}

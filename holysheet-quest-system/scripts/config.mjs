/**
 * Quest System — Global configuration & constants.
 * System-agnostic: relies only on core Foundry concepts (Actors, Items, Users).
 */

export const MODULE_ID = "holysheet-quest-system";

/** Console-friendly prefix for logging. */
export const LOG_PREFIX = "Quest System |";

/** Setting keys (world- or client-scoped — see registration). */
export const SETTINGS = {
  /** The full quest collection, stored as an object keyed by quest id (world). */
  QUESTS: "quests",
  /** Whether banners are enabled globally (world). */
  ENABLE_BANNERS: "enableBanners",
  /** Quest ids this user has pinned to the on-screen tracker (client). */
  TRACKED_QUESTS: "trackedQuests",
  /** Whether this user's tracker is collapsed (client). */
  TRACKER_COLLAPSED: "trackerCollapsed",
  /** This user's dragged tracker position {left, top} in px (client). */
  TRACKER_POSITION: "trackerPosition"
};

/** Socket event names (single core socket channel, namespaced by `type`). */
export const SOCKET_TYPES = {
  /** Player → GM: apply a state change the player lacks permission for. */
  REQUEST: "request",
  /** GM → everyone: show an animated banner. */
  BANNER: "banner",
  /** GM → everyone: data changed, refresh open apps. */
  REFRESH: "refresh"
};

/** The lifecycle states a quest can be in. */
export const QUEST_STATUS = {
  INACTIVE: "inactive",
  ACTIVE: "active",
  PAUSED: "paused",
  COMPLETED: "completed",
  CANCELLED: "cancelled"
};

/** Display metadata for statuses (icon + i18n key + css modifier). */
export const QUEST_STATUS_META = {
  [QUEST_STATUS.INACTIVE]: { icon: "fa-solid fa-hourglass-start", label: "QUESTSYSTEM.Status.Inactive", css: "inactive" },
  [QUEST_STATUS.ACTIVE]: { icon: "fa-solid fa-play", label: "QUESTSYSTEM.Status.Active", css: "active" },
  [QUEST_STATUS.PAUSED]: { icon: "fa-solid fa-pause", label: "QUESTSYSTEM.Status.Paused", css: "paused" },
  [QUEST_STATUS.COMPLETED]: { icon: "fa-solid fa-trophy", label: "QUESTSYSTEM.Status.Completed", css: "completed" },
  [QUEST_STATUS.CANCELLED]: { icon: "fa-solid fa-ban", label: "QUESTSYSTEM.Status.Cancelled", css: "cancelled" }
};

/** Objective archetypes. */
export const OBJECTIVE_TYPE = {
  MANUAL: "manual",
  KILL: "kill",
  TIMED: "timed"
};

export const OBJECTIVE_TYPE_META = {
  [OBJECTIVE_TYPE.MANUAL]: { icon: "fa-solid fa-list-check", label: "QUESTSYSTEM.Objective.Manual" },
  [OBJECTIVE_TYPE.KILL]: { icon: "fa-solid fa-skull", label: "QUESTSYSTEM.Objective.Kill" },
  [OBJECTIVE_TYPE.TIMED]: { icon: "fa-solid fa-stopwatch", label: "QUESTSYSTEM.Objective.Timed" }
};

/** Reward archetypes. */
export const REWARD_TYPE = {
  TEXT: "text",
  ITEM: "item"
};

export const REWARD_TYPE_META = {
  [REWARD_TYPE.TEXT]: { icon: "fa-solid fa-scroll", label: "QUESTSYSTEM.Reward.Text" },
  [REWARD_TYPE.ITEM]: { icon: "fa-solid fa-gem", label: "QUESTSYSTEM.Reward.Item" }
};

/**
 * Built-in banner presets. Each preset is fully self-contained so GMs can pick a
 * theme without configuring every property. `background` can be overridden per-quest.
 */
export const BANNER_PRESETS = {
  default: {
    label: "QUESTSYSTEM.Theme.Default",
    icon: "fa-solid fa-scroll",
    colorPrimary: "#c9a227",
    colorSecondary: "#1c1b18",
    textColor: "#f5f0e1",
    font: "var(--font-primary, 'Signika', sans-serif)",
    background: "",
    borderStyle: "double"
  },
  medieval: {
    label: "QUESTSYSTEM.Theme.Medieval",
    icon: "fa-solid fa-shield-halved",
    colorPrimary: "#7b1113",
    colorSecondary: "#2b1d0e",
    textColor: "#f3e9d2",
    font: "'Modesto Condensed', 'Signika', serif",
    background: "modules/holysheet-quest-system/assets/themes/medieval.webp",
    borderStyle: "ridge"
  },
  scifi: {
    label: "QUESTSYSTEM.Theme.SciFi",
    icon: "fa-solid fa-satellite-dish",
    colorPrimary: "#00d8ff",
    colorSecondary: "#04121b",
    textColor: "#d6f6ff",
    font: "'Orbitron', 'Signika', sans-serif",
    background: "modules/holysheet-quest-system/assets/themes/scifi.webp",
    borderStyle: "solid"
  },
  steampunk: {
    label: "QUESTSYSTEM.Theme.Steampunk",
    icon: "fa-solid fa-gears",
    colorPrimary: "#b87333",
    colorSecondary: "#241a10",
    textColor: "#f0dfc0",
    font: "'IM Fell English', 'Signika', serif",
    background: "modules/holysheet-quest-system/assets/themes/steampunk.webp",
    borderStyle: "groove"
  }
};

/** Default auto-close duration (ms) for banners. */
export const BANNER_DEFAULT_DURATION = 6000;

/** Convenience global logger. */
export const log = (...args) => console.log(LOG_PREFIX, ...args);
export const warn = (...args) => console.warn(LOG_PREFIX, ...args);
export const error = (...args) => console.error(LOG_PREFIX, ...args);

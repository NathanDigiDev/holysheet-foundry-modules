/**
 * Quest System — module entry point.
 *
 * Wires Foundry lifecycle hooks: registers settings, preloads templates &
 * Handlebars helpers, installs the sidebar tab, opens the socket relay, and
 * starts the timed-objective ticker. Exposes the public API for macros.
 */

import {
  MODULE_ID,
  SETTINGS,
  log
} from "./config.mjs";
import { QuestAPI } from "./api.mjs";
import { QuestSocket } from "./socket.mjs";
import { QuestStore } from "./data/quest-store.mjs";
import { registerSidebar } from "./ui/sidebar.mjs";
import { QuestLogApp } from "./apps/quest-log.mjs";
import { QuestEditorApp } from "./apps/quest-editor.mjs";
import { QuestTrackerApp } from "./apps/quest-tracker.mjs";

/* ------------------------------------------------------------------------- */
/*  INIT                                                                     */
/* ------------------------------------------------------------------------- */

Hooks.once("init", () => {
  log("Initializing Quest System");

  registerSettings();
  registerHandlebarsHelpers();
  preloadTemplates();

  // Public API surface (macros, other modules).
  const module = game.modules.get(MODULE_ID);
  module.api = {
    QuestAPI,
    openLog: () => QuestLogApp.toggle(),
    openEditor: (id) => new QuestEditorApp(id).render({ force: true }),
    tracker: QuestTrackerApp,
    store: QuestStore
  };
  globalThis.QuestSystem = module.api;
});

/* ------------------------------------------------------------------------- */
/*  READY                                                                    */
/* ------------------------------------------------------------------------- */

Hooks.once("ready", () => {
  registerSidebar();
  QuestSocket.listen();
  registerSocketHandlers();
  startTimerLoop();
  cleanupContractNotes(); // remove leftover markers from the deprecated map-contract feature
  QuestTrackerApp.sync(); // show the on-screen tracker if this user has pinned quests
  log("Ready");
});

/* ------------------------------------------------------------------------- */
/*  Settings                                                                 */
/* ------------------------------------------------------------------------- */

function registerSettings() {
  game.settings.register(MODULE_ID, SETTINGS.QUESTS, {
    name: "Quest data",
    scope: "world",
    config: false, // managed entirely through our own UI
    type: Object,
    default: {}
  });

  game.settings.register(MODULE_ID, SETTINGS.ENABLE_BANNERS, {
    name: "QUESTSYSTEM.Settings.EnableBanners.Name",
    hint: "QUESTSYSTEM.Settings.EnableBanners.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  // Per-user tracker state (the MMO-style on-screen overlay).
  game.settings.register(MODULE_ID, SETTINGS.TRACKED_QUESTS, {
    scope: "client",
    config: false,
    type: Array,
    default: []
  });

  game.settings.register(MODULE_ID, SETTINGS.TRACKER_COLLAPSED, {
    scope: "client",
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, SETTINGS.TRACKER_POSITION, {
    scope: "client",
    config: false,
    type: Object,
    default: null
  });
}

/* ------------------------------------------------------------------------- */
/*  Templates & Handlebars helpers                                           */
/* ------------------------------------------------------------------------- */

function preloadTemplates() {
  const paths = [
    "modules/holysheet-quest-system/templates/quest-log.hbs",
    "modules/holysheet-quest-system/templates/quest-tracker.hbs",
    "modules/holysheet-quest-system/templates/editor/tabs.hbs",
    "modules/holysheet-quest-system/templates/editor/details.hbs",
    "modules/holysheet-quest-system/templates/editor/objectives.hbs",
    "modules/holysheet-quest-system/templates/editor/rewards.hbs",
    "modules/holysheet-quest-system/templates/editor/notifications.hbs",
    "modules/holysheet-quest-system/templates/editor/footer.hbs"
  ];
  // v13+ exposes loadTemplates under foundry.applications.handlebars.
  const loader = foundry.applications?.handlebars?.loadTemplates ?? loadTemplates;
  loader(paths);
}

function registerHandlebarsHelpers() {
  Handlebars.registerHelper("questEq", (a, b) => a === b);
  Handlebars.registerHelper("questOr", (a, b) => a || b);
  Handlebars.registerHelper("questPct", (pct) => `${pct ?? 0}%`);
}

/* ------------------------------------------------------------------------- */
/*  Socket request handlers (run on the responsible GM)                      */
/* ------------------------------------------------------------------------- */

function registerSocketHandlers() {
  QuestSocket.onRequest("objectiveToggle", async (data) => {
    await QuestAPI.setObjectiveCompleted(data.questId, data.objectiveId, data.value);
  });

  QuestSocket.onRequest("notesUpdate", async (data) => {
    await QuestAPI.setNotes(data.questId, data.value);
  });
}

/* ------------------------------------------------------------------------- */
/*  Cleanup — remove leftover markers from the deprecated map-contract feature */
/* ------------------------------------------------------------------------- */

/** GM only: delete any map Notes tagged by the removed contract feature. */
async function cleanupContractNotes() {
  if (!game.user.isGM) return;
  try {
    for (const scene of game.scenes) {
      const ids = scene.notes.filter((n) => n.getFlag(MODULE_ID, "questId")).map((n) => n.id);
      if (ids.length) await scene.deleteEmbeddedDocuments("Note", ids);
    }
  } catch (_err) { /* non-fatal — leftover notes can be deleted manually */ }
}

/* ------------------------------------------------------------------------- */
/*  Timed-objective ticker                                                   */
/* ------------------------------------------------------------------------- */

function startTimerLoop() {
  // Only one client needs to drive timers; QuestAPI.tickTimers gates on the GM.
  setInterval(() => QuestAPI.tickTimers(), 1000);
}

/* ------------------------------------------------------------------------- */
/*  Kill / Hunt automation — bump objectives when a token is defeated        */
/* ------------------------------------------------------------------------- */

Hooks.on("updateCombatant", (combatant, changes) => {
  if (!game.user.isGM) return;
  // Many systems flag a defeated combatant with `defeated: true`.
  if (changes.defeated === true) onCreatureDefeated(combatant.actor);
});

/**
 * When a creature is defeated, advance any matching kill objective on active
 * quests. Matching is name-based (case-insensitive substring) to stay system-agnostic.
 * @param {Actor|null} actor
 */
async function onCreatureDefeated(actor) {
  if (!actor) return;
  const name = actor.name.toLowerCase();

  for (const quest of QuestStore.all()) {
    if (quest.status !== "active") continue;
    for (const objective of quest.objectives) {
      if (objective.type !== "kill" || objective.completed) continue;
      if (!objective.target) continue;
      if (name.includes(objective.target.toLowerCase())) {
        await QuestAPI.advanceKillObjective(quest.id, objective.id, 1);
      }
    }
  }
}

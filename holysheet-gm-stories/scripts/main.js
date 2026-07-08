import { MODULE_ID, SETTINGS, log, localize } from "./config.js";
import { FileStorage } from "./data/file-storage.js";
import { NoteStore } from "./data/note-store.js";
import { openMainApp } from "./apps/gm-stories-app.js";
import { installFloatingButton } from "./ui/floating-button.js";
import { installCanvasShortcuts } from "./ui/canvas-shortcuts.js";

Hooks.once("init", () => {
  log("init");
  registerSettings();
  registerHandlebarsHelpers();

  const module = game.modules.get(MODULE_ID);
  module.api = {
    open: openMainApp,
    notes: NoteStore,
    storage: FileStorage
  };
  globalThis.HolySheetGMStories = module.api;
});

Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  await FileStorage.ensureReady();
  installFloatingButton();
  installCanvasShortcuts();
  log(localize("HSGM.StorageReady"), FileStorage.notesPath);
});

function registerSettings() {
  game.settings.register(MODULE_ID, SETTINGS.INDEX, {
    name: "HSGM.Settings.Index.Name",
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  game.settings.register(MODULE_ID, SETTINGS.FLOATING_POSITION, {
    name: "HSGM.Settings.FloatingPosition.Name",
    scope: "client",
    config: false,
    type: Object,
    default: { left: 88, top: 120 }
  });

  game.settings.register(MODULE_ID, SETTINGS.FOLDERS, {
    name: "HSGM.Settings.Folders.Name",
    scope: "world",
    config: false,
    type: Array,
    default: []
  });
}

function registerHandlebarsHelpers() {
  Handlebars.registerHelper("hsgmEq", (a, b) => a === b);
  Handlebars.registerHelper("hsgmOr", (a, b) => a || b);
  Handlebars.registerHelper("hsgmJoin", (items, separator = " ") => Array.isArray(items) ? items.join(separator) : "");
}

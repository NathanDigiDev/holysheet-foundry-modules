import { registerSettings, SYSTEM_ID } from "./config.mjs?v=0.1.7";
import { HolySheetCharacterData, HolySheetEquipmentData, HolySheetNpcData } from "./data-models.mjs?v=0.1.7";
import { HolySheetActor } from "./documents/actor.mjs?v=0.1.7";
import { HolySheetItem } from "./documents/item.mjs?v=0.1.7";
import { HolySheetActorSheet } from "./sheets/actor-sheet.mjs?v=0.1.7";
import { HolySheetItemSheet } from "./sheets/item-sheet.mjs?v=0.1.7";

const TEMPLATE_VERSION = "0.1.7";

function versionTemplate(path) {
  return `${path}?v=${TEMPLATE_VERSION}`;
}

Hooks.once("init", async () => {
  console.log("HolySheet | Initialisation du systeme");

  registerSettings();

  CONFIG.Actor.documentClass = HolySheetActor;
  CONFIG.Item.documentClass = HolySheetItem;

  Object.assign(CONFIG.Actor.dataModels, {
    character: HolySheetCharacterData,
    npc: HolySheetNpcData
  });

  Object.assign(CONFIG.Item.dataModels, {
    equipment: HolySheetEquipmentData
  });

  const DocumentSheetConfig = foundry.applications.apps.DocumentSheetConfig;

  DocumentSheetConfig.unregisterSheet(Actor, "core", foundry.appv1.sheets.ActorSheet);
  DocumentSheetConfig.registerSheet(Actor, SYSTEM_ID, HolySheetActorSheet, {
    types: ["character", "npc"],
    makeDefault: true
  });

  DocumentSheetConfig.unregisterSheet(Item, "core", foundry.appv1.sheets.ItemSheet);
  DocumentSheetConfig.registerSheet(Item, SYSTEM_ID, HolySheetItemSheet, {
    types: ["equipment"],
    makeDefault: true
  });

  await preloadTemplates();
});

async function preloadTemplates() {
  return loadTemplates([
    versionTemplate("systems/holysheet/templates/actor/character-sheet.hbs"),
    versionTemplate("systems/holysheet/templates/actor/npc-sheet.hbs"),
    versionTemplate("systems/holysheet/templates/item/equipment-sheet.hbs")
  ]);
}

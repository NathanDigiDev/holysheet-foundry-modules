import { registerSettings, SYSTEM_ID } from "./config.mjs";
import { HolySheetCharacterData, HolySheetEquipmentData, HolySheetNpcData } from "./data-models.mjs";
import { HolySheetActor } from "./documents/actor.mjs";
import { HolySheetItem } from "./documents/item.mjs";
import { HolySheetActorSheet } from "./sheets/actor-sheet.mjs";
import { HolySheetItemSheet } from "./sheets/item-sheet.mjs";

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
    "systems/holysheet/templates/actor/character-sheet.hbs",
    "systems/holysheet/templates/actor/npc-sheet.hbs",
    "systems/holysheet/templates/item/equipment-sheet.hbs"
  ]);
}

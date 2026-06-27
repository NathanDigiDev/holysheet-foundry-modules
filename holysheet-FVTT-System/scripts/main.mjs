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

  const ActorSheetBase = foundry.appv1.sheets.ActorSheet;
  const ItemSheetBase = foundry.appv1.sheets.ItemSheet;

  foundry.documents.collections.Actors.unregisterSheet("core", ActorSheetBase);
  foundry.documents.collections.Actors.registerSheet(SYSTEM_ID, HolySheetActorSheet, {
    types: ["character", "npc"],
    makeDefault: true
  });

  foundry.documents.collections.Items.unregisterSheet("core", ItemSheetBase);
  foundry.documents.collections.Items.registerSheet(SYSTEM_ID, HolySheetItemSheet, {
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

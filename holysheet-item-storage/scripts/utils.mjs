import { DEFAULT_ICON, FLAGS, MODULE_ID } from "./config.mjs";

const QUANTITY_PATHS = [
  "system.quantity",
  "system.qty",
  "system.stack",
  "system.amount",
  "system.uses.value"
];

export function isContainerItem(item) {
  return item?.documentName === "Item" && item.getFlag(MODULE_ID, FLAGS.IS_CONTAINER) === true;
}

export function containerIcon(item) {
  return item?.getFlag(MODULE_ID, FLAGS.ICON) || item?.img || DEFAULT_ICON;
}

export function randomId() {
  return foundry.utils.randomID();
}

export function getContents(item) {
  const contents = item?.getFlag(MODULE_ID, FLAGS.CONTENTS);
  return Array.isArray(contents) ? foundry.utils.deepClone(contents) : [];
}

export async function setContents(item, contents) {
  await item.setFlag(MODULE_ID, FLAGS.CONTENTS, contents);
}

export function normalizeDroppedItem(item) {
  const data = item.toObject();
  const quantity = getQuantity(data);
  const entry = {
    id: randomId(),
    name: item.name,
    img: item.img || DEFAULT_ICON,
    type: item.type,
    quantity,
    quantityPath: findQuantityPath(data),
    data
  };

  delete entry.data._id;
  return entry;
}

export function itemDataForActor(entry, amount = 1) {
  const data = foundry.utils.deepClone(entry.data ?? {});
  delete data._id;
  delete data.folder;
  delete data.ownership;
  delete data._stats;
  data.name = data.name || entry.name;
  data.type = data.type || entry.type;
  data.img = data.img || entry.img || DEFAULT_ICON;

  if (entry.quantityPath) {
    foundry.utils.setProperty(data, entry.quantityPath, Math.max(1, Number(amount) || 1));
  }
  return data;
}

export function decrementEntry(entry, amount = 1) {
  const current = Math.max(1, Number(entry.quantity) || 1);
  const next = current - Math.max(1, Number(amount) || 1);
  if (next <= 0) return null;

  const updated = foundry.utils.deepClone(entry);
  updated.quantity = next;
  if (updated.quantityPath) foundry.utils.setProperty(updated.data, updated.quantityPath, next);
  return updated;
}

export function getQuantity(data) {
  const path = findQuantityPath(data);
  const value = path ? Number(foundry.utils.getProperty(data, path)) : 1;
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function findQuantityPath(data) {
  return QUANTITY_PATHS.find((path) => {
    const value = foundry.utils.getProperty(data, path);
    return value !== undefined && value !== null && value !== "";
  }) ?? null;
}

export async function documentFromUuidSafe(uuid) {
  if (!uuid) return null;
  try {
    return await fromUuid(uuid);
  } catch (_err) {
    return null;
  }
}

export function getDefaultItemType() {
  if (game.system.id === "holysheet") return "equipment";

  const documentTypes = game.system.documentTypes?.Item;
  if (documentTypes && Object.keys(documentTypes).length) return Object.keys(documentTypes)[0];

  const labels = CONFIG.Item?.typeLabels;
  if (labels && Object.keys(labels).length) return Object.keys(labels)[0];

  return "item";
}

export function makeContainerSystemData() {
  if (game.system.id !== "holysheet") return {};
  return {
    category: "Contenant",
    quantity: 1,
    equipable: false,
    equipped: false,
    description: "",
    notes: ""
  };
}

export function htmlElement(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  return null;
}

export function userOwnsActor(actor, user = game.user) {
  if (!actor || !user) return false;
  if (user.isGM) return true;
  try {
    return actor.testUserPermission(user, "OWNER");
  } catch (_err) {
    return actor.isOwner;
  }
}

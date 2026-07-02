export const MODULE_ID = "holysheet-item-storage";
export const SOCKET_CHANNEL = `module.${MODULE_ID}`;

export const FLAGS = {
  IS_CONTAINER: "isContainer",
  CONTENTS: "contents",
  ICON: "icon",
  NOTE: "note"
};

export const SCENE_FLAGS = {
  PLACEMENTS: "placements"
};

export const SOCKET_TYPES = {
  REQUEST: "request",
  REFRESH: "refresh"
};

export const SOCKET_ACTIONS = {
  TAKE_ENTRY: "takeEntry"
};

export const DEFAULT_ICON = `modules/${MODULE_ID}/assets/chest.svg`;

export function localize(key) {
  return game.i18n.localize(key);
}

export function format(key, data = {}) {
  return game.i18n.format(key, data);
}

export function log(...args) {
  console.log(`${MODULE_ID} |`, ...args);
}

export function warn(...args) {
  console.warn(`${MODULE_ID} |`, ...args);
}

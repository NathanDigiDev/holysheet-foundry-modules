export const MODULE_ID = "holysheet-gm-stories";
export const MODULE_KEY = "HSGM";

export const SETTINGS = {
  INDEX: "index",
  FOLDERS: "folders",
  FLOATING_POSITION: "floatingPosition"
};

export const FLAGS = {
  NOTE_ID: "noteId",
  SHORTCUTS: "shortcuts"
};

export const NOTE_TYPES = {
  GENERAL: "general",
  ACTOR: "actor",
  SCENE: "scene",
  ITEM: "item"
};

export const NOTE_TYPE_META = {
  [NOTE_TYPES.GENERAL]: {
    label: "HSGM.TypeGeneral",
    fallback: "General",
    icon: "fa-solid fa-align-left",
    collection: null,
    documentName: null
  },
  [NOTE_TYPES.ACTOR]: {
    label: "HSGM.TypeActor",
    fallback: "Personnage",
    icon: "fa-solid fa-user",
    collection: "actors",
    documentName: "Actor"
  },
  [NOTE_TYPES.SCENE]: {
    label: "HSGM.TypeScene",
    fallback: "Scène",
    icon: "fa-solid fa-map",
    collection: "scenes",
    documentName: "Scene"
  },
  [NOTE_TYPES.ITEM]: {
    label: "HSGM.TypeItem",
    fallback: "Item",
    icon: "fa-solid fa-gem",
    collection: "items",
    documentName: "Item"
  }
};

export const DEFAULT_NOTE_ICON = "fa-solid fa-scroll";
export const DEFAULT_NOTE_COLOR = "brass";

export const COLOR_OPTIONS = {
  brass: "var(--hs-brass-bright)",
  emerald: "var(--hs-accent-bright)",
  parchment: "var(--hs-ink-strong)",
  violet: "var(--hsgm-violet)",
  red: "var(--hsgm-red)"
};

export function localize(key) {
  return game.i18n.localize(key);
}

export function localizeFallback(key, fallback) {
  const value = game.i18n.localize(key);
  return value === key ? fallback : value;
}

export function formatType(type) {
  const meta = NOTE_TYPE_META[type] ?? NOTE_TYPE_META[NOTE_TYPES.GENERAL];
  return localizeFallback(meta.label, meta.fallback);
}

export function log(...args) {
  console.log(`${MODULE_ID} |`, ...args);
}

export function warn(...args) {
  console.warn(`${MODULE_ID} |`, ...args);
}

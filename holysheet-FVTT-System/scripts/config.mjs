export const SYSTEM_ID = "holysheet";

export const HOLYSHEET_DEFAULTS = {
  sheetModules: {
    biography: true,
    skillsTab: true,
    inventoryTab: true,
    aptitudes: true,
    commonSkills: true,
    specialSkills: true,
    resources: true,
    armor: true,
    inventory: true,
    currency: true,
    customStates: true,
    level: true
  },
  aptitudes: [
    {
      key: "intelligence",
      label: "Intelligence",
      abbreviation: "INT",
      value: 30,
      description: "Analyse, savoir, raisonnement"
    },
    {
      key: "charisme",
      label: "Charisme",
      abbreviation: "CHA",
      value: 30,
      description: "Influence, presence sociale"
    },
    {
      key: "endurance",
      label: "Endurance",
      abbreviation: "END",
      value: 30,
      description: "Resistance, souffle, robustesse"
    },
    {
      key: "dexterite",
      label: "Dexterite",
      abbreviation: "DEX",
      value: 30,
      description: "Precision, adresse, coordination"
    },
    {
      key: "force",
      label: "Force",
      abbreviation: "FOR",
      value: 30,
      description: "Puissance physique"
    }
  ],
  commonSkills: [
    { key: "artisanat", label: "Artisanat", value: 30, description: "" },
    { key: "combat-distance", label: "Combat a Distance", value: 30, description: "" },
    { key: "combat-rapproche", label: "Combat rapproche", value: 30, description: "" },
    { key: "courir-sauter", label: "Courir, Sauter", value: 30, description: "" },
    { key: "discretion", label: "Discretion", value: 30, description: "" },
    { key: "intimider", label: "Intimider", value: 30, description: "" },
    { key: "mentir-convaincre", label: "Mentir, convaincre", value: 30, description: "" },
    { key: "perception", label: "Perception", value: 30, description: "" },
    { key: "psychologie", label: "Psychologie", value: 30, description: "" },
    { key: "reflexes", label: "Reflexes", value: 30, description: "" },
    { key: "soigner", label: "Soigner", value: 30, description: "" },
    { key: "survie", label: "Survie", value: 30, description: "" }
  ],
  itemCategories: [
    "Armes",
    "Armure",
    "Bijou",
    "Consommable",
    "Documents",
    "Divers",
    "Ingredient et Materiau",
    "Munition",
    "Potion",
    "Vetement",
    "Invocation et pet"
  ],
  currencies: [
    {
      key: "credits",
      label: "Credits",
      icon: "icons/commodities/currency/coins-assorted-mix-copper.webp",
      amount: 0,
      equivalentTo: "",
      rate: 0
    }
  ],
  customStates: []
};

export function registerSettings() {
  const settings = [
    ["sheetModules", HOLYSHEET_DEFAULTS.sheetModules],
    ["aptitudes", HOLYSHEET_DEFAULTS.aptitudes],
    ["commonSkills", HOLYSHEET_DEFAULTS.commonSkills],
    ["itemCategories", HOLYSHEET_DEFAULTS.itemCategories],
    ["currencies", HOLYSHEET_DEFAULTS.currencies],
    ["customStates", HOLYSHEET_DEFAULTS.customStates]
  ];

  for (const [key, value] of settings) {
    game.settings.register(SYSTEM_ID, key, {
      name: `HolySheet ${key}`,
      scope: "world",
      config: false,
      type: Object,
      default: value
    });
  }
}

export function getHolySheetSetting(key) {
  try {
    const saved = foundry.utils.deepClone(game.settings.get(SYSTEM_ID, key));
    const defaults = foundry.utils.deepClone(HOLYSHEET_DEFAULTS[key]);

    if (isPlainObject(defaults) && isPlainObject(saved)) {
      return foundry.utils.mergeObject(defaults, saved, { inplace: false });
    }

    return saved ?? defaults;
  } catch (_error) {
    return foundry.utils.deepClone(HOLYSHEET_DEFAULTS[key]);
  }
}

export function getHolySheetWorldConfig() {
  return {
    sheetModules: getHolySheetSetting("sheetModules"),
    aptitudes: getHolySheetSetting("aptitudes"),
    commonSkills: getHolySheetSetting("commonSkills"),
    itemCategories: getHolySheetSetting("itemCategories"),
    currencies: getHolySheetSetting("currencies"),
    customStates: getHolySheetSetting("customStates")
  };
}

export function clampPercent(value, fallback = 30) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(100, Math.max(1, Math.round(numeric)));
}

export function normalizeConfigKey(value, fallbackPrefix = "entry") {
  const base = String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base || `${fallbackPrefix}-${foundry.utils.randomID(6)}`;
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

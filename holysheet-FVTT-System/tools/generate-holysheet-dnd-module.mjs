import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";

const FOUNDRY_DATA = "C:/Users/Hal/AppData/Local/FoundryVTT/Data";
const FOUNDRY_APP = "C:/Program Files/Foundry Virtual Tabletop/resources/app/package.json";
const DND_SYSTEM = path.join(FOUNDRY_DATA, "systems/dnd5e");
const MODULE_ID = "holysheet-dnd-compendiums";
const MODULE_ROOT = process.env.HOLYSHEET_DND_MODULE_ROOT || path.join(FOUNDRY_DATA, "modules", MODULE_ID);
const PACKS_ROOT = path.join(MODULE_ROOT, "packs");

const requireFoundry = createRequire(FOUNDRY_APP);
const { ClassicLevel } = requireFoundry("classic-level");

const PACK_DEFINITIONS = [
  {
    name: "dnd-actors-holysheet",
    label: "DnD converti - Acteurs",
    type: "Actor",
    sourceTypes: ["Actor"]
  },
  {
    name: "dnd-equipment-holysheet",
    label: "DnD converti - Objets, sorts et options",
    type: "Item",
    sourceTypes: ["Item"]
  },
  {
    name: "dnd-rules-holysheet",
    label: "DnD converti - Regles",
    type: "JournalEntry",
    sourceTypes: ["JournalEntry"]
  },
  {
    name: "dnd-tables-holysheet",
    label: "DnD converti - Tables",
    type: "RollTable",
    sourceTypes: ["RollTable"]
  }
];

const COLLECTION_BY_TYPE = {
  Actor: "actors",
  Item: "items",
  JournalEntry: "journal",
  RollTable: "tables"
};

const ITEM_CATEGORY_BY_DND_TYPE = {
  background: "Historique DnD",
  class: "Classe DnD",
  consumable: "Consommable DnD",
  container: "Contenant DnD",
  equipment: "Equipement DnD",
  feat: "Capacite DnD",
  loot: "Butin DnD",
  race: "Origine DnD",
  spell: "Sort DnD",
  subclass: "Sous-classe DnD",
  tool: "Outil DnD",
  weapon: "Arme DnD"
};

const ABILITY_LABELS = {
  str: "Force",
  dex: "Dexterite",
  con: "Constitution",
  int: "Intelligence",
  wis: "Sagesse",
  cha: "Charisme"
};

const SKILL_LABELS = {
  acr: "Acrobaties",
  ani: "Dressage",
  arc: "Arcanes",
  ath: "Athletisme",
  dec: "Tromperie",
  his: "Histoire",
  ins: "Perspicacite",
  itm: "Intimidation",
  inv: "Investigation",
  med: "Medecine",
  nat: "Nature",
  prc: "Perception",
  prf: "Representation",
  per: "Persuasion",
  rel: "Religion",
  slt: "Escamotage",
  ste: "Discretion",
  sur: "Survie"
};

const now = Date.now();
let compendiumArtMapping = {};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const systemManifest = JSON.parse(await fs.readFile(path.join(DND_SYSTEM, "system.json"), "utf8"));
  compendiumArtMapping = await loadCompendiumArtMapping();

  await ensureFreshModuleDirectory();
  await fs.mkdir(PACKS_ROOT, { recursive: true });

  const stats = {
    sourceSystem: `${systemManifest.id} ${systemManifest.version}`,
    moduleRoot: MODULE_ROOT,
    packs: {}
  };

  const packDocs = {
    "dnd-actors-holysheet": [],
    "dnd-equipment-holysheet": [],
    "dnd-rules-holysheet": [],
    "dnd-tables-holysheet": []
  };

  for (const pack of systemManifest.packs) {
    if (!COLLECTION_BY_TYPE[pack.type]) continue;
    const docs = await readRootDocuments(pack);
    for (const doc of docs) {
      if (pack.type === "Actor") packDocs["dnd-actors-holysheet"].push(convertActor(doc, pack));
      if (pack.type === "Item") packDocs["dnd-equipment-holysheet"].push(convertItem(doc, pack));
      if (pack.type === "JournalEntry") packDocs["dnd-rules-holysheet"].push(convertJournal(doc, pack));
      if (pack.type === "RollTable") packDocs["dnd-tables-holysheet"].push(convertRollTable(doc, pack));
    }
  }

  const actorFolders = assignActorFolders(packDocs["dnd-actors-holysheet"]);

  for (const definition of PACK_DEFINITIONS) {
    const docs = packDocs[definition.name].sort(sortByName);
    const folders = definition.name === "dnd-actors-holysheet" ? actorFolders : [];
    stats.packs[definition.name] = await writePack(definition, docs, folders);
  }

  await fs.writeFile(path.join(MODULE_ROOT, "module.json"), JSON.stringify(buildModuleManifest(), null, 2), "utf8");
  await fs.writeFile(path.join(MODULE_ROOT, "README.md"), buildReadme(systemManifest), "utf8");

  console.log(JSON.stringify(stats, null, 2));
}

async function loadCompendiumArtMapping() {
  try {
    return JSON.parse(await fs.readFile(path.join(DND_SYSTEM, "json", "fa-token-mapping.json"), "utf8"));
  } catch {
    return {};
  }
}

async function ensureFreshModuleDirectory() {
  try {
    await fs.access(MODULE_ROOT);
    const backupPath = `${MODULE_ROOT}-backup-${new Date().toISOString().replace(/[:.]/g, "").slice(0, 15)}`;
    await fs.rename(MODULE_ROOT, backupPath);
    console.log(`Existing module moved to ${backupPath}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function readRootDocuments(pack) {
  const collection = COLLECTION_BY_TYPE[pack.type];
  const packPath = path.join(DND_SYSTEM, pack.path);
  const db = new ClassicLevel(packPath, { keyEncoding: "utf8", valueEncoding: "utf8", readOnly: true });
  const docs = [];
  const embedded = new Map();

  await db.open();
  for await (const [key, value] of db.iterator()) {
    if (isRootDocumentKey(key, collection)) {
      docs.push(JSON.parse(value));
      continue;
    }

    const embeddedMatch = embeddedDocumentMatch(key, collection);
    if (!embeddedMatch) continue;

    const list = embedded.get(embeddedMatch.parentId) ?? {};
    list[embeddedMatch.field] ??= [];
    list[embeddedMatch.field].push(JSON.parse(value));
    embedded.set(embeddedMatch.parentId, list);
  }
  await db.close();

  for (const doc of docs) {
    const children = embedded.get(doc._id);
    if (!children) continue;
    if (children.items) doc.items = children.items.sort(sortByName);
    if (children.effects) doc.effects = children.effects.sort(sortByName);
    if (children.pages) doc.pages = children.pages.sort(sortBySortThenName);
    if (children.results) doc.results = children.results.sort(sortByRangeThenName);
  }

  return docs;
}

function isRootDocumentKey(key, collection) {
  return new RegExp(`^!${collection}![A-Za-z0-9_-]+$`).test(key);
}

function embeddedDocumentMatch(key, collection) {
  const patterns = [
    { regex: new RegExp(`^!${collection}\\.items!([A-Za-z0-9_-]+)\\.([A-Za-z0-9_-]+)$`), field: "items" },
    { regex: new RegExp(`^!${collection}\\.effects!([A-Za-z0-9_-]+)\\.([A-Za-z0-9_-]+)$`), field: "effects" },
    { regex: new RegExp(`^!${collection}\\.pages!([A-Za-z0-9_-]+)\\.([A-Za-z0-9_-]+)$`), field: "pages" },
    { regex: new RegExp(`^!${collection}\\.results!([A-Za-z0-9_-]+)\\.([A-Za-z0-9_-]+)$`), field: "results" }
  ];

  for (const pattern of patterns) {
    const match = key.match(pattern.regex);
    if (match) return { parentId: match[1], childId: match[2], field: pattern.field };
  }

  return null;
}

async function writePack(definition, docs, folders = []) {
  const packPath = path.join(PACKS_ROOT, definition.name);
  await fs.mkdir(packPath, { recursive: true });

  const db = new ClassicLevel(packPath, { keyEncoding: "utf8", valueEncoding: "utf8" });
  await db.open();

  for (const folder of folders) {
    await db.put(`!folders!${folder._id}`, JSON.stringify(folder));
  }

  const collection = COLLECTION_BY_TYPE[definition.type];
  for (const doc of docs) {
    await db.put(`!${collection}!${doc._id}`, JSON.stringify(doc));
  }

  await db.close();

  return {
    label: definition.label,
    type: definition.type,
    count: docs.length,
    folders: folders.length,
    samples: docs.slice(0, 5).map((doc) => `${doc.name} [${doc.type ?? definition.type}]`)
  };
}

function convertActor(doc, pack) {
  const system = doc.system ?? {};
  const details = system.details ?? {};
  const hp = system.attributes?.hp ?? {};
  const ac = system.attributes?.ac ?? {};
  const convertedType = doc.type === "character" ? "character" : "npc";
  const embeddedItems = Array.isArray(doc.items) ? doc.items : [];
  const art = actorArt(doc, pack);

  const converted = baseDocument(doc, convertedType, pack, art.actor);
  converted.prototypeToken = actorPrototypeToken(doc, art);
  converted.system = {
    archetype: actorArchetype(doc, details),
    origin: actorOrigin(doc, details, pack),
    description: actorDescription(doc, embeddedItems),
    history: details.biography?.value ?? details.biography?.public ?? "",
    level: actorLevel(doc, details),
    portrait: { x: 50, y: 35, scale: 1 },
    resources: {
      pv: {
        value: numberOrDefault(hp.value, hp.max, 10),
        max: numberOrDefault(hp.max, hp.value, 10)
      },
      armure: {
        value: numberOrDefault(ac.flat, ac.value, 0)
      }
    },
    aptitudeValues: mapObjectValues(system.abilities, (ability) => numberOrDefault(ability.value, 10)),
    commonSkillValues: mapObjectValues(system.skills, (skill) => numberOrDefault(skill.value, skill.mod, 0)),
    specialSkills: embeddedItems.map((item) => convertEmbeddedItemToSkill(item)).filter(Boolean),
    currencies: system.currency ?? {},
    customStates: {
      dnd5eType: doc.type,
      dnd5eActorFamily: actorFolderName(doc),
      dnd5eSourcePack: pack.name,
      dnd5eSourceLabel: pack.label
    },
    rollModifiers: {}
  };

  return converted;
}

function convertItem(doc, pack) {
  const system = doc.system ?? {};
  const converted = baseDocument(doc, "equipment", pack);
  converted.system = {
    category: ITEM_CATEGORY_BY_DND_TYPE[doc.type] ?? `DnD ${doc.type ?? "Item"}`,
    description: itemDescription(doc),
    quantity: numberOrDefault(system.quantity, 1),
    price: formatPrice(system.price),
    prices: priceObject(system.price),
    equipable: ["equipment", "tool", "weapon"].includes(doc.type),
    equipped: Boolean(system.equipped),
    armorValue: numberOrDefault(system.armor?.value, system.armor?.magicalBonus, 0),
    notes: itemNotes(doc, pack)
  };

  return converted;
}

function convertJournal(doc, pack) {
  const converted = baseDocument(doc, doc.type, pack);
  converted.pages = Array.isArray(doc.pages) ? doc.pages.filter(isObject).map((page) => cleanStats(page, pack)) : [];
  converted.ownership = { default: 0 };
  converted.folder = null;
  return converted;
}

function convertRollTable(doc, pack) {
  const converted = baseDocument(doc, doc.type, pack);
  converted.description = doc.description ?? sourceParagraph(pack, doc.type);
  converted.results = Array.isArray(doc.results) ? doc.results.filter(isObject).map((result) => cleanStats(result, pack)) : [];
  converted.formula = doc.formula ?? "1d20";
  converted.replacement = doc.replacement ?? true;
  converted.displayRoll = doc.displayRoll ?? true;
  converted.ownership = { default: 0 };
  converted.folder = null;
  return converted;
}

function baseDocument(doc, type, pack, imageOverride = null) {
  return {
    name: doc.name ?? "Sans nom",
    type,
    _id: stableId(`${pack.name}:${doc._id ?? doc.name}`),
    img: imageOverride ?? doc.img ?? null,
    folder: null,
    sort: doc.sort ?? 0,
    ownership: { default: 0 },
    flags: {
      holysheetDndCompendiums: {
        sourceSystem: "dnd5e",
        sourcePack: pack.name,
        sourceLabel: pack.label,
        sourceId: doc._id ?? null,
        sourceType: doc.type ?? null
      }
    },
    _stats: {
      coreVersion: "14.364",
      systemId: "holysheet",
      systemVersion: "0.1.0",
      createdTime: now,
      modifiedTime: now,
      lastModifiedBy: null,
      compendiumSource: null,
      duplicateSource: null,
      exportSource: null
    }
  };
}

function actorArt(doc, pack) {
  const art = compendiumArtMapping[`dnd5e.${pack.name}`]?.[doc._id] ?? {};
  const fallback = defaultActorImage(doc);
  return {
    actor: art.actor ?? doc.img ?? doc.prototypeToken?.texture?.src ?? fallback,
    token: tokenImageFromMapping(art.token) ?? doc.prototypeToken?.texture?.src ?? art.actor ?? doc.img ?? fallback,
    tokenData: typeof art.token === "object" && art.token ? art.token : {}
  };
}

function defaultActorImage(doc) {
  if (doc.type === "character") return "systems/dnd5e/icons/svg/actors/character.svg";
  if (doc.type === "vehicle") return "systems/dnd5e/icons/svg/actors/vehicle.svg";
  return "systems/dnd5e/icons/svg/actors/npc.svg";
}

function tokenImageFromMapping(token) {
  if (!token) return null;
  if (typeof token === "string") return token;
  return token.texture?.src ?? null;
}

function actorPrototypeToken(doc, art) {
  const token = structuredClone(doc.prototypeToken ?? {});
  const mappedToken = typeof art.tokenData === "object" && art.tokenData ? structuredClone(art.tokenData) : {};

  mergeTokenData(token, mappedToken);
  token.name ??= doc.name ?? "";
  token.actorLink ??= doc.type === "character";
  token.disposition ??= doc.type === "character" ? 1 : -1;
  token.texture ??= {};
  token.texture.src = art.token ?? token.texture.src ?? art.actor ?? null;

  return token;
}

function mergeTokenData(target, source) {
  for (const [key, value] of Object.entries(source ?? {})) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      target[key] ??= {};
      mergeTokenData(target[key], value);
    } else {
      target[key] = value;
    }
  }
}

function assignActorFolders(docs) {
  const names = [...new Set(docs.map((doc) => doc.system?.customStates?.dnd5eActorFamily ?? "Autres creatures"))].sort((a, b) =>
    a.localeCompare(b, "fr", { sensitivity: "base" })
  );
  const folders = names.map((name, index) => buildFolder(name, "Actor", index));
  const folderByName = new Map(folders.map((folder) => [folder.name, folder._id]));

  for (const doc of docs) {
    const family = doc.system?.customStates?.dnd5eActorFamily ?? "Autres creatures";
    doc.folder = folderByName.get(family) ?? null;
  }

  return folders;
}

function buildFolder(name, type, index) {
  return {
    _id: stableId(`folder:${type}:${name}`),
    name,
    type,
    sorting: "a",
    sort: (index + 1) * 100000,
    color: folderColor(name),
    folder: null,
    description: "",
    flags: {
      holysheetDndCompendiums: {
        generated: true
      }
    },
    _stats: {
      coreVersion: "14.364",
      systemId: "holysheet",
      systemVersion: "0.1.0",
      createdTime: now,
      modifiedTime: now,
      lastModifiedBy: null,
      compendiumSource: null,
      duplicateSource: null,
      exportSource: null
    }
  };
}

function actorFolderName(doc) {
  if (doc.type === "character") return "Personnages";
  if (doc.type === "vehicle") return "Vehicules";

  const type = String(doc.system?.details?.type?.value ?? doc.system?.details?.type ?? "").toLowerCase();
  const subtype = String(doc.system?.details?.type?.subtype ?? "").toLowerCase();
  const environment = String(doc.system?.details?.environment ?? "").toLowerCase();
  const name = String(doc.name ?? "").toLowerCase();
  const marine = [environment, subtype, name].some((value) => /aquatic|coast|underwater|water|sea|ocean|marine|fish|shark|whale|octopus|merrow|sahuagin/.test(value));

  if (marine) return "Creatures marines";

  return {
    aberration: "Aberrations",
    beast: "Animaux",
    celestial: "Celestes",
    construct: "Constructs",
    dragon: "Dragons",
    elemental: "Elementaires",
    fey: "Fees",
    fiend: "Fielons",
    giant: "Geants",
    humanoid: "Humanoides",
    monstrosity: "Monstruosites",
    ooze: "Vases",
    plant: "Plantes",
    undead: "Morts-vivants"
  }[type] ?? "Autres creatures";
}

function folderColor(name) {
  return {
    Aberrations: "#6f3a8f",
    Animaux: "#4f7f3b",
    Autres: "#777777",
    Celestes: "#d5a933",
    Constructs: "#777d85",
    "Creatures marines": "#2f7f9f",
    Dragons: "#9f3434",
    Elementaires: "#b86b2f",
    Fees: "#b04c8f",
    Fielons: "#7f1d1d",
    Geants: "#8a6f3d",
    Humanoides: "#4a6f9f",
    "Morts-vivants": "#5f6670",
    Monstruosites: "#7a4f2f",
    Personnages: "#2f8f6f",
    Plantes: "#3f8a4f",
    Vases: "#8a8f3a",
    Vehicules: "#5b6472"
  }[name] ?? "#777777";
}

function actorArchetype(doc, details) {
  if (doc.type === "character") return [details.race, details.class].filter(Boolean).join(" / ");
  if (typeof details.type?.value === "string") return details.type.value;
  if (typeof details.type === "string") return details.type;
  return doc.type ?? "";
}

function actorOrigin(doc, details, pack) {
  return details.background || details.source?.book || details.source?.custom || pack.label || doc.type || "";
}

function actorLevel(doc, details) {
  if (Number.isFinite(details.level)) return details.level;
  if (Number.isFinite(details.cr)) return Math.max(0, Math.round(details.cr));
  if (Number.isFinite(details.cr?.value)) return Math.max(0, Math.round(details.cr.value));
  return 1;
}

function actorDescription(doc, embeddedItems) {
  const system = doc.system ?? {};
  const details = system.details ?? {};
  const parts = [];
  parts.push(details.biography?.public || details.biography?.value || system.description?.full || system.description?.summary || "");
  parts.push(actorStatBlock(doc));

  if (embeddedItems.length) {
    const entries = embeddedItems
      .map((item) => `<li><strong>${escapeHtml(item.name ?? "Sans nom")}</strong> (${escapeHtml(item.type ?? "item")}): ${itemSummary(item)}</li>`)
      .join("");
    parts.push(`<h2>Capacites et equipement DnD</h2><ul>${entries}</ul>`);
  }

  return parts.filter(Boolean).join("\n");
}

function actorStatBlock(doc) {
  const system = doc.system ?? {};
  const details = system.details ?? {};
  const attributes = system.attributes ?? {};
  const rows = [
    ["Type DnD", doc.type],
    ["CR / Niveau", details.cr?.value ?? details.cr ?? details.level],
    ["CA", attributes.ac?.flat ?? attributes.ac?.value],
    ["PV", attributes.hp?.max ?? attributes.hp?.value],
    ["Mouvement", movementSummary(attributes.movement)]
  ].filter(([, value]) => value !== undefined && value !== null && value !== "");

  const abilities = Object.entries(system.abilities ?? {})
    .map(([key, ability]) => `${ABILITY_LABELS[key] ?? key}: ${ability.value ?? "-"}`)
    .join(", ");
  const skills = Object.entries(system.skills ?? {})
    .filter(([, skill]) => Number(skill.value ?? skill.mod ?? 0) !== 0)
    .map(([key, skill]) => `${SKILL_LABELS[key] ?? key}: ${skill.value ?? skill.mod}`)
    .join(", ");

  if (abilities) rows.push(["Caracteristiques", abilities]);
  if (skills) rows.push(["Competences", skills]);

  const tableRows = rows.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(String(value))}</td></tr>`).join("");
  return tableRows ? `<h2>Donnees DnD converties</h2><table>${tableRows}</table>` : "";
}

function movementSummary(movement) {
  if (!movement) return "";
  return Object.entries(movement)
    .filter(([, value]) => typeof value === "number" && value > 0)
    .map(([key, value]) => `${key} ${value}`)
    .join(", ");
}

function convertEmbeddedItemToSkill(item) {
  if (!["feat", "spell", "weapon"].includes(item.type)) return null;
  return {
    id: stableId(`skill:${item._id ?? item.name}`),
    name: item.name ?? "Capacite DnD",
    description: itemDescription(item),
    value: 30
  };
}

function itemDescription(doc) {
  const system = doc.system ?? {};
  const parts = [];
  const description = system.description?.value || system.description?.chat || "";
  if (description) parts.push(description);

  const rows = itemDataRows(doc);
  if (rows.length) {
    parts.push(`<h2>Donnees DnD converties</h2><table>${rows.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(String(value))}</td></tr>`).join("")}</table>`);
  }

  return parts.filter(Boolean).join("\n");
}

function itemDataRows(doc) {
  const system = doc.system ?? {};
  const rows = [
    ["Type DnD", doc.type],
    ["Niveau", system.level],
    ["Ecole", system.school],
    ["Activation", system.activation?.type],
    ["Portee", formatUnitValue(system.range)],
    ["Duree", formatUnitValue(system.duration)],
    ["Cible", formatTarget(system.target)],
    ["Degats", formatActivities(system.activities)],
    ["Rareté", system.rarity],
    ["Poids", formatUnitValue(system.weight)],
    ["Proprietes", Array.isArray(system.properties) ? system.properties.join(", ") : ""]
  ].filter(([, value]) => value !== undefined && value !== null && value !== "");
  return rows;
}

function itemSummary(item) {
  const text = stripHtml(itemDescription(item));
  return escapeHtml(text.slice(0, 360) || "Aucune description.");
}

function itemNotes(doc, pack) {
  const rows = [
    ["Pack source", pack.label],
    ["ID source", doc._id],
    ["Type source", doc.type],
    ["Identifiant DnD", doc.system?.identifier],
    ["Source", doc.system?.source?.book || doc.system?.source?.custom]
  ].filter(([, value]) => value !== undefined && value !== null && value !== "");

  return `<h2>Source</h2><table>${rows.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(String(value))}</td></tr>`).join("")}</table>`;
}

function sourceParagraph(pack, type) {
  return `<p><strong>Source DnD5e:</strong> ${escapeHtml(pack.label)} (${escapeHtml(type ?? pack.type)}).</p>`;
}

function formatPrice(price) {
  if (!price || price.value === undefined || price.value === null) return "";
  return `${price.value} ${price.denomination ?? ""}`.trim();
}

function priceObject(price) {
  if (!price || price.value === undefined || price.value === null) return {};
  return { [price.denomination || "value"]: price.value };
}

function formatUnitValue(value) {
  if (!value) return "";
  if (value.value !== undefined && value.units !== undefined) return `${value.value} ${value.units}`.trim();
  if (value.units !== undefined) return value.units;
  return "";
}

function formatTarget(target) {
  if (!target) return "";
  const parts = [];
  if (target.value) parts.push(target.value);
  if (target.type) parts.push(target.type);
  if (target.units) parts.push(target.units);
  return parts.join(" ");
}

function formatActivities(activities) {
  if (!activities || typeof activities !== "object") return "";
  const lines = [];
  for (const activity of Object.values(activities)) {
    const damageParts = Object.values(activity.damage?.parts ?? {}).map((part) => [part.formula, part.types?.join("/")].filter(Boolean).join(" "));
    if (damageParts.length) lines.push(`${activity.name ?? "Activite"}: ${damageParts.join(", ")}`);
  }
  return lines.join("; ");
}

function cleanStats(doc, pack) {
  const copy = structuredClone(doc);
  copy._stats = {
    coreVersion: "14.364",
    systemId: "holysheet",
    systemVersion: "0.1.0",
    createdTime: now,
    modifiedTime: now,
    lastModifiedBy: null,
    compendiumSource: null,
    duplicateSource: null,
    exportSource: null
  };
  copy.flags = {
    ...(copy.flags ?? {}),
    holysheetDndCompendiums: {
      sourceSystem: "dnd5e",
      sourcePack: pack.name,
      sourceLabel: pack.label,
      sourceId: doc._id ?? null,
      sourceType: doc.type ?? null
    }
  };
  return copy;
}

function mapObjectValues(object, mapper) {
  return Object.fromEntries(Object.entries(object ?? {}).map(([key, value]) => [key, mapper(value)]));
}

function numberOrDefault(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function stableId(input) {
  let hash1 = 0x811c9dc5;
  let hash2 = 0x01000193;
  for (const char of input) {
    const code = char.charCodeAt(0);
    hash1 ^= code;
    hash1 = Math.imul(hash1, 0x01000193) >>> 0;
    hash2 ^= code;
    hash2 = Math.imul(hash2, 0x85ebca6b) >>> 0;
  }
  return `${hash1.toString(36).padStart(8, "0")}${hash2.toString(36).padStart(8, "0")}`.slice(0, 16);
}

function sortByName(a, b) {
  return a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
}

function sortBySortThenName(a, b) {
  return (a.sort ?? 0) - (b.sort ?? 0) || sortByName(a, b);
}

function sortByRangeThenName(a, b) {
  return (a.range?.[0] ?? 0) - (b.range?.[0] ?? 0) || sortByName(a, b);
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function stripHtml(html) {
  return String(html ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildModuleManifest() {
  return {
    id: MODULE_ID,
    type: "module",
    title: "HolySheet - Compendiums DnD convertis",
    description: "Compendiums DnD5e convertis en documents compatibles HolySheet pour consultation et import manuel.",
    version: "0.1.0",
    compatibility: {
      minimum: "14",
      verified: "14.364"
    },
    authors: [
      {
        name: "HalTorns"
      }
    ],
    relationships: {
      systems: [
        {
          id: "holysheet",
          type: "system",
          compatibility: {
            minimum: "0.1.0"
          }
        }
      ],
      requires: [
        {
          id: "dnd5e",
          type: "system",
          reason: "Les images et certains liens de description pointent vers les ressources du systeme DnD5e installe localement."
        }
      ]
    },
    packs: PACK_DEFINITIONS.map((definition) => ({
      name: definition.name,
      label: definition.label,
      path: `packs/${definition.name}`,
      type: definition.type,
      system: "holysheet",
      ownership: {
        PLAYER: "OBSERVER",
        ASSISTANT: "OWNER"
      },
      flags: {
        holysheetDndCompendiums: {
          sourceSystem: "dnd5e"
        }
      }
    }))
  };
}

function buildReadme(systemManifest) {
  return `# HolySheet - Compendiums DnD convertis

Module local genere depuis ${systemManifest.title} ${systemManifest.version}.

Ce module expose des compendiums convertis pour les mondes HolySheet sans importer les documents directement dans le monde.

Les documents DnD5e sont copies et adaptes:

- Actors DnD5e vers Actors HolySheet character/npc.
- Items DnD5e vers Items HolySheet equipment.
- Journaux et tables conserves en documents Foundry standards.

Les automatismes DnD5e ne sont pas conserves comme mecanique active. Ils sont gardes comme texte dans les descriptions et notes.
`;
}

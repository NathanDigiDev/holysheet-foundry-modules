export const MODULE_ID = "holysheet-immersive-books";
export const LEGACY_MODULE_ID = "immersive-books";
export const DATA_VERSION = 2;

export function getModuleFlag(document, key) {
  return document?.getFlag?.(MODULE_ID, key) ?? document?.getFlag?.(LEGACY_MODULE_ID, key);
}

export async function setModuleFlag(document, key, value) {
  await document?.setFlag?.(MODULE_ID, key, value);
  if (document?.getFlag?.(LEGACY_MODULE_ID, key) !== undefined) await document?.unsetFlag?.(LEGACY_MODULE_ID, key);
}

export async function unsetModuleFlag(document, key) {
  await document?.unsetFlag?.(MODULE_ID, key);
  await document?.unsetFlag?.(LEGACY_MODULE_ID, key);
}

export const FORMATS = Object.freeze({
  portrait: { id: "portrait", label: "Portrait", width: 700, height: 980 },
  square: { id: "square", label: "Carré", width: 820, height: 820 },
  landscape: { id: "landscape", label: "Paysage", width: 980, height: 700 }
});

export const DEFAULT_THEME = Object.freeze({
  paper: "#eee1c2",
  paperAlt: "#e5d2a8",
  ink: "#2d241c",
  accent: "#8b3f2a",
  leather: "#3b2119",
  fontBody: "Georgia, serif",
  fontDisplay: "Garamond, Georgia, serif",
  margin: 44
});

export const DECORATIONS = Object.freeze([
  { id: "divider-flourish", label: "Arabesque", icon: "fa-wand-sparkles" },
  { id: "divider-diamond", label: "Diamants", icon: "fa-diamond" },
  { id: "corner-vine", label: "Coins végétaux", icon: "fa-seedling" },
  { id: "frame-classic", label: "Cadre classique", icon: "fa-border-all" },
  { id: "ink-stain", label: "Tache d’encre", icon: "fa-droplet" },
  { id: "wax-seal", label: "Sceau", icon: "fa-certificate" }
]);

export function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function uid(prefix = "ib") {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

export function createBlock(type = "text", overrides = {}) {
  const common = {
    id: uid("block"),
    type,
    x: 8,
    y: 8,
    width: 84,
    height: 22,
    rotation: 0,
    opacity: 1,
    locked: false,
    z: 1
  };
  const defaults = {
    text: {
      html: "<h2>Un nouveau titre</h2><p>Commencez à écrire…</p>",
      color: "",
      fontSize: 20,
      lineHeight: 1.45,
      align: "left",
      dropCap: false
    },
    image: {
      src: "icons/svg/book.svg",
      fit: "cover",
      focalX: 50,
      focalY: 50,
      borderWidth: 0,
      borderColor: "#5e3b27",
      radius: 0
    },
    callout: {
      title: "Encadré",
      html: "<p>Ajoutez un passage important.</p>",
      background: "#dfc995",
      borderColor: "#8b6740",
      color: "",
      fontSize: 18
    },
    decoration: {
      variant: "divider-flourish",
      color: "#8b3f2a"
    },
    shape: {
      shape: "rectangle",
      fill: "#8b3f2a",
      stroke: "#5a281c",
      strokeWidth: 1,
      radius: 0
    },
    pageNumber: {
      format: "inherit",
      color: "",
      fontSize: 16,
      align: "center"
    }
  };
  return { ...common, ...(defaults[type] ?? defaults.text), ...clone(overrides) };
}

export function createPage(kind = "composed", overrides = {}) {
  const isImage = kind === "image";
  return {
    id: uid("page"),
    documentId: null,
    name: isImage ? "Page image" : "Page composée",
    kind,
    role: "normal",
    chapter: "",
    visibility: "visible",
    numberingHidden: false,
    image: {
      src: isImage ? "icons/svg/book.svg" : "",
      fit: "cover",
      focalX: 50,
      focalY: 50
    },
    blocks: isImage ? [] : [createBlock("text")],
    pageTheme: null,
    lockedOverride: null,
    ...clone(overrides)
  };
}

export function createBookData(name = "Nouveau livre") {
  const cover = createPage("image", { name: "Couverture", role: "cover" });
  const firstPage = createPage("composed", {
    name: "Première page",
    blocks: [createBlock("text", {
      x: 12,
      y: 14,
      width: 76,
      height: 48,
      html: `<h1>${escapeHtml(name)}</h1><p>Il était une fois…</p>`,
      align: "center",
      fontSize: 22,
      dropCap: true
    })]
  });
  const settings = {
    format: "portrait",
    theme: clone(DEFAULT_THEME),
    numbering: { start: 1, style: "arabic" },
    lockedPage: {
      title: "Pages scellées",
      message: "Ces pages ne peuvent pas encore être consultées.",
      image: "",
      decoration: "wax-seal"
    },
    grid: { size: 4, visible: false, snap: true }
  };
  const pages = [cover, firstPage];
  return {
    version: DATA_VERSION,
    isBook: true,
    settings,
    draft: { pages: clone(pages), trash: [], revision: 1, updatedAt: Date.now(), updatedBy: null },
    published: { pages: clone(pages), revision: 1, publishedAt: Date.now(), publishedBy: null },
    history: [],
    lock: null
  };
}

export function ensureBookData(raw, name = "Livre") {
  if (!raw || raw.version !== DATA_VERSION || !raw.draft || !raw.published) return createBookData(name);
  const data = clone(raw);
  data.settings = mergeDeep(createBookData(name).settings, data.settings ?? {});
  data.draft.pages ??= [];
  data.draft.trash ??= [];
  data.published.pages ??= [];
  data.history = Array.isArray(data.history) ? data.history.slice(0, 5) : [];
  data.lock ??= null;
  return data;
}

export function pageTemplate(template, name) {
  const base = { name: name || templateLabel(template), blocks: [] };
  if (template === "chapter") {
    base.blocks = [
      createBlock("decoration", { x: 30, y: 19, width: 40, height: 7, variant: "divider-flourish" }),
      createBlock("text", { x: 12, y: 31, width: 76, height: 37, html: "<h1>Nouveau chapitre</h1><p>Une introduction mémorable…</p>", align: "center", fontSize: 22 })
    ];
  } else if (template === "illustration") {
    base.blocks = [
      createBlock("image", { x: 8, y: 8, width: 84, height: 68 }),
      createBlock("text", { x: 14, y: 79, width: 72, height: 13, html: "<p><em>Légende de l’illustration</em></p>", align: "center", fontSize: 16 })
    ];
  } else if (template === "columns") {
    base.blocks = [
      createBlock("text", { x: 8, y: 9, width: 39, height: 82, html: "<h2>Première colonne</h2><p>Votre texte…</p>", fontSize: 17 }),
      createBlock("text", { x: 53, y: 9, width: 39, height: 82, html: "<h2>Deuxième colonne</h2><p>Votre texte…</p>", fontSize: 17 })
    ];
  } else if (template === "letter") {
    base.blocks = [
      createBlock("text", { x: 12, y: 10, width: 76, height: 76, html: "<p><em>À mon très cher ami,</em></p><p>Je vous écris aujourd’hui…</p><p style=\"text-align:right\">Votre dévoué serviteur</p>", fontSize: 19, lineHeight: 1.7 }),
      createBlock("decoration", { x: 69, y: 77, width: 15, height: 12, variant: "wax-seal", rotation: -8 })
    ];
  } else if (template === "bestiary") {
    base.blocks = [
      createBlock("text", { x: 8, y: 7, width: 84, height: 15, html: "<h1>Créature</h1>", align: "center" }),
      createBlock("image", { x: 8, y: 24, width: 45, height: 45 }),
      createBlock("callout", { x: 57, y: 24, width: 35, height: 45, title: "Observations", html: "<p>Habitat, habitudes et signes distinctifs…</p>" }),
      createBlock("text", { x: 8, y: 73, width: 84, height: 18, html: "<p>Description détaillée de la créature…</p>", fontSize: 17 })
    ];
  } else {
    base.blocks = [createBlock("text")];
  }
  return createPage("composed", base);
}

export function createReaderViews(pages, { singlePage = false, isGM = false } = {}) {
  const visible = pages
    .filter(page => isGM || page.visibility !== "gm")
    .map(page => ({ ...clone(page), isLockedForViewer: !isGM && page.visibility === "locked" }));
  if (singlePage) return visible.map(page => ({ id: `view-${page.id}`, pages: [page], kind: page.role }));
  const views = [];
  let normal = [];
  const flushNormal = () => {
    for (let index = 0; index < normal.length; index += 2) {
      const pair = normal.slice(index, index + 2);
      if (pair.length === 1) pair.push({ id: uid("blank"), kind: "blank", role: "blank", name: "", blocks: [] });
      views.push({ id: `view-${pair.map(page => page.id).join("-")}`, pages: pair, kind: "spread" });
    }
    normal = [];
  };
  for (const page of visible) {
    if (page.role === "cover" || page.role === "back") {
      flushNormal();
      views.push({ id: `view-${page.id}`, pages: [page], kind: page.role });
    } else normal.push(page);
  }
  flushNormal();
  return views;
}

export function computePageNumbers(pages, numbering = {}) {
  const start = Math.max(0, Number(numbering.start ?? 1));
  const style = numbering.style === "roman" ? "roman" : "arabic";
  let current = start;
  return pages.reduce((result, page) => {
    if (page.role === "normal") {
      result[page.id] = page.numberingHidden ? "" : style === "roman" ? toRoman(current) : String(current);
      current += 1;
    } else result[page.id] = "";
    return result;
  }, {});
}

export function publishDraft(book, userId = null) {
  const next = clone(book);
  const previous = clone(next.published);
  if (previous?.pages?.length) {
    next.history.unshift(previous);
    next.history = next.history.slice(0, 5);
  }
  next.published = {
    pages: clone(next.draft.pages),
    revision: Number(next.published?.revision ?? 0) + 1,
    publishedAt: Date.now(),
    publishedBy: userId
  };
  next.draft.revision = next.published.revision;
  return next;
}

export function restorePublishedVersion(book, revision) {
  const next = clone(book);
  const snapshot = next.history.find(item => Number(item.revision) === Number(revision));
  if (!snapshot) return next;
  next.draft.pages = clone(snapshot.pages);
  next.draft.revision = Number(next.draft.revision ?? 0) + 1;
  next.draft.updatedAt = Date.now();
  return next;
}

export function toRoman(value) {
  let number = Math.max(0, Math.floor(Number(value) || 0));
  if (!number) return "";
  const tokens = [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];
  let output = "";
  for (const [amount, token] of tokens) {
    while (number >= amount) { output += token; number -= amount; }
  }
  return output.toLowerCase();
}

export function mergeDeep(base, override) {
  const result = clone(base) ?? {};
  for (const [key, value] of Object.entries(override ?? {})) {
    if (value && typeof value === "object" && !Array.isArray(value)) result[key] = mergeDeep(result[key] ?? {}, value);
    else result[key] = clone(value);
  }
  return result;
}

function templateLabel(template) {
  return ({ chapter: "Ouverture de chapitre", illustration: "Illustration légendée", columns: "Deux colonnes", letter: "Lettre", bestiary: "Bestiaire" })[template] ?? "Page composée";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}

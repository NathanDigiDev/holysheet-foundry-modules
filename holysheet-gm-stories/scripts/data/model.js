import {
  DEFAULT_NOTE_COLOR,
  DEFAULT_NOTE_ICON,
  MODULE_ID,
  NOTE_TYPES
} from "../config.js";

export function makeNote(data = {}) {
  const now = Date.now();
  const id = data.id ?? foundry.utils.randomID(16);
  const title = String(data.title ?? game.i18n.localize("HSGM.NewNote")).trim() || game.i18n.localize("HSGM.NewNote");
  const type = normalizeNoteType(data.type);

  return normalizeNote({
    id,
    title,
    type,
    folder: data.folder ?? "",
    tags: [],
    favorite: false,
    pinned: false,
    linkedUuid: data.linkedUuid ?? "",
    linkedName: data.linkedName ?? "",
    filePath: data.filePath ?? "",
    icon: data.icon ?? DEFAULT_NOTE_ICON,
    color: data.color ?? DEFAULT_NOTE_COLOR,
    contentCache: data.contentCache ?? "",
    createdAt: data.createdAt ?? now,
    updatedAt: data.updatedAt ?? now
  });
}

export function normalizeNote(note = {}) {
  const type = normalizeNoteType(note.type);
  const title = String(note.title ?? game.i18n.localize("HSGM.NewNote")).trim() || game.i18n.localize("HSGM.NewNote");

  return {
    id: String(note.id ?? foundry.utils.randomID(16)),
    title,
    type,
    folder: String(note.folder ?? "").trim(),
    tags: [],
    favorite: false,
    pinned: false,
    linkedUuid: String(note.linkedUuid ?? ""),
    linkedName: String(note.linkedName ?? ""),
    filePath: String(note.filePath ?? ""),
    icon: String(note.icon ?? DEFAULT_NOTE_ICON),
    color: String(note.color ?? DEFAULT_NOTE_COLOR),
    contentCache: String(note.contentCache ?? ""),
    createdAt: Number(note.createdAt ?? Date.now()),
    updatedAt: Number(note.updatedAt ?? Date.now())
  };
}

function normalizeNoteType(type) {
  return Object.values(NOTE_TYPES).includes(type) ? type : NOTE_TYPES.GENERAL;
}

export function slugify(value) {
  const cleaned = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "note";
}

export function noteFileName(note) {
  return `${slugify(note.title)}-${note.id}.md`;
}

export function serializeMarkdown(note, content) {
  const meta = {
    id: note.id,
    type: note.type,
    title: note.title,
    folder: note.folder,
    linkedUuid: note.linkedUuid,
    linkedName: note.linkedName,
    updatedAt: note.updatedAt,
    module: MODULE_ID
  };

  const frontmatter = Object.entries(meta)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join("\n");
  return `---\n${frontmatter}\n---\n\n${String(content ?? "")}`;
}

export function stripFrontmatter(markdown) {
  const text = String(markdown ?? "");
  if (!text.startsWith("---\n")) return text;
  const end = text.indexOf("\n---", 4);
  if (end < 0) return text;
  return text.slice(end + 4).replace(/^\s*\n/, "");
}

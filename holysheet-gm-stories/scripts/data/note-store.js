import {
  FLAGS,
  MODULE_ID,
  NOTE_TYPE_META,
  NOTE_TYPES,
  SETTINGS,
  localize,
  warn
} from "../config.js";
import { FileStorage } from "./file-storage.js";
import {
  makeNote,
  normalizeNote,
  slugify
} from "./model.js";

const LINKING = new Set();

export class NoteStore {
  static all() {
    const raw = game.settings.get(MODULE_ID, SETTINGS.INDEX) ?? {};
    return Object.values(raw).map(normalizeNote).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  static get(id) {
    const raw = game.settings.get(MODULE_ID, SETTINGS.INDEX) ?? {};
    return raw[id] ? normalizeNote(raw[id]) : null;
  }

  static async content(id) {
    const note = this.get(id);
    if (!note) return "";
    return FileStorage.read(note);
  }

  static async create(data = {}, options = {}) {
    let note = makeNote(data);
    if (!options.skipDocumentLink) note = await this.#ensureLinkedDocument(note, options);
    const content = data.content ?? "";
    note.contentCache = content;
    note.updatedAt = Date.now();

    const write = await FileStorage.write(note, content);
    if (write.ok) note.filePath = write.filePath;
    else ui.notifications?.warn(localize("HSGM.StorageUnavailable"));

    await this.#upsert(note);
    await this.#flagLinkedDocument(note);
    return note;
  }

  static async update(id, changes = {}) {
    const note = this.get(id);
    if (!note) return null;
    const updated = normalizeNote(foundry.utils.mergeObject(note, changes, { inplace: false }));
    updated.updatedAt = Date.now();
    await this.#upsert(updated);
    return updated;
  }

  static async saveContent(id, content) {
    const note = this.get(id);
    if (!note) return null;
    note.contentCache = String(content ?? "");
    note.updatedAt = Date.now();
    const write = await FileStorage.write(note, note.contentCache);
    if (write.ok) note.filePath = write.filePath;
    else ui.notifications?.warn(localize("HSGM.StorageUnavailable"));
    await this.#upsert(note);
    return note;
  }

  static async delete(id) {
    const raw = this.#raw();
    if (!raw[id]) return false;
    delete raw[id];
    await this.#persist(raw);
    return true;
  }

  static async clearLink(id) {
    const note = this.get(id);
    if (!note) return null;
    await this.#clearLinkedDocumentFlag(note);
    return this.update(id, {
      linkedUuid: "",
      linkedName: ""
    });
  }

  static async linkDocument(id, document) {
    const note = this.get(id);
    if (!note || !document) return null;
    await this.#clearLinkedDocumentFlag(note);
    const updated = await this.update(id, {
      linkedUuid: document.uuid,
      linkedName: document.name
    });
    if (updated) await this.#flagLinkedDocument(updated);
    return updated;
  }

  static async createLinkedDocument(id, options = {}) {
    const note = this.get(id);
    if (!note) return null;
    const document = await this.#createDocumentForNote(note, options);
    if (!document) return null;
    return this.linkDocument(id, document);
  }

  static async exportArchive() {
    const notes = [];
    for (const note of this.all()) {
      notes.push({
        note,
        content: await this.content(note.id)
      });
    }

    return {
      format: `${MODULE_ID}.export`,
      version: 1,
      exportedAt: new Date().toISOString(),
      world: {
        id: game.world?.id ?? "",
        title: game.world?.title ?? ""
      },
      folders: this.folders(),
      notes
    };
  }

  static async importArchive(archive) {
    if (archive?.format !== `${MODULE_ID}.export` || archive.version !== 1) {
      throw new Error("Invalid GM Stories export");
    }

    const importedFolders = normalizeFolders(archive.folders ?? []);
    const existingFolders = this.folders();
    const allFolders = [...existingFolders];
    const folderIdMap = new Map();

    for (const folder of importedFolders) {
      const id = existingFolders.some((entry) => entry.id === folder.id)
        ? uniqueFolderId(folder.name, allFolders)
        : folder.id;
      folderIdMap.set(folder.id, id);
      allFolders.push({
        ...folder,
        id,
        parent: "",
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }

    for (const folder of allFolders.slice(existingFolders.length)) {
      const imported = importedFolders.find((entry) => folderIdMap.get(entry.id) === folder.id);
      folder.parent = folderIdMap.get(imported?.parent) ?? (existingFolders.some((entry) => entry.id === imported?.parent) ? imported.parent : "");
    }

    const raw = this.#raw();
    const usedTitles = new Map(Object.values(raw).map((note) => [note.title, 1]));
    let importedNotes = 0;

    for (const entry of archive.notes ?? []) {
      const source = normalizeNote(entry.note ?? {});
      const id = raw[source.id] ? foundry.utils.randomID(16) : source.id;
      const title = uniqueNoteTitle(source.title, usedTitles);
      const folder = folderIdMap.get(source.folder) ?? (this.folder(source.folder) ? source.folder : "");
      const note = normalizeNote({
        ...source,
        id,
        title,
        folder,
        filePath: "",
        contentCache: String(entry.content ?? source.contentCache ?? ""),
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      const write = await FileStorage.write(note, note.contentCache);
      if (write.ok) note.filePath = write.filePath;
      raw[note.id] = note;
      importedNotes++;
    }

    await this.#persist(raw);
    await this.#persistFolders(allFolders);
    return {
      notes: importedNotes,
      folders: importedFolders.length
    };
  }

  static folders() {
    return normalizeFolders(game.settings.get(MODULE_ID, SETTINGS.FOLDERS) ?? []);
  }

  static folder(id) {
    return this.folders().find((folder) => folder.id === id) ?? null;
  }

  static folderName(id) {
    return this.folder(id)?.name ?? "";
  }

  static folderOptions() {
    const folders = this.folders();
    const byParent = new Map();
    for (const folder of folders) {
      const parent = folder.parent && folders.some((entry) => entry.id === folder.parent) ? folder.parent : "";
      if (!byParent.has(parent)) byParent.set(parent, []);
      byParent.get(parent).push(folder);
    }
    for (const list of byParent.values()) list.sort((a, b) => a.name.localeCompare(b.name));

    const options = [];
    const visit = (parent, depth = 0) => {
      for (const folder of byParent.get(parent) ?? []) {
        options.push({
          key: folder.id,
          label: `${"  ".repeat(depth)}${folder.name}`
        });
        visit(folder.id, depth + 1);
      }
    };
    visit("");
    return options;
  }

  static async createFolder(name, parent = "") {
    const folderName = String(name ?? "").trim();
    if (!folderName) return null;
    const folders = this.folders();
    const parentId = folders.some((folder) => folder.id === parent) ? parent : "";
    const folder = {
      id: uniqueFolderId(folderName, folders),
      name: folderName,
      parent: parentId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await this.#persistFolders([...folders, folder]);
    return folder;
  }

  static async moveFolder(id, parent = "") {
    const folders = this.folders();
    const folder = folders.find((entry) => entry.id === id);
    if (!folder) return null;
    const parentId = folders.some((entry) => entry.id === parent) ? parent : "";
    if (folder.id === parentId || descendantsOf(folder.id, folders).has(parentId)) return null;
    folder.parent = parentId;
    folder.updatedAt = Date.now();
    await this.#persistFolders(folders);
    return folder;
  }

  static async deleteFolder(id) {
    const folders = this.folders();
    const folder = folders.find((entry) => entry.id === id);
    if (!folder) return false;

    const parent = folder.parent ?? "";
    const remainingFolders = folders
      .filter((entry) => entry.id !== id)
      .map((entry) => entry.parent === id ? { ...entry, parent, updatedAt: Date.now() } : entry);

    const raw = this.#raw();
    for (const note of Object.values(raw)) {
      if (note.folder !== id) continue;
      note.folder = parent;
      note.updatedAt = Date.now();
    }

    await this.#persist(raw);
    await this.#persistFolders(remainingFolders);
    return true;
  }

  static async moveNoteToFolder(id, folderId = "") {
    const target = folderId && this.folder(folderId) ? folderId : "";
    return this.update(id, { folder: target });
  }

  static tags() {
    return [];
  }

  static async #upsert(note) {
    const raw = this.#raw();
    raw[note.id] = normalizeNote(note);
    await this.#persist(raw);
  }

  static async #persist(collection) {
    return game.settings.set(MODULE_ID, SETTINGS.INDEX, collection);
  }

  static async #persistFolders(folders) {
    return game.settings.set(MODULE_ID, SETTINGS.FOLDERS, normalizeFolders(folders));
  }

  static #raw() {
    return foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.INDEX) ?? {});
  }

  static async #ensureLinkedDocument(note, options) {
    if (note.linkedUuid) return note;
    const document = await this.#createDocumentForNote(note, options);
    if (!document) return note;
    note.linkedUuid = document.uuid;
    note.linkedName = document.name;
    return note;
  }

  static async #createDocumentForNote(note, options) {
    const meta = NOTE_TYPE_META[note.type];
    if (!meta?.documentName) return null;

    try {
      if (note.type === NOTE_TYPES.ACTOR) {
        return this.#createLinked("Actor", {
          name: note.title,
          type: options.actorType ?? this.#firstDocumentType("Actor")
        });
      }
      if (note.type === NOTE_TYPES.ITEM) {
        return this.#createLinked("Item", {
          name: note.title,
          type: options.itemType ?? this.#firstDocumentType("Item")
        });
      }
      if (note.type === NOTE_TYPES.SCENE) {
        return this.#createLinked("Scene", {
          name: note.title,
          active: false,
          navigation: false
        });
      }
    } catch (error) {
      warn("Unable to create linked document", error);
    }
    return null;
  }

  static async #createLinked(documentName, data) {
    const cls = CONFIG[documentName]?.documentClass ?? globalThis[documentName];
    if (!cls) return null;
    const marker = `${documentName}.${data.name}`;
    LINKING.add(marker);
    const document = await cls.create(data, { renderSheet: false });
    LINKING.delete(marker);
    if (document) LINKING.add(document.uuid);
    window.setTimeout(() => document && LINKING.delete(document.uuid), 1000);
    return document;
  }

  static async #flagLinkedDocument(note) {
    if (!note.linkedUuid) return;
    try {
      const document = await fromUuid(note.linkedUuid);
      if (document) await document.setFlag(MODULE_ID, FLAGS.NOTE_ID, note.id);
    } catch (error) {
      warn("Unable to flag linked document", error);
    }
  }

  static async #clearLinkedDocumentFlag(note) {
    if (!note.linkedUuid) return;
    try {
      const document = await fromUuid(note.linkedUuid);
      if (document?.getFlag(MODULE_ID, FLAGS.NOTE_ID) === note.id) {
        await document.unsetFlag(MODULE_ID, FLAGS.NOTE_ID);
      }
    } catch (error) {
      warn("Unable to clear linked document flag", error);
    }
  }

  static #firstDocumentType(documentName) {
    const raw = game.system?.documentTypes?.[documentName] ?? Object.keys(CONFIG[documentName]?.typeLabels ?? {});
    const types = Array.isArray(raw) ? raw : Object.keys(raw ?? {});
    return types?.[0] ?? "base";
  }
}

function normalizeFolders(rawFolders) {
  const folders = [];
  const seen = new Set();

  for (const raw of rawFolders ?? []) {
    const folder = normalizeFolder(raw, folders);
    if (!folder || seen.has(folder.id)) continue;
    seen.add(folder.id);
    folders.push(folder);
  }

  const ids = new Set(folders.map((folder) => folder.id));
  for (const folder of folders) {
    if (!ids.has(folder.parent)) folder.parent = "";
  }

  return folders.sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeFolder(raw, existingFolders = []) {
  if (typeof raw === "string") {
    const name = raw.trim();
    if (!name) return null;
    return {
      id: uniqueFolderId(name, existingFolders),
      name,
      parent: "",
      createdAt: 0,
      updatedAt: 0
    };
  }

  const name = String(raw?.name ?? "").trim();
  if (!name) return null;
  const id = String(raw?.id ?? "").trim() || uniqueFolderId(name, existingFolders);
  return {
    id,
    name,
    parent: String(raw?.parent ?? "").trim(),
    createdAt: Number(raw?.createdAt ?? 0),
    updatedAt: Number(raw?.updatedAt ?? 0)
  };
}

function uniqueFolderId(name, folders) {
  const used = new Set(folders.map((folder) => folder.id));
  let id = slugify(name);
  while (used.has(id)) id = `${slugify(name)}-${foundry.utils.randomID(4)}`;
  return id;
}

function uniqueNoteTitle(title, usedTitles) {
  const base = String(title ?? game.i18n.localize("HSGM.NewNote")).trim() || game.i18n.localize("HSGM.NewNote");
  if (!usedTitles.has(base)) {
    usedTitles.set(base, 1);
    return base;
  }

  let index = usedTitles.get(base) + 1;
  let candidate = `${base} (${index})`;
  while (usedTitles.has(candidate)) {
    index++;
    candidate = `${base} (${index})`;
  }
  usedTitles.set(base, index);
  usedTitles.set(candidate, 1);
  return candidate;
}

function descendantsOf(folderId, folders) {
  const descendants = new Set();
  const visit = (parent) => {
    for (const folder of folders) {
      if (folder.parent !== parent || descendants.has(folder.id)) continue;
      descendants.add(folder.id);
      visit(folder.id);
    }
  };
  visit(folderId);
  return descendants;
}

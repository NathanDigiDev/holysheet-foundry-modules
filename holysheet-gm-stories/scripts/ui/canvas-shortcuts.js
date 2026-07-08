import { FLAGS, MODULE_ID, localize } from "../config.js";
import { NoteStore } from "../data/note-store.js";
import { NoteWindowApp } from "../apps/note-window.js";

const PROXY_FLAG = "proxyJournal";
const LEGACY_SHORTCUT_FLAG = "legacyShortcutId";
const PROXY_FOLDER_NAME = "GM-Stories";

let clickPatchInstalled = false;

export function installCanvasShortcuts() {
  if (!game.user.isGM) return;
  patchNativeNoteClicks();
  Hooks.on("canvasReady", migrateLegacyShortcuts);
  document.addEventListener("dragover", onDragOver);
  document.addEventListener("drop", onDrop);
  if (canvas?.ready) migrateLegacyShortcuts();
}

function patchNativeNoteClicks() {
  if (clickPatchInstalled) return;
  const NoteClass = foundry.canvas?.placeables?.Note;
  if (!NoteClass?.prototype) return;

  const originalClickLeft = NoteClass.prototype._onClickLeft;
  const originalClickLeft2 = NoteClass.prototype._onClickLeft2;

  NoteClass.prototype._onClickLeft = function(event) {
    const noteId = this.document?.getFlag(MODULE_ID, FLAGS.NOTE_ID);
    if (noteId && canvas?.activeLayer !== canvas?.notes) {
      event?.stopPropagation?.();
      new NoteWindowApp(noteId).render({ force: true });
      return;
    }
    return originalClickLeft?.call(this, event);
  };

  NoteClass.prototype._onClickLeft2 = function(event) {
    const noteId = this.document?.getFlag(MODULE_ID, FLAGS.NOTE_ID);
    if (noteId) {
      event?.stopPropagation?.();
      new NoteWindowApp(noteId).render({ force: true });
      return;
    }
    return originalClickLeft2?.call(this, event);
  };

  clickPatchInstalled = true;
}

function onDragOver(event) {
  if (!isStoryDrag(event)) return;
  event.preventDefault();
}

async function onDrop(event) {
  if (!isStoryDrag(event) || !canvas?.ready || !canvas.scene) return;
  event.preventDefault();

  let data;
  try {
    const noteId = event.dataTransfer.getData("application/x-hsgm-note");
    data = noteId ? { type: "HolySheetGMStory", noteId } : JSON.parse(event.dataTransfer.getData("text/plain"));
  } catch (_error) {
    return;
  }
  if (data.type !== "HolySheetGMStory" || !data.noteId) return;

  const point = screenToWorld(event.clientX, event.clientY);
  await createNativeShortcut(data.noteId, point);
}

function isStoryDrag(event) {
  return Array.from(event.dataTransfer?.types ?? []).includes("application/x-hsgm-note");
}

async function createNativeShortcut(noteId, point, legacyId = "") {
  const note = NoteStore.get(noteId);
  if (!note || !canvas?.scene) return null;
  const entry = await ensureProxyJournal(note);
  if (!entry) return null;

  const data = {
    entryId: entry.id,
    x: Math.round(point.x),
    y: Math.round(point.y),
    text: note.title,
    texture: { src: "icons/svg/book.svg" },
    iconSize: 32,
    fontSize: 24,
    flags: {
      [MODULE_ID]: {
        [FLAGS.NOTE_ID]: note.id,
        [PROXY_FLAG]: entry.id,
        ...(legacyId ? { [LEGACY_SHORTCUT_FLAG]: legacyId } : {})
      }
    }
  };

  const created = await canvas.scene.createEmbeddedDocuments("Note", [data]);
  ui.notifications?.info(localize("HSGM.NativeNoteCreated"));
  return created?.[0] ?? null;
}

async function ensureProxyJournal(note) {
  const folder = await ensureProxyFolder();
  const existing = game.journal.find((entry) =>
    entry.getFlag(MODULE_ID, FLAGS.NOTE_ID) === note.id &&
    entry.getFlag(MODULE_ID, PROXY_FLAG)
  );
  if (existing) {
    const update = {};
    if (existing.name !== note.title) update.name = note.title;
    if (folder && existing.folder?.id !== folder.id) update.folder = folder.id;
    if (Object.keys(update).length) await existing.update(update);
    return existing;
  }

  const ownership = { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE };
  return JournalEntry.create({
    name: note.title,
    folder: folder?.id,
    ownership,
    flags: {
      [MODULE_ID]: {
        [FLAGS.NOTE_ID]: note.id,
        [PROXY_FLAG]: true
      }
    },
    pages: [{
      name: note.title,
      type: "text",
      text: { content: `<p>${note.title}</p>` }
    }]
  }, { renderSheet: false });
}

async function ensureProxyFolder() {
  const existing = game.folders.find((folder) =>
    folder.type === "JournalEntry" &&
    folder.name === PROXY_FOLDER_NAME
  );
  if (existing) return existing;

  return Folder.create({
    name: PROXY_FOLDER_NAME,
    type: "JournalEntry",
    sorting: "a"
  }, { renderSheet: false });
}

async function organizeProxyJournals() {
  const folder = await ensureProxyFolder();
  if (!folder) return;

  const proxies = game.journal.filter((entry) =>
    entry.getFlag(MODULE_ID, PROXY_FLAG) &&
    entry.folder?.id !== folder.id
  );

  for (const entry of proxies) {
    await entry.update({ folder: folder.id });
  }
}

async function migrateLegacyShortcuts() {
  if (!game.user.isGM || !canvas?.scene) return;
  patchNativeNoteClicks();
  await organizeProxyJournals();
  const legacy = canvas.scene.getFlag(MODULE_ID, FLAGS.SHORTCUTS) ?? [];
  if (!Array.isArray(legacy) || !legacy.length) return;

  const existingLegacyIds = new Set(
    canvas.scene.notes
      .filter((document) => document.getFlag(MODULE_ID, LEGACY_SHORTCUT_FLAG))
      .map((document) => document.getFlag(MODULE_ID, LEGACY_SHORTCUT_FLAG))
  );

  for (const shortcut of legacy) {
    if (!shortcut?.noteId || existingLegacyIds.has(shortcut.id)) continue;
    await createNativeShortcut(shortcut.noteId, { x: shortcut.x, y: shortcut.y }, shortcut.id);
  }
  await canvas.scene.unsetFlag(MODULE_ID, FLAGS.SHORTCUTS);
}

function screenToWorld(clientX, clientY) {
  const transform = canvas.stage.worldTransform.clone().invert();
  const point = transform.apply(new PIXI.Point(clientX, clientY));
  return { x: point.x, y: point.y };
}

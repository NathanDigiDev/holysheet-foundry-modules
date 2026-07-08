import { FLAGS, MODULE_ID, NOTE_VISIBILITY } from "./constants.js";
import { getDateKey } from "./calendar-engine.js";

const ROOT_FOLDER_NAME = "Holysheet Calendar";

export async function ensureJournalFolder(user = game.user) {
  const root = await ensureFolder(ROOT_FOLDER_NAME, null);
  if (!user) return root;
  return ensureFolder(user.name, root?.id);
}

export async function ensureJournalFoldersForUsers() {
  const root = await ensureFolder(ROOT_FOLDER_NAME, null);
  for (const user of game.users) {
    await ensureFolder(user.name, root?.id);
  }
  return root;
}

export async function createCalendarNote({ calendar, date, phaseId, title, content, visibility }) {
  const folder = await ensureJournalFolder(visibility === NOTE_VISIBILITY.PRIVATE ? game.user : null);
  const ownership = buildOwnership(visibility, game.user.id);
  const entry = await JournalEntry.create({
    name: title || game.i18n.localize("HCC.DefaultNoteTitle"),
    folder: folder?.id,
    ownership,
    pages: [
      {
        name: title || game.i18n.localize("HCC.DefaultNoteTitle"),
        type: "text",
        text: {
          format: CONST.JOURNAL_ENTRY_PAGE_FORMATS.HTML,
          content: content || ""
        }
      }
    ],
    flags: {
      [MODULE_ID]: {
        [FLAGS.NOTE]: true,
        [FLAGS.CALENDAR_ID]: calendar.id,
        [FLAGS.DATE_KEY]: getDateKey(date),
        [FLAGS.PHASE_ID]: phaseId,
        [FLAGS.VISIBILITY]: visibility,
        [FLAGS.OWNER_USER_ID]: game.user.id
      }
    }
  });

  ui.notifications.info(game.i18n.format("HCC.NoteCreated", { title: entry.name }));
  return entry;
}

export function getNotesForDate(calendar, date) {
  const dateKey = getDateKey(date);
  return game.journal.filter((entry) => {
    const flags = foundry.utils.getProperty(entry, `flags.${MODULE_ID}`);
    if (!flags) return false;
    if (!flags[FLAGS.NOTE]) return false;
    if (flags[FLAGS.CALENDAR_ID] !== calendar.id || flags[FLAGS.DATE_KEY] !== dateKey) return false;
    return canSeeNote(entry, flags);
  });
}

export function getDueNotes(calendar) {
  const date = calendar.currentDate;
  const dateKey = getDateKey(date);
  return game.journal.filter((entry) => {
    const flags = foundry.utils.getProperty(entry, `flags.${MODULE_ID}`);
    if (!flags) return false;
    if (!flags[FLAGS.NOTE]) return false;
    if (flags[FLAGS.CALENDAR_ID] !== calendar.id) return false;
    if (flags[FLAGS.DATE_KEY] !== dateKey) return false;
    if (flags[FLAGS.PHASE_ID] !== date.phaseId) return false;
    return canSeeNote(entry, flags);
  });
}

export async function notifyDueNotes(calendar) {
  const notes = getDueNotes(calendar);
  for (const note of notes) {
    ui.notifications.info(note.name);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ alias: "Holysheet Calendar" }),
      content: `<p><strong>${game.i18n.localize("HCC.DayPhase")}:</strong> ${note.name}</p>`
    });
  }
}

function canSeeNote(entry, flags) {
  if (game.user.isGM) return true;
  if (flags[FLAGS.VISIBILITY] === NOTE_VISIBILITY.GM) return false;
  if (flags[FLAGS.VISIBILITY] === NOTE_VISIBILITY.PRIVATE && flags[FLAGS.OWNER_USER_ID] !== game.user.id) return false;
  return entry.testUserPermission(game.user, "OBSERVER");
}

async function ensureFolder(name, parentId) {
  const existing = game.folders.find((folder) => (
    folder.type === "JournalEntry" &&
    folder.name === name &&
    (folder.folder?.id ?? null) === (parentId ?? null)
  ));
  if (existing) return existing;
  if (!game.user.isGM) return null;
  return Folder.create({ name, type: "JournalEntry", folder: parentId });
}

function buildOwnership(visibility, ownerUserId) {
  const levels = CONST.DOCUMENT_OWNERSHIP_LEVELS;
  const ownership = { default: visibility === NOTE_VISIBILITY.PUBLIC ? levels.OBSERVER : levels.NONE };
  ownership[ownerUserId] = levels.OWNER;

  if (visibility === NOTE_VISIBILITY.GM) {
    for (const user of game.users) {
      if (user.isGM) ownership[user.id] = levels.OWNER;
    }
  }

  return ownership;
}

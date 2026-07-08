import { NOTE_TYPE_META, NOTE_TYPES, localize, localizeFallback } from "../config.js";
import { NoteStore } from "../data/note-store.js";
import { shareLinkedDocumentImage } from "../ui/document-image.js";
import { openWikiTarget, renderMarkdown } from "../ui/markdown.js";
import { registerApp, refreshOpenApps, unregisterApp } from "./refresh.js";
import { CreateNoteDialog } from "./create-note-dialog.js";
import { CreateFolderDialog } from "./create-folder-dialog.js";
import { LinkDocumentDialog } from "./link-document-dialog.js";
import { NoteWindowApp, wireEditorDrop } from "./note-window.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

let mainApp = null;

export function openMainApp() {
  mainApp ??= new GMStoriesApp();
  mainApp.render({ force: true });
  return mainApp;
}

export class GMStoriesApp extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.selectedId = NoteStore.all()[0]?.id ?? null;
    this.filter = {
      search: ""
    };
    this.isEditing = false;
    this.expandedFolders = new Set();
    this.createMenuOpen = false;
    this.toolsMenuOpen = false;
    this.folderContextMenu = null;
    this.searchTimeout = null;
    registerApp(this);
  }

  static DEFAULT_OPTIONS = {
    id: "hsgm-workspace",
    classes: ["holysheet", "hs-theme-lueur", "hsgm", "hsgm-workspace"],
    tag: "form",
    window: {
      title: "HSGM.Title",
      icon: "fa-solid fa-book-skull",
      resizable: true,
      contentClasses: ["standard-form"]
    },
    position: { width: 1160, height: 760 },
    form: {
      handler: GMStoriesApp.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: false
    },
    actions: {
      toggleCreateMenu: GMStoriesApp.#toggleCreateMenu,
      newNote: GMStoriesApp.#newNote,
      newFolder: GMStoriesApp.#newFolder,
      selectNote: GMStoriesApp.#selectNote,
      toggleFolder: GMStoriesApp.#toggleFolder,
      editNote: GMStoriesApp.#editNote,
      openLinked: GMStoriesApp.#openLinked,
      changeLink: GMStoriesApp.#changeLink,
      showLinkedImage: GMStoriesApp.#showLinkedImage,
      deleteNote: GMStoriesApp.#deleteNote
    }
  };

  static PARTS = {
    main: { template: "modules/holysheet-gm-stories/templates/workspace.hbs" }
  };

  async close(options) {
    unregisterApp(this);
    if (mainApp === this) mainApp = null;
    return super.close(options);
  }

  async _prepareContext() {
    const notes = this.#filteredNotes();
    if (!this.selectedId || !NoteStore.get(this.selectedId)) this.selectedId = notes[0]?.id ?? NoteStore.all()[0]?.id ?? null;
    const selected = this.selectedId ? NoteStore.get(this.selectedId) : null;
    const content = selected ? await NoteStore.content(selected.id) : "";
    const treeRows = this.#treeRows(notes);

    return {
      notes: notes.map((note) => ({
        ...note,
        selected: note.id === this.selectedId,
        typeLabel: localizeFallback(NOTE_TYPE_META[note.type].label, NOTE_TYPE_META[note.type].fallback),
        typeIcon: NOTE_TYPE_META[note.type].icon
      })),
      selected,
      selectedTypeMeta: selected ? {
        ...NOTE_TYPE_META[selected.type],
        label: localizeFallback(NOTE_TYPE_META[selected.type].label, NOTE_TYPE_META[selected.type].fallback)
      } : null,
      content,
      renderedContent: await renderMarkdown(content),
      isEditing: this.isEditing,
      treeRows,
      search: this.filter.search,
      createMenuOpen: this.createMenuOpen,
      toolsMenuOpen: this.toolsMenuOpen,
      folderContextMenu: this.folderContextMenu,
      hasTree: treeRows.length > 0
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    wireEditorDrop(this.element);
    const searchInput = this.element.querySelector("[data-search]");
    searchInput?.addEventListener("input", (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.clearTimeout(this.searchTimeout);
      const value = event.currentTarget.value;
      this.searchTimeout = window.setTimeout(() => {
        this.filter.search = value;
        this.render({ force: false });
      }, 120);
    });
    searchInput?.addEventListener("change", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    searchInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") event.preventDefault();
      event.stopPropagation();
    });
    this.element.querySelector("[data-hsgm-create-toggle]")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.createMenuOpen = !this.createMenuOpen;
      this.toolsMenuOpen = false;
      this.folderContextMenu = null;
      this.render({ force: false });
    });
    this.element.querySelector("[data-hsgm-tools-toggle]")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.toolsMenuOpen = !this.toolsMenuOpen;
      this.createMenuOpen = false;
      this.folderContextMenu = null;
      this.render({ force: false });
    });
    this.element.querySelector("[data-hsgm-new-note]")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.createMenuOpen = false;
      new CreateNoteDialog().render({ force: true });
    });
    this.element.querySelector("[data-hsgm-new-folder]")?.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.createMenuOpen = false;
      new CreateFolderDialog().render({ force: true });
    });
    this.element.querySelector("[data-hsgm-export]")?.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.toolsMenuOpen = false;
      await this.#exportStories();
    });
    this.element.querySelector("[data-hsgm-import]")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.toolsMenuOpen = false;
      this.element.querySelector("[data-hsgm-import-file]")?.click();
    });
    this.element.querySelector("[data-folder-context-delete]")?.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const folderId = event.currentTarget.dataset.folderId;
      this.folderContextMenu = null;
      await this.#deleteFolder(folderId);
    });
    this.element.querySelector("[data-folder-context-close]")?.addEventListener("click", (event) => {
      event.preventDefault();
      this.folderContextMenu = null;
      this.render({ force: false });
    });
    this.element.addEventListener("click", (event) => {
      if (!this.folderContextMenu || event.target.closest(".hsgm-context-menu")) return;
      this.folderContextMenu = null;
      this.render({ force: false });
    });
    this.element.querySelector("[data-hsgm-import-file]")?.addEventListener("change", async (event) => {
      await this.#importStories(event.currentTarget.files?.[0]);
      event.currentTarget.value = "";
    });
    this.element.querySelectorAll("[data-wiki]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        openWikiTarget(link.dataset.wiki);
      });
    });
    this.element.querySelector("[data-link-button]")?.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (this.selectedId) new LinkDocumentDialog(this.selectedId).render({ force: true });
    });
    this.element.querySelectorAll("[data-note-drag]").forEach((node) => {
      node.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("application/x-hsgm-note", node.dataset.noteId);
        event.dataTransfer.setData("application/x-hsgm-tree", JSON.stringify({
          kind: "note",
          id: node.dataset.noteId
        }));
        event.dataTransfer.setData("text/plain", JSON.stringify({
          type: "HolySheetGMStory",
          noteId: node.dataset.noteId
        }));
      });
    });
    this.element.querySelectorAll("[data-folder-drag]").forEach((node) => {
      node.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("application/x-hsgm-tree", JSON.stringify({
          kind: "folder",
          id: node.dataset.folderId
        }));
      });
      node.addEventListener("contextmenu", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.createMenuOpen = false;
        this.toolsMenuOpen = false;
        this.folderContextMenu = {
          id: node.dataset.folderId,
          name: node.dataset.folderName ?? "",
          x: event.clientX,
          y: event.clientY
        };
        this.render({ force: false });
      });
    });
    this.element.querySelectorAll("[data-folder-drop], [data-root-drop]").forEach((node) => {
      node.addEventListener("dragover", (event) => {
        if (!Array.from(event.dataTransfer?.types ?? []).includes("application/x-hsgm-tree")) return;
        event.preventDefault();
        node.classList.add("is-drop-target");
      });
      node.addEventListener("dragleave", () => node.classList.remove("is-drop-target"));
      node.addEventListener("drop", async (event) => {
        if (!Array.from(event.dataTransfer?.types ?? []).includes("application/x-hsgm-tree")) return;
        event.preventDefault();
        event.stopPropagation();
        node.classList.remove("is-drop-target");
        await this.#handleTreeDrop(event, node);
      });
    });
  }

  #filteredNotes() {
    const search = this.filter.search.trim().toLowerCase();
    return NoteStore.all().filter((note) => {
      if (!search) return true;
      const haystack = `${note.title} ${NoteStore.folderName(note.folder)} ${note.linkedName}`.toLowerCase();
      return haystack.includes(search);
    });
  }

  #treeRows(notes) {
    const search = this.filter.search.trim();
    const folders = NoteStore.folders();
    const notesByFolder = new Map();
    for (const note of notes) {
      const folderId = NoteStore.folder(note.folder) ? note.folder : "";
      if (!notesByFolder.has(folderId)) notesByFolder.set(folderId, []);
      notesByFolder.get(folderId).push(note);
    }
    for (const list of notesByFolder.values()) list.sort((a, b) => a.title.localeCompare(b.title));

    const foldersByParent = new Map();
    for (const folder of folders) {
      const parent = folder.parent && folders.some((entry) => entry.id === folder.parent) ? folder.parent : "";
      if (!foldersByParent.has(parent)) foldersByParent.set(parent, []);
      foldersByParent.get(parent).push(folder);
    }
    for (const list of foldersByParent.values()) list.sort((a, b) => a.name.localeCompare(b.name));

    const rows = [];
    const hasVisibleDescendants = (folderId) => {
      if ((notesByFolder.get(folderId) ?? []).length) return true;
      return (foldersByParent.get(folderId) ?? []).some((folder) => hasVisibleDescendants(folder.id));
    };
    const folderRows = (parent, depth) => {
      for (const folder of foldersByParent.get(parent) ?? []) {
        if (search && !hasVisibleDescendants(folder.id)) continue;
        const hasChildren = hasVisibleDescendants(folder.id);
        const expanded = search ? true : this.expandedFolders.has(folder.id);
        rows.push({
          kind: "folder",
          id: folder.id,
          name: folder.name,
          depth,
          hasChildren,
          expanded
        });
        if (!expanded) continue;
        folderRows(folder.id, depth + 1);
        noteRows(folder.id, depth + 1);
      }
    };
    const noteRows = (folderId, depth) => {
      for (const note of notesByFolder.get(folderId) ?? []) {
        const meta = NOTE_TYPE_META[note.type] ?? NOTE_TYPE_META[NOTE_TYPES.GENERAL];
        rows.push({
          kind: "note",
          id: note.id,
          title: note.title,
          depth,
          selected: note.id === this.selectedId,
          typeIcon: meta.icon,
          typeLabel: localizeFallback(meta.label, meta.fallback)
        });
      }
    };

    folderRows("", 0);
    noteRows("", 0);
    return rows;
  }

  async #handleTreeDrop(event, target) {
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("application/x-hsgm-tree"));
    } catch (_error) {
      return;
    }

    const folderId = target.dataset.folderDrop ?? "";
    if (data.kind === "note") await NoteStore.moveNoteToFolder(data.id, folderId);
    if (data.kind === "folder") {
      await NoteStore.moveFolder(data.id, folderId);
      if (folderId) this.expandedFolders.add(folderId);
    }
    refreshOpenApps();
  }

  /** @this {GMStoriesApp} */
  static async #onSubmit(_event, _form, formData) {
    if (!this.selectedId || !this.isEditing) return;
    const data = foundry.utils.expandObject(formData.object);
    await NoteStore.update(this.selectedId, {
      title: data.note?.title
    });
    await NoteStore.saveContent(this.selectedId, data.content ?? "");
    this.isEditing = false;
    refreshOpenApps();
  }

  static #newNote() {
    this.createMenuOpen = false;
    new CreateNoteDialog().render({ force: true });
  }

  static async #newFolder() {
    this.createMenuOpen = false;
    new CreateFolderDialog().render({ force: true });
  }

  static #selectNote(_event, target) {
    this.selectedId = target.dataset.noteId;
    this.isEditing = false;
    this.render({ force: false });
  }

  static #toggleFolder(_event, target) {
    const folderId = target.dataset.folderId;
    if (!folderId) return;
    if (this.expandedFolders.has(folderId)) this.expandedFolders.delete(folderId);
    else this.expandedFolders.add(folderId);
    this.render({ force: false });
  }

  async #deleteFolder(folderId) {
    if (!folderId) return;
    const ok = await confirmDialog(localize("HSGM.DeleteFolderConfirm"));
    if (!ok) return;
    await NoteStore.deleteFolder(folderId);
    this.expandedFolders.delete(folderId);
    this.folderContextMenu = null;
    refreshOpenApps();
  }

  async #exportStories() {
    const archive = await NoteStore.exportArchive();
    const fileName = `gm-stories-${game.world?.id ?? "world"}-${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([JSON.stringify(archive, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    ui.notifications?.info(localize("HSGM.ExportReady"));
    this.render({ force: false });
  }

  async #importStories(file) {
    if (!file) return;
    const ok = await confirmDialog(localize("HSGM.ImportConfirm"));
    if (!ok) return;

    try {
      const archive = JSON.parse(await file.text());
      const result = await NoteStore.importArchive(archive);
      ui.notifications?.info(game.i18n.format("HSGM.ImportComplete", result));
      refreshOpenApps();
    } catch (error) {
      console.error(error);
      ui.notifications?.error(localize("HSGM.ImportFailed"));
    }
  }

  static #toggleCreateMenu() {
    this.createMenuOpen = !this.createMenuOpen;
    this.toolsMenuOpen = false;
    this.folderContextMenu = null;
    this.render({ force: false });
  }

  static #editNote() {
    this.isEditing = true;
    this.render({ force: false });
  }

  static async #openLinked() {
    const note = NoteStore.get(this.selectedId);
    if (!note?.linkedUuid) return;
    const document = await fromUuid(note.linkedUuid);
    document?.sheet?.render(true);
  }

  static #changeLink() {
    if (!this.selectedId) return;
    new LinkDocumentDialog(this.selectedId).render({ force: true });
  }

  static async #showLinkedImage() {
    const note = NoteStore.get(this.selectedId);
    await shareLinkedDocumentImage(note);
  }

  static async #deleteNote() {
    if (!this.selectedId) return;
    const ok = await confirmDialog(localize("HSGM.DeleteConfirm"));
    if (!ok) return;
    await NoteStore.delete(this.selectedId);
    this.selectedId = NoteStore.all()[0]?.id ?? null;
    refreshOpenApps();
  }
}

async function confirmDialog(content) {
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (DialogV2?.confirm) return DialogV2.confirm({ window: { title: "HSGM.Delete" }, content });
  return window.confirm(content);
}

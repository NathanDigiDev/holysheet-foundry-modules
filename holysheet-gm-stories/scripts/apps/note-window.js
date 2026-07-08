import { NOTE_TYPE_META, localize, localizeFallback } from "../config.js";
import { NoteStore } from "../data/note-store.js";
import { shareLinkedDocumentImage } from "../ui/document-image.js";
import { openWikiTarget, renderMarkdown } from "../ui/markdown.js";
import { registerApp, unregisterApp, refreshOpenApps } from "./refresh.js";
import { LinkDocumentDialog } from "./link-document-dialog.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class NoteWindowApp extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(noteId, options = {}) {
    super(foundry.utils.mergeObject({ id: `hsgm-note-window-${noteId}` }, options, { inplace: false }));
    this.noteId = noteId;
    this.isEditing = false;
    registerApp(this);
  }

  static DEFAULT_OPTIONS = {
    id: "hsgm-note-window",
    classes: ["holysheet", "hs-theme-lueur", "hsgm", "hsgm-note-window"],
    tag: "form",
    window: {
      title: "HSGM.Window.Note",
      icon: "fa-solid fa-scroll",
      resizable: true,
      contentClasses: ["standard-form"]
    },
    position: { width: 760, height: 720 },
    form: {
      handler: NoteWindowApp.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: false
    },
    actions: {
      editNote: NoteWindowApp.#editNote,
      openLinked: NoteWindowApp.#openLinked,
      changeLink: NoteWindowApp.#changeLink,
      showLinkedImage: NoteWindowApp.#showLinkedImage,
      deleteNote: NoteWindowApp.#deleteNote
    }
  };

  static PARTS = {
    main: { template: "modules/holysheet-gm-stories/templates/note-window.hbs" }
  };

  get title() {
    return `${localize("HSGM.Window.Note")} - ${NoteStore.get(this.noteId)?.title ?? ""}`;
  }

  async close(options) {
    unregisterApp(this);
    return super.close(options);
  }

  async _prepareContext() {
    const note = NoteStore.get(this.noteId);
    const content = note ? await NoteStore.content(note.id) : "";
    return {
      note,
      content,
      renderedContent: await renderMarkdown(content),
      isEditing: this.isEditing,
      typeMeta: note ? {
        ...NOTE_TYPE_META[note.type],
        label: localizeFallback(NOTE_TYPE_META[note.type].label, NOTE_TYPE_META[note.type].fallback)
      } : null
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    wireEditorDrop(this.element);
    this.element.querySelectorAll("[data-wiki]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        openWikiTarget(link.dataset.wiki);
      });
    });
    this.element.querySelector("[data-link-button]")?.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      new LinkDocumentDialog(this.noteId).render({ force: true });
    });
  }

  /** @this {NoteWindowApp} */
  static async #onSubmit(_event, _form, formData) {
    const data = foundry.utils.expandObject(formData.object);
    await NoteStore.update(this.noteId, {
      title: data.note?.title
    });
    await NoteStore.saveContent(this.noteId, data.content ?? "");
    this.isEditing = false;
    refreshOpenApps();
  }

  static #editNote() {
    this.isEditing = true;
    this.render({ force: false });
  }

  static async #openLinked() {
    const note = NoteStore.get(this.noteId);
    if (!note?.linkedUuid) return;
    const document = await fromUuid(note.linkedUuid);
    document?.sheet?.render(true);
  }

  static #changeLink() {
    new LinkDocumentDialog(this.noteId).render({ force: true });
  }

  static async #showLinkedImage() {
    const note = NoteStore.get(this.noteId);
    await shareLinkedDocumentImage(note);
  }

  static async #deleteNote() {
    const ok = await confirmDialog(localize("HSGM.DeleteConfirm"));
    if (!ok) return;
    await NoteStore.delete(this.noteId);
    refreshOpenApps();
    this.close();
  }
}

export function wireEditorDrop(root) {
  const textarea = root.querySelector("[data-note-content]");
  if (!textarea) return;

  textarea.addEventListener("dragover", (event) => event.preventDefault());
  textarea.addEventListener("drop", async (event) => {
    event.preventDefault();
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));
    } catch (_error) {
      return;
    }
    if (!["Actor", "Item", "Scene"].includes(data.type)) return;
    const document = data.uuid ? await fromUuid(data.uuid) : null;
    if (!document) return;
    const link = `@UUID[${document.uuid}]{${document.name}}`;
    const start = textarea.selectionStart ?? textarea.value.length;
    textarea.setRangeText(link, start, textarea.selectionEnd ?? start, "end");
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function confirmDialog(content) {
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (DialogV2?.confirm) return DialogV2.confirm({ window: { title: "HSGM.Delete" }, content });
  return window.confirm(content);
}

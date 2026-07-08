import { NOTE_TYPE_META, NOTE_TYPES, localize, localizeFallback } from "../config.js";
import { NoteStore } from "../data/note-store.js";
import { refreshOpenApps } from "./refresh.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class LinkDocumentDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(noteId, options = {}) {
    super(foundry.utils.mergeObject({ id: `hsgm-link-document-${noteId}` }, options, { inplace: false }));
    this.noteId = noteId;
  }

  static DEFAULT_OPTIONS = {
    id: "hsgm-link-document",
    classes: ["holysheet", "hs-theme-lueur", "hsgm", "hsgm-create"],
    tag: "form",
    window: {
      title: "HSGM.ChangeLink",
      icon: "fa-solid fa-link",
      resizable: false,
      contentClasses: ["standard-form"]
    },
    position: { width: 460, height: "auto" },
    form: {
      handler: LinkDocumentDialog.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: true
    },
    actions: {
      cancel: LinkDocumentDialog.#onCancel
    }
  };

  static PARTS = {
    main: { template: "modules/holysheet-gm-stories/templates/link-document.hbs" }
  };

  async _prepareContext() {
    const note = NoteStore.get(this.noteId);
    const meta = note ? NOTE_TYPE_META[note.type] : null;
    const documentName = meta?.documentName ?? "";
    return {
      note,
      canLink: Boolean(documentName),
      typeLabel: meta ? localizeFallback(meta.label, meta.fallback) : "",
      documents: this.#documents(documentName),
      actorTypes: this.#documentTypes("Actor"),
      itemTypes: this.#documentTypes("Item"),
      showActorType: note?.type === NOTE_TYPES.ACTOR,
      showItemType: note?.type === NOTE_TYPES.ITEM
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const linkMode = this.element.querySelector("[name='linkMode']");
    const linkedUuid = this.element.querySelector("[name='linkedUuid']");
    const linkedName = this.element.querySelector("[name='linkedName']");
    const search = this.element.querySelector("[data-document-search]");

    const syncFields = () => {
      const mode = linkMode?.value ?? "none";
      this.element.querySelector("[data-existing-link-field]")?.toggleAttribute("hidden", mode !== "existing");
      this.element.querySelector("[data-new-link-field]")?.toggleAttribute("hidden", mode !== "new");
      filterOptions();
    };
    const filterOptions = () => {
      const query = search?.value?.trim().toLowerCase() ?? "";
      this.element.querySelectorAll("[data-document-option]").forEach((button) => {
        const matches = !query || (button.dataset.search ?? "").includes(query);
        button.toggleAttribute("hidden", !matches);
      });
    };

    linkMode?.addEventListener("change", () => {
      if (linkedUuid) linkedUuid.value = "";
      if (linkedName) linkedName.value = "";
      syncFields();
    });
    search?.addEventListener("input", (event) => {
      event.preventDefault();
      event.stopPropagation();
      filterOptions();
    });
    search?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") event.preventDefault();
      event.stopPropagation();
    });
    this.element.querySelectorAll("[data-document-option]").forEach((button) => {
      button.addEventListener("click", () => {
        if (linkedUuid) linkedUuid.value = button.dataset.uuid ?? "";
        if (linkedName) linkedName.value = button.dataset.name ?? "";
        this.element.querySelectorAll("[data-document-option]").forEach((option) => option.classList.remove("is-selected"));
        button.classList.add("is-selected");
      });
    });
    syncFields();
  }

  #documents(documentName) {
    const type = Object.values(NOTE_TYPES).find((noteType) => NOTE_TYPE_META[noteType]?.documentName === documentName);
    const collectionName = type ? NOTE_TYPE_META[type]?.collection : "";
    const documents = collectionName ? game[collectionName]?.contents ?? [] : [];
    return documents
      .map((document) => ({
        uuid: document.uuid,
        name: document.name,
        search: `${document.name} ${document.type ?? ""}`.toLowerCase()
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  #documentTypes(documentName) {
    const raw = game.system?.documentTypes?.[documentName] ?? Object.keys(CONFIG[documentName]?.typeLabels ?? {});
    const types = Array.isArray(raw) ? raw : Object.keys(raw ?? {});
    return types.map((type) => ({
      key: type,
      label: localizeFallback(CONFIG[documentName]?.typeLabels?.[type] ?? type, type)
    }));
  }

  /** @this {LinkDocumentDialog} */
  static async #onSubmit(_event, _form, formData) {
    const note = NoteStore.get(this.noteId);
    if (!note) return;
    const data = foundry.utils.expandObject(formData.object);
    if (data.linkMode === "none") {
      await NoteStore.clearLink(note.id);
    } else if (data.linkMode === "existing" && data.linkedUuid) {
      const document = await fromUuid(data.linkedUuid);
      if (document) await NoteStore.linkDocument(note.id, document);
    } else if (data.linkMode === "new") {
      await NoteStore.createLinkedDocument(note.id, {
        actorType: data.actorType,
        itemType: data.itemType
      });
    }
    refreshOpenApps();
  }

  static #onCancel() {
    this.close();
  }
}

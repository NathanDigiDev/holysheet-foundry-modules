import { NOTE_TYPE_META, NOTE_TYPES, localize, localizeFallback } from "../config.js";
import { NoteStore } from "../data/note-store.js";
import { refreshOpenApps } from "./refresh.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CreateNoteDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "hsgm-create-note",
    classes: ["holysheet", "hs-theme-lueur", "hsgm", "hsgm-create"],
    tag: "form",
    window: {
      title: "HSGM.NewNote",
      icon: "fa-solid fa-feather-pointed",
      resizable: false,
      contentClasses: ["standard-form"]
    },
    position: { width: 460, height: "auto" },
    form: {
      handler: CreateNoteDialog.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: true
    },
    actions: {
      cancel: CreateNoteDialog.#onCancel
    }
  };

  static PARTS = {
    main: { template: "modules/holysheet-gm-stories/templates/create-note.hbs" }
  };

  async _prepareContext() {
    return {
      types: Object.entries(NOTE_TYPE_META).map(([key, meta]) => ({
        key,
        label: localizeFallback(meta.label, meta.fallback),
        icon: meta.icon
      })),
      actorTypes: this.#documentTypes("Actor"),
      itemTypes: this.#documentTypes("Item"),
      actorDocuments: this.#documents("Actor"),
      itemDocuments: this.#documents("Item"),
      sceneDocuments: this.#documents("Scene"),
      folders: this.#folders(),
      defaultType: NOTE_TYPES.GENERAL
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const typeSelect = this.element.querySelector("[name='type']");
    const linkMode = this.element.querySelector("[name='linkMode']");
    const search = this.element.querySelector("[data-document-search]");
    const linkedUuid = this.element.querySelector("[name='linkedUuid']");
    const linkedName = this.element.querySelector("[name='linkedName']");

    const syncFields = () => {
      const type = typeSelect?.value;
      const mode = linkMode?.value ?? "none";
      const canLink = [NOTE_TYPES.ACTOR, NOTE_TYPES.ITEM, NOTE_TYPES.SCENE].includes(type);

      this.element.querySelector("[data-link-settings]")?.toggleAttribute("hidden", !canLink);
      this.element.querySelector("[data-existing-link-field]")?.toggleAttribute("hidden", !canLink || mode !== "existing");
      this.element.querySelector("[data-actor-type-field]")?.toggleAttribute("hidden", type !== NOTE_TYPES.ACTOR || mode !== "new");
      this.element.querySelector("[data-item-type-field]")?.toggleAttribute("hidden", type !== NOTE_TYPES.ITEM || mode !== "new");
      this.#filterDocumentOptions();
    };
    typeSelect?.addEventListener("change", () => {
      if (linkedUuid) linkedUuid.value = "";
      if (linkedName) linkedName.value = "";
      if (search) search.value = "";
      if (linkMode) linkMode.value = typeSelect.value === NOTE_TYPES.GENERAL ? "none" : "existing";
      this.element.querySelectorAll("[data-document-option]").forEach((option) => option.classList.remove("is-selected"));
      syncFields();
    });
    linkMode?.addEventListener("change", () => {
      if (linkedUuid) linkedUuid.value = "";
      if (linkedName) linkedName.value = "";
      syncFields();
    });
    search?.addEventListener("input", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.#filterDocumentOptions();
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

  #filterDocumentOptions() {
    const type = this.element.querySelector("[name='type']")?.value;
    const query = this.element.querySelector("[data-document-search]")?.value?.trim().toLowerCase() ?? "";
    this.element.querySelectorAll("[data-document-group]").forEach((group) => {
      group.toggleAttribute("hidden", group.dataset.documentGroup !== type);
    });
    this.element.querySelectorAll("[data-document-option]").forEach((button) => {
      const visibleType = button.dataset.noteType === type;
      const matches = !query || (button.dataset.search ?? "").includes(query);
      button.toggleAttribute("hidden", !visibleType || !matches);
    });
  }

  #documentTypes(documentName) {
    const raw = game.system?.documentTypes?.[documentName] ?? Object.keys(CONFIG[documentName]?.typeLabels ?? {});
    const types = Array.isArray(raw) ? raw : Object.keys(raw ?? {});
    return types.map((type) => ({
      key: type,
      label: localizeFallback(CONFIG[documentName]?.typeLabels?.[type] ?? type, type)
    }));
  }

  #documents(documentName) {
    const collectionName = NOTE_TYPE_META[Object.values(NOTE_TYPES).find((type) => NOTE_TYPE_META[type]?.documentName === documentName)]?.collection;
    const documents = collectionName ? game[collectionName]?.contents ?? [] : [];
    return documents
      .map((document) => ({
        uuid: document.uuid,
        name: document.name,
        type: document.type ?? "",
        search: `${document.name} ${document.type ?? ""}`.toLowerCase()
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  #folders() {
    return [
      { key: "", label: localize("HSGM.NoFolder") },
      ...NoteStore.folderOptions()
    ];
  }

  /** @this {CreateNoteDialog} */
  static async #onSubmit(_event, _form, formData) {
    const data = foundry.utils.expandObject(formData.object);
    const linkMode = data.type === NOTE_TYPES.GENERAL ? "none" : data.linkMode;
    let linkedDocument = null;
    if (linkMode === "existing" && data.linkedUuid) {
      linkedDocument = await fromUuid(data.linkedUuid);
    }

    const note = await NoteStore.create({
      title: data.title,
      type: data.type,
      folder: data.folder,
      linkedUuid: linkedDocument?.uuid ?? "",
      linkedName: linkedDocument?.name ?? "",
      content: ""
    }, {
      skipDocumentLink: linkMode !== "new",
      actorType: data.actorType,
      itemType: data.itemType
    });
    refreshOpenApps();
    const { NoteWindowApp } = await import("./note-window.js");
    new NoteWindowApp(note.id).render({ force: true });
  }

  static #onCancel() {
    this.close();
  }
}

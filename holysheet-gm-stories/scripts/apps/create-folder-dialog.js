import { NoteStore } from "../data/note-store.js";
import { refreshOpenApps } from "./refresh.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CreateFolderDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.createdFolder = "";
  }

  static DEFAULT_OPTIONS = {
    id: "hsgm-create-folder",
    classes: ["holysheet", "hs-theme-lueur", "hsgm", "hsgm-create"],
    tag: "form",
    window: {
      title: "HSGM.NewFolder",
      icon: "fa-solid fa-folder-plus",
      resizable: false,
      contentClasses: ["standard-form"]
    },
    position: { width: 380, height: "auto" },
    form: {
      handler: CreateFolderDialog.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: true
    },
    actions: {
      cancel: CreateFolderDialog.#onCancel
    }
  };

  static PARTS = {
    main: { template: "modules/holysheet-gm-stories/templates/create-folder.hbs" }
  };

  /** @this {CreateFolderDialog} */
  static async #onSubmit(_event, _form, formData) {
    const data = foundry.utils.expandObject(formData.object);
    this.createdFolder = await NoteStore.createFolder(data.folderName);
    refreshOpenApps();
  }

  static #onCancel() {
    this.close();
  }
}

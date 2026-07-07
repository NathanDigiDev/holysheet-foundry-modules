import { getHolySheetWorldConfig } from "../config.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class HolySheetItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["holysheet", "hs-theme-cuir", "sheet", "item"],
    form: {
      closeOnSubmit: false,
      handler: this.#onSubmit,
      submitOnChange: true
    },
    position: {
      width: 560,
      height: 480
    },
    tag: "form",
    window: {
      resizable: true
    }
  };

  static PARTS = {
    body: {
      template: "systems/holysheet/templates/item/equipment-sheet.hbs",
      scrollable: [""]
    }
  };

  get item() {
    return this.document;
  }

  get title() {
    return this.item.name;
  }

  get template() {
    return `systems/holysheet/templates/item/${this.item.type}-sheet.hbs`;
  }

  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    options.window ??= {};
    options.window.title = this.title;
  }

  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    parts.body.template = this.template;
    return parts;
  }

  async _prepareContext(options = {}) {
    const context = await super._prepareContext(options);
    context.system = this.item.system;
    context.item = this.item;
    context.cssClass = "";
    const world = getHolySheetWorldConfig();
    const categories = [...(world.itemCategories ?? [])];
    if (this.item.system.category && !categories.includes(this.item.system.category)) {
      categories.push(this.item.system.category);
    }

    context.hs = {
      ...world,
      categoryChoices: categories.map((category) => ({
        label: category,
        selected: category === this.item.system.category
      })),
      showArmorValue: this.#isArmorCategory(this.item.system.category)
    };
    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.element.querySelector("[data-item-category]")?.addEventListener("change", (event) => {
      const showArmor = this.#isArmorCategory(event.currentTarget.value);
      this.element.querySelector("[data-armor-value-field]")?.classList.toggle("hs-hidden-field", !showArmor);
    });

    if (this.isEditable) {
      this.element.querySelector("[data-edit='img']")?.addEventListener("click", (event) => this.#editImage(event));
    }
  }

  static async #onSubmit(event, form, formData) {
    const submitData = this._prepareSubmitData(event, form, formData);
    await this.item.update(submitData);
  }

  _prepareSubmitData(_event, _form, formData) {
    const expanded = foundry.utils.expandObject(formData.object);
    if (typeof expanded.name === "string") {
      expanded.name = expanded.name.replace(/\s*\n+\s*/g, " ").trim();
    }
    return foundry.utils.flattenObject(expanded);
  }

  #editImage(event) {
    event.preventDefault();
    const field = event.currentTarget.dataset.edit;
    if (!field) return;

    new FilePicker({
      type: "image",
      current: foundry.utils.getProperty(this.item, field),
      callback: (path) => this.item.update({ [field]: path })
    }).render(true);
  }

  #isArmorCategory(category) {
    const normalized = String(category ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    return ["armure", "vetement"].includes(normalized);
  }
}

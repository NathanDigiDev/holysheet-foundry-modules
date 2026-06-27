import { getHolySheetWorldConfig } from "../config.mjs";

export class HolySheetItemSheet extends foundry.appv1.sheets.ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["holysheet", "hs-theme-cuir", "sheet", "item"],
      popOut: true,
      minimizable: true,
      resizable: true,
      width: 560,
      height: 480
    });
  }

  get template() {
    return `systems/holysheet/templates/item/${this.item.type}-sheet.hbs`;
  }

  async getData(options = {}) {
    const context = await super.getData(options);
    context.system = this.item.system;
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

  activateListeners(html) {
    super.activateListeners(html);
    html.find("[data-item-category]").on("change", (event) => {
      const showArmor = this.#isArmorCategory(event.currentTarget.value);
      html.find("[data-armor-value-field]").toggleClass("hs-hidden-field", !showArmor);
    });
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

import { SYSTEM_ID, clampPercent, getHolySheetWorldConfig, normalizeConfigKey } from "../config.mjs";
import { rollD100 } from "../rolls.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class HolySheetActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  _gmConfigMode = false;
  _scrollMemory = null;
  _collapsedConfigSections = new Set();
  _activeTab = "bio";

  static DEFAULT_OPTIONS = {
    classes: ["holysheet", "hs-theme-cuir", "sheet", "actor"],
    form: {
      closeOnSubmit: false,
      handler: this.#onSubmit,
      submitOnChange: true
    },
    position: {
      width: 920,
      height: 820
    },
    tag: "form",
    window: {
      resizable: true
    }
  };

  static PARTS = {
    body: {
      template: "systems/holysheet/templates/actor/character-sheet-0.1.8.hbs",
      scrollable: [""]
    }
  };

  get actor() {
    return this.document;
  }

  get title() {
    return this.actor.name;
  }

  get template() {
    return `systems/holysheet/templates/actor/${this.actor.type}-sheet-0.1.8.hbs`;
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
    const system = this.actor.system;
    const world = getHolySheetWorldConfig();
    const modules = world.sheetModules ?? {};
    const isGM = Boolean(game.user?.isGM);
    const canConfigure = isGM && this._gmConfigMode;
    const tabs = {
      bio: modules.biography !== false,
      skills: modules.skillsTab !== false && (modules.commonSkills !== false || modules.specialSkills !== false),
      inventory: modules.inventoryTab !== false && (modules.inventory !== false || modules.currency !== false),
      config: canConfigure
    };

    context.system = system;
    context.actor = this.actor;
    context.cssClass = "";
    context.hs = {
      modules,
      tabs,
      isGM,
      canConfigure,
      gmConfigMode: this._gmConfigMode,
      config: {
        ...world,
        currencies: this.#prepareCurrencyConfig(world.currencies),
        customStates: this.#prepareStateConfig(world.customStates)
      },
      configSections: this.#prepareConfigSections(),
      nameSize: this.#getNameSize(this.actor.name),
      moduleToggles: this.#prepareModuleToggles(modules),
      portrait: this.#preparePortrait(system),
      armorTotal: this.#getArmorTotal(),
      aptitudes: this.#prepareAptitudes(world.aptitudes, system),
      commonSkills: this.#prepareCommonSkills(world.commonSkills, system),
      specialSkills: this.#prepareSpecialSkills(system),
      currencies: this.#prepareCurrencies(world.currencies, system),
      customStates: this.#prepareCustomStates(world.customStates, system),
      inventoryGroups: this.#prepareInventoryGroups(world.itemCategories, world.currencies),
      categories: world.itemCategories,
      isCharacter: this.actor.type === "character",
      isNpc: this.actor.type === "npc"
    };

    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.#activateTabs();
    this.#activateListeners();
    this.#restoreScrollPosition();
  }

  static async #onSubmit(event, form, formData) {
    const submitData = this._prepareSubmitData(event, form, formData);
    await this.actor.update(submitData);
  }

  _prepareSubmitData(_event, _form, formData) {
    const expanded = foundry.utils.expandObject(formData.object);
    const specialSkills = expanded.system?.specialSkills;

    if (typeof expanded.name === "string") {
      expanded.name = expanded.name.replace(/\s*\n+\s*/g, " ").trim();
    }

    if (specialSkills && !Array.isArray(specialSkills)) {
      expanded.system.specialSkills = Object.values(specialSkills);
    }

    return foundry.utils.flattenObject(expanded);
  }

  #activateListeners() {
    const html = this.element;
    if (!html) return;

    html.addEventListener("input", () => this.#captureScrollPosition(), { capture: true });
    html.addEventListener("change", () => this.#captureScrollPosition(), { capture: true });

    this.#on([
      "[data-add-config-entry]",
      "[data-delete-config-entry]",
      "[data-add-category]",
      "[data-delete-category]",
      "[data-add-state]",
      "[data-delete-state]",
      "[data-add-currency]",
      "[data-delete-currency]",
      "[data-create-special-skill]",
      "[data-edit-special-skill]",
      "[data-delete-special-skill]",
      "[data-create-equipment]",
      "[data-toggle-equipment]",
      "[data-adjust-quantity]",
      "[data-delete-equipment]",
      "[data-open-currency-adjustment]",
      "[data-normalize-currencies]",
      "[data-pick-currency-icon]",
      "[data-pick-state-icon]",
      "[data-toggle-state]"
    ].join(", "), "click", (event) => {
      event.preventDefault();
      if (event.currentTarget.closest?.("summary")) event.stopPropagation();
      this.#captureScrollPosition();
    });

    this.#on([
      "[data-config-toggle]",
      "[data-config-list]",
      "[data-portrait-control]",
      "[data-category-index]",
      "[data-state-index]",
      "[data-state-value]",
      "[data-currency-index]"
    ].join(", "), "change", () => this.#captureScrollPosition());

    this.#on("[data-roll]", "click", (event) => this.#onRoll(event));
    this.#on("[data-roll]", "contextmenu", (event) => this.#onRollModifier(event));
    this.#on("[data-item-id]", "click", (event) => this.#openEmbeddedItem(event));
    this.#on("[data-gm-config-mode]", "change", (event) => this.#toggleGmConfigMode(event));
    this.#on("[data-config-toggle]", "change", (event) => this.#updateModuleToggle(event));
    this.#on("[data-config-list]", "change", (event) => this.#updateConfigList(event));
    this.#on("[data-add-config-entry]", "click", (event) => this.#addConfigEntry(event));
    this.#on("[data-delete-config-entry]", "click", (event) => this.#deleteConfigEntry(event));
    this.#on("[data-portrait-control]", "change", (event) => this.#updatePortraitCrop(event));
    this.#on("[data-category-index]", "change", (event) => this.#updateCategory(event));
    this.#on("[data-add-category]", "click", () => this.#addCategory());
    this.#on("[data-delete-category]", "click", (event) => this.#deleteCategory(event));
    this.#on("[data-state-index]", "change", (event) => this.#updateConfiguredState(event));
    this.#on("[data-add-state]", "click", () => this.#addConfiguredState());
    this.#on("[data-delete-state]", "click", (event) => this.#deleteConfiguredState(event));
    this.#on("[data-config-section]", "toggle", (event) => this.#toggleConfigSection(event));
    this.#on("[data-currency-index]", "change", (event) => this.#updateCurrencyConfig(event));
    this.#on("[data-add-currency]", "click", () => this.#addCurrency());
    this.#on("[data-delete-currency]", "click", (event) => this.#deleteCurrency(event));
    this.#on("[data-pick-currency-icon]", "click", (event) => this.#pickCurrencyIcon(event));
    this.#on("[data-pick-state-icon]", "click", (event) => this.#pickStateIcon(event));

    if (!this.isEditable) return;

    this.#on("[data-edit='img']", "click", (event) => this.#editImage(event));
    this.#on("[data-create-special-skill]", "click", () => this.#createSpecialSkill());
    this.#on("[data-edit-special-skill]", "click", (event) => this.#editSpecialSkill(event));
    this.#on("[data-delete-special-skill]", "click", (event) => this.#deleteSpecialSkill(event));
    this.#on("[data-create-equipment]", "click", () => this.#createEquipment());
    this.#on("[data-toggle-equipment]", "click", (event) => this.#toggleEquipment(event));
    this.#on("[data-adjust-quantity]", "click", (event) => this.#adjustEquipmentQuantity(event));
    this.#on("[data-delete-equipment]", "click", (event) => this.#deleteEquipment(event));
    this.#on("[data-open-currency-adjustment]", "click", () => this.#showCurrencyAdjustmentDialog());
    this.#on("[data-normalize-currencies]", "click", () => this.#normalizeCurrencies());
    this.#on("[data-toggle-state]", "click", (event) => this.#toggleCustomState(event));
    this.#on("[data-edit-number]", "click", (event) => this.#editNumberField(event));
    this.#on("[data-state-value]", "input", (event) => this.#previewCustomStateGauge(event));
    this.#on("[data-state-value]", "change", (event) => this.#updateCustomStateValue(event));
  }

  #on(selector, eventName, handler) {
    this.element.querySelectorAll(selector).forEach((element) => {
      element.addEventListener(eventName, handler);
    });
  }

  #activateTabs() {
    const tabs = Array.from(this.element.querySelectorAll(".sheet-tabs [data-tab]"));
    const panels = Array.from(this.element.querySelectorAll(".tab[data-tab]"));
    const available = tabs.map((tab) => tab.dataset.tab);
    if (!available.includes(this._activeTab)) this._activeTab = available[0] ?? this._activeTab;

    const setActive = (tabId) => {
      this._activeTab = tabId;
      tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === tabId));
      panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.tab === tabId));
    };

    tabs.forEach((tab) => {
      tab.addEventListener("click", (event) => {
        event.preventDefault();
        setActive(tab.dataset.tab);
      });
    });
    setActive(this._activeTab);
  }

  #editImage(event) {
    event.preventDefault();
    const field = event.currentTarget.dataset.edit;
    if (!field) return;

    new FilePicker({
      type: "image",
      current: foundry.utils.getProperty(this.actor, field),
      callback: (path) => this.actor.update({ [field]: path })
    }).render(true);
  }

  #prepareModuleToggles(modules) {
    return [
      { key: "biography", label: "Onglet Bio", enabled: modules.biography !== false },
      { key: "skillsTab", label: "Onglet Competences", enabled: modules.skillsTab !== false },
      { key: "inventoryTab", label: "Onglet Inventaire", enabled: modules.inventoryTab !== false },
      { key: "aptitudes", label: "Aptitudes", enabled: modules.aptitudes !== false },
      { key: "commonSkills", label: "Competences communes", enabled: modules.commonSkills !== false },
      { key: "specialSkills", label: "Competences speciales", enabled: modules.specialSkills !== false },
      { key: "resources", label: "PV", enabled: modules.resources !== false },
      { key: "armor", label: "Armure", enabled: modules.armor !== false },
      { key: "customStates", label: "Etats / jauges custom", enabled: modules.customStates !== false },
      { key: "inventory", label: "Inventaire", enabled: modules.inventory !== false },
      { key: "currency", label: "Monnaie", enabled: modules.currency !== false },
      { key: "level", label: "Niveau", enabled: modules.level === true }
    ];
  }

  #prepareConfigSections() {
    return {
      modules: !this._collapsedConfigSections.has("modules"),
      aptitudes: !this._collapsedConfigSections.has("aptitudes"),
      commonSkills: !this._collapsedConfigSections.has("commonSkills"),
      categories: !this._collapsedConfigSections.has("categories"),
      states: !this._collapsedConfigSections.has("states"),
      currencies: !this._collapsedConfigSections.has("currencies")
    };
  }

  #getNameSize(name) {
    const length = String(name ?? "").length;
    if (length > 42) return "tiny";
    if (length > 30) return "long";
    if (length > 20) return "medium";
    return "short";
  }

  #preparePortrait(system) {
    const x = clampNumber(system.portrait?.x, 0, 100, 50);
    const y = clampNumber(system.portrait?.y, 0, 100, 35);
    const scale = clampNumber(system.portrait?.scale, 1, 2.5, 1);
    const translateX = (50 - x) * (scale - 1);
    const translateY = (50 - y) * (scale - 1);

    return {
      x,
      y,
      scale,
      style: `object-position: ${x}% ${y}%; transform-origin: center; transform: translate(${translateX}%, ${translateY}%) scale(${scale});`
    };
  }

  #getArmorTotal() {
    return this.actor.items
      .filter((item) => item.type === "equipment")
      .reduce((total, item) => {
        if (!item.system.equipped) return total;
        return total + Math.max(0, Number(item.system.armorValue ?? 0));
      }, 0);
  }

  #prepareAptitudes(configuredAptitudes = [], system) {
    return configuredAptitudes.map((aptitude) => {
      const stored = system.aptitudeValues?.[aptitude.key];
      const value = clampPercent(stored?.value ?? aptitude.value ?? 30);
      const modifier = Number(system.rollModifiers?.aptitude?.[aptitude.key] ?? 0);

      return {
        ...aptitude,
        value,
        modifier,
        field: `system.aptitudeValues.${aptitude.key}.value`
      };
    });
  }

  #prepareCommonSkills(configuredSkills = [], system) {
    return configuredSkills.map((skill) => {
      const stored = system.commonSkillValues?.[skill.key];
      const value = clampPercent(stored?.value ?? skill.value ?? 30);
      const modifier = Number(system.rollModifiers?.commonSkill?.[skill.key] ?? 0);

      return {
        ...skill,
        value,
        modifier,
        field: `system.commonSkillValues.${skill.key}.value`
      };
    });
  }

  #prepareSpecialSkills(system) {
    return (system.specialSkills ?? []).map((skill, index) => ({
      ...skill,
      index,
      value: clampPercent(skill.value ?? 30),
      modifier: Number(system.rollModifiers?.specialSkill?.[skill.id] ?? 0)
    }));
  }

  #prepareCurrencies(configuredCurrencies = [], system) {
    return configuredCurrencies.map((currency) => ({
      ...currency,
      amount: Number(system.currencies?.[currency.key]?.amount ?? currency.amount ?? 0),
      field: `system.currencies.${currency.key}.amount`
    }));
  }

  #prepareCurrencyConfig(configuredCurrencies = []) {
    return configuredCurrencies.map((currency, index) => ({
      ...currency,
      index,
      amount: Number(currency.amount ?? 0),
      rate: Number(currency.rate ?? 0),
      relationChoices: configuredCurrencies
        .filter((candidate) => candidate.key !== currency.key)
        .map((candidate) => ({
          key: candidate.key,
          label: candidate.label,
          selected: candidate.key === currency.equivalentTo
        }))
    }));
  }

  #prepareCustomStates(configuredStates = [], system) {
    return configuredStates.map((state) => {
      const stored = system.customStates?.[state.key] ?? {};
      const isCheckbox = state.type === "checkbox";
      const max = Number(stored.max ?? state.max ?? 0);
      const value = Number(stored.value ?? state.value ?? 0);
      const color = state.color || "#d8b55f";
      return {
        ...state,
        isCheckbox,
        isGauge: !isCheckbox,
        icon: state.icon || "icons/svg/aura.svg",
        color,
        hasName: Boolean(String(state.name ?? "").trim()),
        value,
        max,
        percent: max > 0 ? Math.min(100, Math.max(0, Math.round((value / max) * 100))) : 0,
        checked: Boolean(stored.checked ?? false),
        valueField: `system.customStates.${state.key}.value`,
        maxField: `system.customStates.${state.key}.max`,
        checkedField: `system.customStates.${state.key}.checked`
      };
    }).sort((left, right) => Number(right.isGauge) - Number(left.isGauge));
  }

  #prepareStateConfig(configuredStates = []) {
    return configuredStates.map((state) => {
      const isCheckbox = state.type === "checkbox";
      return {
        ...state,
        icon: state.icon || "icons/svg/aura.svg",
        color: state.color || "#d8b55f",
        isCheckbox,
        isGauge: !isCheckbox,
        value: state.value ?? 0,
        max: state.max ?? 10
      };
    });
  }

  #prepareInventoryGroups(categories = [], currencies = []) {
    const groups = new Map();

    for (const item of this.actor.items.filter((item) => item.type === "equipment")) {
      const category = item.system.category || "Divers";
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push({
        id: item.id,
        img: item.img,
        name: item.name,
        system: item.system,
        priceLabel: this.#formatItemPrice(item.system, currencies)
      });
    }

    return Array.from(groups, ([category, items]) => ({ category, items }))
      .sort((left, right) => {
        const leftIndex = categories.indexOf(left.category);
        const rightIndex = categories.indexOf(right.category);
        if (leftIndex === -1 && rightIndex === -1) return left.category.localeCompare(right.category);
        if (leftIndex === -1) return 1;
        if (rightIndex === -1) return -1;
        return leftIndex - rightIndex;
      });
  }

  #formatItemPrice(system, currencies = []) {
    const prices = system.prices ?? {};
    const parts = currencies
      .map((currency) => {
        const amount = Number(prices[currency.key]?.amount ?? 0);
        return amount > 0 ? `${amount} ${currency.label}` : "";
      })
      .filter(Boolean);

    if (parts.length) return parts.join(", ");
    return typeof system.price === "string" ? system.price : "";
  }

  async #onRoll(event) {
    event.preventDefault();
    const dataset = event.currentTarget.dataset;
    await rollD100({
      actor: this.actor,
      label: dataset.rollLabel,
      target: Number(dataset.rollTarget),
      modifier: Number(dataset.rollModifier ?? 0)
    });
  }

  #onRollModifier(event) {
    event.preventDefault();
    if (!this.isEditable) return;

    const dataset = event.currentTarget.dataset;
    const group = dataset.rollGroup;
    const key = dataset.rollKey;
    if (!group || !key) return;

    const current = Number(dataset.rollModifier ?? 0);
    const title = `Modificateur - ${escapeHTML(dataset.rollLabel)}`;
    const content = `
      <form>
        <div class="form-group">
          <label>Bonus / malus applique a la cible</label>
          <input type="number" name="modifier" value="${current}" step="1" />
        </div>
      </form>
    `;

    new Dialog({
      title,
      content,
      buttons: {
        save: {
          icon: '<i class="fa-solid fa-check"></i>',
          label: "Enregistrer",
          callback: (html) => {
            const modifier = Number(html.find("[name='modifier']").val()) || 0;
            this.actor.update({ [`system.rollModifiers.${group}.${key}`]: modifier });
          }
        },
        clear: {
          icon: '<i class="fa-solid fa-xmark"></i>',
          label: "Retirer",
          callback: () => this.actor.update({ [`system.rollModifiers.${group}.${key}`]: 0 })
        }
      },
      default: "save"
    }).render(true);
  }

  #editNumberField(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!this.isEditable) return;

    const dataset = event.currentTarget.dataset;
    const field = dataset.editNumber;
    if (!field) return;

    const min = Number(dataset.editMin ?? 0);
    const rawMax = Number(dataset.editMax);
    const max = Number.isFinite(rawMax) ? rawMax : Number.POSITIVE_INFINITY;
    const current = Number(foundry.utils.getProperty(this.actor, field));
    const fallback = Number.isFinite(current) ? current : Number(event.currentTarget.textContent?.trim() ?? min);
    const value = clampNumber(fallback, min, max, min);
    const label = escapeHTML(dataset.editLabel ?? "Valeur");
    const maxAttribute = Number.isFinite(max) ? ` max="${max}"` : "";
    const content = `
      <form>
        <div class="form-group">
          <label>${label}</label>
          <input type="number" name="value" value="${value}" min="${min}"${maxAttribute} step="1" autofocus />
        </div>
      </form>
    `;

    new Dialog({
      title: `Modifier ${label}`,
      content,
      buttons: {
        save: {
          icon: '<i class="fa-solid fa-check"></i>',
          label: "Valider",
          callback: async (html) => {
            const input = html[0].querySelector("[name='value']");
            const next = clampNumber(input?.value, min, max, value);
            await this.actor.update({ [field]: next });
          }
        }
      },
      default: "save"
    }).render(true);
  }

  async #createSpecialSkill() {
    await this.#showSpecialSkillDialog();
  }

  async #editSpecialSkill(event) {
    const id = event.currentTarget.dataset.editSpecialSkill;
    const skill = (this.actor.system.specialSkills ?? []).find((entry) => entry.id === id);
    if (!skill) return;

    await this.#showSpecialSkillDialog(skill);
  }

  async #showSpecialSkillDialog(skill = null) {
    const isEditing = Boolean(skill);
    const title = isEditing ? "Modifier une competence speciale" : "Nouvelle competence speciale";
    const content = `
      <form>
        <div class="form-group">
          <label>Nom</label>
          <input type="text" name="name" value="${escapeHTML(skill?.name ?? "Nouvelle competence")}" />
        </div>
        <div class="form-group">
          <label>Valeur</label>
          <input type="number" name="value" value="${clampPercent(skill?.value ?? 30)}" min="1" max="100" />
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea name="description" rows="4">${escapeHTML(skill?.description ?? "")}</textarea>
        </div>
      </form>
    `;

    new Dialog({
      title,
      content,
      buttons: {
        save: {
          icon: '<i class="fa-solid fa-check"></i>',
          label: "Valider",
          callback: async (html) => {
            const form = html[0].querySelector("form");
            const formData = new FormData(form);
            const entry = {
              id: skill?.id ?? foundry.utils.randomID(),
              name: String(formData.get("name") || "Nouvelle competence"),
              description: String(formData.get("description") || ""),
              value: clampPercent(formData.get("value") ?? 30)
            };

            const skills = foundry.utils.deepClone(this.actor.system.specialSkills ?? []);
            const index = skills.findIndex((candidate) => candidate.id === entry.id);
            if (index >= 0) skills[index] = entry;
            else skills.push(entry);

            await this.actor.update({ "system.specialSkills": skills });
          }
        }
      },
      default: "save"
    }).render(true);
  }

  async #deleteSpecialSkill(event) {
    const id = event.currentTarget.dataset.deleteSpecialSkill;
    const skills = (this.actor.system.specialSkills ?? []).filter((skill) => skill.id !== id);
    await this.actor.update({ "system.specialSkills": skills });
  }

  async #createEquipment() {
    const [item] = await this.actor.createEmbeddedDocuments("Item", [
      {
        name: "Nouvel objet",
        type: "equipment",
        img: "icons/svg/item-bag.svg",
        system: {
          category: getHolySheetWorldConfig().itemCategories?.[0] ?? "Divers",
          quantity: 1
        }
      }
    ]);

    item?.sheet?.render({ force: true });
  }

  async #toggleEquipment(event) {
    const item = this.actor.items.get(event.currentTarget.dataset.toggleEquipment);
    if (!item) return;
    if (!item.system.equipable) return;
    await item.update({ "system.equipped": !item.system.equipped });
  }

  async #adjustEquipmentQuantity(event) {
    const item = this.actor.items.get(event.currentTarget.dataset.adjustQuantity);
    if (!item) return;

    const delta = Number(event.currentTarget.dataset.delta) || 0;
    const quantity = Math.max(0, Number(item.system.quantity ?? 0) + delta);
    await item.update({ "system.quantity": quantity });
  }

  #openEmbeddedItem(event) {
    const item = this.actor.items.get(event.currentTarget.dataset.itemId);
    item?.sheet?.render({ force: true });
  }

  #toggleGmConfigMode(event) {
    if (!game.user?.isGM) return;

    this._gmConfigMode = event.currentTarget.checked;
    this.render({ force: false });
  }

  #toggleConfigSection(event) {
    const key = event.currentTarget.dataset.configSection;
    if (!key) return;

    if (event.currentTarget.open) this._collapsedConfigSections.delete(key);
    else this._collapsedConfigSections.add(key);
  }

  async #updateModuleToggle(event) {
    if (!game.user?.isGM) return;

    const modules = getHolySheetWorldConfig().sheetModules;
    modules[event.currentTarget.dataset.configToggle] = event.currentTarget.checked;
    await game.settings.set(SYSTEM_ID, "sheetModules", modules);
    this.render({ force: false });
  }

  async #updatePortraitCrop(event) {
    if (!this.isEditable) return;

    const input = event.currentTarget;
    const field = input.dataset.portraitControl;
    const value = field === "scale"
      ? clampNumber(input.value, 1, 2.5, 1)
      : clampNumber(input.value, 0, 100, 50);

    await this.actor.update({ [`system.portrait.${field}`]: value });
  }

  async #updateConfigList(event) {
    if (!game.user?.isGM) return;

    const input = event.currentTarget;
    const setting = input.dataset.configList;
    const index = Number(input.dataset.index);
    const field = input.dataset.field;
    const entries = getHolySheetWorldConfig()[setting];
    if (!Array.isArray(entries) || !entries[index] || !field) return;

    entries[index][field] = field === "value" ? clampPercent(input.value) : input.value;
    await game.settings.set(SYSTEM_ID, setting, entries);
    this.render({ force: false });
  }

  async #updateCategory(event) {
    if (!game.user?.isGM) return;

    const index = Number(event.currentTarget.dataset.categoryIndex);
    const categories = getHolySheetWorldConfig().itemCategories;
    if (!Array.isArray(categories) || !categories[index]) return;

    categories[index] = String(event.currentTarget.value || "Nouvelle categorie");
    await game.settings.set(SYSTEM_ID, "itemCategories", categories);
    this.render({ force: false });
  }

  async #addCategory() {
    if (!game.user?.isGM) return;

    const categories = getHolySheetWorldConfig().itemCategories;
    categories.push("Nouvelle categorie");
    await game.settings.set(SYSTEM_ID, "itemCategories", categories);
    this.render({ force: false });
  }

  async #deleteCategory(event) {
    if (!game.user?.isGM) return;

    const index = Number(event.currentTarget.dataset.deleteCategory);
    const categories = getHolySheetWorldConfig().itemCategories;
    if (!Array.isArray(categories) || !categories[index]) return;
    if (categories.length <= 1) {
      ui.notifications.warn("Il doit rester au moins une categorie.");
      return;
    }

    categories.splice(index, 1);
    await game.settings.set(SYSTEM_ID, "itemCategories", categories);
    this.render({ force: false });
  }

  async #updateConfiguredState(event) {
    if (!game.user?.isGM) return;

    const input = event.currentTarget;
    const index = Number(input.dataset.stateIndex);
    const field = input.dataset.field;
    const states = getHolySheetWorldConfig().customStates;
    if (!Array.isArray(states) || !states[index] || !field) return;

    states[index][field] = ["value", "max"].includes(field) ? Number(input.value) || 0 : input.value;
    await game.settings.set(SYSTEM_ID, "customStates", states);
    this.render({ force: false });
  }

  async #pickStateIcon(event) {
    if (!game.user?.isGM) return;

    const index = Number(event.currentTarget.dataset.pickStateIcon);
    const states = getHolySheetWorldConfig().customStates;
    if (!Array.isArray(states) || !states[index]) return;

    const picker = new FilePicker({
      type: "image",
      current: states[index].icon,
      callback: async (path) => {
        this.#captureScrollPosition();
        states[index].icon = path;
        await game.settings.set(SYSTEM_ID, "customStates", states);
        this.render({ force: false });
      }
    });

    picker.render(true);
  }

  async #toggleCustomState(event) {
    const key = event.currentTarget.dataset.toggleState;
    if (!key) return;

    const current = Boolean(this.actor.system.customStates?.[key]?.checked);
    await this.actor.update({ [`system.customStates.${key}.checked`]: !current });
  }

  #previewCustomStateGauge(event) {
    const input = event.currentTarget;
    const min = Number(input.min || 0);
    const max = Number(input.max || 0);
    const value = Number(input.value || 0);
    const percent = max > min ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0;
    input.closest(".hs-state-gauge")?.style.setProperty("--hs-state-fill", `${percent}%`);
  }

  async #updateCustomStateValue(event) {
    const input = event.currentTarget;
    const key = input.dataset.stateValue;
    if (!key) return;

    await this.actor.update({ [`system.customStates.${key}.value`]: Number(input.value) || 0 });
  }

  async #updateCurrencyConfig(event) {
    if (!game.user?.isGM) return;

    const input = event.currentTarget;
    const index = Number(input.dataset.currencyIndex);
    const field = input.dataset.field;
    const currencies = getHolySheetWorldConfig().currencies;
    if (!Array.isArray(currencies) || !currencies[index] || !field) return;

    if (field === "key") currencies[index][field] = normalizeConfigKey(input.value, "monnaie");
    else if (["amount", "rate"].includes(field)) currencies[index][field] = Math.max(0, Number(input.value) || 0);
    else currencies[index][field] = input.value;

    await game.settings.set(SYSTEM_ID, "currencies", currencies);
    this.render({ force: false });
  }

  async #pickCurrencyIcon(event) {
    if (!game.user?.isGM) return;

    const index = Number(event.currentTarget.dataset.pickCurrencyIcon);
    const currencies = getHolySheetWorldConfig().currencies;
    if (!Array.isArray(currencies) || !currencies[index]) return;

    const picker = new FilePicker({
      type: "image",
      current: currencies[index].icon,
      callback: async (path) => {
        this.#captureScrollPosition();
        currencies[index].icon = path;
        await game.settings.set(SYSTEM_ID, "currencies", currencies);
        this.render({ force: false });
      }
    });

    picker.render(true);
  }

  async #addCurrency() {
    if (!game.user?.isGM) return;

    const currencies = getHolySheetWorldConfig().currencies;
    const label = "Nouvelle monnaie";
    currencies.push({
      key: normalizeConfigKey(`${label}-${foundry.utils.randomID(4)}`, "monnaie"),
      label,
      icon: "icons/commodities/currency/coins-assorted-mix-copper.webp",
      amount: 0,
      equivalentTo: "",
      rate: 0
    });

    await game.settings.set(SYSTEM_ID, "currencies", currencies);
    this.render({ force: false });
  }

  async #deleteCurrency(event) {
    if (!game.user?.isGM) return;

    const index = Number(event.currentTarget.dataset.deleteCurrency);
    const currencies = getHolySheetWorldConfig().currencies;
    if (!Array.isArray(currencies) || !currencies[index]) return;
    if (currencies.length <= 1) {
      ui.notifications.warn("Il doit rester au moins une monnaie.");
      return;
    }

    const deletedKey = currencies[index].key;
    currencies.splice(index, 1);
    for (const currency of currencies) {
      if (currency.equivalentTo === deletedKey) currency.equivalentTo = "";
    }

    await game.settings.set(SYSTEM_ID, "currencies", currencies);
    this.render({ force: false });
  }

  async #showCurrencyAdjustmentDialog() {
    if (!this.isEditable) return;

    const currencies = this.#prepareCurrencies(getHolySheetWorldConfig().currencies, this.actor.system);
    if (!currencies.length) {
      ui.notifications.warn("Aucune monnaie n'est configuree.");
      return;
    }

    const rows = currencies.map((currency) => `
      <label class="hs-currency-dialog-row">
        <span>${escapeHTML(currency.label)}</span>
        <input type="number" name="${escapeHTML(currency.key)}" value="0" min="0" step="1" />
      </label>
    `).join("");

    const content = `
      <form class="hs-currency-dialog">
        <div class="form-group">
          <label>Operation</label>
          <select name="operation">
            <option value="subtract">Soustraction</option>
            <option value="add">Addition</option>
          </select>
        </div>
        ${rows}
      </form>
    `;

    new Dialog({
      title: "Modifier la monnaie",
      content,
      buttons: {
        apply: {
          icon: '<i class="fa-solid fa-coins"></i>',
          label: "Appliquer",
          callback: async (html) => {
            const form = html[0].querySelector("form");
            const formData = new FormData(form);
            const update = this.#getCurrencyAdjustmentUpdate(currencies, formData, formData.get("operation"));

            if (!update) {
              ui.notifications.warn("Fonds insuffisants pour cette soustraction.");
              return;
            }

            this.#captureScrollPosition();
            await this.actor.update(update);
          }
        }
      },
      default: "apply"
    }).render(true);
  }

  async #normalizeCurrencies() {
    if (!this.isEditable) return;

    const currencies = this.#prepareCurrencies(getHolySheetWorldConfig().currencies, this.actor.system);
    const update = {};

    for (const component of this.#getCurrencyComponents(currencies)) {
      if (component.length <= 1) continue;
      const weights = this.#getCurrencyWeights(component);
      const total = this.#getCurrencyTotal(component, weights);
      Object.assign(update, this.#getCurrencyUpdateFromTotal(component, weights, total));
    }

    if (!Object.keys(update).length) {
      ui.notifications.info("Aucune monnaie liee a convertir.");
      return;
    }

    this.#captureScrollPosition();
    await this.actor.update(update);
  }

  async #addConfiguredState() {
    if (!game.user?.isGM) return;

    const states = getHolySheetWorldConfig().customStates;
    const label = "Nouvel etat";
    states.push({
      key: normalizeConfigKey(`${label}-${foundry.utils.randomID(4)}`, "etat"),
      name: label,
      icon: "icons/svg/aura.svg",
      color: "#d8b55f",
      description: "",
      type: "gauge",
      value: 0,
      max: 10
    });

    await game.settings.set(SYSTEM_ID, "customStates", states);
    this.render({ force: false });
  }

  async #deleteConfiguredState(event) {
    if (!game.user?.isGM) return;

    const index = Number(event.currentTarget.dataset.deleteState);
    const states = getHolySheetWorldConfig().customStates;
    if (!Array.isArray(states) || !states[index]) return;

    states.splice(index, 1);
    await game.settings.set(SYSTEM_ID, "customStates", states);
    this.render({ force: false });
  }

  async #addConfigEntry(event) {
    if (!game.user?.isGM) return;

    const setting = event.currentTarget.dataset.addConfigEntry;
    const entries = getHolySheetWorldConfig()[setting];
    if (!Array.isArray(entries)) return;

    const isAptitude = setting === "aptitudes";
    const maxEntries = isAptitude ? 10 : 100;
    if (entries.length >= maxEntries) {
      ui.notifications.warn(`Maximum atteint: ${maxEntries}.`);
      return;
    }

    const label = isAptitude ? "Nouvelle aptitude" : "Nouvelle competence";
    entries.push({
      key: normalizeConfigKey(`${label}-${foundry.utils.randomID(4)}`, isAptitude ? "aptitude" : "competence"),
      label,
      abbreviation: isAptitude ? "NEW" : "",
      value: 30,
      description: ""
    });

    await game.settings.set(SYSTEM_ID, setting, entries);
    this.render({ force: false });
  }

  async #deleteConfigEntry(event) {
    if (!game.user?.isGM) return;

    const setting = event.currentTarget.dataset.deleteConfigEntry;
    const index = Number(event.currentTarget.dataset.index);
    const entries = getHolySheetWorldConfig()[setting];
    if (!Array.isArray(entries) || !entries[index]) return;
    if (entries.length <= 1) {
      ui.notifications.warn("Il doit rester au moins une entree.");
      return;
    }

    entries.splice(index, 1);
    await game.settings.set(SYSTEM_ID, setting, entries);
    this.render({ force: false });
  }

  async #deleteEquipment(event) {
    const item = this.actor.items.get(event.currentTarget.dataset.deleteEquipment);
    if (!item) return;
    await item.delete();
  }

  #captureScrollPosition() {
    const element = this.element;
    if (!element) return;

    this._scrollMemory = {
      windowContent: element.querySelector(".window-content")?.scrollTop ?? 0,
      sheet: element.querySelector(".holysheet-character, .holysheet-npc")?.scrollTop ?? 0,
      body: element.querySelector(".sheet-body")?.scrollTop ?? 0
    };
  }

  #restoreScrollPosition() {
    if (!this._scrollMemory) return;

    const memory = this._scrollMemory;
    window.requestAnimationFrame(() => {
      const element = this.element;
      element?.querySelector(".window-content")?.scrollTo({ top: memory.windowContent });
      element?.querySelector(".holysheet-character, .holysheet-npc")?.scrollTo({ top: memory.sheet });
      element?.querySelector(".sheet-body")?.scrollTo({ top: memory.body });
      this._scrollMemory = null;
    });
  }

  #getCurrencyWeights(currencies) {
    const weights = Object.fromEntries(currencies.map((currency) => [currency.key, 1]));

    for (let pass = 0; pass < currencies.length; pass += 1) {
      for (const currency of currencies) {
        const rate = Number(currency.rate ?? 0);
        const parent = currency.equivalentTo;
        if (!parent || !(parent in weights) || !rate) continue;
        weights[parent] = Math.max(weights[parent], (weights[currency.key] ?? 1) * rate);
      }
    }

    return weights;
  }

  #getCurrencyAdjustmentUpdate(currencies, formData, operation) {
    const update = {};

    for (const component of this.#getCurrencyComponents(currencies)) {
      if (component.length === 1) {
        const currency = component[0];
        const current = Number(currency.amount ?? 0);
        const adjustment = Math.max(0, Number(formData.get(currency.key)) || 0);
        const next = operation === "add" ? current + adjustment : current - adjustment;
        if (next < 0) return null;
        update[`system.currencies.${currency.key}.amount`] = Math.floor(next);
        continue;
      }

      const weights = this.#getCurrencyWeights(component);
      const currentTotal = this.#getCurrencyTotal(component, weights);
      const adjustmentTotal = component.reduce((total, currency) => {
        const amount = Math.max(0, Number(formData.get(currency.key)) || 0);
        return total + (amount * (weights[currency.key] ?? 1));
      }, 0);
      const nextTotal = operation === "add" ? currentTotal + adjustmentTotal : currentTotal - adjustmentTotal;
      if (nextTotal < 0) return null;
      Object.assign(update, this.#getCurrencyUpdateFromTotal(component, weights, nextTotal));
    }

    return update;
  }

  #getCurrencyComponents(currencies) {
    const byKey = new Map(currencies.map((currency) => [currency.key, currency]));
    const links = new Map(currencies.map((currency) => [currency.key, new Set()]));

    for (const currency of currencies) {
      const parent = currency.equivalentTo;
      const rate = Number(currency.rate ?? 0);
      if (!parent || !rate || !byKey.has(parent)) continue;

      links.get(currency.key)?.add(parent);
      links.get(parent)?.add(currency.key);
    }

    const visited = new Set();
    const components = [];

    for (const currency of currencies) {
      if (visited.has(currency.key)) continue;

      const stack = [currency.key];
      const component = [];
      visited.add(currency.key);

      while (stack.length) {
        const key = stack.pop();
        const current = byKey.get(key);
        if (current) component.push(current);

        for (const neighbor of links.get(key) ?? []) {
          if (visited.has(neighbor)) continue;
          visited.add(neighbor);
          stack.push(neighbor);
        }
      }

      components.push(component);
    }

    return components;
  }

  #getCurrencyTotal(currencies, weights) {
    return currencies.reduce((total, currency) => {
      return total + (Number(currency.amount ?? 0) * (weights[currency.key] ?? 1));
    }, 0);
  }

  #getCurrencyUpdateFromTotal(currencies, weights, total) {
    const sorted = [...currencies].sort((a, b) => (weights[b.key] ?? 1) - (weights[a.key] ?? 1));
    const update = {};
    let remaining = Math.max(0, Math.floor(total));

    for (const currency of sorted) {
      const weight = Math.max(1, Math.floor(weights[currency.key] ?? 1));
      const amount = Math.floor(remaining / weight);
      remaining -= amount * weight;
      update[`system.currencies.${currency.key}.amount`] = amount;
    }

    return update;
  }
}

function escapeHTML(value) {
  const element = document.createElement("span");
  element.innerText = String(value ?? "");
  return element.innerHTML;
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

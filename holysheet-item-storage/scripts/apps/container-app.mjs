import { DEFAULT_ICON, FLAGS, MODULE_ID, format, localize } from "../config.mjs";
import { ItemStorageAPI } from "../container-api.mjs";
import { registerApp, unregisterApp } from "./refresh.mjs";
import { containerIcon, documentFromUuidSafe, getContents, isContainerItem, userOwnsActor } from "../utils.mjs";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

export class ContainerApp extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(itemUuid, options = {}) {
    super(options);
    this.itemUuid = itemUuid;
    registerApp(this);
  }

  static DEFAULT_OPTIONS = {
    id: "holysheet-item-storage",
    classes: ["holysheet-item-storage", "hs-theme-lueur"],
    tag: "form",
    window: {
      title: "HIS.WindowTitle",
      icon: "fa-solid fa-box-open",
      resizable: true,
      contentClasses: ["standard-form"]
    },
    position: { width: 620, height: 620 },
    form: {
      handler: ContainerApp.#onSubmit,
      submitOnChange: true,
      closeOnSubmit: false
    },
    actions: {
      takeEntry: ContainerApp.#onTakeEntry,
      removeEntry: ContainerApp.#onRemoveEntry,
      pickIcon: ContainerApp.#onPickIcon
    }
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/container.hbs` }
  };

  get title() {
    return `${localize("HIS.WindowTitle")} - ${this.item?.name ?? ""}`;
  }

  async close(options) {
    unregisterApp(this);
    return super.close(options);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    this.item = await documentFromUuidSafe(this.itemUuid);
    if (!isContainerItem(this.item)) {
      context.missing = true;
      return context;
    }

    const contents = getContents(this.item).map((entry) => ({
      ...entry,
      showQuantity: Number(entry.quantity) > 1
    }));

    return {
      item: this.item,
      isGM: game.user.isGM,
      canTake: contents.length > 0,
      image: containerIcon(this.item),
      defaultIcon: DEFAULT_ICON,
      note: this.item.getFlag(MODULE_ID, FLAGS.NOTE) ?? "",
      contents,
      empty: contents.length === 0
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);

    const dropZone = this.element.querySelector("[data-container-drop]");
    if (dropZone && game.user.isGM) {
      dropZone.addEventListener("dragenter", () => dropZone.classList.add("is-dragover"));
      dropZone.addEventListener("dragleave", () => dropZone.classList.remove("is-dragover"));
      dropZone.addEventListener("dragover", (event) => {
        event.preventDefault();
        dropZone.classList.add("is-dragover");
      });
      dropZone.addEventListener("drop", (event) => this.#onDropItem(event));
    }

    for (const row of this.element.querySelectorAll("[data-entry-id]")) {
      row.setAttribute("draggable", "true");
      row.addEventListener("dragstart", (event) => this.#onDragEntry(event, row));
    }
  }

  async #onDropItem(event) {
    event.preventDefault();
    event.currentTarget?.classList?.remove("is-dragover");
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));
    } catch (_err) {
      return;
    }
    if (data.type !== "Item") return;

    const item = await fromUuid(data.uuid);
    if (!item) return;
    await ItemStorageAPI.addDroppedItem(this.item, item);
    this.render({ force: false });
  }

  #onDragEntry(event, row) {
    const entryId = row.dataset.entryId;
    const entry = getContents(this.item).find((candidate) => candidate.id === entryId);
    if (!entry) return;

    event.dataTransfer.setData("text/plain", JSON.stringify({
      type: "HolySheetItemStorage",
      containerUuid: this.itemUuid,
      entryId,
      name: entry.name,
      img: entry.img
    }));
  }

  static async #onSubmit(event, form, formData) {
    if (!game.user.isGM || !this.item) return;
    const data = foundry.utils.expandObject(formData.object);
    const updates = {};

    if (data.name !== undefined) updates.name = data.name;
    updates[`flags.${MODULE_ID}.${FLAGS.NOTE}`] = data.note ?? "";

    await this.item.update(updates);
  }

  static async #onTakeEntry(event, target) {
    const actor = await chooseTargetActor();
    if (!actor) return;
    await ItemStorageAPI.takeEntry({
      containerUuid: this.itemUuid,
      entryId: target.dataset.entryId,
      actorUuid: actor.uuid,
      amount: 1
    });
  }

  static async #onRemoveEntry(event, target) {
    if (!game.user.isGM) return;
    await ItemStorageAPI.removeEntry(this.item, target.dataset.entryId);
    this.render({ force: false });
  }

  static async #onPickIcon() {
    if (!game.user.isGM || !this.item) return;
    const picker = new foundry.applications.apps.FilePicker.implementation({
      type: "image",
      current: containerIcon(this.item),
      callback: async (path) => {
        await this.item.update({
          img: path,
          [`flags.${MODULE_ID}.${FLAGS.ICON}`]: path
        });
        this.render({ force: false });
      }
    });
    picker.render(true);
  }
}

export async function chooseTargetActor() {
  const controlled = canvas?.tokens?.controlled
    ?.map((token) => token.actor)
    .filter((actor) => userOwnsActor(actor)) ?? [];

  const choices = Array.from(new Map(controlled.map((actor) => [actor.uuid, actor])).values());
  if (choices.length === 1) return choices[0];
  if (choices.length > 1) return chooseActorDialog(choices);

  if (game.user.character && userOwnsActor(game.user.character)) return game.user.character;

  const owned = game.actors.filter((actor) => userOwnsActor(actor));
  if (owned.length === 1) return owned[0];
  if (owned.length > 1) return chooseActorDialog(owned);

  ui.notifications.warn(localize("HIS.NoActor"));
  return null;
}

async function chooseActorDialog(actors) {
  const options = actors
    .map((actor) => `<option value="${actor.uuid}">${foundry.utils.escapeHTML(actor.name)}</option>`)
    .join("");

  const content = `
    <form class="his-actor-choice">
      <label>${localize("HIS.ActorChoice")}</label>
      <select name="actorUuid">${options}</select>
    </form>
  `;

  const uuid = await DialogV2.wait({
    window: { title: localize("HIS.ActorChoiceTitle") },
    content,
    buttons: [
      {
        action: "take",
        label: localize("HIS.Take"),
        icon: "fa-solid fa-hand",
        default: true,
        callback: (_event, button) => button.form.elements.actorUuid.value
      },
      {
        action: "cancel",
        label: localize("HIS.Cancel"),
        icon: "fa-solid fa-xmark",
        callback: () => null
      }
    ]
  });
  return uuid ? documentFromUuidSafe(uuid) : null;
}

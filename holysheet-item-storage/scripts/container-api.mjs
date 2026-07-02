import { FLAGS, MODULE_ID, SOCKET_ACTIONS, format, localize } from "./config.mjs";
import { ItemStorageSocket, responsibleGM } from "./socket.mjs";
import {
  containerIcon,
  decrementEntry,
  documentFromUuidSafe,
  getContents,
  getDefaultItemType,
  isContainerItem,
  itemDataForActor,
  makeContainerSystemData,
  normalizeDroppedItem,
  setContents,
  userOwnsActor
} from "./utils.mjs";

export class ItemStorageAPI {
  static async createContainer() {
    const item = await Item.create({
      name: localize("HIS.NewContainerName"),
      type: getDefaultItemType(),
      img: containerIcon(null),
      system: makeContainerSystemData(),
      flags: {
        [MODULE_ID]: {
          [FLAGS.IS_CONTAINER]: true,
          [FLAGS.CONTENTS]: [],
          [FLAGS.ICON]: containerIcon(null),
          [FLAGS.NOTE]: ""
        }
      }
    });

    const { ContainerApp } = await import("./apps/container-app.mjs");
    new ContainerApp(item.uuid).render({ force: true });
    return item;
  }

  static async convertItem(item) {
    if (!item || !game.user.isGM) return;
    await item.update({
      [`flags.${MODULE_ID}.${FLAGS.IS_CONTAINER}`]: true,
      [`flags.${MODULE_ID}.${FLAGS.CONTENTS}`]: getContents(item),
      [`flags.${MODULE_ID}.${FLAGS.ICON}`]: containerIcon(item),
      [`flags.${MODULE_ID}.${FLAGS.NOTE}`]: item.getFlag(MODULE_ID, FLAGS.NOTE) ?? ""
    });
    ui.notifications.info(format("HIS.Converted", { name: item.name }));
  }

  static async addDroppedItem(container, item) {
    if (!isContainerItem(container) || !item || !game.user.isGM) return;
    const contents = getContents(container);
    contents.push(normalizeDroppedItem(item));
    await setContents(container, contents);
    ItemStorageSocket.emitRefresh({ itemUuid: container.uuid });
  }

  static async removeEntry(container, entryId) {
    if (!isContainerItem(container) || !game.user.isGM) return;
    const contents = getContents(container).filter((entry) => entry.id !== entryId);
    await setContents(container, contents);
    ItemStorageSocket.emitRefresh({ itemUuid: container.uuid });
  }

  static async takeEntry({ containerUuid, entryId, actorUuid, amount = 1 }) {
    try {
      if (game.user.isGM) {
        await this.#applyTakeEntry({ containerUuid, entryId, actorUuid, amount }, game.user.id);
        return;
      }

      if (!responsibleGM()) {
        ui.notifications.warn(localize("HIS.NoActiveGM"));
        return;
      }
      ItemStorageSocket.emitTakeEntry({ containerUuid, entryId, actorUuid, amount });
    } catch (err) {
      console.error("holysheet-item-storage | takeEntry failed", err);
      ui.notifications.error(format("HIS.ErrorTakeFailedDetail", { message: err.message ?? err }));
    }
  }

  static registerSocketHandlers() {
    ItemStorageSocket.onRequest(SOCKET_ACTIONS.TAKE_ENTRY, (data, userId) => this.#applyTakeEntry(data, userId));
  }

  static async #applyTakeEntry({ containerUuid, entryId, actorUuid, amount = 1 }, userId) {
    const user = game.users.get(userId);
    const container = await documentFromUuidSafe(containerUuid);
    const actor = await documentFromUuidSafe(actorUuid);

    if (!isContainerItem(container)) throw new Error(localize("HIS.InvalidContainer"));
    if (!actor) throw new Error(localize("HIS.NoActor"));
    if (!userOwnsActor(actor, user)) throw new Error(localize("HIS.ActorNotOwned"));

    const contents = getContents(container);
    const index = contents.findIndex((entry) => entry.id === entryId);
    if (index < 0) throw new Error(localize("HIS.EntryNotFound"));

    const entry = contents[index];
    const itemData = itemDataForActor(entry, amount);
    await actor.createEmbeddedDocuments("Item", [itemData]);

    const updatedEntry = decrementEntry(entry, amount);
    if (updatedEntry) contents[index] = updatedEntry;
    else contents.splice(index, 1);

    await setContents(container, contents);
    ItemStorageSocket.emitRefresh({ itemUuid: container.uuid });
  }
}

import { MODULE_ID, SOCKET_ACTIONS, SOCKET_CHANNEL, SOCKET_TYPES, warn } from "./config.mjs";

export function responsibleGM() {
  return game.users
    .filter((user) => user.isGM && user.active)
    .sort((a, b) => a.id.localeCompare(b.id))[0];
}

export function isResponsibleGM() {
  return responsibleGM()?.id === game.user.id;
}

export class ItemStorageSocket {
  static #handlers = new Map();

  static listen() {
    game.socket.on(SOCKET_CHANNEL, (payload) => this.#onMessage(payload));
  }

  static onRequest(action, fn) {
    this.#handlers.set(action, fn);
  }

  static emitTakeEntry(data) {
    this.emitRequest(SOCKET_ACTIONS.TAKE_ENTRY, data);
  }

  static emitRequest(action, data = {}) {
    game.socket.emit(SOCKET_CHANNEL, {
      type: SOCKET_TYPES.REQUEST,
      action,
      data,
      userId: game.user.id
    });
  }

  static emitRefresh(data = {}) {
    game.socket.emit(SOCKET_CHANNEL, {
      type: SOCKET_TYPES.REFRESH,
      data
    });
  }

  static async #onMessage(payload) {
    if (!payload?.type) return;

    if (payload.type === SOCKET_TYPES.REQUEST) {
      if (!isResponsibleGM()) return;
      const handler = this.#handlers.get(payload.action);
      if (!handler) return warn("No handler for socket action", payload.action);

      try {
        await handler(payload.data ?? {}, payload.userId);
      } catch (err) {
        warn("Socket handler failed", payload.action, err);
        ui.notifications.error(game.i18n.localize("HIS.ErrorTakeFailed"));
      }
      return;
    }

    if (payload.type === SOCKET_TYPES.REFRESH) {
      const { refreshContainerApps } = await import("./apps/refresh.mjs");
      const { canvasManager } = await import("./main.mjs");
      refreshContainerApps(payload.data?.itemUuid ?? null);
      canvasManager?.render();
    }
  }
}

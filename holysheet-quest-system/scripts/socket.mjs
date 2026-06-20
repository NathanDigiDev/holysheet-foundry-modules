/**
 * Socket relay.
 *
 * Players cannot write world settings, so any player-initiated change is emitted
 * to the GM, who validates and applies it. The same channel broadcasts banners
 * and refresh pings. Uses the core `game.socket` channel (no extra dependency).
 */

import { MODULE_ID, SOCKET_TYPES, log, warn } from "./config.mjs";

const CHANNEL = `module.${MODULE_ID}`;

/** @returns {User|undefined} The GM who should process relayed requests. */
export function responsibleGM() {
  // The active GM with the lowest id — deterministic across clients so exactly one applies the change.
  return game.users.filter((u) => u.isGM && u.active).sort((a, b) => a.id.localeCompare(b.id))[0];
}

/** @returns {boolean} Whether *this* client is the responsible GM. */
export function isResponsibleGM() {
  return responsibleGM()?.id === game.user.id;
}

export class QuestSocket {
  static #handlers = new Map();

  /** Register the inbound message dispatcher. Call once during `ready`. */
  static listen() {
    game.socket.on(CHANNEL, (payload) => this.#onMessage(payload));
    log("Socket listening on", CHANNEL);
  }

  /**
   * Register a handler for a relayed request action.
   * @param {string} action
   * @param {(data:object, userId:string) => Promise<void>} fn
   */
  static onRequest(action, fn) {
    this.#handlers.set(action, fn);
  }

  static async #onMessage(payload) {
    if (!payload?.type) return;

    switch (payload.type) {
      case SOCKET_TYPES.REQUEST: {
        // Only the responsible GM acts on requests.
        if (!isResponsibleGM()) return;
        const handler = this.#handlers.get(payload.action);
        if (!handler) return warn("No handler for request action", payload.action);
        try {
          await handler(payload.data ?? {}, payload.userId);
        } catch (err) {
          warn("Request handler failed", payload.action, err);
        }
        break;
      }
      case SOCKET_TYPES.BANNER: {
        // Lazy import to avoid a circular dependency at module load.
        const { BannerManager } = await import("./notifications/banners.mjs");
        BannerManager.render(payload.data);
        break;
      }
      case SOCKET_TYPES.REFRESH: {
        const { refreshAllApps } = await import("./apps/refresh.mjs");
        refreshAllApps();
        break;
      }
    }
  }

  /** Player → GM: request a privileged change. */
  static emitRequest(action, data = {}) {
    game.socket.emit(CHANNEL, {
      type: SOCKET_TYPES.REQUEST,
      action,
      data,
      userId: game.user.id
    });
  }

  /** GM → everyone (incl. self): show a banner. */
  static emitBanner(data) {
    game.socket.emit(CHANNEL, { type: SOCKET_TYPES.BANNER, data });
  }

  /** GM → everyone: tell open apps to re-render. */
  static emitRefresh() {
    game.socket.emit(CHANNEL, { type: SOCKET_TYPES.REFRESH });
  }
}

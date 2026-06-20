/**
 * QuestTrackerApp — an MMO-style, always-on overlay listing the quests this user
 * has pinned. It is frameless and semi-transparent, anchored to the canvas, and
 * shows each tracked quest's title + visible objectives (with counts / timers).
 *
 * Pinning is per-user (the `trackedQuests` client setting), so every player curates
 * their own tracker. The app is a singleton and self-hides when nothing is pinned.
 */

import {
  MODULE_ID,
  SETTINGS,
  OBJECTIVE_TYPE
} from "../config.mjs";
import { QuestStore } from "../data/quest-store.mjs";
import { questProgress, isQuestVisibleTo } from "../data/quest-model.mjs";
import { registerApp, unregisterApp } from "./refresh.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class QuestTrackerApp extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {QuestTrackerApp|null} Singleton instance. */
  static #instance = null;

  static DEFAULT_OPTIONS = {
    id: "quest-system-tracker",
    classes: ["quest-system", "quest-tracker"],
    tag: "div",
    // Frameless overlay — positioned entirely via CSS (fixed, top-right).
    window: { frame: false, positioned: false },
    actions: {
      toggleCollapse: QuestTrackerApp.#onToggleCollapse,
      openQuest: QuestTrackerApp.#onOpenQuest
    }
  };

  static PARTS = {
    body: { template: "modules/holysheet-quest-system/templates/quest-tracker.hbs" }
  };

  /* --------------------------------------- Singleton ------------------------------------------- */

  static get instance() {
    if (!this.#instance) this.#instance = new QuestTrackerApp();
    return this.#instance;
  }

  /** Show/refresh the tracker if this user has visible pinned quests; otherwise hide it. */
  static sync() {
    if (this.#trackedVisible().length > 0) this.instance.render({ force: true });
    else if (this.#instance?.rendered) this.#instance.close();
  }

  /** Alias used by the refresh registry / external callers. */
  static refresh() { this.sync(); }

  /** @returns {object[]} Pinned quests that are visible to the current user. */
  static #trackedVisible() {
    const tracked = new Set(game.settings.get(MODULE_ID, SETTINGS.TRACKED_QUESTS) ?? []);
    if (tracked.size === 0) return [];
    return QuestStore.all().filter((q) => tracked.has(q.id) && isQuestVisibleTo(q, game.user));
  }

  constructor(options = {}) {
    super(options);
    registerApp(this);
  }

  async close(options) {
    if (this._countdownTimer) clearInterval(this._countdownTimer);
    unregisterApp(this);
    QuestTrackerApp.#instance = null;
    return super.close(options);
  }

  /* --------------------------------------- Context --------------------------------------------- */

  async _prepareContext(_options) {
    const isGM = game.user.isGM;
    const collapsed = game.settings.get(MODULE_ID, SETTINGS.TRACKER_COLLAPSED) ?? false;

    const quests = QuestTrackerApp.#trackedVisible().map((q) => {
      const objectives = q.objectives
        .filter((o) => isGM || !o.hidden)
        .map((o) => {
          const data = { type: o.type, text: o.text, completed: o.completed };
          if (o.type === OBJECTIVE_TYPE.KILL) data.countLabel = `${o.current ?? 0}/${o.required ?? 1}`;
          if (o.type === OBJECTIVE_TYPE.TIMED) { data.deadline = o.deadline; data.expired = o.expired; }
          return data;
        });
      return { id: q.id, name: q.name, progress: questProgress(q, isGM), objectives };
    });

    return { collapsed, quests, hasQuests: quests.length > 0 };
  }

  /* --------------------------------------- Rendering ------------------------------------------- */

  _onRender(context, options) {
    super._onRender?.(context, options);
    // A data refresh may have emptied the tracker (quest completed, unpinned, hidden).
    if (!context.hasQuests) { this.close(); return; }
    this.#startCountdowns();
    this.#applyPosition();
    this.#wireDrag();
  }

  /** Apply this user's saved (dragged) position, if any. */
  #applyPosition() {
    const pos = game.settings.get(MODULE_ID, SETTINGS.TRACKER_POSITION);
    if (pos && Number.isFinite(pos.left) && Number.isFinite(pos.top)) {
      this.element.style.left = `${pos.left}px`;
      this.element.style.top = `${pos.top}px`;
      this.element.style.right = "auto";
    }
  }

  /** Let the user drag the tracker by its header; persists the position on drop. */
  #wireDrag() {
    const handle = this.element.querySelector(".qs-tracker__header");
    if (!handle) return;

    handle.addEventListener("pointerdown", (ev) => {
      // Ignore drags that start on the collapse button.
      if (ev.target.closest("[data-action]")) return;
      ev.preventDefault();
      const rect = this.element.getBoundingClientRect();
      const dx = ev.clientX - rect.left;
      const dy = ev.clientY - rect.top;

      const onMove = (e) => {
        const left = Math.max(0, Math.min(window.innerWidth - 40, e.clientX - dx));
        const top = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - dy));
        this.element.style.left = `${left}px`;
        this.element.style.top = `${top}px`;
        this.element.style.right = "auto";
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        const r = this.element.getBoundingClientRect();
        game.settings.set(MODULE_ID, SETTINGS.TRACKER_POSITION, { left: r.left, top: r.top });
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });
  }

  /** Live-update timed-objective countdowns every second (mirrors the Quest Log). */
  #startCountdowns() {
    if (this._countdownTimer) clearInterval(this._countdownTimer);
    if (!this.element.querySelector("[data-deadline]")) return;

    const tick = () => {
      const now = Date.now();
      for (const el of this.element.querySelectorAll("[data-deadline]")) {
        const deadline = Number(el.dataset.deadline);
        if (!deadline) { el.textContent = "—"; continue; }
        const remaining = Math.max(0, deadline - now);
        el.textContent = this.#formatDuration(remaining);
        el.classList.toggle("is-expired", remaining === 0);
      }
    };
    tick();
    this._countdownTimer = setInterval(tick, 1000);
  }

  #formatDuration(ms) {
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }

  /* ----------------------------------------- Actions ------------------------------------------- */

  static async #onToggleCollapse() {
    const collapsed = game.settings.get(MODULE_ID, SETTINGS.TRACKER_COLLAPSED) ?? false;
    await game.settings.set(MODULE_ID, SETTINGS.TRACKER_COLLAPSED, !collapsed);
    this.render({ force: false });
  }

  static async #onOpenQuest(event, target) {
    const questId = target.dataset.questId;
    const { QuestLogApp } = await import("./quest-log.mjs");
    QuestLogApp.openTo(questId);
  }
}

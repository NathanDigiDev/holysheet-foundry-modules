/**
 * QuestAPI — high-level orchestration the UI talks to.
 *
 * GM clients run these directly. Player clients call the `request*` variants,
 * which relay to the GM via the socket. Exposed on `game.modules.get(id).api`
 * and as `globalThis.QuestSystem` for macros.
 */

import {
  QUEST_STATUS,
  OBJECTIVE_TYPE,
  log
} from "./config.mjs";
import { QuestStore } from "./data/quest-store.mjs";
import { questProgress } from "./data/quest-model.mjs";
import { grantRewards } from "./rewards.mjs";
import { QuestSocket, isResponsibleGM } from "./socket.mjs";
import { BannerManager } from "./notifications/banners.mjs";

export class QuestAPI {
  /* ----------------------------------- CRUD passthrough (GM) ----------------------------------- */

  static create(data) { return QuestStore.create(data); }
  static get(id) { return QuestStore.get(id); }
  static all() { return QuestStore.all(); }
  static duplicate(id) { return QuestStore.duplicate(id); }

  static async delete(id) {
    const ok = await QuestStore.delete(id);
    if (ok) QuestSocket.emitRefresh();
    return ok;
  }

  static async save(id, quest) {
    const result = await QuestStore.replace(id, quest);
    QuestSocket.emitRefresh();
    return result;
  }

  /* --------------------------------------- State machine --------------------------------------- */

  /**
   * Transition a quest to a new status, running side-effects (banners, rewards).
   * @param {string} id
   * @param {string} status
   */
  static async setStatus(id, status) {
    const quest = QuestStore.get(id);
    if (!quest) return null;

    const previous = quest.status;
    if (previous === status) return quest;

    // Starting a quest arms any timed objectives.
    if (status === QUEST_STATUS.ACTIVE && previous !== QUEST_STATUS.PAUSED) {
      const now = Date.now();
      quest.objectives = quest.objectives.map((o) =>
        o.type === OBJECTIVE_TYPE.TIMED ? { ...o, deadline: now + (o.duration ?? 0) * 1000, expired: false } : o
      );
    }

    quest.status = status;
    await QuestStore.replace(id, quest);

    // Side effects.
    if (status === QUEST_STATUS.ACTIVE && previous === QUEST_STATUS.INACTIVE) {
      this.#broadcastBanner(quest, "start");
    }
    if (status === QUEST_STATUS.COMPLETED) {
      await grantRewards(quest);
      await QuestStore.replace(id, quest); // persist `granted` flags
      this.#broadcastBanner(quest, "complete");
    }

    QuestSocket.emitRefresh();
    log(`Quest "${quest.name}": ${previous} → ${status}`);
    return quest;
  }

  static start(id) { return this.setStatus(id, QUEST_STATUS.ACTIVE); }
  static pause(id) { return this.setStatus(id, QUEST_STATUS.PAUSED); }
  static resume(id) { return this.setStatus(id, QUEST_STATUS.ACTIVE); }
  static complete(id) { return this.setStatus(id, QUEST_STATUS.COMPLETED); }
  static cancel(id) { return this.setStatus(id, QUEST_STATUS.CANCELLED); }

  /* --------------------------------------- Objectives ------------------------------------------ */

  /**
   * Toggle / set an objective's completion (GM-applied).
   * @param {string} questId
   * @param {string} objectiveId
   * @param {boolean|null} value Explicit value, or null to toggle.
   */
  static async setObjectiveCompleted(questId, objectiveId, value = null) {
    const quest = QuestStore.get(questId);
    if (!quest) return null;
    const objective = quest.objectives.find((o) => o.id === objectiveId);
    if (!objective) return null;

    objective.completed = value === null ? !objective.completed : Boolean(value);

    // Kill objectives keep the counter consistent with the checkbox.
    if (objective.type === OBJECTIVE_TYPE.KILL) {
      objective.current = objective.completed ? objective.required : 0;
    }

    await QuestStore.replace(questId, quest);
    await this.#maybeAutoComplete(quest);
    QuestSocket.emitRefresh();
    return quest;
  }

  /**
   * Increment a kill objective's counter; auto-marks complete at the threshold.
   */
  static async advanceKillObjective(questId, objectiveId, delta = 1) {
    const quest = QuestStore.get(questId);
    if (!quest) return null;
    const objective = quest.objectives.find((o) => o.id === objectiveId && o.type === OBJECTIVE_TYPE.KILL);
    if (!objective) return null;

    objective.current = Math.clamp(objective.current + delta, 0, objective.required);
    objective.completed = objective.current >= objective.required;

    await QuestStore.replace(questId, quest);
    await this.#maybeAutoComplete(quest);
    QuestSocket.emitRefresh();
    return quest;
  }

  /** Auto-complete a quest if all (non-hidden) objectives are done. */
  static async #maybeAutoComplete(quest) {
    if (quest.status !== QUEST_STATUS.ACTIVE) return;
    const { done, total } = questProgress(quest, true);
    if (total > 0 && done === total) {
      await this.setStatus(quest.id, QUEST_STATUS.COMPLETED);
    }
  }

  /* --------------------------------------- Shared notes ---------------------------------------- */

  /** Set a quest's shared note (GM-applied). */
  static async setNotes(questId, value = "") {
    const result = await QuestStore.update(questId, { notes: String(value ?? "") });
    if (result) QuestSocket.emitRefresh();
    return result;
  }

  /* ------------------------------------ Player request relays ---------------------------------- */

  /**
   * Player-side entry point. If we're the GM, apply directly; otherwise relay.
   * Mirrors `setObjectiveCompleted`.
   */
  static requestObjectiveToggle(questId, objectiveId, value = null) {
    if (game.user.isGM) return this.setObjectiveCompleted(questId, objectiveId, value);
    QuestSocket.emitRequest("objectiveToggle", { questId, objectiveId, value });
  }

  /** Player-side entry point for editing the shared note. */
  static requestSetNotes(questId, value = "") {
    if (game.user.isGM) return this.setNotes(questId, value);
    QuestSocket.emitRequest("notesUpdate", { questId, value });
  }

  /* --------------------------------------- Banners --------------------------------------------- */

  /** Build banner payload from a quest and broadcast it to all clients. */
  static #broadcastBanner(quest, event) {
    if (!game.settings.get("holysheet-quest-system", "enableBanners")) return;
    const payload = BannerManager.buildPayload(quest, event);
    QuestSocket.emitBanner(payload);
    // Show locally too (the socket emit does not loop back to the sender).
    BannerManager.render(payload);
  }

  /* ---------------------------------------- Timers --------------------------------------------- */

  /**
   * Called on an interval by the GM client to expire timed objectives and fire
   * warning messages. Returns true if any quest changed.
   */
  static async tickTimers() {
    if (!isResponsibleGM()) return false;
    const now = Date.now();
    let changed = false;

    for (const quest of QuestStore.all()) {
      if (quest.status !== QUEST_STATUS.ACTIVE) continue;
      let questChanged = false;

      for (const objective of quest.objectives) {
        if (objective.type !== OBJECTIVE_TYPE.TIMED || objective.completed || objective.expired) continue;
        if (objective.deadline && now >= objective.deadline) {
          objective.expired = true;
          questChanged = true;
          if (quest.messages.warning) {
            ChatMessage.create({
              content: `<div class="quest-system warning-chat"><h3><i class="fa-solid fa-triangle-exclamation"></i> ${quest.name}</h3><p>${quest.messages.warning}</p></div>`,
              speaker: { alias: game.i18n.localize("QUESTSYSTEM.WarningSpeaker") }
            });
          }
        }
      }

      if (questChanged) {
        await QuestStore.replace(quest.id, quest);
        changed = true;
      }
    }

    if (changed) QuestSocket.emitRefresh();
    return changed;
  }
}

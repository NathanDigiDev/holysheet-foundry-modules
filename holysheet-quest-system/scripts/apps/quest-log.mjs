/**
 * QuestLogApp — the player-facing (and GM-facing) Quest Log.
 *
 * A two-pane ApplicationV2: a list of quests on the left, the selected quest's
 * detail on the right. Players only ever receive quests visible to them; GMs see
 * everything plus inline state controls and an "Edit" affordance.
 */

import {
  MODULE_ID,
  SETTINGS,
  QUEST_STATUS,
  QUEST_STATUS_META,
  OBJECTIVE_TYPE,
  OBJECTIVE_TYPE_META,
  REWARD_TYPE,
  REWARD_TYPE_META
} from "../config.mjs";
import { QuestStore } from "../data/quest-store.mjs";
import { questProgress, isQuestVisibleTo } from "../data/quest-model.mjs";
import { QuestAPI } from "../api.mjs";
import { QuestTrackerApp } from "./quest-tracker.mjs";
import { registerApp, unregisterApp } from "./refresh.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class QuestLogApp extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {QuestLogApp|null} Singleton instance. */
  static #instance = null;

  /** Currently selected quest id. */
  #selectedId = null;

  static DEFAULT_OPTIONS = {
    id: "quest-system-log",
    classes: ["quest-system", "quest-log"],
    tag: "div",
    window: {
      title: "QUESTSYSTEM.SidebarTitle",
      icon: "fa-solid fa-scroll",
      resizable: true
    },
    position: { width: 820, height: 620 },
    actions: {
      selectQuest: QuestLogApp.#onSelectQuest,
      toggleObjective: QuestLogApp.#onToggleObjective,
      createQuest: QuestLogApp.#onCreateQuest,
      editQuest: QuestLogApp.#onEditQuest,
      duplicateQuest: QuestLogApp.#onDuplicateQuest,
      deleteQuest: QuestLogApp.#onDeleteQuest,
      setStatus: QuestLogApp.#onSetStatus,
      toggleTrack: QuestLogApp.#onToggleTrack
    }
  };

  static PARTS = {
    body: { template: "modules/holysheet-quest-system/templates/quest-log.hbs" }
  };

  /* --------------------------------------- Singleton ------------------------------------------- */

  static get instance() {
    if (!this.#instance) this.#instance = new QuestLogApp();
    return this.#instance;
  }

  /** Toggle the log window open/closed (used by the sidebar tab). */
  static toggle() {
    const app = this.instance;
    if (app.rendered) app.close();
    else app.render({ force: true });
  }

  /** Open the log focused on a specific quest (used by the tracker overlay). */
  static openTo(questId) {
    const app = this.instance;
    if (questId) app.#selectedId = questId;
    app.render({ force: true });
  }

  constructor(options = {}) {
    super(options);
    registerApp(this);
  }

  async close(options) {
    unregisterApp(this);
    return super.close(options);
  }

  /* --------------------------------------- Context --------------------------------------------- */

  async _prepareContext(_options) {
    const isGM = game.user.isGM;
    const quests = QuestStore.all().filter((q) => isQuestVisibleTo(q, game.user));
    const tracked = new Set(game.settings.get(MODULE_ID, SETTINGS.TRACKED_QUESTS) ?? []);

    // Keep a valid selection.
    if (!quests.find((q) => q.id === this.#selectedId)) {
      this.#selectedId = quests[0]?.id ?? null;
    }

    const listItems = quests.map((q) => {
      const progress = questProgress(q, isGM);
      return {
        id: q.id,
        name: q.name,
        img: q.img,
        status: q.status,
        statusMeta: QUEST_STATUS_META[q.status],
        progress,
        selected: q.id === this.#selectedId,
        tracked: tracked.has(q.id)
      };
    });

    const selected = quests.find((q) => q.id === this.#selectedId) ?? null;

    return {
      isGM,
      hasQuests: quests.length > 0,
      quests: listItems,
      selected: selected ? await this.#prepareQuestDetail(selected, isGM) : null,
      statusOptions: this.#statusButtons(selected)
    };
  }

  /** Build the rich detail view for a single quest. */
  async #prepareQuestDetail(quest, isGM) {
    // Players never receive hidden objectives/rewards.
    const objectives = quest.objectives
      .filter((o) => isGM || !o.hidden)
      .map((o) => this.#prepareObjective(o, isGM));

    const rewards = quest.rewards
      .filter((r) => isGM || !r.hidden)
      .map((r) => this.#prepareReward(r, isGM));

    // Enrich the description so links, rolls and formatting render for everyone.
    // v13+ namespaces TextEditor under foundry.applications.ux; fall back for safety,
    // and never let an enrichment error swallow the text — show the raw value instead.
    const description = await this.#enrichDescription(quest.description, isGM);

    // Anyone who can see the quest may read & edit the shared note.
    const canViewNotes = isGM || isQuestVisibleTo(quest, game.user);

    return {
      id: quest.id,
      name: quest.name,
      img: quest.img,
      description,
      notes: quest.notes ?? "",
      status: quest.status,
      statusMeta: QUEST_STATUS_META[quest.status],
      progress: questProgress(quest, isGM),
      objectives,
      rewards,
      hasObjectives: objectives.length > 0,
      hasRewards: rewards.length > 0,
      canEdit: isGM,
      // Players may tick manual objectives on quests they participate in.
      canCheckObjectives: canViewNotes,
      canViewNotes,
      canEditNotes: canViewNotes
    };
  }

  /** Enrich quest description HTML, falling back to the raw text on any failure. */
  async #enrichDescription(raw, isGM) {
    if (!raw) return "";
    try {
      const TextEditorImpl = foundry.applications?.ux?.TextEditor?.implementation
        ?? foundry.applications?.ux?.TextEditor
        ?? globalThis.TextEditor;
      const enriched = await TextEditorImpl.enrichHTML(raw, { secrets: isGM });
      return enriched || raw;
    } catch (err) {
      console.warn("Quest System | description enrichment failed, showing raw text", err);
      return raw;
    }
  }

  #prepareObjective(o, isGM) {
    const meta = OBJECTIVE_TYPE_META[o.type];
    const data = {
      id: o.id,
      type: o.type,
      icon: meta.icon,
      typeLabel: meta.label,
      text: o.text,
      hidden: o.hidden,
      completed: o.completed,
      isGM
    };

    if (o.type === OBJECTIVE_TYPE.KILL) {
      data.current = o.current ?? 0;
      data.required = o.required ?? 1;
      data.countLabel = `${data.current}/${data.required}`;
    }
    if (o.type === OBJECTIVE_TYPE.TIMED) {
      data.expired = o.expired;
      data.deadline = o.deadline; // consumed by the client-side countdown
      data.duration = o.duration;
    }
    // Manual objectives are directly checkable; kill/timed are GM-driven.
    data.checkable = o.type === OBJECTIVE_TYPE.MANUAL;
    return data;
  }

  #prepareReward(r, isGM) {
    const meta = REWARD_TYPE_META[r.type];
    return {
      id: r.id,
      type: r.type,
      icon: meta.icon,
      typeLabel: meta.label,
      hidden: r.hidden,
      granted: r.granted,
      isGM,
      text: r.type === REWARD_TYPE.TEXT ? r.text : null,
      itemName: r.type === REWARD_TYPE.ITEM ? r.itemName : null,
      itemImg: r.type === REWARD_TYPE.ITEM ? r.itemImg : null,
      itemUuid: r.type === REWARD_TYPE.ITEM ? r.itemUuid : null,
      quantity: r.type === REWARD_TYPE.ITEM ? r.quantity : null
    };
  }

  /** The contextual state-control buttons shown to the GM. */
  #statusButtons(quest) {
    if (!quest || !game.user.isGM) return [];
    const S = QUEST_STATUS;
    const map = {
      [S.INACTIVE]: [["start", "QUESTSYSTEM.Action.Start", "fa-play"], ["cancel", "QUESTSYSTEM.Action.Cancel", "fa-ban"]],
      [S.ACTIVE]: [["pause", "QUESTSYSTEM.Action.Pause", "fa-pause"], ["complete", "QUESTSYSTEM.Action.Complete", "fa-trophy"], ["cancel", "QUESTSYSTEM.Action.Cancel", "fa-ban"]],
      [S.PAUSED]: [["resume", "QUESTSYSTEM.Action.Resume", "fa-play"], ["complete", "QUESTSYSTEM.Action.Complete", "fa-trophy"], ["cancel", "QUESTSYSTEM.Action.Cancel", "fa-ban"]],
      [S.COMPLETED]: [["start", "QUESTSYSTEM.Action.Restart", "fa-rotate-right"]],
      [S.CANCELLED]: [["start", "QUESTSYSTEM.Action.Restart", "fa-rotate-right"]]
    };
    return (map[quest.status] ?? []).map(([action, label, icon]) => ({ action, label, icon: `fa-solid ${icon}` }));
  }

  /* --------------------------------------- Rendering ------------------------------------------- */

  _onRender(context, options) {
    super._onRender?.(context, options);
    this.#startCountdowns();
    this.#wireNotes();
  }

  /** Persist the shared note on blur (avoids clobbering the field mid-typing). */
  #wireNotes() {
    const textarea = this.element.querySelector("[data-notes-input]");
    if (!textarea) return;
    textarea.addEventListener("change", (event) => {
      const questId = event.target.dataset.questId;
      if (questId) QuestAPI.requestSetNotes(questId, event.target.value);
    });
  }

  /** Live-update timed-objective countdowns every second. */
  #startCountdowns() {
    if (this._countdownTimer) clearInterval(this._countdownTimer);
    const els = this.element.querySelectorAll("[data-deadline]");
    if (!els.length) return;

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

  async _preClose(options) {
    if (this._countdownTimer) clearInterval(this._countdownTimer);
    return super._preClose?.(options);
  }

  /* ----------------------------------------- Actions ------------------------------------------- */

  static #onSelectQuest(event, target) {
    this.#selectedId = target.dataset.questId;
    this.render({ force: false });
  }

  static async #onToggleObjective(event, target) {
    const { questId, objectiveId } = target.dataset;
    const value = target.checked ?? null;
    await QuestAPI.requestObjectiveToggle(questId, objectiveId, value);
    this.render({ force: false });
  }

  static async #onCreateQuest() {
    if (!game.user.isGM) return;
    const quest = await QuestAPI.create();
    this.#selectedId = quest.id;
    const { QuestEditorApp } = await import("./quest-editor.mjs");
    new QuestEditorApp(quest.id).render({ force: true });
    this.render({ force: false });
  }

  static async #onEditQuest(event, target) {
    if (!game.user.isGM) return;
    const questId = target.dataset.questId ?? this.#selectedId;
    const { QuestEditorApp } = await import("./quest-editor.mjs");
    new QuestEditorApp(questId).render({ force: true });
  }

  static async #onDuplicateQuest(event, target) {
    if (!game.user.isGM) return;
    const quest = await QuestAPI.duplicate(target.dataset.questId ?? this.#selectedId);
    if (quest) this.#selectedId = quest.id;
    this.render({ force: false });
  }

  static async #onDeleteQuest(event, target) {
    if (!game.user.isGM) return;
    const questId = target.dataset.questId ?? this.#selectedId;
    const quest = QuestStore.get(questId);
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("QUESTSYSTEM.DeleteTitle") },
      content: `<p>${game.i18n.format("QUESTSYSTEM.DeleteConfirm", { name: quest?.name ?? "" })}</p>`
    });
    if (!confirmed) return;
    await QuestAPI.delete(questId);
    this.render({ force: false });
  }

  static async #onSetStatus(event, target) {
    if (!game.user.isGM) return;
    const action = target.dataset.statusAction;
    const id = this.#selectedId;
    const fn = { start: "start", pause: "pause", resume: "resume", complete: "complete", cancel: "cancel" }[action];
    if (fn) await QuestAPI[fn](id);
    this.render({ force: false });
  }

  /** Pin / unpin a quest on this user's on-screen tracker. */
  static async #onToggleTrack(event, target) {
    event.preventDefault();
    event.stopPropagation();
    const questId = target.dataset.questId;
    if (!questId) return;
    const current = new Set(game.settings.get(MODULE_ID, SETTINGS.TRACKED_QUESTS) ?? []);
    if (current.has(questId)) current.delete(questId);
    else current.add(questId);
    await game.settings.set(MODULE_ID, SETTINGS.TRACKED_QUESTS, Array.from(current));
    QuestTrackerApp.sync();
    this.render({ force: false });
  }
}

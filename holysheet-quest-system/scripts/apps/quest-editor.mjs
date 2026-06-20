/**
 * QuestEditorApp — GM-only quest editor (ApplicationV2 form, tabbed).
 *
 * Tabs: Details · Objectives · Rewards · Notifications.
 * The form auto-saves on change. Add/remove/reorder of nested objective & reward
 * rows is handled through actions that mutate the working copy then re-render.
 */

import {
  MODULE_ID,
  OBJECTIVE_TYPE,
  OBJECTIVE_TYPE_META,
  REWARD_TYPE,
  REWARD_TYPE_META,
  QUEST_STATUS_META
} from "../config.mjs";
import { QuestStore } from "../data/quest-store.mjs";
import { makeObjective, makeReward } from "../data/quest-model.mjs";
import { QuestAPI } from "../api.mjs";
import { BannerManager } from "../notifications/banners.mjs";
import { registerApp, unregisterApp } from "./refresh.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class QuestEditorApp extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @param {string} questId */
  constructor(questId, options = {}) {
    super(options);
    this.questId = questId;
    /** Working copy edited in-memory until each change is flushed to the store. */
    this.quest = QuestStore.get(questId);
    registerApp(this);
  }

  static DEFAULT_OPTIONS = {
    id: "quest-system-editor",
    classes: ["quest-system", "quest-editor"],
    tag: "form",
    window: {
      title: "QUESTSYSTEM.EditorTitle",
      icon: "fa-solid fa-feather-pointed",
      resizable: true,
      contentClasses: ["standard-form"]
    },
    position: { width: 680, height: 720 },
    form: {
      handler: QuestEditorApp.#onSubmit,
      submitOnChange: true,
      closeOnSubmit: false
    },
    actions: {
      addObjective: QuestEditorApp.#onAddObjective,
      removeObjective: QuestEditorApp.#onRemoveObjective,
      addReward: QuestEditorApp.#onAddReward,
      removeReward: QuestEditorApp.#onRemoveReward,
      removeParticipant: QuestEditorApp.#onRemoveParticipant,
      pickImage: QuestEditorApp.#onPickImage,
      previewBanner: QuestEditorApp.#onPreviewBanner,
      changeTab: QuestEditorApp.#onChangeTab
    }
  };

  static PARTS = {
    tabs: { template: "modules/holysheet-quest-system/templates/editor/tabs.hbs" },
    details: { template: "modules/holysheet-quest-system/templates/editor/details.hbs" },
    objectives: { template: "modules/holysheet-quest-system/templates/editor/objectives.hbs" },
    rewards: { template: "modules/holysheet-quest-system/templates/editor/rewards.hbs" },
    notifications: { template: "modules/holysheet-quest-system/templates/editor/notifications.hbs" },
    footer: { template: "modules/holysheet-quest-system/templates/editor/footer.hbs" }
  };

  /** @type {string} Active tab. */
  tabGroup = "details";

  get title() {
    return `${game.i18n.localize("QUESTSYSTEM.EditorTitle")} — ${this.quest?.name ?? ""}`;
  }

  async close(options) {
    unregisterApp(this);
    return super.close(options);
  }

  /* --------------------------------------- Context --------------------------------------------- */

  async _prepareContext(_options) {
    // Re-pull in case another client changed it; keep our in-memory edits priority.
    this.quest ??= QuestStore.get(this.questId);
    const quest = this.quest;

    return {
      quest,
      tabs: this.#tabs(),
      statusMeta: QUEST_STATUS_META[quest.status],
      actorChoices: this.#actorChoices(quest),
      userChoices: this.#userChoices(quest),
      objectiveTypes: this.#enumChoices(OBJECTIVE_TYPE_META),
      rewardTypes: this.#enumChoices(REWARD_TYPE_META),
      objectives: quest.objectives.map((o, i) => ({ ...o, index: i, typeMeta: OBJECTIVE_TYPE_META[o.type], isManual: o.type === OBJECTIVE_TYPE.MANUAL, isKill: o.type === OBJECTIVE_TYPE.KILL, isTimed: o.type === OBJECTIVE_TYPE.TIMED })),
      rewards: quest.rewards.map((r, i) => ({ ...r, index: i, typeMeta: REWARD_TYPE_META[r.type], isText: r.type === REWARD_TYPE.TEXT, isItem: r.type === REWARD_TYPE.ITEM }))
    };
  }

  async _preparePartContext(partId, context) {
    context.tab = context.tabs[partId];
    return context;
  }

  #tabs() {
    const tabs = {
      details: { id: "details", group: "primary", icon: "fa-solid fa-circle-info", label: "QUESTSYSTEM.Tab.Details" },
      objectives: { id: "objectives", group: "primary", icon: "fa-solid fa-list-check", label: "QUESTSYSTEM.Tab.Objectives" },
      rewards: { id: "rewards", group: "primary", icon: "fa-solid fa-gem", label: "QUESTSYSTEM.Tab.Rewards" },
      notifications: { id: "notifications", group: "primary", icon: "fa-solid fa-bell", label: "QUESTSYSTEM.Tab.Notifications" }
    };
    for (const tab of Object.values(tabs)) {
      tab.active = this.tabGroup === tab.id;
      tab.cssClass = tab.active ? "active" : "";
    }
    return tabs;
  }

  #enumChoices(meta) {
    return Object.entries(meta).map(([key, m]) => ({ key, label: m.label, icon: m.icon }));
  }

  #actorChoices(quest) {
    return game.actors
      .filter((a) => a.type !== "group")
      .map((a) => ({ id: a.id, name: a.name, img: a.img, selected: quest.participants.actors.includes(a.id) }));
  }

  #userChoices(quest) {
    return game.users
      .filter((u) => !u.isGM)
      .map((u) => ({ id: u.id, name: u.name, color: u.color, selected: quest.participants.users.includes(u.id) }));
  }

  /* --------------------------------------- Submission ------------------------------------------ */

  /**
   * Form submit handler — flush flat form fields into the working copy & persist.
   * @this {QuestEditorApp}
   */
  static async #onSubmit(event, form, formData) {
    const data = foundry.utils.expandObject(formData.object);
    const quest = this.quest;

    // Scalar fields.
    quest.name = data.name ?? quest.name;
    quest.img = data.img ?? quest.img;
    quest.description = data.description ?? "";
    quest.messages = foundry.utils.mergeObject(quest.messages, data.messages ?? {}, { inplace: false });
    quest.theme = data.theme ?? quest.theme;
    quest.banner = foundry.utils.mergeObject(quest.banner, data.banner ?? {}, { inplace: false });

    // Participants (checkbox groups → arrays).
    quest.participants.actors = this.#collectChecked(form, "participant-actor");
    quest.participants.users = this.#collectChecked(form, "participant-user");

    // Nested objective fields keyed by id.
    if (data.objective) {
      for (const [id, patch] of Object.entries(data.objective)) {
        const obj = quest.objectives.find((o) => o.id === id);
        if (!obj) continue;
        foundry.utils.mergeObject(obj, this.#coerceObjective(obj, patch), { inplace: true });
      }
    }

    // Nested reward fields keyed by id.
    if (data.reward) {
      for (const [id, patch] of Object.entries(data.reward)) {
        const rw = quest.rewards.find((r) => r.id === id);
        if (!rw) continue;
        foundry.utils.mergeObject(rw, this.#coerceReward(rw, patch), { inplace: true });
      }
    }

    await QuestAPI.save(this.questId, quest);
  }

  #collectChecked(form, name) {
    return Array.from(form.querySelectorAll(`input[data-group="${name}"]:checked`)).map((el) => el.value);
  }

  #coerceObjective(obj, patch) {
    const out = { ...patch };
    if (out.hidden !== undefined) out.hidden = Boolean(out.hidden);
    if (out.completed !== undefined) out.completed = Boolean(out.completed);
    if (obj.type === OBJECTIVE_TYPE.KILL) {
      if (out.required !== undefined) out.required = Math.max(1, Number(out.required) || 1);
      if (out.current !== undefined) out.current = Math.max(0, Number(out.current) || 0);
    }
    if (obj.type === OBJECTIVE_TYPE.TIMED && out.duration !== undefined) {
      out.duration = Math.max(0, Number(out.duration) || 0);
    }
    return out;
  }

  #coerceReward(rw, patch) {
    const out = { ...patch };
    if (out.hidden !== undefined) out.hidden = Boolean(out.hidden);
    if (rw.type === REWARD_TYPE.ITEM && out.quantity !== undefined) {
      out.quantity = Math.max(1, Number(out.quantity) || 1);
    }
    return out;
  }

  /* ------------------------------------ Drag & drop (items) ------------------------------------ */

  _onRender(context, options) {
    super._onRender?.(context, options);

    // Accept dropped Items onto item-reward rows (system-agnostic item linking).
    for (const dropzone of this.element.querySelectorAll("[data-reward-drop]")) {
      dropzone.addEventListener("dragover", (ev) => ev.preventDefault());
      dropzone.addEventListener("drop", (ev) => this.#onDropItem(ev, dropzone.dataset.rewardId));
    }
  }

  async #onDropItem(event, rewardId) {
    event.preventDefault();
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));
    } catch (_e) { return; }
    if (data.type !== "Item") return;

    const item = await fromUuid(data.uuid);
    if (!item) return;

    const reward = this.quest.rewards.find((r) => r.id === rewardId);
    if (!reward) return;
    reward.itemUuid = item.uuid;
    reward.itemName = item.name;
    reward.itemImg = item.img;

    await QuestAPI.save(this.questId, this.quest);
    this.render({ force: false });
  }

  /* ----------------------------------------- Actions ------------------------------------------- */

  static #onChangeTab(event, target) {
    this.tabGroup = target.dataset.tabTarget;
    this.render({ force: false });
  }

  static async #onAddObjective(event, target) {
    const type = target.dataset.type ?? OBJECTIVE_TYPE.MANUAL;
    this.quest.objectives.push(makeObjective(type, { sort: this.quest.objectives.length }));
    await QuestAPI.save(this.questId, this.quest);
    this.render({ force: false });
  }

  static async #onRemoveObjective(event, target) {
    const id = target.dataset.objectiveId;
    this.quest.objectives = this.quest.objectives.filter((o) => o.id !== id);
    await QuestAPI.save(this.questId, this.quest);
    this.render({ force: false });
  }

  static async #onAddReward(event, target) {
    const type = target.dataset.type ?? REWARD_TYPE.TEXT;
    this.quest.rewards.push(makeReward(type, { sort: this.quest.rewards.length }));
    await QuestAPI.save(this.questId, this.quest);
    this.render({ force: false });
  }

  static async #onRemoveReward(event, target) {
    const id = target.dataset.rewardId;
    this.quest.rewards = this.quest.rewards.filter((r) => r.id !== id);
    await QuestAPI.save(this.questId, this.quest);
    this.render({ force: false });
  }

  static async #onRemoveParticipant(event, target) {
    const { kind, value } = target.dataset;
    const list = kind === "actor" ? this.quest.participants.actors : this.quest.participants.users;
    const idx = list.indexOf(value);
    if (idx >= 0) list.splice(idx, 1);
    await QuestAPI.save(this.questId, this.quest);
    this.render({ force: false });
  }

  static async #onPickImage(event, target) {
    const current = this.quest.img;
    const fp = new foundry.applications.apps.FilePicker.implementation({
      type: "image",
      current,
      callback: async (path) => {
        this.quest.img = path;
        await QuestAPI.save(this.questId, this.quest);
        this.render({ force: false });
      }
    });
    fp.render(true);
  }

  static #onPreviewBanner(event, target) {
    const event_ = target.dataset.event ?? "start";
    BannerManager.preview(this.quest, event_);
  }
}

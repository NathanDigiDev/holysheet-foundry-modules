/**
 * QuestStore — the single source of truth for quest data.
 *
 * Quests live in a single world-scoped setting (an object keyed by quest id).
 * Only GMs may write world settings, so every mutating method assumes a GM
 * caller. Players reach these methods indirectly through the socket relay.
 */

import { MODULE_ID, SETTINGS, QUEST_STATUS, log } from "../config.mjs";
import { makeQuest, normalizeQuest } from "./quest-model.mjs";

export class QuestStore {
  /** Read the raw setting object and normalize every entry. */
  static all() {
    const raw = game.settings.get(MODULE_ID, SETTINGS.QUESTS) ?? {};
    return Object.values(raw).map(normalizeQuest).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  }

  /** @returns {object|null} A single normalized quest by id. */
  static get(id) {
    const raw = game.settings.get(MODULE_ID, SETTINGS.QUESTS) ?? {};
    return raw[id] ? normalizeQuest(raw[id]) : null;
  }

  /** Persist the entire collection (GM only). */
  static async #persist(collection) {
    return game.settings.set(MODULE_ID, SETTINGS.QUESTS, collection);
  }

  /** Internal: fetch a mutable clone of the raw collection. */
  static #raw() {
    return foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.QUESTS) ?? {});
  }

  /**
   * Create a quest from optional seed data.
   * @returns {Promise<object>} The created normalized quest.
   */
  static async create(data = {}) {
    const quest = makeQuest(data);
    const collection = this.#raw();
    collection[quest.id] = quest;
    await this.#persist(collection);
    log("Created quest", quest.id, quest.name);
    return normalizeQuest(quest);
  }

  /**
   * Patch a quest with a partial update (merged deeply).
   * @param {string} id
   * @param {object} changes
   * @returns {Promise<object|null>}
   */
  static async update(id, changes = {}) {
    const collection = this.#raw();
    if (!collection[id]) return null;
    const merged = foundry.utils.mergeObject(collection[id], changes, { inplace: false });
    merged.updatedAt = Date.now();
    collection[id] = merged;
    await this.#persist(collection);
    return normalizeQuest(merged);
  }

  /**
   * Replace a quest wholesale (used by the editor on save to allow array deletes,
   * which mergeObject cannot express cleanly).
   */
  static async replace(id, quest) {
    const collection = this.#raw();
    if (!collection[id]) return null;
    quest.id = id;
    quest.updatedAt = Date.now();
    collection[id] = quest;
    await this.#persist(collection);
    return normalizeQuest(quest);
  }

  /** Duplicate an existing quest (reset runtime state, new ids). */
  static async duplicate(id) {
    const source = this.get(id);
    if (!source) return null;
    const copy = makeQuest({
      ...foundry.utils.deepClone(source),
      id: undefined,
      name: `${source.name} (${game.i18n.localize("QUESTSYSTEM.Copy")})`,
      status: QUEST_STATUS.INACTIVE,
      sort: Date.now()
    });
    // Fresh ids for nested entries + reset their progress.
    copy.objectives = copy.objectives.map((o) => ({ ...o, id: foundry.utils.randomID(16), completed: false, current: 0, deadline: null, expired: false }));
    copy.rewards = copy.rewards.map((r) => ({ ...r, id: foundry.utils.randomID(16), granted: false }));
    const collection = this.#raw();
    collection[copy.id] = copy;
    await this.#persist(collection);
    return normalizeQuest(copy);
  }

  /** Delete a quest by id. */
  static async delete(id) {
    const collection = this.#raw();
    if (!collection[id]) return false;
    delete collection[id];
    await this.#persist(collection);
    log("Deleted quest", id);
    return true;
  }
}

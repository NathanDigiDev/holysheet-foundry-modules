/**
 * HolySheet Lockpicking — Couche de données des mini-jeux.
 *
 * Les mini-jeux et leurs dossiers ne sont PAS des Documents Foundry : on les
 * stocke dans un réglage de monde (`minigames`) sous forme d'arbre JSON simple.
 * Seul le MJ écrit (le réglage est de portée « world »).
 *
 * Forme du store :
 * {
 *   folders: [ { id, name, parent: string|null, sort, expanded } ],
 *   games:   [ { id, name, type: "pick"|"combo", folder: string|null, sort, config } ]
 * }
 *  - config (pick)  : { difficulty, picks }
 *  - config (combo) : { rings, symbols:[...], combination:[...], showHints, maxAttempts }
 */

export const MODULE_ID = "holysheet-lockpicking";
export const SETTING_KEY = "minigames";

export const MinigamesData = {

  /** Lit le store (toujours une structure valide). */
  read() {
    const s = game.settings.get(MODULE_ID, SETTING_KEY) ?? {};
    return {
      folders: Array.isArray(s.folders) ? foundry.utils.deepClone(s.folders) : [],
      games: Array.isArray(s.games) ? foundry.utils.deepClone(s.games) : []
    };
  },

  /** Écrit le store (MJ uniquement). */
  async write(store) {
    return game.settings.set(MODULE_ID, SETTING_KEY, store);
  },

  newId() {
    return foundry.utils.randomID();
  },

  /* ----------------------------- Mini-jeux ----------------------------- */

  getGame(id) {
    return this.read().games.find((g) => g.id === id) ?? null;
  },

  async upsertGame(rec) {
    const store = this.read();
    const i = store.games.findIndex((g) => g.id === rec.id);
    if (i >= 0) {
      store.games[i] = { ...store.games[i], ...rec };
    } else {
      rec.id = rec.id ?? this.newId();
      rec.sort = (store.games.length + 1) * 100;
      rec.folder = rec.folder ?? null;
      store.games.push(rec);
    }
    await this.write(store);
    return rec;
  },

  async deleteGame(id) {
    const store = this.read();
    store.games = store.games.filter((g) => g.id !== id);
    await this.write(store);
  },

  async setGameFolder(gameId, folderId) {
    const store = this.read();
    const g = store.games.find((x) => x.id === gameId);
    if (!g) return;
    g.folder = folderId ?? null;
    await this.write(store);
  },

  /* ----------------------------- Dossiers ------------------------------ */

  async upsertFolder(f) {
    const store = this.read();
    const i = store.folders.findIndex((x) => x.id === f.id);
    if (i >= 0) {
      store.folders[i] = { ...store.folders[i], ...f };
    } else {
      f.id = f.id ?? this.newId();
      f.sort = (store.folders.length + 1) * 100;
      f.parent = f.parent ?? null;
      f.expanded = f.expanded ?? true;
      store.folders.push(f);
    }
    await this.write(store);
    return f;
  },

  /** Supprime un dossier ; ses sous-dossiers et mini-jeux remontent à la racine. */
  async deleteFolder(id) {
    const store = this.read();
    store.folders = store.folders.filter((x) => x.id !== id);
    store.folders.forEach((x) => { if (x.parent === id) x.parent = null; });
    store.games.forEach((g) => { if (g.folder === id) g.folder = null; });
    await this.write(store);
  },

  async toggleFolder(id) {
    const store = this.read();
    const f = store.folders.find((x) => x.id === id);
    if (!f) return;
    f.expanded = !f.expanded;
    await this.write(store);
  }
};

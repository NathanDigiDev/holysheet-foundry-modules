/**
 * HolySheet Lockpicking — Point d'entrée ES Module.
 *
 * Nouvelle architecture : les mini-jeux ne sont plus liés aux portes. Le MJ les
 * gère depuis un onglet « Mini-Jeux » dans la sidebar (collection + dossiers),
 * puis les SOUMET aux joueurs connectés de son choix. Le résultat est renvoyé au
 * MJ par notification/chat ; c'est le MJ qui déverrouille manuellement ce qu'il
 * veut. Plus aucune interception de porte.
 *
 *  - Hook `init`   : réglages + collection + API + enregistrement de l'onglet.
 *  - Hook `ready`  : onglet sidebar + relais socket (soumission / résultat).
 */

import { HolySheetLockpickingApp, MODULE_ID, DIFFICULTY } from "./lockpicking-app.js";
import { HolySheetComboLockApp } from "./combo-lock-app.js";
import { HolySheetMinigameEditor } from "./minigame-editor.js";
import { MinigamesData, SETTING_KEY } from "./minigames-data.js";
import { setupMinigamesSidebar, openMinigamesWindow } from "./minigames-sidebar.js";

const SOCKET = `module.${MODULE_ID}`;

/* -------------------------------------------- */
/*  API publique                                */
/* -------------------------------------------- */

const api = {
  App: HolySheetLockpickingApp,
  ComboApp: HolySheetComboLockApp,
  Editor: HolySheetMinigameEditor,
  data: MinigamesData,

  /** Lance le crochetage localement. */
  start(config = {}) {
    if (!config.actor) config.actor = canvas.tokens?.controlled?.[0]?.actor ?? game.user?.character ?? null;
    if (config.picks == null) config.picks = resolvePickCount(config.actor);
    const app = new HolySheetLockpickingApp(config);
    app.render(true);
    return app;
  },

  /** Lance le cadenas à code localement. */
  startCombo(config = {}) {
    if (config.rings == null) config.rings = game.settings.get(MODULE_ID, "comboRings");
    if (config.symbols == null) config.symbols = resolveComboSymbols();
    const app = new HolySheetComboLockApp(config);
    app.render(true);
    return app;
  },

  /** Ouvre le répertoire Mini-Jeux en fenêtre (secours / accès direct). */
  openMinigames() { return openMinigamesWindow(); },

  /**
   * Joue un enregistrement de mini-jeu sur CE client.
   * @param {object} record  { name, type, config }
   * @param {object} [opts]
   * @param {Function} [opts.onSuccess]
   * @param {Function} [opts.onFailure]
   * @param {Function} [opts.onAbort]   Appelé si le jeu ne peut pas démarrer (ex. : pas de crochet).
   * @param {boolean}  [opts.preview]   Mode « Tester » du MJ : ignore le blocage « pas de crochet ».
   * @returns {Application|null}  null si le mini-jeu n'a pas pu démarrer.
   */
  play(record, { onSuccess, onFailure, onAbort, preview } = {}) {
    const cfg = record.config ?? {};
    if (record.type === "combo") {
      return this.startCombo({ ...cfg, title: record.name, onSuccess, onFailure });
    }

    // Crochetage à nombre FIXE défini par le MJ.
    if (cfg.picks > 0) {
      return this.start({ difficulty: cfg.difficulty, picks: cfg.picks, title: record.name, onSuccess, onFailure });
    }

    // Crochetage AUTO (0) : dépend des crochets du joueur.
    const actor = canvas.tokens?.controlled?.[0]?.actor ?? game.user?.character ?? null;
    const count = countActorPicks(actor);
    if (count <= 0) {
      if (preview) {
        // Le MJ teste sans personnage doté de crochets : on prévisualise quand même.
        return this.start({ difficulty: cfg.difficulty, picks: game.settings.get(MODULE_ID, "defaultPicks"), title: record.name, onSuccess, onFailure });
      }
      ui.notifications?.warn(game.i18n.localize("HSLP.MG.NoPicksPlayer"));
      onAbort?.();
      return null;
    }
    return this.start({ difficulty: cfg.difficulty, picks: count, actor, title: record.name, onSuccess, onFailure });
  },

  /**
   * (MJ) Soumet un mini-jeu à une liste de joueurs connectés via socket.
   * @param {object}   record   { name, type, config }
   * @param {string[]} userIds  Identifiants des utilisateurs cibles.
   */
  submit(record, userIds) {
    if (!userIds?.length) return;
    game.socket.emit(SOCKET, {
      action: "play",
      targets: userIds,
      fromId: game.user.id,
      game: { name: record.name, type: record.type, config: record.config }
    });
    const names = userIds.map((id) => game.users.get(id)?.name ?? "?").join(", ");
    ui.notifications?.info(game.i18n.format("HSLP.MG.Sent", { name: record.name, players: names }));
  }
};

/**
 * Compte les crochets réellement possédés par l'acteur (SANS valeur de repli) :
 * - aucun objet « crochet »            → 0
 * - objet sans système de quantité     → 1 (il en possède au moins un)
 * - sinon                              → la quantité.
 */
function countActorPicks(actor) {
  if (!actor) return 0;
  const needle = (game.settings.get(MODULE_ID, "pickItemName") || "crochet").toLowerCase();
  const item = actor.items?.find((i) => i.name?.toLowerCase().includes(needle));
  if (!item) return 0;
  const qty = foundry.utils.getProperty(item, "system.quantity");
  if (typeof qty !== "number") return 1;
  return qty;
}

/** Nombre de crochets : quantité de l'objet « crochet » de l'acteur, sinon réglage. */
function resolvePickCount(actor) {
  const fallback = game.settings.get(MODULE_ID, "defaultPicks");
  if (!actor) return fallback;
  const needle = (game.settings.get(MODULE_ID, "pickItemName") || "crochet").toLowerCase();
  const item = actor.items?.find((i) => i.name?.toLowerCase().includes(needle));
  const qty = item ? foundry.utils.getProperty(item, "system.quantity") : null;
  return (typeof qty === "number" && qty > 0) ? qty : fallback;
}

/** Symboles par défaut du cadenas (réglage de monde → liste exploitable). */
function resolveComboSymbols() {
  const raw = (game.settings.get(MODULE_ID, "comboSymbols") || "").trim();
  if (!raw) return null;
  const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return list.length >= 2 ? list : null;
}

/* -------------------------------------------- */
/*  Hook init                                   */
/* -------------------------------------------- */

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initialisation`);

  // Collection des mini-jeux (dossiers + jeux), gérée par le MJ.
  game.settings.register(MODULE_ID, SETTING_KEY, {
    scope: "world",
    config: false,
    type: Object,
    default: { folders: [], games: [] }
  });

  // Réglages utilisés comme valeurs PAR DÉFAUT dans l'éditeur / le crochetage.
  game.settings.register(MODULE_ID, "difficulty", {
    name: "HSLP.Settings.Difficulty.Name",
    hint: "HSLP.Settings.Difficulty.Hint",
    scope: "world", config: true, type: String,
    choices: Object.keys(DIFFICULTY).reduce((acc, k) => { acc[k] = `HSLP.Difficulty.${k}`; return acc; }, {}),
    default: "adept"
  });

  game.settings.register(MODULE_ID, "defaultPicks", {
    name: "HSLP.Settings.DefaultPicks.Name",
    hint: "HSLP.Settings.DefaultPicks.Hint",
    scope: "world", config: true, type: Number, default: 5
  });

  game.settings.register(MODULE_ID, "pickItemName", {
    name: "HSLP.Settings.PickItemName.Name",
    hint: "HSLP.Settings.PickItemName.Hint",
    scope: "world", config: true, type: String, default: "crochet"
  });

  game.settings.register(MODULE_ID, "comboRings", {
    name: "HSLP.Settings.ComboRings.Name",
    hint: "HSLP.Settings.ComboRings.Hint",
    scope: "world", config: true, type: Number, default: 3
  });

  game.settings.register(MODULE_ID, "comboSymbols", {
    name: "HSLP.Settings.ComboSymbols.Name",
    hint: "HSLP.Settings.ComboSymbols.Hint",
    scope: "world", config: true, type: String,
    default: "fa-solid fa-skull, fa-solid fa-heart, fa-solid fa-star, fa-solid fa-moon, fa-solid fa-bolt, fa-solid fa-leaf, fa-solid fa-gem, fa-solid fa-crown"
  });

  const mod = game.modules.get(MODULE_ID);
  if (mod) mod.api = api;
  globalThis.HolySheetLockpicking = api;
  // Déprécié : ancien nom conservé pour compatibilité avec les macros existantes.
  // À supprimer dans une version future — utiliser globalThis.HolySheetLockpicking.
  globalThis.SkyrimLockpicking = globalThis.HolySheetLockpicking;
});

/* -------------------------------------------- */
/*  Hook ready : sidebar + socket               */
/* -------------------------------------------- */

Hooks.once("ready", () => {
  setupMinigamesSidebar();

  game.socket.on(SOCKET, (data) => {
    // Durcissement : on ignore d'emblée tout message malformé (le canal
    // `module.<id>` est ouvert à tous les clients connectés).
    if (!data || typeof data !== "object") return;
    if (data.action === "play") return onReceivePlay(data);
    if (data.action === "result") return onReceiveResult(data);
  });
});

/** Côté joueur ciblé : lance le mini-jeu reçu et renvoie le résultat au MJ. */
function onReceivePlay(data) {
  if (!Array.isArray(data.targets) || !data.targets.includes(game.user.id)) return;
  // Seul un MJ peut soumettre un mini-jeu : on vérifie que l'expéditeur déclaré
  // est bien un MJ connu du monde avant d'afficher quoi que ce soit au joueur.
  if (typeof data.fromId !== "string" || !game.users.get(data.fromId)?.isGM) return;
  const record = data.game;
  // Enregistrement bien formé attendu : { name: string, type: string, config?: object }.
  if (!record || typeof record !== "object") return;
  if (typeof record.name !== "string" || typeof record.type !== "string") return;
  if (record.config != null && typeof record.config !== "object") return;
  const report = (success, reason = null) => game.socket.emit(SOCKET, {
    action: "result", toId: data.fromId, userId: game.user.id,
    gameName: record.name, success, reason
  });
  api.play(record, {
    onSuccess: () => report(true),
    onFailure: () => report(false),
    onAbort: () => report(false, "no-picks")
  });
}

/** Côté MJ demandeur : notifie le résultat d'un joueur (succès / échec / impossible). */
function onReceiveResult(data) {
  if (typeof data.toId !== "string" || data.toId !== game.user.id) return;
  // Durcissement : champs attendus présents et types cohérents, sinon on ignore.
  if (typeof data.userId !== "string" || typeof data.gameName !== "string") return;
  if (typeof data.success !== "boolean") return;
  if (data.reason != null && typeof data.reason !== "string") return;
  // L'expéditeur déclaré doit correspondre à un utilisateur réel du monde
  // (on ne peut pas vérifier l'origine socket côté client, mais on refuse au
  // moins les identifiants inventés).
  const sender = game.users?.get(data.userId);
  if (!sender) return;
  const who = sender.name ?? "?";
  const key = data.reason === "no-picks"
    ? "HSLP.MG.ResultNoPicks"
    : (data.success ? "HSLP.MG.ResultSuccess" : "HSLP.MG.ResultFail");
  const msg = game.i18n.format(key, { name: who, game: data.gameName });
  ui.notifications?.[data.success ? "info" : "warn"](msg);
  ChatMessage.create({
    content: `<p><i class="fa-solid fa-gamepad"></i> ${msg}</p>`,
    whisper: [game.user.id]
  });
}

/**
 * HolySheet Lockpicking — Fenêtre du mini-jeu.
 *
 * Choix d'architecture (API Foundry VTT v14) :
 *  - On étend `ApplicationV2` via `HandlebarsApplicationMixin`, importés depuis
 *    le namespace officiel `foundry.applications.api`. C'est la base recommandée
 *    en v13/v14 pour une fenêtre custom (ni feuille d'acteur, ni dialogue).
 *  - Le HUD est décrit dans un gabarit Handlebars (PARTS.main).
 *  - Le verrou animé est peint en Canvas 2D dans une boucle requestAnimationFrame :
 *    rotations fluides + tremblement, impossibles proprement en CSS seul.
 *  - Les écouteurs souris/clavier sont attachés dans `_onRender` (en v14 seuls les
 *    clics `[data-action]` sont câblés automatiquement ; tout le reste se fait ici).
 */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export const MODULE_ID = "holysheet-lockpicking";

/**
 * Réglages de difficulté.
 * `sweet` = demi-largeur (en degrés) de la zone parfaite autour du point secret.
 * Plus c'est petit, plus il faut être précis pour ouvrir.
 */
export const DIFFICULTY = {
  novice:     { sweet: 16 },
  apprentice: { sweet: 11 },
  adept:      { sweet: 8 },
  expert:     { sweet: 5 },
  master:     { sweet: 3 }
};

export class HolySheetLockpickingApp extends HandlebarsApplicationMixin(ApplicationV2) {

  /**
   * @param {object} config
   * @param {string}   [config.difficulty]   Clé de DIFFICULTY (sinon réglage du module).
   * @param {number}   [config.picks]         Nombre de crochets (sinon déduit de l'acteur/réglage).
   * @param {Actor}    [config.actor]         Acteur consommant les crochets.
   * @param {Function} [config.onSuccess]     Callback en cas de réussite.
   * @param {Function} [config.onFailure]     Callback en cas d'échec total.
   * @param {string}   [config.title]         Titre de la fenêtre.
   */
  constructor(config = {}, options = {}) {
    super(options);
    this.config = config;

    // --- État de jeu ---------------------------------------------------------
    this.picksRemaining = config.picks ?? 5;
    this.pickAngle = 90;          // Angle du crochet (0=droite, 90=haut, 180=gauche)
    this.sweetSpot = 90;          // Point secret (défini aléatoirement à chaque crochet)
    this.cylinder = 0;            // Rotation actuelle du barillet (0 → 90 = ouvert)
    this.damage = 0;              // Dégâts accumulés sur le crochet (0 → 100 = casse)
    this.forcing = false;         // Le joueur applique-t-il la tension ?
    this.closeness = 0;           // Proximité [0..1] au point secret (calcul interne)
    this.finished = false;        // Partie terminée (succès/échec) ?
    this._lastTime = 0;           // Horodatage de la frame précédente (pour le delta)

    this._randomizeSweetSpot();
  }

  /* -------------------------------------------- */
  /*  Options & gabarits (API v14)                */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: "hslp-lockpicking-app",
    classes: ["holysheet", "hs-theme-lueur", "hslp-lockpicking-window"],
    position: { width: 460, height: "auto" },
    window: {
      title: "HSLP.Title",
      icon: "fa-solid fa-lock",
      resizable: false
    }
  };

  /** @inheritDoc — une seule PART rendue depuis le gabarit Handlebars. */
  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/lockpicking.hbs` }
  };

  /** Titre dynamique (permet de passer un titre custom via la config). */
  get title() {
    return this.config.title ?? game.i18n.localize("HSLP.Title");
  }

  /* -------------------------------------------- */
  /*  Préparation du contexte (HUD)               */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.picks = this.picksRemaining;
    context.statusText = game.i18n.localize("HSLP.Status.Idle");
    return context;
  }

  /* -------------------------------------------- */
  /*  Cycle de vie du rendu                       */
  /* -------------------------------------------- */

  /** @inheritDoc — câblage des écouteurs + démarrage de la boucle d'animation. */
  _onRender(context, options) {
    super._onRender?.(context, options);

    this.canvas = this.element.querySelector(".hslp-lp__canvas");
    this.ctx = this.canvas.getContext("2d");
    this.statusEl = this.element.querySelector("[data-status]");
    this.pickCountEl = this.element.querySelector("[data-pick-count]");

    // Souris : oriente le crochet en fonction de la position du curseur sur le canevas.
    this._onMouseMove = (ev) => this._updatePickAngle(ev);
    this.canvas.addEventListener("mousemove", this._onMouseMove);

    // Clavier : la tension est appliquée tant que Z / Flèche Haut est maintenue.
    this._onKeyDown = (ev) => {
      if (this._isTensionKey(ev) && !this.finished) {
        ev.preventDefault();
        this.forcing = true;
      }
    };
    this._onKeyUp = (ev) => {
      if (this._isTensionKey(ev)) this.forcing = false;
    };
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);

    // Boucle d'animation.
    this._lastTime = performance.now();
    this._raf = requestAnimationFrame((t) => this._tick(t));
  }

  /** @inheritDoc — nettoyage complet (écouteurs + boucle) pour éviter les fuites. */
  async _preClose(options) {
    cancelAnimationFrame(this._raf);
    this.canvas?.removeEventListener("mousemove", this._onMouseMove);
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    return super._preClose?.(options);
  }

  /* -------------------------------------------- */
  /*  Entrées joueur                              */
  /* -------------------------------------------- */

  _isTensionKey(ev) {
    return ev.code === "KeyZ" || ev.code === "ArrowUp";
  }

  /**
   * Calcule l'angle du crochet à partir de la souris : on prend l'angle
   * géométrique entre le centre du barillet et le curseur, borné à [0, 180]
   * (demi-cercle supérieur), à la manière des mini-jeux de crochetage classiques.
   */
  _updatePickAngle(ev) {
    const rect = this.canvas.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = ev.clientX - cx;
    const dy = ev.clientY - cy;
    // atan2(-dy, dx) : Y est inversé (écran), 0°=droite, 90°=haut, 180°=gauche.
    let deg = Math.atan2(-dy, dx) * 180 / Math.PI;
    this.pickAngle = Math.max(0, Math.min(180, deg));
  }

  /* -------------------------------------------- */
  /*  Logique de jeu                              */
  /* -------------------------------------------- */

  _randomizeSweetSpot() {
    // Évite les extrêmes (20°..160°) pour rester confortable à la souris.
    this.sweetSpot = 20 + Math.random() * 140;
  }

  get _sweetWidth() {
    const key = this.config.difficulty
      ?? game.settings.get(MODULE_ID, "difficulty")
      ?? "adept";
    return (DIFFICULTY[key] ?? DIFFICULTY.adept).sweet;
  }

  /**
   * Met à jour la physique du verrou pour un delta de temps `dt` (en secondes).
   * - Proximité : 1 au point secret, → 0 en s'en éloignant.
   * - Tension appliquée : le barillet tourne vers sa cible.
   *   - Dans la zone parfaite → il atteint 90° (= ouvert).
   *   - Hors zone → il cale plus bas et le crochet prend des dégâts (tremble).
   */
  _update(dt) {
    if (this.finished) return;

    const within = Math.abs(this.pickAngle - this.sweetSpot);
    const sweet = this._sweetWidth;
    // Fenêtre d'influence ~ 6x la zone parfaite pour un retour visuel progressif.
    const influence = sweet * 6;
    this.closeness = Math.max(0, Math.min(1, 1 - within / influence));

    if (this.forcing) {
      const inSweet = within <= sweet;
      // Cible de rotation : 90° si parfait, sinon cale sous 90 proportionnellement.
      const target = inSweet ? 90 : Math.min(78, 90 * this.closeness * 0.9);
      this.cylinder += (target - this.cylinder) * Math.min(1, dt * 7);

      if (!inSweet) {
        // Plus on est loin, plus on abîme vite le crochet.
        const factor = Math.min(1, (within - sweet) / 90);
        this.damage += dt * 130 * factor;
        if (this.damage >= 100) return this._breakPick();
      }

      // Réussite : barillet quasiment à 90°.
      if (this.cylinder >= 89) return this._succeed();
    } else {
      // Tension relâchée : le barillet et les dégâts retombent.
      this.cylinder += (0 - this.cylinder) * Math.min(1, dt * 10);
      this.damage = Math.max(0, this.damage - dt * 40);
    }
  }

  async _breakPick() {
    this.damage = 0;
    this.cylinder = 0;
    this.forcing = false;
    await this._consumePick();

    if (this.picksRemaining <= 0) {
      this._setStatus("HSLP.Status.OutOfPicks");
      return this._fail();
    }
    this._setStatus("HSLP.Status.PickBroke");
    this._randomizeSweetSpot();            // Nouveau verrou à « sentir ».
    if (this.pickCountEl) this.pickCountEl.textContent = this.picksRemaining;
  }

  _succeed() {
    if (this.finished) return;
    this.finished = true;
    this.cylinder = 90;
    this._setStatus("HSLP.Status.Success");
    ui.notifications?.info(game.i18n.localize("HSLP.Notify.Success"));
    try { this.config.onSuccess?.(); } catch (e) { console.error(`${MODULE_ID} | onSuccess`, e); }
    setTimeout(() => this.close(), 900);   // Laisse voir le barillet ouvert.
  }

  _fail() {
    if (this.finished) return;
    this.finished = true;
    ui.notifications?.warn(game.i18n.localize("HSLP.Notify.Failure"));
    try { this.config.onFailure?.(); } catch (e) { console.error(`${MODULE_ID} | onFailure`, e); }
    setTimeout(() => this.close(), 900);
  }

  /**
   * Consomme un crochet :
   *  1. décrémente le compteur interne ;
   *  2. si l'acteur possède un objet « crochet », décrémente sa quantité (ou le supprime).
   */
  async _consumePick() {
    this.picksRemaining -= 1;

    const actor = this.config.actor;
    if (!actor) return;

    const needle = (game.settings.get(MODULE_ID, "pickItemName") || "crochet").toLowerCase();
    const item = actor.items?.find((i) => i.name?.toLowerCase().includes(needle));
    if (!item) return;

    const qty = foundry.utils.getProperty(item, "system.quantity");
    if (typeof qty !== "number") return;          // Système sans quantité : on ignore.
    if (qty <= 1) await item.delete();
    else await item.update({ "system.quantity": qty - 1 });
  }

  _setStatus(key) {
    if (this.statusEl) this.statusEl.textContent = game.i18n.localize(key);
  }

  /* -------------------------------------------- */
  /*  Boucle & rendu Canvas                       */
  /* -------------------------------------------- */

  _tick(now) {
    const dt = Math.min(0.05, (now - this._lastTime) / 1000); // delta borné (anti-saut)
    this._lastTime = now;

    this._update(dt);
    this._draw();

    // Statut « en train de forcer » (sans écraser succès/casse).
    if (!this.finished && this.statusEl) {
      const txt = this.forcing ? "HSLP.Status.Forcing" : "HSLP.Status.Idle";
      const localized = game.i18n.localize(txt);
      if (this.statusEl.textContent !== localized
          && ![game.i18n.localize("HSLP.Status.PickBroke")].includes(this.statusEl.textContent)) {
        this.statusEl.textContent = localized;
      }
    }

    this._raf = requestAnimationFrame((t) => this._tick(t));
  }

  _draw() {
    const ctx = this.ctx;
    if (!ctx) return;
    const W = this.canvas.width, H = this.canvas.height;
    const cx = W / 2, cy = H / 2;
    const R = 150; // Rayon du barillet.

    ctx.clearRect(0, 0, W, H);

    // --- Plaque externe du verrou -------------------------------------------
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R + 26, 0, Math.PI * 2);
    ctx.fillStyle = "#1b1916";
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#3a352d";
    ctx.stroke();
    ctx.restore();

    // --- Barillet rotatif (la serrure qui tourne vers l'ouverture) -----------
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-this.cylinder * Math.PI / 180); // sens horaire visuel vers l'ouvert
    // Corps du barillet
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(0, -40, 20, 0, 0, R);
    grad.addColorStop(0, "#6e6657");
    grad.addColorStop(1, "#2e2a23");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#8a7f6a";
    ctx.stroke();
    // Trou de serrure (fente verticale au repos, pivote avec le barillet)
    ctx.fillStyle = "#0d0c0a";
    ctx.beginPath();
    ctx.arc(0, -34, 22, 0, Math.PI * 2);   // partie ronde
    ctx.fill();
    ctx.fillRect(-12, -34, 24, 96);        // fente
    ctx.restore();

    // --- Crochet (suit la souris ; tremble quand on force au mauvais endroit) -
    let angle = this.pickAngle;
    if (this.forcing && this.closeness < 0.9 && !this.finished) {
      const shakeAmp = 2 + (this.damage / 100) * 9;
      angle += (Math.random() - 0.5) * shakeAmp;
    }
    const a = angle * Math.PI / 180;
    const dir = { x: Math.cos(a), y: -Math.sin(a) };
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineCap = "round";
    // Tige du crochet
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(dir.x * (R + 14), dir.y * (R + 14));
    ctx.lineWidth = 7;
    ctx.strokeStyle = "#d9d2c4";
    ctx.stroke();
    // Reflet
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(dir.x * (R + 14), dir.y * (R + 14));
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#fffdf6";
    ctx.stroke();
    // Pointe recourbée
    ctx.beginPath();
    ctx.arc(dir.x * (R + 14), dir.y * (R + 14), 5, 0, Math.PI * 2);
    ctx.fillStyle = "#bfb6a3";
    ctx.fill();
    ctx.restore();

    // --- Clé de tension (tournevis) en bas : s'incline quand on force ---------
    ctx.save();
    ctx.translate(cx, cy + R + 8);
    ctx.rotate((this.forcing ? -0.35 : 0) - this.cylinder * Math.PI / 180 * 0.4);
    ctx.fillStyle = "#9c8f76";
    ctx.fillRect(-9, 0, 18, 120);
    ctx.fillStyle = "#6f6657";
    ctx.fillRect(-13, 100, 26, 34);
    ctx.restore();

    // --- Jauge de dégâts du crochet ------------------------------------------
    if (this.damage > 1 && !this.finished) {
      const w = (R * 2) * (this.damage / 100);
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(cx - R, H - 16, R * 2, 8);
      ctx.fillStyle = this.damage > 70 ? "#c0392b" : "#c9a227";
      ctx.fillRect(cx - R, H - 16, w, 8);
    }
  }
}

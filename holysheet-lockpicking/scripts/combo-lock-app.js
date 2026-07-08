/**
 * HolySheet Lockpicking — Cadenas à code (mini-jeu d'anneaux à logos).
 *
 * Second mini-jeu du module : un cadenas à combinaison façon « roues à
 * symboles ». Le joueur fait tourner chaque anneau pour aligner le bon logo
 * sur le repère central, puis tire sur l'anse pour tenter d'ouvrir.
 *
 * Choix d'architecture (identiques au crochetage, pour rester cohérent) :
 *  - On étend `ApplicationV2` via `HandlebarsApplicationMixin`.
 *  - Le HUD et la structure des anneaux sont décrits en Handlebars (PARTS.main),
 *    mais le CONTENU des anneaux (symbole courant + voisins) est peint en JS car
 *    il change à chaque rotation : on évite ainsi un re-render complet coûteux.
 *  - Les clics sont câblés via le système d'`actions` natif de l'ApplicationV2
 *    (data-action="rotate" / "attempt"), molette et clavier dans `_onRender`.
 *
 * Tout est paramétrable :
 *  - `rings`           : nombre d'anneaux.
 *  - `symbols`         : la liste des « chiffres » (logos FA, images ou texte).
 *  - `combination`     : la bonne combinaison (sinon tirée au sort).
 *  - `showHints`       : indique après un essai combien d'anneaux sont corrects.
 *  - `maxAttempts`     : nombre d'essais (0 = illimité).
 */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export const COMBO_MODULE_ID = "holysheet-lockpicking";

/**
 * Jeu de symboles par défaut (icônes Font Awesome livrées avec Foundry).
 * Chaque entrée est un « chiffre » du cadenas. Remplaçable intégralement via
 * la config `symbols` ou le réglage de monde `comboSymbols`.
 */
export const DEFAULT_COMBO_SYMBOLS = [
  { icon: "fa-solid fa-skull" },
  { icon: "fa-solid fa-heart" },
  { icon: "fa-solid fa-star" },
  { icon: "fa-solid fa-moon" },
  { icon: "fa-solid fa-bolt" },
  { icon: "fa-solid fa-leaf" },
  { icon: "fa-solid fa-gem" },
  { icon: "fa-solid fa-crown" }
];

export class HolySheetComboLockApp extends HandlebarsApplicationMixin(ApplicationV2) {

  /**
   * @param {object}   config
   * @param {number}   [config.rings=3]        Nombre d'anneaux.
   * @param {Array}    [config.symbols]        « Chiffres » : [{icon}|{img}|{text}, ...].
   * @param {number[]} [config.combination]    Bonne combinaison (indices dans symbols).
   * @param {boolean}  [config.showHints=true] Affiche le nb d'anneaux corrects après un essai.
   * @param {number}   [config.maxAttempts=0]  Essais autorisés (0 = illimité).
   * @param {Function} [config.onSuccess]      Callback en cas d'ouverture.
   * @param {Function} [config.onFailure]      Callback en cas d'échec (essais épuisés).
   * @param {string}   [config.title]          Titre de la fenêtre.
   */
  constructor(config = {}, options = {}) {
    super(options);
    this.config = config;

    // --- Symboles (les « chiffres » du cadenas) ------------------------------
    this.symbols = HolySheetComboLockApp._normalizeSymbols(config.symbols);
    const symCount = this.symbols.length;

    // --- Anneaux -------------------------------------------------------------
    this.rings = Math.max(1, Math.floor(config.rings ?? 3));

    // --- Combinaison gagnante (fournie ou tirée au sort) ---------------------
    this.combination = Array.isArray(config.combination) && config.combination.length === this.rings
      ? config.combination.map((v) => ((v % symCount) + symCount) % symCount)
      : Array.from({ length: this.rings }, () => Math.floor(Math.random() * symCount));

    // --- Position courante de chaque anneau ----------------------------------
    // On décale chaque anneau pour ne PAS démarrer sur la solution.
    this.positions = this.combination.map((sol) => {
      if (symCount === 1) return 0;
      const offset = 1 + Math.floor(Math.random() * (symCount - 1));
      return (sol + offset) % symCount;
    });

    // --- État ----------------------------------------------------------------
    this.showHints = config.showHints ?? true;
    this.maxAttempts = Math.max(0, Math.floor(config.maxAttempts ?? 0));
    this.attempts = 0;
    this.finished = false;
  }

  /* -------------------------------------------- */
  /*  Normalisation des symboles                  */
  /* -------------------------------------------- */

  /**
   * Accepte plusieurs formats pratiques et renvoie toujours des objets symbole :
   *  - "fa-solid fa-star"            → { icon: "fa-solid fa-star" }
   *  - "A" / "7"                     → { text: "A" }
   *  - "modules/.../rune.png"        → { img: "..." }
   *  - { icon|img|text|label }       → conservé tel quel.
   */
  static _normalizeSymbols(symbols) {
    const src = (Array.isArray(symbols) && symbols.length) ? symbols : DEFAULT_COMBO_SYMBOLS;
    const out = src.map((s) => {
      if (s && typeof s === "object") return s;
      const str = String(s).trim();
      if (str.includes("fa-")) return { icon: str.includes("fa-solid") || str.includes("fa-regular") || str.includes("fa-brands") ? str : `fa-solid ${str}` };
      if (/\.(png|jpe?g|webp|svg|gif)$/i.test(str)) return { img: str };
      return { text: str };
    });
    // Un cadenas a besoin d'au moins 2 symboles distincts pour être un jeu.
    return out.length >= 2 ? out : DEFAULT_COMBO_SYMBOLS;
  }

  /** Construit le HTML d'un symbole (logo, image ou texte). */
  static symbolHtml(sym) {
    if (!sym) return "";
    if (sym.icon) return `<i class="${sym.icon}"></i>`;
    if (sym.img) return `<img src="${sym.img}" alt="${sym.label ?? ""}" />`;
    return `<span class="combo-lock__glyph">${sym.text ?? sym.label ?? "?"}</span>`;
  }

  /* -------------------------------------------- */
  /*  Options & gabarits (API v14)                */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: "hslp-combo-lock-app",
    classes: ["holysheet", "hs-theme-lueur", "hslp-lockpicking-window", "hslp-combo-lock-window"],
    position: { width: "auto", height: "auto" },
    window: {
      title: "HSLP.Combo.Title",
      icon: "fa-solid fa-lock",
      resizable: false
    },
    // Système d'actions natif de l'ApplicationV2 : câble les clics data-action.
    actions: {
      rotate: HolySheetComboLockApp.#onRotate,
      attempt: HolySheetComboLockApp.#onAttempt
    }
  };

  /** @inheritDoc */
  static PARTS = {
    main: { template: `modules/${COMBO_MODULE_ID}/templates/combolock.hbs` }
  };

  /** Titre dynamique. */
  get title() {
    return this.config.title ?? game.i18n.localize("HSLP.Combo.Title");
  }

  /* -------------------------------------------- */
  /*  Contexte de rendu (structure statique)      */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    // Liste des anneaux pour la boucle Handlebars (le contenu est rempli en JS).
    context.ringList = Array.from({ length: this.rings }, (_, i) => ({ index: i }));
    context.statusText = game.i18n.localize("HSLP.Combo.Status.Idle");
    context.attemptsLabel = this._attemptsLabel();
    return context;
  }

  /* -------------------------------------------- */
  /*  Cycle de vie du rendu                       */
  /* -------------------------------------------- */

  /** @inheritDoc — peint le contenu des anneaux et câble molette/clavier. */
  _onRender(context, options) {
    super._onRender?.(context, options);

    this.statusEl = this.element.querySelector("[data-status]");
    this.attemptsEl = this.element.querySelector("[data-attempts]");

    // Remplit chaque anneau avec son symbole courant + voisins.
    for (let i = 0; i < this.rings; i++) this._renderRing(i);

    // Molette : fait défiler l'anneau survolé.
    this._onWheel = (ev) => {
      const ringEl = ev.target.closest?.("[data-ring]");
      if (!ringEl || this.finished) return;
      ev.preventDefault();
      const ring = Number(ringEl.dataset.ring);
      this._rotate(ring, ev.deltaY > 0 ? 1 : -1);
    };
    this.element.addEventListener("wheel", this._onWheel, { passive: false });

    // Clavier : ←/→ change d'anneau actif, ↑/↓ le fait tourner, Entrée tente l'ouverture.
    this._active = 0;
    this._highlightActive();
    this._onKeyDown = (ev) => {
      if (this.finished) return;
      switch (ev.code) {
        case "ArrowLeft":  this._active = (this._active - 1 + this.rings) % this.rings; this._highlightActive(); break;
        case "ArrowRight": this._active = (this._active + 1) % this.rings; this._highlightActive(); break;
        case "ArrowUp":    this._rotate(this._active, -1); break;
        case "ArrowDown":  this._rotate(this._active, 1); break;
        case "Enter":      this._attempt(); break;
        default: return;
      }
      ev.preventDefault();
    };
    window.addEventListener("keydown", this._onKeyDown);
  }

  /** @inheritDoc — nettoyage des écouteurs. */
  async _preClose(options) {
    this.element?.removeEventListener("wheel", this._onWheel);
    window.removeEventListener("keydown", this._onKeyDown);
    return super._preClose?.(options);
  }

  /* -------------------------------------------- */
  /*  Rendu d'un anneau (3 symboles visibles)     */
  /* -------------------------------------------- */

  _renderRing(i) {
    const n = this.symbols.length;
    const cur = this.positions[i];
    const prev = (cur - 1 + n) % n;
    const next = (cur + 1) % n;
    const ringEl = this.element.querySelector(`[data-ring="${i}"]`);
    if (!ringEl) return;
    ringEl.querySelector("[data-slot='prev']").innerHTML = HolySheetComboLockApp.symbolHtml(this.symbols[prev]);
    ringEl.querySelector("[data-slot='cur']").innerHTML = HolySheetComboLockApp.symbolHtml(this.symbols[cur]);
    ringEl.querySelector("[data-slot='next']").innerHTML = HolySheetComboLockApp.symbolHtml(this.symbols[next]);
  }

  _highlightActive() {
    this.element.querySelectorAll("[data-ring]").forEach((el) => {
      el.classList.toggle("combo-lock__ring--active", Number(el.dataset.ring) === this._active);
    });
  }

  /* -------------------------------------------- */
  /*  Logique de jeu                              */
  /* -------------------------------------------- */

  _rotate(ring, dir) {
    if (this.finished) return;
    const n = this.symbols.length;
    this.positions[ring] = (this.positions[ring] + dir + n) % n;
    this._active = ring;
    this._renderRing(ring);
    this._highlightActive();
    // Petite animation de cran.
    const ringEl = this.element.querySelector(`[data-ring="${ring}"]`);
    ringEl?.classList.remove("combo-lock__ring--tick");
    void ringEl?.offsetWidth;                       // reflow → relance l'animation
    ringEl?.classList.add("combo-lock__ring--tick");
  }

  _isSolved() {
    return this.positions.every((p, i) => p === this.combination[i]);
  }

  _correctCount() {
    return this.positions.reduce((acc, p, i) => acc + (p === this.combination[i] ? 1 : 0), 0);
  }

  _attempt() {
    if (this.finished) return;

    if (this._isSolved()) return this._succeed();

    // Essai raté.
    this.attempts += 1;
    this.element.querySelector(".combo-lock")?.classList.remove("combo-lock--shake");
    void this.element.offsetWidth;
    this.element.querySelector(".combo-lock")?.classList.add("combo-lock--shake");

    if (this.showHints) {
      const ok = this._correctCount();
      this._setStatusText(game.i18n.format("HSLP.Combo.Status.Hint", { ok, total: this.rings }));
    } else {
      this._setStatusText(game.i18n.localize("HSLP.Combo.Status.Wrong"));
    }

    if (this.attemptsEl) this.attemptsEl.textContent = this._attemptsLabel();

    if (this.maxAttempts > 0 && this.attempts >= this.maxAttempts) return this._fail();
  }

  _succeed() {
    if (this.finished) return;
    this.finished = true;
    this.element.querySelector(".combo-lock")?.classList.add("combo-lock--open");
    this._setStatusText(game.i18n.localize("HSLP.Combo.Status.Success"));
    ui.notifications?.info(game.i18n.localize("HSLP.Combo.Notify.Success"));
    try { this.config.onSuccess?.(); } catch (e) { console.error(`${COMBO_MODULE_ID} | onSuccess`, e); }
    setTimeout(() => this.close(), 1100);
  }

  _fail() {
    if (this.finished) return;
    this.finished = true;
    this._setStatusText(game.i18n.localize("HSLP.Combo.Status.OutOfAttempts"));
    ui.notifications?.warn(game.i18n.localize("HSLP.Combo.Notify.Failure"));
    try { this.config.onFailure?.(); } catch (e) { console.error(`${COMBO_MODULE_ID} | onFailure`, e); }
    setTimeout(() => this.close(), 1100);
  }

  _attemptsLabel() {
    if (this.maxAttempts <= 0) return "∞";
    return `${Math.max(0, this.maxAttempts - this.attempts)}`;
  }

  _setStatusText(text) {
    if (this.statusEl) this.statusEl.textContent = text;
  }

  /* -------------------------------------------- */
  /*  Gestionnaires d'actions (clics)             */
  /* -------------------------------------------- */

  /** Bouton ▲/▼ d'un anneau. data-ring + data-dir portés par le bouton. */
  static #onRotate(event, target) {
    const ring = Number(target.dataset.ring);
    const dir = Number(target.dataset.dir);
    this._rotate(ring, dir);
  }

  /** Bouton/anse « tenter l'ouverture ». */
  static #onAttempt(event, target) {
    this._attempt();
  }
}

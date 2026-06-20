/**
 * Skyrim Lockpicking — Éditeur de mini-jeu (création / modification).
 *
 * Même fenêtre de configuration qu'avant, mais découplée des portes : elle
 * édite un enregistrement de mini-jeu (nom + type + réglages) puis le renvoie
 * via `onSave`. Aucun lien avec un mur. Le bouton « Tester » lance le mini-jeu
 * localement ; « Enregistrer » sauvegarde dans la collection.
 *
 * Tout est réglé au clic (choix du type, palette de logos cliquable, combinaison
 * réglée anneau par anneau, ajout de logos perso) — aucun code ni numéro à taper.
 */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export const MODULE_ID = "holysheet-lockpicking";

/** Difficultés de crochetage proposées. */
const DIFFICULTIES = ["novice", "apprentice", "adept", "expert", "master"];

/** Palette de logos proposés au MJ (icônes Font Awesome livrées avec Foundry). */
export const ICON_PALETTE = [
  "fa-solid fa-skull", "fa-solid fa-heart", "fa-solid fa-star", "fa-solid fa-moon",
  "fa-solid fa-sun", "fa-solid fa-bolt", "fa-solid fa-leaf", "fa-solid fa-gem",
  "fa-solid fa-crown", "fa-solid fa-key", "fa-solid fa-fire", "fa-solid fa-snowflake",
  "fa-solid fa-droplet", "fa-solid fa-ghost", "fa-solid fa-dragon", "fa-solid fa-hat-wizard",
  "fa-solid fa-ring", "fa-solid fa-coins", "fa-solid fa-scroll", "fa-solid fa-shield-halved",
  "fa-solid fa-spider", "fa-solid fa-eye", "fa-solid fa-paw", "fa-solid fa-anchor",
  "fa-solid fa-feather", "fa-solid fa-bone", "fa-solid fa-cross", "fa-solid fa-chess-knight",
  "fa-solid fa-tree", "fa-solid fa-mountain", "fa-solid fa-bell", "fa-solid fa-compass"
];

export class SkyrimMinigameEditor extends HandlebarsApplicationMixin(ApplicationV2) {

  /**
   * @param {object}   config
   * @param {object}   [config.record]    Enregistrement existant { id, name, type, config }.
   * @param {string}   [config.folder]    Dossier de destination pour un nouveau mini-jeu.
   * @param {Function} config.onSave      Reçoit l'enregistrement finalisé à la sauvegarde.
   */
  constructor(config = {}, options = {}) {
    super(options);
    this.onSave = config.onSave;

    const rec = config.record ?? {};
    this.recordId = rec.id ?? null;
    this.folder = rec.folder ?? config.folder ?? null;
    this.name = rec.name ?? "";
    this.lockType = rec.type ?? "pick";

    const c = rec.config ?? {};

    // Crochetage. picks = 0 → automatique (inventaire du joueur).
    this.difficulty = c.difficulty ?? game.settings.get(MODULE_ID, "difficulty");
    this.picks = c.picks ?? 0;

    // Cadenas à code.
    this.pool = Array.isArray(c.symbols) && c.symbols.length >= 2
      ? c.symbols.map((s) => (typeof s === "string" ? s : s.icon ?? s.text ?? s.img)).filter(Boolean)
      : ICON_PALETTE.slice(0, 4);
    this.rings = Math.max(1, Math.min(8, c.rings ?? game.settings.get(MODULE_ID, "comboRings")));
    this.combination = Array.isArray(c.combination) && c.combination.length === this.rings
      ? c.combination.map((v) => ((v % this.pool.length) + this.pool.length) % this.pool.length)
      : Array.from({ length: this.rings }, () => 0);
    this.showHints = c.showHints ?? true;
    this.maxAttempts = Math.max(0, c.maxAttempts ?? 0);

    // Palette affichée = palette de base + logos perso déjà utilisés.
    this.palette = [...ICON_PALETTE];
    for (const s of this.pool) if (!this.palette.includes(s)) this.palette.push(s);
  }

  /** Construit le HTML d'un logo (classe FA, image ou texte/emoji). */
  static glyphHtml(entry) {
    const s = String(entry ?? "");
    if (s.includes("fa-")) return `<i class="${s}"></i>`;
    if (/\.(png|jpe?g|webp|svg|gif)$/i.test(s) || s.includes("/")) return `<img src="${s}" alt="" />`;
    return `<span class="lock-config__glyph">${s}</span>`;
  }

  /* -------------------------------------------- */
  /*  Options & gabarit                           */
  /* -------------------------------------------- */

  static DEFAULT_OPTIONS = {
    id: "skyrim-minigame-editor",
    classes: ["skyrim-lockpicking-window", "skyrim-lock-config-window"],
    position: { width: 480, height: "auto" },
    window: { title: "SKYRIM_LP.Config.Title", icon: "fa-solid fa-gear", resizable: false }
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/lockconfig.hbs` }
  };

  get title() {
    return this.recordId
      ? game.i18n.localize("SKYRIM_LP.Config.TitleEdit")
      : game.i18n.localize("SKYRIM_LP.Config.TitleNew");
  }

  /* -------------------------------------------- */
  /*  Contexte                                    */
  /* -------------------------------------------- */

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.name = this.name;
    context.difficulties = DIFFICULTIES.map((k) => ({
      key: k,
      label: game.i18n.localize(`SKYRIM_LP.Difficulty.${k}`),
      selected: k === this.difficulty
    }));
    context.lockType = this.lockType;
    context.picks = this.picks;
    context.rings = this.rings;
    context.showHints = this.showHints;
    context.maxAttempts = this.maxAttempts;
    return context;
  }

  /* -------------------------------------------- */
  /*  Rendu & écouteurs                           */
  /* -------------------------------------------- */

  _onRender(context, options) {
    super._onRender?.(context, options);
    this._onClick = (ev) => {
      const el = ev.target.closest?.("[data-act]");
      if (!el) return;
      ev.preventDefault();
      this._handleAction(el.dataset.act, el);
    };
    this.element.addEventListener("click", this._onClick);
    this._syncType();
    this._renderPalette();
    this._renderCombo();
  }

  async _preClose(options) {
    this.element?.removeEventListener("click", this._onClick);
    return super._preClose?.(options);
  }

  _handleAction(act, el) {
    switch (act) {
      case "type":       this.lockType = el.dataset.type; this._syncType(); break;
      case "rings-dec":  this._setRings(this.rings - 1); break;
      case "rings-inc":  this._setRings(this.rings + 1); break;
      case "pool":       this._togglePool(el.dataset.icon); break;
      case "add-custom": this._addCustom(); break;
      case "cycle":      this._cycleRing(Number(el.dataset.ring)); break;
      case "test":       this._test(); break;
      case "save":       this._save(); break;
      case "cancel":     this.close(); break;
    }
  }

  /* ------------------------------ Type ------------------------------- */

  _syncType() {
    this.element.querySelectorAll("[data-act='type']").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.type === this.lockType);
    });
    const pick = this.element.querySelector("[data-section='pick']");
    const combo = this.element.querySelector("[data-section='combo']");
    if (pick) pick.hidden = this.lockType !== "pick";
    if (combo) combo.hidden = this.lockType !== "combo";
  }

  /* ----------------------------- Anneaux ----------------------------- */

  _setRings(n) {
    n = Math.max(1, Math.min(8, n));
    if (n === this.rings) return;
    if (n > this.rings) while (this.combination.length < n) this.combination.push(0);
    else this.combination.length = n;
    this.rings = n;
    const out = this.element.querySelector("[data-ring-count]");
    if (out) out.textContent = String(n);
    this._renderCombo();
  }

  /* ----------------------------- Palette ----------------------------- */

  _togglePool(icon) {
    const i = this.pool.indexOf(icon);
    if (i >= 0) {
      if (this.pool.length <= 2) {
        ui.notifications?.warn(game.i18n.localize("SKYRIM_LP.Config.MinIcons"));
        return;
      }
      this.pool.splice(i, 1);
      this.combination = this.combination.map((v) => Math.min(v, this.pool.length - 1));
    } else {
      this.pool.push(icon);
    }
    this._renderPalette();
    this._renderCombo();
  }

  async _addCustom() {
    const { DialogV2 } = foundry.applications.api;
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;

    const content = `
      <div class="lock-config__custom">
        <p class="lock-config__hint">${game.i18n.localize("SKYRIM_LP.Config.CustomHint")}</p>
        <label class="lock-config__label">${game.i18n.localize("SKYRIM_LP.Config.CustomGlyph")}</label>
        <input type="text" name="glyph" placeholder="fa-solid fa-dog   •   🔥   •   A" />
        <label class="lock-config__label">${game.i18n.localize("SKYRIM_LP.Config.CustomImage")}</label>
        <div class="lock-config__custom-img">
          <input type="text" name="img" placeholder="modules/.../logo.png" />
          <button type="button" data-pick><i class="fa-solid fa-folder-open"></i></button>
        </div>
      </div>`;

    let result = null;
    await DialogV2.wait({
      window: { title: game.i18n.localize("SKYRIM_LP.Config.AddCustom"), icon: "fa-solid fa-plus" },
      content,
      rejectClose: false,
      render: (event, dialog) => {
        dialog.element.querySelector("[data-pick]")?.addEventListener("click", () => {
          new FP({ type: "image", callback: (path) => { dialog.element.querySelector("[name='img']").value = path; } }).render(true);
        });
      },
      buttons: [
        {
          action: "ok", label: game.i18n.localize("SKYRIM_LP.Config.Add"), default: true,
          callback: (event, button, dialog) => {
            result = {
              glyph: dialog.element.querySelector("[name='glyph']")?.value.trim() ?? "",
              img: dialog.element.querySelector("[name='img']")?.value.trim() ?? ""
            };
          }
        },
        { action: "cancel", label: game.i18n.localize("Cancel"), callback: () => { result = null; } }
      ]
    }).catch(() => { result = null; });

    if (!result) return;
    let entry = result.glyph || result.img;
    if (!entry) return;
    if (entry.startsWith("fa-") && !/(fa-solid|fa-regular|fa-brands)/.test(entry)) entry = `fa-solid ${entry}`;
    if (!this.palette.includes(entry)) this.palette.push(entry);
    if (!this.pool.includes(entry)) this.pool.push(entry);
    this._renderPalette();
    this._renderCombo();
  }

  _renderPalette() {
    const grid = this.element.querySelector("[data-palette]");
    if (!grid) return;
    grid.innerHTML = this.palette.map((ic) => {
      const on = this.pool.includes(ic);
      return `<button type="button" class="lock-config__chip ${on ? "is-on" : ""}"
                data-act="pool" data-icon="${ic}">${SkyrimMinigameEditor.glyphHtml(ic)}</button>`;
    }).join("");
  }

  /* --------------------------- Combinaison --------------------------- */

  _cycleRing(ring) {
    this.combination[ring] = (this.combination[ring] + 1) % this.pool.length;
    this._renderCombo();
  }

  _renderCombo() {
    const row = this.element.querySelector("[data-combo]");
    if (!row) return;
    row.innerHTML = this.combination.map((idx, i) => {
      const ic = this.pool[idx] ?? this.pool[0];
      return `<button type="button" class="lock-config__dial" data-act="cycle" data-ring="${i}"
                title="${game.i18n.localize("SKYRIM_LP.Config.CycleHint")}">
                ${SkyrimMinigameEditor.glyphHtml(ic)}
                <span class="lock-config__dial-no">${i + 1}</span>
              </button>`;
    }).join("");
  }

  /* ------------------------- Lecture du form ------------------------- */

  _readForm() {
    const nameIn = this.element.querySelector("[data-field='name']");
    if (nameIn) this.name = nameIn.value.trim();
    const diffSel = this.element.querySelector("[data-field='difficulty']");
    if (diffSel) this.difficulty = diffSel.value;
    const picksIn = this.element.querySelector("[data-field='picks']");
    if (picksIn) this.picks = Math.max(0, Number(picksIn.value) || 0);
    const hintsIn = this.element.querySelector("[data-field='showHints']");
    if (hintsIn) this.showHints = hintsIn.checked;
    const attIn = this.element.querySelector("[data-field='maxAttempts']");
    if (attIn) this.maxAttempts = Math.max(0, Number(attIn.value) || 0);
  }

  /** Construit l'enregistrement à partir de l'état courant. */
  _buildRecord() {
    const config = this.lockType === "combo"
      ? {
          rings: this.rings,
          symbols: this.pool.slice(),
          combination: this.combination.slice(),
          showHints: this.showHints,
          maxAttempts: this.maxAttempts
        }
      : { difficulty: this.difficulty, picks: this.picks };

    return {
      id: this.recordId ?? undefined,
      name: this.name || game.i18n.localize(`SKYRIM_LP.LockType.${this.lockType}`),
      type: this.lockType,
      folder: this.folder ?? null,
      config
    };
  }

  /* --------------------------- Actions ------------------------------- */

  _test() {
    this._readForm();
    const record = this._buildRecord();
    game.modules.get(MODULE_ID)?.api?.play(record, {
      preview: true,   // le MJ peut prévisualiser même sans crochet en inventaire
      onSuccess: () => ui.notifications?.info(game.i18n.localize("SKYRIM_LP.Config.TestSuccess"))
    });
  }

  async _save() {
    this._readForm();
    if (this.lockType === "combo" && this.pool.length < 2) {
      return ui.notifications?.warn(game.i18n.localize("SKYRIM_LP.Config.MinIcons"));
    }
    const record = this._buildRecord();
    try { await this.onSave?.(record); } catch (e) { console.error(`${MODULE_ID} | onSave`, e); }
    ui.notifications?.info(game.i18n.localize("SKYRIM_LP.Config.Saved"));
    this.close();
  }
}

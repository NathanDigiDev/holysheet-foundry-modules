/**
 * HolySheet Lockpicking — Entrée sidebar « Mini-Jeux ».
 *
 * On ajoute un bouton dans la sidebar de droite (MJ uniquement) qui OUVRE une
 * FENÊTRE-répertoire (plutôt qu'un panneau inline). C'est plus simple, plus
 * robuste, et conforme au souhait de l'utilisateur.
 *
 * Bouton : on CLONE un onglet existant (`cloneNode(true)`) pour hériter de la
 * structure/taille natives (sinon il ne s'empile pas et se colle à droite des
 * autres). On retire ensuite TOUTES les classes `fa-*` héritées du voisin avant
 * de poser notre icône — sinon double-icône → bouton trop large → mauvais
 * alignement.
 */

import { MinigamesPanel } from "./minigames-panel.js";

const MODULE_ID = "holysheet-lockpicking";
const TAB = "minigames";
const ICON = "fa-gamepad";

/** Installe le bouton de sidebar (MJ) et le réinstalle à chaque rendu. */
export function setupMinigamesSidebar() {
  if (!game.user?.isGM) return;
  Hooks.on("renderSidebar", (app, html) => injectTab(resolveRoot(html)));
  if (ui.sidebar?.element) injectTab(resolveRoot(ui.sidebar.element));
}

function resolveRoot(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  return document.getElementById("sidebar") ?? document;
}

function injectTab(root) {
  if (!root) return;
  const nav = root.querySelector("#sidebar-tabs") ?? document.getElementById("sidebar-tabs");
  if (!nav) return;
  if (nav.querySelector(`[data-tab="${TAB}"]`)) return;            // déjà présent

  const model = nav.querySelector('[data-tab="chat"]') ?? nav.querySelector("[data-tab]");
  if (!model) return;

  const button = model.cloneNode(true);
  button.setAttribute("data-tab", TAB);
  button.setAttribute("data-tooltip", game.i18n.localize("HSLP.MG.Tab"));
  button.setAttribute("aria-label", game.i18n.localize("HSLP.MG.Tab"));
  button.removeAttribute("data-action");                           // pas de navigation native
  button.classList.remove("active");

  // Retire TOUTES les classes fa-* héritées du voisin (évite la double-icône).
  Array.from(button.classList).filter((c) => c.startsWith("fa-")).forEach((c) => button.classList.remove(c));
  // Icône : sur un <i> interne si présent (anciennes versions), sinon sur le bouton (v13/v14).
  const inner = button.querySelector("i");
  if (inner) inner.className = `fa-solid ${ICON}`;
  else button.classList.add("fa-solid", ICON);

  // Retire d'éventuels badges (compteurs de notifications) clonés du chat.
  button.querySelectorAll(".notification-pip, .notification-count, .pip").forEach((n) => n.remove());

  // Clic → ouvre la fenêtre-répertoire.
  button.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    openMinigamesWindow();
  });

  // IMPORTANT : insérer dans le MÊME conteneur que le bouton modèle (en v14 les
  // boutons vivent souvent dans un enfant de <nav>, pas dans le <nav> direct ;
  // ajouter au <nav> plaçait l'onglet « à côté » de la colonne, à droite).
  // On l'insère juste après le bouton modèle pour qu'il s'empile avec les autres.
  model.insertAdjacentElement("afterend", button);
}

/* -------------------------------------------- */
/*  Fenêtre-répertoire                          */
/* -------------------------------------------- */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class MinigamesWindow extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "hslp-minigames-window",
    classes: ["holysheet", "hs-theme-lueur", "hslp-lockpicking-window", "hslp-minigames-window"],
    position: { width: 380, height: 580 },
    window: { title: "HSLP.MG.Tab", icon: "fa-solid fa-gamepad", resizable: true }
  };
  static PARTS = { main: { template: `modules/${MODULE_ID}/templates/minigames-window.hbs` } };

  get title() { return game.i18n.localize("HSLP.MG.Tab"); }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const host = this.element.querySelector("[data-mg-host]");
    if (host) {
      this._panel ??= new MinigamesPanel();
      this._panel.mount(host);
    }
  }
}

let _window;
export function openMinigamesWindow() {
  _window ??= new MinigamesWindow();
  _window.render(true);
  return _window;
}

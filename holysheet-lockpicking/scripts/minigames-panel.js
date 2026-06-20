/**
 * Skyrim Lockpicking — Panneau « Mini-Jeux » (répertoire réutilisable).
 *
 * Rend l'arborescence dossiers + mini-jeux dans un élément racine fourni, et
 * gère toutes les interactions (ajouter/éditer/supprimer/jouer, dossiers,
 * pli/dépli) via un écouteur délégué. Volontairement indépendant de la sidebar :
 * on peut le monter dans un onglet de sidebar OU dans une fenêtre.
 *
 * Réservé au MJ (c'est lui qui crée les mini-jeux et les soumet aux joueurs).
 */

import { MinigamesData, MODULE_ID } from "./minigames-data.js";
import { SkyrimMinigameEditor } from "./minigame-editor.js";

const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));

export class MinigamesPanel {

  /** @param {HTMLElement} root  Conteneur où peindre le répertoire. */
  mount(root) {
    if (!root) return;
    if (this.root === root) { this.render(); return; }

    // Détache les écouteurs de l'ancien conteneur (re-render possible).
    if (this.root && this._listeners) {
      for (const [type, fn] of this._listeners) this.root.removeEventListener(type, fn);
    }

    this.root = root;
    this._listeners = [
      ["click", (ev) => this._handleClick(ev)],
      ["dragstart", (ev) => this._onDragStart(ev)],
      ["dragover", (ev) => this._onDragOver(ev)],
      ["dragleave", (ev) => this._onDragLeave(ev)],
      ["drop", (ev) => this._onDrop(ev)],
      ["dragend", () => this._clearDrop()]
    ];
    for (const [type, fn] of this._listeners) this.root.addEventListener(type, fn);
    this.render();
  }

  /* -------------------------------------------- */
  /*  Rendu                                       */
  /* -------------------------------------------- */

  render() {
    if (!this.root) return;
    const store = MinigamesData.read();
    this.root.innerHTML = `
      <div class="mg">
        <header class="mg__toolbar">
          <button type="button" class="mg__btn" data-act="add-game">
            <i class="fa-solid fa-plus"></i> ${game.i18n.localize("SKYRIM_LP.MG.AddGame")}
          </button>
          <button type="button" class="mg__btn mg__btn--ghost" data-act="add-folder">
            <i class="fa-solid fa-folder-plus"></i> ${game.i18n.localize("SKYRIM_LP.MG.AddFolder")}
          </button>
        </header>
        <ol class="mg__tree">
          ${this._renderLevel(store, null)}
          ${store.folders.length === 0 && store.games.length === 0
            ? `<li class="mg__empty">${game.i18n.localize("SKYRIM_LP.MG.Empty")}</li>` : ""}
        </ol>
      </div>`;
  }

  /** Rend récursivement un niveau (dossiers puis mini-jeux du parent donné). */
  _renderLevel(store, parentId) {
    const folders = store.folders
      .filter((f) => (f.parent ?? null) === parentId)
      .sort((a, b) => a.sort - b.sort);
    const games = store.games
      .filter((g) => (g.folder ?? null) === parentId)
      .sort((a, b) => a.sort - b.sort);

    const folderHtml = folders.map((f) => {
      const open = f.expanded !== false;
      return `
        <li class="mg__folder ${open ? "is-open" : ""}" data-folder="${f.id}">
          <div class="mg__row mg__folder-row" data-act="toggle" data-id="${f.id}" draggable="true">
            <i class="mg__caret fa-solid ${open ? "fa-chevron-down" : "fa-chevron-right"}"></i>
            <i class="mg__icon fa-solid ${open ? "fa-folder-open" : "fa-folder"}"></i>
            <span class="mg__name">${esc(f.name)}</span>
            <span class="mg__actions">
              <a data-act="folder-add" data-id="${f.id}" title="${game.i18n.localize("SKYRIM_LP.MG.AddHere")}"><i class="fa-solid fa-plus"></i></a>
              <a data-act="folder-rename" data-id="${f.id}" title="${game.i18n.localize("SKYRIM_LP.MG.Rename")}"><i class="fa-solid fa-pen"></i></a>
              <a data-act="folder-delete" data-id="${f.id}" title="${game.i18n.localize("SKYRIM_LP.MG.Delete")}"><i class="fa-solid fa-trash"></i></a>
            </span>
          </div>
          ${open ? `<ol class="mg__children">${this._renderLevel(store, f.id)}</ol>` : ""}
        </li>`;
    }).join("");

    const gameHtml = games.map((g) => {
      const icon = g.type === "combo" ? "fa-lock" : "fa-screwdriver-wrench";
      const typeLabel = game.i18n.localize(`SKYRIM_LP.LockType.${g.type}`);
      return `
        <li class="mg__game" data-game="${g.id}">
          <div class="mg__row" draggable="true">
            <i class="mg__icon fa-solid ${icon}" title="${typeLabel}"></i>
            <span class="mg__name" data-act="game-play" data-id="${g.id}" title="${game.i18n.localize("SKYRIM_LP.MG.Submit")}">${esc(g.name)}</span>
            <span class="mg__actions">
              <a data-act="game-play" data-id="${g.id}" title="${game.i18n.localize("SKYRIM_LP.MG.Submit")}"><i class="fa-solid fa-paper-plane"></i></a>
              <a data-act="game-edit" data-id="${g.id}" title="${game.i18n.localize("SKYRIM_LP.MG.Edit")}"><i class="fa-solid fa-pen"></i></a>
              <a data-act="game-delete" data-id="${g.id}" title="${game.i18n.localize("SKYRIM_LP.MG.Delete")}"><i class="fa-solid fa-trash"></i></a>
            </span>
          </div>
        </li>`;
    }).join("");

    return folderHtml + gameHtml;
  }

  /* -------------------------------------------- */
  /*  Interactions                                */
  /* -------------------------------------------- */

  async _handleClick(ev) {
    const el = ev.target.closest?.("[data-act]");
    if (!el || !this.root.contains(el)) return;
    ev.preventDefault();
    ev.stopPropagation();
    const id = el.dataset.id;
    switch (el.dataset.act) {
      case "add-game":      return this._editGame(null, null);
      case "add-folder":    return this._createFolder(null);
      case "toggle":        await MinigamesData.toggleFolder(id); return this.render();
      case "folder-add":    return this._createFolder(id);
      case "folder-rename": return this._renameFolder(id);
      case "folder-delete": return this._deleteFolder(id);
      case "game-edit":     return this._editGame(MinigamesData.getGame(id), null);
      case "game-delete":   return this._deleteGame(id);
      case "game-play":     return this._submitGame(MinigamesData.getGame(id));
    }
  }

  /* ----------------------------- Drag & drop ------------------------- */

  _onDragStart(ev) {
    const li = ev.target.closest?.("[data-game], [data-folder]");
    if (!li) return;
    this._drag = li.dataset.game
      ? { type: "game", id: li.dataset.game }
      : { type: "folder", id: li.dataset.folder };
    try {
      ev.dataTransfer.effectAllowed = "move";
      ev.dataTransfer.setData("text/plain", this._drag.id);
    } catch (_) { /* certains navigateurs sont stricts */ }
  }

  /** Dossier de dépôt sous le curseur (le <li> dossier), ou null = racine. */
  _dropFolderId(ev) {
    const folderLi = ev.target.closest?.(".mg__folder");
    return folderLi ? folderLi.dataset.folder : null;
  }

  _onDragOver(ev) {
    if (!this._drag) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = "move";
    this._clearDrop();
    const folderLi = ev.target.closest?.(".mg__folder");
    if (folderLi) folderLi.classList.add("mg__dropover");
    else this.root.querySelector(".mg__tree")?.classList.add("mg__dropover-root");
  }

  _onDragLeave(ev) {
    const folderLi = ev.target.closest?.(".mg__folder");
    folderLi?.classList.remove("mg__dropover");
  }

  _clearDrop() {
    this.root?.querySelectorAll(".mg__dropover").forEach((e) => e.classList.remove("mg__dropover"));
    this.root?.querySelector(".mg__dropover-root")?.classList.remove("mg__dropover-root");
  }

  async _onDrop(ev) {
    if (!this._drag) return;
    ev.preventDefault();
    ev.stopPropagation();
    const targetFolder = this._dropFolderId(ev);   // null = racine
    const drag = this._drag;
    this._drag = null;
    this._clearDrop();

    if (drag.type === "game") {
      await MinigamesData.setGameFolder(drag.id, targetFolder);
    } else if (drag.type === "folder") {
      // Interdit : déposer un dossier dans lui-même ou un de ses descendants.
      if (targetFolder === drag.id || this._isDescendant(targetFolder, drag.id)) return this.render();
      const store = MinigamesData.read();
      const f = store.folders.find((x) => x.id === drag.id);
      if (f) await MinigamesData.upsertFolder({ ...f, parent: targetFolder });
    }
    this.render();
  }

  /** `candidate` est-il un descendant de `ancestorId` ? */
  _isDescendant(candidateId, ancestorId) {
    const store = MinigamesData.read();
    let cur = store.folders.find((x) => x.id === candidateId);
    const guard = new Set();
    while (cur && cur.parent && !guard.has(cur.id)) {
      if (cur.parent === ancestorId) return true;
      guard.add(cur.id);
      cur = store.folders.find((x) => x.id === cur.parent);
    }
    return false;
  }

  /* ------------------------------ Dossiers --------------------------- */

  async _createFolder(parentId) {
    const name = await this._promptText(game.i18n.localize("SKYRIM_LP.MG.NewFolder"), "");
    if (name == null) return;
    await MinigamesData.upsertFolder({ name: name || game.i18n.localize("SKYRIM_LP.MG.Folder"), parent: parentId ?? null });
    this.render();
  }

  async _renameFolder(id) {
    const store = MinigamesData.read();
    const f = store.folders.find((x) => x.id === id);
    if (!f) return;
    const name = await this._promptText(game.i18n.localize("SKYRIM_LP.MG.Rename"), f.name);
    if (name == null) return;
    await MinigamesData.upsertFolder({ ...f, name: name || f.name });
    this.render();
  }

  async _deleteFolder(id) {
    const ok = await this._confirm(game.i18n.localize("SKYRIM_LP.MG.DeleteFolderConfirm"));
    if (!ok) return;
    await MinigamesData.deleteFolder(id);
    this.render();
  }

  /* ----------------------------- Mini-jeux --------------------------- */

  _editGame(record, folder) {
    new SkyrimMinigameEditor({
      record: record ?? undefined,
      folder: record?.folder ?? folder ?? null,
      onSave: async (rec) => { await MinigamesData.upsertGame(rec); this.render(); }
    }).render(true);
  }

  async _deleteGame(id) {
    const ok = await this._confirm(game.i18n.localize("SKYRIM_LP.MG.DeleteGameConfirm"));
    if (!ok) return;
    await MinigamesData.deleteGame(id);
    this.render();
  }

  /** Demande à quels joueurs connectés soumettre le mini-jeu, puis l'envoie. */
  async _submitGame(record) {
    if (!record) return;
    const players = game.users.filter((u) => u.active && !u.isGM);
    if (players.length === 0) {
      return ui.notifications?.warn(game.i18n.localize("SKYRIM_LP.MG.NoPlayers"));
    }

    const { DialogV2 } = foundry.applications.api;
    const rows = players.map((u) => `
      <label class="mg-submit__row">
        <input type="checkbox" name="user" value="${u.id}" checked />
        <span class="mg-submit__dot" style="background:${u.color ?? "#888"}"></span>
        ${esc(u.name)}
      </label>`).join("");

    let chosen = null;
    await DialogV2.wait({
      window: { title: game.i18n.format("SKYRIM_LP.MG.SubmitTitle", { name: record.name }), icon: "fa-solid fa-paper-plane" },
      content: `<div class="mg-submit">
                  <p class="mg-submit__hint">${game.i18n.localize("SKYRIM_LP.MG.SubmitHint")}</p>
                  ${rows}
                </div>`,
      rejectClose: false,
      buttons: [
        {
          action: "send", label: game.i18n.localize("SKYRIM_LP.MG.Send"), default: true,
          callback: (event, button, dialog) => {
            chosen = Array.from(dialog.element.querySelectorAll("input[name='user']:checked")).map((i) => i.value);
          }
        },
        { action: "cancel", label: game.i18n.localize("Cancel"), callback: () => { chosen = null; } }
      ]
    }).catch(() => { chosen = null; });

    if (!chosen || chosen.length === 0) return;
    game.modules.get(MODULE_ID)?.api?.submit(record, chosen);
  }

  /* ------------------------------ Helpers ---------------------------- */

  async _promptText(title, value) {
    const { DialogV2 } = foundry.applications.api;
    // On lit la valeur dans une variable de clôture au moment du clic « OK » :
    // ne pas dépendre de la valeur de retour de wait() (qui peut renvoyer
    // l'identifiant du bouton et donc créer un dossier nommé « cancel »).
    let result = null;
    await DialogV2.wait({
      window: { title, icon: "fa-solid fa-folder" },
      content: `<input type="text" name="v" value="${esc(value)}" style="width:100%" autofocus />`,
      rejectClose: false,
      buttons: [
        {
          action: "ok", label: game.i18n.localize("Confirm"), default: true,
          callback: (e, b, dialog) => { result = (dialog.element.querySelector("[name='v']")?.value ?? "").trim(); }
        },
        { action: "cancel", label: game.i18n.localize("Cancel"), callback: () => { result = null; } }
      ]
    }).catch(() => { result = null; });
    return result;
  }

  async _confirm(message) {
    const { DialogV2 } = foundry.applications.api;
    return DialogV2.confirm({
      window: { title: game.i18n.localize("SKYRIM_LP.MG.ConfirmTitle") },
      content: `<p>${esc(message)}</p>`
    }).catch(() => false);
  }
}

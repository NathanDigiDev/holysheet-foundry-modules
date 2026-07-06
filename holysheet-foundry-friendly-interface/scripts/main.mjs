const MODULE_ID = "holysheet-foundry-friendly-interface";

const MODE = {
  VANILLA: "vanilla",
  IMMERSIVE: "immersive"
};

const SHORTCUT_PRESET = {
  VANILLA: "vanilla",
  HOLYSHEET: "holysheet"
};

const ACTOR_TAB_TARGETS = {
  skills: {
    aliases: ["skills", "skill", "competences", "compétences", "abilities", "ability"],
    labels: ["Compétences", "Competences", "Skills", "Abilities"]
  },
  inventory: {
    aliases: ["inventory", "inventaire", "items", "item", "equipment", "equipement", "équipement"],
    labels: ["Inventaire", "Inventory", "Équipement", "Equipement", "Equipment", "Items"]
  }
};

let temporaryDisabled = false;
let refreshTimer = null;
let dragState = null;

Hooks.once("init", () => {
  registerSettings();
});

Hooks.once("ready", () => {
  window.HolysheetFoundryFriendlyInterface = {
    apply,
    refresh: scheduleApply,
    disableUntilRefresh: () => {
      temporaryDisabled = true;
      apply();
    }
  };
  apply();
});

Hooks.on("canvasReady", () => scheduleApply());

function registerSettings() {
  game.settings.register(MODULE_ID, "mode", {
    name: "HSFFI.Settings.Mode.Name",
    hint: "HSFFI.Settings.Mode.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      [MODE.VANILLA]: "HSFFI.Settings.Mode.Choices.Vanilla",
      [MODE.IMMERSIVE]: "HSFFI.Settings.Mode.Choices.Immersive"
    },
    default: MODE.IMMERSIVE,
    onChange: scheduleApply
  });

  game.settings.register(MODULE_ID, "showCharacterShortcut", {
    name: "HSFFI.Settings.showCharacterShortcut.Name",
    hint: "HSFFI.Settings.showCharacterShortcut.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: scheduleApply
  });

  game.settings.register(MODULE_ID, "showNotesShortcut", {
    name: "HSFFI.Settings.showNotesShortcut.Name",
    hint: "HSFFI.Settings.showNotesShortcut.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: scheduleApply
  });

  game.settings.register(MODULE_ID, "showChatShortcut", {
    name: "HSFFI.Settings.showChatShortcut.Name",
    hint: "HSFFI.Settings.showChatShortcut.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: scheduleApply
  });

  game.settings.register(MODULE_ID, "shortcutPreset", {
    name: "HSFFI.Settings.shortcutPreset.Name",
    hint: "HSFFI.Settings.shortcutPreset.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      [SHORTCUT_PRESET.VANILLA]: "HSFFI.Settings.shortcutPreset.Choices.Vanilla",
      [SHORTCUT_PRESET.HOLYSHEET]: "HSFFI.Settings.shortcutPreset.Choices.Holysheet"
    },
    default: SHORTCUT_PRESET.VANILLA,
    onChange: scheduleApply
  });
}

function scheduleApply() {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(apply, 100);
}

function apply() {
  if (!game.ready) return;

  const enabled = !game.user?.isGM
    && !temporaryDisabled
    && game.settings.get(MODULE_ID, "mode") === MODE.IMMERSIVE;

  if (!enabled) {
    uninstallShortcuts();
    return;
  }

  installShortcuts();
}

function installShortcuts() {
  const dock = getOrCreateDock();
  renderDock(dock);
}

function uninstallShortcuts() {
  document.querySelector(".hsffi-player-dock")?.remove();
  document.querySelector(".hsffi-character-menu")?.remove();
  dragState = null;
}

function getOrCreateDock() {
  const existing = document.querySelector(".hsffi-player-dock");
  if (existing) return existing;

  const dock = document.createElement("nav");
  dock.className = "hsffi-player-dock holysheet hs-theme-lueur";
  dock.setAttribute("aria-label", localize("HSFFI.Dock.Label"));
  dock.addEventListener("pointerdown", startDockDrag);
  applySavedDockPosition(dock);
  document.body.append(dock);
  return dock;
}

function renderDock(dock) {
  const children = [];
  const holysheetPreset = getShortcutPreset() === SHORTCUT_PRESET.HOLYSHEET;

  if (game.settings.get(MODULE_ID, "showCharacterShortcut") && holysheetPreset) {
    children.push(createCharacterButtonStack());
  } else if (game.settings.get(MODULE_ID, "showCharacterShortcut")) {
    children.push(createDockButton({
      action: "characters",
      icon: "fa-solid fa-user",
      label: localize("HSFFI.Shortcuts.Character"),
      onClick: openCharacterShortcut
    }));
  }

  if (game.settings.get(MODULE_ID, "showChatShortcut")) {
    children.push(createDockButton({
      action: "chat",
      icon: "fa-solid fa-comments",
      label: localize("HSFFI.Shortcuts.Chat"),
      onClick: openChatShortcut
    }));
  }

  if (game.settings.get(MODULE_ID, "showNotesShortcut")) {
    children.push(createDockButton({
      action: "notes",
      icon: "fa-solid fa-note-sticky",
      label: localize("HSFFI.Shortcuts.Notes"),
      onClick: openNotesShortcut
    }));
  }

  dock.replaceChildren(...children);
}

function createCharacterButtonStack() {
  const stack = document.createElement("div");
  stack.className = "hsffi-character-stack";
  stack.append(
    createDockButton({
      action: "characters",
      icon: "fa-solid fa-user",
      label: localize("HSFFI.Shortcuts.Character"),
      onClick: openCharacterShortcut
    }),
    createDockButton({
      action: "skills",
      icon: "fa-solid fa-list-check",
      label: localize("HSFFI.Shortcuts.Skills"),
      onClick: anchor => openCharacterTabShortcut(anchor, "skills")
    }),
    createDockButton({
      action: "inventory",
      icon: "fa-solid fa-bag-shopping",
      label: localize("HSFFI.Shortcuts.Inventory"),
      onClick: anchor => openCharacterTabShortcut(anchor, "inventory")
    })
  );
  return stack;
}

function createDockButton({ action, icon, label, onClick }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `hsffi-dock-button hsffi-dock-button-${action}`;
  button.setAttribute("aria-label", label);
  button.innerHTML = `<i class="${icon}"></i><span>${label}</span>`;
  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    onClick(button);
  });
  return button;
}

function startDockDrag(event) {
  if (event.button !== 0) return;
  const target = event.target;
  if (target?.closest?.(".hsffi-dock-button, .hsffi-character-choice")) return;

  const targetDock = event.currentTarget;
  if (!(targetDock instanceof HTMLElement)) return;

  event.preventDefault();

  const rect = targetDock.getBoundingClientRect();
  dragState = {
    dock: targetDock,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    handle: event.currentTarget,
    pointerId: event.pointerId
  };

  targetDock.classList.add("is-dragging");
  event.currentTarget.setPointerCapture?.(event.pointerId);
  window.addEventListener("pointermove", moveDockDrag);
  window.addEventListener("pointerup", endDockDrag, { once: true });
}

function moveDockDrag(event) {
  if (!dragState) return;
  const { dock, offsetX, offsetY } = dragState;
  const rect = dock.getBoundingClientRect();
  const left = clamp(event.clientX - offsetX, 8, window.innerWidth - rect.width - 8);
  const top = clamp(event.clientY - offsetY, 8, window.innerHeight - rect.height - 8);
  dock.style.left = `${left}px`;
  dock.style.top = `${top}px`;
  dock.style.bottom = "auto";
}

function endDockDrag() {
  if (!dragState) return;
  const { dock } = dragState;
  dock.classList.remove("is-dragging");
  dragState.handle?.releasePointerCapture?.(dragState.pointerId);
  saveDockPosition(dock);
  dragState = null;
  window.removeEventListener("pointermove", moveDockDrag);
}

function applySavedDockPosition(dock) {
  const position = getSavedDockPosition();
  if (!position) return;
  dock.style.left = `${position.left}px`;
  dock.style.top = `${position.top}px`;
  dock.style.bottom = "auto";
}

function saveDockPosition(dock) {
  const rect = dock.getBoundingClientRect();
  const position = {
    left: Math.round(rect.left),
    top: Math.round(rect.top)
  };
  window.localStorage.setItem(getDockPositionKey(), JSON.stringify(position));
}

function getSavedDockPosition() {
  try {
    const raw = window.localStorage.getItem(getDockPositionKey());
    if (!raw) return null;
    const position = JSON.parse(raw);
    if (!Number.isFinite(position.left) || !Number.isFinite(position.top)) return null;
    return {
      left: clamp(position.left, 8, window.innerWidth - 80),
      top: clamp(position.top, 8, window.innerHeight - 48)
    };
  } catch (_error) {
    return null;
  }
}

function getDockPositionKey() {
  const world = game.world?.id ?? game.world?.title ?? "world";
  const user = game.user?.id ?? "user";
  return `${MODULE_ID}.dockPosition.${world}.${user}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function openCharacterShortcut(anchor) {
  openCharacterFromActors(anchor);
}

function openCharacterTabShortcut(anchor, tabTarget) {
  openCharacterFromActors(anchor, tabTarget);
}

function openCharacterFromActors(anchor, tabTarget = null) {
  const actors = getOwnedActors();

  if (!actors.length) {
    ui.notifications?.warn(localize("HSFFI.Messages.NoCharacters"));
    return;
  }

  if (actors.length === 1) {
    openDocumentSheet(actors[0], tabTarget);
    return;
  }

  openCharacterMenu(anchor, actors, tabTarget);
}

function getOwnedActors() {
  const actors = Array.from(game.actors ?? []);
  const owned = actors.filter(actor => {
    if (actor.isOwner) return true;
    if (typeof actor.testUserPermission !== "function") return false;
    const ownerLevel = CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
    return actor.testUserPermission(game.user, ownerLevel);
  });

  const assigned = game.user?.character;
  if (assigned && owned.includes(assigned)) {
    return [assigned, ...owned.filter(actor => actor !== assigned)];
  }

  return owned.sort((a, b) => a.name.localeCompare(b.name));
}

function openCharacterMenu(anchor, actors, tabTarget = null) {
  document.querySelector(".hsffi-character-menu")?.remove();

  const menu = document.createElement("section");
  menu.className = "hsffi-character-menu holysheet hs-theme-lueur";
  menu.innerHTML = `
    <header>
      <i class="fa-solid fa-users"></i>
      <strong>${localize("HSFFI.CharacterMenu.Title")}</strong>
    </header>
    <div class="hsffi-character-list"></div>
  `;

  const list = menu.querySelector(".hsffi-character-list");
  for (const actor of actors) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "hsffi-character-choice";
    const label = document.createElement("span");
    label.textContent = actor.name;
    button.append(label);
    button.addEventListener("click", () => {
      menu.remove();
      openDocumentSheet(actor, tabTarget);
    });
    list.append(button);
  }

  document.body.append(menu);
  positionMenu(anchor, menu);
}

function positionMenu(anchor, menu) {
  const rect = anchor.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const left = Math.min(rect.left, window.innerWidth - menuRect.width - 12);
  const top = Math.max(12, rect.top - menuRect.height - 10);
  menu.style.left = `${Math.max(12, left)}px`;
  menu.style.top = `${top}px`;
}

function openNotesShortcut() {
  activateSidebarTab("journal");
  activateNotesLayer();
}

function openChatShortcut() {
  activateSidebarTab("chat");
}

function activateSidebarTab(tab) {
  const control = document.querySelector(`#sidebar-tabs [data-tab="${CSS.escape(tab)}"], #sidebar [data-tab="${CSS.escape(tab)}"]`);
  if (control) {
    control.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    return;
  }

  const app = ui?.sidebar?.tabs?.[tab] ?? ui?.sidebar?.children?.get?.(tab) ?? ui?.[tab];
  if (typeof app?.activate === "function") app.activate();
}

function activateNotesLayer() {
  if (canvas?.notes && typeof canvas.notes.activate === "function") {
    canvas.notes.activate();
  }

  const notesControl = document.querySelector(
    "#controls [data-control='notes'], #controls [data-tool='notes'], #controls [data-layer='notes']"
  );
  notesControl?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
}

function openDocumentSheet(doc, tabTarget = null) {
  if (!doc) return;
  if (doc.sheet && typeof doc.sheet.render === "function") {
    try {
      doc.sheet.render(true);
    } catch (_error) {
      doc.sheet.render({ force: true });
    }
  } else if (typeof doc.render === "function") {
    doc.render(true);
  }

  if (tabTarget) {
    window.setTimeout(() => activateDocumentSheetTab(doc, tabTarget), 200);
    window.setTimeout(() => activateDocumentSheetTab(doc, tabTarget), 650);
  }
}

function activateDocumentSheetTab(doc, tabTarget) {
  const config = ACTOR_TAB_TARGETS[tabTarget];
  if (!config) return;

  const roots = getDocumentSheetRoots(doc);
  for (const root of roots) {
    const target = findTabControl(root, config);
    if (!target) continue;
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    return;
  }
}

function getDocumentSheetRoots(doc) {
  const roots = [];
  const element = normalizeSheetElement(doc.sheet?.element);
  if (element) roots.push(element);

  roots.push(...document.querySelectorAll(
    `.app[data-document-id="${CSS.escape(doc.id)}"], ` +
    `.application[data-document-id="${CSS.escape(doc.id)}"], ` +
    `[data-actor-id="${CSS.escape(doc.id)}"], ` +
    `[data-document-id="${CSS.escape(doc.id)}"]`
  ));

  roots.push(...document.querySelectorAll(".app.window-app, .application"));
  return Array.from(new Set(roots)).filter(Boolean);
}

function normalizeSheetElement(element) {
  if (!element) return null;
  if (element instanceof HTMLElement) return element;
  if (element[0] instanceof HTMLElement) return element[0];
  return null;
}

function findTabControl(root, config) {
  for (const alias of config.aliases) {
    const safe = CSS.escape(alias);
    const control = root.querySelector(
      `[data-tab="${safe}"], [data-action="${safe}"], [data-tab-id="${safe}"], [data-tab-name="${safe}"]`
    );
    if (control) return control;
  }

  const controls = Array.from(root.querySelectorAll("[data-tab], [data-action], nav a, button, .tab-control"));
  return controls.find(control => {
    const text = control.textContent?.trim().toLowerCase() ?? "";
    return config.labels.some(label => text === label.toLowerCase() || text.includes(label.toLowerCase()));
  });
}

function getShortcutPreset() {
  return game.settings.get(MODULE_ID, "shortcutPreset");
}

function localize(key) {
  return game.i18n.localize(key);
}

import { MODULE_ID, format, localize, log } from "./config.mjs";
import { ItemStorageAPI } from "./container-api.mjs";
import { ItemStorageSocket } from "./socket.mjs";
import { ContainerApp } from "./apps/container-app.mjs";
import { refreshContainerApps } from "./apps/refresh.mjs";
import { ItemStorageCanvasManager } from "./canvas-manager.mjs";
import { documentFromUuidSafe, htmlElement, isContainerItem } from "./utils.mjs";

export let canvasManager = null;

Hooks.once("init", () => {
  preloadTemplates();
  game.modules.get(MODULE_ID).api = {
    createContainer: () => ItemStorageAPI.createContainer(),
    openContainer: (uuid) => new ContainerApp(uuid).render({ force: true }),
    convertItem: (item) => ItemStorageAPI.convertItem(item)
  };
  globalThis.HolySheetItemStorage = game.modules.get(MODULE_ID).api;
  log("Initialized");
});

Hooks.once("ready", () => {
  ItemStorageSocket.listen();
  ItemStorageAPI.registerSocketHandlers();
  canvasManager = new ItemStorageCanvasManager();
  if (canvas?.ready) canvasManager.initializeCanvas();
  log("Ready");
});

Hooks.on("canvasReady", () => canvasManager?.initializeCanvas());
Hooks.on("canvasTearDown", () => canvasManager?.destroyCanvas());
Hooks.on("updateScene", (scene) => {
  if (scene.id === canvas?.scene?.id) canvasManager?.render();
});

Hooks.on("updateItem", (item) => {
  if (!isContainerItem(item)) return;
  refreshContainerApps(item.uuid);
  canvasManager?.render();
});

Hooks.on("deleteItem", (item) => {
  refreshContainerApps(item.uuid);
  canvasManager?.render();
});

Hooks.on("getItemSheetHeaderButtons", (sheet, buttons) => {
  const item = sheet.item ?? sheet.document;
  if (!item?.isOwner) return;

  if (isContainerItem(item)) {
    buttons.unshift({
      label: localize("HIS.Open"),
      class: "his-open-container",
      icon: "fas fa-box-open",
      onclick: () => new ContainerApp(item.uuid).render({ force: true })
    });
    return;
  }

  if (!game.user.isGM) return;
  buttons.unshift({
    label: localize("HIS.Convert"),
    class: "his-convert-container",
    icon: "fas fa-box",
    onclick: async () => ItemStorageAPI.convertItem(item)
  });
});

// Les fiches d'Item ApplicationV2 (coeur v13+) n'emettent pas
// getItemSheetHeaderButtons, et les controles d'en-tete v2 exigent une action
// enregistree par l'application elle-meme. On injecte donc le bouton
// directement dans l'en-tete de fenetre au rendu.
Hooks.on("renderItemSheetV2", (sheet, element) => {
  const item = sheet.item ?? sheet.document;
  if (!item?.isOwner) return;

  const header = element.querySelector(".window-header");
  if (!header || header.querySelector("[data-his-header]")) return;

  const isContainer = isContainerItem(item);
  if (!isContainer && !game.user.isGM) return;

  const label = localize(isContainer ? "HIS.Open" : "HIS.Convert");
  const button = document.createElement("button");
  button.type = "button";
  button.className = `header-control icon fa-solid ${isContainer ? "fa-box-open" : "fa-box"}`;
  button.dataset.hisHeader = "true";
  button.dataset.tooltip = label;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    if (isContainer) new ContainerApp(item.uuid).render({ force: true });
    else ItemStorageAPI.convertItem(item);
  });

  const close = header.querySelector("[data-action='close']");
  if (close) header.insertBefore(button, close);
  else header.appendChild(button);
});

Hooks.on("renderItemDirectory", (_app, html) => {
  if (!game.user.isGM) return;
  const element = htmlElement(html);
  if (!element || element.querySelector("[data-his-create-container]")) return;

  const header = element.querySelector(".directory-header") ?? element.querySelector("header");
  if (!header) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "his-directory-button create-document";
  button.dataset.hisCreateContainer = "true";
  button.innerHTML = `<i class="fa-solid fa-box-open"></i> ${localize("HIS.CreateContainer")}`;
  button.addEventListener("click", () => ItemStorageAPI.createContainer());

  const actions = header.querySelector(".header-actions, .action-buttons, .directory-actions");
  if (actions) {
    actions.appendChild(button);
    return;
  }

  const search = header.querySelector(".directory-search, search, input[type='search']")?.closest(".directory-search, search, div");
  if (search) header.insertBefore(button, search);
  else header.prepend(button);
});

Hooks.on("dropCanvasData", async (_canvas, data) => {
  if (!game.user.isGM || data.type !== "Item") return;
  const item = await documentFromUuidSafe(data.uuid);
  if (!isContainerItem(item)) return;

  const point = {
    x: Number(data.x ?? canvas.mousePosition?.x ?? 0),
    y: Number(data.y ?? canvas.mousePosition?.y ?? 0)
  };
  await canvasManager?.placeContainer(item, point);
  ui.notifications.info(format("HIS.Placed", { name: item.name }));
  return false;
});

Hooks.on("dropActorSheetData", async (actor, _sheet, data) => {
  if (data?.type !== "HolySheetItemStorage") return;
  if (!actor?.isOwner && !game.user.isGM) {
    ui.notifications.warn(localize("HIS.ActorNotOwned"));
    return false;
  }

  await ItemStorageAPI.takeEntry({
    containerUuid: data.containerUuid,
    entryId: data.entryId,
    actorUuid: actor.uuid,
    amount: 1
  });
  return false;
});

function preloadTemplates() {
  const loader = foundry.applications?.handlebars?.loadTemplates ?? loadTemplates;
  return loader([
    `modules/${MODULE_ID}/templates/container.hbs`
  ]);
}

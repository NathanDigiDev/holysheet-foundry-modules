import { DEFAULT_ICON, MODULE_ID, SCENE_FLAGS, format, localize } from "./config.mjs";
import { ContainerApp } from "./apps/container-app.mjs";
import { containerIcon, documentFromUuidSafe, isContainerItem, randomId } from "./utils.mjs";

const MARKER_SIZE = 72;
const MIN_MARKER_SIZE = 48;
const MAX_MARKER_SIZE = 180;
const MARKER_STEP = 24;
const { DialogV2 } = foundry.applications.api;

export class ItemStorageCanvasManager {
  constructor() {
    this.container = null;
  }

  initializeCanvas() {
    this.destroyCanvas();
    if (!canvas?.ready) return;

    const parent = canvas.interface ?? canvas.stage;
    this.container = new PIXI.Container();
    this.container.name = MODULE_ID;
    this.container.sortableChildren = true;
    parent.addChild(this.container);
    this.render();
  }

  destroyCanvas() {
    this.container?.destroy({ children: true });
    this.container = null;
  }

  async render() {
    if (!this.container || !canvas?.scene) return;
    this.container.removeChildren().forEach((child) => child.destroy({ children: true }));

    for (const placement of getScenePlacements()) {
      await this.#drawPlacement(placement);
    }
  }

  async placeContainer(item, point) {
    if (!game.user.isGM || !canvas?.scene || !isContainerItem(item)) return;
    const placements = getScenePlacements();
    placements.push({
      id: randomId(),
      itemUuid: item.uuid,
      x: point.x,
      y: point.y,
      locked: false,
      size: MARKER_SIZE
    });
    await setScenePlacements(placements);
    await this.render();
  }

  async #drawPlacement(placement) {
    const item = await documentFromUuidSafe(placement.itemUuid);
    if (!isContainerItem(item)) return;
    const size = clampSize(placement.size);

    const root = new PIXI.Container();
    root.eventMode = "static";
    root.cursor = "pointer";
    root.position.set(placement.x, placement.y);
    root.hitArea = new PIXI.Rectangle(-size / 2, -size / 2, size, size);

    const frame = new PIXI.Graphics();
    frame.beginFill(0x110e0a, 0.72);
    frame.lineStyle(2, placement.locked ? 0xc0584a : 0xc9a24e, 0.95);
    frame.drawRoundedRect(-size / 2, -size / 2, size, size, 12);
    frame.endFill();
    root.addChild(frame);

    const texture = await loadTexture(containerIcon(item) || DEFAULT_ICON).catch(() => loadTexture(DEFAULT_ICON));
    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.width = size - 18;
    sprite.height = size - 18;
    root.addChild(sprite);

    if (placement.locked) {
      const lock = drawLockIcon(Math.max(18, Math.round(size * 0.26)));
      lock.position.set(size / 2 - lock.width - 5, -size / 2 + 5);
      root.addChild(lock);
    }

    root.on("pointertap", (event) => this.#onOpenPlacement(event, placement, item));
    root.on("rightclick", (event) => this.#onToggleLock(event, placement));
    this.container.addChild(root);
  }

  async #onOpenPlacement(event, placement, item) {
    const nativeEvent = event.nativeEvent ?? event.originalEvent ?? event.data?.originalEvent;
    const button = event.button ?? nativeEvent?.button ?? 0;
    if (button !== 0) return;
    event.stopPropagation();
    if (placement.locked) {
      ui.notifications.warn(format("HIS.LockedNotice", { name: item.name }));
      return;
    }
    new ContainerApp(item.uuid).render({ force: true });
  }

  async #onToggleLock(event, placement) {
    if (!game.user.isGM) return;
    event.preventDefault?.();
    event.stopPropagation();
    await this.#openContextActions(placement);
  }

  async #openContextActions(placement) {
    const placements = getScenePlacements();
    const current = placements.find((candidate) => candidate.id === placement.id);
    if (!current) return;
    const lockedLabel = localize(current.locked ? "HIS.Unlock" : "HIS.Lock");

    new DialogV2({
      window: { title: localize("HIS.CanvasActions") },
      content: "",
      buttons: [
        {
          action: "toggleLock",
          label: lockedLabel,
          icon: current.locked ? "fa-solid fa-lock-open" : "fa-solid fa-lock",
          callback: async () => {
            current.locked = !current.locked;
            await setScenePlacements(placements);
            ui.notifications.info(localize(current.locked ? "HIS.Locked" : "HIS.Unlocked"));
            await this.render();
          }
        },
        {
          action: "grow",
          label: localize("HIS.CanvasGrow"),
          icon: "fa-solid fa-up-right-and-down-left-from-center",
          callback: async () => {
            current.size = clampSize((current.size ?? MARKER_SIZE) + MARKER_STEP);
            await setScenePlacements(placements);
            await this.render();
          }
        },
        {
          action: "shrink",
          label: localize("HIS.CanvasShrink"),
          icon: "fa-solid fa-down-left-and-up-right-to-center",
          callback: async () => {
            current.size = clampSize((current.size ?? MARKER_SIZE) - MARKER_STEP);
            await setScenePlacements(placements);
            await this.render();
          }
        },
        {
          action: "delete",
          label: localize("HIS.CanvasDelete"),
          icon: "fa-solid fa-trash",
          callback: async () => {
            const confirmed = await DialogV2.confirm({
              window: { title: localize("HIS.CanvasDelete") },
              content: `<p>${localize("HIS.CanvasDeleteConfirm")}</p>`
            });
            if (!confirmed) return;
            await setScenePlacements(placements.filter((candidate) => candidate.id !== placement.id));
            await this.render();
          }
        }
      ]
    }).render({ force: true });
  }
}

export function getScenePlacements(scene = canvas?.scene) {
  const placements = scene?.getFlag(MODULE_ID, SCENE_FLAGS.PLACEMENTS);
  return Array.isArray(placements) ? foundry.utils.deepClone(placements) : [];
}

export async function setScenePlacements(placements, scene = canvas?.scene) {
  if (!scene) return;
  await scene.setFlag(MODULE_ID, SCENE_FLAGS.PLACEMENTS, placements);
}

function clampSize(size) {
  const value = Number(size) || MARKER_SIZE;
  return Math.max(MIN_MARKER_SIZE, Math.min(MAX_MARKER_SIZE, value));
}

function drawLockIcon(size) {
  const g = new PIXI.Graphics();
  const width = size;
  const height = size;
  const shackleWidth = width * 0.58;
  const shackleHeight = height * 0.48;
  const shackleX = (width - shackleWidth) / 2;
  const shackleY = height * 0.08;
  const bodyY = height * 0.42;
  const bodyH = height * 0.48;

  g.lineStyle(Math.max(2, size * 0.09), 0x110e0a, 0.9);
  g.beginFill(0xc0584a, 0.95);
  g.drawRoundedRect(0, bodyY, width, bodyH, size * 0.14);
  g.endFill();

  g.lineStyle(Math.max(2, size * 0.1), 0xfff6e6, 0.95);
  g.arc(width / 2, shackleY + shackleHeight, shackleWidth / 2, Math.PI, 0);
  g.moveTo(shackleX, shackleY + shackleHeight);
  g.lineTo(shackleX, bodyY + size * 0.06);
  g.moveTo(shackleX + shackleWidth, shackleY + shackleHeight);
  g.lineTo(shackleX + shackleWidth, bodyY + size * 0.06);

  g.beginFill(0xfff6e6, 0.95);
  g.drawCircle(width / 2, bodyY + bodyH * 0.45, size * 0.1);
  g.drawRoundedRect(width / 2 - size * 0.035, bodyY + bodyH * 0.48, size * 0.07, size * 0.18, size * 0.025);
  g.endFill();
  return g;
}

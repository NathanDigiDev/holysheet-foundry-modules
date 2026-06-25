import { TOOLS } from "./constants.js";
import { ZoneConfigApplication } from "./dialogs.js";
import {
  closePolygon,
  containsPoint,
  drawOpenPolygon,
  drawZoneShape,
  hasUsableSize,
  normalizeDragGeometry,
  zoneBounds
} from "./geometry.js";
import { buildZone, canUseZone, deleteSceneZone, duplicateZone, getSceneZones, isZoneVisible, upsertSceneZone } from "./storage.js";

export class InteractiveZonesCanvasManager {
  constructor(actions) {
    this.actions = actions;
    this.activeTool = TOOLS.select;
    this.container = null;
    this.zonesLayer = null;
    this.labelsLayer = null;
    this.votesLayer = null;
    this.previewLayer = null;
    this.hoveredZoneId = null;
    this.dragStart = null;
    this.dragPreview = null;
    this.polygonPoints = [];
    this.bound = {
      pointerMove: (event) => this.#onPointerMove(event),
      pointerDown: (event) => this.#onPointerDown(event),
      pointerUp: (event) => this.#onPointerUp(event),
      contextMenu: (event) => this.#onContextMenu(event),
      keyDown: (event) => this.#onKeyDown(event)
    };
  }

  get isEditing() {
    return game.user.isGM && Object.values(TOOLS).includes(this.activeTool) && this.#isControlActive();
  }

  initializeCanvas() {
    this.destroyCanvas();
    if (!canvas?.ready) return;

    const parent = canvas.interface ?? canvas.stage;
    this.container = new PIXI.Container();
    this.container.name = "holysheet-interactive-zones";
    this.container.eventMode = "none";
    this.container.sortableChildren = true;
    this.zonesLayer = this.container.addChild(new PIXI.Container());
    this.labelsLayer = this.container.addChild(new PIXI.Container());
    this.votesLayer = this.container.addChild(new PIXI.Container());
    this.previewLayer = this.container.addChild(new PIXI.Container());
    parent.addChild(this.container);

    const view = canvas.app?.view;
    view?.addEventListener("pointermove", this.bound.pointerMove, true);
    view?.addEventListener("pointerdown", this.bound.pointerDown, true);
    view?.addEventListener("pointerup", this.bound.pointerUp, true);
    view?.addEventListener("contextmenu", this.bound.contextMenu, true);
    window.addEventListener("keydown", this.bound.keyDown, true);

    this.render();
  }

  destroyCanvas() {
    const view = canvas?.app?.view;
    view?.removeEventListener("pointermove", this.bound.pointerMove, true);
    view?.removeEventListener("pointerdown", this.bound.pointerDown, true);
    view?.removeEventListener("pointerup", this.bound.pointerUp, true);
    view?.removeEventListener("contextmenu", this.bound.contextMenu, true);
    window.removeEventListener("keydown", this.bound.keyDown, true);
    this.container?.destroy({ children: true });
    this.container = null;
    this.zonesLayer = null;
    this.labelsLayer = null;
    this.votesLayer = null;
    this.previewLayer = null;
    this.dragStart = null;
    this.dragPreview = null;
    this.polygonPoints = [];
  }

  setTool(toolName) {
    this.activeTool = toolName;
    this.dragStart = null;
    this.dragPreview = null;
    this.polygonPoints = [];
    this.render();
  }

  render() {
    if (!this.container || !canvas?.scene) return;
    this.zonesLayer.removeChildren().forEach((child) => child.destroy());
    this.labelsLayer.removeChildren().forEach((child) => child.destroy());
    this.votesLayer.removeChildren().forEach((child) => child.destroy());
    this.previewLayer.removeChildren().forEach((child) => child.destroy());

    const zones = getSceneZones();
    for (const zone of zones) this.#drawZone(zone);
    this.#drawPreview();
  }

  #drawZone(zone) {
    const hovered = zone.id === this.hoveredZoneId;
    const visible = isZoneVisible(zone, game.user, { editing: this.isEditing, hovered });
    if (!visible) return;

    const graphics = new PIXI.Graphics();
    const color = colorNumber(zone.highlight?.color);
    const lineAlpha = zone.active ? 0.95 : 0.45;
    const fillAlpha = hovered && zone.highlight?.fill ? Number(zone.highlight.alpha ?? 0.28) : this.isEditing ? 0.08 : 0;

    if (fillAlpha) graphics.beginFill(color, fillAlpha);
    if (zone.highlight?.outline || this.isEditing) graphics.lineStyle(Number(zone.highlight?.lineWidth ?? 3), color, lineAlpha);
    drawZoneShape(graphics, zone);
    if (fillAlpha) graphics.endFill();
    graphics.alpha = canUseZone(zone) ? 1 : 0.35;
    this.zonesLayer.addChild(graphics);

    this.#drawLabel(zone, hovered);
    this.#drawVotes(zone);
  }

  #drawLabel(zone, hovered) {
    if (zone.labelMode === "never") return;
    if (zone.labelMode === "hover" && !hovered && !this.isEditing) return;

    const bounds = zoneBounds(zone);
    const text = new PIXI.Text(zone.name || game.i18n.localize("HIZ.Zone"), {
      fill: "#ffffff",
      fontSize: 18,
      fontFamily: "Signika, sans-serif",
      fontWeight: "700",
      align: "center",
      stroke: "#111111",
      strokeThickness: 4,
      wordWrap: true,
      wordWrapWidth: Math.max(80, bounds.width - 12)
    });
    text.anchor.set(0.5);
    text.position.set(bounds.center.x, bounds.center.y);
    this.labelsLayer.addChild(text);
  }

  #drawVotes(zone) {
    if (zone.action?.type !== "vote" || !this.actions.shouldShowVotes(zone)) return;

    const votes = this.actions.getVotes(zone);
    if (!votes.length) return;

    const bounds = zoneBounds(zone);
    const radius = 7;
    const gap = 5;
    const width = votes.length * radius * 2 + Math.max(0, votes.length - 1) * gap;
    let x = bounds.center.x - width / 2 + radius;
    const y = bounds.y + Math.max(14, Math.min(bounds.height - 14, 18));

    for (const vote of votes) {
      const dot = new PIXI.Graphics();
      dot.lineStyle(2, 0xffffff, 0.95);
      dot.beginFill(colorNumber(vote.color), 0.95);
      dot.drawCircle(x, y, radius);
      dot.endFill();
      this.votesLayer.addChild(dot);
      x += radius * 2 + gap;
    }
  }

  #drawPreview() {
    const preview = new PIXI.Graphics();
    preview.lineStyle(3, 0xf5c542, 0.95);
    preview.beginFill(0xf5c542, 0.16);

    if (this.dragPreview) {
      drawZoneShape(preview, {
        type: this.activeTool === TOOLS.circle ? "circle" : "rect",
        geometry: this.dragPreview
      });
    } else if (this.polygonPoints.length) {
      preview.endFill();
      drawOpenPolygon(preview, this.polygonPoints);
      for (const point of this.polygonPoints) {
        preview.beginFill(0xf5c542, 0.95);
        preview.drawCircle(point.x, point.y, 5);
        preview.endFill();
      }
    }

    this.previewLayer.addChild(preview);
  }

  async #onPointerDown(event) {
    if (!canvas?.ready) return;
    const point = getCanvasPoint(event);

    if (this.isEditing && this.activeTool === TOOLS.polygon && event.button === 0) {
      event.preventDefault();
      event.stopPropagation();
      await this.#handlePolygonClick(point);
      return;
    }

    if (this.isEditing && [TOOLS.rect, TOOLS.circle].includes(this.activeTool) && event.button === 0) {
      event.preventDefault();
      event.stopPropagation();
      this.dragStart = point;
      this.dragPreview = normalizeDragGeometry(point, point);
      this.render();
      return;
    }

    if (event.button !== 0 || this.isEditing) return;
    const zone = this.#zoneAt(point);
    if (!zone) return;
    event.preventDefault();
    event.stopPropagation();
    await this.actions.execute(zone);
    this.render();
  }

  #onPointerMove(event) {
    if (!canvas?.ready) return;
    const point = getCanvasPoint(event);

    if (this.dragStart && [TOOLS.rect, TOOLS.circle].includes(this.activeTool)) {
      this.dragPreview = normalizeDragGeometry(this.dragStart, point);
      this.render();
      return;
    }

    if (this.isEditing && this.activeTool === TOOLS.polygon && this.polygonPoints.length) {
      this.polygonPoints[this.polygonPoints.length - 1] = point;
      this.render();
      return;
    }

    const hovered = this.#zoneAt(point, { includeInactive: this.isEditing })?.id ?? null;
    if (hovered !== this.hoveredZoneId) {
      this.hoveredZoneId = hovered;
      this.render();
    }
  }

  async #onPointerUp(event) {
    if (!this.isEditing || !this.dragStart || !this.dragPreview || ![TOOLS.rect, TOOLS.circle].includes(this.activeTool)) return;
    event.preventDefault();
    event.stopPropagation();

    const geometry = this.dragPreview;
    this.dragStart = null;
    this.dragPreview = null;
    this.render();

    if (!hasUsableSize(geometry)) {
      ui.notifications.warn(game.i18n.localize("HIZ.ZoneTooSmall"));
      return;
    }

    const zone = buildZone({ type: this.activeTool === TOOLS.circle ? "circle" : "rect", geometry });
    this.#openConfig(zone);
  }

  async #onContextMenu(event) {
    if (this.isEditing && this.activeTool === TOOLS.polygon && this.polygonPoints.length) {
      event.preventDefault();
      event.stopPropagation();
      ui.notifications.warn(game.i18n.localize("HIZ.PolygonNotClosed"));
      return;
    }

    if (!this.isEditing) return;
    const point = getCanvasPoint(event);
    const zone = this.#zoneAt(point, { includeInactive: true });
    if (!zone) return;
    event.preventDefault();
    event.stopPropagation();
    await this.#openContextActions(zone);
  }

  #onKeyDown(event) {
    if (event.key === "Enter" && this.isEditing && this.activeTool === TOOLS.polygon && this.polygonPoints.length) {
      event.preventDefault();
      event.stopPropagation();
      ui.notifications.warn(game.i18n.localize("HIZ.PolygonNotClosed"));
      return;
    }

    if (event.key !== "Escape") return;
    if (!this.dragStart && !this.polygonPoints.length) return;
    this.dragStart = null;
    this.dragPreview = null;
    this.polygonPoints = [];
    this.render();
  }

  async #handlePolygonClick(point) {
    if (!this.polygonPoints.length) {
      this.polygonPoints = [point, point];
      this.render();
      return;
    }

    const fixedPoints = this.polygonPoints.slice(0, -1);
    if (fixedPoints.length >= 3 && Math.hypot(point.x - fixedPoints[0].x, point.y - fixedPoints[0].y) <= 18) {
      const closed = closePolygon([...fixedPoints, fixedPoints[0]]);
      this.polygonPoints = [];
      this.render();
      this.#openConfig(buildZone({ type: "polygon", geometry: { points: closed } }));
      return;
    }

    fixedPoints.push(point);
    this.polygonPoints = [...fixedPoints, point];
    this.render();
  }

  #isControlActive() {
    const controls = ui.controls;
    const candidates = [
      controls?.activeControl,
      controls?.activeControl?.name,
      controls?.control,
      controls?.control?.name
    ];
    const names = candidates.map((candidate) => typeof candidate === "string" ? candidate : candidate?.name).filter(Boolean);
    return names.length ? names.includes(TOOLS.control) : false;
  }

  #zoneAt(point, { includeInactive = false } = {}) {
    return getSceneZones()
      .slice()
      .reverse()
      .find((zone) => {
        if (!includeInactive && !canUseZone(zone)) return false;
        return containsPoint(zone, point);
      });
  }

  #openConfig(zone) {
    new ZoneConfigApplication(zone, {
      onSave: async (updated) => {
        await upsertSceneZone(updated);
        this.render();
      }
    }).render(true);
  }

  async #openContextActions(zone) {
    const Dialog = foundry.applications.api.DialogV2;
    new Dialog({
      window: { title: zone.name || game.i18n.localize("HIZ.Zone") },
      content: "",
      buttons: [
        {
          action: "edit",
          label: game.i18n.localize("HIZ.ContextEdit"),
          icon: "fas fa-edit",
          callback: () => this.#openConfig(zone)
        },
        {
          action: "toggle",
          label: game.i18n.localize(zone.active ? "HIZ.ContextDeactivate" : "HIZ.ContextActivate"),
          icon: "fas fa-power-off",
          callback: async () => {
            await upsertSceneZone({ ...zone, active: !zone.active });
            this.render();
          }
        },
        {
          action: "duplicate",
          label: game.i18n.localize("HIZ.ContextDuplicate"),
          icon: "fas fa-copy",
          callback: async () => {
            await upsertSceneZone(duplicateZone(zone));
            this.render();
          }
        },
        {
          action: "delete",
          label: game.i18n.localize("HIZ.ContextDelete"),
          icon: "fas fa-trash",
          callback: async () => {
            const confirmed = await Dialog.confirm({
              window: { title: game.i18n.localize("HIZ.ContextDelete") },
              content: `<p>${game.i18n.localize("HIZ.DeleteConfirm")}</p>`
            });
            if (!confirmed) return;
            await deleteSceneZone(zone.id);
            this.render();
          }
        }
      ]
    }).render(true);
  }
}

function getCanvasPoint(event) {
  const view = canvas.app?.view;
  if (!view || typeof PIXI === "undefined") return canvas.mousePosition;

  const rect = view.getBoundingClientRect();
  const resolutionX = canvas.app.renderer.screen.width / rect.width;
  const resolutionY = canvas.app.renderer.screen.height / rect.height;
  const global = new PIXI.Point((event.clientX - rect.left) * resolutionX, (event.clientY - rect.top) * resolutionY);
  const point = canvas.stage.toLocal(global);
  return { x: point.x, y: point.y };
}

function colorNumber(color) {
  if (typeof color === "number") return color;
  return Number(String(color || "#f5c542").replace("#", "0x"));
}

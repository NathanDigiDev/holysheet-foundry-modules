import { MODULE_ID, TOOLS } from "./constants.js";
import { InteractiveZoneActions } from "./actions.js";
import { InteractiveZonesCanvasManager } from "./canvas-manager.js";

let actions;
let canvasManager;

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing`);
});

Hooks.once("ready", () => {
  actions = new InteractiveZoneActions({
    onStateChange: () => canvasManager?.render()
  });
  canvasManager = new InteractiveZonesCanvasManager(actions);
  actions.registerSocket();

  if (canvas?.ready) canvasManager.initializeCanvas();
});

Hooks.on("canvasReady", () => {
  actions?.clearTransientState();
  canvasManager?.initializeCanvas();
});

Hooks.on("canvasTearDown", () => {
  canvasManager?.destroyCanvas();
});

Hooks.on("updateScene", (scene) => {
  if (scene.id === canvas?.scene?.id) canvasManager?.render();
});

Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.user.isGM) return;

  controls[TOOLS.control] = {
    name: TOOLS.control,
    title: "HIZ.Control",
    icon: "fas fa-draw-polygon",
    layer: "controls",
    visible: true,
    activeTool: TOOLS.select,
    order: 72,
    tools: {
      [TOOLS.select]: {
        name: TOOLS.select,
        title: "HIZ.ToolSelect",
        icon: "fas fa-mouse-pointer",
        toggle: true,
        active: true,
        onClick: () => canvasManager?.setTool(TOOLS.select)
      },
      [TOOLS.rect]: {
        name: TOOLS.rect,
        title: "HIZ.ToolRect",
        icon: "far fa-square",
        toggle: true,
        onClick: () => canvasManager?.setTool(TOOLS.rect)
      },
      [TOOLS.circle]: {
        name: TOOLS.circle,
        title: "HIZ.ToolCircle",
        icon: "far fa-circle",
        toggle: true,
        onClick: () => canvasManager?.setTool(TOOLS.circle)
      },
      [TOOLS.polygon]: {
        name: TOOLS.polygon,
        title: "HIZ.ToolPolygon",
        icon: "fas fa-draw-polygon",
        toggle: true,
        onClick: () => canvasManager?.setTool(TOOLS.polygon)
      }
    }
  };
});

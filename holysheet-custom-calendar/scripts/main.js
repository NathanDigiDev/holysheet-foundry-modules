import { MODULE_ID } from "./constants.js";
import { createDefaultState } from "./presets.js";
import { getState, registerSettings, setState } from "./settings.js";
import { ensureJournalFoldersForUsers } from "./journal-service.js";
import { renderWidget, showWidget } from "./widget.js";
import { HolysheetCalendarApp } from "./apps/calendar-app.js";
import { HolysheetConfigApp } from "./apps/config-app.js";
import { setupSidebarTab } from "./sidebar.js";

Hooks.once("init", () => {
  registerSettings();
});

Hooks.once("ready", async () => {
  await ensureInitialState();
  if (game.user.isGM) await ensureJournalFoldersForUsers();
  renderWidget();
  exposeApi();
  setupSidebarTab();
});

Hooks.on("renderSidebar", () => {
  window.setTimeout(setupSidebarTab, 0);
});

Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.user.isGM) return;
  const tokenControls = controls.tokens ?? controls.find?.((control) => control.name === "token");
  const tools = tokenControls?.tools;
  if (!tools) return;
  const tool = {
    name: "holysheetCalendarConfig",
    title: "HCC.Configure",
    icon: "fa-solid fa-calendar-days",
    order: Object.keys(tools).length,
    button: true,
    visible: game.user.isGM,
    onChange: () => new HolysheetConfigApp().render({ force: true })
  };
  if (Array.isArray(tools)) tools.push(tool);
  else tools.holysheetCalendarConfig = tool;
});

async function ensureInitialState() {
  const state = getState();
  if (state?.calendars?.length) return;
  await setState(createDefaultState());
  if (game.user.isGM) ui.notifications.info(game.i18n.localize("HCC.FirstRunInfo"));
}

function exposeApi() {
  game.modules.get(MODULE_ID).api = {
    openCalendar: () => new HolysheetCalendarApp().render({ force: true }),
    openConfig: () => new HolysheetConfigApp().render({ force: true }),
    showWidget
  };
}

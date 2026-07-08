import { DEFAULT_WIDGET, MODULE_ID, SETTINGS } from "./constants.js";
import { createDefaultState } from "./presets.js";

export function registerSettings() {
  game.settings.register(MODULE_ID, SETTINGS.STATE, {
    name: "HCC.Settings.StateName",
    hint: "HCC.Settings.StateHint",
    scope: "world",
    config: false,
    type: Object,
    default: createDefaultState()
  });

  game.settings.register(MODULE_ID, SETTINGS.WIDGET, {
    name: "HCC.Settings.WidgetName",
    hint: "HCC.Settings.WidgetHint",
    scope: "client",
    config: false,
    type: Object,
    default: DEFAULT_WIDGET
  });
}

export function getState() {
  return foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.STATE));
}

export async function setState(state) {
  return game.settings.set(MODULE_ID, SETTINGS.STATE, state);
}

export function getWidgetSettings() {
  return { ...DEFAULT_WIDGET, ...foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.WIDGET)) };
}

export async function setWidgetSettings(settings) {
  return game.settings.set(MODULE_ID, SETTINGS.WIDGET, { ...getWidgetSettings(), ...settings });
}

export async function updateCalendar(calendar) {
  const state = getState();
  const index = state.calendars.findIndex((candidate) => candidate.id === calendar.id);
  if (index >= 0) state.calendars[index] = calendar;
  else state.calendars.push(calendar);
  return setState(state);
}

import { MODULE_ID } from "./constants.js";
import {
  formatDate,
  formatNarrativeDate,
  getActiveCalendar,
  getActiveZone,
  getPhaseForMinute,
  setMinuteOfDay
} from "./calendar-engine.js";
import { getState, getWidgetSettings, setState, setWidgetSettings } from "./settings.js";

let widgetElement = null;
let restoreElement = null;

export function renderWidget() {
  const state = getState();
  const calendar = getActiveCalendar(state);
  const zone = getActiveZone(calendar);
  const settings = getWidgetSettings();
  const visual = getTimeVisual(calendar, zone);
  const canControlTime = game.user.isGM && !settings.locked;
  const dayPercentage = Math.max(1, Math.min(99, Number(zone?.dayPercentage ?? 50)));

  widgetElement?.remove();
  restoreElement?.remove();
  if (settings.hidden) {
    renderRestoreButton();
    return;
  }

  widgetElement = document.createElement("div");
  widgetElement.id = "holysheet-calendar-widget";
  widgetElement.className = `holysheet hs-theme-cuir ${settings.locked ? "locked" : "unlocked"}`;
  widgetElement.style.top = `${settings.top ?? 16}px`;
  if (settings.left === null || settings.left === undefined) {
    widgetElement.style.left = "50%";
    widgetElement.style.transform = "translateX(-50%)";
  } else {
    widgetElement.style.left = `${settings.left}px`;
    widgetElement.style.transform = "none";
  }

  widgetElement.innerHTML = `
    <aside class="hcc-widget ${game.user.isGM ? "gm" : "player"}">
      <div class="hcc-widget-topline">
        <button type="button" class="hcc-widget-date" data-action="open-calendar">${formatDate(calendar, calendar.currentDate)}</button>
        ${game.user.isGM ? `
          <div class="hcc-widget-tools">
            <button type="button" data-action="toggle-lock" data-tooltip="${settings.locked ? game.i18n.localize("HCC.UnlockGauge") : game.i18n.localize("HCC.LockGauge")}"><i class="fa-solid ${settings.locked ? "fa-lock" : "fa-lock-open"}"></i></button>
            <button type="button" data-action="open-time" data-tooltip="${game.i18n.localize("HCC.AdvanceTime")}"><i class="fa-solid fa-gear"></i></button>
            <button type="button" data-action="toggle-hidden" data-tooltip="Masquer"><i class="fa-solid fa-eye-slash"></i></button>
          </div>
        ` : ""}
      </div>
      <div class="hcc-time-visual ${visual.className}" aria-label="${visual.label}" style="--hcc-astro-x: ${visual.x}%; --hcc-astro-y: ${visual.y}%;">
        <div class="hcc-sky-stars" aria-hidden="true"></div>
        <div class="hcc-astro ${visual.isDay ? "sun" : "moon"}" aria-hidden="true">
          <i class="fa-solid ${visual.isDay ? "fa-sun" : "fa-moon"}"></i>
        </div>
        <div class="hcc-horizon" aria-hidden="true"></div>
        <span class="hcc-time-label">${visual.label}</span>
      </div>
      ${canControlTime ? `
        <input class="hcc-gauge" type="range" min="0" max="1439" value="${calendar.currentDate.minuteOfDay}" style="--hcc-day-size: ${dayPercentage}%;" aria-label="${game.i18n.localize("HCC.DayPhase")}">
      ` : ""}
    </aside>
  `;

  document.body.appendChild(widgetElement);
  widgetElement.querySelector(".hcc-widget-date").textContent = formatNarrativeDate(calendar, calendar.currentDate);
  widgetElement.querySelector("[data-action='open-calendar']")?.addEventListener("click", async () => {
    const { HolysheetCalendarApp } = await import("./apps/calendar-app.js");
    new HolysheetCalendarApp({ mode: "summary", calendarId: calendar.id }).render({ force: true });
  });
  widgetElement.querySelector("[data-action='toggle-hidden']")?.addEventListener("click", async () => {
    await setWidgetSettings({ hidden: true });
    renderWidget();
  });
  widgetElement.querySelector("[data-action='open-time']")?.addEventListener("click", async () => {
    const { HolysheetCalendarApp } = await import("./apps/calendar-app.js");
    new HolysheetCalendarApp({ mode: "month", calendarId: calendar.id }).render({ force: true });
  });
  widgetElement.querySelector("[data-action='toggle-lock']")?.addEventListener("click", async () => {
    await setWidgetSettings({ locked: !settings.locked });
    renderWidget();
  });
  if (canControlTime) widgetElement.querySelector(".hcc-gauge")?.addEventListener("input", onGaugeInput);
  makeDraggable(widgetElement);
}

export async function showWidget() {
  await setWidgetSettings({ hidden: false });
  renderWidget();
}

function renderRestoreButton() {
  restoreElement = document.createElement("button");
  restoreElement.id = "holysheet-calendar-widget-restore";
  restoreElement.type = "button";
  restoreElement.setAttribute("data-tooltip", game.i18n.localize("HCC.ShowWidget"));
  restoreElement.setAttribute("aria-label", game.i18n.localize("HCC.ShowWidget"));
  restoreElement.innerHTML = `<i class="fa-solid fa-calendar-days"></i>`;
  restoreElement.addEventListener("click", showWidget);
  document.body.appendChild(restoreElement);
}

async function onGaugeInput(event) {
  if (!game.user.isGM) return;
  const state = getState();
  const calendar = getActiveCalendar(state);
  const nextCalendar = setMinuteOfDay(calendar, Number(event.currentTarget.value));
  const index = state.calendars.findIndex((candidate) => candidate.id === calendar.id);
  state.calendars[index] = nextCalendar;
  await setState(state);
  renderWidget();
}

function getTimeVisual(calendar, zone) {
  const minute = Number(calendar.currentDate.minuteOfDay ?? 0);
  const percent = minute / 1439 * 100;
  const dayPercentage = Math.max(1, Math.min(99, Number(zone?.dayPercentage ?? 50)));
  const dayStart = (100 - dayPercentage) / 2;
  const dayEnd = dayStart + dayPercentage;
  const isDay = percent >= dayStart && percent <= dayEnd;
  const phase = getPhaseForMinute(calendar, minute);

  let progress;
  if (isDay) {
    progress = (percent - dayStart) / Math.max(1, dayPercentage);
  } else {
    const nightPercentage = 100 - dayPercentage;
    progress = percent > dayEnd
      ? (percent - dayEnd) / Math.max(1, nightPercentage)
      : (percent + 100 - dayEnd) / Math.max(1, nightPercentage);
  }

  const y = 78 - Math.sin(progress * Math.PI) * (isDay ? 54 : 46);
  const className = getVisualClass(percent, dayStart, dayEnd, isDay);

  return {
    className,
    isDay,
    label: phase?.label ?? (isDay ? "Jour" : "Nuit"),
    x: Math.round(percent),
    y: Math.round(y)
  };
}

function getVisualClass(percent, dayStart, dayEnd, isDay) {
  const edge = 7;
  if (isDay && percent - dayStart <= edge) return "dawn";
  if (isDay && dayEnd - percent <= edge) return "dusk";
  if (isDay) return "day";
  return "night";
}

function makeDraggable(element) {
  if (!game.user.isGM) return;
  let startX = 0;
  let startY = 0;
  let left = 0;
  let top = 0;

  element.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, input")) return;
    startX = event.clientX;
    startY = event.clientY;
    left = element.getBoundingClientRect().left;
    top = element.getBoundingClientRect().top;
    element.setPointerCapture(event.pointerId);
  });

  element.addEventListener("pointermove", async (event) => {
    if (!element.hasPointerCapture(event.pointerId)) return;
    const nextLeft = left + event.clientX - startX;
    const nextTop = top + event.clientY - startY;
    element.style.left = `${nextLeft}px`;
    element.style.top = `${nextTop}px`;
    element.style.transform = "none";
  });

  element.addEventListener("pointerup", async (event) => {
    if (!element.hasPointerCapture(event.pointerId)) return;
    element.releasePointerCapture(event.pointerId);
    const rect = element.getBoundingClientRect();
    await setWidgetSettings({ left: rect.left, top: rect.top });
  });
}

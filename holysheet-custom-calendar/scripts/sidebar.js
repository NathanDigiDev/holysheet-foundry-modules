import { showWidget } from "./widget.js";

let delegatedListenersReady = false;

export function setupSidebarTab() {
  setupDelegatedListeners();
  injectSidebarButton();
}

export function refreshSidebarTab() {
  // The calendar list is rendered in a normal popout window now, so no sidebar
  // panel needs refreshing.
}

function injectSidebarButton() {
  const anchor = document.querySelector("#sidebar [data-tab='chat'], #ui-right [data-tab='chat']")
    ?? document.querySelector("#sidebar [data-tab='combat'], #ui-right [data-tab='combat']")
    ?? document.querySelector("#sidebar-tabs button, #sidebar-tabs a")
    ?? document.querySelector("#sidebar nav.tabs button, #sidebar nav.tabs a");
  const tabs = anchor?.parentElement
    ?? document.querySelector("#sidebar-tabs")
    ?? document.querySelector("#sidebar nav.tabs")
    ?? document.querySelector("#sidebar .tabs");
  if (!tabs) return;

  const existing = document.querySelector("#holysheet-sidebar-button");
  const button = existing ?? document.createElement("a");
  button.id = "holysheet-sidebar-button";
  button.className = "item hcc-sidebar-button";
  button.href = "#";
  delete button.dataset.tab;
  button.setAttribute("data-tooltip", game.i18n.localize("HCC.OpenCalendar"));
  button.setAttribute("aria-label", game.i18n.localize("HCC.OpenCalendar"));
  button.innerHTML = `<i class="fa-solid fa-calendar-days"></i>`;

  if (!existing) anchor?.after(button) ?? tabs.appendChild(button);
}

function setupDelegatedListeners() {
  if (delegatedListenersReady) return;
  delegatedListenersReady = true;

  document.addEventListener("click", async (event) => {
    const button = event.target.closest?.("#holysheet-sidebar-button");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const { HolysheetCalendarApp } = await import("./apps/calendar-app.js");
    new HolysheetCalendarApp({ mode: "list" }).render({ force: true });
  }, true);

  document.addEventListener("contextmenu", async (event) => {
    const button = event.target.closest?.("#holysheet-sidebar-button");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    await showWidget();
  }, true);
}

/**
 * Sidebar integration.
 *
 * Foundry's sidebar tab registry is internal and changes between versions, so we
 * take the robust, version-tolerant route: on every `renderSidebar` we inject a
 * native-looking "Quests" tab button into the sidebar's tab nav. Clicking it opens
 * the Quest Log application. This keeps the UI clean and integrated without
 * depending on private APIs.
 *
 * Rather than hand-build the button (which is fragile — v13/v14 render the tab icon
 * as a class on the button itself, not as an inner `<i>`), we deep-clone a real
 * sibling tab so we inherit its exact structure, classes, and sizing, then swap the
 * icon and rewire the click. This guarantees the tab flows in the column like the
 * native ones instead of wrapping beside its neighbour.
 */

import { MODULE_ID } from "../config.mjs";
import { QuestLogApp } from "../apps/quest-log.mjs";

const TAB_ID = "quests";
const TAB_ICON = "fa-solid fa-scroll";

/** Register the hook. Call once during `init`/`ready`. */
export function registerSidebar() {
  Hooks.on("renderSidebar", onRenderSidebar);
  // If the sidebar is already rendered (module enabled at runtime), inject now.
  if (ui.sidebar?.element) onRenderSidebar(ui.sidebar, ui.sidebar.element);
}

/**
 * @param {Application} sidebar
 * @param {HTMLElement|JQuery} html  v13+ passes an HTMLElement; older passes JQuery.
 */
function onRenderSidebar(sidebar, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;

  // The tab nav: prefer the explicit id (v13/v14), fall back to generic shapes.
  const nav =
    root.querySelector("#sidebar-tabs") ??
    root.querySelector("nav.tabs, menu.tabs, [data-group='primary']");
  if (!nav) return;

  // Avoid duplicate injection on re-render.
  if (nav.querySelector(`.quest-system-tab`)) return;

  // Clone a real sibling tab so we inherit its exact structure and sizing.
  // Skip our own tab and never pick the settings tab as the template.
  const sample = nav.querySelector('[data-tab]:not(.quest-system-tab):not([data-tab="settings"])')
    ?? nav.querySelector('[data-tab]:not(.quest-system-tab)');
  if (!sample) return;

  const btn = sample.cloneNode(true);
  btn.classList.add("quest-system-tab");
  btn.classList.remove("active");
  btn.dataset.tab = TAB_ID;
  // Drop the core tab action so Foundry doesn't try to activate a non-existent tab.
  delete btn.dataset.action;
  btn.removeAttribute("aria-pressed");
  btn.removeAttribute("aria-selected");
  btn.dataset.tooltip = game.i18n.localize("QUESTSYSTEM.SidebarTitle");
  btn.setAttribute("aria-label", game.i18n.localize("QUESTSYSTEM.SidebarTitle"));

  // Swap the icon. v13/v14 put the icon class on the button itself; older
  // layouts use an inner <i>. Handle both, and strip any inherited badges.
  const innerIcon = btn.querySelector("i");
  if (innerIcon) {
    btn.replaceChildren();
    const icon = document.createElement("i");
    icon.className = TAB_ICON;
    btn.appendChild(icon);
  } else {
    for (const cls of [...btn.classList]) {
      if (cls.startsWith("fa-")) btn.classList.remove(cls);
    }
    btn.classList.add(...TAB_ICON.split(" "));
  }

  btn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    QuestLogApp.toggle();
  });

  // Place it just before the settings tab if present, else append.
  const settingsTab = nav.querySelector('[data-tab="settings"]');
  if (settingsTab) settingsTab.before(btn);
  else nav.appendChild(btn);
}

/** Expose for the entry point. */
export const SidebarIntegration = { registerSidebar, MODULE_ID };

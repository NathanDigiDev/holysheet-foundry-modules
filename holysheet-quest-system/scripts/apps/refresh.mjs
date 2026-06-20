/**
 * Small registry so any part of the module can ask every open Quest System
 * window to re-render without importing each app class (avoids circular deps).
 */

const apps = new Set();

/** Register an open application instance. */
export function registerApp(app) {
  apps.add(app);
}

/** Unregister on close. */
export function unregisterApp(app) {
  apps.delete(app);
}

/** Re-render every live, rendered Quest System app. */
export function refreshAllApps() {
  for (const app of apps) {
    if (app.rendered) app.render({ force: false });
    else apps.delete(app);
  }
}

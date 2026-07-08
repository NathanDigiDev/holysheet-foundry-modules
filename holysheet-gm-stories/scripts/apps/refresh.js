const OPEN_APPS = new Set();

export function registerApp(app) {
  OPEN_APPS.add(app);
}

export function unregisterApp(app) {
  OPEN_APPS.delete(app);
}

export function refreshOpenApps() {
  for (const app of OPEN_APPS) {
    app.render({ force: false });
  }
}

const openApps = new Set();

export function registerApp(app) {
  openApps.add(app);
}

export function unregisterApp(app) {
  openApps.delete(app);
}

export function refreshContainerApps(itemUuid = null) {
  for (const app of openApps) {
    if (itemUuid && app.itemUuid !== itemUuid) continue;
    app.render({ force: false });
  }
}

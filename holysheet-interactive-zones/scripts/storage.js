import { DEFAULT_ZONE, FLAGS, MODULE_ID } from "./constants.js";

export function getSceneZones(scene = canvas?.scene) {
  const zones = scene?.getFlag(MODULE_ID, FLAGS.zones);
  return Array.isArray(zones) ? foundry.utils.deepClone(zones) : [];
}

export async function setSceneZones(zones, scene = canvas?.scene) {
  if (!scene || !game.user.isGM) return false;
  await scene.setFlag(MODULE_ID, FLAGS.zones, zones);
  return true;
}

export async function upsertSceneZone(zone, scene = canvas?.scene) {
  const zones = getSceneZones(scene);
  const index = zones.findIndex((candidate) => candidate.id === zone.id);
  if (index >= 0) zones[index] = zone;
  else zones.push(zone);
  return setSceneZones(zones, scene);
}

export async function deleteSceneZone(zoneId, scene = canvas?.scene) {
  const zones = getSceneZones(scene).filter((zone) => zone.id !== zoneId);
  return setSceneZones(zones, scene);
}

export function buildZone({ type, geometry }) {
  const id = foundry.utils.randomID();
  return foundry.utils.mergeObject(foundry.utils.deepClone(DEFAULT_ZONE), {
    id,
    name: game.i18n.format("HIZ.DefaultZoneName", { number: id.slice(0, 4) }),
    type,
    geometry: normalizeGeometry(type, geometry)
  }, { inplace: false });
}

export function canUseZone(zone, user = game.user) {
  if (!zone?.active) return false;
  if (user.isGM) return true;
  if (zone.visibilityMode !== "users") return true;
  return Array.isArray(zone.users) && zone.users.includes(user.id);
}

export function isZoneVisible(zone, user = game.user, { editing = false, hovered = false } = {}) {
  if (editing && user.isGM) return true;
  if (!canUseZone(zone, user)) return false;
  return Boolean(zone.alwaysVisible || hovered);
}

export function duplicateZone(zone) {
  const copy = foundry.utils.deepClone(zone);
  copy.id = foundry.utils.randomID();
  copy.name = game.i18n.format("HIZ.CopyName", { name: zone.name || game.i18n.localize("HIZ.Zone") });

  if (copy.type === "rect" || copy.type === "circle") {
    copy.geometry.x += 24;
    copy.geometry.y += 24;
  } else if (copy.type === "polygon") {
    copy.geometry.points = copy.geometry.points.map((point) => ({ x: point.x + 24, y: point.y + 24 }));
  }

  return copy;
}

function normalizeGeometry(type, geometry) {
  if (type === "polygon") {
    return {
      points: (geometry.points ?? []).map((point) => ({
        x: Number(point.x),
        y: Number(point.y)
      }))
    };
  }

  return {
    x: Number(geometry.x),
    y: Number(geometry.y),
    width: Number(geometry.width),
    height: Number(geometry.height)
  };
}

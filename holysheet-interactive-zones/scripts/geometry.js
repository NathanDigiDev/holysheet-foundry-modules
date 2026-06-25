export function normalizeDragGeometry(start, end) {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  return { x, y, width, height };
}

export function hasUsableSize(geometry) {
  return geometry.width >= 12 && geometry.height >= 12;
}

export function isPolygonClosed(points, threshold = 18) {
  if (!Array.isArray(points) || points.length < 3) return false;
  return distance(points[0], points.at(-1)) <= threshold;
}

export function closePolygon(points) {
  if (!isPolygonClosed(points)) return points;
  return points.slice(0, -1);
}

export function zoneBounds(zone) {
  if (zone.type === "rect" || zone.type === "circle") {
    const { x, y, width, height } = zone.geometry;
    return { x, y, width, height, center: { x: x + width / 2, y: y + height / 2 } };
  }

  const xs = zone.geometry.points.map((point) => point.x);
  const ys = zone.geometry.points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const width = Math.max(...xs) - x;
  const height = Math.max(...ys) - y;
  return { x, y, width, height, center: { x: x + width / 2, y: y + height / 2 } };
}

export function containsPoint(zone, point) {
  if (!zone?.geometry || !point) return false;
  if (zone.type === "rect") return containsRect(zone.geometry, point);
  if (zone.type === "circle") return containsEllipse(zone.geometry, point);
  if (zone.type === "polygon") return containsPolygon(zone.geometry.points, point);
  return false;
}

export function drawZoneShape(graphics, zone) {
  if (zone.type === "rect") {
    const { x, y, width, height } = zone.geometry;
    graphics.drawRect(x, y, width, height);
    return;
  }

  if (zone.type === "circle") {
    const { x, y, width, height } = zone.geometry;
    graphics.drawEllipse(x + width / 2, y + height / 2, width / 2, height / 2);
    return;
  }

  const points = zone.geometry.points ?? [];
  if (points.length < 2) return;
  graphics.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) graphics.lineTo(point.x, point.y);
  graphics.closePath();
}

export function drawOpenPolygon(graphics, points) {
  if (!points.length) return;
  graphics.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) graphics.lineTo(point.x, point.y);
}

function containsRect(rect, point) {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

function containsEllipse(ellipse, point) {
  const rx = ellipse.width / 2;
  const ry = ellipse.height / 2;
  if (!rx || !ry) return false;
  const cx = ellipse.x + rx;
  const cy = ellipse.y + ry;
  return (((point.x - cx) ** 2) / (rx ** 2)) + (((point.y - cy) ** 2) / (ry ** 2)) <= 1;
}

function containsPolygon(points, point) {
  if (!Array.isArray(points) || points.length < 3) return false;
  let inside = false;

  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;
    const intersects = ((yi > point.y) !== (yj > point.y)) && (point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi);
    if (intersects) inside = !inside;
  }

  return inside;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

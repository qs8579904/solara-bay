// Solara Bay's map: a road grid over five districts, a beach and the sea on
// the west edge, and the buildings that fill the blocks between the roads.
// Everything is placed from the seeded rng, so one seed always builds the
// same city. Collision is circle-vs-rectangle: the player and the cars are
// circles for this test, which keeps the push-out math to a few lines.
import { BEACH, DISTRICTS, ROADS_H, ROADS_V, ROAD_W, WATER, WORLD } from './config.js';

const ROOFS = ['#b5543f', '#c98a4b', '#7a8a99', '#9a7b4f', '#5f7d8c', '#a85f6e', '#6e8f5a', '#8a6f9e'];

// The gaps between neighbouring roads, plus the strips at the map edges: the
// cells buildings can stand in. Each cell is [x0, y0, x1, y1].
function blockCells() {
  const xs = [BEACH.x1];
  for (const x of ROADS_V) xs.push(x - ROAD_W / 2, x + ROAD_W / 2);
  xs.push(WORLD.width);
  const ys = [0];
  for (const y of ROADS_H) ys.push(y - ROAD_W / 2, y + ROAD_W / 2);
  ys.push(WORLD.height);
  const cells = [];
  for (let i = 0; i + 1 < xs.length; i += 2) {
    for (let j = 0; j + 1 < ys.length; j += 2) {
      cells.push([xs[i], ys[j], xs[i + 1], ys[j + 1]]);
    }
  }
  return cells;
}

// The district whose rectangle holds the point; roads fall back to the
// district whose rectangle is nearest, so every point has a district.
export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  let best = DISTRICTS[0];
  let bestD = Infinity;
  for (const d of DISTRICTS) {
    const dx = Math.max(d.x - x, 0, x - (d.x + d.w));
    const dy = Math.max(d.y - y, 0, y - (d.y + d.h));
    const dd = dx * dx + dy * dy;
    if (dd < bestD) {
      bestD = dd;
      best = d;
    }
  }
  return best;
}

export function isWater(x, y) {
  return x < WATER.x1 && y >= 0 && y < WORLD.height;
}

export function onRoad(x, y) {
  const half = ROAD_W / 2 + 4;
  for (const rx of ROADS_V) if (Math.abs(x - rx) <= half) return true;
  for (const ry of ROADS_H) if (Math.abs(y - ry) <= half) return true;
  return false;
}

// The closest point on any road centreline to (x, y).
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of ROADS_V) {
    const px = rx;
    const py = Math.max(0, Math.min(WORLD.height, y));
    const d = (px - x) * (px - x) + (py - y) * (py - y);
    if (d < bestD) {
      bestD = d;
      best = { x: px, y: py, vertical: true };
    }
  }
  for (const ry of ROADS_H) {
    const px = Math.max(BEACH.x1, Math.min(WORLD.width, x));
    const py = ry;
    const d = (px - x) * (px - x) + (py - y) * (py - y);
    if (d < bestD) {
      bestD = d;
      best = { x: px, y: py, vertical: false };
    }
  }
  return best;
}

// A random point on a pavement: just off a road's edge, where pedestrians walk.
export function randomSidewalkPoint(rng) {
  if (rng.chance(0.5)) {
    const rx = rng.pick(ROADS_V);
    const side = rng.chance(0.5) ? 1 : -1;
    return { x: rx + side * (ROAD_W / 2 + 16), y: rng.range(40, WORLD.height - 40) };
  }
  const ry = rng.pick(ROADS_H);
  const side = rng.chance(0.5) ? 1 : -1;
  return { x: rng.range(BEACH.x1 + 20, WORLD.width - 20), y: ry + side * (ROAD_W / 2 + 16) };
}

// Push a circle (x, y, radius r) out of buildings, the sea and the map edge.
// Returns the corrected position; the caller keeps the old one when nothing
// overlaps, so a still circle costs nothing.
export function collideCircle(city, x, y, r) {
  let nx = x;
  let ny = y;
  if (nx < WATER.x1 + r) nx = WATER.x1 + r;
  if (nx > WORLD.width - r) nx = WORLD.width - r;
  if (ny < r) ny = r;
  if (ny > WORLD.height - r) ny = WORLD.height - r;
  for (let i = 0; i < city.buildings.length; i += 1) {
    const b = city.buildings[i];
    if (nx + r <= b.x || nx - r >= b.x + b.w || ny + r <= b.y || ny - r >= b.y + b.h) continue;
    const cx = Math.max(b.x, Math.min(nx, b.x + b.w));
    const cy = Math.max(b.y, Math.min(ny, b.y + b.h));
    let dx = nx - cx;
    let dy = ny - cy;
    if (dx === 0 && dy === 0) {
      // Centre inside the rectangle: leave by the nearest face.
      const left = nx - b.x;
      const right = b.x + b.w - nx;
      const top = ny - b.y;
      const bottom = b.y + b.h - ny;
      const m = Math.min(left, right, top, bottom);
      if (m === left) nx = b.x - r;
      else if (m === right) nx = b.x + b.w + r;
      else if (m === top) ny = b.y - r;
      else ny = b.y + b.h + r;
      continue;
    }
    const d = Math.hypot(dx, dy);
    if (d < r) {
      nx = cx + (dx / d) * r;
      ny = cy + (dy / d) * r;
    }
  }
  return { x: nx, y: ny };
}

export function buildCity(rng) {
  const buildings = [];
  const parks = [];
  const cells = blockCells();
  for (let i = 0; i < cells.length; i += 1) {
    const [x0, y0, x1, y1] = cells[i];
    const w = x1 - x0;
    const h = y1 - y0;
    if (w < 70 || h < 70) continue;
    const district = districtAt((x0 + x1) / 2, (y0 + y1) / 2);
    if (rng.chance(0.16)) {
      parks.push({ x: x0, y: y0, w, h, district: district.name });
      continue;
    }
    const inset = 18;
    if (w > 220 && rng.chance(0.5)) {
      // Two buildings side by side in a wide block.
      const mid = x0 + w * rng.range(0.42, 0.58);
      buildings.push({ x: x0 + inset, y: y0 + inset, w: mid - x0 - inset * 2, h: h - inset * 2, color: rng.pick(ROOFS), district: district.name });
      buildings.push({ x: mid + inset, y: y0 + inset, w: x1 - mid - inset * 2, h: h - inset * 2, color: rng.pick(ROOFS), district: district.name });
    } else if (h > 220 && rng.chance(0.5)) {
      const mid = y0 + h * rng.range(0.42, 0.58);
      buildings.push({ x: x0 + inset, y: y0 + inset, w: w - inset * 2, h: mid - y0 - inset * 2, color: rng.pick(ROOFS), district: district.name });
      buildings.push({ x: x0 + inset, y: mid + inset, w: w - inset * 2, h: y1 - mid - inset * 2, color: rng.pick(ROOFS), district: district.name });
    } else {
      buildings.push({ x: x0 + inset, y: y0 + inset, w: w - inset * 2, h: h - inset * 2, color: rng.pick(ROOFS), district: district.name });
    }
  }
  return { buildings, parks, districts: DISTRICTS };
}

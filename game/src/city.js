// Solara Bay itself: the coastline, the road grid, the five districts, the buildings
// and every fixed address the missions use. Water is a wall here — nothing, on foot or
// in a car, may enter the sea, and the coast is checked as a collision edge.
import { WORLD_W, WORLD_H } from './config.js';

export const ROADS_V = [330, 430, 830, 1230, 1630, 2030];
export const ROADS_H = [330, 630, 930, 1230, 1530];
export const ROAD_HALF = 34;
// The ridge road that winds through the Hills, as a polyline.
export const RIDGE = [
  { x: 1630, y: 330 },
  { x: 1900, y: 250 },
  { x: 2140, y: 210 },
  { x: 2320, y: 140 },
];
export const RIDGE_HALF = 26;

const DISTRICTS = [
  { name: 'Marina', x: 250, y: 40, w: 580, h: 590, ground: '#8fce6b' },
  { name: 'Old Town', x: 430, y: 630, w: 800, h: 600, ground: '#79c25a' },
  { name: 'The Strip', x: 430, y: 830, w: 1600, h: 200, ground: '#8ac768' },
  { name: 'Docks', x: 1230, y: 1230, w: 1130, h: 530, ground: '#8a8f7a' },
  { name: 'The Hills', x: 1630, y: 40, w: 730, h: 590, ground: '#5da84a' },
];

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

export function buildCity(rng) {
  // The shoreline wanders a little; the sea is everything west of it.
  function coastX(y) {
    return 185 + 28 * Math.sin(y * 0.004) + 12 * Math.sin(y * 0.0013 + 1.7);
  }
  function inWater(x, y) {
    return x < coastX(y);
  }

  const points = {
    spawn: { x: 520, y: 500 },
    bar: { x: 470, y: 430 },
    spray: { x: 1150, y: 1460 },
    safehouse: { x: 700, y: 820 },
    garage: { x: 1520, y: 1620 },
    marinaDrop: { x: 430, y: 250 },
    docksPickup: { x: 1850, y: 1480 },
    hillsVilla: { x: 2080, y: 240 },
    yacht: { x: 300, y: 1620 },
    stripCash: { x: 1230, y: 880 },
    policeStation: { x: 1300, y: 300 },
    taxiStand: { x: 830, y: 930 },
    medicPoint: { x: 900, y: 1330 },
  };

  const keepClear = Object.values(points).concat([{ x: 520, y: 500 }]);
  function nearKeepOut(x, y, w, h) {
    for (const p of keepClear) {
      if (p.x > x - 120 && p.x < x + w + 120 && p.y > y - 120 && p.y < y + h + 120) return true;
    }
    return false;
  }
  function nearRidge(x, y, w, h) {
    for (let i = 0; i + 1 < RIDGE.length; i += 1) {
      const a = RIDGE[i];
      const b = RIDGE[i + 1];
      if (segDist(x + w / 2, y + h / 2, a.x, a.y, b.x, b.y) < 80) return true;
    }
    return false;
  }

  const roofColors = ['#c96f4a', '#e0a458', '#7d8ba0', '#a8546e', '#b5763f'];
  const buildings = [];
  // Named buildings first, so the missions always have their landmarks.
  buildings.push({ x: 425, y: 400, w: 92, h: 62, color: '#a8546e', label: "Kroll's Bar" });
  buildings.push({ x: 655, y: 790, w: 88, h: 60, color: '#7d8ba0', label: 'Safehouse' });
  buildings.push({ x: 1470, y: 1585, w: 104, h: 72, color: '#e0a458', label: 'Garage' });
  buildings.push({ x: 1255, y: 265, w: 96, h: 70, color: '#22375e', label: 'SBPD Station' });
  buildings.push({ x: 2030, y: 200, w: 100, h: 80, color: '#e0a458', label: 'Villa' });

  // Fill the blocks between roads with seeded buildings.
  const colEdges = [250].concat(ROADS_V).concat([WORLD_W - 30]);
  const rowEdges = [40].concat(ROADS_H).concat([WORLD_H - 30]);
  for (let ci = 0; ci + 1 < colEdges.length; ci += 1) {
    for (let ri = 0; ri + 1 < rowEdges.length; ri += 1) {
      const bx0 = colEdges[ci] + ROAD_HALF + 14;
      const bx1 = colEdges[ci + 1] - ROAD_HALF - 14;
      const by0 = rowEdges[ri] + ROAD_HALF + 14;
      const by1 = rowEdges[ri + 1] - ROAD_HALF - 14;
      if (bx1 - bx0 < 90 || by1 - by0 < 80) continue;
      const count = rng.int(1, 2);
      for (let k = 0; k < count; k += 1) {
        const w = rng.range(70, Math.min(150, bx1 - bx0 - 20));
        const h = rng.range(55, Math.min(120, by1 - by0 - 20));
        const x = rng.range(bx0, bx1 - w);
        const y = rng.range(by0, by1 - h);
        if (nearKeepOut(x, y, w, h) || nearRidge(x, y, w, h)) continue;
        if (buildings.some((b) => x < b.x + b.w + 18 && x + w + 18 > b.x && y < b.y + b.h + 18 && y + h + 18 > b.y)) continue;
        buildings.push({ x, y, w, h, color: rng.pick(roofColors), label: '' });
      }
    }
  }

  // Palms along the coastal avenue and around the Marina.
  const palms = [];
  for (let i = 0; i < 46; i += 1) {
    const y = rng.range(90, WORLD_H - 90);
    const side = rng.chance(0.5) ? -1 : 1;
    const x = 330 + side * rng.range(52, 66);
    if (inWater(x, y)) continue;
    palms.push({ x, y, lean: rng.range(-0.2, 0.2) });
  }

  function onRoad(x, y) {
    for (const rx of ROADS_V) if (Math.abs(x - rx) <= ROAD_HALF) return true;
    for (const ry of ROADS_H) if (Math.abs(y - ry) <= ROAD_HALF) return true;
    for (let i = 0; i + 1 < RIDGE.length; i += 1) {
      if (segDist(x, y, RIDGE[i].x, RIDGE[i].y, RIDGE[i + 1].x, RIDGE[i + 1].y) <= RIDGE_HALF) return true;
    }
    return false;
  }

  function groundAt(x, y) {
    if (inWater(x, y)) return 'water';
    if (x < coastX(y) + 64) return 'sand';
    if (onRoad(x, y)) return 'road';
    return 'grass';
  }

  // Circle-versus-world collision. Water, buildings and the map edge all block.
  function blocked(x, y, r) {
    if (x < r + 4 || y < r + 4 || x > WORLD_W - r - 4 || y > WORLD_H - r - 4) return true;
    if (x - r < coastX(y) || x - r < coastX(y - r) || x - r < coastX(y + r)) return true;
    for (const b of buildings) {
      const cx = Math.max(b.x, Math.min(x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(y, b.y + b.h));
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy < r * r) return true;
    }
    return false;
  }

  // The closest point on a road centreline: where police cars and traffic spawn.
  function nearestRoadPoint(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const rx of ROADS_V) {
      const d = Math.abs(x - rx);
      if (d < bestD) {
        bestD = d;
        best = { x: rx, y: Math.max(60, Math.min(WORLD_H - 60, y)) };
      }
    }
    for (const ry of ROADS_H) {
      const d = Math.abs(y - ry);
      if (d < bestD) {
        bestD = d;
        best = { x: Math.max(60, Math.min(WORLD_W - 60, x)), y: ry };
      }
    }
    return best;
  }

  function districtAt(x, y) {
    for (const d of DISTRICTS) {
      if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
    }
    return DISTRICTS[1];
  }

  return {
    coastX, inWater, onRoad, groundAt, blocked, nearestRoadPoint, districtAt,
    districts: DISTRICTS, buildings, palms, points,
  };
}

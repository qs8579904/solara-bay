// Fighting, the Solara Bay way: fists on foot, the car itself everywhere
// else. No guns. A punch drops a pedestrian and earns a star; running a
// pedestrian down in a car does the same; ramming a police car is also a
// crime. Car crashes cost durability on both sides.
import { PLAYER } from './config.js';
import { addWanted } from './police.js';

// A punch on foot: the nearest pedestrian inside reach and inside the facing
// cone goes down for a few seconds. Half the time they drop a little cash.
export function tryPunch(state) {
  const p = state.player;
  if (!p.onFoot || p.punchCd > 0) return false;
  p.punchCd = PLAYER.punchCd;
  let best = null;
  let bestD = PLAYER.punchRange;
  for (let i = 0; i < state.peds.length; i += 1) {
    const ped = state.peds[i];
    if (ped.state !== 'walk' && ped.state !== 'flee') continue;
    const d = Math.hypot(ped.x - p.x, ped.y - p.y);
    if (d >= bestD) continue;
    const ang = Math.atan2(ped.y - p.y, ped.x - p.x);
    let diff = Math.abs(ang - p.angle);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff > PLAYER.punchArc) continue;
    best = ped;
    bestD = d;
  }
  if (!best) return false;
  best.state = 'down';
  best.timer = 3;
  addWanted(state, 1);
  if (state.rng.chance(0.5)) {
    state.pickups.push({ x: best.x, y: best.y, amount: 10, taken: false });
  }
  state.effects.push({ kind: 'flash', x: best.x, y: best.y, life: 0.25, max: 0.25 });
  return true;
}

// Two cars overlapping: push them apart along the line between them and bill
// both for the impact. Returns the closing speed, for callers that care.
// damage=false pushes without billing — for the Lobos car, whose damage is
// the mission's business, not the generic collider's.
export function collideCars(state, a, b, damage = true) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (d >= 46 || d === 0) return 0;
  const nx = dx / d;
  const ny = dy / d;
  const overlap = (46 - d) / 2;
  a.x -= nx * overlap;
  a.y -= ny * overlap;
  b.x += nx * overlap;
  b.y += ny * overlap;
  // Closing speed along the impact line, signed: positive only while the
  // cars are actually moving toward each other. Cars already touching and
  // sliding apart do not bill damage every step, and one crash is one crash
  // per pair per half second.
  const avx = Math.cos(a.angle) * (a.speed || 0);
  const avy = Math.sin(a.angle) * (a.speed || 0);
  const bvx = Math.cos(b.angle) * (b.speed || 0);
  const bvy = Math.sin(b.angle) * (b.speed || 0);
  const closing = (bvx - avx) * nx + (bvy - avy) * ny;
  if (closing > 60 && damage && state.time >= (a.hitUntil || 0) && state.time >= (b.hitUntil || 0)) {
    const dmg = closing * 0.03;
    a.durability -= dmg;
    b.durability -= dmg;
    a.hitUntil = state.time + 0.5;
    b.hitUntil = state.time + 0.5;
    state.effects.push({ kind: 'debris', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, life: 0.8, max: 0.8, count: 5 });
  }
  return closing;
}

// The player's car against the world: pedestrians it runs down, police cars
// it rams, and the plain traffic it shoves. Called once per step.
export function playerCarHits(state) {
  const p = state.player;
  if (p.onFoot || !p.car) return;
  const car = p.car;
  for (let i = 0; i < state.peds.length; i += 1) {
    const ped = state.peds[i];
    if (ped.state !== 'walk' && ped.state !== 'flee') continue;
    if (Math.hypot(ped.x - car.x, ped.y - car.y) < 30 && Math.abs(car.speed) > 60) {
      ped.state = 'down';
      ped.timer = 3;
      addWanted(state, 1);
      state.message = { text: 'You hit a pedestrian!', until: state.time + 2 };
    }
  }
  for (let i = 0; i < state.cops.length; i += 1) {
    const cop = state.cops[i];
    if (cop.kind !== 'police') continue;
    if (Math.hypot(cop.x - car.x, cop.y - car.y) < 50 && Math.abs(car.speed) > 150 && cop.hitCd <= 0) {
      cop.hitCd = 1.2;
      addWanted(state, 1);
      state.message = { text: 'You rammed a cop car!', until: state.time + 2 };
    }
  }
  for (let i = 0; i < state.cars.length; i += 1) {
    const other = state.cars[i];
    if (other === car || other.kind === 'lobos') continue;
    collideCars(state, car, other);
  }
  // The Lobos car is rammed through the mission, not the generic collider:
  // its damage is the mission's business, the shove is still physics.
  const lobos = state.mission.lobos;
  if (lobos && lobos.durability > 0) collideCars(state, car, lobos, false);
}

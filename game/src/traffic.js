// The city's other life: civilian cars that drive the road grid, pedestrians
// who walk the pavements, and parked cars waiting by the kerb. Traffic cars
// follow their road and turn at intersections; pedestrians pick a pavement
// point, walk to it and pick another. A knocked-down pedestrian gets up and
// runs. Nothing here knows about the player except the flee direction.
import { CAR, ROADS_H, ROADS_V, ROAD_W, TRAFFIC, WORLD } from './config.js';
import { collideCircle, nearestRoadPoint, randomSidewalkPoint } from './city.js';

const CAR_COLORS = ['#c8ccd4', '#7a8a99', '#e8c85a', '#5f7d8c', '#a85f6e', '#6e8f5a', '#d8d8d8', '#3f5a78'];
const SHIRTS = ['#e8e8e8', '#d6409e', '#4a90d9', '#e8a33d', '#7a9e4f', '#c96a5a'];

function angleFor(vertical, dir) {
  if (vertical) return dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  return dir > 0 ? 0 : Math.PI;
}

function spawnCivilCar(rng, city, x, y) {
  const vertical = rng.chance(0.5);
  const road = vertical ? rng.pick(ROADS_V) : rng.pick(ROADS_H);
  const dir = rng.chance(0.5) ? 1 : -1;
  const speed = rng.range(TRAFFIC.carSpeed[0], TRAFFIC.carSpeed[1]);
  const car = {
    kind: 'civil',
    x: vertical ? road : rng.range(300, WORLD.width - 60),
    y: vertical ? rng.range(60, WORLD.height - 60) : road,
    vertical,
    road,
    dir,
    speed,
    targetSpeed: speed,
    angle: angleFor(vertical, dir),
    color: rng.pick(CAR_COLORS),
    durability: CAR.durability,
    driver: true,
    parked: false,
    lastTurn: 0,
    width: CAR.width,
    length: CAR.length,
  };
  // Keep the player's spawn clear so the first seconds are never a pile-up.
  if (Math.hypot(car.x - x, car.y - y) < 220) {
    car.x = vertical ? road : rng.range(1200, WORLD.width - 60);
    car.y = vertical ? rng.range(1200, WORLD.height - 60) : road;
  }
  return car;
}

function spawnPed(rng, x, y) {
  const p = randomSidewalkPoint(rng);
  const t = randomSidewalkPoint(rng);
  const ped = {
    x: p.x,
    y: p.y,
    tx: t.x,
    ty: t.y,
    angle: 0,
    speed: rng.range(TRAFFIC.pedSpeed[0], TRAFFIC.pedSpeed[1]),
    state: 'walk',
    timer: 0,
    color: rng.pick(SHIRTS),
  };
  if (Math.hypot(ped.x - x, ped.y - y) < 120) {
    ped.x = p.x + 400;
    ped.y = p.y;
  }
  return ped;
}

function spawnParked(rng) {
  const vertical = rng.chance(0.5);
  const road = vertical ? rng.pick(ROADS_V) : rng.pick(ROADS_H);
  const side = rng.chance(0.5) ? 1 : -1;
  // Parked at the kerb, on the road — not inside the block behind it, where
  // a building would swallow the car.
  const offset = ROAD_W / 2 - 16;
  return {
    kind: 'parked',
    x: vertical ? road + side * offset : rng.range(320, WORLD.width - 80),
    y: vertical ? rng.range(120, WORLD.height - 120) : road + side * offset,
    vertical,
    dir: side > 0 ? 1 : -1,
    angle: angleFor(vertical, side > 0 ? 1 : -1),
    speed: 0,
    targetSpeed: 0,
    color: rng.pick(CAR_COLORS),
    durability: CAR.durability,
    driver: false,
    parked: true,
    owned: rng.chance(0.6),
    lastTurn: 0,
    width: CAR.width,
    length: CAR.length,
  };
}

export function createTraffic(city, rng, spawn) {
  const cars = [];
  for (let i = 0; i < TRAFFIC.carCount; i += 1) cars.push(spawnCivilCar(rng, city, spawn.x, spawn.y));
  for (let i = 0; i < TRAFFIC.parkedCount; i += 1) cars.push(spawnParked(rng));
  const peds = [];
  for (let i = 0; i < TRAFFIC.pedCount; i += 1) peds.push(spawnPed(rng, spawn.x, spawn.y));
  return { cars, peds };
}

// One traffic car, one step: follow its road, slow for the car ahead, and at
// an intersection sometimes turn onto the crossing road.
function stepCivilCar(car, state, dt, rng) {
  // A wrecked car does not keep driving: it coasts to a stop and stays there.
  if (car.durability <= 0) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 400 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    return;
  }
  let target = car.targetSpeed;
  for (let i = 0; i < state.cars.length; i += 1) {
    const other = state.cars[i];
    if (other === car || other.kind !== 'civil' || other.vertical !== car.vertical || other.road !== car.road || other.dir !== car.dir) continue;
    const ahead = car.vertical ? (other.y - car.y) * car.dir : (other.x - car.x) * car.dir;
    if (ahead > 0 && ahead < 78) target = Math.min(target, other.speed * 0.9);
  }
  car.speed += (target - car.speed) * Math.min(1, 2 * dt);
  if (car.vertical) car.y += car.dir * car.speed * dt;
  else car.x += car.dir * car.speed * dt;
  car.angle = angleFor(car.vertical, car.dir);
  // At an intersection, sometimes turn. The cooldown stops a car flipping
  // between two roads every frame.
  const crossings = car.vertical ? ROADS_H : ROADS_V;
  const along = car.vertical ? car.y : car.x;
  if (state.time - car.lastTurn > 1.5) {
    for (let i = 0; i < crossings.length; i += 1) {
      if (Math.abs(along - crossings[i]) < 12 && rng.chance(0.3)) {
        car.lastTurn = state.time;
        if (car.vertical) {
          car.vertical = false;
          car.road = crossings[i];
          car.y = crossings[i];
          car.dir = rng.chance(0.5) ? 1 : -1;
        } else {
          car.vertical = true;
          car.road = crossings[i];
          car.x = crossings[i];
          car.dir = rng.chance(0.5) ? 1 : -1;
        }
        break;
      }
    }
  }
  // At the end of a road, turn around instead of leaving the map.
  if (car.vertical && (car.y < 40 || car.y > WORLD.height - 40)) car.dir *= -1;
  if (!car.vertical && (car.x < 300 || car.x > WORLD.width - 40)) car.dir *= -1;
  if (car.vertical) car.x = car.road;
  else car.y = car.road;
}

function stepPed(ped, state, dt, rng) {
  if (ped.state === 'down') {
    ped.timer -= dt;
    if (ped.timer <= 0) {
      ped.state = 'flee';
      ped.timer = 4;
    }
    return;
  }
  if (ped.state === 'flee') {
    const dx = ped.x - state.player.x;
    const dy = ped.y - state.player.y;
    const d = Math.hypot(dx, dy) || 1;
    ped.x += (dx / d) * 200 * dt;
    ped.y += (dy / d) * 200 * dt;
    ped.angle = Math.atan2(dy, dx);
    ped.timer -= dt;
    if (ped.timer <= 0) {
      ped.state = 'walk';
      const t = randomSidewalkPoint(rng);
      ped.tx = t.x;
      ped.ty = t.y;
    }
    const fixed = collideCircle(state.city, ped.x, ped.y, 10);
    ped.x = fixed.x;
    ped.y = fixed.y;
    return;
  }
  const dx = ped.tx - ped.x;
  const dy = ped.ty - ped.y;
  const d = Math.hypot(dx, dy);
  if (d < 10) {
    const t = randomSidewalkPoint(rng);
    ped.tx = t.x;
    ped.ty = t.y;
    return;
  }
  ped.x += (dx / d) * ped.speed * dt;
  ped.y += (dy / d) * ped.speed * dt;
  ped.angle = Math.atan2(dy, dx);
  const fixed = collideCircle(state.city, ped.x, ped.y, 10);
  ped.x = fixed.x;
  ped.y = fixed.y;
}

export function updateTraffic(state, dt) {
  const rng = state.rng;
  for (let i = 0; i < state.cars.length; i += 1) {
    const car = state.cars[i];
    if (car.kind === 'civil') stepCivilCar(car, state, dt, rng);
  }
  for (let i = 0; i < state.peds.length; i += 1) stepPed(state.peds[i], state, dt, rng);
}

// The nearest car to (x, y) within maxDist, optionally filtered by kind.
export function nearestCar(state, x, y, maxDist, kind) {
  let best = null;
  let bestD = maxDist;
  for (let i = 0; i < state.cars.length; i += 1) {
    const car = state.cars[i];
    if (kind && car.kind !== kind) continue;
    if (car === state.player.car) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

// The nearest point on a road to (x, y), for spawning and respawning.
export { nearestRoadPoint };

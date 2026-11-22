// Traffic and pedestrians: the city alive around the player. Cars cruise the road grid
// and turn at intersections, pedestrians stroll the sidewalks and scatter from a fast
// car, parked cars wait to be stolen, and loose cash waits to be picked up.
import { ROADS_V, ROADS_H, ROAD_HALF } from './city.js';
import { TRAFFIC_CARS, PEDESTRIANS, PARKED_CARS, PICKUPS, MONEY } from './config.js';

const CAR_COLORS = ['#c94f43', '#4a7fb5', '#d8c25a', '#7a7f8a', '#5a8a5a', '#b5763f', '#8a6fb5', '#d8d8d8'];
const SHIRT_COLORS = ['#e86a6a', '#6aa5e8', '#e8c96a', '#7ac98a', '#c96ad8', '#e8e8e8', '#6ad8c9'];

function randomRoadPoint(rng, city) {
  if (rng.chance(0.5)) {
    const rx = rng.pick(ROADS_V);
    return { x: rx, y: rng.range(80, 1720) };
  }
  const ry = rng.pick(ROADS_H);
  return { x: rng.range(360, 2320), y: ry };
}

export function createTraffic(rng, city) {
  const cars = [];
  for (let i = 0; i < TRAFFIC_CARS; i += 1) {
    const vertical = rng.chance(0.5);
    const road = vertical ? rng.pick(ROADS_V) : rng.pick(ROADS_H);
    const dir = rng.chance(0.5) ? 1 : -1;
    const lane = rng.chance(0.5) ? -11 : 11;
    const x = vertical ? road + lane : rng.range(360, 2320);
    const y = vertical ? rng.range(80, 1720) : road + lane;
    cars.push({
      x, y,
      angle: vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      speed: rng.range(90, 150), targetSpeed: rng.range(90, 150),
      color: rng.pick(CAR_COLORS), kind: 'traffic', health: 100,
      axis: vertical ? 'v' : 'h', dir, road, lane, turnCooldown: rng.range(1, 4),
    });
  }

  const peds = [];
  for (let i = 0; i < PEDESTRIANS; i += 1) {
    const p = randomRoadPoint(rng, city);
    peds.push({
      x: p.x, y: p.y, angle: rng.range(0, Math.PI * 2), speed: rng.range(28, 48),
      tx: p.x, ty: p.y, color: rng.pick(SHIRT_COLORS), state: 'walk',
      downTimer: 0, pause: rng.range(0, 2),
    });
  }

  const parked = [];
  for (let i = 0; i < PARKED_CARS; i += 1) {
    const vertical = rng.chance(0.5);
    const road = vertical ? rng.pick(ROADS_V) : rng.pick(ROADS_H);
    const along = vertical ? rng.range(120, 1680) : rng.range(420, 2280);
    const side = rng.chance(0.5) ? -1 : 1;
    const x = vertical ? road + side * (ROAD_HALF + 18) : along;
    const y = vertical ? along : road + side * (ROAD_HALF + 18);
    if (city.inWater(x, y)) continue;
    parked.push({
      x, y,
      angle: vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI),
      speed: 0, color: rng.pick(CAR_COLORS), kind: 'parked', health: 100, occupied: false,
    });
  }

  const pickups = [];
  for (let i = 0; i < PICKUPS; i += 1) {
    const p = randomRoadPoint(rng, city);
    pickups.push({
      x: p.x + rng.range(-50, 50), y: p.y + rng.range(-50, 50),
      amount: rng.int(MONEY.pickupMin, MONEY.pickupMax), active: true, respawn: 0,
    });
  }

  const special = [];

  function allCars() {
    return cars.concat(parked).concat(special);
  }

  function nearestStealable(x, y, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of allCars()) {
      if (car.kind === 'traffic' && car.speed > 5) continue;
      const d = Math.hypot(car.x - x, car.y - y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function carAhead(car, others) {
    let nearest = Infinity;
    for (const o of others) {
      if (o === car || o.speed === 0 && o.kind === 'parked') continue;
      if (o.axis !== car.axis || o.road !== car.road || o.dir !== car.dir) continue;
      const along = car.axis === 'v' ? (o.y - car.y) * car.dir : (o.x - car.x) * car.dir;
      const lateral = car.axis === 'v' ? Math.abs(o.x - car.x) : Math.abs(o.y - car.y);
      if (along > 0 && along < 78 && lateral < 26 && along < nearest) nearest = along;
    }
    return nearest;
  }

  function stepCar(car, dt, game) {
    car.turnCooldown -= dt;
    // Ease toward the target speed; stop for the car ahead, including the player's.
    const others = allCars().concat(game.player.car ? [game.player.car] : []);
    const gap = carAhead(car, others);
    car.targetSpeed = gap < 78 ? 0 : car.cruise || 120;
    if (!car.cruise) car.cruise = car.targetSpeed;
    if (gap < 78) car.targetSpeed = 0;
    else if (car.targetSpeed === 0) car.targetSpeed = car.cruise;
    car.speed += Math.max(-260 * dt, Math.min(200 * dt, car.targetSpeed - car.speed));

    // Move along the current road.
    const step = car.speed * car.dir * dt;
    if (car.axis === 'v') car.y += step;
    else car.x += step;

    // At an intersection, sometimes turn onto the crossing road.
    if (car.turnCooldown <= 0 && car.speed > 20) {
      const crossings = car.axis === 'v' ? ROADS_H : ROADS_V;
      const along = car.axis === 'v' ? car.y : car.x;
      for (const c of crossings) {
        const before = along - step;
        if ((before < c && along >= c) || (before > c && along <= c)) {
          if (game.rng.chance(0.35)) {
            const newDir = game.rng.chance(0.5) ? 1 : -1;
            const newLane = game.rng.chance(0.5) ? -11 : 11;
            if (car.axis === 'v') {
              car.y = c;
              car.axis = 'h';
              car.road = c;
              car.dir = newDir;
              car.lane = newLane;
              car.y = c + newLane;
              car.angle = newDir > 0 ? 0 : Math.PI;
            } else {
              car.x = c;
              car.axis = 'v';
              car.road = c;
              car.dir = newDir;
              car.lane = newLane;
              car.x = c + newLane;
              car.angle = newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
            }
            car.turnCooldown = 2.5;
          }
          break;
        }
      }
    }
    // Wrap around the map edges so traffic never runs out.
    if (car.axis === 'v' && (car.y < 60 || car.y > 1740)) {
      car.y = car.y < 60 ? 1740 : 60;
    }
    if (car.axis === 'h' && (car.x < 340 || car.x > 2340)) {
      car.x = car.x < 340 ? 2340 : 340;
    }
  }

  function stepPed(ped, dt, game) {
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.state = 'flee';
        ped.fleeTimer = 3;
      }
      return;
    }
    const player = game.player;
    const playerSpeed = player.car ? Math.abs(player.car.speed) : 0;
    const px = player.car ? player.car.x : player.x;
    const py = player.car ? player.car.y : player.y;
    const dPlayer = Math.hypot(ped.x - px, ped.y - py);
    if (ped.state !== 'flee' && playerSpeed > 120 && dPlayer < 110) {
      ped.state = 'flee';
      ped.fleeTimer = 2.5;
    }
    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      const away = Math.atan2(ped.y - py, ped.x - px);
      ped.angle = away;
      ped.x += Math.cos(away) * 120 * dt;
      ped.y += Math.sin(away) * 120 * dt;
      if (ped.fleeTimer <= 0) ped.state = 'walk';
      if (city.blocked(ped.x, ped.y, 10)) {
        ped.x -= Math.cos(away) * 120 * dt;
        ped.y -= Math.sin(away) * 120 * dt;
      }
      return;
    }
    if (ped.pause > 0) {
      ped.pause -= dt;
      return;
    }
    const dx = ped.tx - ped.x;
    const dy = ped.ty - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 12) {
      const next = randomRoadPoint(game.rng, city);
      ped.tx = next.x + game.rng.range(-46, 46);
      ped.ty = next.y + game.rng.range(-46, 46);
      ped.pause = game.rng.range(0, 2.5);
      return;
    }
    ped.angle = Math.atan2(dy, dx);
    const nx = ped.x + (dx / d) * ped.speed * dt;
    const ny = ped.y + (dy / d) * ped.speed * dt;
    if (!city.blocked(nx, ny, 10)) {
      ped.x = nx;
      ped.y = ny;
    } else {
      ped.tx = ped.x;
      ped.ty = ped.y;
    }
  }

  function update(game, dt) {
    for (const car of cars) stepCar(car, dt, game);
    for (const ped of peds) stepPed(ped, dt, game);
    for (const p of pickups) {
      if (!p.active) {
        p.respawn -= dt;
        if (p.respawn <= 0) {
          p.active = true;
          p.amount = game.rng.int(MONEY.pickupMin, MONEY.pickupMax);
        }
      }
    }
  }

  function addParked(x, y, angle, color) {
    const car = { x, y, angle, speed: 0, color, kind: 'parked', health: 100, occupied: false };
    parked.push(car);
    return car;
  }

  return {
    cars, peds, parked, pickups, special,
    allCars, nearestStealable, update, addParked,
  };
}

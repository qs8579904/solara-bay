// The law in Solara Bay: a wanted level from 0 to 5 stars, police cars that
// hunt along the road grid, foot officers who grab the player on the street,
// and the spray shop that paints a car clean. Stars decide how many units
// are out; out of every cop's sight for long enough and a star drops off.
import { CAR, POLICE, ROADS_H, ROADS_V, SPRAY, WANTED_MAX, WORLD } from './config.js';
import { nearestRoadPoint } from './city.js';

export function addWanted(state, n) {
  state.wanted = Math.min(WANTED_MAX, state.wanted + n);
  state.wantedTimer = 0;
}

export function clearWanted(state) {
  state.wanted = 0;
  state.wantedTimer = 0;
}

// A road point roughly `away` units from the player, for spawning a unit that
// arrives instead of appearing on top of the player.
function spawnPoint(state, away) {
  const a = state.rng.range(0, Math.PI * 2);
  const px = state.player.x + Math.cos(a) * away;
  const py = state.player.y + Math.sin(a) * away;
  const p = nearestRoadPoint(px, py);
  return { x: p.x, y: p.y, vertical: p.vertical };
}

function spawnCarCop(state) {
  const p = spawnPoint(state, 460);
  return {
    kind: 'police',
    x: p.x,
    y: p.y,
    vertical: p.vertical,
    road: p.vertical ? p.x : p.y,
    dir: state.rng.chance(0.5) ? 1 : -1,
    angle: 0,
    speed: POLICE.carSpeed * 0.8,
    targetSpeed: POLICE.carSpeed,
    durability: CAR.durability,
    hitCd: 0,
    width: CAR.width,
    length: CAR.length,
    color: '#20242e',
  };
}

function spawnOfficer(state) {
  const a = state.rng.range(0, Math.PI * 2);
  return {
    kind: 'officer',
    x: state.player.x + Math.cos(a) * 320,
    y: state.player.y + Math.sin(a) * 320,
    angle: 0,
    speed: POLICE.footSpeed,
  };
}

// At an intersection the cop picks the move — straight on, or onto the
// crossing road either way — that leaves it closest to the player.
function chooseCopTurn(cop, state) {
  const crossings = cop.vertical ? ROADS_H : ROADS_V;
  const along = cop.vertical ? cop.y : cop.x;
  let cross = null;
  for (let i = 0; i < crossings.length; i += 1) {
    if (Math.abs(along - crossings[i]) < 14) {
      cross = crossings[i];
      break;
    }
  }
  if (cross === null) return;
  const px = state.player.x;
  const py = state.player.y;
  const options = [];
  const ahead = 70;
  if (cop.vertical) {
    options.push({ vertical: true, road: cop.road, dir: cop.dir, x: cop.x, y: cop.y + cop.dir * ahead });
    options.push({ vertical: false, road: cross, dir: 1, x: cop.x + ahead, y: cross });
    options.push({ vertical: false, road: cross, dir: -1, x: cop.x - ahead, y: cross });
  } else {
    options.push({ vertical: false, road: cop.road, dir: cop.dir, x: cop.x + cop.dir * ahead, y: cop.y });
    options.push({ vertical: true, road: cross, dir: 1, x: cross, y: cop.y + ahead });
    options.push({ vertical: true, road: cross, dir: -1, x: cross, y: cop.y - ahead });
  }
  let best = options[0];
  let bestD = Infinity;
  for (let i = 0; i < options.length; i += 1) {
    const d = Math.hypot(options[i].x - px, options[i].y - py);
    if (d < bestD) {
      bestD = d;
      best = options[i];
    }
  }
  if (best.vertical !== cop.vertical || best.road !== cop.road) {
    cop.vertical = best.vertical;
    cop.road = best.road;
    cop.dir = best.dir;
    if (cop.vertical) cop.x = cop.road;
    else cop.y = cop.road;
  }
}

function stepCarCop(cop, state, dt) {
  chooseCopTurn(cop, state);
  cop.speed += (cop.targetSpeed - cop.speed) * Math.min(1, 1.5 * dt);
  if (cop.vertical) cop.y += cop.dir * cop.speed * dt;
  else cop.x += cop.dir * cop.speed * dt;
  cop.angle = cop.vertical ? (cop.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : cop.dir > 0 ? 0 : Math.PI;
  if (cop.vertical && (cop.y < 40 || cop.y > WORLD.height - 40)) cop.dir *= -1;
  if (!cop.vertical && (cop.x < 300 || cop.x > WORLD.width - 40)) cop.dir *= -1;
  if (cop.vertical) cop.x = cop.road;
  else cop.y = cop.road;
  if (cop.hitCd > 0) cop.hitCd -= dt;
  // Ramming the player's car: a hit costs durability and shoves the car.
  const p = state.player;
  if (!p.onFoot && p.car) {
    const d = Math.hypot(cop.x - p.car.x, cop.y - p.car.y);
    if (d < 48 && cop.hitCd <= 0) {
      cop.hitCd = POLICE.ramCooldown;
      p.car.durability -= POLICE.ramDamage;
      const push = Math.atan2(p.car.y - cop.y, p.car.x - cop.x);
      p.car.x += Math.cos(push) * 10;
      p.car.y += Math.sin(push) * 10;
      state.effects.push({ kind: 'debris', x: p.car.x, y: p.car.y, life: 0.8, max: 0.8, count: 5 });
    }
  }
}

function stepOfficer(off, state, dt) {
  const p = state.player;
  const dx = p.x - off.x;
  const dy = p.y - off.y;
  const d = Math.hypot(dx, dy) || 1;
  off.x += (dx / d) * off.speed * dt;
  off.y += (dy / d) * off.speed * dt;
  off.angle = Math.atan2(dy, dx);
}

// Drive into the spray shop's ring with a damaged car or a record and it is
// fixed and wiped, for the fee (or whatever cash is left).
function sprayShop(state) {
  const p = state.player;
  if (p.onFoot || !p.car) {
    state.sprayed = false;
    return;
  }
  const d = Math.hypot(p.car.x - SPRAY.x, p.car.y - SPRAY.y);
  if (d > SPRAY.r) {
    state.sprayed = false;
    return;
  }
  if (state.sprayed) return;
  if (p.car.durability >= CAR.durability && state.wanted === 0) return;
  const fee = Math.min(SPRAY.cost, p.cash);
  p.cash -= fee;
  p.car.durability = CAR.durability;
  clearWanted(state);
  state.sprayed = true;
  state.message = { text: `Spray shop: fresh paint, clean record. -$${fee}`, until: state.time + 2.5 };
}

// Returns 'busted' when the player is caught, else null.
export function updatePolice(state, dt) {
  const wantedCars = POLICE.byStars[state.wanted] || 0;
  const wantedFeet = state.player.onFoot ? POLICE.footByStars[state.wanted] || 0 : 0;
  let cars = 0;
  let feet = 0;
  for (let i = 0; i < state.cops.length; i += 1) {
    if (state.cops[i].kind === 'police') cars += 1;
    else feet += 1;
  }
  while (cars < wantedCars) {
    state.cops.push(spawnCarCop(state));
    cars += 1;
  }
  while (feet < wantedFeet) {
    state.cops.push(spawnOfficer(state));
    feet += 1;
  }
  if (state.wanted === 0) state.cops.length = 0;
  // Wanted decay: nobody close enough to see the player for a while.
  let nearest = Infinity;
  for (let i = 0; i < state.cops.length; i += 1) {
    const d = Math.hypot(state.cops[i].x - state.player.x, state.cops[i].y - state.player.y);
    if (d < nearest) nearest = d;
  }
  if (state.wanted > 0 && nearest > POLICE.sight) {
    state.wantedTimer += dt;
    if (state.wantedTimer >= POLICE.decaySeconds) {
      state.wanted -= 1;
      state.wantedTimer = 0;
    }
  } else {
    state.wantedTimer = 0;
  }
  for (let i = 0; i < state.cops.length; i += 1) {
    const cop = state.cops[i];
    if (cop.kind === 'police') stepCarCop(cop, state, dt);
    else stepOfficer(cop, state, dt);
  }
  // A foot officer close enough on foot makes the arrest.
  if (state.player.onFoot) {
    for (let i = 0; i < state.cops.length; i += 1) {
      const cop = state.cops[i];
      if (cop.kind !== 'officer') continue;
      if (Math.hypot(cop.x - state.player.x, cop.y - state.player.y) < POLICE.catchRadius) return 'busted';
    }
  }
  // A wrecked car with the player inside is also an arrest.
  if (!state.player.onFoot && state.player.car && state.player.car.durability <= 0) return 'busted';
  sprayShop(state);
  return null;
}

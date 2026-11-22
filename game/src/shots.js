// The screenshot scenes behind ?shot=cover|drive|mission|foot. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot through the same virtual keys a player uses, so the frame is what a short
// game really looks like and the same seed always gives the same frame.
//
// The autopilot stays on the road network: it swerves around traffic instead of
// barging through it, and if it ever leaves the road it steers back to the nearest
// road point. A scene that ends wrecked, busted or finished is re-staged once, shorter,
// so the frame always shows the game mid-chase, mid-drive, mid-job.
import { STEP } from './config.js';

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Steer the player's car toward a point: stay on the road, swerve around anything
// ahead instead of ramming it.
function driveToward(game, tx, ty, speedCap) {
  const car = game.player.car;
  if (!car) return;
  const cap = speedCap || 430;
  if (!game.city.onRoad(car.x, car.y)) {
    const p = game.city.nearestRoadPoint(car.x, car.y);
    tx = p.x;
    ty = p.y;
  }
  let desired = Math.atan2(ty - car.y, tx - car.x);
  // Swerve around anything ahead, and lift off the throttle while it is there —
  // barging through traffic at full speed is how chases end in a wreck.
  let blocked = false;
  const aheadOf = (other) => {
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const lateral = -dx * Math.sin(car.angle) + dy * Math.cos(car.angle);
    return ahead > 0 && ahead < 220 && Math.abs(lateral) < 42 ? lateral : null;
  };
  for (const other of game.traffic.allCars()) {
    if (other === car) continue;
    const lateral = aheadOf(other);
    if (lateral !== null) {
      desired += lateral > 0 ? -0.45 : 0.45;
      blocked = true;
      break;
    }
  }
  for (const cop of game.police.cars) {
    const lateral = aheadOf(cop);
    if (lateral !== null) {
      desired += lateral > 0 ? -0.45 : 0.45;
      blocked = true;
      break;
    }
  }
  const diff = wrapAngle(desired - car.angle);
  game.input.setVirtual({
    up: !blocked && Math.abs(car.speed) < cap,
    down: false,
    left: diff < -0.06,
    right: diff > 0.06,
    handbrake: Math.abs(diff) > 1.4,
    run: false,
  });
}

function putPlayerInCar(game, x, y, angle, speed, color) {
  const car = {
    x, y, angle, speed, color: color || '#c94f43', kind: 'player', health: 100,
  };
  const player = game.player;
  player.car = car;
  player.onFoot = false;
  player.x = x;
  player.y = y;
  player.angle = angle;
  return car;
}

function stepFor(game, seconds, steer) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (steer) steer();
    game.stepWorld(STEP);
  }
  game.input.clearVirtual();
}

// One staging attempt: fresh world, the scene's setup, fixed steps. Returns true
// when the end state is the one the screenshot needs.
function attempt(game, setup, seconds, steer, validate) {
  game.reset(game.seed);
  game.screen = 'play';
  setup(game);
  stepFor(game, seconds, steer);
  return validate(game);
}

export function stageShot(name, game) {
  if (name === 'cover') {
    // Job three: three stars, two cruisers, Rook running down the Strip.
    const run = (seconds) => attempt(game, (g) => {
      g.missions.startMain(2, g);
      putPlayerInCar(g, 500, 930, 0, 200, '#c94f43');
    }, seconds, () => driveToward(game, game.player.x + 400, 930, 300),
    (g) => g.missions.active && g.missions.active.def.key === 'm3' && g.police.wanted >= 2 && g.player.car && g.player.car.health > 40 && Math.abs(g.player.car.speed) > 150 && g.city.onRoad(g.player.car.x, g.player.car.y));
    if (!run(3.5)) run(2.5);
    return 'play';
  }
  if (name === 'drive') {
    // A fast run down the Strip, traffic and pedestrians everywhere.
    const run = (seconds) => attempt(game, (g) => {
      putPlayerInCar(g, 500, 930, 0, 280, '#4a7fb5');
    }, seconds, () => driveToward(game, game.player.x + 400, 930, 300),
    (g) => g.player.car && g.player.car.health > 40 && Math.abs(g.player.car.speed) > 150 && g.city.onRoad(g.player.car.x, g.player.car.y) && g.police.wanted === 0);
    if (!run(3)) run(2);
    return 'play';
  }
  if (name === 'mission') {
    // Job five, second half: the stolen gold car on its way to the Docks garage.
    const route = [
      { x: 2030, y: 1500 },
      { x: 1700, y: 1530 },
      { x: 1560, y: 1545 },
    ];
    const run = (seconds) => attempt(game, (g) => {
      g.missions.startMain(4, g);
      const gold = g.missions.active.data.gold;
      const parkedAt = g.traffic.parked.indexOf(gold);
      if (parkedAt >= 0) g.traffic.parked.splice(parkedAt, 1);
      gold.kind = 'player';
      gold.x = 2030;
      gold.y = 1200;
      gold.angle = Math.PI / 2;
      gold.speed = 150;
      const player = g.player;
      player.car = gold;
      player.onFoot = false;
      player.x = gold.x;
      player.y = gold.y;
      player.angle = gold.angle;
      g.missions.active.stage = 1;
      g.police.setWanted(g, 2);
    }, seconds, () => {
      const player = game.player;
      let leg = 0;
      for (let i = 0; i < route.length; i += 1) {
        if (Math.hypot(player.x - route[i].x, player.y - route[i].y) < 70) leg = i + 1;
        else break;
      }
      const target = route[Math.min(leg, route.length - 1)];
      driveToward(game, target.x, target.y);
    },
    (g) => g.missions.active && g.missions.active.def.key === 'm5' && g.missions.active.stage === 1 && g.player.car && g.player.car.health > 40 && g.city.onRoad(g.player.car.x, g.player.car.y));
    if (!run(4.5)) run(3.5);
    return 'play';
  }
  // foot: Rook on foot beside a parked car, the steal prompt showing.
  attempt(game, (g) => {
    g.traffic.addParked(566, 478, 0, '#7a7f8a');
    g.player.x = 520;
    g.player.y = 470;
    g.player.angle = 0;
  }, 0.5, null, (g) => g.player.nearCar !== null && g.prompt !== '');
  return 'play';
}

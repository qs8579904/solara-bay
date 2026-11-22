// Mara "Rook" Delgado on foot and behind the wheel: walking and running, stealing
// cars, arcade driving with a handbrake, and every crash that follows from it.
import { FOOT, CAR, WORLD_W, WORLD_H } from './config.js';
import { carImpact, wallImpact, hitPedestrian, tryPunch } from './combat.js';

export function createPlayer(city) {
  return {
    x: city.points.spawn.x,
    y: city.points.spawn.y,
    angle: -Math.PI / 2,
    onFoot: true,
    car: null,
    health: FOOT.health,
    punchTimer: 0,
    punchAnim: 0,
    hurtFlash: 0,
    nearCar: null,
    ramCooldown: 0,
  };
}

function moveWithCollision(city, x, y, dx, dy, r) {
  const nx = x + dx;
  if (!city.blocked(nx, y, r)) x = nx;
  const ny = y + dy;
  if (!city.blocked(x, ny, r)) y = ny;
  return { x, y };
}

function updateOnFoot(game, dt) {
  const player = game.player;
  const input = game.input;
  const city = game.city;
  player.punchTimer = Math.max(0, player.punchTimer - dt);
  player.punchAnim = Math.max(0, player.punchAnim - dt);
  player.hurtFlash = Math.max(0, player.hurtFlash - dt);

  const ax = input.axisX();
  const ay = input.axisY();
  const moving = ax !== 0 || ay !== 0;
  const speed = input.run() ? FOOT.runSpeed : FOOT.walkSpeed;
  if (moving) {
    const len = Math.hypot(ax, ay);
    const nx = (ax / len) * speed * dt;
    const ny = (ay / len) * speed * dt;
    const pos = moveWithCollision(city, player.x, player.y, nx, ny, FOOT.radius);
    player.x = pos.x;
    player.y = pos.y;
    player.angle = Math.atan2(ny, nx);
  }

  if (input.consume('punch')) tryPunch(game);

  // Cash on the sidewalk.
  for (const p of game.traffic.pickups) {
    if (p.active && Math.hypot(p.x - player.x, p.y - player.y) < 28) {
      p.active = false;
      p.respawn = 20;
      game.addCash(p.amount, p.x, p.y, 'Picked up $' + p.amount);
      game.audio.pickup();
    }
  }

  player.nearCar = game.traffic.nearestStealable(player.x, player.y, FOOT.stealRange);
  if (input.consume('steal') && player.nearCar) stealCar(game, player.nearCar);
}

function stealCar(game, car) {
  const player = game.player;
  if (car.noSteal) {
    game.addMessage("That car is locked down tight.");
    return;
  }
  if (car.kind === 'traffic') {
    // The driver bails out and runs; someone saw it happen.
    const i = game.traffic.cars.indexOf(car);
    if (i >= 0) game.traffic.cars.splice(i, 1);
    game.traffic.peds.push({
      x: car.x + 24, y: car.y + 24, angle: 0, speed: 60,
      tx: car.x + 200, ty: car.y + 200, color: '#e86a6a', state: 'flee', fleeTimer: 4, downTimer: 0, pause: 0,
    });
    game.police.addWanted(1);
    game.addMessage('Carjacked! The driver called it in.');
  } else if (car.kind === 'parked') {
    const i = game.traffic.parked.indexOf(car);
    if (i >= 0) game.traffic.parked.splice(i, 1);
  }
  if (car.isLuxury) {
    game.missions.onEvent('luxuryStolen', game);
    game.police.addWanted(2);
    game.addMessage('Alarm! The villa car is hot now.');
  }
  car.kind = 'player';
  player.car = car;
  player.onFoot = false;
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  game.audio.door();
}

function exitCar(game) {
  const player = game.player;
  const car = player.car;
  if (!car || Math.abs(car.speed) > 40) return;
  car.speed = 0;
  car.kind = 'parked';
  game.traffic.parked.push(car);
  player.car = null;
  player.onFoot = true;
  const side = Math.cos(player.angle + Math.PI / 2);
  const sideY = Math.sin(player.angle + Math.PI / 2);
  player.x = car.x + side * 26;
  player.y = car.y + sideY * 26;
  if (game.city.blocked(player.x, player.y, FOOT.radius)) {
    player.x = car.x - side * 26;
    player.y = car.y - sideY * 26;
  }
  player.angle = car.angle;
  game.audio.door();
}

function updateDriving(game, dt) {
  const player = game.player;
  const input = game.input;
  const city = game.city;
  const car = player.car;
  player.ramCooldown = Math.max(0, player.ramCooldown - dt);

  const up = input.isDown('up');
  const down = input.isDown('down');
  const steer = input.axisX();
  const handbrake = input.isDown('handbrake');

  if (up) car.speed += CAR.accel * dt;
  else if (down) {
    if (car.speed > 10) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.accel * 0.55 * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 140 * dt);
  }
  if (car.speed > CAR.maxSpeed) car.speed = CAR.maxSpeed;
  if (car.speed < -CAR.maxReverse) car.speed = -CAR.maxReverse;

  const speedFactor = Math.max(-1, Math.min(1, car.speed / 130));
  const turn = steer * (handbrake ? CAR.handbrakeTurn : CAR.turnRate) * speedFactor * dt;
  car.angle += turn;
  if (handbrake && Math.abs(car.speed) > 60) {
    car.speed -= Math.sign(car.speed) * CAR.handbrakeDrag * 60 * dt;
    game.addSkid(car.x, car.y, car.angle);
  }

  const stepX = Math.cos(car.angle) * car.speed * dt;
  const stepY = Math.sin(car.angle) * car.speed * dt;
  const frontX = car.x + Math.cos(car.angle) * 22 + stepX;
  const frontY = car.y + Math.sin(car.angle) * 22 + stepY;
  if (city.blocked(frontX, frontY, CAR.radius)) {
    // The nose is at the shoreline when the stop comes from the sea: the collision
    // circle touches the water a little before the nose point itself gets wet.
    const noseX = frontX + Math.cos(car.angle) * CAR.radius;
    const noseY = frontY + Math.sin(car.angle) * CAR.radius;
    const hitWater = city.inWater(noseX, noseY) || frontX < city.coastX(frontY) + 45;
    const dmg = wallImpact(car, car.speed);
    if (hitWater) {
      game.addSplash(frontX, frontY);
      game.addMessage('The sea stops the car — and bills it.');
    } else if (dmg > 2) {
      game.addDebris(frontX, frontY, 10);
      game.audio.crash(Math.min(1, dmg / 12));
      game.shake = Math.min(10, 3 + dmg);
    }
    if (Math.abs(car.speed) > 140) game.police.addHeat(0.2);
    car.speed *= -0.22;
  } else {
    car.x += stepX;
    car.y += stepY;
  }
  // The map edge is a wall too.
  car.x = Math.max(CAR.radius + 4, Math.min(WORLD_W - CAR.radius - 4, car.x));
  car.y = Math.max(CAR.radius + 4, Math.min(WORLD_H - CAR.radius - 4, car.y));

  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;

  // Collisions with the rest of the traffic.
  for (const other of game.traffic.allCars()) {
    if (other === car || other.kind === 'player') continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const d = Math.hypot(dx, dy);
    if (d < 34 && d > 0.01) {
      const closing = Math.abs(car.speed - (other.speed || 0));
      const push = (34 - d) / 2;
      const ux = dx / d;
      const uy = dy / d;
      car.x -= ux * push;
      car.y -= uy * push;
      if (other.kind !== 'parked') {
        other.x += ux * push;
        other.y += uy * push;
      }
      if (closing > 70 && player.ramCooldown <= 0) {
        carImpact(car, other, closing);
        player.ramCooldown = 0.6;
        game.audio.crash(Math.min(1, closing / 420));
        game.shake = Math.min(9, 2 + closing / 60);
        game.addDebris((car.x + other.x) / 2, (car.y + other.y) / 2, 8);
        if (other.kind === 'traffic') game.police.addHeat(0.4);
        game.missions.onEvent('ram', game, other);
      }
    }
  }
  // Police cars ram back.
  for (const cop of game.police.cars) {
    const dx = cop.x - car.x;
    const dy = cop.y - car.y;
    const d = Math.hypot(dx, dy);
    if (d < 36 && d > 0.01) {
      const closing = Math.abs(car.speed - cop.speed);
      const push = (36 - d) / 2;
      car.x -= (dx / d) * push;
      car.y -= (dy / d) * push;
      cop.x += (dx / d) * push;
      cop.y += (dy / d) * push;
      if (closing > 70 && player.ramCooldown <= 0) {
        carImpact(car, cop, closing);
        player.ramCooldown = 0.6;
        game.audio.crash(Math.min(1, closing / 420));
        game.shake = Math.min(9, 2 + closing / 60);
        game.addDebris((car.x + cop.x) / 2, (car.y + cop.y) / 2, 8);
        // Being rammed by the SBPD hurts the car, but it is their doing, not a
        // new crime — so it does not raise the wanted level.
      }
    }
  }
  // Pedestrians under the wheels.
  for (const ped of game.traffic.peds) {
    if (ped.state === 'down') continue;
    if (Math.hypot(ped.x - car.x, ped.y - car.y) < 26 && Math.abs(car.speed) > 50) {
      hitPedestrian(game, ped);
      car.speed *= 0.85;
    }
  }
  // Cash on the road.
  for (const p of game.traffic.pickups) {
    if (p.active && Math.hypot(p.x - car.x, p.y - car.y) < 30) {
      p.active = false;
      p.respawn = 20;
      game.addCash(p.amount, p.x, p.y, 'Picked up $' + p.amount);
      game.audio.pickup();
    }
  }

  if (car.health <= 0) {
    car.health = 0;
    game.onBusted('Your car was wrecked');
  }

  if (input.consume('steal')) exitCar(game);
}

export function updatePlayer(game, dt) {
  if (game.player.onFoot) updateOnFoot(game, dt);
  else updateDriving(game, dt);
}

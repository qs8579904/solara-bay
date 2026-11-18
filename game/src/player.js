// The player: Mara "Rook" Delgado, on foot or behind a wheel. On foot she
// walks and runs and can punch; in a car she drives arcade physics — accel,
// a reverse gear, a handbrake that trades grip for turn — and every crash
// costs the car durability. Stealing is the E key: a parked car is free, a
// car with a driver in it sets off the alarm and the driver's owner calls it
// in. Police cars and the Lobos target can never be stolen.
import { CAR, PLAYER, WANTED_MAX } from './config.js';
import { collideCircle } from './city.js';
import { nearestCar } from './traffic.js';
import { addWanted } from './police.js';

export function createPlayer(spawn, cash) {
  return {
    x: spawn.x,
    y: spawn.y,
    angle: -Math.PI / 2,
    speed: 0,
    onFoot: true,
    car: null,
    cash,
    punchCd: 0,
  };
}

function driveCar(state, input, dt) {
  const car = state.player.car;
  const throttle = -input.moveY();
  const steer = input.moveX();
  const brake = input.handbrake();
  if (throttle > 0) car.speed += CAR.accel * dt;
  else if (throttle < 0) {
    if (car.speed > 5) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.accel * 0.5 * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 150 * dt);
  }
  if (brake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), CAR.handbrakeDecel * dt);
  if (car.speed > CAR.maxSpeed) car.speed = CAR.maxSpeed;
  if (car.speed < -CAR.reverseMax) car.speed = -CAR.reverseMax;
  const grip = 0.35 + 0.65 * Math.min(1, Math.abs(car.speed) / 160);
  const turnRate = CAR.turn * (brake ? 1.6 : 1) * grip * Math.sign(car.speed || 1);
  car.angle += steer * turnRate * dt;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const fixed = collideCircle(state.city, nx, ny, 22);
  const pushX = fixed.x - nx;
  const pushY = fixed.y - ny;
  const pushLen = Math.hypot(pushX, pushY);
  car.wallCd = Math.max(0, (car.wallCd || 0) - dt);
  if (pushLen > 1) {
    // How fast the car is moving INTO the wall, not just how fast it is
    // going: sliding along a wall is free, a head-on hit is billed. One
    // crash is one crash — the cooldown stops a scrape from billing again
    // until the car has had half a second to get clear.
    const intoWall = -(Math.cos(car.angle) * car.speed * (pushX / pushLen) + Math.sin(car.angle) * car.speed * (pushY / pushLen));
    if (intoWall > 90 && car.wallCd <= 0) {
      car.durability -= intoWall * 0.03;
      car.wallCd = 0.5;
      state.effects.push({ kind: 'debris', x: fixed.x, y: fixed.y, life: 0.8, max: 0.8, count: 6 });
    }
    if (intoWall > 0) car.speed *= -0.25;
  }
  car.x = fixed.x;
  car.y = fixed.y;
  if (brake && Math.abs(car.speed) > 130) {
    const bx = car.x - Math.cos(car.angle) * 20;
    const by = car.y - Math.sin(car.angle) * 20;
    state.effects.push({ kind: 'skid', x: bx, y: by, angle: car.angle, life: 4, max: 4 });
    if (state.effects.length > 220) state.effects.splice(0, state.effects.length - 220);
  }
  state.player.x = car.x;
  state.player.y = car.y;
  state.player.angle = car.angle;
  state.player.speed = car.speed;
}

function walkPlayer(state, input, dt) {
  const p = state.player;
  const ix = input.moveX();
  const iy = input.moveY();
  const mag = Math.hypot(ix, iy);
  if (mag > 0) {
    const speed = input.run() ? PLAYER.run : PLAYER.walk;
    const nx = p.x + (ix / mag) * speed * dt;
    const ny = p.y + (iy / mag) * speed * dt;
    const fixed = collideCircle(state.city, nx, ny, PLAYER.radius);
    p.x = fixed.x;
    p.y = fixed.y;
    p.angle = Math.atan2(iy, ix);
    p.speed = speed;
  } else {
    p.speed = 0;
  }
  if (p.punchCd > 0) p.punchCd -= dt;
}

export function updatePlayer(state, input, dt) {
  if (state.player.onFoot) walkPlayer(state, input, dt);
  else driveCar(state, input, dt);
}

// E next to a car: climb in. A parked car is free; a car with a driver in it
// costs a wanted star — the owner reports it before they run. A noisy steal
// sets the HUD message itself; a quiet one needs none, the player is visibly
// in the car. Returns the car, or null when there is nothing to steal.
export function trySteal(state) {
  const p = state.player;
  if (!p.onFoot) return null;
  const car = nearestCar(state, p.x, p.y, 74, null);
  if (!car || car.kind === 'police' || car.kind === 'lobos' || car.kind === 'player') return null;
  if (car.kind === 'civil' && car.driver) {
    car.driver = false;
    car.speed = 0;
    addWanted(state, 1);
    state.message = { text: 'Car stolen — the owner called it in!', until: state.time + 2.5 };
  } else if (car.kind === 'parked' && car.owned) {
    addWanted(state, 1);
    state.message = { text: 'Alarm! That car had an owner.', until: state.time + 2.5 };
  }
  car.kind = 'player';
  car.parked = false;
  p.car = car;
  p.onFoot = false;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  return car;
}

// E while driving: step out beside the car; it stays where it is, parked.
export function exitCar(state) {
  const p = state.player;
  if (p.onFoot || !p.car) return;
  const car = p.car;
  car.kind = 'parked';
  car.parked = true;
  car.owned = true;
  car.driver = false;
  car.speed = 0;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  const fixed = collideCircle(state.city, p.x, p.y, PLAYER.radius);
  p.x = fixed.x;
  p.y = fixed.y;
  p.car = null;
  p.onFoot = true;
  p.speed = 0;
}

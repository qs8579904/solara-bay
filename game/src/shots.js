// The screenshot scenes behind ?shot=cover|drive|mission|foot. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by an autopilot that follows the road grid toward its target, so
// the frame is what a short game really looks like and the same seed always
// gives the same frame. The foot scene stands still and lets the traffic
// and the pedestrians move.
import { MISSION0, ROADS_H, ROADS_V, STEP } from './config.js';
import { resetGame, stepWorld } from './state.js';
import { SCREEN_PLAY } from './render.js';
import { nearestCar } from './traffic.js';

// The autopilot: a road-following driver. It plans a route on the road grid
// — first onto the nearest road (a short hop, never a detour to an
// intersection behind the car), then along that road to the target's column
// or row, then along the column or row to the target — and steers toward the
// current waypoint, coasting into sharp turns so it can actually make them.
// Exported so the headless smoke test can drive the same way a player would.
export function createAutopilot(state, target) {
  const p = state.player;
  const nearest = (list, value) => list.reduce((best, road) => (Math.abs(road - value) < Math.abs(best - value) ? road : best));
  const nearV = nearest(ROADS_V, p.x);
  const nearH = nearest(ROADS_H, p.y);
  const targetV = nearest(ROADS_V, target.x);
  const targetH = nearest(ROADS_H, target.y);
  let waypoints;
  if (Math.abs(p.y - nearH) <= Math.abs(p.x - nearV)) {
    // Nearest road is horizontal: get onto it, drive along it to the
    // target's column, then up or down that column to the target's row.
    waypoints = [
      { x: p.x, y: nearH },
      { x: targetV, y: nearH },
      { x: targetV, y: targetH },
      { x: target.x, y: target.y },
    ];
  } else {
    // Nearest road is vertical: the mirror image of the route above.
    waypoints = [
      { x: nearV, y: p.y },
      { x: nearV, y: targetH },
      { x: targetV, y: targetH },
      { x: target.x, y: target.y },
    ];
  }
  let wp = 0;
  // Turning around: a car cannot U-turn on a two-lane road without leaving
  // it, so when the nose is far from the target the autopilot reverses and
  // steers the other way until the nose has swung round. The hysteresis
  // (enter at 2.4 rad, leave at 1.8) stops it flip-flopping between gears.
  let reversing = false;

  function steerAngle() {
    const player = state.player;
    while (wp < waypoints.length - 1) {
      const w = waypoints[wp];
      if (Math.hypot(w.x - player.x, w.y - player.y) < 50) wp += 1;
      else break;
    }
    const w = waypoints[Math.min(wp, waypoints.length - 1)];
    const want = Math.atan2(w.y - player.y, w.x - player.x);
    let diff = want - player.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
  }

  return {
    moveX() {
      const diff = steerAngle();
      if (Math.abs(diff) > 2.4) reversing = true;
      else if (Math.abs(diff) < 1.8) reversing = false;
      // While reversing, the same steering input swings the nose the other
      // way, so the sign flips.
      if (reversing) return diff > 0 ? -1 : 1;
      if (Math.abs(diff) < 0.06) return 0;
      return diff > 0 ? 1 : -1;
    },
    moveY() {
      const diff = steerAngle();
      if (Math.abs(diff) > 2.4) reversing = true;
      else if (Math.abs(diff) < 1.8) reversing = false;
      if (reversing) return 1;
      // Coast into a sharp turn: a slower car turns tighter and makes the corner.
      return Math.abs(diff) > 0.9 ? 0 : -1;
    },
    run() {
      return false;
    },
    handbrake() {
      return false;
    },
    punch() {
      return false;
    },
    takeActions() {
      return 0;
    },
  };
}

const idleInput = {
  moveX() {
    return 0;
  },
  moveY() {
    return 0;
  },
  run() {
    return false;
  },
  handbrake() {
    return false;
  },
  punch() {
    return false;
  },
  takeActions() {
    return 0;
  },
};

// Climb into the nearest parked car, for the driving scenes.
function putPlayerInCar(state) {
  const p = state.player;
  const car = nearestCar(state, p.x, p.y, 900, 'parked');
  if (!car) return false;
  car.kind = 'player';
  car.parked = false;
  car.driver = false;
  p.car = car;
  p.onFoot = false;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  return true;
}

function driveLoop(state, seconds, target) {
  const input = createAutopilot(state, target);
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) stepWorld(state, input, STEP);
}

// Set `state` to the named scene and return the screen to draw over it.
export function stageShot(name, state, seed) {
  resetGame(state, seed);
  if (name === 'cover') {
    // A police chase: wanted 3, cop cars already hunting, player driving
    // east along the Strip.
    putPlayerInCar(state);
    state.wanted = 3;
    driveLoop(state, 10, { x: 1750, y: 1000 });
    // The drive may have earned or lost a star on the way; the cover frame
    // shows three, with three police cars to match.
    state.wanted = 3;
    const police = state.cops.filter((c) => c.kind === 'police');
    while (police.length > 3) state.cops.splice(state.cops.indexOf(police.pop()), 1);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'drive') {
    // A clean cruise east along the Strip, then south to the Docks.
    putPlayerInCar(state);
    driveLoop(state, 10, { x: 2100, y: 1350 });
    // A clean cruise: any star the drive earned is cleared for the frame.
    state.wanted = 0;
    state.cops.length = 0;
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    // Mid-delivery: three seconds in, the car is on the Marina road with
    // the drop-off just ahead and the clock running.
    putPlayerInCar(state);
    state.mission.phase = 'active';
    state.mission.timer = MISSION0.time;
    driveLoop(state, 3, MISSION0.target);
    return { screen: SCREEN_PLAY };
  }
  // 'foot': on foot beside a parked car, with the steal hint showing.
  const car = nearestCar(state, state.player.x, state.player.y, 900, 'parked');
  if (car) {
    state.player.x = car.x + 46;
    state.player.y = car.y;
    state.player.angle = Math.atan2(car.y - state.player.y, car.x - state.player.x);
  }
  const steps = Math.round(3 / STEP);
  for (let i = 0; i < steps; i += 1) stepWorld(state, idleInput, STEP);
  return { screen: SCREEN_PLAY };
}

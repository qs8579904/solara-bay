// The world state: everything the game is, in one object, plus the two
// functions that own it — createGame builds a fresh world from a seed, and
// stepWorld advances it one fixed step. The main loop and the screenshot
// scenes both drive the world through stepWorld, so a staged scene and a
// played game run the exact same rules.
import { PICKUPS, SPAWN } from './config.js';
import { createRandom } from './random.js';
import { buildCity, randomSidewalkPoint } from './city.js';
import { createTraffic } from './traffic.js';
import { createPlayer } from './player.js';
import { createMissions, startJob, updateMissions } from './missions.js';
import { updateTraffic } from './traffic.js';
import { updatePlayer } from './player.js';
import { playerCarHits } from './combat.js';
import { updatePolice } from './police.js';

export function createGame(seed) {
  const rng = createRandom(seed);
  const city = buildCity(rng);
  const state = {
    seed,
    rng,
    city,
    time: 0,
    player: createPlayer(SPAWN, 0),
    cars: [],
    peds: [],
    cops: [],
    wanted: 0,
    wantedTimer: 0,
    mission: createMissions(),
    pickups: [],
    pickupTimer: PICKUPS.respawn,
    effects: [],
    message: null,
    sprayed: false,
    bustedFine: 0,
    stats: { earned: 0, bestCash: 0 },
  };
  const traffic = createTraffic(city, rng, SPAWN);
  state.cars = traffic.cars;
  state.peds = traffic.peds;
  for (let i = 0; i < PICKUPS.max; i += 1) {
    const p = randomSidewalkPoint(rng);
    state.pickups.push({ x: p.x, y: p.y, amount: PICKUPS.amounts[i % PICKUPS.amounts.length], taken: false });
  }
  startJob(state);
  return state;
}

// Replace a world's contents with a fresh one of the same seed, keeping the
// object identity so renderers and loops holding the state keep working.
export function resetGame(state, seed) {
  const fresh = createGame(seed);
  for (const key of Object.keys(fresh)) state[key] = fresh[key];
}

// One fixed step of the whole simulation. Returns 'busted' when the player
// is arrested, 'fail' when the current job runs out of time, 'complete'
// when a job pays out, else null.
export function stepWorld(state, input, dt) {
  state.time += dt;
  updatePlayer(state, input, dt);
  updateTraffic(state, dt);
  playerCarHits(state);
  if (updatePolice(state, dt) === 'busted') return 'busted';
  const missionEvent = updateMissions(state, dt);
  if (missionEvent === 'fail') return 'fail';
  if (state.player.onFoot) {
    for (let i = 0; i < state.pickups.length; i += 1) {
      const pk = state.pickups[i];
      if (!pk.taken && Math.hypot(pk.x - state.player.x, pk.y - state.player.y) < 26) {
        pk.taken = true;
        state.player.cash += pk.amount;
      }
    }
  }
  state.pickupTimer -= dt;
  if (state.pickupTimer <= 0) {
    state.pickupTimer = PICKUPS.respawn;
    for (let i = 0; i < state.pickups.length; i += 1) {
      if (state.pickups[i].taken) {
        const p = randomSidewalkPoint(state.rng);
        state.pickups[i].x = p.x;
        state.pickups[i].y = p.y;
        state.pickups[i].taken = false;
        break;
      }
    }
  }
  for (let i = state.effects.length - 1; i >= 0; i -= 1) {
    state.effects[i].life -= dt;
    if (state.effects[i].life <= 0) state.effects.splice(i, 1);
  }
  if (state.player.cash > state.stats.bestCash) state.stats.bestCash = state.player.cash;
  return missionEvent;
}

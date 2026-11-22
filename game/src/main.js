// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps, and the renderer paints what is there. Screens: title, play, paused, briefing,
// busted, job failed, job done and the finale. Saves live in localStorage under the
// Solara Bay key; a v1 save loads with its cash and jobs intact, new fields defaulted.
//
// ?seed=N fixes the world. ?shot=cover|drive|mission|foot (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady.
import { STEP, SAVE_KEY, MONEY, PRICES, CAR } from './config.js';
import { createRandom } from './random.js';
import { buildCity } from './city.js';
import { createTraffic } from './traffic.js';
import { createPlayer, updatePlayer } from './player.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createAudio } from './audio.js';
import {
  createRenderer,
  SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_BRIEFING,
  SCREEN_BUSTED, SCREEN_FAILED, SCREEN_COMPLETE, SCREEN_FINALE,
} from './render.js';
import { createInput } from './input.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');

function readSave() {
  const fallback = { cash: MONEY.startCash, unlocked: 0, completed: [], best: 0, muted: false };
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw);
    return {
      cash: typeof saved.cash === 'number' ? saved.cash : fallback.cash,
      unlocked: typeof saved.unlocked === 'number' ? saved.unlocked : 0,
      completed: Array.isArray(saved.completed) ? saved.completed : [],
      best: typeof saved.best === 'number' ? saved.best : 0,
      muted: saved.muted === true,
    };
  } catch {
    return fallback;
  }
}

function createGame() {
  const saved = readSave();
  const game = {
    seed,
    rng: null, city: null, traffic: null, player: null, police: null, missions: null,
    audio: createAudio(),
    input: createInput(canvas),
    renderer: createRenderer(canvas),
    particles: [],
    messages: [],
    time: 0,
    shake: 0,
    cash: saved.cash,
    best: Math.max(saved.best, saved.cash),
    screen: SCREEN_TITLE,
    briefing: null,
    pendingJob: null,
    result: { reason: '', fine: 0, title: '', reward: 0 },
    prompt: '',
  };
  game.audio.setMuted(saved.muted);

  game.reset = function resetWorld(nextSeed) {
    game.rng = createRandom(nextSeed);
    game.city = buildCity(game.rng);
    game.traffic = createTraffic(game.rng, game.city);
    game.player = createPlayer(game.city);
    game.police = createPolice(game.city, game.rng);
    game.police._game = game;
    game.missions = createMissions();
    game.missions.unlocked = 0;
    game.missions.completed = [];
    // A staged world always starts from a clean slate — cash, jobs and progress
    // from an earlier scene in the same session never leak into the next shot.
    // Real play never calls reset, so the saved game is untouched.
    game.cash = MONEY.startCash;
    game.particles = [];
    game.messages = [];
    game.time = 0;
    game.shake = 0;
  };

  game.save = function saveGame() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: Math.floor(game.cash),
        unlocked: game.missions.unlocked,
        completed: game.missions.completed,
        best: Math.floor(game.best),
        muted: game.audio.isMuted(),
      }));
    } catch {
      // Storage can be off: the session still plays, it just does not persist.
    }
  };

  game.addMessage = function addMessage(text) {
    game.messages.push({ text, ttl: 4 });
    if (game.messages.length > 4) game.messages.shift();
  };

  game.addCash = function addCash(amount, x, y, text) {
    game.cash += amount;
    if (game.cash > game.best) game.best = game.cash;
    if (text) game.addMessage(text);
    game.save();
  };

  game.addSkid = function addSkid(x, y, angle) {
    game.particles.push({ kind: 'skid', x, y, angle, life: 1.4, maxLife: 1.4, vx: 0, vy: 0, size: 4, color: '' });
  };
  game.addDebris = function addDebris(x, y, count) {
    for (let i = 0; i < count; i += 1) {
      const a = game.rng.range(0, Math.PI * 2);
      const sp = game.rng.range(40, 190);
      game.particles.push({
        kind: 'debris', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.7, maxLife: 0.7, size: game.rng.range(3, 6),
        color: game.rng.pick(['#888888', '#c96f4a', '#d8c25a']),
      });
    }
  };
  game.addSplash = function addSplash(x, y) {
    for (let i = 0; i < 14; i += 1) {
      const a = game.rng.range(-Math.PI, 0);
      const sp = game.rng.range(60, 220);
      game.particles.push({
        kind: 'splash', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.6, maxLife: 0.6, size: game.rng.range(2, 5), color: '#b4e6ff',
      });
    }
  };

  game.onBusted = function onBusted(reason) {
    if (game.screen === SCREEN_BUSTED) return;
    const fine = Math.min(game.cash, Math.max(50, Math.floor(game.cash * PRICES.arrestFineRate)));
    game.cash -= fine;
    game.result = { reason, fine, title: '', reward: 0 };
    if (game.missions.active) {
      game.missions.active = null;
      game.addMessage('The job is blown — see Vince at the bar.');
    }
    game.police.setWanted(game, 0);
    game.screen = SCREEN_BUSTED;
    game.audio.fail();
    game.save();
  };

  game.onMissionComplete = function onMissionComplete(def) {
    game.cash += def.reward;
    if (game.cash > game.best) game.best = game.cash;
    game.result = { reason: '', fine: 0, title: def.name + ' complete!', reward: def.reward };
    game.screen = def.key === 'm6' ? SCREEN_FINALE : SCREEN_COMPLETE;
    game.audio.success();
    game.save();
  };

  game.onMissionFailed = function onMissionFailed(def, reason) {
    game.result = { reason, fine: 0, title: '', reward: 0 };
    game.pendingJob = def.key.startsWith('m') && game.missions.unlocked < 6
      ? { type: 'main', index: game.missions.MAIN_DEFS.findIndex((d) => d.key === def.key) }
      : null;
    game.screen = SCREEN_FAILED;
    game.audio.fail();
    game.save();
  };

  game.computePrompt = function computePrompt() {
    const player = game.player;
    if (game.screen !== SCREEN_PLAY) {
      game.prompt = '';
      return;
    }
    if (player.onFoot && player.nearCar) {
      game.prompt = player.nearCar.kind === 'traffic'
        ? 'Press E to carjack — the driver will call it in'
        : 'Press E to steal this car';
      return;
    }
    const mainIndex = game.missions.canStartMain(game);
    if (mainIndex !== null) {
      const def = game.missions.MAIN_DEFS[mainIndex];
      game.prompt = 'Press T: next job — ' + def.name + ' ($' + def.reward + ')';
      return;
    }
    const side = game.missions.nearSide(game);
    if (side) {
      const def = game.missions.findDef(side);
      game.prompt = 'Press T: ' + def.name + ' ($' + def.reward + ')';
      return;
    }
    if (!player.onFoot && Math.hypot(player.car.x - game.city.points.spray.x, player.car.y - game.city.points.spray.y) < 78) {
      game.prompt = 'Pay & Spray — sit in the bay to wash the heat ($50)';
      return;
    }
    game.prompt = '';
  };

  game.stepWorld = function stepWorld(dt) {
    game.time += dt;
    updatePlayer(game, dt);
    game.traffic.update(game, dt);
    game.police.update(game, dt);
    game.missions.update(game, dt);
    // Particles.
    for (let i = game.particles.length - 1; i >= 0; i -= 1) {
      const p = game.particles[i];
      p.life -= dt;
      p.x += (p.vx || 0) * dt;
      p.y += (p.vy || 0) * dt;
      if (p.kind !== 'skid') p.vy += 260 * dt;
      if (p.life <= 0) game.particles.splice(i, 1);
    }
    if (game.particles.length > 400) game.particles.splice(0, game.particles.length - 400);
    for (let i = game.messages.length - 1; i >= 0; i -= 1) {
      game.messages[i].ttl -= dt;
      if (game.messages[i].ttl <= 0) game.messages.splice(i, 1);
    }
    game.shake = Math.max(0, game.shake - dt * 26);
    if (game.player.onFoot && game.player.health < 100) {
      game.player.health = Math.min(100, game.player.health + 2 * dt);
    }
    const speedNorm = game.player.car ? Math.abs(game.player.car.speed) / CAR.maxSpeed : 0;
    game.audio.update(dt, speedNorm, !game.player.onFoot);
    game.computePrompt();
  };

  game.stepAttract = function stepAttract(dt) {
    game.time += dt;
    game.traffic.update(game, dt);
    for (let i = game.messages.length - 1; i >= 0; i -= 1) {
      game.messages[i].ttl -= dt;
      if (game.messages[i].ttl <= 0) game.messages.splice(i, 1);
    }
  };

  game.reset(seed);
  return game;
}

const game = createGame();
// Debug handle for automated playtests: read state, never drive the game.
window.__solara = game;

function announce(message) {
  status.textContent = message;
}

function runShot(name) {
  const screen = stageShot(name, game);
  game.screen = screen;
  let painted = 0;
  function paint() {
    game.renderer.draw(game);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let accumulator = 0;
  let last = performance.now();

  function startPlaying() {
    game.screen = SCREEN_PLAY;
    game.audio.unlock();
    game.audio.setMusic(true);
    announce('Playing. Visit Kroll\'s Bar for work.');
  }

  function openBriefing(job) {
    const def = job.type === 'main'
      ? game.missions.MAIN_DEFS[job.index]
      : game.missions.findDef(job.key);
    game.pendingJob = job;
    game.briefing = { def };
    game.screen = SCREEN_BRIEFING;
    game.input.clearEdges();
  }

  function beginPendingJob() {
    const job = game.pendingJob;
    game.pendingJob = null;
    game.briefing = null;
    if (!job) {
      game.screen = SCREEN_PLAY;
      return;
    }
    if (job.type === 'main') game.missions.startMain(job.index, game);
    else game.missions.startSide(job.key, game);
    game.screen = SCREEN_PLAY;
  }

  function respawnAfterBusted() {
    const station = game.city.points.policeStation;
    game.player.x = station.x;
    game.player.y = station.y + 90;
    game.player.angle = Math.PI / 2;
    game.player.onFoot = true;
    game.player.car = null;
    game.player.health = 100;
    game.police.cars.length = 0;
    game.police.cops.length = 0;
    game.screen = SCREEN_PLAY;
    announce('Out of the station. Back to work.');
  }

  function handleActions() {
    const input = game.input;
    if (input.consume('mute')) {
      game.audio.setMuted(!game.audio.isMuted());
      game.addMessage(game.audio.isMuted() ? 'Sound off' : 'Sound on');
      game.save();
    }
    if (game.screen === SCREEN_TITLE) {
      if (input.consume('confirm')) startPlaying();
      return;
    }
    if (game.screen === SCREEN_PLAY) {
      if (input.consume('pause')) {
        game.screen = SCREEN_PAUSED;
        announce('Paused.');
        return;
      }
      if (input.consume('side')) {
        const mainIndex = game.missions.canStartMain(game);
        if (mainIndex !== null) openBriefing({ type: 'main', index: mainIndex });
        else {
          const side = game.missions.nearSide(game);
          if (side) openBriefing({ type: 'side', key: side });
        }
      }
      return;
    }
    if (game.screen === SCREEN_PAUSED) {
      if (input.consume('pause') || input.consume('confirm')) {
        game.screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (game.screen === SCREEN_BRIEFING) {
      if (input.anyPressed()) beginPendingJob();
      return;
    }
    if (game.screen === SCREEN_BUSTED) {
      if (input.consume('confirm')) respawnAfterBusted();
      return;
    }
    if (game.screen === SCREEN_FAILED) {
      if (input.consume('confirm')) {
        if (game.pendingJob) openBriefing(game.pendingJob);
        else game.screen = SCREEN_PLAY;
      }
      return;
    }
    if (game.screen === SCREEN_COMPLETE || game.screen === SCREEN_FINALE) {
      if (input.consume('confirm')) game.screen = SCREEN_PLAY;
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (game.screen === SCREEN_TITLE) {
      while (accumulator >= STEP) {
        game.stepAttract(STEP);
        accumulator -= STEP;
      }
    } else if (game.screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        game.stepWorld(STEP);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    game.renderer.draw(game);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.screen === SCREEN_PLAY) {
      game.screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solara Bay. Press Enter to play.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

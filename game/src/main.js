// Solara Bay boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps (several in a slow frame, none in a fast
// one), and the renderer paints what is there. The game moves between five
// screens: title, play, paused, busted and job failed. Behind the title the
// city stays alive in attract mode — traffic driving, pedestrians walking —
// but the job clock does not run until the player starts.
//
// ?seed=N fixes the city. ?shot=cover|drive|mission|foot (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { SAVE_KEY, STATION, STEP } from './config.js';
import { createGame, resetGame, stepWorld } from './state.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_STEAL } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_FAILED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';
import { tryPunch } from './combat.js';
import { exitCar, trySteal } from './player.js';
import { retryMission, startJob } from './missions.js';
import { updateTraffic } from './traffic.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const state = createGame(seed);
const renderer = createRenderer(canvas);

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: state.player.cash,
      missionIndex: state.mission.index,
      best: state.stats.bestCash,
    }));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

// A saved game resumes with its cash and its job, not from the beginning.
function applySave(save) {
  if (!save) return;
  state.player.cash = save.cash || 0;
  state.stats.bestCash = save.best || 0;
  if (save.missionIndex === 1) {
    state.mission.index = 1;
    startJob(state);
  } else if (save.missionIndex >= 2) {
    state.mission.index = 2;
    state.mission.done = true;
  }
}

function runShot(name) {
  const scene = stageShot(name, state, seed);
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen, state.stats.bestCash);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

// An input that does nothing: the attract mode behind the title screen.
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

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  applySave(readSave());
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    // A fresh run keeps the saved cash and job; the world itself resets.
    const cash = state.player.cash;
    const missionIndex = state.mission.index;
    const best = state.stats.bestCash;
    resetGame(state, seed);
    state.player.cash = cash;
    state.stats.bestCash = best;
    if (missionIndex === 1) {
      state.mission.index = 1;
      startJob(state);
    } else if (missionIndex >= 2) {
      state.mission.index = 2;
      state.mission.done = true;
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Solara Bay is yours.');
  }

  function doBusted() {
    const fine = Math.max(100, Math.floor(state.player.cash * 0.2));
    state.bustedFine = fine;
    state.player.cash = Math.max(0, state.player.cash - fine);
    screen = SCREEN_BUSTED;
    writeSave();
    announce(`Busted. The SBPD took $${fine}.`);
  }

  function wakeUp() {
    // Wake up at the station door, on foot, record clean, job kept.
    const cash = state.player.cash;
    const missionIndex = state.mission.index;
    const best = state.stats.bestCash;
    resetGame(state, seed);
    state.player.cash = cash;
    state.stats.bestCash = best;
    state.player.x = STATION.x;
    state.player.y = STATION.y;
    if (missionIndex === 1) {
      state.mission.index = 1;
      startJob(state);
    } else if (missionIndex >= 2) {
      state.mission.index = 2;
      state.mission.done = true;
    }
    screen = SCREEN_PLAY;
    announce('Back on the street.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE) startGame();
      else if (screen === SCREEN_BUSTED) wakeUp();
      else if (screen === SCREEN_FAILED) {
        retryMission(state);
        screen = SCREEN_PLAY;
        announce('Job restarted.');
      }
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (actions & ACTION_STEAL && screen === SCREEN_PLAY) {
      if (state.player.onFoot) trySteal(state);
      else exitCar(state);
    }
  }

  function step() {
    if (input.punch()) tryPunch(state);
    const event = stepWorld(state, input, STEP);
    if (event === 'busted') doBusted();
    else if (event === 'fail') {
      screen = SCREEN_FAILED;
      announce('Job failed.');
    } else if (event === 'complete') {
      writeSave();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_TITLE) {
      // Attract mode: the city moves, the job clock does not.
      while (accumulator >= STEP) {
        state.time += STEP;
        updateTraffic(state, STEP);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(state, screen, state.stats.bestCash);
  }

  // Leaving the tab pauses a running game rather than letting the city move unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solara Bay. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

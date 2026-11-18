// The job list: six jobs to pay off a debt, of which this round ships the
// first two. Each job has a briefing, a HUD objective, a target on the map
// and a cash reward. A job is briefing, then active, then done or failed;
// failing one sends the player back to its briefing to try again.
import { MISSION0, MISSION1 } from './config.js';

const MISSIONS = [
  {
    name: 'First Delivery',
    briefing: "Vince wants a package in the Marina. Don't keep him waiting.",
    objective: 'Deliver the package to the Marina',
    reward: MISSION0.reward,
  },
  {
    name: 'Lobos Tail',
    briefing: 'A Lobos sedan is running the Strip. Ram it until it stops.',
    objective: 'Ram the Lobos car until it stops',
    reward: MISSION1.reward,
  },
];

export function createMissions() {
  return { index: 0, phase: 'briefing', timer: 0, briefUntil: 0, lobos: null, lobosHitCd: 0, done: false };
}

export function missionName(state) {
  if (state.mission.index >= MISSIONS.length) return null;
  return MISSIONS[state.mission.index].name;
}

export function missionText(state) {
  const m = state.mission;
  if (m.index >= MISSIONS.length) return 'All jobs done — Solara Bay is yours.';
  if (m.phase === 'briefing') return `${MISSIONS[m.index].name}: ${MISSIONS[m.index].briefing}`;
  if (m.phase === 'failed') return `${MISSIONS[m.index].name}: failed — press Enter to retry.`;
  return `${MISSIONS[m.index].name}: ${MISSIONS[m.index].objective}`;
}

// The map marker for the current job, or null when the job has no fixed point.
export function missionTarget(state) {
  const m = state.mission;
  if (m.index === 0 && m.phase === 'active') return { x: MISSION0.target.x, y: MISSION0.target.y };
  if (m.index === 1 && m.phase === 'active' && m.lobos) return { x: m.lobos.x, y: m.lobos.y };
  return null;
}

function startJob(state) {
  const m = state.mission;
  m.phase = 'briefing';
  m.briefUntil = state.time + 3;
  m.timer = 0;
  if (m.index === 1 && !m.lobos) {
    const loop = MISSION1.loop;
    state.cars.push({
      kind: 'lobos',
      x: loop[0].x,
      y: loop[0].y,
      angle: 0,
      speed: 0,
      targetSpeed: MISSION1.loopSpeed,
      color: '#181818',
      durability: MISSION1.targetHealth,
      driver: true,
      parked: false,
      loopIndex: 1,
      width: 46,
      length: 22,
    });
    m.lobos = state.cars[state.cars.length - 1];
  }
}

// The Lobos sedan runs its loop around the Strip, one waypoint at a time.
function stepLobos(state, dt) {
  const lobos = state.mission.lobos;
  if (!lobos || lobos.durability <= 0) return;
  const wp = MISSION1.loop[lobos.loopIndex % MISSION1.loop.length];
  const dx = wp.x - lobos.x;
  const dy = wp.y - lobos.y;
  const d = Math.hypot(dx, dy);
  if (d < 30) {
    lobos.loopIndex += 1;
    return;
  }
  lobos.angle = Math.atan2(dy, dx);
  lobos.speed = MISSION1.loopSpeed;
  lobos.x += (dx / d) * lobos.speed * dt;
  lobos.y += (dy / d) * lobos.speed * dt;
}

// Returns 'complete' when a job pays out, 'fail' when one runs out of time.
export function updateMissions(state, dt) {
  const m = state.mission;
  if (m.index >= MISSIONS.length) return null;
  if (m.phase === 'briefing') {
    if (state.time >= m.briefUntil) {
      m.phase = 'active';
      if (m.index === 0) m.timer = MISSION0.time;
    }
    return null;
  }
  if (m.phase === 'done') {
    if (state.time >= m.briefUntil) {
      m.index += 1;
      if (m.index >= MISSIONS.length) {
        m.done = true;
        return null;
      }
      startJob(state);
    }
    return null;
  }
  if (m.phase !== 'active') return null;
  if (m.index === 0) {
    m.timer -= dt;
    if (m.timer <= 0) {
      m.phase = 'failed';
      return 'fail';
    }
    const d = Math.hypot(state.player.x - MISSION0.target.x, state.player.y - MISSION0.target.y);
    if (d < MISSION0.radius) {
      state.player.cash += MISSION0.reward;
      state.message = { text: `Delivered! +$${MISSION0.reward}`, until: state.time + 2.5 };
      m.phase = 'done';
      m.briefUntil = state.time + 2;
      return 'complete';
    }
    return null;
  }
  // Mission 1: ram the Lobos car until it stops.
  stepLobos(state, dt);
  const lobos = m.lobos;
  if (!lobos) return null;
  if (m.lobosHitCd > 0) m.lobosHitCd -= dt;
  const p = state.player;
  if (!p.onFoot && p.car) {
    const d = Math.hypot(p.car.x - lobos.x, p.car.y - lobos.y);
    if (d < 52 && Math.abs(p.car.speed) > 150 && m.lobosHitCd <= 0 && lobos.durability > 0) {
      m.lobosHitCd = MISSION1.hitCooldown;
      lobos.durability -= MISSION1.hitDamage;
      state.effects.push({ kind: 'debris', x: lobos.x, y: lobos.y, life: 0.8, max: 0.8, count: 6 });
      if (lobos.durability <= 0) {
        lobos.speed = 0;
        state.player.cash += MISSION1.reward;
        state.message = { text: `Lobos car stopped! +$${MISSION1.reward}`, until: state.time + 2.5 };
        m.phase = 'done';
        m.briefUntil = state.time + 2;
        return 'complete';
      }
      state.message = { text: 'Hit! Keep ramming the Lobos car.', until: state.time + 1.5 };
    }
  }
  return null;
}

// Retry the current job from its briefing after a failure.
export function retryMission(state) {
  const m = state.mission;
  if (m.index === 1 && m.lobos) {
    m.lobos.durability = MISSION1.targetHealth;
    m.lobos.x = MISSION1.loop[0].x;
    m.lobos.y = MISSION1.loop[0].y;
    m.lobos.loopIndex = 1;
    m.lobos.speed = 0;
  }
  startJob(state);
}

export { startJob };

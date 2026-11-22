// Keyboard input. Held keys steer and drive; one-shot presses (steal, punch, pause,
// side jobs, mute) are queued as edges and taken once, so a press between two frames
// is never lost and never counted twice. The screenshot scenes steer through the same
// input by injecting virtual keys.
const AXIS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  handbrake: ['Space'],
};
const EDGE = {
  steal: ['KeyE'],
  punch: ['KeyJ'],
  side: ['KeyT'],
  mute: ['KeyM'],
  pause: ['KeyP', 'Escape'],
  confirm: ['Enter'],
};
const CODE_TO_EDGE = {};
for (const [action, codes] of Object.entries(EDGE)) {
  for (const code of codes) CODE_TO_EDGE[code] = action;
}
const GAME_CODES = new Set(Object.values(AXIS).flat().concat(Object.values(EDGE).flat()));

export function createInput(canvas) {
  const held = new Set();
  const edges = new Set();
  const virtual = { up: false, down: false, left: false, right: false, handbrake: false, run: false };

  window.addEventListener('keydown', (event) => {
    if (!GAME_CODES.has(event.code)) return;
    event.preventDefault();
    if (event.repeat) return;
    held.add(event.code);
    const action = CODE_TO_EDGE[event.code];
    if (action) edges.add(action);
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
  });
  canvas.addEventListener('pointerdown', () => {
    edges.add('confirm');
  });

  function down(name) {
    if (virtual[name]) return true;
    return AXIS[name].some((code) => held.has(code));
  }

  return {
    isDown(name) {
      return down(name);
    },
    axisX() {
      return (down('right') ? 1 : 0) - (down('left') ? 1 : 0);
    },
    axisY() {
      return (down('down') ? 1 : 0) - (down('up') ? 1 : 0);
    },
    run() {
      return down('run');
    },
    // Take a one-shot press, once.
    consume(action) {
      if (edges.has(action)) {
        edges.delete(action);
        return true;
      }
      return false;
    },
    // Any key at all, for dismissing briefings and result screens.
    anyPressed() {
      if (edges.size > 0) {
        edges.clear();
        return true;
      }
      return false;
    },
    clearEdges() {
      edges.clear();
    },
    // The screenshot autopilot steers through here.
    setVirtual(next) {
      Object.assign(virtual, next);
    },
    clearVirtual() {
      for (const key of Object.keys(virtual)) virtual[key] = false;
    },
  };
}

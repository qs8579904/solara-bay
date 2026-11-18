// Keyboard and pointer input. Held keys give a steering direction; one-shot
// presses (confirm, pause, steal) are queued as bit flags and taken once by
// the loop, so a press between two frames is never lost and never counted
// twice. A key released while the tab is hidden never sends keyup, so blur
// lets go of everything.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_STEAL = 4;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const BRAKE = new Set(['Space']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const STEAL = new Set(['KeyE']);
const PUNCH = new Set(['KeyJ']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code) || RIGHT.has(event.code) || UP.has(event.code) || DOWN.has(event.code)
      || RUN.has(event.code) || BRAKE.has(event.code) || PUNCH.has(event.code)) {
      held.add(event.code);
    }
    if (CONFIRM.has(event.code) || BRAKE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    }
    if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    }
    if (STEAL.has(event.code)) {
      if (!event.repeat) actions |= ACTION_STEAL;
    }
    if (LEFT.has(event.code) || RIGHT.has(event.code) || UP.has(event.code) || DOWN.has(event.code)
      || BRAKE.has(event.code) || CONFIRM.has(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
  });
  target.addEventListener('pointerdown', () => {
    actions |= ACTION_CONFIRM;
  });

  function any(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }

  return {
    // -1 left, 1 right, 0 neither or both.
    moveX() {
      return (any(RIGHT) ? 1 : 0) - (any(LEFT) ? 1 : 0);
    },
    // -1 up, 1 down, 0 neither or both.
    moveY() {
      return (any(DOWN) ? 1 : 0) - (any(UP) ? 1 : 0);
    },
    run() {
      return any(RUN);
    },
    handbrake() {
      return any(BRAKE);
    },
    punch() {
      return any(PUNCH);
    },
    // The one-shot presses since the last call, as ACTION_* flags.
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}

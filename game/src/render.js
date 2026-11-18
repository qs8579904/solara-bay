// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x800 view is scaled to fit the window and centred; the camera
// follows the player and never leaves the map. Flat shapes, system text,
// no images: everything on screen is drawn from the state each frame.
import { BEACH, CAR, DISTRICTS, FONT, PALETTE, ROADS_H, ROADS_V, ROAD_W, SPRAY, STATION, VIEW, VINCE, WATER, WORLD } from './config.js';
import { missionTarget, missionText } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_FAILED = 'failed';

const PANEL = { width: 640, top: 150, line: 34, bottom: 76 };

function hash(i) {
  const s = Math.sin(i * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function textPlain(value, x, y, size, color, align) {
    if (!fonts.has(size + 1000)) fonts.set(size + 1000, `${size}px ${FONT}`);
    context.font = fonts.get(size + 1000);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function carBody(car, isPlayer) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    context.fillStyle = '#14161c';
    context.fillRect(-CAR.length / 2 - 2, -CAR.width / 2 - 2, CAR.length + 4, CAR.width + 4);
    context.fillStyle = car.color;
    context.beginPath();
    context.roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 6);
    context.fill();
    context.fillStyle = 'rgba(20, 24, 34, 0.55)';
    context.fillRect(6, -CAR.width / 2 + 3, 10, CAR.width - 6);
    context.fillStyle = 'rgba(244, 246, 248, 0.85)';
    context.fillRect(-CAR.length / 2 + 2, -CAR.width / 2 + 3, 4, CAR.width - 6);
    if (isPlayer) {
      context.fillStyle = '#f4f6f8';
      context.fillRect(-8, -3, 16, 6);
      // The player's car always wears a white outline, so it never blends
      // into the traffic around it.
      context.strokeStyle = 'rgba(244, 246, 248, 0.95)';
      context.lineWidth = 2.5;
      context.beginPath();
      context.roundRect(-CAR.length / 2 - 1, -CAR.width / 2 - 1, CAR.length + 2, CAR.width + 2, 7);
      context.stroke();
    }
    context.fillStyle = '#ffe9a8';
    context.fillRect(CAR.length / 2 - 2, -CAR.width / 2 + 4, 3, 4);
    context.fillRect(CAR.length / 2 - 2, CAR.width / 2 - 8, 3, 4);
    context.restore();
  }

  function policeCar(cop, time) {
    carBody(cop, false);
    context.save();
    context.translate(cop.x, cop.y);
    context.rotate(cop.angle);
    context.fillStyle = '#f4f6f8';
    context.fillRect(-6, -CAR.width / 2 + 2, 12, CAR.width - 4);
    const flash = Math.floor(time * 5) % 2 === 0;
    context.fillStyle = flash ? PALETTE.policeLightR : PALETTE.policeLightB;
    context.beginPath();
    context.arc(-2, -6, 4, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = flash ? PALETTE.policeLightB : PALETTE.policeLightR;
    context.beginPath();
    context.arc(-2, 6, 4, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawPed(ped) {
    if (ped.state === 'down') {
      context.save();
      context.translate(ped.x, ped.y);
      context.rotate(0.6);
      context.fillStyle = '#8b93a3';
      context.beginPath();
      context.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
      return;
    }
    context.fillStyle = ped.color;
    context.beginPath();
    context.arc(ped.x, ped.y, 7, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.pedSkin;
    context.beginPath();
    context.arc(ped.x, ped.y - 3, 4.5, 0, Math.PI * 2);
    context.fill();
  }

  function drawWorld(state) {
    const camX = Math.max(0, Math.min(WORLD.width - VIEW.width, state.player.x - VIEW.width / 2));
    const camY = Math.max(0, Math.min(WORLD.height - VIEW.height, state.player.y - VIEW.height / 2));
    context.setTransform(view.scale, 0, 0, view.scale, view.x - camX * view.scale, view.y - camY * view.scale);
    // Ground: districts, then the sea and the beach on the west edge.
    for (let i = 0; i < DISTRICTS.length; i += 1) {
      const d = DISTRICTS[i];
      context.fillStyle = d.ground;
      context.fillRect(d.x, d.y, d.w, d.h);
    }
    context.fillStyle = PALETTE.water;
    context.fillRect(0, 0, WATER.x1, WORLD.height);
    context.fillStyle = PALETTE.waterDeep;
    context.fillRect(0, 0, 60, WORLD.height);
    context.fillStyle = PALETTE.sand;
    context.fillRect(BEACH.x0, 0, BEACH.x1 - BEACH.x0, WORLD.height);
    // Parks: green blocks with a few trees.
    for (let i = 0; i < state.city.parks.length; i += 1) {
      const pk = state.city.parks[i];
      context.fillStyle = PALETTE.park;
      context.fillRect(pk.x, pk.y, pk.w, pk.h);
      for (let t = 0; t < 4; t += 1) {
        context.fillStyle = '#5d8a44';
        context.beginPath();
        context.arc(pk.x + 24 + hash(i * 7 + t) * (pk.w - 48), pk.y + 24 + hash(i * 11 + t) * (pk.h - 48), 9, 0, Math.PI * 2);
        context.fill();
      }
    }
    // Roads: pavement border, asphalt, centre dashes.
    for (let i = 0; i < ROADS_V.length; i += 1) {
      const x = ROADS_V[i];
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(x - ROAD_W / 2 - 14, 0, ROAD_W + 28, WORLD.height);
      context.fillStyle = PALETTE.road;
      context.fillRect(x - ROAD_W / 2, 0, ROAD_W, WORLD.height);
    }
    for (let i = 0; i < ROADS_H.length; i += 1) {
      const y = ROADS_H[i];
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(BEACH.x1, y - ROAD_W / 2 - 14, WORLD.width - BEACH.x1, ROAD_W + 28);
      context.fillStyle = PALETTE.road;
      context.fillRect(BEACH.x1, y - ROAD_W / 2, WORLD.width - BEACH.x1, ROAD_W);
    }
    context.strokeStyle = PALETTE.dash;
    context.lineWidth = 3;
    context.setLineDash([26, 22]);
    for (let i = 0; i < ROADS_V.length; i += 1) {
      context.beginPath();
      context.moveTo(ROADS_V[i], 0);
      context.lineTo(ROADS_V[i], WORLD.height);
      context.stroke();
    }
    for (let i = 0; i < ROADS_H.length; i += 1) {
      context.beginPath();
      context.moveTo(BEACH.x1, ROADS_H[i]);
      context.lineTo(WORLD.width, ROADS_H[i]);
      context.stroke();
    }
    context.setLineDash([]);
    // Buildings: roof colour, a darker rim and a lighter inner roof.
    for (let i = 0; i < state.city.buildings.length; i += 1) {
      const b = state.city.buildings[i];
      context.fillStyle = 'rgba(20, 24, 34, 0.35)';
      context.fillRect(b.x + 3, b.y + 4, b.w, b.h);
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = 'rgba(244, 246, 248, 0.16)';
      context.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
    }
    // Landmarks: the spray shop ring (only when the player is close enough
    // for it to matter — otherwise it is a stray circle in the middle of
    // the view), the police station and Vince's bar.
    const sprayDist = Math.hypot(state.player.x - SPRAY.x, state.player.y - SPRAY.y);
    if (sprayDist < SPRAY.r + 60) {
      context.save();
      context.globalAlpha = 0.6;
      context.strokeStyle = PALETTE.spray;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(SPRAY.x, SPRAY.y, SPRAY.r, 0, Math.PI * 2);
      context.stroke();
      context.restore();
      context.fillStyle = PALETTE.spray;
      textPlain('SPRAY', SPRAY.x, SPRAY.y - SPRAY.r - 8, 20, PALETTE.spray, 'center');
    }
    context.fillStyle = '#2d5a9e';
    context.fillRect(STATION.x - 26, STATION.y - 18, 52, 36);
    context.fillStyle = PALETTE.text;
    textPlain('SBPD', STATION.x, STATION.y + 6, 16, PALETTE.text, 'center');
    context.fillStyle = '#a4552e';
    context.fillRect(VINCE.x - 20, VINCE.y - 14, 40, 28);
    context.fillStyle = PALETTE.text;
    textPlain("VINCE'S", VINCE.x, VINCE.y + 5, 13, PALETTE.text, 'center');
    // Cash pickups.
    for (let i = 0; i < state.pickups.length; i += 1) {
      const pk = state.pickups[i];
      if (pk.taken) continue;
      context.fillStyle = PALETTE.cash;
      context.beginPath();
      context.arc(pk.x, pk.y, 10, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#0e2b1a';
      textPlain('$', pk.x, pk.y + 5, 14, '#0e2b1a', 'center');
    }
    // Mission waypoint: a pulsing diamond.
    const target = missionTarget(state);
    if (target) {
      const pulse = 1 + 0.18 * Math.sin(state.time * 5);
      context.save();
      context.translate(target.x, target.y);
      context.scale(pulse, pulse);
      context.fillStyle = PALETTE.waypoint;
      context.beginPath();
      context.moveTo(0, -18);
      context.lineTo(13, 0);
      context.lineTo(0, 18);
      context.lineTo(-13, 0);
      context.closePath();
      context.fill();
      context.restore();
      context.strokeStyle = 'rgba(255, 210, 62, 0.5)';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(target.x, target.y, 30 + 6 * Math.sin(state.time * 5), 0, Math.PI * 2);
      context.stroke();
    }
    // Skid marks, debris and flashes.
    for (let i = 0; i < state.effects.length; i += 1) {
      const e = state.effects[i];
      const alpha = Math.max(0, e.life / e.max);
      if (e.kind === 'skid') {
        context.strokeStyle = `rgba(20, 20, 24, ${0.45 * alpha})`;
        context.lineWidth = 5;
        context.beginPath();
        context.moveTo(e.x - Math.cos(e.angle) * 14, e.y - Math.sin(e.angle) * 14);
        context.lineTo(e.x + Math.cos(e.angle) * 14, e.y + Math.sin(e.angle) * 14);
        context.stroke();
      } else if (e.kind === 'debris') {
        for (let p = 0; p < e.count; p += 1) {
          context.fillStyle = `rgba(30, 30, 36, ${alpha})`;
          context.fillRect(e.x + (hash(p * 3 + 1) - 0.5) * 36, e.y + (hash(p * 7 + 2) - 0.5) * 36, 4, 4);
        }
      } else if (e.kind === 'flash') {
        context.fillStyle = `rgba(255, 255, 255, ${0.7 * alpha})`;
        context.beginPath();
        context.arc(e.x, e.y, 26, 0, Math.PI * 2);
        context.fill();
      }
    }
    // Cars: parked and civilian first, then the Lobos target, the cops, the
    // player, so the player is always on top.
    for (let i = 0; i < state.cars.length; i += 1) {
      const car = state.cars[i];
      if (car.kind === 'lobos' || car.kind === 'player') continue;
      carBody(car, false);
    }
    const lobos = state.mission.lobos;
    if (lobos && lobos.durability > 0) {
      carBody(lobos, false);
      context.fillStyle = PALETTE.waypoint;
      context.beginPath();
      context.arc(lobos.x, lobos.y - 34, 7, 0, Math.PI * 2);
      context.fill();
    }
    for (let i = 0; i < state.cops.length; i += 1) {
      const cop = state.cops[i];
      if (cop.kind === 'police') policeCar(cop, state.time);
      else {
        context.fillStyle = '#20242e';
        context.beginPath();
        context.arc(cop.x, cop.y, 9, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = PALETTE.pedSkin;
        context.beginPath();
        context.arc(cop.x, cop.y - 3, 5, 0, Math.PI * 2);
        context.fill();
      }
    }
    for (let i = 0; i < state.peds.length; i += 1) drawPed(state.peds[i]);
    const p = state.player;
    if (p.onFoot) {
      context.save();
      context.translate(p.x, p.y);
      context.rotate(p.angle);
      context.fillStyle = PALETTE.player;
      context.beginPath();
      context.arc(0, 0, 13, 0, Math.PI * 2);
      context.fill();
      // A white ring and a facing tick, so the player on foot is easy to
      // find among the pedestrians.
      context.strokeStyle = 'rgba(244, 246, 248, 0.95)';
      context.lineWidth = 2.5;
      context.beginPath();
      context.arc(0, 0, 13, 0, Math.PI * 2);
      context.stroke();
      context.strokeStyle = 'rgba(244, 246, 248, 0.9)';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(10, 0);
      context.lineTo(19, 0);
      context.stroke();
      context.fillStyle = PALETTE.pedSkin;
      context.beginPath();
      context.arc(3, -2, 5, 0, Math.PI * 2);
      context.fill();
      context.restore();
    } else if (p.car) {
      carBody(p.car, true);
    }
  }

  function drawMinimap(state) {
    const mx = VIEW.width - 224;
    const my = 66;
    const mw = 200;
    const mh = 150;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    context.fillStyle = PALETTE.panel;
    context.fillRect(mx - 6, my - 6, mw + 12, mh + 12);
    for (let i = 0; i < DISTRICTS.length; i += 1) {
      const d = DISTRICTS[i];
      context.fillStyle = d.ground;
      context.fillRect(mx + d.x * sx, my + d.y * sy, d.w * sx, d.h * sy);
    }
    context.fillStyle = PALETTE.water;
    context.fillRect(mx, my, WATER.x1 * sx, mh);
    context.strokeStyle = 'rgba(244, 246, 248, 0.55)';
    context.lineWidth = 1;
    for (let i = 0; i < ROADS_V.length; i += 1) {
      context.beginPath();
      context.moveTo(mx + ROADS_V[i] * sx, my);
      context.lineTo(mx + ROADS_V[i] * sx, my + mh);
      context.stroke();
    }
    for (let i = 0; i < ROADS_H.length; i += 1) {
      context.beginPath();
      context.moveTo(mx, my + ROADS_H[i] * sy);
      context.lineTo(mx + mw, my + ROADS_H[i] * sy);
      context.stroke();
    }
    const target = missionTarget(state);
    if (target) {
      context.fillStyle = PALETTE.waypoint;
      context.beginPath();
      context.arc(mx + target.x * sx, my + target.y * sy, 4, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = PALETTE.spray;
    context.fillRect(mx + SPRAY.x * sx - 3, my + SPRAY.y * sy - 3, 6, 6);
    for (let i = 0; i < state.cops.length; i += 1) {
      context.fillStyle = '#ff2d2d';
      context.beginPath();
      context.arc(mx + state.cops[i].x * sx, my + state.cops[i].y * sy, 3, 0, Math.PI * 2);
      context.fill();
    }
    const p = state.player;
    context.save();
    context.translate(mx + p.x * sx, my + p.y * sy);
    context.rotate(p.angle);
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.moveTo(7, 0);
    context.lineTo(-5, -5);
    context.lineTo(-5, 5);
    context.closePath();
    context.fill();
    context.restore();
  }

  function drawHud(state) {
    const p = state.player;
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    context.textBaseline = 'top';
    text(`$${p.cash}`, 24, 44, 34, PALETTE.text, 'left');
    // At three stars and up, the objective is survival: the HUD says so.
    let obj = missionText(state);
    if (state.wanted >= 3) obj = 'Lose the cops!';
    // A dark backing behind the objective and the timer, so the text reads
    // over roads and buildings alike.
    context.font = `20px ${FONT}`;
    const objWidth = context.measureText(obj).width;
    context.fillStyle = 'rgba(13, 15, 20, 0.55)';
    context.fillRect(16, 74, objWidth + 24, 72);
    textPlain(obj, 24, 84, 20, PALETTE.text, 'left');
    if (state.mission.index === 0 && state.mission.phase === 'active') {
      const t = Math.max(0, state.mission.timer);
      const mm = Math.floor(t / 60);
      const ss = Math.floor(t % 60);
      const label = `TIME ${mm}:${ss < 10 ? '0' : ''}${ss}`;
      text(label, 24, 112, 24, t < 15 ? '#ff5a4e' : PALETTE.waypoint, 'left');
    }
    // Wanted stars, top right.
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < state.wanted ? '★' : '☆';
    text(stars, VIEW.width - 24, 44, 30, PALETTE.star, 'right');
    drawMinimap(state);
    if (!p.onFoot && p.car) {
      const mph = Math.round(Math.abs(p.car.speed) * 0.32);
      text(`${mph} mph`, VIEW.width - 24, VIEW.height - 36, 30, PALETTE.text, 'right');
      const bw = 140;
      const bx = VIEW.width - 24 - bw;
      const by = VIEW.height - 66;
      context.fillStyle = 'rgba(244, 246, 248, 0.25)';
      context.fillRect(bx, by, bw, 10);
      const frac = Math.max(0, p.car.durability / CAR.durability);
      context.fillStyle = frac > 0.5 ? PALETTE.cash : frac > 0.25 ? PALETTE.waypoint : '#ff5a4e';
      context.fillRect(bx, by, bw * frac, 10);
      textPlain('CAR', bx - 8, by + 12, 13, PALETTE.muted, 'right');
    }
    // Context hint, bottom left.
    let hint = 'WASD move / drive · Shift run · J punch · P pause';
    if (p.onFoot) {
      let near = null;
      for (let i = 0; i < state.cars.length; i += 1) {
        const car = state.cars[i];
        if (car.kind === 'police' || car.kind === 'lobos' || car.kind === 'player') continue;
        if (Math.hypot(car.x - p.x, car.y - p.y) < 74) {
          near = car;
          break;
        }
      }
      if (near) hint = 'Press E to steal this car';
    } else {
      hint = 'E: get out · Space: handbrake · P: pause';
    }
    textPlain(hint, 24, VIEW.height - 30, 17, PALETTE.muted, 'left');
    // Centre banner message.
    if (state.message && state.time < state.message.until) {
      context.fillStyle = PALETTE.panel;
      const w = 560;
      context.fillRect((VIEW.width - w) / 2, 190, w, 44);
      textPlain(state.message.text, VIEW.width / 2, 219, 21, PALETTE.text, 'center');
    }
  }

  function drawPanel(title, lines, prompt) {
    // Panels are view-space, whatever transform the world or the HUD left
    // behind: reset it here, or the title panel lands off-screen.
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (VIEW.width - PANEL.width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, VIEW.width / 2, y + 78, 46, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      textPlain(lines[index], VIEW.width / 2, y + PANEL.top + index * PANEL.line, 20, PALETTE.muted, 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 38, 22, PALETTE.waypoint, 'center');
  }

  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#0d0f14';
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawWorld(state);
    if (screen === SCREEN_TITLE) {
      const lines = [
        "Mara 'Rook' Delgado owes Vince Kroll, and the debt is due.",
        'Steal cars, lose the cops, run the jobs — pay it off.',
        'Move WASD · Run Shift · Steal E · Punch J · Handbrake Space',
        '',
        `Cash $${state.player.cash} · Jobs done ${Math.min(state.mission.index, 2)} of 2 · Best haul $${best}`,
      ];
      drawPanel('SOLARA BAY', lines, 'Press Enter to start');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city waits for you.'], 'Press P to resume');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', [`The SBPD took $${state.bustedFine} off you.`, 'You wake up at the station door.'], 'Press Enter to get back out there');
    } else if (screen === SCREEN_FAILED) {
      drawPanel('Job failed', ['The clock ran out on that one.', 'Vince is not happy, but he will give you one more shot.'], 'Press Enter to retry the job');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}

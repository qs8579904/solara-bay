// Drawing only: the city, the cars, the people, the HUD and every screen, in pixels.
// The camera follows Rook; the world is drawn in world space, the HUD in screen space.
import { COLORS, WORLD_W, WORLD_H, MINIMAP_W, MINIMAP_H, FONT, CAR } from './config.js';
import { ROADS_V, ROADS_H, ROAD_HALF, RIDGE, RIDGE_HALF } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BRIEFING = 'briefing';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_FAILED = 'failed';
export const SCREEN_COMPLETE = 'complete';
export const SCREEN_FINALE = 'finale';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let viewW = 1280;
  let viewH = 800;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const w = Math.round(window.innerWidth * ratio);
    const h = Math.round(window.innerHeight * ratio);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function drawGround(game) {
    const city = game.city;
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    for (const d of city.districts) {
      ctx.fillStyle = d.ground;
      ctx.fillRect(d.x, d.y, d.w, d.h);
    }
    // Water, with a wavy shoreline.
    ctx.fillStyle = COLORS.water;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let y = 0; y <= WORLD_H; y += 60) ctx.lineTo(city.coastX(y), y);
    ctx.lineTo(0, WORLD_H);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let y = 40; y < WORLD_H; y += 130) {
      ctx.beginPath();
      ctx.moveTo(city.coastX(y) - 26, y);
      ctx.quadraticCurveTo(city.coastX(y) - 12, y + 14, city.coastX(y) - 26, y + 28);
      ctx.stroke();
    }
    // Wet sand along the shore.
    ctx.fillStyle = COLORS.sand;
    ctx.beginPath();
    for (let y = 0; y <= WORLD_H; y += 60) ctx.lineTo(city.coastX(y), y);
    for (let y = WORLD_H; y >= 0; y -= 60) ctx.lineTo(city.coastX(y) + 64, y);
    ctx.closePath();
    ctx.fill();
  }

  function drawRoads() {
    ctx.fillStyle = COLORS.sidewalk;
    for (const rx of ROADS_V) ctx.fillRect(rx - ROAD_HALF - 8, 0, (ROAD_HALF + 8) * 2, WORLD_H);
    for (const ry of ROADS_H) ctx.fillRect(0, ry - ROAD_HALF - 8, WORLD_W, (ROAD_HALF + 8) * 2);
    ctx.fillStyle = COLORS.road;
    for (const rx of ROADS_V) ctx.fillRect(rx - ROAD_HALF, 0, ROAD_HALF * 2, WORLD_H);
    for (const ry of ROADS_H) ctx.fillRect(0, ry - ROAD_HALF, WORLD_W, ROAD_HALF * 2);
    // Ridge road through the Hills.
    ctx.strokeStyle = COLORS.road;
    ctx.lineWidth = RIDGE_HALF * 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(RIDGE[0].x, RIDGE[0].y);
    for (let i = 1; i < RIDGE.length; i += 1) ctx.lineTo(RIDGE[i].x, RIDGE[i].y);
    ctx.stroke();
    // Centre dashes.
    ctx.strokeStyle = COLORS.dash;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 30]);
    for (const rx of ROADS_V) {
      ctx.beginPath();
      ctx.moveTo(rx, 0);
      ctx.lineTo(rx, WORLD_H);
      ctx.stroke();
    }
    for (const ry of ROADS_H) {
      ctx.beginPath();
      ctx.moveTo(0, ry);
      ctx.lineTo(WORLD_W, ry);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function drawBuildings(game) {
    for (const b of game.city.buildings) {
      ctx.fillStyle = '#00000022';
      ctx.fillRect(b.x + 4, b.y + 5, b.w, b.h);
      ctx.fillStyle = COLORS.buildingWall;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      if (b.label) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 5);
      }
    }
    // Palms.
    for (const p of game.city.palms) {
      ctx.strokeStyle = COLORS.palmTrunk;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.lean * 20, p.y - 14);
      ctx.stroke();
      ctx.fillStyle = COLORS.palmLeaf;
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2 + p.lean;
        ctx.beginPath();
        ctx.ellipse(p.x + p.lean * 20 + Math.cos(a) * 8, p.y - 14 + Math.sin(a) * 6, 11, 4, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Pay-and-spray bay.
    const spray = game.city.points.spray;
    ctx.fillStyle = COLORS.sprayPink;
    roundRect(ctx, spray.x - 52, spray.y - 38, 104, 76, 10);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('PAY & SPRAY', spray.x, spray.y - 4);
    ctx.font = '11px ' + FONT;
    ctx.fillText('$50 · clears heat', spray.x, spray.y + 14);
  }

  function drawCarShape(car, isPlayer) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(ctx, -21, -9, 44, 22, 6);
    ctx.fill();
    const body = car.kind === 'police' ? COLORS.copBlue : car.color;
    ctx.fillStyle = body;
    roundRect(ctx, -22, -11, 44, 22, 7);
    ctx.fill();
    if (car.kind === 'police') {
      ctx.fillStyle = COLORS.copWhite;
      ctx.fillRect(-4, -11, 12, 22);
      // Flashing light bar.
      const phase = Math.floor(performance.now() / 260) % 2 === 0;
      ctx.fillStyle = phase ? '#ff3b30' : '#2f7bff';
      ctx.fillRect(-8, -12, 7, 6);
      ctx.fillStyle = phase ? '#2f7bff' : '#ff3b30';
      ctx.fillRect(-8, 6, 7, 6);
    } else {
      ctx.fillStyle = '#1c2733';
      ctx.fillRect(2, -8, 9, 16);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(-14, -8, 6, 16);
    }
    if (car.isLuxury) {
      ctx.fillStyle = '#fff2c0';
      ctx.fillRect(-20, -8, 5, 16);
    }
    // Headlights.
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(21, -7, 2.5, 0, Math.PI * 2);
    ctx.arc(21, 7, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Damage smoke.
    if (car.health < 45) {
      ctx.fillStyle = 'rgba(120,120,120,0.5)';
      ctx.beginPath();
      ctx.arc(-16, -4, 5 + Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (isPlayer) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(car.x, car.y, 30, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawPerson(x, y, angle, jacket, punchAnim) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = jacket;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.playerSkin;
    ctx.beginPath();
    ctx.arc(4, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.playerHair;
    ctx.beginPath();
    ctx.arc(2, 0, 5.5, Math.PI * 0.6, Math.PI * 1.4);
    ctx.fill();
    if (punchAnim > 0) {
      ctx.fillStyle = COLORS.playerSkin;
      ctx.beginPath();
      ctx.arc(16, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawWaypoint(game, cam) {
    const wp = game.missions.waypoint(game);
    if (!wp) return;
    const pulse = 1 + 0.18 * Math.sin(game.time * 5);
    const onScreen = wp.x > cam.x - 40 && wp.x < cam.x + viewW + 40 && wp.y > cam.y - 40 && wp.y < cam.y + viewH + 40;
    if (onScreen) {
      ctx.save();
      ctx.translate(wp.x, wp.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = COLORS.waypoint;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(-11 * pulse, -11 * pulse, 22 * pulse, 22 * pulse);
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.fillStyle = COLORS.waypoint;
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,207,61,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, 26 * pulse, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Edge arrow pointing at the off-screen target.
      const cx = Math.max(30, Math.min(viewW - 30, wp.x - cam.x));
      const cy = Math.max(30, Math.min(viewH - 30, wp.y - cam.y));
      const a = Math.atan2(wp.y - (cam.y + viewH / 2), wp.x - (cam.x + viewW / 2));
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.fillStyle = COLORS.waypoint;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-10, -11);
      ctx.lineTo(-10, 11);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawParticles(game) {
    for (const p of game.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      if (p.kind === 'skid') {
        ctx.strokeStyle = 'rgba(20,20,20,' + (alpha * 0.5) + ')';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(p.x - Math.cos(p.angle) * 10, p.y - Math.sin(p.angle) * 10);
        ctx.lineTo(p.x + Math.cos(p.angle) * 10, p.y + Math.sin(p.angle) * 10);
        ctx.stroke();
      } else if (p.kind === 'splash') {
        ctx.fillStyle = 'rgba(180,230,255,' + alpha + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawMinimap(game) {
    const mx = viewW - MINIMAP_W - 12;
    const my = 12;
    const sx = MINIMAP_W / WORLD_W;
    const sy = MINIMAP_H / WORLD_H;
    ctx.save();
    ctx.fillStyle = 'rgba(10,16,24,0.78)';
    roundRect(ctx, mx - 5, my - 5, MINIMAP_W + 10, MINIMAP_H + 10, 8);
    ctx.fill();
    ctx.beginPath();
    ctx.rect(mx, my, MINIMAP_W, MINIMAP_H);
    ctx.clip();
    ctx.fillStyle = '#5da84a';
    ctx.fillRect(mx, my, MINIMAP_W, MINIMAP_H);
    ctx.fillStyle = COLORS.water;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    for (let y = 0; y <= WORLD_H; y += 120) ctx.lineTo(mx + game.city.coastX(y) * sx, my + y * sy);
    ctx.lineTo(mx, my + MINIMAP_H);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#2c2e35';
    ctx.lineWidth = 3;
    for (const rx of ROADS_V) {
      ctx.beginPath();
      ctx.moveTo(mx + rx * sx, my);
      ctx.lineTo(mx + rx * sx, my + MINIMAP_H);
      ctx.stroke();
    }
    for (const ry of ROADS_H) {
      ctx.beginPath();
      ctx.moveTo(mx, my + ry * sy);
      ctx.lineTo(mx + MINIMAP_W, my + ry * sy);
      ctx.stroke();
    }
    // Spray shop.
    ctx.fillStyle = COLORS.sprayPink;
    ctx.fillRect(mx + game.city.points.spray.x * sx - 3, my + game.city.points.spray.y * sy - 3, 6, 6);
    // Side-gig markers.
    ctx.fillStyle = '#5ad8e8';
    ctx.fillRect(mx + game.city.points.taxiStand.x * sx - 3, my + game.city.points.taxiStand.y * sy - 3, 6, 6);
    ctx.fillRect(mx + game.city.points.medicPoint.x * sx - 3, my + game.city.points.medicPoint.y * sy - 3, 6, 6);
    // Waypoint pulse.
    const wp = game.missions.waypoint(game);
    if (wp) {
      const r = 4 + 2 * Math.sin(game.time * 5);
      ctx.fillStyle = COLORS.waypoint;
      ctx.beginPath();
      ctx.arc(mx + wp.x * sx, my + wp.y * sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police red dots.
    ctx.fillStyle = '#ff3b30';
    for (const car of game.police.cars) {
      ctx.beginPath();
      ctx.arc(mx + car.x * sx, my + car.y * sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    ctx.save();
    ctx.translate(mx + game.player.x * sx, my + game.player.y * sy);
    ctx.rotate(game.player.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = COLORS.hudPanel;
    roundRect(ctx, x, y, w, h, 10);
    ctx.fill();
  }

  function drawHud(game) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    // Top-left: cash, job, objective, clock.
    const active = game.missions.active;
    const h = active ? 118 : 64;
    panel(12, 12, 340, h);
    ctx.fillStyle = COLORS.hudGold;
    ctx.font = 'bold 22px ' + FONT;
    ctx.fillText('$' + Math.floor(game.cash), 26, 42);
    ctx.fillStyle = COLORS.hudText;
    ctx.font = '13px ' + FONT;
    if (active) {
      ctx.fillText(active.def.name + '  ·  $' + active.def.reward, 26, 66);
      ctx.font = 'bold 14px ' + FONT;
      ctx.fillText(game.missions.objectiveText(), 26, 88, 312);
      ctx.font = '13px ' + FONT;
      ctx.fillStyle = active.timer < 20 ? '#ff8a7a' : COLORS.hudText;
      ctx.fillText('Time ' + Math.max(0, Math.ceil(active.timer)) + 's', 26, 110);
      const prog = game.missions.progress(game);
      if (prog) {
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        roundRect(ctx, 26, 118, 312, 8, 4);
        ctx.fill();
        ctx.fillStyle = COLORS.waypoint;
        roundRect(ctx, 26, 118, 312 * prog.value, 8, 4);
        ctx.fill();
      }
    } else {
      ctx.fillText('Free roam — visit Kroll\'s Bar for work', 26, 66);
    }
    // Wanted stars, top-right under the minimap.
    const starsY = 12 + MINIMAP_H + 22;
    ctx.font = 'bold 26px ' + FONT;
    ctx.textAlign = 'right';
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < game.police.wanted ? COLORS.hudGold : 'rgba(255,255,255,0.3)';
      ctx.fillText('★', viewW - 14 - i * 30, starsY);
    }
    ctx.textAlign = 'left';
    if (game.police.wanted > 0 && game.police.loseProgress > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      roundRect(ctx, viewW - 190, starsY + 8, 176, 7, 3);
      ctx.fill();
      ctx.fillStyle = '#7ac98a';
      roundRect(ctx, viewW - 190, starsY + 8, 176 * game.police.loseProgress, 7, 3);
      ctx.fill();
      ctx.fillStyle = COLORS.hudText;
      ctx.font = '12px ' + FONT;
      ctx.textAlign = 'right';
      ctx.fillText('Stay hidden…', viewW - 14, starsY + 30);
      ctx.textAlign = 'left';
    }
    // Speed, bottom-right.
    if (!game.player.onFoot) {
      const kmh = Math.round(Math.abs(game.player.car.speed) * 0.9);
      panel(viewW - 132, viewH - 58, 120, 46);
      ctx.fillStyle = COLORS.hudText;
      ctx.font = 'bold 22px ' + FONT;
      ctx.textAlign = 'right';
      ctx.fillText(kmh + '', viewW - 52, viewH - 26);
      ctx.font = '12px ' + FONT;
      ctx.fillStyle = '#b8c0cc';
      ctx.fillText('km/h', viewW - 24, viewH - 26);
      ctx.textAlign = 'left';
    }
    // Car health bar, bottom-left when driving.
    if (!game.player.onFoot) {
      panel(12, viewH - 58, 200, 46);
      ctx.fillStyle = COLORS.hudText;
      ctx.font = '13px ' + FONT;
      ctx.fillText('Car', 26, viewH - 26);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      roundRect(ctx, 62, viewH - 38, 130, 10, 5);
      ctx.fill();
      const hp = Math.max(0, game.player.car.health / CAR.health);
      ctx.fillStyle = hp > 0.45 ? '#7ac98a' : '#ff6a5a';
      roundRect(ctx, 62, viewH - 38, 130 * hp, 10, 5);
      ctx.fill();
    }
    // Health bar on foot.
    if (game.player.onFoot) {
      panel(12, viewH - 58, 200, 46);
      ctx.fillStyle = COLORS.hudText;
      ctx.font = '13px ' + FONT;
      ctx.fillText('Health', 26, viewH - 26);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      roundRect(ctx, 82, viewH - 38, 110, 10, 5);
      ctx.fill();
      const hp = Math.max(0, game.player.health / 100);
      ctx.fillStyle = hp > 0.45 ? '#7ac98a' : '#ff6a5a';
      roundRect(ctx, 82, viewH - 38, 110 * hp, 10, 5);
      ctx.fill();
    }
    drawMinimap(game);
    // Toast messages.
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px ' + FONT;
    let my = 90;
    for (const m of game.messages) {
      ctx.globalAlpha = Math.min(1, m.ttl);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      const w = ctx.measureText(m.text).width + 24;
      roundRect(ctx, viewW / 2 - w / 2, my - 20, w, 28, 8);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(m.text, viewW / 2, my);
      ctx.globalAlpha = 1;
      my += 34;
    }
    // Context prompts, bottom-centre.
    ctx.font = 'bold 16px ' + FONT;
    const prompt = game.prompt;
    if (prompt) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      const w = ctx.measureText(prompt).width + 28;
      roundRect(ctx, viewW / 2 - w / 2, viewH - 100, w, 32, 9);
      ctx.fill();
      ctx.fillStyle = '#ffe9a8';
      ctx.fillText(prompt, viewW / 2, viewH - 78);
    }
  }

  function overlayPanel(title, lines, prompt, accent) {
    ctx.fillStyle = 'rgba(8,12,20,0.72)';
    ctx.fillRect(0, 0, viewW, viewH);
    const w = 620;
    const h = 130 + lines.length * 30;
    const x = (viewW - w) / 2;
    const y = (viewH - h) / 2;
    ctx.fillStyle = '#141c2a';
    roundRect(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = accent || COLORS.waypoint;
    ctx.lineWidth = 3;
    roundRect(ctx, x, y, w, h, 14);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = accent || COLORS.waypoint;
    ctx.font = 'bold 30px ' + FONT;
    ctx.fillText(title, viewW / 2, y + 52);
    ctx.fillStyle = COLORS.hudText;
    ctx.font = '16px ' + FONT;
    lines.forEach((line, i) => {
      ctx.fillText(line, viewW / 2, y + 92 + i * 30);
    });
    ctx.fillStyle = '#b8c0cc';
    ctx.font = '14px ' + FONT;
    ctx.fillText(prompt, viewW / 2, y + h - 24);
    ctx.textAlign = 'left';
  }

  function drawTitle(game) {
    ctx.fillStyle = 'rgba(8,12,20,0.45)';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px ' + FONT;
    ctx.fillText('SOLARA BAY', viewW / 2, viewH / 2 - 96);
    ctx.fillStyle = COLORS.waypoint;
    ctx.font = 'bold 20px ' + FONT;
    ctx.fillText('A sunny open-world getaway — drive, steal, outrun the SBPD', viewW / 2, viewH / 2 - 58);
    ctx.fillStyle = '#bfe8ff';
    ctx.font = '15px ' + FONT;
    ctx.fillText('v2: 8 jobs — six for Vince Kroll plus cab and urgent-call gigs — and fully synthesized sound', viewW / 2, viewH / 2 - 28);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px ' + FONT;
    ctx.fillText('WASD drive & walk · Shift run · E steal / exit car · Space handbrake', viewW / 2, viewH / 2 + 14);
    ctx.fillText('J punch · T side gigs at the markers · P pause · M mute', viewW / 2, viewH / 2 + 42);
    ctx.fillStyle = COLORS.hudGold;
    ctx.font = 'bold 18px ' + FONT;
    ctx.fillText('Cash $' + Math.floor(game.cash) + '   ·   Jobs done ' + game.missions.completed.length + ' / 6', viewW / 2, viewH / 2 + 84);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px ' + FONT;
    ctx.fillText(game.time % 1 < 0.6 ? 'Press Enter to play' : '', viewW / 2, viewH / 2 + 128);
    ctx.textAlign = 'left';
  }

  function drawWorld(game, cam) {
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    drawGround(game);
    drawRoads();
    drawBuildings(game);
    // Cash pickups.
    for (const p of game.traffic.pickups) {
      if (!p.active) continue;
      ctx.fillStyle = '#2f9e4d';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('$', p.x, p.y + 4);
    }
    // Parked and special cars.
    for (const car of game.traffic.parked) drawCarShape(car, false);
    for (const car of game.traffic.special) drawCarShape(car, false);
    for (const car of game.traffic.cars) drawCarShape(car, false);
    for (const car of game.police.cars) drawCarShape(car, false);
    // Pedestrians.
    for (const ped of game.traffic.peds) {
      if (ped.state === 'down') {
        ctx.save();
        ctx.translate(ped.x, ped.y);
        ctx.rotate(ped.angle);
        ctx.fillStyle = ped.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        drawPerson(ped.x, ped.y, ped.angle, ped.color, 0);
      }
    }
    // Foot cops.
    for (const cop of game.police.cops) {
      drawPerson(cop.x, cop.y, cop.angle, COLORS.copBlue, 0);
      ctx.fillStyle = COLORS.copBlue;
      ctx.font = 'bold 9px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('SBPD', cop.x, cop.y - 16);
    }
    // The player.
    const player = game.player;
    if (player.onFoot) {
      drawPerson(player.x, player.y, player.angle, COLORS.playerJacket, player.punchAnim);
      if (player.hurtFlash > 0) {
        ctx.fillStyle = 'rgba(255,60,40,0.35)';
        ctx.beginPath();
        ctx.arc(player.x, player.y, 18, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      drawCarShape(player.car, true);
    }
    drawWaypoint(game, cam);
    drawParticles(game);
    ctx.restore();
  }

  function draw(game) {
    resize();
    const player = game.player;
    const shakeX = game.shake > 0 ? (Math.random() - 0.5) * game.shake : 0;
    const shakeY = game.shake > 0 ? (Math.random() - 0.5) * game.shake : 0;
    const cam = {
      x: Math.max(0, Math.min(WORLD_W - viewW, player.x - viewW / 2 + shakeX)),
      y: Math.max(0, Math.min(WORLD_H - viewH, player.y - viewH / 2 + shakeY)),
    };
    ctx.clearRect(0, 0, viewW, viewH);
    drawWorld(game, cam);
    if (game.screen !== SCREEN_TITLE) drawHud(game);
    if (game.screen === SCREEN_TITLE) drawTitle(game);
    else if (game.screen === SCREEN_PAUSED) {
      overlayPanel('PAUSED', ['Take a breath. Solara Bay waits.'], 'Press P or Enter to keep playing');
    } else if (game.screen === SCREEN_BRIEFING && game.briefing) {
      const b = game.briefing;
      overlayPanel(b.def.name.toUpperCase(), [
        b.def.giver + ': ' + b.def.brief,
        'Reward: $' + b.def.reward,
        'Fail: ' + b.def.fail,
      ], 'Press any key to start the job', '#7ac98a');
    } else if (game.screen === SCREEN_BUSTED) {
      overlayPanel('BUSTED', [
        game.result.reason,
        'Fine: $' + game.result.fine + ' — the SBPD drops you at the station.',
      ], 'Press Enter to get back out there', '#ff6a5a');
    } else if (game.screen === SCREEN_FAILED) {
      overlayPanel('JOB FAILED', [
        game.result.reason,
        'Vince is not happy. The job is still open — go back to the bar.',
      ], 'Press Enter to try again', '#ff6a5a');
    } else if (game.screen === SCREEN_COMPLETE) {
      overlayPanel('JOB DONE', [
        game.result.title,
        'Reward: $' + game.result.reward + '   ·   Cash: $' + Math.floor(game.cash),
      ], 'Press Enter to keep playing', '#7ac98a');
    } else if (game.screen === SCREEN_FINALE) {
      overlayPanel('DEBT PAID', [
        'Six jobs. One last run. The yacht pulls away and the debt is done.',
        'Rook is free — and Solara Bay is still hers to drive.',
        'Cash: $' + Math.floor(game.cash) + '   ·   All six jobs complete.',
      ], 'Press Enter to keep cruising', COLORS.hudGold);
    }
  }

  return { draw };
}

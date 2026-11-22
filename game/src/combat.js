// Combat: fists on foot and metal in a car. No guns in Solara Bay — a punch, a
// ram and a handbrake turn are the whole arsenal. Health and car durability live here.
import { FOOT, CAR } from './config.js';

// A punch from the player: the nearest pedestrian or cop in front, inside range.
export function tryPunch(game) {
  const player = game.player;
  if (player.car || player.punchTimer > 0) return false;
  player.punchTimer = FOOT.punchCooldown;
  player.punchAnim = 0.22;
  const reach = FOOT.punchRange;
  const px = player.x + Math.cos(player.angle) * 20;
  const py = player.y + Math.sin(player.angle) * 20;
  let hit = false;
  for (const ped of game.traffic.peds) {
    if (ped.state === 'down') continue;
    if (Math.hypot(ped.x - px, ped.y - py) < reach) {
      ped.state = 'down';
      ped.downTimer = 4;
      game.addCash(game.rng.int(5, 20), ped.x, ped.y, 'Dropped cash');
      hit = true;
      break;
    }
  }
  if (!hit) {
    for (const cop of game.police.cops) {
      if (Math.hypot(cop.x - px, cop.y - py) < reach) {
        cop.stagger = 1.2;
        game.police.addWanted(1);
        game.addMessage('You hit a cop! Wanted up.');
        hit = true;
        break;
      }
    }
  }
  if (hit) game.audio.thud();
  return hit;
}

// Two cars meeting at speed: both take damage scaled by the closing speed.
// Returns the impact speed, so the caller can decide on sound and shake.
export function carImpact(a, b, closingSpeed) {
  const dmg = Math.max(0, (closingSpeed - 60) / 22);
  a.health -= dmg;
  b.health -= dmg;
  return closingSpeed;
}

// Hitting a wall, a building or the shoreline: the car stops hard and takes damage.
export function wallImpact(car, speed) {
  const dmg = Math.max(0, (Math.abs(speed) - 120) / 18);
  car.health -= dmg;
  return dmg;
}

// The player on foot takes a beating from a cop's baton.
export function hurtPlayer(game, amount) {
  const player = game.player;
  player.health -= amount;
  player.hurtFlash = 0.25;
  if (player.health <= 0) {
    player.health = 0;
    game.onBusted('Beaten down by the SBPD');
  }
}

// A pedestrian under the wheels: they go down, the law notices.
export function hitPedestrian(game, ped) {
  if (ped.state === 'down') return;
  ped.state = 'down';
  ped.downTimer = 5;
  game.police.addWanted(1);
  game.addMessage('You hit a pedestrian! Wanted up.');
  game.audio.thud();
}

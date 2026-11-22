// The SBPD: wanted stars, pursuit cars, foot cops who make the arrest, losing the
// heat by breaking line of sight, and the pay-and-spray that washes it all away.
import { WANTED, COP_FOOT_SPEED, ARREST_RANGE, ARREST_HOLD, VISIBILITY_RANGE, PRICES, CAR } from './config.js';

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function createPolice(city, rng) {
  const police = {
    wanted: 0,
    heat: 0,
    cars: [],
    cops: [],
    hideTimer: 0,
    loseProgress: 0,
    sprayTimer: 0,
    sprayCooldown: 0,
    arrestTimer: 0,
  };

  function spawnCar(game, nearX, nearY) {
    // Pick a road point a few blocks away, so the sirens arrive instead of appearing.
    for (let tries = 0; tries < 12; tries += 1) {
      const angle = game.rng.range(0, Math.PI * 2);
      const dist = game.rng.range(520, 780);
      const p = city.nearestRoadPoint(nearX + Math.cos(angle) * dist, nearY + Math.sin(angle) * dist);
      if (!p) continue;
      if (Math.hypot(p.x - nearX, p.y - nearY) < 420) continue;
      const car = {
        x: p.x, y: p.y, angle: game.rng.range(0, Math.PI * 2),
        speed: 0, color: '#22375e', kind: 'police', health: CAR.health,
        stuckTimer: 0, blocker: false,
      };
      police.cars.push(car);
      return car;
    }
    return null;
  }

  function spawnBlockers(game) {
    const player = game.player;
    const ahead = { x: player.x + Math.cos(player.angle) * 380, y: player.y + Math.sin(player.angle) * 380 };
    const p = city.nearestRoadPoint(ahead.x, ahead.y);
    if (!p) return;
    for (const off of [-30, 30]) {
      const car = {
        x: p.x + off, y: p.y, angle: player.angle + Math.PI / 2,
        speed: 0, color: '#22375e', kind: 'police', health: CAR.health,
        stuckTimer: 0, blocker: true,
      };
      police.cars.push(car);
    }
    game.addMessage('Roadblock ahead!');
  }

  function setWanted(game, level) {
    const next = Math.max(0, Math.min(5, level));
    const rose = next > police.wanted;
    police.wanted = next;
    police.hideTimer = 0;
    police.loseProgress = 0;
    if (next >= 4 && !police.cars.some((c) => c.blocker)) spawnBlockers(game);
    if (next < 4) police.cars = police.cars.filter((c) => !c.blocker);
    if (rose) game.addMessage(next === 1 ? 'The SBPD is onto you.' : 'Wanted level ' + next + '!');
  }

  function addWanted(n) {
    if (police.wanted >= 5) return;
    setWanted(police._game, police.wanted + n);
  }

  function addHeat(n) {
    police.heat += n;
    if (police.heat >= 1) {
      police.heat -= 1;
      if (police.wanted < 5) setWanted(police._game, police.wanted + 1);
    }
  }

  function stepCar(game, car, dt) {
    if (car.blocker) return;
    const player = game.player;
    const targetSpeed = WANTED[police.wanted].copSpeed;
    const tx = player.x + Math.cos(player.angle) * (player.car ? player.car.speed * 0.35 : 0);
    const ty = player.y + Math.sin(player.angle) * (player.car ? player.car.speed * 0.35 : 0);
    const desired = Math.atan2(ty - car.y, tx - car.x);
    const diff = wrapAngle(desired - car.angle);
    const turnRate = 2.7;
    car.angle += Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
    const want = Math.abs(diff) > 1.1 ? targetSpeed * 0.55 : targetSpeed;
    car.speed += Math.max(-320 * dt, Math.min(300 * dt, want - car.speed));
    const stepX = Math.cos(car.angle) * car.speed * dt;
    const stepY = Math.sin(car.angle) * car.speed * dt;
    const fx = car.x + Math.cos(car.angle) * 22 + stepX;
    const fy = car.y + Math.sin(car.angle) * 22 + stepY;
    if (game.city.blocked(fx, fy, CAR.radius)) {
      // A wall: swing away and slow down instead of grinding on it.
      car.angle += 1.4 * dt * 4;
      car.speed *= 0.6;
      car.stuckTimer += dt;
    } else {
      car.x += stepX;
      car.y += stepY;
      car.stuckTimer = 0;
    }
    if (car.stuckTimer > 2.5) {
      const p = game.city.nearestRoadPoint(player.x + 500, player.y - 400);
      if (p) {
        car.x = p.x;
        car.y = p.y;
        car.stuckTimer = 0;
      }
    }
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d > 1100) {
      const p = game.city.nearestRoadPoint(player.x + 500, player.y + 300);
      if (p) {
        car.x = p.x;
        car.y = p.y;
      }
    }
  }

  function stepCop(game, cop, dt) {
    if (cop.stagger > 0) {
      cop.stagger -= dt;
      return;
    }
    const player = game.player;
    const d = Math.hypot(player.x - cop.x, player.y - cop.y);
    if (d < 4) return;
    const a = Math.atan2(player.y - cop.y, player.x - cop.x);
    const nx = cop.x + Math.cos(a) * COP_FOOT_SPEED * dt;
    const ny = cop.y + Math.sin(a) * COP_FOOT_SPEED * dt;
    if (!game.city.blocked(nx, cop.y, 12)) cop.x = nx;
    if (!game.city.blocked(cop.x, ny, 12)) cop.y = ny;
    cop.angle = a;
  }

  function update(game, dt) {
    police._game = game;
    const player = game.player;
    // Match the number of pursuit cars to the wanted level.
    const chasers = police.cars.filter((c) => !c.blocker);
    const want = WANTED[police.wanted].cops;
    if (chasers.length < want) {
      for (let i = chasers.length; i < want; i += 1) spawnCar(game, player.x, player.y);
    } else if (chasers.length > want) {
      const extra = chasers[chasers.length - 1];
      police.cars.splice(police.cars.indexOf(extra), 1);
    }
    for (const car of police.cars) stepCar(game, car, dt);

    // Foot cops only matter while Rook is on foot.
    if (police.wanted > 0 && player.onFoot) {
      const wantCops = Math.min(2, police.wanted);
      while (police.cops.length < wantCops) {
        const a = game.rng.range(0, Math.PI * 2);
        let x = player.x + Math.cos(a) * 190;
        let y = player.y + Math.sin(a) * 190;
        if (game.city.blocked(x, y, 12)) {
          x = player.x + 150;
          y = player.y;
        }
        police.cops.push({ x, y, angle: a, stagger: 0 });
      }
      for (const cop of police.cops) stepCop(game, cop, dt);
      const nearest = police.cops.reduce((m, c) => Math.min(m, Math.hypot(c.x - player.x, c.y - player.y)), Infinity);
      if (nearest < ARREST_RANGE) {
        police.arrestTimer += dt;
        if (police.arrestTimer >= ARREST_HOLD) {
          police.arrestTimer = 0;
          game.onBusted('Caught by the SBPD');
          return;
        }
      } else {
        police.arrestTimer = Math.max(0, police.arrestTimer - dt * 2);
      }
    } else {
      police.cops.length = 0;
      police.arrestTimer = 0;
    }

    // Losing the heat: unseen for long enough, one star at a time.
    if (police.wanted > 0) {
      let visible = false;
      for (const car of police.cars) {
        if (Math.hypot(car.x - player.x, car.y - player.y) < VISIBILITY_RANGE) {
          visible = true;
          break;
        }
      }
      if (!visible) {
        for (const cop of police.cops) {
          if (Math.hypot(cop.x - player.x, cop.y - player.y) < 300) {
            visible = true;
            break;
          }
        }
      }
      if (visible) {
        police.hideTimer = 0;
        police.loseProgress = 0;
      } else {
        const loseSeconds = WANTED[police.wanted].loseSeconds;
        police.hideTimer += dt;
        police.loseProgress = Math.min(1, police.hideTimer / loseSeconds);
        if (police.hideTimer >= loseSeconds) {
          setWanted(game, police.wanted - 1);
          game.addMessage(police.wanted === 0 ? 'You lost them. Clean.' : 'Wanted down to ' + police.wanted + ' star' + (police.wanted === 1 ? '.' : 's.'));
        }
      }
    } else {
      police.hideTimer = 0;
      police.loseProgress = 0;
    }

    // Pay-and-spray: sit in the pink bay and the heat washes off for $50.
    police.sprayCooldown = Math.max(0, police.sprayCooldown - dt);
    const spray = game.city.points.spray;
    const inBay = !player.onFoot && Math.hypot(player.car.x - spray.x, player.car.y - spray.y) < 78;
    if (inBay && Math.abs(player.car.speed) < 60 && police.sprayCooldown <= 0) {
      police.sprayTimer += dt;
      if (police.sprayTimer > 0.8) {
        police.sprayTimer = 0;
        police.sprayCooldown = 2;
        if (game.cash >= PRICES.spray && (police.wanted > 0 || player.car.health < CAR.health)) {
          game.cash -= PRICES.spray;
          setWanted(game, 0);
          player.car.health = CAR.health;
          game.addMessage('Resprayed: clean car, clean record. -$' + PRICES.spray);
          game.audio.spray();
        } else if (game.cash < PRICES.spray) {
          game.addMessage('Respray costs $' + PRICES.spray + ' — you are short.');
        }
      }
    } else {
      police.sprayTimer = 0;
    }

    game.audio.siren(police.wanted > 0 && police.cars.length > 0);
  }

  // One object, methods attached: the caller reads wanted/cars/cops off the same
  // object the update loop mutates, so the HUD never sees a stale copy.
  police.setWanted = setWanted;
  police.addWanted = addWanted;
  police.addHeat = addHeat;
  police.update = update;
  return police;
}

// The job board: six main jobs from Vince Kroll, in order, plus two repeatable side
// gigs. Every job has a briefing, a HUD objective, a waypoint, a clock or a condition,
// and a cash reward. Side gigs never block the main line.
import { REWARDS, CAR } from './config.js';

const MAIN_DEFS = [
  {
    key: 'm1', name: 'First Job', giver: 'Vince Kroll', reward: REWARDS.m1,
    brief: 'A package for the Marina. Drive it to the marked point before the clock runs out. No questions, no stops.',
    objective: 'Deliver the package to the Marina',
    fail: 'The package never arrived.',
  },
  {
    key: 'm2', name: 'Lobos Lesson', giver: 'Vince Kroll', reward: REWARDS.m2,
    brief: 'Los Lobos think the Strip is theirs. Ram their black car three times and remind them who drives this town.',
    objective: 'Ram the black Lobos car 3 times',
    fail: 'The Lobos car got away.',
  },
  {
    key: 'm3', name: 'Lose the Cops', giver: 'Vince Kroll', reward: REWARDS.m3,
    brief: 'Three stars, two cruisers, one Rook. Break line of sight and stay hidden until the heat dies to zero.',
    objective: 'Lose the cops — break line of sight',
    fail: 'The SBPD caught you.',
  },
  {
    key: 'm4', name: 'Dock Pickup', giver: 'Vince Kroll', reward: REWARDS.m4,
    brief: 'Pick up a friend at the Docks and drive them to the Old Town safehouse. Lobos will try to stop you. Keep the car alive.',
    objective: 'Pick up the passenger at the Docks',
    fail: 'The pickup fell through.',
  },
  {
    key: 'm5', name: 'The Villa Car', giver: 'Vince Kroll', reward: REWARDS.m5,
    brief: 'A gold coupe sits outside a Hills villa. Walk up, take it — the alarm will scream — and bring it to the Docks garage in one piece.',
    objective: 'Steal the gold car at the Hills villa',
    fail: 'The gold car was wrecked.',
  },
  {
    key: 'm6', name: 'The Big Goodbye', giver: 'Vince Kroll', reward: REWARDS.m6,
    brief: 'Last job. Grab the cash box on the Strip, lose a four-star tail, then run for the yacht at the Marina. Do this and the debt is done.',
    objective: 'Grab the cash box on the Strip',
    fail: 'The last job fell apart.',
  },
];

const SIDE_DEFS = [
  {
    key: 'taxi', name: 'Cab Fare', giver: 'Dispatch', reward: REWARDS.taxi,
    brief: 'A fare is waiting on the Strip. Pick them up, then drive them where the marker says. Quick feet, quick fare.',
    objective: 'Pick up the fare',
    fail: 'The fare walked away.',
  },
  {
    key: 'medic', name: 'Urgent Call', giver: 'Dispatch', reward: REWARDS.medic,
    brief: 'Someone needs a fast car, fast. Get to the marked point before the clock runs out. No time to explain.',
    objective: 'Reach the call for help',
    fail: 'You were too late.',
  },
];

function randomRoadPoint(game) {
  const x = game.rng.range(420, 2300);
  const y = game.rng.range(140, 1660);
  return game.city.nearestRoadPoint(x, y);
}

export function createMissions() {
  const missions = {
    unlocked: 0,
    completed: [],
    active: null,
    sideCooldown: { taxi: 0, medic: 0 },
  };

  function findDef(key) {
    return MAIN_DEFS.concat(SIDE_DEFS).find((d) => d.key === key);
  }

  function cleanupSpecial(game) {
    const t = game.traffic.special;
    for (let i = t.length - 1; i >= 0; i -= 1) {
      if (t[i].missionCar) t.splice(i, 1);
    }
    const p = game.traffic.parked;
    for (let i = p.length - 1; i >= 0; i -= 1) {
      if (p[i].isLuxury) p.splice(i, 1);
    }
  }

  function startMain(index, game) {
    const def = MAIN_DEFS[index];
    if (!def) return null;
    cleanupSpecial(game);
    const active = { def, stage: 0, timer: 0, hits: 0, dwell: 0, ramCooldown: 0, data: {} };
    if (def.key === 'm1') {
      active.timer = 100;
      active.data.target = game.city.points.marinaDrop;
    } else if (def.key === 'm2') {
      active.timer = 150;
      const lobos = {
        x: 1000, y: 930, angle: 0, speed: 0, color: '#191919', kind: 'lobos',
        health: 1000, missionCar: true, noSteal: true, cruise: 250,
      };
      game.traffic.special.push(lobos);
      active.data.lobos = lobos;
    } else if (def.key === 'm3') {
      active.timer = 150;
      game.police.setWanted(game, 3);
    } else if (def.key === 'm4') {
      active.timer = 150;
      active.data.pickup = game.city.points.docksPickup;
      const hunter = {
        x: 1700, y: 1230, angle: Math.PI, speed: 0, color: '#191919', kind: 'lobos',
        health: 1000, missionCar: true, noSteal: true, cruise: 300,
      };
      game.traffic.special.push(hunter);
      active.data.hunter = hunter;
    } else if (def.key === 'm5') {
      active.timer = 180;
      const villa = game.city.points.hillsVilla;
      const gold = game.traffic.addParked(villa.x, villa.y, -Math.PI / 2, '#d8a83c');
      gold.isLuxury = true;
      active.data.gold = gold;
    } else if (def.key === 'm6') {
      active.timer = 150;
      active.data.cashPoint = game.city.points.stripCash;
    }
    missions.active = active;
    return active;
  }

  function startSide(key, game) {
    const def = findDef(key);
    if (!def || missions.active) return null;
    cleanupSpecial(game);
    const active = { def, stage: 0, timer: 0, hits: 0, dwell: 0, ramCooldown: 0, data: {} };
    if (key === 'taxi') {
      active.timer = 110;
      active.data.pickup = randomRoadPoint(game);
      active.data.dest = randomRoadPoint(game);
    } else if (key === 'medic') {
      active.timer = 45;
      active.data.help = randomRoadPoint(game);
    }
    missions.active = active;
    return active;
  }

  function complete(game, def) {
    cleanupSpecial(game);
    if (MAIN_DEFS.some((d) => d.key === def.key)) {
      const idx = MAIN_DEFS.findIndex((d) => d.key === def.key);
      missions.unlocked = Math.max(missions.unlocked, idx + 1);
      if (!missions.completed.includes(def.key)) missions.completed.push(def.key);
    } else {
      missions.sideCooldown[def.key] = 30;
    }
    missions.active = null;
    game.onMissionComplete(def);
  }

  function fail(game, reason) {
    const def = missions.active ? missions.active.def : null;
    cleanupSpecial(game);
    missions.active = null;
    if (def) game.onMissionFailed(def, reason);
  }

  function dwellNear(game, dt, target, radius, need) {
    const player = game.player;
    const speed = player.car ? Math.abs(player.car.speed) : 0;
    const d = Math.hypot(player.x - target.x, player.y - target.y);
    const active = missions.active;
    if (d < radius && speed < 60) {
      active.dwell += dt;
      return active.dwell >= need;
    }
    active.dwell = Math.max(0, active.dwell - dt);
    return false;
  }

  function driveCar(game, car, tx, ty, speed, dt) {
    const desired = Math.atan2(ty - car.y, tx - car.x);
    let diff = desired - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff));
    car.speed += Math.max(-300 * dt, Math.min(280 * dt, speed - car.speed));
    const fx = car.x + Math.cos(car.angle) * 24;
    const fy = car.y + Math.sin(car.angle) * 24;
    if (game.city.blocked(fx, fy, 15)) {
      car.angle += 1.6 * dt * 3;
      car.speed *= 0.7;
      return;
    }
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
  }

  function update(game, dt) {
    for (const key of Object.keys(missions.sideCooldown)) {
      missions.sideCooldown[key] = Math.max(0, missions.sideCooldown[key] - dt);
    }
    const active = missions.active;
    if (!active) return;
    active.ramCooldown = Math.max(0, active.ramCooldown - dt);
    active.timer -= dt;
    if (active.timer <= 0) {
      fail(game, active.def.fail + ' (time ran out)');
      return;
    }
    const key = active.def.key;
    const player = game.player;
    if (key === 'm1') {
      const t = active.data.target;
      if (Math.hypot(player.x - t.x, player.y - t.y) < 55) complete(game, active.def);
    } else if (key === 'm2') {
      const lobos = active.data.lobos;
      if (lobos) {
        // Flee: aim away from the player, down the road.
        const away = Math.atan2(lobos.y - player.y, lobos.x - player.x);
        driveCar(game, lobos, lobos.x + Math.cos(away) * 300, lobos.y + Math.sin(away) * 300, 250, dt);
      }
    } else if (key === 'm3') {
      if (game.police.wanted === 0) complete(game, active.def);
    } else if (key === 'm4') {
      const hunter = active.data.hunter;
      if (hunter) driveCar(game, hunter, player.x, player.y, 300, dt);
      if (active.stage === 0) {
        if (dwellNear(game, dt, active.data.pickup, 48, 1.5)) {
          active.stage = 1;
          active.timer = 120;
          game.addMessage('Passenger aboard — get them to the safehouse!');
          game.audio.pickup();
        }
      } else if (Math.hypot(player.x - game.city.points.safehouse.x, player.y - game.city.points.safehouse.y) < 55) {
        complete(game, active.def);
      }
    } else if (key === 'm5') {
      if (active.stage === 0) {
        // Waiting for the steal; the event moves it to stage 1.
      } else if (Math.hypot(player.x - game.city.points.garage.x, player.y - game.city.points.garage.y) < 60) {
        complete(game, active.def);
      }
      if (active.stage === 1 && player.car === active.data.gold && player.car.health <= 0) {
        fail(game, active.def.fail);
      }
    } else if (key === 'm6') {
      if (active.stage === 0) {
        if (dwellNear(game, dt, active.data.cashPoint, 48, 1.5)) {
          active.stage = 1;
          active.timer = 150;
          game.police.setWanted(game, 4);
          game.addMessage('Cash grabbed — now lose a four-star tail!');
        }
      } else if (active.stage === 1) {
        if (game.police.wanted === 0) {
          active.stage = 2;
          active.timer = 120;
          game.addMessage('Tail lost — run for the yacht at the Marina!');
        }
      } else if (Math.hypot(player.x - game.city.points.yacht.x, player.y - game.city.points.yacht.y) < 60) {
        complete(game, active.def);
      }
    } else if (key === 'taxi') {
      if (active.stage === 0) {
        if (dwellNear(game, dt, active.data.pickup, 48, 1.5)) {
          active.stage = 1;
          active.timer = 100;
          game.addMessage('Fare aboard — drive to the marker.');
          game.audio.pickup();
        }
      } else if (Math.hypot(player.x - active.data.dest.x, player.y - active.data.dest.y) < 55) {
        complete(game, active.def);
      }
    } else if (key === 'medic') {
      if (Math.hypot(player.x - active.data.help.x, player.y - active.data.help.y) < 50) {
        complete(game, active.def);
      }
    }
  }

  function onEvent(type, game, data) {
    const active = missions.active;
    if (!active) return;
    if (type === 'ram' && active.def.key === 'm2' && data && data.kind === 'lobos' && active.ramCooldown <= 0) {
      active.ramCooldown = 1;
      active.hits += 1;
      game.addMessage('Hit ' + active.hits + ' of 3 on the Lobos car!');
      game.audio.thud();
      if (active.hits >= 3) complete(game, active.def);
    } else if (type === 'luxuryStolen' && active.def.key === 'm5' && active.stage === 0) {
      active.stage = 1;
      active.timer = 180;
      game.addMessage('Drive the gold car to the Docks garage!');
    }
  }

  function objectiveText() {
    const active = missions.active;
    if (!active) return '';
    const key = active.def.key;
    if (key === 'm4' && active.stage === 1) return 'Drive the passenger to the Old Town safehouse';
    if (key === 'm5' && active.stage === 1) return 'Drive the gold car to the Docks garage';
    if (key === 'm6' && active.stage === 1) return 'Lose the 4-star tail';
    if (key === 'm6' && active.stage === 2) return 'Run for the yacht at the Marina';
    if (key === 'taxi' && active.stage === 1) return 'Drive the fare to the destination';
    return active.def.objective;
  }

  function waypoint(game) {
    const active = missions.active;
    if (!active) return null;
    const key = active.def.key;
    const city = game.city;
    if (key === 'm1') return { x: active.data.target.x, y: active.data.target.y };
    if (key === 'm2' && active.data.lobos) return { x: active.data.lobos.x, y: active.data.lobos.y };
    if (key === 'm3') return null;
    if (key === 'm4') return active.stage === 0 ? active.data.pickup : city.points.safehouse;
    if (key === 'm5') return active.stage === 0 ? city.points.hillsVilla : city.points.garage;
    if (key === 'm6') {
      if (active.stage === 0) return active.data.cashPoint;
      if (active.stage === 1) return null;
      return city.points.yacht;
    }
    if (key === 'taxi') return active.stage === 0 ? active.data.pickup : active.data.dest;
    if (key === 'medic') return active.data.help;
    return null;
  }

  function progress(game) {
    const active = missions.active;
    if (!active) return null;
    if (active.def.key === 'm3') return { label: 'Heat', value: 1 - game.police.wanted / 3 };
    if (active.def.key === 'm2') return { label: 'Hits', value: active.hits / 3 };
    return null;
  }

  function canStartMain(game) {
    if (missions.active || missions.unlocked >= MAIN_DEFS.length) return null;
    const bar = game.city.points.bar;
    if (Math.hypot(game.player.x - bar.x, game.player.y - bar.y) < 100) return missions.unlocked;
    return null;
  }

  function nearSide(game) {
    if (missions.active) return null;
    const player = game.player;
    if (missions.sideCooldown.taxi <= 0 && Math.hypot(player.x - game.city.points.taxiStand.x, player.y - game.city.points.taxiStand.y) < 80) return 'taxi';
    if (missions.sideCooldown.medic <= 0 && Math.hypot(player.x - game.city.points.medicPoint.x, player.y - game.city.points.medicPoint.y) < 80) return 'medic';
    return null;
  }

  // One object, methods attached: the caller reads active/unlocked off the same
  // object the update loop mutates, so the HUD never sees a stale copy.
  missions.MAIN_DEFS = MAIN_DEFS;
  missions.SIDE_DEFS = SIDE_DEFS;
  missions.startMain = startMain;
  missions.startSide = startSide;
  missions.update = update;
  missions.onEvent = onEvent;
  missions.objectiveText = objectiveText;
  missions.waypoint = waypoint;
  missions.progress = progress;
  missions.canStartMain = canStartMain;
  missions.nearSide = nearSide;
  missions.findDef = findDef;
  return missions;
}

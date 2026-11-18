# Solara Bay — an open-world crime game in a desktop browser

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/qs8579904/solara-bay/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/qs8579904/solara-bay/reward.svg)](https://make.fun/bounty/gta6-01)

Solara Bay is a 2D top-down open-world crime game: a sunny coastal city
you explore on foot and by car, stealing cars, losing the cops and running
jobs to pay off a debt. An entry for the
[Make GTA 6 bounty](https://make.fun/bounty/gta6-01) on make.fun.

Mara "Rook" Delgado, a former getaway driver, owes the fixer Vince Kroll
for her brother's garage. She works it off one job at a time while the
Solara Bay Police Department watches every street — and while the Los
Lobos crew works the same streets for themselves.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network request, no third-party library: everything is
plain static files under `game/`, drawn on one canvas with system fonts.

- **Move** WASD / arrow keys · **Run** Shift · **Steal a car** E ·
  **Punch** J · **Handbrake** Space · **Pause** P · **Start / retry** Enter
- On foot, walk up to a parked car and press E to take it. A car with a
  driver in it sets off the alarm — and a wanted star with it.
- Crime raises your wanted level, 1 to 5 stars. More stars mean more SBPD
  units, faster police cars and foot officers who will grab you on the
  street. Get out of sight for a while and a star drops off; drive through
  the spray shop to repair the car and wipe the record, for a fee.
- Get busted and the SBPD takes its cut — you wake up at the station door.
- Jobs pay cash. This round ships the first two: a timed delivery to the
  Marina, then ramming a Lobos sedan until it stops. Cash, unlocked jobs
  and your best haul are saved in the browser between visits.

## What is inside

A complete little city, all original: five districts (Marina, Old Town,
The Hills, The Strip, Docks) plus South Beach, a road grid with traffic
and pedestrians, police AI that hunts along the roads, a HUD with cash,
wanted stars, speed, a minimap and mission objectives, skid marks, crash
debris and flashing light bars. The world is seeded, so `?seed=N` always
builds the same city, and `?shot=cover|drive|mission|foot` stages the four
screenshot scenes from the real rules.

`game/src/` is one file per job: `config.js` (tuning and palette),
`random.js` (seeded numbers), `city.js` (map and collision), `traffic.js`
(cars and pedestrians), `player.js` (walking, driving, stealing),
`police.js` (wanted level and pursuit), `missions.js` (the job list),
`combat.js` (fists and crashes), `render.js` (canvas and HUD),
`input.js` (keys), `shots.js` (screenshot scenes), `state.js` (the world
and its fixed-step update) and `main.js` (boot, screens, save).

## License

MIT — see [LICENSE](LICENSE).

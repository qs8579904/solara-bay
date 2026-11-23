# Solara Bay

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/qs8579904/solara-bay/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/qs8579904/solara-bay/reward.svg)](https://make.fun/bounty/gta6-01)

v2 — six main jobs, two repeatable side gigs, synthesized WebAudio sound, and fixed seawater collision.

A sunny 2D top-down open-world getaway game, built for the
[make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01). You are Mara "Rook"
Delgado, a former getaway driver in the fictional seaside city of Solara Bay.
Your brother's garage owes money to Vince Kroll, a fixer who runs a bar in the
Marina — so you take his jobs, one at a time, until the debt is paid.

## How to play

Open `game/index.html` in a desktop browser. No build step, no network, no
libraries — plain Canvas and WebAudio, all hand-written.

- **WASD / arrows** — walk and drive. **Shift** runs on foot.
- **E** — steal a car (or get out of one). Stealing a car with its driver
  watching, or a marked car with an alarm, raises your wanted level.
- **Space** — handbrake. **J** — punch. **T** — take a job at the bar or a
  side gig at a marker. **P** — pause. **M** — mute.
- **Wanted 1–5 stars** — the SBPD sends cruisers and foot cops. Break line of
  sight to cool off, or pay $50 at the pink Pay & Spray bay to wash the heat.
- **Jobs** — six main jobs for Vince (deliver, ram the Lobos car, lose a
  three-star tail, dock pickup, steal the gold villa car, the final escape) plus
  two repeatable side gigs (cab fare, urgent call). Each has a briefing, a HUD
  objective, a waypoint and a cash reward.
- **Save** — cash, unlocked jobs and mute setting persist in localStorage.

## Tech

- 2D Canvas, fixed 1/60 s steps, seeded random (`?seed=N` fixes the city).
- `?shot=cover|drive|mission|foot` stages the four screenshots from the real
  rules, so the same seed always gives the same frame.
- Sound is 100% synthesized WebAudio: engine hum, two-tone siren, pickup and
  crash blips, win/lose melodies and a quiet bass loop. No audio files.
- Source is split by job: `config`, `random`, `city`, `traffic`, `player`,
  `police`, `missions`, `combat`, `audio`, `render`, `input`, `shots`, `main`.

## License

MIT — see [LICENSE](LICENSE).

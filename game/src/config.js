// Solara Bay — every tuning number and colour in one place, so balancing is a
// one-file job and no other module hard-codes a speed, a price or a palette.
// The world is a fixed 2400x1800 logical map; the camera shows a 1280x800
// window of it. All distances are in world units, all speeds in units/second.
export const STEP = 1 / 60;
export const VIEW = { width: 1280, height: 800 };
export const WORLD = { width: 2400, height: 1800 };
export const SAVE_KEY = 'solara-bay.save.v1';

// The sea is the west edge of the map; the beach is the strip just east of it.
export const WATER = { x0: 0, x1: 150 };
export const BEACH = { x0: 150, x1: 260 };

// Road centrelines. Roads are straight grid lines; intersections are where the
// traffic turns and where the police cut corners to reach the player.
export const ROADS_V = [350, 700, 1050, 1400, 1750, 2100];
export const ROADS_H = [300, 650, 1000, 1350, 1650];
export const ROAD_W = 84;

// Five districts plus the south beach, each with its own ground tint. The
// rectangles tile the land east of the beach; districtAt falls back to the
// nearest one for points on a road.
export const DISTRICTS = [
  { name: 'Marina', short: 'MARINA', x: 260, y: 0, w: 640, h: 700, ground: '#e7ddba', block: '#f4eeda', accent: '#2e8fa3' },
  { name: 'Old Town', short: 'OLD TOWN', x: 900, y: 0, w: 700, h: 700, ground: '#ddb98f', block: '#e8cba6', accent: '#a4552e' },
  { name: 'The Hills', short: 'THE HILLS', x: 1600, y: 0, w: 800, h: 700, ground: '#a9c47e', block: '#c2d69a', accent: '#4d7a3a' },
  { name: 'The Strip', short: 'THE STRIP', x: 260, y: 700, w: 1340, h: 700, ground: '#c7c7d4', block: '#dcdce8', accent: '#d6409e' },
  { name: 'Docks', short: 'DOCKS', x: 1600, y: 700, w: 800, h: 700, ground: '#b3aa97', block: '#c9c0ab', accent: '#6e6250' },
  { name: 'South Beach', short: 'SOUTH BEACH', x: 260, y: 1400, w: 2140, h: 400, ground: '#ecd9a4', block: '#f4e6bd', accent: '#2e8fa3' },
];

// On foot: walk, run with Shift, punch reach and cooldown.
export const PLAYER = {
  walk: 175,
  run: 285,
  radius: 14,
  punchRange: 54,
  punchArc: 1.2,
  punchCd: 0.45,
};

// A car is a 46x22 body. Arcade handling: strong accel, a reverse gear, a
// handbrake that trades grip for turn. Durability 100; at 0 the car is a wreck.
export const CAR = {
  accel: 540,
  brake: 720,
  reverseMax: 170,
  maxSpeed: 470,
  turn: 2.7,
  handbrakeTurn: 4.4,
  handbrakeDecel: 640,
  length: 46,
  width: 22,
  durability: 160,
};

// Ambient life: how many cars and pedestrians share the roads, and how fast.
export const TRAFFIC = {
  carCount: 14,
  pedCount: 18,
  parkedCount: 8,
  carSpeed: [120, 200],
  pedSpeed: [42, 72],
};

// Wanted level: index by stars 0-5. Police cars on the map, their top speed,
// foot officers' chase speed, the catch radius on foot, how far a cop can see,
// and how long out of sight before a star drops off.
export const POLICE = {
  byStars: [0, 1, 2, 3, 3, 4],
  footByStars: [0, 1, 1, 2, 2, 2],
  carSpeed: 475,
  footSpeed: 208,
  catchRadius: 44,
  sight: 520,
  decaySeconds: 8,
  ramDamage: 5,
  ramCooldown: 1.0,
};
export const WANTED_MAX = 5;

// The spray shop: drive into the ring to repair and clear wanted, for a fee.
export const SPRAY = { x: 1750, y: 1120, r: 95, cost: 50 };
// Where a busted player wakes up, on foot, and where the story starts.
export const STATION = { x: 1050, y: 300 };
export const SPAWN = { x: 700, y: 1000 };
// Vince Kroll's bar, a landmark in the Marina; the first job starts there.
export const VINCE = { x: 470, y: 470 };

// Mission 0: a timed delivery to the Marina drop-off.
export const MISSION0 = {
  target: { x: 350, y: 300 },
  time: 90,
  reward: 300,
  radius: 30,
};
// Mission 1: ram the black Lobos sedan until it stops.
export const MISSION1 = {
  reward: 400,
  targetHealth: 60,
  hitDamage: 20,
  hitCooldown: 1.0,
  loopSpeed: 250,
  loop: [
    { x: 700, y: 1000 },
    { x: 1400, y: 1000 },
    { x: 1400, y: 650 },
    { x: 700, y: 650 },
  ],
};

// Cash lying on the pavement: how many at once, what each is worth, respawn.
export const PICKUPS = { max: 6, amounts: [25, 25, 40, 40, 50, 50], respawn: 18 };

export const PALETTE = {
  water: '#3fa8c4',
  waterDeep: '#2e8fa3',
  sand: '#ecd9a4',
  road: '#33363f',
  roadEdge: '#4a4e5a',
  dash: '#e8e8e8',
  sidewalk: '#b9b3a4',
  park: '#8fbf6a',
  player: '#e5383b',
  playerCar: '#e5383b',
  police: '#20242e',
  policeLightR: '#ff2d2d',
  policeLightB: '#2d7dff',
  pedSkin: '#e8b98a',
  text: '#f4f6f8',
  textDark: '#20242e',
  muted: '#9aa0ad',
  panel: 'rgba(18, 20, 28, 0.82)',
  star: '#ffd23e',
  starEmpty: 'rgba(244, 246, 248, 0.35)',
  waypoint: '#ffd23e',
  spray: '#2d7dff',
  cash: '#37c978',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

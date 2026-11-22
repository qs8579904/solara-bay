// Solara Bay v2 — all tuning numbers and the palette in one place.
// A sunny fictional seaside city: warm sand, turquoise water, palm-lined roads.
// Nothing here is loaded from the network; every colour and constant is local.
export const STEP = 1 / 60;
export const WORLD_W = 2400;
export const WORLD_H = 1800;
export const SAVE_KEY = 'solara-bay-save-v1';

export const COLORS = {
  grass: '#79c25a',
  grassHills: '#5da84a',
  grassDocks: '#8a8f7a',
  sand: '#e9d29b',
  sandWet: '#dcc489',
  water: '#37a8cc',
  waterDeep: '#227fa8',
  road: '#3d4048',
  roadEdge: '#2c2e35',
  sidewalk: '#b7b0a0',
  dash: '#f2d06b',
  buildingRoof: '#c96f4a',
  buildingRoof2: '#e0a458',
  buildingRoof3: '#7d8ba0',
  buildingRoof4: '#a8546e',
  buildingWall: '#efe6d4',
  palmTrunk: '#8a6b48',
  palmLeaf: '#3f9e4d',
  playerJacket: '#d63a2f',
  playerSkin: '#e8b98a',
  playerHair: '#2b2118',
  copBlue: '#22375e',
  copWhite: '#f2f2f2',
  lobosBlack: '#191919',
  taxiYellow: '#f2c230',
  luxuryGold: '#d8a83c',
  sprayPink: '#e86a9a',
  hudPanel: 'rgba(12, 18, 28, 0.72)',
  hudText: '#ffffff',
  hudGold: '#ffd94a',
  waypoint: '#ffcf3d',
  danger: '#ff4d3d',
};

// Player on foot.
export const FOOT = {
  walkSpeed: 150,
  runSpeed: 265,
  radius: 13,
  health: 100,
  punchRange: 42,
  punchDamage: 34,
  punchCooldown: 0.45,
  stealRange: 52,
};

// Cars: arcade handling, top-down.
export const CAR = {
  accel: 420,
  maxSpeed: 430,
  maxReverse: 150,
  brake: 620,
  turnRate: 2.9,
  grip: 6.5,
  handbrakeTurn: 4.6,
  handbrakeDrag: 1.6,
  radius: 15,
  health: 100,
  crashDamageAt: 260,
};

// Wanted level: index 0 is clean, 1..5 are the stars.
export const WANTED = [
  { cops: 0, copSpeed: 0, loseSeconds: 0 },
  { cops: 1, copSpeed: 300, loseSeconds: 7 },
  { cops: 2, copSpeed: 330, loseSeconds: 9 },
  { cops: 3, copSpeed: 360, loseSeconds: 11 },
  { cops: 4, copSpeed: 395, loseSeconds: 13 },
  { cops: 5, copSpeed: 430, loseSeconds: 16 },
];
export const COP_FOOT_SPEED = 175;
export const ARREST_RANGE = 30;
export const ARREST_HOLD = 0.9;
export const VISIBILITY_RANGE = 520;

export const PRICES = {
  spray: 50,
  arrestFine: 200,
  arrestFineRate: 0.15,
};

export const MONEY = {
  startCash: 120,
  pickupMin: 10,
  pickupMax: 25,
};

// Mission rewards, in dollars.
export const REWARDS = {
  m1: 300,
  m2: 400,
  m3: 500,
  m4: 600,
  m5: 700,
  m6: 1000,
  taxi: 150,
  medic: 150,
};

export const TRAFFIC_CARS = 14;
export const PEDESTRIANS = 26;
export const PARKED_CARS = 9;
export const PICKUPS = 10;

export const MINIMAP_W = 224;
export const MINIMAP_H = 168;

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

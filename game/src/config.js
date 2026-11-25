// Dapur Kilat — every tuning number, recipe and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it
// to the window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** One full shift (a day) lasts this long, in seconds. */
export const SHIFT_SECONDS = 150;
/** The last seconds of the shift are the rush: orders arrive faster. */
export const RUSH_SECONDS = 40;

export const CHEF = {
  radius: 22,
  speed: 360,
  carryOffsetY: -30,
};

export const HEARTS = 3;

/** Ingredients: id, display name, emoji-free draw key, where it comes from. */
export const INGREDIENTS = {
  rice: { name: 'Nasi', color: '#f5efe0', chop: false, cook: true, cookSeconds: 5 },
  noodle: { name: 'Mie', color: '#f2c94c', chop: false, cook: true, cookSeconds: 4 },
  egg: { name: 'Telur', color: '#fff3c4', chop: false, cook: true, cookSeconds: 3 },
  chicken: { name: 'Ayam', color: '#e8a06a', chop: false, cook: true, cookSeconds: 6 },
  veg: { name: 'Sayur', color: '#6fbf5a', chop: true, cook: false, chopSeconds: 1.4 },
  chili: { name: 'Cabai', color: '#e5534b', chop: true, cook: false, chopSeconds: 1.0 },
};

/** A processed ingredient is named "<id>:chopped" or "<id>:cooked". */
export function processedName(id, kind) {
  return `${id}:${kind}`;
}

/** Recipes: the three dishes on the menu, plus the chef's special. */
export const RECIPES = [
  {
    id: 'nasi-goreng',
    name: 'Nasi Goreng',
    price: 18,
    needs: ['rice:cooked', 'egg:cooked', 'chili:chopped'],
    color: '#e8a33d',
  },
  {
    id: 'mie-goreng',
    name: 'Mie Goreng',
    price: 16,
    needs: ['noodle:cooked', 'veg:chopped', 'egg:cooked'],
    color: '#f2c94c',
  },
  {
    id: 'sate-ayam',
    name: 'Sate Ayam',
    price: 20,
    needs: ['chicken:cooked', 'chili:chopped', 'veg:chopped'],
    color: '#e8a06a',
  },
  {
    id: 'nasi-spesial',
    name: 'Nasi Spesial',
    price: 26,
    needs: ['rice:cooked', 'chicken:cooked', 'veg:chopped'],
    color: '#d97b4f',
  },
];

export function recipeById(id) {
  return RECIPES.find((r) => r.id === id);
}

/** Stations. x/y/w/h are the counter rectangles; walk is the interact spot. */
export const STATIONS = {
  pantry: { kind: 'pantry', x: 24, y: 150, w: 132, h: 340, label: 'PANTRY' },
  chop: { kind: 'chop', x: 280, y: 300, w: 168, h: 96, label: 'TALENAN' },
  stoveA: { kind: 'stove', x: 480, y: 150, w: 128, h: 88, label: 'KOMPOR' },
  stoveB: { kind: 'stove', x: 640, y: 150, w: 128, h: 88, label: 'KOMPOR' },
  plate: { kind: 'plate', x: 480, y: 400, w: 288, h: 92, label: 'PIRING SAJI' },
  serve: { kind: 'serve', x: 1104, y: 196, w: 152, h: 220, label: 'JENDELA SAJI' },
  trash: { kind: 'trash', x: 1104, y: 560, w: 96, h: 80, label: 'SAMPAH' },
};

/** Pantry crates: one column of six, one ingredient per row, so the chef
 *  standing right of the pantry always reaches the row they face. */
export const PANTRY_CRATES = [
  { id: 'rice', x: 36, y: 158 },
  { id: 'noodle', x: 36, y: 214 },
  { id: 'egg', x: 36, y: 270 },
  { id: 'chicken', x: 36, y: 326 },
  { id: 'veg', x: 36, y: 382 },
  { id: 'chili', x: 36, y: 438 },
];
export const CRATE = { w: 100, h: 48 };

/** Order pacing. Patience shrinks as the shift goes on. */
export const ORDERS = {
  maxActive: 4,
  firstDelay: 2,
  interval: 18,
  rushInterval: 12,
  patience: 70,
  rushPatience: 55,
  tipMax: 10,
  /** Seconds a finished serve keeps the combo chain alive. */
  comboWindow: 20,
  /** A cooked dish left on the stove burns after this many seconds. */
  burnAfter: 9,
};

export const PALETTE = {
  floor: '#3d2b1f',
  floorTile: '#463322',
  wall: '#2b1d12',
  counterTop: '#8a5a33',
  counterSide: '#6b4423',
  steel: '#b9c4cc',
  steelDark: '#7d8b96',
  board: '#2e2118',
  boardEdge: '#6b4423',
  orderBg: '#241812',
  orderCard: '#f7ead2',
  orderCardDark: '#e8d5ae',
  text: '#f7ead2',
  darkText: '#2b1d12',
  muted: '#c9a06a',
  accent: '#ffb347',
  danger: '#e5534b',
  ok: '#6fbf5a',
  timer: '#ffd166',
  chefShirt: '#f4f1ea',
  chefHat: '#ffffff',
  chefSkin: '#e8b98a',
  chefPants: '#3a5a8c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best shift is kept between visits (this browser only). */
export const BEST_KEY = 'dapur-kilat.best';

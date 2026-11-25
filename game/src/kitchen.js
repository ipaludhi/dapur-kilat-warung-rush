// Kitchen: the world state. Pure logic, no DOM and no canvas — the Node
// logic test drives this file directly, and the renderer only reads it.
// One rule shapes everything here: no one-way state may block the win.
// A burnt dish can be trashed, a wrong plate slot can be taken back, and a
// stove never eats an ingredient the player cannot recover.
import {
  CHEF, FIELD, HEARTS, INGREDIENTS, ORDERS, PANTRY_CRATES, CRATE,
  RECIPES, SHIFT_SECONDS, STATIONS,
} from './config.js';
import {
  createOrderBoard, resetOrderBoard, serveOrder, updateOrderBoard,
} from './orders.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_DAY = 'day';
export const SCREEN_OVER = 'over';

export const EVENT_SERVED = 1;
export const EVENT_EXPIRED = 2;
export const EVENT_DAY = 4;
export const EVENT_OVER = 8;

const FLOOR = { x: 16, y: 108, w: FIELD.width - 32, h: FIELD.height - 116 };

export function createWorld(random) {
  const world = {
    random,
    screen: SCREEN_TITLE,
    elapsed: 0,
    hearts: HEARTS,
    best: 0,
    chef: { x: 640, y: 540, dx: 0, dy: -1, moving: false },
    carrying: null,
    chop: { itemId: null, progress: 0, needed: 0 },
    stoves: { stoveA: { item: null }, stoveB: { item: null } },
    plate: { slots: [], dish: null },
    board: createOrderBoard(random),
    particles: [],
    floaters: [],
    events: [],
    sizzle: false,
    muted: false,
  };
  return world;
}

export function resetWorld(world) {
  world.screen = SCREEN_PLAY;
  world.elapsed = 0;
  world.hearts = HEARTS;
  world.chef = { x: 640, y: 540, dx: 0, dy: -1, moving: false };
  world.carrying = null;
  world.chop = { itemId: null, progress: 0, needed: 0 };
  world.stoves = { stoveA: { item: null }, stoveB: { item: null } };
  world.plate = { slots: [], dish: null };
  world.particles = [];
  world.floaters = [];
  world.events = [];
  resetOrderBoard(world.board);
}

/** Name of a processed ingredient, e.g. "rice:cooked". */
export function processedId(item) {
  return `${item.id}:${item.state}`;
}

function pushEvent(world, type, data) {
  world.events.push({ type, ...data });
}

export function addFloater(world, x, y, text, color) {
  world.floaters.push({ x, y, text, color, life: 1.2 });
}

export function burst(world, x, y, color, n) {
  for (let i = 0; i < n; i += 1) {
    const a = world.random.next() * Math.PI * 2;
    const speed = 40 + world.random.next() * 90;
    world.particles.push({
      x, y,
      vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 40,
      life: 0.5 + world.random.next() * 0.4, max: 0.9, color,
    });
  }
}

/** Distance from a point to a rectangle (0 when inside). */
export function distToRect(x, y, rect) {
  const cx = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const cy = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  return Math.hypot(x - cx, y - cy);
}

export function nearestStation(world) {
  let best = null;
  let bestDist = 96;
  for (const [key, station] of Object.entries(STATIONS)) {
    const d = distToRect(world.chef.x, world.chef.y, station);
    if (d < bestDist) {
      bestDist = d;
      best = { key, ...station };
    }
  }
  return best;
}

function nearestCrate(world) {
  let best = null;
  let bestDist = 150;
  for (const crate of PANTRY_CRATES) {
    const cx = crate.x + CRATE.w / 2;
    const cy = crate.y + CRATE.h / 2;
    const d = Math.hypot(world.chef.x - cx, world.chef.y - cy);
    if (d < bestDist) {
      bestDist = d;
      best = crate;
    }
  }
  return best;
}

function collides(x, y) {
  for (const station of Object.values(STATIONS)) {
    if (station.kind === 'trash') continue;
    const r = 4;
    if (x + CHEF.radius - r > station.x && x - CHEF.radius + r < station.x + station.w
      && y + CHEF.radius - r > station.y && y - CHEF.radius + r < station.y + station.h) {
      return true;
    }
  }
  return false;
}

/** True when the chef's circle at (x, y) would overlap a counter. */
export function pointBlocked(x, y) {
  return collides(x, y);
}

function moveChef(world, ax, ay, dt) {
  const chef = world.chef;
  const len = Math.hypot(ax, ay);
  if (len < 0.01) {
    chef.moving = false;
    return;
  }
  chef.moving = true;
  const nx = ax / len;
  const ny = ay / len;
  chef.dx = nx;
  chef.dy = ny;
  const step = CHEF.speed * dt;
  const tryX = chef.x + nx * step;
  if (!collides(tryX, chef.y)
    && tryX > FLOOR.x + CHEF.radius && tryX < FLOOR.x + FLOOR.w - CHEF.radius) {
    chef.x = tryX;
  }
  const tryY = chef.y + ny * step;
  if (!collides(chef.x, tryY)
    && tryY > FLOOR.y + CHEF.radius && tryY < FLOOR.y + FLOOR.h - CHEF.radius) {
    chef.y = tryY;
  }
}

/** The plate's slots plus one more item: do they still fit some recipe? */
export function plateAccepts(slots, itemName) {
  const next = [...slots, itemName];
  return RECIPES.some((recipe) => next.every((n) => recipe.needs.includes(n))
    && next.length <= recipe.needs.length);
}

/** Which recipe, if any, do these slots complete exactly? */
export function plateCompletes(slots) {
  return RECIPES.find((recipe) => recipe.needs.length === slots.length
    && recipe.needs.every((n) => slots.includes(n))) ?? null;
}

function interact(world) {
  const station = nearestStation(world);
  if (!station) return;
  const chef = world.chef;
  if (station.kind === 'pantry') {
    if (world.carrying) return;
    const crate = nearestCrate(world);
    if (!crate) return;
    world.carrying = { id: crate.id, state: 'raw' };
    pushEvent(world, 'pickup', { id: crate.id });
    return;
  }
  if (station.kind === 'chop') {
    // Chopping runs while E is held (see updateChop); a press alone does nothing.
    return;
  }
  if (station.kind === 'stove') {
    const stove = world.stoves[station.key];
    if (stove.item && stove.item.done && !world.carrying) {
      world.carrying = { id: stove.item.id, state: stove.item.burnt ? 'burnt' : 'cooked' };
      stove.item = null;
      pushEvent(world, 'pickup', { id: world.carrying.id });
      return;
    }
    if (!stove.item && world.carrying && INGREDIENTS[world.carrying.id].cook
      && world.carrying.state === 'raw') {
      stove.item = { id: world.carrying.id, progress: 0, done: false, burnt: false, burnTimer: 0 };
      world.carrying = null;
      pushEvent(world, 'place', { station: station.key });
    }
    return;
  }
  if (station.kind === 'plate') {
    if (world.plate.dish && !world.carrying) {
      world.carrying = { id: world.plate.dish, state: 'dish' };
      world.plate.dish = null;
      world.plate.slots = [];
      pushEvent(world, 'pickup', { id: world.carrying.id });
      return;
    }
    if (!world.plate.dish && world.carrying && world.carrying.state !== 'raw'
      && world.carrying.state !== 'burnt' && world.carrying.state !== 'dish') {
      const name = processedId(world.carrying);
      if (!plateAccepts(world.plate.slots, name)) {
        pushEvent(world, 'reject', { reason: 'no-recipe' });
        return;
      }
      world.plate.slots.push(name);
      world.carrying = null;
      pushEvent(world, 'plate', { name });
      const done = plateCompletes(world.plate.slots);
      if (done) {
        world.plate.dish = done.id;
        pushEvent(world, 'dish-ready', { id: done.id });
      }
      return;
    }
    if (!world.plate.dish && !world.carrying && world.plate.slots.length > 0) {
      // Take the last slot back: a mis-tap never bricks the plate.
      const last = world.plate.slots.pop();
      const [id, state] = last.split(':');
      world.carrying = { id, state };
      pushEvent(world, 'pickup', { id });
    }
    return;
  }
  if (station.kind === 'serve') {
    if (world.carrying && world.carrying.state === 'dish') {
      const result = serveOrder(world.board, world.carrying.id);
      if (!result) {
        pushEvent(world, 'reject', { reason: 'no-order' });
        return;
      }
      const { x, y } = chef;
      addFloater(world, x, y - 44, `+${result.paid} koin`, '#ffd166');
      if (result.combo > 1) {
        addFloater(world, x, y - 68, `KOMBO x${result.combo}!`, '#ff9d5c');
      }
      burst(world, station.x + 20, station.y + 60, '#ffd166', 14);
      pushEvent(world, 'serve', { paid: result.paid, combo: result.combo });
      world.carrying = null;
    }
    return;
  }
  if (station.kind === 'trash') {
    if (world.carrying) {
      pushEvent(world, 'trash', { id: world.carrying.id });
      world.carrying = null;
    }
  }
}

/** Chopping advances only while the player holds interact at the board. */
function updateChop(world, holding, dt) {
  const station = nearestStation(world);
  const chopping = holding && station && station.kind === 'chop'
    && world.carrying && INGREDIENTS[world.carrying.id].chop
    && world.carrying.state === 'raw';
  if (!chopping) {
    if (world.chop.itemId) world.chop = { itemId: null, progress: 0, needed: 0 };
    return;
  }
  const spec = INGREDIENTS[world.carrying.id];
  if (world.chop.itemId !== world.carrying.id) {
    world.chop = { itemId: world.carrying.id, progress: 0, needed: spec.chopSeconds };
  }
  world.chop.progress += dt;
  if (world.random.next() < dt * 14) {
    burst(world, world.chef.x + world.chef.dx * 26, world.chef.y - 10, '#cfe8a8', 2);
  }
  if (world.chop.progress >= world.chop.needed) {
    world.carrying = { id: world.carrying.id, state: 'chopped' };
    pushEvent(world, 'chop-done', { id: world.carrying.id });
    world.chop = { itemId: null, progress: 0, needed: 0 };
  }
}

function updateStoves(world, dt) {
  world.sizzle = false;
  for (const stove of Object.values(world.stoves)) {
    const item = stove.item;
    if (!item) continue;
    const spec = INGREDIENTS[item.id];
    if (!item.done) {
      item.progress += dt / spec.cookSeconds;
      world.sizzle = true;
      if (item.progress >= 1) {
        item.progress = 1;
        item.done = true;
        item.burnTimer = 0;
        pushEvent(world, 'cook-done', { id: item.id });
      }
    } else if (!item.burnt) {
      item.burnTimer += dt;
      if (item.burnTimer >= ORDERS.burnAfter) {
        item.burnt = true;
        pushEvent(world, 'burnt', { id: item.id });
      }
    }
  }
}

function updateParticles(world, dt) {
  for (const p of world.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 160 * dt;
    p.life -= dt;
  }
  world.particles = world.particles.filter((p) => p.life > 0);
  for (const f of world.floaters) {
    f.y -= 34 * dt;
    f.life -= dt;
  }
  world.floaters = world.floaters.filter((f) => f.life > 0);
}

/** One fixed step of play. Returns an EVENT_* bitmask. */
export function updateWorld(world, input, dt) {
  let events = 0;
  if (world.screen !== SCREEN_PLAY) return events;
  world.elapsed += dt;
  if (input) {
    const { x, y } = input.axes();
    moveChef(world, x, y, dt);
    if (input.interactPressed()) interact(world);
    updateChop(world, input.interactHeld(), dt);
  }
  updateStoves(world, dt);
  const expired = updateOrderBoard(world.board, dt, world.elapsed, (order) => {
    world.hearts -= 1;
    addFloater(world, 640, 200, `Order ${order.name} hangus! -1 hati`, '#e5534b');
    pushEvent(world, 'expire', { id: order.recipeId });
  });
  if (expired.length > 0) events |= EVENT_EXPIRED;
  updateParticles(world, dt);
  if (world.hearts <= 0) {
    world.screen = SCREEN_OVER;
    events |= EVENT_OVER;
    return events;
  }
  if (world.elapsed >= SHIFT_SECONDS) {
    world.screen = SCREEN_DAY;
    events |= EVENT_DAY;
  }
  return events;
}

/** Seconds left in the shift. */
export function timeLeft(world) {
  return Math.max(0, SHIFT_SECONDS - world.elapsed);
}

/** True once the rush (last 40s) has begun. */
export function inRush(world) {
  return world.elapsed >= SHIFT_SECONDS - 40;
}

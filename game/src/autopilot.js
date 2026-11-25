// Autopilot: plays the game with the same inputs a human uses — walk to a
// station, interact, hold to chop, wait for the stove. It is the logic
// test's player and the screenshot stager's cook, never a cheat: it reads
// only the world state a player can see.
import { STATIONS, INGREDIENTS, RECIPES } from './config.js';
import { nearestStation, pointBlocked, distToRect } from './kitchen.js';
import { orderWants } from './orders.js';

/** Waypoints in open floor: the pilot routes through these, because a
 *  straight line to a station can run straight into a counter (the chef
 *  wedges under the chopping board trying to reach the pantry). */
const WAYPOINTS = [
  { x: 190, y: 560 }, { x: 420, y: 560 }, { x: 640, y: 560 }, { x: 900, y: 560 },
  { x: 1100, y: 560 }, { x: 420, y: 260 }, { x: 640, y: 320 }, { x: 900, y: 320 },
];

/** True when the segment between two points never overlaps a counter. */
function segmentClear(ax, ay, bx, by) {
  const dist = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(1, Math.ceil(dist / 10));
  // Skip the first sample: the chef's own spot may graze a counter, and
  // that must not poison every segment starting there.
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    if (pointBlocked(ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
  }
  return true;
}

/** Shortest waypoint path from (ax,ay) to (bx,by), as a list of points. */
function route(ax, ay, bx, by) {
  const nodes = [{ x: ax, y: ay }, ...WAYPOINTS, { x: bx, y: by }];
  const start = 0;
  const goal = nodes.length - 1;
  const prev = new Array(nodes.length).fill(-1);
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur === goal) break;
    for (let n = 0; n < nodes.length; n += 1) {
      if (seen.has(n) || n === cur) continue;
      // Never route through the goal's own leg twice; direct edges only.
      if (segmentClear(nodes[cur].x, nodes[cur].y, nodes[n].x, nodes[n].y)) {
        seen.add(n);
        prev[n] = cur;
        queue.push(n);
      }
    }
  }
  if (!seen.has(goal)) return [{ x: bx, y: by }];
  const path = [];
  let cur = goal;
  while (cur !== start) {
    path.unshift(nodes[cur]);
    cur = prev[cur];
  }
  return path;
}

/** Where to stand to use a station: the closest spot around it at which
 *  THIS station is the nearest one. The plain nearest-edge point can sit
 *  nearer a neighbouring counter (the plate's top-left approach is 21px
 *  from the chopping board but 42px from the plate), and the press would
 *  then land on the wrong station. */
export function standSpot(world, key) {
  const s = STATIONS[key];
  const o = 36;
  const cands = [
    { x: s.x + s.w / 2, y: s.y - o },
    { x: s.x + s.w / 2, y: s.y + s.h + o },
    { x: s.x - o, y: s.y + s.h / 2 },
    { x: s.x + s.w + o, y: s.y + s.h / 2 },
    { x: s.x - o, y: s.y - o },
    { x: s.x + s.w + o, y: s.y - o },
    { x: s.x - o, y: s.y + s.h + o },
    { x: s.x + s.w + o, y: s.y + s.h + o },
  ];
  const inFloor = cands.filter((p) => p.x > 40 && p.x < 1240 && p.y > 130 && p.y < 700);
  const good = inFloor.filter((p) => {
    let best = null;
    let bestDist = Infinity;
    for (const [k2, s2] of Object.entries(STATIONS)) {
      const d = distToRect(p.x, p.y, s2);
      if (d < bestDist) {
        bestDist = d;
        best = k2;
      }
    }
    return best === key;
  });
  const pool = good.length > 0 ? good : inFloor;
  // Pick by distance minus a margin bonus: a spot the target station wins
  // by a wide margin stays the nearest station even when the chef stops a
  // few pixels short of it; the nearest spot can lose by a pixel.
  let bestP = pool[0];
  let bestScore = Infinity;
  for (const p of pool) {
    let nearest = Infinity;
    let second = Infinity;
    for (const s2 of Object.values(STATIONS)) {
      const d = distToRect(p.x, p.y, s2);
      if (d < nearest) {
        second = nearest;
        nearest = d;
      } else if (d < second) {
        second = d;
      }
    }
    const margin = second - nearest;
    const score = Math.hypot(p.x - world.chef.x, p.y - world.chef.y) - 1.5 * margin;
    if (score < bestScore) {
      bestScore = score;
      bestP = p;
    }
  }
  return bestP;
}

/** Pantry crates are on the left wall; stand right of the pantry, level
 *  with the crate's row, so the nearest crate is the one we want. */
const PANTRY_ROWS = {
  rice: 182, noodle: 238, egg: 294,
  chicken: 350, veg: 406, chili: 462,
};

let navCache = { key: '', path: [], index: 0 };

function stepToward(input, world, tx, ty) {
  const dx = tx - world.chef.x;
  const dy = ty - world.chef.y;
  const len = Math.hypot(dx, dy);
  if (len < 12) return true;
  // Press on absolute deltas, not the normalised direction: a normalised
  // threshold (nx < -0.4) drops the short axis entirely, and the chef then
  // slides past the target on the long axis forever without ever closing
  // the last few pixels sideways.
  if (dx > 8) input.fakePress('KeyD');
  if (dx < -8) input.fakePress('KeyA');
  if (dy > 8) input.fakePress('KeyS');
  if (dy < -8) input.fakePress('KeyW');
  return false;
}

/** Walk to (tx, ty), routing through waypoints when the straight line
 *  runs into a counter. Returns true on arrival. */
function moveToward(input, world, tx, ty) {
  const chef = world.chef;
  const key = `${Math.round(tx)},${Math.round(ty)}`;
  if (navCache.key !== key || navCache.path.length === 0) {
    navCache = { key, path: route(chef.x, chef.y, tx, ty), index: 0 };
  }
  // Shortcut: the straight line is open, drop the waypoints.
  if (segmentClear(chef.x, chef.y, tx, ty)) {
    navCache.path = [];
    return stepToward(input, world, tx, ty);
  }
  const dest = navCache.path[navCache.index];
  if (!dest) return stepToward(input, world, tx, ty);
  if (!segmentClear(chef.x, chef.y, dest.x, dest.y)) {
    // Stale path: the waypoint was planned from an older position and the
    // chef can no longer reach it in a straight line (wedged in a corner,
    // for example). Replan once from where the chef actually is; if the
    // new waypoint is still not directly reachable, walk toward it anyway
    // and slide along the counter instead of replanning in a loop.
    navCache = { key, path: route(chef.x, chef.y, tx, ty), index: 0 };
    const fresh = navCache.path[0];
    if (!fresh) return stepToward(input, world, tx, ty);
    return stepToward(input, world, fresh.x, fresh.y);
  }
  if (stepToward(input, world, dest.x, dest.y)) {
    navCache.index += 1;
    if (navCache.index >= navCache.path.length) {
      return stepToward(input, world, tx, ty);
    }
  }
  return false;
}

/** Processed items already on their way: cooking on a stove, sitting on
 *  the plate, or in hand. The pilot never fetches one of these twice. */
function inFlightSet(world) {
  const set = new Set(world.plate.slots);
  if (world.plate.dish) {
    const recipe = RECIPES.find((r) => r.id === world.plate.dish);
    if (recipe) for (const n of recipe.needs) set.add(n);
  }
  for (const stove of Object.values(world.stoves)) {
    const item = stove.item;
    if (item && !item.burnt) set.add(`${item.id}:cooked`);
  }
  if (world.carrying && (world.carrying.state === 'chopped' || world.carrying.state === 'cooked')) {
    set.add(`${world.carrying.id}:${world.carrying.state}`);
  }
  return set;
}

/** Choose the next job: serve a ready dish, finish a plate, cook, or chop. */
export function pilotNextJob(world) {
  const carrying = world.carrying;
  const inFlight = inFlightSet(world);
  const activeIds = new Set(world.board.active.map((o) => o.recipeId));
  // 1. Carrying a finished dish: serve it — or trash it when its order
  //    expired while it was being made (serving it would be refused
  //    forever, and the pilot would loop on the window).
  if (carrying && carrying.state === 'dish') {
    return orderWants(world.board, carrying.id)
      ? { task: 'serve' }
      : { task: 'trash' };
  }
  // 2. A dish waits on the plate: pick it up.
  if (!carrying && world.plate.dish) return { task: 'take-dish' };
  // 3. A stove finished: collect it.
  for (const key of ['stoveA', 'stoveB']) {
    const item = world.stoves[key].item;
    if (item && item.done && !carrying) return { task: 'collect', stove: key };
  }
  // 3b. Carrying a processed item no live order can use: trash it.
  if (carrying && (carrying.state === 'chopped' || carrying.state === 'cooked')) {
    const name = `${carrying.id}:${carrying.state}`;
    const useful = world.board.active.some((o) => {
      const recipe = RECIPES.find((r) => r.id === o.recipeId);
      return recipe && recipe.needs.includes(name)
        && (world.plate.slots.length === 0
          || world.plate.slots.every((s) => recipe.needs.includes(s)));
    });
    if (!useful) return { task: 'trash' };
  }
  // 4. Plate has slots: fetch the missing piece of the matching recipe —
  //    but only while a live order still wants that recipe. Otherwise the
  //    plate is dead stock: take it apart.
  if (world.plate.slots.length > 0 && !carrying) {
    const recipe = RECIPES.find((r) => activeIds.has(r.id)
      && world.plate.slots.every((s) => r.needs.includes(s))
      && r.needs.length > world.plate.slots.length);
    if (recipe) {
      const missing = recipe.needs.find((n) => !world.plate.slots.includes(n) && !inFlight.has(n));
      if (missing) return { task: 'fetch', processed: missing };
      return { task: 'wait' };
    }
    return { task: 'take-back' };
  }
  // 5. No plate in progress: start the most urgent order that still has
  //    a need nobody is already fetching, cooking or carrying.
  if (!carrying) {
    const orders = [...world.board.active].sort((a, b) => a.patience - b.patience);
    for (const order of orders) {
      const need = order.needs.find((n) => !inFlight.has(n));
      if (need) return { task: 'fetch', processed: need };
    }
  }
  if (carrying) return { task: 'use-carrying' };
  return { task: 'wait' };
}

/** Turn a "fetch" job into a pantry + process plan for one processed item. */
function planFor(processed) {
  const [id, kind] = processed.split(':');
  if (kind === 'chopped') return { pantry: id, process: 'chop' };
  return { pantry: id, process: 'cook' };
}

export function createPilot() {
  let job = null;
  let waitUntil = 0;
  // Fresh navigation: a path planned for another world is stale here.
  navCache = { key: '', path: [], index: 0 };
  return {
    reset() {
      job = null;
      waitUntil = 0;
      navCache = { key: '', path: [], index: 0 };
    },
    debugJob() {
      return job;
    },
    /** Drive one fixed step. The caller releases movement keys each step
     *  and calls updateWorld after this, in that order. */
    step(world, input, now) {
      // Release E first: a press only registers on the down-stroke, so the
      // pilot must let go before every fresh press (chop holds re-press it
      // every step while standing at the board).
      input.fakeRelease('KeyE');
      if (!job) job = pilotNextJob(world);
      // Re-plan when the job no longer makes sense.
      if (job.task === 'fetch' && world.carrying) job = pilotNextJob(world);
      if (job.task === 'use-carrying' && !world.carrying) job = pilotNextJob(world);
      if (job.task === 'collect' && !world.stoves[job.stove]?.item?.done) job = pilotNextJob(world);
      if (job.task === 'take-dish' && !world.plate.dish) job = pilotNextJob(world);
      if (!job) job = pilotNextJob(world);

      if (job.task === 'wait') {
        if (now > waitUntil) {
          waitUntil = now + 0.5;
          job = pilotNextJob(world);
        }
        return true;
      }
      if (job.task === 'trash') {
        const spot = standSpot(world, 'trash');
        if (!moveToward(input, world, spot.x, spot.y)) return true;
        input.fakePress('KeyE');
        job = null;
        return true;
      }
      if (job.task === 'serve' || job.task === 'take-dish' || job.task === 'take-back') {
        const spot = standSpot(world, job.task === 'serve' ? 'serve' : 'plate');
        if (!moveToward(input, world, spot.x, spot.y)) return true;
        input.fakePress('KeyE');
        job = null;
        return true;
      }
      if (job.task === 'collect') {
        const spot = standSpot(world, job.stove);
        if (!moveToward(input, world, spot.x, spot.y)) return true;
        input.fakePress('KeyE');
        job = null;
        return true;
      }
      if (job.task === 'fetch') {
        const plan = planFor(job.processed);
        const spot = { x: 190, y: PANTRY_ROWS[plan.pantry] };
        if (!moveToward(input, world, spot.x, spot.y)) return true;
        input.fakePress('KeyE');
        job = { task: 'use-carrying', processed: job.processed };
        return true;
      }
      if (job.task === 'use-carrying') {
        const carrying = world.carrying;
        if (!carrying) {
          job = null;
          return true;
        }
        if (carrying.state === 'raw' && INGREDIENTS[carrying.id].chop) {
          const spot = standSpot(world, 'chop');
          if (!moveToward(input, world, spot.x, spot.y)) return true;
          // Arrived: hold E across steps; fakePress every step keeps it down.
          input.fakePress('KeyE');
          return true;
        }
        if (carrying.state === 'raw' && INGREDIENTS[carrying.id].cook) {
          const free = ['stoveA', 'stoveB'].find((k) => !world.stoves[k].item);
          if (!free) return true; // wait for a stove
          const spot = standSpot(world, free);
          if (!moveToward(input, world, spot.x, spot.y)) return true;
          input.fakePress('KeyE');
          // Back to planning: while it cooks, fetch the next ingredient
          // instead of idling at the stove.
          job = null;
          return true;
        }
        if (carrying.state === 'chopped' || carrying.state === 'cooked') {
          const spot = standSpot(world, 'plate');
          if (!moveToward(input, world, spot.x, spot.y)) return true;
          input.fakePress('KeyE');
          job = null;
          return true;
        }
        if (carrying.state === 'burnt') {
          const spot = standSpot(world, 'trash');
          if (!moveToward(input, world, spot.x, spot.y)) return true;
          input.fakePress('KeyE');
          job = null;
          return true;
        }
        job = null;
        return true;
      }
      job = null;
      return true;
    },
  };
}

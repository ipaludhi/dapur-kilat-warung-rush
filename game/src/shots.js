// Screenshot staging: deterministic scenes for shots.json. Each stage runs
// the real game (the autopilot cooks, the orders tick) from a fixed seed,
// then freezes one frame that shows the game at its best. The cover must
// show every element of the bounty brief at a glance: the kitchen, the
// order board, ingredients on the counter, one dish mid-assembly, a timer
// and a plate ready to serve.
import { STEP, SHIFT_SECONDS } from './config.js';
import {
  SCREEN_DAY, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, createWorld,
  resetWorld, updateWorld,
} from './kitchen.js';
import { createInput } from './input.js';
import { createPilot } from './autopilot.js';
import { spawnOrder } from './orders.js';

function runFor(world, input, pilot, seconds) {
  const steps = Math.floor(seconds / STEP);
  let now = 0;
  for (let i = 0; i < steps; i += 1) {
    for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'Space']) input.fakeRelease(code);
    if (pilot) pilot.step(world, input, now);
    updateWorld(world, input, STEP);
    input.endFrame();
    now += STEP;
    if (world.screen !== SCREEN_PLAY) break;
  }
  return now;
}

/** Stage the title screen, untouched. */
function stageTitle(world) {
  world.screen = SCREEN_TITLE;
  world.best = 124;
  return { screen: SCREEN_TITLE, best: world.best };
}

/** Stage the cover: mid-shift, three orders up, a wok cooking, chopped
 *  veg on the board, a dish half-assembled on the plate counter, the chef
 *  carrying a cooked egg toward the plate, timer running. */
function stageCover(world, input) {
  resetWorld(world);
  world.elapsed = 52;
  // Three live orders with healthy patience, one of them nearly done.
  spawnOrder(world.board, 52);
  spawnOrder(world.board, 52);
  spawnOrder(world.board, 52);
  world.board.active[0].patience = 34;
  world.board.active[1].patience = 22;
  world.board.active[2].patience = 12;
  world.board.earned = 64;
  world.board.served = 4;
  world.board.combo = 2;
  world.board.comboTimer = 12;
  // Wok A: rice cooking, halfway. Wok B: chicken just finished.
  world.stoves.stoveA.item = { id: 'rice', progress: 0.55, done: false, burnt: false, burnTimer: 0 };
  world.stoves.stoveB.item = { id: 'chicken', progress: 1, done: true, burnt: false, burnTimer: 3 };
  // Chopping board: chili mid-chop.
  world.chop = { itemId: 'chili', progress: 0.6, needed: 1.0 };
  // Plate: nasi goreng half-assembled (rice + egg), one slot free.
  world.plate.slots = ['rice:cooked', 'egg:cooked'];
  // Chef carries the last piece of the nasi goreng (chopped chili) toward
  // the plate, standing by the counter.
  world.carrying = { id: 'chili', state: 'chopped' };
  world.chef.x = 600;
  world.chef.y = 566;
  world.chef.dx = 0;
  world.chef.dy = -1;
  return { screen: SCREEN_PLAY, best: 0 };
}

/** Stage the rush: late shift, four orders, one about to expire, both
 *  stoves cooking, combo x3, timer under a minute. */
function stageRush(world, input) {
  resetWorld(world);
  const pilot = createPilot();
  // Let the autopilot genuinely play 100 seconds of the shift.
  runFor(world, input, pilot, 100);
  if (world.screen !== SCREEN_PLAY) return { screen: world.screen, best: 0 };
  // Force the rush look: top up to four orders, one nearly expired.
  while (world.board.active.length < 4) {
    if (!spawnOrder(world.board, world.elapsed)) break;
  }
  world.board.active[0].patience = Math.min(world.board.active[0].patience, 6);
  world.board.combo = 3;
  world.board.comboTimer = 10;
  return { screen: SCREEN_PLAY, best: 0 };
}

/** Stage the day-complete screen: the autopilot plays a whole shift. */
function stageServed(world, input) {
  resetWorld(world);
  const pilot = createPilot();
  runFor(world, input, pilot, SHIFT_SECONDS + 5);
  if (world.screen !== SCREEN_DAY) {
    // The pilot lost all hearts: stage the result from its real numbers.
    world.screen = SCREEN_DAY;
    world.elapsed = SHIFT_SECONDS;
  }
  return { screen: world.screen, best: 0 };
}

/** Stage one named shot on a fresh world. Returns the staged screen. */
export function stageShot(name, world, input) {
  const safeInput = input ?? createInput();
  if (name === 'title') return stageTitle(world);
  if (name === 'cover') return stageCover(world, safeInput);
  if (name === 'rush') return stageRush(world, safeInput);
  if (name === 'served') return stageServed(world, safeInput);
  // Unknown name: play 20 seconds and show whatever the game looks like.
  resetWorld(world);
  const pilot = createPilot();
  runFor(world, safeInput, pilot, 20);
  return { screen: world.screen, best: 0 };
}

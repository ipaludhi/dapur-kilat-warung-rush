// Main loop: fixed-step simulation, screens, shot staging, and the mouse.
// The loop runs at the display's rate but the world only ever advances in
// STEP-sized updates, and input presses are cleared after EVERY update —
// never once per frame — so one press is one action at any frame rate.
import { FIELD, STEP, BEST_KEY } from './config.js';
import { createRandom } from './random.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  SCREEN_DAY, SCREEN_OVER, SCREEN_PAUSE, SCREEN_PLAY, SCREEN_TITLE,
  createWorld, nearestStation, resetWorld, updateWorld,
} from './kitchen.js';
import { drawWorld } from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

function readSeed() {
  const params = new URLSearchParams(window.location.search);
  const seed = Number.parseInt(params.get('seed') ?? '1', 10);
  return Number.isFinite(seed) ? seed : 1;
}

function readShot() {
  return new URLSearchParams(window.location.search).get('shot');
}

const world = createWorld(createRandom(readSeed()));
const input = createInput();
input.attach(window);
const audio = createAudio();

function loadBest() {
  try {
    world.best = Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    world.best = 0;
  }
}

function saveBest() {
  try {
    window.localStorage.setItem(BEST_KEY, String(world.best));
  } catch {
    // Storage may be unavailable (hosted site, private mode): best is lost.
  }
}

loadBest();

let mouseTarget = null;
let shotMode = false;

function canvasScale() {
  return {
    x: canvas.width / FIELD.width,
    y: canvas.height / FIELD.height,
  };
}

function toLogical(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scale = canvasScale();
  return {
    x: ((clientX - rect.left) / rect.width) * FIELD.width,
    y: ((clientY - rect.top) / rect.height) * FIELD.height,
  };
}

/** Click a station to walk to it; the chef interacts on arrival. */
function onCanvasClick(clientX, clientY) {
  const p = toLogical(clientX, clientY);
  mouseTarget = { x: p.x, y: p.y, interact: true };
}

canvas.addEventListener('mousedown', (event) => {
  audio.unlock();
  onCanvasClick(event.clientX, event.clientY);
});

/** Steer toward the mouse target; arrive, then interact once. */
function updateMouseTarget() {
  if (!mouseTarget || world.screen !== SCREEN_PLAY) return;
  const dx = mouseTarget.x - world.chef.x;
  const dy = mouseTarget.y - world.chef.y;
  if (Math.hypot(dx, dy) < 18) {
    if (mouseTarget.interact) input.fakePress('KeyE');
    mouseTarget = null;
    return;
  }
  if (dx > 8) input.fakePress('KeyD');
  if (dx < -8) input.fakePress('KeyA');
  if (dy > 8) input.fakePress('KeyS');
  if (dy < -8) input.fakePress('KeyW');
}

function handleScreenKeys() {
  if (input.wasPressed('Enter') || input.wasPressed('Space')) {
    if (world.screen === SCREEN_TITLE || world.screen === SCREEN_DAY || world.screen === SCREEN_OVER) {
      audio.unlock();
      audio.startMusic();
      resetWorld(world);
    }
  }
  if (input.wasPressed('KeyP')) {
    if (world.screen === SCREEN_PLAY) world.screen = SCREEN_PAUSE;
    else if (world.screen === SCREEN_PAUSE) world.screen = SCREEN_PLAY;
  }
  if (input.wasPressed('KeyR')) {
    if (world.screen === SCREEN_PAUSE || world.screen === SCREEN_OVER || world.screen === SCREEN_DAY) {
      resetWorld(world);
    }
  }
  if (input.wasPressed('KeyM')) {
    audio.setMuted(!audio.isMuted());
  }
}

function playEventSounds() {
  for (const event of world.events) {
    if (event.type === 'chop-done') audio.chop();
    else if (event.type === 'cook-done') audio.ding();
    else if (event.type === 'serve') audio.coin();
    else if (event.type === 'reject') audio.reject();
    else if (event.type === 'burnt') audio.burn();
    else if (event.type === 'expire') audio.expire();
    else if (event.type === 'pickup') audio.pickup();
    else if (event.type === 'place' || event.type === 'plate') audio.place();
  }
  world.events.length = 0;
}

function announce() {
  if (!statusEl) return;
  const board = world.board;
  statusEl.textContent = `Dapur Kilat. Koin ${board.earned}. Tersaji ${board.served}. `
    + `Hati ${world.hearts}. Order aktif ${board.active.length}.`;
}

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
}

window.addEventListener('resize', resize);
resize();

const shot = readShot();
if (shot) {
  shotMode = true;
  stageShot(shot, world, input);
  world.nearStation = nearestStation(world);
  drawWorld(ctx, world);
} else {
  world.screen = SCREEN_TITLE;
}

let last = performance.now();
let accumulator = 0;
let announceTimer = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const scaleX = canvas.width / FIELD.width;
  const scaleY = canvas.height / FIELD.height;
  ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
  if (shotMode) {
    drawWorld(ctx, world);
    return;
  }
  const elapsed = Math.min(0.25, (now - last) / 1000);
  last = now;
  accumulator += elapsed;
  while (accumulator >= STEP) {
    accumulator -= STEP;
    handleScreenKeys();
    if (world.screen === SCREEN_PLAY) {
      updateMouseTarget();
      world.nearStation = nearestStation(world);
      updateWorld(world, input, STEP);
      playEventSounds();
      if (world.screen === SCREEN_DAY || world.screen === SCREEN_OVER) {
        if (world.board.earned > world.best) {
          world.best = world.board.earned;
          saveBest();
        }
        audio.stopMusic();
      }
    }
    input.endFrame();
  }
  drawWorld(ctx, world);
  announceTimer += elapsed;
  if (announceTimer > 1) {
    announceTimer = 0;
    announce();
  }
}

// Test hook: the CDP play-test drives the game through this object.
window.__dapur = { world, input, stageShot, updateWorld, STEP };
requestAnimationFrame(frame);

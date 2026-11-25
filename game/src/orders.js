// Orders: the order board. An order is a recipe plus a patience clock; the
// tip it pays shrinks as patience drains, and serving fast chains a combo.
// Nothing here touches the DOM, so the logic test can drive it in Node.
import { ORDERS, RECIPES, SHIFT_SECONDS, RUSH_SECONDS } from './config.js';

const ORDERS_RUSH_START = SHIFT_SECONDS - RUSH_SECONDS;

let nextOrderId = 1;

export function createOrderBoard(random) {
  return {
    random,
    active: [],
    served: 0,
    expired: 0,
    earned: 0,
    combo: 0,
    bestCombo: 0,
    comboTimer: 0,
    spawnTimer: ORDERS.firstDelay,
    totalSpawned: 0,
  };
}

/** Patience for an order spawned this far into the shift. */
export function patienceFor(elapsed) {
  const rush = elapsed >= ORDERS_RUSH_START;
  return rush ? ORDERS.rushPatience : ORDERS.patience;
}

/** Pick the next recipe: weighted so the special shows up later in a shift. */
export function pickRecipe(random, elapsed) {
  const pool = elapsed > 60
    ? [...RECIPES]
    : RECIPES.filter((r) => r.id !== 'nasi-spesial');
  return random.pick(pool);
}

export function spawnOrder(board, elapsed) {
  if (board.active.length >= ORDERS.maxActive) return null;
  const recipe = pickRecipe(board.random, elapsed);
  const order = {
    id: nextOrderId,
    recipeId: recipe.id,
    name: recipe.name,
    price: recipe.price,
    needs: recipe.needs.slice(),
    patience: patienceFor(elapsed),
    maxPatience: patienceFor(elapsed),
  };
  nextOrderId += 1;
  board.active.push(order);
  board.totalSpawned += 1;
  return order;
}

/** Advance the board one fixed step. Returns expired orders. */
export function updateOrderBoard(board, dt, elapsed, onExpire) {
  const rush = elapsed >= ORDERS_RUSH_START;
  board.spawnTimer -= dt;
  if (board.spawnTimer <= 0) {
    spawnOrder(board, elapsed);
    board.spawnTimer = rush ? ORDERS.rushInterval : ORDERS.interval;
  }
  if (board.comboTimer > 0) {
    board.comboTimer -= dt;
    if (board.comboTimer <= 0) board.combo = 0;
  }
  const expired = [];
  for (const order of board.active) {
    order.patience -= dt;
    if (order.patience <= 0) expired.push(order);
  }
  for (const order of expired) {
    board.active = board.active.filter((o) => o !== order);
    board.expired += 1;
    board.combo = 0;
    if (onExpire) onExpire(order);
  }
  return expired;
}

/** Tip for serving now: full tip while patience is high, down to zero. */
export function tipFor(order) {
  const frac = Math.max(0, order.patience / order.maxPatience);
  return Math.round(ORDERS.tipMax * frac);
}

/** Serve the order matching a finished dish. Pays price + tip, times combo. */
export function serveOrder(board, recipeId) {
  const index = board.active.findIndex((o) => o.recipeId === recipeId);
  if (index === -1) return null;
  const order = board.active[index];
  board.active.splice(index, 1);
  board.combo += 1;
  board.bestCombo = Math.max(board.bestCombo, board.combo);
  board.comboTimer = ORDERS.comboWindow;
  const multiplier = 1 + 0.25 * (board.combo - 1);
  const paid = Math.round((order.price + tipFor(order)) * multiplier);
  board.earned += paid;
  board.served += 1;
  return { order, paid, combo: board.combo, multiplier };
}

/** Does any active order want this recipe? */
export function orderWants(board, recipeId) {
  return board.active.some((o) => o.recipeId === recipeId);
}

/** Reset the board for a fresh shift, keeping the same RNG stream. */
export function resetOrderBoard(board) {
  board.active = [];
  board.served = 0;
  board.expired = 0;
  board.earned = 0;
  board.combo = 0;
  board.bestCombo = 0;
  board.comboTimer = 0;
  board.spawnTimer = ORDERS.firstDelay;
  board.totalSpawned = 0;
}

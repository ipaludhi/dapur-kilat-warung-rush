// Renderer: draws the whole kitchen on one canvas, in the fixed 1280x720
// logical space. Everything is drawn shapes — no image files, no fonts
// from the network — so the game renders identically everywhere.
import {
  FIELD, FONT, PALETTE, STATIONS, PANTRY_CRATES, CRATE, INGREDIENTS,
  RECIPES, SHIFT_SECONDS,
} from './config.js';
import { timeLeft, inRush } from './kitchen.js';
import { tipFor } from './orders.js';

const W = FIELD.width;
const H = FIELD.height;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, s, x, y, size, color, weight = 700, align = 'center') {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

/** One ingredient, drawn so it reads at a glance when shrunk. */
export function drawIngredient(ctx, id, state, x, y, size) {
  const spec = INGREDIENTS[id];
  const s = size;
  ctx.save();
  ctx.translate(x, y);
  if (state === 'burnt') {
    ctx.fillStyle = '#1c1c1c';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a3a3a';
    ctx.beginPath();
    ctx.arc(-s * 0.12, -s * 0.1, s * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  if (id === 'rice') {
    ctx.fillStyle = '#d8c9a3';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.12, s * 0.46, s * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = state === 'cooked' ? '#fff8e6' : '#efe6cc';
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      ctx.arc(-s * 0.28 + i * s * 0.14, -s * 0.08 - (i % 2) * s * 0.08, s * 0.11, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (id === 'noodle') {
    ctx.strokeStyle = state === 'cooked' ? '#f2c94c' : '#d9b23a';
    ctx.lineWidth = s * 0.09;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.34, -s * 0.18 + i * s * 0.18);
      ctx.quadraticCurveTo(0, -s * 0.32 + i * s * 0.18, s * 0.34, -s * 0.18 + i * s * 0.18);
      ctx.stroke();
    }
  } else if (id === 'egg') {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.44, s * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = state === 'cooked' ? '#f2a93b' : '#ffd94d';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'chicken') {
    ctx.fillStyle = state === 'cooked' ? '#c97a3f' : '#e8a06a';
    ctx.beginPath();
    ctx.arc(-s * 0.08, -s * 0.05, s * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f7ead2';
    ctx.lineWidth = s * 0.1;
    ctx.beginPath();
    ctx.moveTo(s * 0.18, s * 0.14);
    ctx.lineTo(s * 0.42, s * 0.36);
    ctx.stroke();
    ctx.fillStyle = '#f7ead2';
    ctx.beginPath();
    ctx.arc(s * 0.44, s * 0.38, s * 0.09, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'veg') {
    ctx.fillStyle = state === 'chopped' ? '#7cc96a' : '#4e9a3e';
    for (let i = 0; i < 3; i += 1) {
      const a = -0.5 + i * 0.5;
      ctx.beginPath();
      ctx.ellipse(Math.sin(a) * s * 0.2, -s * 0.1 + i * s * 0.12, s * 0.26, s * 0.14, a, 0, Math.PI * 2);
      ctx.fill();
    }
    if (state === 'chopped') {
      ctx.fillStyle = '#a8e39a';
      for (let i = 0; i < 4; i += 1) {
        ctx.fillRect(-s * 0.3 + i * s * 0.15, s * 0.22, s * 0.1, s * 0.1);
      }
    }
  } else if (id === 'chili') {
    ctx.strokeStyle = state === 'chopped' ? '#ff7a6b' : '#e5534b';
    ctx.lineWidth = s * 0.16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.36, -s * 0.2);
    ctx.quadraticCurveTo(0, s * 0.34, s * 0.36, -s * 0.22);
    ctx.stroke();
    ctx.fillStyle = '#4e9a3e';
    ctx.fillRect(s * 0.3, -s * 0.34, s * 0.12, s * 0.12);
    if (state === 'chopped') {
      ctx.fillStyle = '#ff8a7a';
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.arc(-s * 0.24 + i * s * 0.24, s * 0.2, s * 0.09, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  if (state === 'cooked') {
    // Steam curls: a cooked dish is visibly hot.
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.16, -s * 0.42);
    ctx.quadraticCurveTo(-s * 0.26, -s * 0.62, -s * 0.14, -s * 0.78);
    ctx.moveTo(s * 0.14, -s * 0.42);
    ctx.quadraticCurveTo(s * 0.24, -s * 0.62, s * 0.12, -s * 0.78);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCounter(ctx, station, highlight) {
  ctx.fillStyle = PALETTE.counterSide;
  rr(ctx, station.x, station.y + 8, station.w, station.h, 10);
  ctx.fill();
  ctx.fillStyle = highlight ? '#a06a3d' : PALETTE.counterTop;
  rr(ctx, station.x, station.y, station.w, station.h - 6, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  rr(ctx, station.x, station.y, station.w, station.h - 6, 10);
  ctx.stroke();
  text(ctx, station.label, station.x + station.w / 2, station.y + station.h - 16, 13, '#f7ead2', 800);
}

function drawProgressRing(ctx, x, y, r, frac, color) {
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.arc(x, y, r + 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
  ctx.stroke();
}

function drawPantry(ctx, world, highlight) {
  const station = STATIONS.pantry;
  drawCounter(ctx, station, highlight);
  // The counter's own label sits under the last crate; label it from above.
  text(ctx, 'PANTRY', station.x + station.w / 2, station.y - 12, 13, '#c9a06a', 800);
  for (const crate of PANTRY_CRATES) {
    const spec = INGREDIENTS[crate.id];
    ctx.fillStyle = '#5d3a1e';
    rr(ctx, crate.x, crate.y, CRATE.w, CRATE.h, 8);
    ctx.fill();
    ctx.fillStyle = '#7a4d28';
    rr(ctx, crate.x + 3, crate.y + 3, CRATE.w - 6, CRATE.h - 6, 6);
    ctx.fill();
    drawIngredient(ctx, crate.id, 'raw', crate.x + 24, crate.y + CRATE.h / 2, 36);
    text(ctx, spec.name.toUpperCase(), crate.x + 48, crate.y + CRATE.h / 2 + 1, 13, '#f7ead2', 800, 'left');
  }
}

function drawChopBoard(ctx, world, highlight) {
  const station = STATIONS.chop;
  drawCounter(ctx, station, highlight);
  // Wooden board.
  ctx.fillStyle = '#c9a06a';
  rr(ctx, station.x + 18, station.y + 12, station.w - 36, 52, 8);
  ctx.fill();
  ctx.strokeStyle = '#8a6a42';
  ctx.lineWidth = 2;
  rr(ctx, station.x + 18, station.y + 12, station.w - 36, 52, 8);
  ctx.stroke();
  const chop = world.chop;
  if (chop.itemId) {
    drawIngredient(ctx, chop.itemId, 'raw', station.x + station.w / 2, station.y + 38, 40);
    drawProgressRing(ctx, station.x + station.w / 2, station.y + 38, 30,
      chop.progress / chop.needed, '#ffd166');
    text(ctx, 'CINCANG...', station.x + station.w / 2, station.y - 12, 12, '#ffd166', 800);
  } else {
    // Knife resting on the board.
    ctx.fillStyle = '#cfd8de';
    ctx.fillRect(station.x + station.w / 2 - 26, station.y + 30, 52, 8);
    ctx.fillStyle = '#2b1d12';
    ctx.fillRect(station.x + station.w / 2 + 26, station.y + 28, 16, 12);
  }
}

function drawStove(ctx, world, key, highlight) {
  const station = STATIONS[key];
  drawCounter(ctx, station, highlight);
  const stove = world.stoves[key];
  // Burner ring.
  ctx.fillStyle = '#22201e';
  ctx.beginPath();
  ctx.arc(station.x + station.w / 2, station.y + 32, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = stove.item && !stove.item.done ? '#ff9d5c' : '#555049';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(station.x + station.w / 2, station.y + 32, 30, 0, Math.PI * 2);
  ctx.stroke();
  if (stove.item) {
    // Wok.
    ctx.fillStyle = '#3a3f45';
    ctx.beginPath();
    ctx.arc(station.x + station.w / 2, station.y + 32, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#23262a';
    ctx.beginPath();
    ctx.arc(station.x + station.w / 2, station.y + 32, 20, 0, Math.PI * 2);
    ctx.fill();
    drawIngredient(ctx, stove.item.id, stove.item.burnt ? 'burnt' : 'cooked',
      station.x + station.w / 2, station.y + 32, 32);
    if (!stove.item.done) {
      drawProgressRing(ctx, station.x + station.w / 2, station.y + 32, 24,
        stove.item.progress, '#ff9d5c');
    } else if (stove.item.burnt) {
      text(ctx, 'GOSONG!', station.x + station.w / 2, station.y - 12, 13, '#e5534b', 800);
    } else {
      const left = Math.max(0, 9 - stove.item.burnTimer);
      text(ctx, `MATANG! ${left.toFixed(0)}s`, station.x + station.w / 2, station.y - 12, 13, '#6fbf5a', 800);
    }
  }
}

function drawPlateCounter(ctx, world, highlight) {
  const station = STATIONS.plate;
  drawCounter(ctx, station, highlight);
  // Three plate slots.
  for (let i = 0; i < 3; i += 1) {
    const cx = station.x + 56 + i * 88;
    const cy = station.y + 40;
    ctx.fillStyle = '#f7ead2';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 36, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c9b48a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 36, 26, 0, 0, Math.PI * 2);
    ctx.stroke();
    const slot = world.plate.slots[i];
    if (slot) {
      const [id, state] = slot.split(':');
      drawIngredient(ctx, id, state, cx, cy, 34);
    }
  }
  if (world.plate.dish) {
    const recipe = RECIPES.find((r) => r.id === world.plate.dish);
    ctx.fillStyle = '#ffd166';
    rr(ctx, station.x + station.w / 2 - 74, station.y - 26, 148, 20, 10);
    ctx.fill();
    text(ctx, `SIAP: ${recipe.name.toUpperCase()}!`, station.x + station.w / 2, station.y - 13, 12, '#2b1d12', 800);
  }
}

function drawServeWindow(ctx, world, highlight) {
  const station = STATIONS.serve;
  ctx.fillStyle = '#1d130c';
  rr(ctx, station.x, station.y, station.w, station.h, 12);
  ctx.fill();
  ctx.fillStyle = highlight ? '#a06a3d' : PALETTE.counterTop;
  rr(ctx, station.x, station.y + station.h - 34, station.w, 34, 10);
  ctx.fill();
  // Bell.
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(station.x + station.w / 2, station.y + 44, 20, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(station.x + station.w / 2 - 24, station.y + 42, 48, 6);
  text(ctx, 'DING!', station.x + station.w / 2, station.y + 84, 14, '#ffd166', 800);
  text(ctx, 'ANTAR DI SINI', station.x + station.w / 2, station.y + station.h - 50, 13, '#f7ead2', 800);
  const served = world.board.served;
  text(ctx, `Tersaji: ${served}`, station.x + station.w / 2, station.y + 120, 14, '#c9a06a', 700);
}

function drawTrash(ctx, world, highlight) {
  const station = STATIONS.trash;
  ctx.fillStyle = highlight ? '#6a6f75' : '#4a4f55';
  rr(ctx, station.x, station.y, station.w, station.h, 10);
  ctx.fill();
  ctx.fillStyle = '#2e3236';
  rr(ctx, station.x + 8, station.y + 8, station.w - 16, 14, 6);
  ctx.fill();
  text(ctx, 'SAMPAH', station.x + station.w / 2, station.y + station.h - 16, 12, '#f7ead2', 800);
}

function drawOrderBoard(ctx, world) {
  // Top strip: the order board, the shift timer, coins, hearts, combo.
  ctx.fillStyle = PALETTE.board;
  ctx.fillRect(0, 0, W, 104);
  ctx.fillStyle = PALETTE.boardEdge;
  ctx.fillRect(0, 100, W, 4);
  text(ctx, 'ORDER BOARD', 92, 22, 15, '#c9a06a', 800, 'left');
  const board = world.board;
  for (let i = 0; i < 4; i += 1) {
    const x = 24 + i * 218;
    const order = board.active[i];
    ctx.fillStyle = order ? PALETTE.orderCard : 'rgba(247,234,210,0.12)';
    rr(ctx, x, 34, 204, 58, 10);
    ctx.fill();
    if (!order) {
      text(ctx, '— kosong —', x + 102, 63, 13, '#8a6a42', 600);
      continue;
    }
    const frac = Math.max(0, order.patience / order.maxPatience);
    const urgent = frac < 0.35;
    text(ctx, order.name, x + 12, 50, 15, PALETTE.darkText, 800, 'left');
    text(ctx, `$${order.price}+${tipFor(order)}`, x + 192, 50, 13, urgent ? '#c22e22' : '#6b4423', 800, 'right');
    // Patience bar.
    ctx.fillStyle = '#d8c9a3';
    rr(ctx, x + 12, 62, 180, 10, 5);
    ctx.fill();
    ctx.fillStyle = urgent ? '#e5534b' : frac < 0.6 ? '#f2a93b' : '#6fbf5a';
    if (frac > 0) {
      rr(ctx, x + 12, 62, 180 * frac, 10, 5);
      ctx.fill();
    }
    // Recipe needs as tiny icons.
    order.needs.forEach((need, j) => {
      const [id, state] = need.split(':');
      drawIngredient(ctx, id, state, x + 26 + j * 34, 82, 20);
    });
    text(ctx, `${Math.ceil(order.patience)}s`, x + 192, 82, 12, urgent ? '#c22e22' : '#6b4423', 800, 'right');
  }
  // Right cluster: timer, coins, hearts, combo.
  const left = timeLeft(world);
  const rush = inRush(world);
  const timerColor = left <= 10 ? '#e5534b' : rush ? '#ff9d5c' : PALETTE.timer;
  text(ctx, 'SISA WAKTU', 1000, 22, 12, '#c9a06a', 800, 'left');
  text(ctx, `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`,
    1000, 52, 34, timerColor, 800, 'left');
  if (rush) text(ctx, 'RUSH HOUR!', 1000, 82, 13, '#ff9d5c', 800, 'left');
  text(ctx, `KOIN ${board.earned}`, 1180, 30, 16, '#ffd166', 800, 'right');
  const hearts = '♥'.repeat(world.hearts) + '♡'.repeat(Math.max(0, 3 - world.hearts));
  text(ctx, hearts, 1180, 56, 20, '#e5534b', 800, 'right');
  if (board.combo > 1) {
    text(ctx, `KOMBO x${board.combo}`, 1180, 82, 14, '#ff9d5c', 800, 'right');
  }
}

function drawChef(ctx, world) {
  const chef = world.chef;
  const bob = chef.moving ? Math.sin(world.elapsed * 14) * 2 : 0;
  ctx.save();
  ctx.translate(chef.x, chef.y + bob);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 20, 24, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body (apron) + head + tall chef hat.
  ctx.fillStyle = PALETTE.chefShirt;
  rr(ctx, -18, -6, 36, 26, 10);
  ctx.fill();
  ctx.fillStyle = '#d97b4f';
  ctx.fillRect(-18, 8, 36, 6);
  ctx.fillStyle = PALETTE.chefSkin;
  ctx.beginPath();
  ctx.arc(0, -16, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.chefHat;
  ctx.fillRect(-13, -38, 26, 12);
  ctx.beginPath();
  ctx.arc(0, -38, 14, Math.PI, 0);
  ctx.fill();
  // Eyes look where the chef faces.
  ctx.fillStyle = '#2b1d12';
  ctx.beginPath();
  ctx.arc(chef.dx * 4 - 5, -16 + chef.dy * 2, 2, 0, Math.PI * 2);
  ctx.arc(chef.dx * 4 + 5, -16 + chef.dy * 2, 2, 0, Math.PI * 2);
  ctx.fill();
  // Carried item floats above the hat.
  if (world.carrying) {
    const c = world.carrying;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(0, -56, 20, 0, Math.PI * 2);
    ctx.fill();
    if (c.state === 'dish') {
      const recipe = RECIPES.find((r) => r.id === c.id);
      ctx.fillStyle = '#f7ead2';
      ctx.beginPath();
      ctx.ellipse(0, -56, 17, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      text(ctx, recipe ? recipe.name : c.id, 0, -80, 12, '#ffd166', 800);
    } else {
      drawIngredient(ctx, c.id, c.state, 0, -56, 30);
    }
  }
  ctx.restore();
}

function drawParticles(ctx, world) {
  for (const p of world.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const f of world.floaters) {
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
    text(ctx, f.text, f.x, f.y, 18, f.color, 800);
  }
  ctx.globalAlpha = 1;
}

function drawFloor(ctx) {
  ctx.fillStyle = PALETTE.floor;
  ctx.fillRect(0, 104, W, H - 104);
  ctx.fillStyle = PALETTE.floorTile;
  for (let y = 104; y < H; y += 56) {
    for (let x = ((y / 56) % 2) * 28; x < W; x += 56) {
      ctx.fillRect(x + 1, y + 1, 54, 54);
    }
  }
  // Wall band under the order board.
  ctx.fillStyle = PALETTE.wall;
  ctx.fillRect(0, 104, W, 10);
}

function drawHintBar(ctx, world) {
  text(ctx, 'WASD / Panah: jalan   •   E / Spasi: ambil • cincang • masak • sajikan   •   P: jeda   •   M: suara',
    W / 2, H - 14, 13, 'rgba(247,234,210,0.75)', 600);
}

function drawTitleScreen(ctx, world) {
  drawFloor(ctx);
  drawOrderBoard(ctx, world);
  // A dressed kitchen behind the title card.
  drawPantry(ctx, world, false);
  drawChopBoard(ctx, world, false);
  drawStove(ctx, world, 'stoveA', false);
  drawStove(ctx, world, 'stoveB', false);
  drawPlateCounter(ctx, world, false);
  drawServeWindow(ctx, world, false);
  drawTrash(ctx, world, false);
  ctx.fillStyle = 'rgba(20,12,6,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffd166';
  rr(ctx, W / 2 - 330, 150, 660, 330, 18);
  ctx.fill();
  ctx.fillStyle = '#2b1d12';
  rr(ctx, W / 2 - 322, 158, 644, 314, 14);
  ctx.fill();
  text(ctx, 'DAPUR KILAT', W / 2, 210, 52, '#ffd166', 800);
  text(ctx, 'Warung rush: masak cepat, sajikan panas!', W / 2, 258, 20, '#f7ead2', 700);
  text(ctx, 'Ambil bahan di pantry → cincang di talenan → masak di kompor', W / 2, 310, 17, '#c9a06a', 600);
  text(ctx, 'Rakit di piring saji → antar ke jendela sebelum order hangus.', W / 2, 336, 17, '#c9a06a', 600);
  text(ctx, 'Jangan biarkan masakan gosong di kompor. 3 hati. 150 detik.', W / 2, 362, 17, '#c9a06a', 600);
  text(ctx, 'TEKAN ENTER UNTUK MULAI', W / 2, 420, 22, '#ffd166', 800);
  if (world.best > 0) text(ctx, `Rekor shift: ${world.best} koin`, W / 2, 452, 16, '#6fbf5a', 700);
  text(ctx, 'WASD jalan • E interaksi • P jeda • M suara', W / 2, 500, 14, '#8a6a42', 600);
}

function drawPauseScreen(ctx, world) {
  ctx.fillStyle = 'rgba(20,12,6,0.6)';
  ctx.fillRect(0, 0, W, H);
  text(ctx, 'JEDA', W / 2, H / 2 - 20, 56, '#ffd166', 800);
  text(ctx, 'Tekan P untuk lanjut • R untuk mulai ulang', W / 2, H / 2 + 30, 18, '#f7ead2', 600);
}

function drawDayScreen(ctx, world) {
  ctx.fillStyle = 'rgba(20,12,6,0.72)';
  ctx.fillRect(0, 0, W, H);
  const board = world.board;
  text(ctx, 'SHIFT SELESAI!', W / 2, 210, 48, '#ffd166', 800);
  text(ctx, `Koin: ${board.earned}   •   Tersaji: ${board.served}   •   Hangus: ${board.expired}`, W / 2, 280, 22, '#f7ead2', 700);
  text(ctx, `Kombo terbaik: x${board.bestCombo}`, W / 2, 320, 20, '#ff9d5c', 700);
  if (board.earned >= world.best && board.earned > 0) {
    text(ctx, '★ REKOR BARU! ★', W / 2, 360, 24, '#6fbf5a', 800);
  }
  text(ctx, 'Tekan Enter untuk shift berikutnya', W / 2, 420, 20, '#ffd166', 800);
}

function drawGameOverScreen(ctx, world) {
  ctx.fillStyle = 'rgba(20,12,6,0.78)';
  ctx.fillRect(0, 0, W, H);
  text(ctx, 'DAPUR TUTUP...', W / 2, 230, 48, '#e5534b', 800);
  text(ctx, 'Terlalu banyak order hangus. Pelanggan kabur semua.', W / 2, 290, 20, '#f7ead2', 600);
  text(ctx, `Koin: ${world.board.earned}   •   Tersaji: ${world.board.served}`, W / 2, 330, 20, '#f7ead2', 700);
  text(ctx, 'Tekan Enter untuk coba lagi', W / 2, 400, 20, '#ffd166', 800);
}

export function drawWorld(ctx, world) {
  ctx.clearRect(0, 0, W, H);
  if (world.screen === 'title') {
    drawTitleScreen(ctx, world);
    return;
  }
  drawFloor(ctx);
  const near = world.nearStation || null;
  drawPantry(ctx, world, near?.kind === 'pantry');
  drawChopBoard(ctx, world, near?.kind === 'chop');
  drawStove(ctx, world, 'stoveA', near?.key === 'stoveA');
  drawStove(ctx, world, 'stoveB', near?.key === 'stoveB');
  drawPlateCounter(ctx, world, near?.kind === 'plate');
  drawServeWindow(ctx, world, near?.kind === 'serve');
  drawTrash(ctx, world, near?.kind === 'trash');
  drawOrderBoard(ctx, world);
  drawChef(ctx, world);
  drawParticles(ctx, world);
  drawHintBar(ctx, world);
  if (world.screen === 'pause') drawPauseScreen(ctx, world);
  if (world.screen === 'day') drawDayScreen(ctx, world);
  if (world.screen === 'over') drawGameOverScreen(ctx, world);
}

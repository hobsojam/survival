import type { PaletteKey } from './palette';
import type { SpriteDef } from './sprites';

// The flock: skinny after a shearing, woolly, very round, then a giant cloud with tiny legs and a small face peeking out.

type Grid = string[][];
const blank = (width: number, height: number): Grid => Array.from({ length: height }, () => Array.from({ length: width }, () => '.'));
const dot = (g: Grid, x: number, y: number, c: string): void => { if (g[y]?.[x] !== undefined) g[y][x] = c; };
const box = (g: Grid, x: number, y: number, width: number, height: number, c: string): void => {
  for (let yy = y; yy < y + height; yy++) for (let xx = x; xx < x + width; xx++) dot(g, xx, yy, c);
};
const oval = (g: Grid, cx: number, cy: number, rx: number, ry: number, c: string): void => {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
    if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) dot(g, x, y, c);
};
function define(width: number, height: number, painters: Record<string, (g: Grid) => void>, anchor: [number, number]): SpriteDef {
  return { size: [width, height], anchor, legend, frames: Object.fromEntries(Object.entries(painters).map(([name, paint]) => {
    const g = blank(width, height); paint(g); return [name, g.map(row => row.join(''))];
  })) };
}

const legend: Record<string, PaletteKey> = {
  s: 'shadow', a: 'wood0', b: 'wood1', c: 'wood2', d: 'wood3', e: 'wood4',
  w: 'paper', x: 'canvas4', y: 'canvas3', z: 'canvas2', v: 'canvas1',
  k: 'ink', l: 'stone1', p: 'skin3', q: 'skin2', f: 'frost',
  h: 'scarf3', i: 'scarf2', m: 'coat2', n: 'coat3', g: 'coat1'
};

// All looks share one canvas, with the feet at the anchor, so a sheep stays put as it grows.
const SHEEP_W = 48;
const SHEEP_H = 44;
const CX = 24;
const FOOT = 42;

function legs(g: Grid, spread: number, length: number, stride: -1 | 0 | 1, colour = 'l'): void {
  [-spread, -spread + 3, spread - 3, spread].forEach((dx, index) => {
    const lift = stride !== 0 && (index % 2 === 0) === (stride > 0) ? 1 : 0;
    box(g, CX + dx, FOOT - length, 1, length - lift, colour);
  });
}

function head(g: Grid, x: number, y: number): void {
  box(g, x, y, 5, 4, 'k');
  dot(g, x + 3, y + 1, 'w');
  dot(g, x - 1, y, 'k');
}

function woolBlob(g: Grid, rx: number, ry: number, cy: number): void {
  oval(g, CX, cy, rx, ry, 'z');
  oval(g, CX, cy - 1, rx - 1, ry - 1, 'y');
  oval(g, CX - 1, cy - 2, rx - 2, ry - 2, 'x');
  // Bumps of wool, so it reads as fleece rather than a ball.
  const bumps = Math.max(4, Math.round(rx / 2));
  for (let i = 0; i < bumps; i++) {
    const angle = Math.PI * (i / (bumps - 1));
    oval(g, CX + Math.cos(angle) * (rx - 1), cy - Math.sin(angle) * (ry - 1), 2, 2, 'x');
  }
  oval(g, CX - rx / 3, cy - ry / 3, rx / 3, ry / 4, 'w');
}

function shorn(g: Grid, stride: -1 | 0 | 1): void {
  oval(g, CX, FOOT, 7, 1, 's');
  legs(g, 5, 5, stride);
  oval(g, CX, FOOT - 7, 6, 3, 'q');
  oval(g, CX - 1, FOOT - 8, 5, 2, 'p');
  head(g, CX + 5, FOOT - 12);
  dot(g, CX - 7, FOOT - 9, 'x');
}

function woolly(g: Grid, stride: -1 | 0 | 1): void {
  oval(g, CX, FOOT, 9, 1, 's');
  legs(g, 6, 4, stride);
  woolBlob(g, 9, 6, FOOT - 9);
  head(g, CX + 7, FOOT - 13);
}

function round(g: Grid, stride: -1 | 0 | 1): void {
  oval(g, CX, FOOT, 13, 1, 's');
  legs(g, 7, 3, stride);
  woolBlob(g, 14, 10, FOOT - 12);
  head(g, CX + 12, FOOT - 15);
}

function cloud(g: Grid, stride: -1 | 0 | 1): void {
  oval(g, CX, FOOT, 16, 1, 's');
  legs(g, 6, 4, stride);
  woolBlob(g, 22, 17, FOOT - 21);
  oval(g, CX - 11, FOOT - 28, 8, 7, 'x');
  oval(g, CX + 9, FOOT - 30, 9, 7, 'w');
  oval(g, CX - 2, FOOT - 33, 8, 6, 'w');
  // The small face peeking out, low down at the front: this is the joke.
  oval(g, CX + 14, FOOT - 11, 5, 5, 'y');
  box(g, CX + 13, FOOT - 13, 5, 4, 'k');
  dot(g, CX + 16, FOOT - 12, 'w');
}

const STRIDES = { Idle: 0, Walk: 1 } as const;
const painters = Object.fromEntries(Object.entries({ shorn, woolly, round, cloud }).flatMap(([stage, paint]) =>
  Object.entries(STRIDES).map(([motion, stride]) => [`${stage}${motion}`, (g: Grid) => paint(g, stride)]))) as Record<string, (g: Grid) => void>;

function snowCap(g: Grid, width: number, height: number): void {
  const cx = 12;
  const cy = 7 - height;
  oval(g, cx, cy, width / 2, height, 'f');
  oval(g, cx - 1, cy - 1, width / 2 - 2, height - 1, 'w');
  box(g, cx - width / 2, 7, width, 1, 'f');
}

function rail(g: Grid, x0: number, x1: number, y: number): void {
  box(g, x0, y, x1 - x0, 1, 'd');
  box(g, x0, y + 1, x1 - x0, 1, 'b');
}

function post(g: Grid, x: number, y: number, height: number): void {
  box(g, x, y, 2, height, 'c');
  box(g, x, y, 1, height, 'd');
  dot(g, x + 1, y + height - 1, 'a');
}

function feedRack(g: Grid, x: number, y: number): void {
  box(g, x, y + 8, 20, 3, 'b');
  box(g, x + 1, y + 1, 18, 8, 'i');
  for (let xx = x + 2; xx < x + 18; xx += 3) box(g, xx, y, 2, 8, 'h');
  for (let xx = x; xx <= x + 18; xx += 6) box(g, xx, y, 2, 11, 'c');
  box(g, x, y, 20, 1, 'd');
}

const POSTS_X = [0, 18, 36, 58, 76, 94];

function pen(g: Grid): void {
  // The back of the fence, with the rack against it.
  rail(g, 0, 96, 5);
  rail(g, 0, 96, 10);
  POSTS_X.forEach(x => post(g, x, 2, 14));
  feedRack(g, 38, 15);
  // The sides.
  for (const x of [1, 94]) box(g, x, 8, 1, 62, 'b');
  for (let y = 4; y < 74; y += 13) {
    post(g, 0, y, 7);
    post(g, 94, y, 7);
  }
  // The front, open across the gate.
  for (const [x0, x1] of [[0, 38], [58, 96]] as const) {
    rail(g, x0, x1, 69);
    rail(g, x0, x1, 74);
  }
  POSTS_X.forEach(x => post(g, x, 66, 14));
  // The gate, shut, with a brace across it.
  rail(g, 38, 58, 70);
  rail(g, 38, 58, 75);
  for (let i = 0; i < 18; i++) dot(g, 39 + i, 76 - Math.round(i * 6 / 18), 'd');
}

function penSite(g: Grid): void {
  for (const [x, y] of [[1, 3], [46, 3], [93, 3], [1, 40], [93, 40], [1, 76], [46, 76], [93, 76]] as const) {
    box(g, x, y, 2, 3, 'c');
    dot(g, x, y, 'd');
  }
  for (let x = 5; x < 92; x += 6) { dot(g, x, 4, 'v'); dot(g, x, 77, 'v'); }
  for (let y = 7; y < 75; y += 6) { dot(g, 2, y, 'v'); dot(g, 94, y, 'v'); }
}

function loom(g: Grid): void {
  oval(g, 16, 29, 13, 2, 's');
  box(g, 5, 4, 2, 25, 'c'); box(g, 25, 4, 2, 25, 'c');
  box(g, 5, 4, 1, 25, 'd'); box(g, 25, 4, 1, 25, 'd');
  box(g, 3, 3, 26, 2, 'd'); box(g, 3, 5, 26, 1, 'b');
  // The warp above, and the cloth growing below it.
  for (let x = 8; x < 25; x += 2) box(g, x, 6, 1, 10, 'x');
  box(g, 8, 16, 16, 9, 'y');
  for (let y = 17; y < 25; y += 3) box(g, 8, y, 16, 1, 'z');
  box(g, 7, 24, 18, 2, 'b');
  box(g, 7, 15, 18, 1, 'b');
}

function loomSite(g: Grid): void {
  for (const [x, y] of [[4, 4], [26, 4], [4, 12], [26, 12]] as const) box(g, x, y, 2, 2, 'c');
  for (let x = 8; x < 25; x += 4) dot(g, x, 8, 'v');
}

function rug(g: Grid): void {
  box(g, 1, 1, 26, 10, 'g');
  box(g, 2, 2, 24, 8, 'm');
  box(g, 4, 4, 20, 4, 'n');
  box(g, 6, 5, 16, 2, 'h');
  for (let y = 1; y < 11; y += 2) { dot(g, 0, y, 'y'); dot(g, 27, y, 'y'); }
}

export const sheepSprites: Record<string, SpriteDef> = {
  sheep: define(SHEEP_W, SHEEP_H, painters, [CX, FOOT]),
  sheepSnow: define(24, 8, { small: g => snowCap(g, 10, 2), large: g => snowCap(g, 22, 4) }, [12, 7]),
  sheepPen: define(96, 80, { built: pen }, [56, 48]),
  sheepPenSite: define(96, 80, { still: penSite }, [56, 48]),
  loom: define(32, 32, { built: loom }, [16, 29]),
  loomSite: define(32, 16, { still: loomSite }, [16, 14]),
  rug: define(28, 12, { still: rug }, [14, 6])
};

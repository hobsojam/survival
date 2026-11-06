import type { PaletteKey } from './palette';
import { box, define, dot, oval, type Grid } from './sheepSprites';
import type { SpriteDef } from './sprites';

// The hills: the rocky outcrop with its rust-red ore, and a dropped pile of it.

const legend: Record<string, PaletteKey> = { a: 'stone0', b: 'stone1', c: 'stone2', d: 'stone3', e: 'stone4', r: 'fire0', s: 'fire1', u: 'earth1', v: 'earth2', k: 'shadow' };

const OUTCROP_W = 44;
const OUTCROP_H = 32;

function rock(g: Grid): void {
  oval(g, 22, 29, 21, 3, 'k');
  oval(g, 22, 20, 19, 11, 'a');
  oval(g, 21, 19, 18, 10, 'b');
  oval(g, 13, 22, 9, 7, 'c');
  oval(g, 28, 15, 11, 8, 'c');
  oval(g, 27, 12, 7, 4, 'd');
  oval(g, 12, 19, 4, 2, 'd');
  box(g, 25, 9, 4, 1, 'e');
  box(g, 10, 17, 3, 1, 'e');
}

/** Rust-red streaks that a pickaxe could follow. */
function seam(g: Grid, x: number, y: number, length: number): void {
  for (let i = 0; i < length; i++) {
    const drift = Math.floor(i / 2);
    dot(g, x + i, y + drift, 's');
    dot(g, x + i, y + drift + 1, 'r');
    if (i % 3 === 0) dot(g, x + i, y + drift - 1, 's');
  }
}

function outcropReady(g: Grid): void {
  rock(g);
  seam(g, 9, 15, 11);
  seam(g, 22, 12, 12);
  seam(g, 16, 23, 9);
}

/** Dug out for today: the streaks are chipped pale, with a few chips at the foot. */
function outcropSpent(g: Grid): void {
  rock(g);
  seam(g, 22, 12, 4);
  box(g, 11, 17, 8, 3, 'a');
  box(g, 26, 16, 7, 3, 'a');
  box(g, 17, 25, 7, 2, 'a');
  for (const [x, y] of [[8, 27], [15, 29], [30, 28], [34, 26]] as const) box(g, x, y, 2, 1, 'd');
}

function orePile(g: Grid, count: 1 | 2 | 3): void {
  const lump = (x: number, y: number): void => {
    oval(g, x, y, 4, 3, 'b');
    oval(g, x - 1, y - 1, 2.5, 1.5, 'c');
    dot(g, x, y, 's');
    dot(g, x + 1, y, 'r');
    dot(g, x - 1, y + 1, 's');
  };
  oval(g, 8, 13, 7, 2, 'k');
  lump(5, 10);
  if (count >= 2) lump(11, 10);
  if (count >= 3) lump(8, 7);
}

export const hillsSprites: Record<string, SpriteDef> = {
  outcrop: define(OUTCROP_W, OUTCROP_H, { ready: outcropReady, spent: outcropSpent }, [OUTCROP_W / 2, OUTCROP_H - 3], legend),
  orePile: define(16, 16, { one: g => orePile(g, 1), two: g => orePile(g, 2), many: g => orePile(g, 3) }, [8, 12], legend)
};

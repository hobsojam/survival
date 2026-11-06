import type { PaletteKey } from './palette';
import { box, define, dot, oval, type Grid } from './sheepSprites';
import type { SpriteDef } from './sprites';

// The hills: the rocky outcrop with its rust-red ore, a dropped pile of it, and the forge that works it.

const legend: Record<string, PaletteKey> = { a: 'stone0', b: 'stone1', c: 'stone2', d: 'stone3', e: 'stone4', r: 'fire0', s: 'fire1', t: 'fire3', u: 'earth1', v: 'earth2', k: 'shadow' };

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

const FORGE_W = 30;
const FORGE_H = 32;

/** A stone lean-to against the workshop: a chimney, a sloping roof, an anvil on a block, and coals in the hearth. */
function forge(g: Grid, coals: 'a' | 'b'): void {
  box(g, 1, 27, 28, 3, 'k');
  box(g, 16, 2, 8, 26, 'b');
  box(g, 17, 3, 6, 24, 'c');
  for (let y = 5; y < 26; y += 4) box(g, 17, y, 6, 1, 'b');
  box(g, 15, 1, 10, 2, 'a');
  box(g, 2, 13, 15, 2, 'u');
  box(g, 1, 11, 17, 2, 'v');
  box(g, 3, 15, 2, 13, 'u');
  // The hearth, set into the chimney's foot.
  box(g, 16, 19, 8, 8, 'a');
  box(g, 17, 22, 6, 5, coals === 'a' ? 'r' : 's');
  box(g, 18, 24, 4, 3, coals === 'a' ? 's' : 't');
  dot(g, 19 + (coals === 'a' ? 0 : 1), 25, 't');
  // The anvil on its block.
  box(g, 8, 24, 5, 4, 'u');
  box(g, 9, 22, 3, 2, 'a');
  box(g, 6, 20, 8, 2, 'b');
  box(g, 6, 20, 8, 1, 'c');
  dot(g, 5, 20, 'b');
}

export const hillsSprites: Record<string, SpriteDef> = {
  forge: define(FORGE_W, FORGE_H, { a: g => forge(g, 'a'), b: g => forge(g, 'b') }, [FORGE_W / 2, FORGE_H - 4], legend),
  outcrop: define(OUTCROP_W, OUTCROP_H, { ready: outcropReady, spent: outcropSpent }, [OUTCROP_W / 2, OUTCROP_H - 3], legend),
  orePile: define(16, 16, { one: g => orePile(g, 1), two: g => orePile(g, 2), many: g => orePile(g, 3) }, [8, 12], legend)
};

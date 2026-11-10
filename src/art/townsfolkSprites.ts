import type { PaletteKey } from './palette';
import { box, define, dot, type Grid } from './sheepSprites';
import type { SpriteDef } from './sprites';

// EASTER EGG: the town, see src/game/town.ts. The town's people, at the survivor's size: a plain tunic, a hood or
// bare head, and boots. Each name gets one of a few sets of colours, so neighbours can be told apart.

const base: Record<string, PaletteKey> = { s: 'shadow', c: 'skin2', d: 'skin3', e: 'skin4', q: 'wood1', r: 'wood3', i: 'ink' };

/** Hair, tunic (dark, mid, light) and belt for each set of colours. */
const DRESS: readonly Record<'a' | 'f' | 'g' | 'h' | 'k', PaletteKey>[] = [
  { a: 'hair1', f: 'leaf0', g: 'leaf1', h: 'leaf2', k: 'wood2' },
  { a: 'hair3', f: 'berry0', g: 'berry1', h: 'berry2', k: 'wood1' },
  { a: 'hair0', f: 'bird0', g: 'bird1', h: 'bird2', k: 'scarf1' },
  { a: 'hair2', f: 'earth0', g: 'earth1', h: 'earth2', k: 'wood0' }
];

/** A person facing the viewer: `stride` moves the feet apart, `arm` lifts one arm at work. */
export function person(g: Grid, stride: number, arm: number): void {
  box(g, 5, 21, 7, 1, 's'); box(g, 3, 22, 11, 1, 's');
  box(g, 5 + stride, 19, 3, 3, 'q'); box(g, 9 - stride, 19, 3, 3, 'q');
  dot(g, 5 + stride, 19, 'r'); dot(g, 9 - stride, 19, 'r');
  box(g, 4, 11, 9, 9, 'f'); box(g, 5, 11, 7, 8, 'g'); box(g, 6, 12, 5, 6, 'h');
  box(g, 4, 16, 9, 1, 'k');
  box(g, 2, 12 - arm, 3, 5, 'f'); box(g, 3, 13 - arm, 2, 3, 'g'); box(g, 3, 16 - arm, 2, 2, 'c');
  box(g, 12, 12, 3, 5, 'f'); box(g, 12, 13, 2, 3, 'g'); box(g, 12, 16, 2, 2, 'c');
  box(g, 4, 2, 9, 9, 'a');
  box(g, 5, 5, 7, 6, 'd'); box(g, 6, 5, 5, 3, 'e');
  dot(g, 7, 7, 'i'); dot(g, 10, 7, 'i'); dot(g, 8, 9, 'c');
}

const frames: Record<string, (g: Grid) => void> = {
  stand: g => person(g, 0, 0),
  walk0: g => person(g, 1, 0),
  walk1: g => person(g, -1, 0),
  work: g => person(g, 0, 3)
};

export const TOWNSFOLK_DRESSES = DRESS.length;

export const townsfolkSprites: Record<string, SpriteDef> = Object.fromEntries(
  DRESS.map((dress, i) => [`townsfolk${i}`, define(16, 24, frames, [8, 21], { ...base, ...dress })])
);

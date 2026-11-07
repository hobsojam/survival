import type { PaletteKey } from './palette';
import { box, define, dot, oval, type Grid } from './sheepSprites';
import type { SpriteDef } from './sprites';
import { WALLS } from '../game/castle';

// EASTER EGG: the castle, see src/game/castle.ts. The line of old stones the survivor sees from the top of the keep:
// a faint, broken outline in the grass where the curtain wall will run. It is drawn from one corner, a tile's width of
// pixels to each tile between the walls, so it lines up with where the stones will go.

const TILE_PX = 16;
const LINE_W = (WALLS.right - WALLS.left) * TILE_PX + 3;
const LINE_H = (WALLS.bottom - WALLS.top) * TILE_PX + 3;

const legend: Record<string, PaletteKey> = { a: 'stone1', b: 'stone2', c: 'stone0' };

/** A broken run of stones along one side: two of every three places filled, the odd one a paler stone. */
function run(g: Grid, x: number, y: number, length: number, across: boolean): void {
  for (let i = 0, at = 0; at < length; i++, at += 5) {
    if (i % 3 === 2) continue;
    const colour = i % 4 === 0 ? 'b' : 'a';
    if (across) box(g, x + at, y, 3, 2, colour);
    else box(g, x, y + at, 2, 3, colour);
  }
}

function still(g: Grid): void {
  run(g, 0, 0, LINE_W - 3, true);
  run(g, 0, LINE_H - 2, LINE_W - 3, true);
  run(g, 0, 0, LINE_H - 3, false);
  run(g, LINE_W - 2, 0, LINE_H - 3, false);
  for (const [x, y] of [[0, 0], [LINE_W - 3, 0], [0, LINE_H - 3], [LINE_W - 3, LINE_H - 3]] as const) box(g, x, y, 3, 3, 'c');
}

/** One flagstone of the road, in two shades so a row of them doesn't look stamped. */
const stone = (face: string, edge: string) => (g: Grid): void => {
  box(g, 1, 1, 10, 6, edge);
  box(g, 2, 1, 8, 5, face);
  box(g, 3, 2, 3, 1, 'c');
};

/** A straight run of pixels between two points. */
const line = (g: Grid, x0: number, y0: number, x1: number, y1: number, c: string): void => {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i++) dot(g, Math.round(x0 + (x1 - x0) * i / Math.max(steps, 1)), Math.round(y0 + (y1 - y0) * i / Math.max(steps, 1)), c);
};

const cartLegend: Record<string, PaletteKey> = { a: 'wood0', b: 'wood1', c: 'wood2', d: 'wood3', s: 'stone1', t: 'stone2', u: 'stone3', w: 'shadow' };

/** The stone cart: a plank bed on one wheel and two shafts for the pony, loaded with rough stones as it fills. */
function cart(g: Grid, load: 'empty' | 'some' | 'full'): void {
  oval(g, 10, 12, 9, 1.5, 'w');
  line(g, 13, 8, 19, 10, 'a'); line(g, 13, 7, 19, 9, 'c'); line(g, 18, 10, 18, 12, 'a');
  const rock = (x: number, y: number): void => { box(g, x, y, 4, 3, 's'); box(g, x + 1, y, 2, 2, 't'); dot(g, x + 1, y, 'u'); };
  if (load !== 'empty') { rock(2, 4); rock(7, 4); }
  if (load === 'full') { rock(4, 2); rock(9, 2); rock(6, 0); }
  box(g, 1, 6, 13, 4, 'a'); box(g, 2, 6, 11, 3, 'c'); line(g, 2, 7, 12, 7, 'b'); line(g, 7, 6, 7, 8, 'b');
  oval(g, 7, 10.5, 3, 2.5, 'a'); oval(g, 7, 10.5, 2, 1.5, 'b');
  line(g, 5, 10, 9, 11, 'd'); line(g, 7, 9, 7, 12, 'd'); dot(g, 7, 10, 'd');
}

export const castleSprites: Record<string, SpriteDef> = {
  castleLine: define(LINE_W, LINE_H, { still }, [1, 1], legend),
  castleRoad: define(12, 8, { a: stone('b', 'a'), b: stone('a', 'b') }, [6, 4], legend),
  castleCart: define(20, 14, { empty: g => cart(g, 'empty'), some: g => cart(g, 'some'), full: g => cart(g, 'full') }, [10, 12], cartLegend)
};

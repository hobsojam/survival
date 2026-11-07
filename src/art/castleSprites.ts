import type { PaletteKey } from './palette';
import { box, define, type Grid } from './sheepSprites';
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

export const castleSprites: Record<string, SpriteDef> = {
  castleLine: define(LINE_W, LINE_H, { still }, [1, 1], legend)
};

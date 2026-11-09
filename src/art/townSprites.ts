import type { PaletteKey } from './palette';
import { box, define, dot, type Grid } from './sheepSprites';
import type { SpriteDef } from './sprites';

// EASTER EGG: the town, see src/game/town.ts. A small stone house with a thatched roof, drawn at each of its stages:
// its footings, its walls, its roof, and its door and chimney once it is finished.

const HOUSE_W = 36;
const HOUSE_H = 38;
const HOUSE_BASE = 34;
const WALL_H = 16;
const ROOF_H = 13;
const DOOR = { x: 8, w: 7, h: 11 };
const WINDOW = { x: 23, y: HOUSE_BASE - 11, w: 6, h: 5 };
const CHIMNEY = { x: 26, w: 4 };

const legend: Record<string, PaletteKey> = {
  a: 'stone0', b: 'stone1', c: 'stone2', d: 'stone3', k: 'shadow', i: 'ink',
  t: 'wood1', u: 'wood2', q: 'wood3', h: 'scarf1', H: 'scarf2', g: 'scarf3', W: 'paper'
};

/** Rough stone from the foot up to a height, with staggered joints. */
function stones(g: Grid, height: number): void {
  box(g, 2, HOUSE_BASE - height + 1, HOUSE_W - 4, height, 'c');
  for (let row = 0, y = HOUSE_BASE - 3; y > HOUSE_BASE - height; row++, y -= 4) {
    for (let x = 2 + (row % 2) * 3; x < HOUSE_W - 2; x += 6) box(g, x, y, 1, 3, 'b');
    box(g, 2, y + 3, HOUSE_W - 4, 1, 'b');
  }
  box(g, 2, HOUSE_BASE - height + 1, 1, height, 'd');
  box(g, HOUSE_W - 3, HOUSE_BASE - height + 1, 1, height, 'a');
}

/** The thatch: rows stepping in to a ridge, darker under the eaves, with snow lying on it in winter. */
function thatch(g: Grid, winter: boolean): void {
  const eaves = HOUSE_BASE - WALL_H;
  for (let row = 0; row < ROOF_H; row++) {
    const inset = Math.round((ROOF_H - 1 - row) * 1.2);
    box(g, inset, eaves - ROOF_H + 1 + row, HOUSE_W - inset * 2, 1, row === ROOF_H - 1 ? 'h' : row % 3 === 0 ? 'g' : 'H');
    if (winter && row % 4 === 0) box(g, inset + 1, eaves - ROOF_H + 1 + row, HOUSE_W - inset * 2 - 2, 1, 'W');
  }
}

function house(g: Grid, stage: number, winter: boolean): void {
  box(g, 0, HOUSE_BASE + 1, HOUSE_W, 3, 'k');
  if (stage === 1) {
    stones(g, 4);
    box(g, DOOR.x, HOUSE_BASE - 3, DOOR.w, 4, 'k');
    if (winter) box(g, 2, HOUSE_BASE - 3, HOUSE_W - 4, 1, 'W');
    return;
  }
  stones(g, WALL_H);
  box(g, DOOR.x, HOUSE_BASE - DOOR.h + 1, DOOR.w, DOOR.h, 'k');
  box(g, DOOR.x - 1, HOUSE_BASE - DOOR.h, DOOR.w + 2, 1, 'd');
  box(g, WINDOW.x, WINDOW.y, WINDOW.w, WINDOW.h, 'k');
  if (stage === 2) {
    box(g, 2, HOUSE_BASE - WALL_H + 1, HOUSE_W - 4, 1, 'd');
    if (winter) box(g, 2, HOUSE_BASE - WALL_H + 1, HOUSE_W - 4, 1, 'W');
    return;
  }
  if (stage >= 4) {
    // The chimney goes up through the thatch from the hearth, and the door is hung.
    const top = HOUSE_BASE - WALL_H - ROOF_H - 2;
    box(g, CHIMNEY.x, top, CHIMNEY.w, ROOF_H, 'c');
    box(g, CHIMNEY.x, top, CHIMNEY.w, 1, 'a');
  }
  thatch(g, winter);
  if (stage >= 4) {
    box(g, CHIMNEY.x, HOUSE_BASE - WALL_H - ROOF_H - 2, CHIMNEY.w, 4, 'c');
    box(g, CHIMNEY.x, HOUSE_BASE - WALL_H - ROOF_H - 2, CHIMNEY.w, 1, winter ? 'W' : 'a');
    box(g, DOOR.x, HOUSE_BASE - DOOR.h + 1, DOOR.w, DOOR.h, 'u');
    for (let x = DOOR.x + 2; x < DOOR.x + DOOR.w; x += 2) box(g, x, HOUSE_BASE - DOOR.h + 1, 1, DOOR.h, 't');
    dot(g, DOOR.x + DOOR.w - 2, HOUSE_BASE - 5, 'i');
    box(g, WINDOW.x - 1, WINDOW.y, 1, WINDOW.h, 'q');
    box(g, WINDOW.x + WINDOW.w, WINDOW.y, 1, WINDOW.h, 'q');
  }
}

const houseFrames: Record<string, (g: Grid) => void> = {};
for (let stage = 1; stage <= 4; stage++) {
  houseFrames[`${stage}`] = g => house(g, stage, false);
  houseFrames[`${stage}s`] = g => house(g, stage, true);
}

export const townSprites: Record<string, SpriteDef> = {
  townHouse: define(HOUSE_W, HOUSE_H, houseFrames, [DOOR.x + 3, HOUSE_BASE + 1], legend)
};

import type { PaletteKey } from './palette';
import { box, define, dot, oval, type Grid } from './sheepSprites';
import type { SpriteDef } from './sprites';

// EASTER EGG: the town, see src/game/town.ts. The stone bridge over the stream at the hills' foot, seen from the bank
// above as the survivor walks down onto it; the bracken over the old road in the meadow; and the road's milestone.

const legend: Record<string, PaletteKey> = {
  a: 'stone0', b: 'stone1', c: 'stone2', d: 'stone3', k: 'shadow', W: 'paper', I: 'frost',
  s: 'storm', l: 'flower4', t: 'wood1', u: 'wood2', q: 'wood3',
  g: 'grass1', h: 'grass2', G: 'grass3', e: 'earth1', r: 'earth2', R: 'earth3'
};

const BRIDGE_W = 56;
const BRIDGE_H = 40;
/** The deck runs down the middle, three tiles of walking width, between two parapets. */
const DECK = { left: 8, right: 48 };
const PIERS = [{ x: 8, w: 9 }, { x: 39, w: 9 }];
const WATER_TOP = 33;

/** Rough coursed stone over a box, joints staggered row by row. */
function coursed(g: Grid, x: number, y: number, w: number, h: number): void {
  box(g, x, y, w, h, 'c');
  for (let row = 0, yy = y + 2; yy < y + h; row++, yy += 3) {
    box(g, x, yy, w, 1, 'b');
    for (let xx = x + 2 + (row % 2) * 3; xx < x + w - 1; xx += 6) dot(g, xx, yy - 1, 'b');
  }
  box(g, x, y, 1, h, 'd');
  box(g, x + w - 1, y, 1, h, 'a');
}

/** The stream running under the bridge, with ripples, or ice in winter. */
function water(g: Grid, winter: boolean): void {
  box(g, 0, WATER_TOP, BRIDGE_W, BRIDGE_H - WATER_TOP, winter ? 'I' : 's');
  for (let x = 2; x < BRIDGE_W; x += 9) box(g, x, WATER_TOP + 2 + (x % 3), 3, 1, winter ? 'W' : 'l');
}

function piers(g: Grid, winter: boolean): void {
  for (const pier of PIERS) {
    box(g, pier.x - 1, BRIDGE_H - 2, pier.w + 2, 2, 'k');
    coursed(g, pier.x, WATER_TOP - 6, pier.w, BRIDGE_H - WATER_TOP + 4);
    if (winter) box(g, pier.x, WATER_TOP - 6, pier.w, 1, 'W');
  }
}

/** The timber centering the arch is turned on, beams across between the piers. */
function centering(g: Grid): void {
  for (const y of [WATER_TOP - 5, WATER_TOP - 2]) box(g, PIERS[0].x + PIERS[0].w, y, PIERS[1].x - PIERS[0].x - PIERS[0].w, 2, 'u');
  for (let x = PIERS[0].x + PIERS[0].w + 2; x < PIERS[1].x; x += 5) box(g, x, WATER_TOP - 5, 1, 5, 'q');
}

/** The deck from the bank down over the arch, with the arch's dark opening over the water. */
function deck(g: Grid, winter: boolean): void {
  coursed(g, DECK.left, 2, DECK.right - DECK.left, WATER_TOP - 2);
  oval(g, 28, WATER_TOP + 2, 11, 5, 'k');
  box(g, DECK.left + 4, 2, DECK.right - DECK.left - 8, WATER_TOP - 6, 'R');
  for (let y = 5; y < WATER_TOP - 4; y += 4) box(g, DECK.left + 6 + (y % 8), y, 6, 1, 'r');
  if (winter) for (let y = 4; y < WATER_TOP - 4; y += 6) box(g, DECK.left + 5, y, DECK.right - DECK.left - 10, 1, 'W');
}

/** The parapets either side of the deck, capped, with snow on the caps in winter. */
function parapets(g: Grid, winter: boolean): void {
  for (const x of [DECK.left - 2, DECK.right - 4]) {
    coursed(g, x, 0, 6, WATER_TOP + 1);
    box(g, x, 0, 6, 1, winter ? 'W' : 'a');
  }
}

function bridge(g: Grid, stage: 'piers' | 'arch' | 'deck' | 'done', winter: boolean): void {
  water(g, winter);
  piers(g, winter);
  if (stage === 'piers') return;
  if (stage === 'arch') {
    centering(g);
    oval(g, 28, WATER_TOP - 3, 13, 4, 'c');
    oval(g, 28, WATER_TOP - 1, 10, 3, 'k');
    box(g, 15, WATER_TOP - 1, 26, 3, 'u');
    return;
  }
  deck(g, winter);
  if (stage === 'deck') {
    for (const x of [DECK.left - 2, DECK.right - 4]) coursed(g, x, WATER_TOP - 6, 6, 7);
    return;
  }
  parapets(g, winter);
}

const ROAD_W = 104;
const ROAD_H = 24;

/** Bracken and long grass grown over a stretch of the road: thick while wild, in clumps with the old stones showing once half cleared. Rusty in autumn's place of winter, under snow. */
function brush(g: Grid, half: boolean, winter: boolean): void {
  for (let x = 1; x < ROAD_W - 1; x += half ? 9 : 5) {
    const y = 9 + ((x * 7) % 5);
    const clump = half ? 4 : 5;
    oval(g, x + 2, y, clump, 4, winter ? 'W' : 'g');
    oval(g, x + 1, y - 1, clump - 2, 2, winter ? 'I' : (x % 3 === 0 ? 'G' : 'h'));
    if (!winter) for (let i = -2; i <= 2; i += 2) dot(g, x + 2 + i, y - 4 + Math.abs(i), 'G');
  }
  if (half) for (let x = 6; x < ROAD_W; x += 9) { box(g, x, 12, 3, 2, 'c'); dot(g, x, 12, 'a'); }
}

/** The milestone: a stub of stone, then a standing stone with the road's mark cut in it. */
function milestone(g: Grid, done: boolean, winter: boolean): void {
  box(g, 1, 17, 10, 3, 'k');
  if (!done) {
    coursed(g, 2, 11, 8, 8);
    if (winter) box(g, 2, 11, 8, 1, 'W');
    return;
  }
  coursed(g, 2, 2, 8, 17);
  box(g, 3, 1, 6, 1, winter ? 'W' : 'c');
  box(g, 4, 7, 4, 1, 'k');
  box(g, 5, 7, 1, 6, 'k');
  if (winter) box(g, 2, 2, 8, 1, 'W');
}

const frames = <T extends string>(names: readonly T[], paint: (g: Grid, name: T, winter: boolean) => void): Record<string, (g: Grid) => void> =>
  Object.fromEntries(names.flatMap(name => [[name, (g: Grid) => paint(g, name, false)], [`${name}s`, (g: Grid) => paint(g, name, true)]]));

export const meadowSprites: Record<string, SpriteDef> = {
  townBridge: define(BRIDGE_W, BRIDGE_H, frames(['piers', 'arch', 'deck', 'done'] as const, bridge), [28, 30], legend),
  roadBrush: define(ROAD_W, ROAD_H, frames(['wild', 'half'] as const, (g, name, winter) => brush(g, name === 'half', winter)), [52, 12], legend),
  milestone: define(12, 20, frames(['low', 'done'] as const, (g, name, winter) => milestone(g, name === 'done', winter)), [6, 19], legend)
};

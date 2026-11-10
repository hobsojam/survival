import type { PaletteKey } from './palette';
import { box, define, dot, oval, type Grid } from './sheepSprites';
import type { SpriteDef } from './sprites';

// EASTER EGG: the town, see src/game/town.ts. The stone bridge over the stream at the hills' foot, seen from the bank
// above as the survivor walks down onto it; the bracken over the old road in the meadow; and the road's milestone.

const legend: Record<string, PaletteKey> = {
  a: 'stone0', b: 'stone1', c: 'stone2', d: 'stone3', k: 'shadow', W: 'paper', I: 'frost',
  s: 'storm', l: 'flower4', t: 'wood1', u: 'wood2', q: 'wood3',
  g: 'grass1', h: 'grass2', G: 'grass3', n: 'grass0', e: 'earth1', r: 'earth2', R: 'earth3'
};

const BRIDGE_W = 56;
/** Tall enough to reach from the bank to the map's bottom edge, so the deck runs on off it. */
const BRIDGE_H = 44;
/** The deck runs down the middle, three tiles of walking width, between two parapets. */
const DECK = { left: 8, right: 48 };
const PIERS = [{ x: 8, w: 9 }, { x: 39, w: 9 }];
/** Where the stream's water starts, level with the bank row's water on the map, so the bridge leaves the bank and runs out over it. */
const WATER_TOP = 20;

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
  for (let x = 2; x < BRIDGE_W; x += 9) box(g, x, WATER_TOP + 4 + (x % 3) * 3, 3, 1, winter ? 'W' : 'l');
}

/** The two piers standing in the water, each with a pointed cutwater upstream and its shadow on the water downstream. */
function piers(g: Grid, winter: boolean): void {
  for (const pier of PIERS) {
    box(g, pier.x + 1, WATER_TOP + 1, pier.w, BRIDGE_H - WATER_TOP - 1, 'k');
    coursed(g, pier.x, WATER_TOP - 2, pier.w, BRIDGE_H - WATER_TOP - 2);
    for (let i = 0; i < 3; i++) box(g, pier.x + 1 + i, BRIDGE_H - 4 + i, pier.w - 2 - i * 2, 1, 'c');
    if (winter) box(g, pier.x, WATER_TOP - 2, pier.w, 1, 'W');
  }
}

/** The timber centering the arch is turned on, beams across the water between the piers. */
function centering(g: Grid): void {
  const [from, to] = [PIERS[0].x + PIERS[0].w, PIERS[1].x];
  for (const y of [WATER_TOP + 4, WATER_TOP + 10]) box(g, from, y, to - from, 2, 'u');
  for (let x = from + 2; x < to; x += 5) box(g, x, WATER_TOP + 4, 1, 8, 'q');
}

/** The deck from the bank out over the water and on off the map's edge, its shadow on the water beside it. */
function deck(g: Grid, winter: boolean): void {
  box(g, DECK.left - 1, WATER_TOP, 1, BRIDGE_H - WATER_TOP, 'k');
  box(g, DECK.right, WATER_TOP, 3, BRIDGE_H - WATER_TOP, 'k');
  coursed(g, DECK.left, 0, DECK.right - DECK.left, BRIDGE_H);
  box(g, DECK.left + 4, 0, DECK.right - DECK.left - 8, BRIDGE_H, 'R');
  for (let y = 3; y < BRIDGE_H; y += 4) box(g, DECK.left + 6 + (y % 8), y, 6, 1, 'r');
  if (winter) for (let y = 2; y < BRIDGE_H; y += 6) box(g, DECK.left + 5, y, DECK.right - DECK.left - 10, 1, 'W');
}

/** The parapets either side of the deck, the whole way along, capped, with snow on the caps in winter. */
function parapets(g: Grid, winter: boolean): void {
  for (const x of [DECK.left - 2, DECK.right - 4]) {
    coursed(g, x, 0, 6, BRIDGE_H);
    box(g, x + 1, 0, 4, 1, 'd');
    if (winter) box(g, x + 1, 0, 4, BRIDGE_H, 'W');
  }
}

function bridge(g: Grid, stage: 'piers' | 'arch' | 'deck' | 'done', winter: boolean): void {
  water(g, winter);
  piers(g, winter);
  if (stage === 'piers') return;
  if (stage === 'arch') {
    centering(g);
    coursed(g, PIERS[0].x, WATER_TOP - 2, PIERS[1].x + PIERS[1].w - PIERS[0].x, 7);
    return;
  }
  deck(g, winter);
  if (stage === 'deck') {
    for (const x of [DECK.left - 2, DECK.right - 4]) coursed(g, x, 0, 6, 8);
    return;
  }
  parapets(g, winter);
}

const ROAD_W = 104;
const ROAD_H = 24;

/** One frond of bracken from its root, leaning as it climbs, with leaflets either side every other row and a tip in another colour. */
function frond(g: Grid, x: number, y: number, lean: number, height: number, leaf: string, tip: string): void {
  for (let k = 0; k < height; k++) {
    const xx = x + Math.round((lean * k) / 4);
    dot(g, xx, y - k, k === height - 1 ? tip : leaf);
    if (k % 2 === 1 && k < height - 2) { dot(g, xx - 1, y - k, leaf); dot(g, xx + 1, y - k, leaf); }
  }
}

/** Bracken grown over a stretch of the road, waist high in thick clumps of fronds, dark at the roots; in thinner, shorter clumps with the old
 * stones showing once half cleared; dead and rusty under snow in winter. */
function brush(g: Grid, half: boolean, winter: boolean): void {
  for (let x = 4, n = 0; x < ROAD_W - 6; x += half ? 17 : 10, n++) {
    const root = 20 + (n % 2);
    const height = (half ? 10 : 15) + ((n * 5) % 4);
    oval(g, x + 3, root + 1, 5, 2, 'n');
    for (const lean of [-4, 4, -2, 2, 0]) {
      const leaf = winter ? (lean % 4 === 0 ? 'r' : 'R') : (lean % 4 === 0 ? 'h' : 'G');
      frond(g, x + 3, root, lean, height - Math.abs(lean) / 2, leaf, winter ? 'W' : (n % 2 === 0 ? 'r' : 'g'));
    }
  }
  if (half) for (let x = 15; x < ROAD_W - 6; x += 17) { box(g, x, 18, 3, 2, 'c'); dot(g, x, 18, 'a'); box(g, x + 1, 20, 3, 1, 'k'); }
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

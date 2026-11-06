import type { PaletteKey } from './palette';
import { box, define, dot, oval, type Grid } from './sheepSprites';
import type { SpriteDef } from './sprites';

// The orchard: its plot, flat on the ground so trees and the survivor stand over it, and a tree at each age and season.

const WIDE = 88;
const TALL = 104;

function plot(g: Grid): void {
  for (const y of [1, TALL - 3]) box(g, 0, y, WIDE, 1, 'b');
  for (const x of [1, WIDE - 3]) box(g, x, 1, 1, TALL - 3, 'b');
  const post = (x: number, y: number): void => {
    box(g, x, y, 3, 4, 'c');
    dot(g, x, y, 'd');
  };
  for (let x = 0; x <= WIDE - 3; x += 17) { post(x, 0); post(x, TALL - 4); }
  for (let y = 0; y <= TALL - 4; y += 17) { post(0, y); post(WIDE - 4, y); }
}

function plotSite(g: Grid): void {
  for (let x = 0; x <= WIDE - 2; x += 34) { box(g, x, 0, 2, 3, 'c'); box(g, x, TALL - 3, 2, 3, 'c'); }
  for (let y = 0; y <= TALL - 3; y += 34) { box(g, 0, y, 2, 3, 'c'); box(g, WIDE - 2, y, 2, 3, 'c'); }
  for (let x = 5; x < WIDE - 4; x += 6) { dot(g, x, 1, 'v'); dot(g, x, TALL - 2, 'v'); }
  for (let y = 5; y < TALL - 4; y += 6) { dot(g, 1, y, 'v'); dot(g, WIDE - 2, y, 'v'); }
}

const TREE_W = 34;
const TREE_H = 50;
const FOOT = 48;
const MID = 17;

const COLOURS: Record<string, PaletteKey> = {
  s: 'shadow', a: 'wood0', b: 'wood1', c: 'wood2', d: 'wood3', v: 'canvas1',
  g: 'leaf1', h: 'leaf2', i: 'leaf3', j: 'leaf4',
  o: 'fire2', y: 'fire3', u: 'fire1', r: 'fire1', w: 'flower2', p: 'flower3', f: 'frost'
};

type Leaves = { dark: string; mid: string; light: string; dots?: string; dots2?: string };
const GREEN: Leaves = { dark: 'g', mid: 'h', light: 'i' };
const BLOSSOM: Leaves = { dark: 'h', mid: 'i', light: 'j', dots: 'w', dots2: 'p' };
const TURNING: Leaves = { dark: 'u', mid: 'o', light: 'y' };

function ground(g: Grid, width: number): void {
  oval(g, MID, FOOT - 0.5, width, 1.6, 's');
}

function trunk(g: Grid, width: number, top: number): void {
  box(g, MID - Math.floor(width / 2), top, width, FOOT - top, 'b');
  box(g, MID - Math.floor(width / 2), top, 1, FOOT - top, 'c');
}

/** A rounded crown, shaded from below, with blossom or fruit scattered evenly over it. */
function crown(g: Grid, cy: number, rx: number, ry: number, leaves: Leaves): void {
  oval(g, MID, cy, rx, ry, leaves.dark);
  oval(g, MID - 1, cy - 1, rx - 1, ry - 1.5, leaves.mid);
  oval(g, MID - 2, cy - 3, rx - 3.5, ry - 4, leaves.light);
  if (!leaves.dots) return;
  for (let y = cy - ry + 2; y < cy + ry - 1; y += 3) {
    for (let x = MID - rx + 2 + (y % 2) * 2; x < MID + rx - 1; x += 4) {
      if (g[y]?.[x] === '.' || g[y]?.[x] === undefined) continue;
      dot(g, x, y, (x + y) % 3 === 0 && leaves.dots2 ? leaves.dots2 : leaves.dots);
    }
  }
}

function branches(g: Grid, top: number, reach: number, snow: boolean): void {
  for (let i = 0; i < reach; i++) {
    const rise = Math.round(i * 0.75);
    for (const [side, start] of [[-1, top + 6], [1, top + 3]] as const) dot(g, MID + side * (i + 1), start - rise, 'b');
    if (i % 2 === 0) { dot(g, MID - i - 1, top + 1 - rise, 'a'); dot(g, MID + i + 1, top - 2 - rise, 'a'); }
    if (snow) { dot(g, MID - i - 1, top + 5 - rise, 'f'); dot(g, MID + i + 1, top + 2 - rise, 'f'); }
  }
}

function sprout(g: Grid): void {
  ground(g, 4);
  box(g, MID + 3, FOOT - 9, 1, 9, 'c');
  dot(g, MID + 3, FOOT - 9, 'd');
  box(g, MID, FOOT - 4, 1, 4, 'h');
  dot(g, MID - 1, FOOT - 5, 'i'); dot(g, MID + 1, FOOT - 5, 'i'); dot(g, MID - 2, FOOT - 6, 'i');
}

function sapling(g: Grid, leafy: boolean): void {
  ground(g, 5);
  box(g, MID, FOOT - 16, 1, 16, 'b');
  box(g, MID + 4, FOOT - 11, 1, 11, 'c');
  dot(g, MID + 1, FOOT - 7, 'v'); dot(g, MID + 2, FOOT - 7, 'v'); dot(g, MID + 3, FOOT - 7, 'v');
  if (leafy) {
    oval(g, MID, FOOT - 19, 4, 4, 'h');
    oval(g, MID - 1, FOOT - 20, 2.5, 2.5, 'i');
    return;
  }
  for (let i = 1; i < 4; i++) { dot(g, MID - i, FOOT - 11 - i, 'b'); dot(g, MID + i, FOOT - 13 - i, 'b'); }
  dot(g, MID, FOOT - 17, 'f'); dot(g, MID - 3, FOOT - 15, 'f'); dot(g, MID + 3, FOOT - 17, 'f');
}

function young(g: Grid, leaves: Leaves | null): void {
  ground(g, 8);
  trunk(g, 2, FOOT - 16);
  if (leaves) crown(g, FOOT - 21, 9, 9, leaves);
  else branches(g, FOOT - 20, 7, true);
}

function grown(g: Grid, leaves: Leaves | null, apples = false): void {
  ground(g, 13);
  trunk(g, 4, FOOT - 22);
  dot(g, MID - 3, FOOT - 1, 'b'); dot(g, MID + 2, FOOT - 1, 'b');
  if (!leaves) {
    branches(g, FOOT - 30, 14, true);
    return;
  }
  crown(g, FOOT - 31, 16, 15, leaves);
  if (!apples) return;
  for (const [x, y] of [[7, 13], [13, 8], [22, 10], [27, 15], [5, 21], [12, 18], [19, 15], [25, 22], [9, 26], [16, 24], [22, 28]] as const) {
    box(g, x, y, 2, 2, 'r');
    dot(g, x, y, 'y');
  }
}

export const orchardSprites: Record<string, SpriteDef> = {
  orchard: define(WIDE, TALL, { built: plot }, [WIDE / 2, TALL / 2]),
  orchardSite: define(WIDE, TALL, { still: plotSite }, [WIDE / 2, TALL / 2]),
  orchardTree: define(TREE_W, TREE_H, {
    sprout,
    sapling: g => sapling(g, true),
    saplingBare: g => sapling(g, false),
    youngBare: g => young(g, null),
    youngBlossom: g => young(g, BLOSSOM),
    youngGreen: g => young(g, GREEN),
    youngAutumn: g => young(g, TURNING),
    grownBare: g => grown(g, null),
    grownBlossom: g => grown(g, BLOSSOM),
    grownGreen: g => grown(g, GREEN),
    grownAutumn: g => grown(g, TURNING),
    grownFruit: g => grown(g, GREEN, true)
  }, [MID, FOOT], COLOURS)
};

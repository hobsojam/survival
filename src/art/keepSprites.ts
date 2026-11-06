import type { PaletteKey } from './palette';
import { box, define, dot, type Grid } from './sheepSprites';
import type { SpriteDef } from './sprites';

// The stone keep as it rises, a picture for every four stones laid: footings in the grass, walls to head height with an
// empty doorway, then taller walls with window slits and scaffolding, and at last the battlements with the scaffolding down.

const legend: Record<string, PaletteKey> = {
  a: 'stone0', b: 'stone1', c: 'stone2', d: 'stone3', e: 'stone4', k: 'shadow',
  t: 'wood1', u: 'wood2', p: 'wood0', q: 'wood3', w: 'frost', W: 'paper', r: 'fire1', s: 'fire3'
};

const KEEP_W = 64;
const KEEP_H = 104;
const LEFT = 4;
const WALL_W = 56;
/** The row the walls stand on. The door is at the sprite's anchor, just below it. */
const BASE = 98;
const CENTRE = 32;
const FOOTINGS_DEEP = 22;
/** How high the walls stand at each step, in pixels. */
const WALL_HEIGHT = [0, 4, 8, 14, 20, 26, 32, 40, 48, 56, 64, 72, 80, 84, 90, 94];
const LAST_STEP = WALL_HEIGHT.length - 1;
const HEAD_HEIGHT_STEP = 6;
const FIRST_SCAFFOLD_STEP = 3;
const BATTLEMENT_STEP = 13;
const FIRST_WALL_STEP = 3;

const speckle = (x: number, y: number): number => {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
};

/** Courses of stone: a dark line under each row, staggered joints, and a few paler stones. */
function courses(g: Grid, x: number, y: number, width: number, height: number): void {
  box(g, x, y, width, height, 'c');
  for (let rowY = BASE - 4, row = 0; rowY >= y - 4; rowY -= 4, row++) {
    for (let col = x - (row % 2) * 4; col < x + width; col += 8) {
      if (speckle(col, rowY) > 0.68) for (let yy = rowY; yy < rowY + 3; yy++) for (let xx = col + 1; xx < col + 8; xx++) if (xx >= x && xx < x + width && yy >= y && yy < y + height) dot(g, xx, yy, 'd');
      for (let yy = rowY; yy < rowY + 3; yy++) if (col >= x && yy >= y && yy < y + height) dot(g, col, yy, 'b');
    }
    for (let xx = x; xx < x + width; xx++) if (rowY + 3 >= y && rowY + 3 < y + height) dot(g, xx, rowY + 3, 'b');
  }
  box(g, x, y, 1, height, 'd');
  box(g, x + width - 1, y, 1, height, 'a');
}

function shadow(g: Grid): void {
  box(g, LEFT - 2, BASE, WALL_W + 4, 3, 'k');
}

/** A low square of stone in the grass, seen from above: the front course rises first. */
function footings(g: Grid, height: number): void {
  const back = BASE - FOOTINGS_DEEP;
  box(g, LEFT, back, WALL_W, 3, 'c');
  box(g, LEFT, back, WALL_W, 1, 'd');
  box(g, LEFT, back, 4, FOOTINGS_DEEP, 'c');
  box(g, LEFT, back, 1, FOOTINGS_DEEP, 'd');
  box(g, LEFT + WALL_W - 4, back, 4, FOOTINGS_DEEP, 'b');
  box(g, LEFT + WALL_W - 1, back, 1, FOOTINGS_DEEP, 'a');
  courses(g, LEFT, BASE - height, WALL_W, height);
  box(g, LEFT - 1, BASE, WALL_W + 2, 2, 'k');
}

/** Pegs and twine on the bare ground, once the forge stands: this is where it will go. */
function site(g: Grid): void {
  const back = BASE - FOOTINGS_DEEP;
  for (let x = LEFT; x < LEFT + WALL_W; x += 2) {
    dot(g, x, back, 'W');
    dot(g, x, BASE, 'W');
  }
  for (let y = back; y <= BASE; y += 2) {
    dot(g, LEFT, y, 'W');
    dot(g, LEFT + WALL_W - 1, y, 'W');
  }
  for (const [x, y] of [[LEFT, back], [LEFT + WALL_W - 1, back], [LEFT, BASE], [LEFT + WALL_W - 1, BASE]] as const) {
    box(g, x - 1, y - 3, 2, 4, 'u');
    box(g, x - 1, y - 3, 2, 1, 't');
  }
}

/** The doorway, cut down to however high the walls are yet. */
function doorway(g: Grid, wallTop: number, hung: boolean): void {
  const top = BASE - 22;
  const fromY = Math.max(wallTop, top);
  const clip = (x: number, y: number, width: number, height: number, c: string): void => {
    const start = Math.max(y, fromY);
    box(g, x, start, width, y + height - start, c);
  };
  clip(CENTRE - 7, top + 3, 14, 19, 'a');
  clip(CENTRE - 5, top + 1, 10, 2, 'a');
  clip(CENTRE - 6, top + 4, 12, 18, hung ? 'q' : 'p');
  clip(CENTRE - 4, top + 2, 8, 2, hung ? 'q' : 'p');
  if (!hung) return;
  for (const x of [CENTRE - 3, CENTRE + 1]) clip(x, top + 3, 1, 19, 'p');
  for (const y of [top + 7, top + 16]) clip(CENTRE - 6, y, 8, 1, 'a');
  clip(CENTRE + 3, top + 12, 2, 2, 's');
}

const SLITS: readonly (readonly [number, number])[] = [[16, 44], [47, 44], [CENTRE - 1, 62], [16, 78], [47, 78]];
const SLIT_H = 8;
function slits(g: Grid, wallHeight: number): void {
  for (const [x, up] of SLITS) if (wallHeight >= up + 2) box(g, x, BASE - up - SLIT_H + 2, 3, SLIT_H, 'a');
}

function scaffold(g: Grid, top: number): void {
  const from = top - 5;
  for (const x of [0, 1, KEEP_W - 2, KEEP_W - 1]) box(g, x, from, 1, BASE + 1 - from, x % 2 === 0 ? 't' : 'u');
  for (let y = BASE - 12; y >= from + 3; y -= 18) {
    box(g, 0, y, 8, 1, 'u');
    box(g, KEEP_W - 8, y, 8, 1, 'u');
    box(g, 0, y + 1, 8, 1, 't');
    box(g, KEEP_W - 8, y + 1, 8, 1, 't');
  }
  // The planks the mason stands on, across the front just below the top of the wall.
  box(g, 0, top + 4, KEEP_W, 1, 'u');
  box(g, 0, top + 5, KEEP_W, 1, 't');
}

function battlements(g: Grid, top: number, width: number): void {
  for (let x = LEFT - 1; x < LEFT - 1 + width; x += 8) {
    box(g, x, top - 4, 5, 4, 'd');
    box(g, x, top - 4, 5, 1, 'e');
    box(g, x + 4, top - 4, 1, 4, 'b');
  }
  box(g, LEFT - 1, top, WALL_W + 2, 1, 'e');
}

function snow(g: Grid, step: number, top: number): void {
  if (step <= 2) {
    const back = BASE - FOOTINGS_DEEP;
    box(g, LEFT, back, WALL_W, 1, 'W');
    box(g, LEFT, top, WALL_W, 1, 'W');
    return;
  }
  box(g, LEFT - (step >= BATTLEMENT_STEP ? 1 : 0), top, WALL_W + (step >= BATTLEMENT_STEP ? 2 : 0), 2, 'W');
  box(g, LEFT, top + 2, WALL_W, 1, 'w');
  if (step < BATTLEMENT_STEP) return;
  for (let x = LEFT - 1; x < LEFT + WALL_W; x += 8) box(g, x, top - 4, 5, 1, 'W');
}

function keepAt(g: Grid, step: number, hung: boolean, winter: boolean): void {
  if (step === 0) {
    site(g);
    return;
  }
  const height = WALL_HEIGHT[step];
  const top = BASE - height;
  if (step < FIRST_WALL_STEP) {
    footings(g, height);
  } else {
    shadow(g);
    courses(g, LEFT, top, WALL_W, height);
    doorway(g, top, hung);
    slits(g, height);
    // The battlements go on a merlon at a time as the last stones are laid.
    if (step >= BATTLEMENT_STEP) battlements(g, top, step === BATTLEMENT_STEP ? WALL_W / 2 : WALL_W + 2);
  }
  if (winter) snow(g, step, top);
  if (step >= FIRST_SCAFFOLD_STEP && step < LAST_STEP) scaffold(g, top);
}

const frames: Record<string, (g: Grid) => void> = {};
for (let step = 0; step <= LAST_STEP; step++) {
  for (const hung of step < HEAD_HEIGHT_STEP ? [false] : step === HEAD_HEIGHT_STEP ? [false, true] : [true]) {
    frames[`${step}${hung ? 'd' : ''}`] = g => keepAt(g, step, hung, false);
    frames[`${step}${hung ? 'd' : ''}s`] = g => keepAt(g, step, hung, true);
  }
}

/** The one window slit that shows a light at night. */
function glow(g: Grid): void {
  const [x, up] = SLITS[2];
  const y = BASE - up - SLIT_H + 2;
  box(g, x + 1, y + 1, 1, SLIT_H - 2, 's');
  dot(g, x + 1, y + 1, 'r');
}

const ANCHOR: [number, number] = [CENTRE, BASE + 1];

export const keepSprites: Record<string, SpriteDef> = {
  keep: define(KEEP_W, KEEP_H, frames, ANCHOR, legend),
  keepGlow: define(KEEP_W, KEEP_H, { lit: glow }, ANCHOR, legend)
};

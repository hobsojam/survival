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

const buildLegend: Record<string, PaletteKey> = {
  a: 'stone0', b: 'stone1', c: 'stone2', d: 'stone3', e: 'stone4', k: 'shadow', i: 'ink',
  p: 'wood0', t: 'wood1', u: 'wood2', q: 'wood3', w: 'frost', W: 'paper'
};

const speckle = (x: number, y: number): number => {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
};

/** Courses of stone from the foot up to a height: a dark line under each row and joints that stagger, with a few paler stones. */
function courses(g: Grid, left: number, width: number, base: number, height: number): void {
  box(g, left, base - height + 1, width, height, 'c');
  for (let row = 0, y = base - 3; y > base - height; row++, y -= 4) {
    for (let x = left + (row % 2) * 4; x < left + width; x += 8) {
      if (speckle(x, y) > 0.7) box(g, x + 1, y, 6, 3, 'd');
      box(g, x, y, 1, 3, 'b');
    }
    box(g, left, y + 3, width, 1, 'b');
  }
}

const WALL_W = 16;
const WALL_H = 42;
const WALL_BASE = 37;
/** How high a stretch of wall stands at each of its four steps, in pixels. */
const WALL_HEIGHT = [0, 8, 17, 26, 32];

/** One tile's length of the curtain wall: rubble courses rising, then a full wall with merlons along the top. */
function wallStretch(g: Grid, level: number, winter: boolean): void {
  const height = WALL_HEIGHT[level];
  const top = WALL_BASE - height + 1;
  box(g, 0, WALL_BASE + 1, WALL_W, 3, 'k');
  courses(g, 0, WALL_W, WALL_BASE, height);
  if (level === 4) {
    for (const x of [0, 8]) {
      box(g, x, top - 4, 5, 4, 'd');
      box(g, x, top - 4, 5, 1, 'e');
      box(g, x + 4, top - 4, 1, 4, 'b');
    }
    box(g, 0, top, WALL_W, 1, 'e');
  } else {
    box(g, 0, top, WALL_W, 1, 'd');
    for (const x of [3, 11]) dot(g, x, top, 'c');
  }
  if (!winter) return;
  box(g, 0, top, WALL_W, 2, 'W');
  box(g, 0, top + 2, WALL_W, 1, 'w');
  if (level === 4) for (const x of [0, 8]) box(g, x, top - 4, 5, 1, 'W');
}

const wallFrames: Record<string, (g: Grid) => void> = {};
for (let level = 1; level <= 4; level++) {
  wallFrames[`${level}`] = g => wallStretch(g, level, false);
  wallFrames[`${level}s`] = g => wallStretch(g, level, true);
}

const TOWER_W = 40;
const TOWER_H = 104;
const TOWER_BASE = 96;
const TOWER_CENTRE = 20;
const TOWER_LEFT = 4;
const TOWER_BODY = 32;
/** How high the tower's walls stand at each of the six stone steps, in pixels. */
const TOWER_HEIGHT = [0, 12, 24, 36, 48, 58, 66];
const ROOF_HEIGHT = 26;

/** The roof on its walls: bare rafters as each beam is set, planked once all four are up, then bound with iron. */
function towerRoof(g: Grid, beams: number, fittings: number, winter: boolean): void {
  const eaves = TOWER_BASE - TOWER_HEIGHT[6];
  const apex = eaves - ROOF_HEIGHT;
  box(g, TOWER_LEFT - 2, eaves - 1, TOWER_BODY + 4, 2, 't');
  const rafters = [-18, 18, -9, 9];
  if (beams < 4) {
    for (const offset of rafters.slice(0, beams)) line(g, TOWER_CENTRE, apex, TOWER_CENTRE + offset, eaves - 1, 'q');
    if (beams >= 2) box(g, TOWER_CENTRE - 12, eaves - 12, 24, 1, 'u');
  } else {
    for (let row = 0; row < ROOF_HEIGHT; row++) {
      const half = Math.round(3 + (row + 1) / ROOF_HEIGHT * 15);
      box(g, TOWER_CENTRE - half, apex + row, half * 2, 1, row % 4 === 3 ? 't' : 'u');
      dot(g, TOWER_CENTRE - half, apex + row, 'q');
      dot(g, TOWER_CENTRE + half - 1, apex + row, 'p');
    }
  }
  if (fittings >= 1) for (const [row, half] of [[eaves - 6, 16]] as const) box(g, TOWER_CENTRE - half, row, half * 2, 1, 'i');
  if (fittings >= 2) {
    box(g, TOWER_CENTRE - 9, apex + 10, 18, 1, 'i');
    box(g, TOWER_CENTRE, apex - 3, 1, 4, 'i');
    box(g, TOWER_CENTRE - 1, apex - 3, 3, 1, 'b');
  }
  if (!winter || beams < 4) return;
  for (let row = 0; row < ROOF_HEIGHT; row += 3) {
    const half = Math.round(3 + (row + 1) / ROOF_HEIGHT * 15);
    box(g, TOWER_CENTRE - half, apex + row, half * 2, 1, 'W');
  }
}

/** One corner tower, a picture for every four stones, then for each beam and fitting. */
function tower(g: Grid, step: number, winter: boolean): void {
  const stoneStep = Math.min(step, 6);
  const height = TOWER_HEIGHT[stoneStep];
  const top = TOWER_BASE - height;
  box(g, TOWER_LEFT - 2, TOWER_BASE + 1, TOWER_BODY + 4, 3, 'k');
  courses(g, TOWER_LEFT, TOWER_BODY, TOWER_BASE, height);
  box(g, TOWER_LEFT, top + 1, 1, height - 1, 'd');
  box(g, TOWER_LEFT + TOWER_BODY - 1, top + 1, 1, height - 1, 'a');
  if (step >= 3) for (const x of [TOWER_CENTRE - 2]) box(g, x, TOWER_BASE - Math.min(height - 8, 40), 3, 8, 'a');
  if (step <= 6) {
    for (let x = TOWER_LEFT; x < TOWER_LEFT + TOWER_BODY; x += 8) {
      box(g, x, top - 4, 5, 4, step === 6 ? 'd' : 'c');
      if (step === 6) box(g, x, top - 4, 5, 1, 'e');
    }
    box(g, TOWER_LEFT, top, TOWER_BODY, 1, 'e');
    if (winter) {
      box(g, TOWER_LEFT, top, TOWER_BODY, 2, 'W');
      for (let x = TOWER_LEFT; x < TOWER_LEFT + TOWER_BODY; x += 8) box(g, x, top - 4, 5, 1, 'W');
    }
  } else {
    towerRoof(g, Math.min(step - 6, 4), Math.max(0, step - 10), winter);
    if (winter) box(g, TOWER_LEFT, top, TOWER_BODY, 1, 'W');
  }
}

const towerFrames: Record<string, (g: Grid) => void> = {};
for (let step = 1; step <= 12; step++) {
  towerFrames[`${step}`] = g => tower(g, step, false);
  towerFrames[`${step}s`] = g => tower(g, step, true);
}

const FRAMES_W = 48;
const FRAMES_H = 64;
const FRAMES_BASE = 58;

/** The timber frames and hoist as the wood goes up: posts and braces, then planks to stand on, then the hoist with its rope and crate. */
function scaffolding(g: Grid, step: number, winter: boolean): void {
  const height = Math.min(step, 4) * 11;
  const top = FRAMES_BASE - height;
  box(g, 2, FRAMES_BASE + 1, FRAMES_W - 4, 3, 'k');
  for (const x of [4, 5, 40, 41, 22, 23]) box(g, x, top, 1, height + 1, x % 2 === 0 ? 't' : 'u');
  for (let y = FRAMES_BASE - 8; y > top; y -= 11) {
    box(g, 4, y, 38, 1, 'u');
    if (y - 10 < top) continue;
    line(g, 5, y, 22, y - 10, 't');
    line(g, 40, y, 23, y - 10, 't');
  }
  if (step >= 2) {
    box(g, 3, top + 2, 40, 2, 'q');
    box(g, 3, top + 4, 40, 1, 'p');
    if (winter) box(g, 3, top + 1, 40, 2, 'W');
  }
  if (step < 5) return;
  const hoistTop = top - Math.min(step - 4, 2) * 8;
  box(g, 22, hoistTop, 2, top - hoistTop + 2, 'p');
  box(g, 22, hoistTop, 14, 2, 'q');
  if (winter) box(g, 22, hoistTop - 1, 14, 1, 'W');
  if (step < 6) return;
  box(g, 34, hoistTop + 2, 1, 14, 'i');
  box(g, 31, hoistTop + 16, 7, 5, 'u');
  box(g, 31, hoistTop + 16, 7, 1, 'q');
}

const frameFrames: Record<string, (g: Grid) => void> = {};
for (let step = 1; step <= 6; step++) {
  frameFrames[`${step}`] = g => scaffolding(g, step, false);
  frameFrames[`${step}s`] = g => scaffolding(g, step, true);
}

export const castleSprites: Record<string, SpriteDef> = {
  castleFrames: define(FRAMES_W, FRAMES_H, frameFrames, [24, FRAMES_BASE + 1], buildLegend),
  castleWall: define(WALL_W, WALL_H, wallFrames, [8, WALL_BASE + 1], buildLegend),
  castleTower: define(TOWER_W, TOWER_H, towerFrames, [TOWER_CENTRE, TOWER_BASE + 1], buildLegend),
  castleLine: define(LINE_W, LINE_H, { still }, [1, 1], legend),
  castleRoad: define(12, 8, { a: stone('b', 'a'), b: stone('a', 'b') }, [6, 4], legend),
  castleCart: define(20, 14, { empty: g => cart(g, 'empty'), some: g => cart(g, 'some'), full: g => cart(g, 'full') }, [10, 12], cartLegend)
};

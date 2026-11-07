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
const ROOF_EAVES = TOWER_BASE - TOWER_HEIGHT[6];
const ROOF_APEX = ROOF_EAVES - ROOF_HEIGHT;
/** Half the roof's width on a row counted down from its apex. */
const roofHalf = (row: number): number => Math.round(3 + (row + 1) / ROOF_HEIGHT * 15);

/** The bare rafters, one for each beam set, with a tie across once two are up. */
function roofRafters(g: Grid, beams: number): void {
  for (const offset of [-18, 18, -9, 9].slice(0, beams)) line(g, TOWER_CENTRE, ROOF_APEX, TOWER_CENTRE + offset, ROOF_EAVES - 1, 'q');
  if (beams >= 2) box(g, TOWER_CENTRE - 12, ROOF_EAVES - 12, 24, 1, 'u');
}

/** The planked roof once all four beams are up. */
function roofPlanks(g: Grid): void {
  for (let row = 0; row < ROOF_HEIGHT; row++) {
    const half = roofHalf(row);
    box(g, TOWER_CENTRE - half, ROOF_APEX + row, half * 2, 1, row % 4 === 3 ? 't' : 'u');
    dot(g, TOWER_CENTRE - half, ROOF_APEX + row, 'q');
    dot(g, TOWER_CENTRE + half - 1, ROOF_APEX + row, 'p');
  }
}

/** The iron: a band at the eaves for the first fitting, then a band high up and a finial for the second. */
function roofIron(g: Grid, fittings: number): void {
  if (fittings >= 1) box(g, TOWER_CENTRE - 16, ROOF_EAVES - 6, 32, 1, 'i');
  if (fittings < 2) return;
  box(g, TOWER_CENTRE - 9, ROOF_APEX + 10, 18, 1, 'i');
  box(g, TOWER_CENTRE, ROOF_APEX - 3, 1, 4, 'i');
  box(g, TOWER_CENTRE - 1, ROOF_APEX - 3, 3, 1, 'b');
}

/** The roof on its walls: bare rafters as each beam is set, planked once all four are up, then bound with iron. */
function towerRoof(g: Grid, beams: number, fittings: number, winter: boolean): void {
  box(g, TOWER_LEFT - 2, ROOF_EAVES - 1, TOWER_BODY + 4, 2, 't');
  if (beams < 4) roofRafters(g, beams);
  else roofPlanks(g);
  roofIron(g, fittings);
  if (!winter || beams < 4) return;
  for (let row = 0; row < ROOF_HEIGHT; row += 3) box(g, TOWER_CENTRE - roofHalf(row), ROOF_APEX + row, roofHalf(row) * 2, 1, 'W');
}

/** The open top of a tower still going up: its merlons, darker once the last course is on, and snow on them in winter. */
function towerTop(g: Grid, step: number, top: number, winter: boolean): void {
  for (let x = TOWER_LEFT; x < TOWER_LEFT + TOWER_BODY; x += 8) {
    box(g, x, top - 4, 5, 4, step === 6 ? 'd' : 'c');
    if (step === 6) box(g, x, top - 4, 5, 1, 'e');
  }
  box(g, TOWER_LEFT, top, TOWER_BODY, 1, 'e');
  if (!winter) return;
  box(g, TOWER_LEFT, top, TOWER_BODY, 2, 'W');
  for (let x = TOWER_LEFT; x < TOWER_LEFT + TOWER_BODY; x += 8) box(g, x, top - 4, 5, 1, 'W');
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
  if (step >= 3) box(g, TOWER_CENTRE - 2, TOWER_BASE - Math.min(height - 8, 40), 3, 8, 'a');
  if (step <= 6) {
    towerTop(g, step, top, winter);
    return;
  }
  towerRoof(g, Math.min(step - 6, 4), Math.max(0, step - 10), winter);
  if (winter) box(g, TOWER_LEFT, top, TOWER_BODY, 1, 'W');
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

const GATE_W = 40;
const GATE_H = 72;
const GATE_BASE = 66;
const GATE_CENTRE = 20;
const GATE_LEFT = 2;
const GATE_BODY = 36;
/** The passage through the gatehouse, in pixels: its width, and how high it stands before the lintel. */
const PASSAGE_W = 12;
export const PASSAGE_H = 20;
/** How high the gatehouse walls stand at each of its six steps, one for every five stones, in pixels. */
const GATE_HEIGHT = [0, 10, 20, 30, 38, 46, 50];

/** The portcullis drawn up under the lintel, as the finished gatehouse always shows it. */
const GRATE_RAISED = 4;

/** The grating: iron bars with pointed ends and a crossbar, as long as it has been let down, from the top of the passage. */
function grate(g: Grid, length: number, across = 0, down = 0): void {
  const left = across + 2;
  for (let x = left; x < left + 9; x += 3) {
    box(g, x, down, 1, length, 'i');
    dot(g, x, down + length, 'i');
  }
  for (let y = 1; y < length; y += 6) box(g, left - 1, down + y, 11, 1, 'i');
}

/** The gatehouse on the east wall: two piers rising stone by stone, the passage between them, then battlements and the portcullis raised. */
function gatehouse(g: Grid, step: number, winter: boolean): void {
  const height = GATE_HEIGHT[step];
  const top = GATE_BASE - height + 1;
  box(g, GATE_LEFT, GATE_BASE + 1, GATE_BODY, 3, 'k');
  courses(g, GATE_LEFT, GATE_BODY, GATE_BASE, height);
  const open = Math.min(height, PASSAGE_H);
  const passage = GATE_CENTRE - PASSAGE_W / 2;
  box(g, passage, GATE_BASE - open + 1, PASSAGE_W, open, 'k');
  if (height > PASSAGE_H) {
    box(g, passage - 1, GATE_BASE - PASSAGE_H, PASSAGE_W + 2, 1, 'e');
    for (const x of [passage - 1, passage + PASSAGE_W]) box(g, x, GATE_BASE - PASSAGE_H + 1, 1, PASSAGE_H, 'b');
  }
  if (step === 6) {
    for (let x = GATE_LEFT; x < GATE_LEFT + GATE_BODY; x += 8) {
      box(g, x, top - 4, 5, 4, 'd');
      box(g, x, top - 4, 5, 1, 'e');
      box(g, x + 4, top - 4, 1, 4, 'b');
    }
    box(g, GATE_LEFT, top, GATE_BODY, 1, 'e');
    grate(g, GRATE_RAISED, passage, GATE_BASE - PASSAGE_H + 1);
  } else {
    box(g, GATE_LEFT, top, GATE_BODY, 1, 'd');
    for (const x of [GATE_LEFT + 5, GATE_LEFT + 21]) dot(g, x, top, 'c');
  }
  if (!winter) return;
  box(g, GATE_LEFT, top, GATE_BODY, 2, 'W');
  box(g, GATE_LEFT, top + 2, GATE_BODY, 1, 'w');
  if (step === 6) for (let x = GATE_LEFT; x < GATE_LEFT + GATE_BODY; x += 8) box(g, x, top - 4, 5, 1, 'W');
}

const gateFrames: Record<string, (g: Grid) => void> = {};
for (let step = 1; step <= 6; step++) {
  gateFrames[`${step}`] = g => gatehouse(g, step, false);
  gateFrames[`${step}s`] = g => gatehouse(g, step, true);
}

/** How far down the passage the portcullis can be let, in steps of four pixels. */
export const GRATE_STEPS = PASSAGE_H / 4;
const grateFrames: Record<string, (g: Grid) => void> = {};
for (let drop = 1; drop <= GRATE_STEPS; drop++) grateFrames[`${drop}`] = g => grate(g, drop * 4);

// The moat: one tile of the ring, seen from above. A bank of earth on both sides of a bed that is dry at first, then holds more
// and more water as the spring rain comes. In winter the water is ice, and snow lies on the banks and the dry bed.
const moatLegend: Record<string, PaletteKey> = { e: 'earth1', f: 'earth2', g: 'earth0', b: 'grass2', c: 'grass1', s: 'storm', l: 'flower4', i: 'frost', n: 'paper' };

/** Water's thickness across the 10 pixel bed at each of the five levels. */
const MOAT_WATER = [0, 3, 5, 8, 10];

/** One tile of the moat running across (`h`) or up and down (`v`), at a fill level, with snow on it or not. */
function moatTile(g: Grid, across: boolean, level: number, winter: boolean): void {
  const put = (a: number, b: number, w: number, h: number, c: string): void => (across ? box(g, a, b, w, h, c) : box(g, b, a, h, w, c));
  put(0, 0, 16, 2, winter ? 'n' : 'b'); put(0, 2, 16, 1, winter ? 'i' : 'c');
  put(0, 14, 16, 2, winter ? 'n' : 'b'); put(0, 13, 16, 1, winter ? 'i' : 'c');
  put(0, 3, 16, 10, 'e');
  for (let x = 1; x < 16; x += 5) put(x, 4 + (x % 3) * 3, 2, 1, 'f');
  const thick = MOAT_WATER[level];
  if (thick > 0) moatTileWater(put, thick, winter);
  else if (winter) for (let x = 2; x < 14; x += 4) put(x, 7, 2, 1, 'n');
}

/** The water along a straight tile, lit along its top once it runs deep, with ripples, or ice and snow in winter. */
function moatTileWater(put: (a: number, b: number, w: number, h: number, c: string) => void, thick: number, winter: boolean): void {
  const start = 3 + Math.floor((10 - thick) / 2);
  put(0, start, 16, thick, winterWater(winter));
  if (thick >= 5) put(0, start, 16, 1, 'g');
  for (let x = 2; x < 14; x += 6) put(x, start + 1 + (x % 2), 3, 1, winter ? 'n' : 'l');
}

/** Which way a corner tile's arms run, and where its water lies across the bed. */
interface CornerShape { down: boolean; east: boolean; thick: number; start: number; end: number }

/** Whether a pixel of a corner tile lies in the earth bed: the arm up and down, or the arm across. */
const inCornerBed = ({ down, east }: CornerShape, x: number, y: number): boolean =>
  (x >= 3 && x <= 12 && (down ? y >= 3 : y <= 12)) || (y >= 3 && y <= 12 && (east ? x >= 3 : x <= 12));

/** Whether a pixel of a corner tile holds water: the arm up and down leaves through the top or bottom edge, the arm across through the side. */
function cornerWet({ down, east, thick, start, end }: CornerShape, x: number, y: number): boolean {
  if (thick === 0) return false;
  const inColumn = x >= start && x <= end;
  const inRow = y >= start && y <= end;
  const column = inColumn && ((down ? y >= start : y <= end) || (down ? y < start : y > end));
  const row = inRow && ((east ? x >= start : x <= end) || (east ? x > end : x < start));
  return column || row;
}

/** The ground of a corner tile: the bed, a lip of short grass round it, and the bank beyond, snowy in winter. */
function cornerGround(g: Grid, shape: CornerShape, winter: boolean): void {
  const nearBed = (x: number, y: number): boolean => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inCornerBed(shape, x + dx, y + dy));
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (inCornerBed(shape, x, y)) dot(g, x, y, 'e');
      else if (nearBed(x, y)) dot(g, x, y, winter ? 'i' : 'c');
      else dot(g, x, y, winter ? 'n' : 'b');
    }
  }
}

/** Snow lying in a dry corner's bed, along the middle of each arm. */
function cornerSnow(g: Grid, shape: CornerShape): void {
  for (let a = 2; a < 14; a += 4) {
    for (let i = 0; i < 2; i++) {
      const along = shape.down ? 15 - a - i : a + i;
      const across = shape.east ? 15 - a - i : a + i;
      if (inCornerBed(shape, 7, along)) dot(g, 7, along, 'n');
      if (inCornerBed(shape, across, 7)) dot(g, across, 7, 'n');
    }
  }
}

/** The water in a corner, its near edges lit once it runs deep, and ice in winter. */
function cornerWater(g: Grid, shape: CornerShape, winter: boolean): void {
  const lit = (x: number, y: number): boolean => shape.thick >= 5 && ((x > 0 && !cornerWet(shape, x - 1, y)) || (y > 0 && !cornerWet(shape, x, y - 1)));
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (cornerWet(shape, x, y)) dot(g, x, y, lit(x, y) ? 'g' : winterWater(winter));
    }
  }
}

const winterWater = (winter: boolean): string => (winter ? 'i' : 's');

/** A corner tile: the bed and the water run in from one end and out of one side, with banks on the outer sides, made to meet the straight tiles pixel for pixel. */
function moatCorner(g: Grid, down: boolean, east: boolean, level: number, winter: boolean): void {
  const thick = MOAT_WATER[level];
  const start = 3 + Math.floor((10 - thick) / 2);
  const shape: CornerShape = { down, east, thick, start, end: start + thick - 1 };
  cornerGround(g, shape, winter);
  if (thick > 0) cornerWater(g, shape, winter);
  else if (winter) cornerSnow(g, shape);
}

const moatFrames: Record<string, (g: Grid) => void> = {};
for (const [orient, across] of [['h', true], ['v', false]] as const) {
  for (let level = 0; level <= 4; level++) {
    moatFrames[`${orient}${level}`] = g => moatTile(g, across, level, false);
    moatFrames[`${orient}${level}s`] = g => moatTile(g, across, level, true);
  }
}
// A corner is named for the corner of the ring it sits at, and its arms run the other two ways.
for (const [corner, down, east] of [['nw', true, true], ['ne', true, false], ['sw', false, true], ['se', false, false]] as const) {
  for (let level = 0; level <= 4; level++) {
    moatFrames[`${corner}${level}`] = g => moatCorner(g, down, east, level, false);
    moatFrames[`${corner}${level}s`] = g => moatCorner(g, down, east, level, true);
  }
}

export const castleSprites: Record<string, SpriteDef> = {
  castleFrames: define(FRAMES_W, FRAMES_H, frameFrames, [24, FRAMES_BASE + 1], buildLegend),
  castleWall: define(WALL_W, WALL_H, wallFrames, [8, WALL_BASE + 1], buildLegend),
  castleTower: define(TOWER_W, TOWER_H, towerFrames, [TOWER_CENTRE, TOWER_BASE + 1], buildLegend),
  castleGatehouse: define(GATE_W, GATE_H, gateFrames, [GATE_CENTRE, GATE_BASE + 1], buildLegend),
  castlePortcullis: define(PASSAGE_W, PASSAGE_H + 1, grateFrames, [PASSAGE_W / 2, 0], buildLegend),
  castleLine: define(LINE_W, LINE_H, { still }, [1, 1], legend),
  castleMoat: define(16, 16, moatFrames, [8, 8], moatLegend),
  castleRoad: define(12, 8, { a: stone('b', 'a'), b: stone('a', 'b') }, [6, 4], legend),
  castleCart: define(20, 14, { empty: g => cart(g, 'empty'), some: g => cart(g, 'some'), full: g => cart(g, 'full') }, [10, 12], cartLegend)
};

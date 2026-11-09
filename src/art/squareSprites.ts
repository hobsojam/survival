import type { PaletteKey } from './palette';
import { box, define, dot, type Grid } from './sheepSprites';
import type { SpriteDef } from './sprites';
import type { StallId } from '../game/square';

// EASTER EGG: the town, see src/game/town.ts. The market square: its ground marked out with pegs and string, the
// paving a quarter at a time, the well, and five stalls, each with its own awning and its good on the counter.

/** One character a pixel. Each awning has its colour and a darker or lighter stripe: wheat for bread, amber for honey,
 * cream for wool, red for apples and pale blue for eggs. */
const chars: Record<string, PaletteKey> = {
  a: 'stone0', b: 'stone1', c: 'stone2', d: 'stone3', k: 'shadow', i: 'ink', W: 'paper',
  t: 'wood1', u: 'wood2', q: 'wood3', p: 'canvas2', n: 'night',
  B: 'scarf3', y: 'scarf2', H: 'fire3', z: 'fire2', O: 'canvas4', x: 'canvas3', R: 'berry3', v: 'berry2', E: 'flower4', w: 'paper',
  // The goods on the counter: loaves, honey jars, wool, apples and eggs.
  L: 'wood3', J: 'fire2', F: 'flower2', A: 'berry2', G: 'flower2'
};
const STRIPE: Record<StallId, [string, string]> = { bread: ['B', 'y'], honey: ['H', 'z'], wool: ['O', 'x'], apples: ['R', 'v'], eggs: ['E', 'w'] };
const GOOD: Record<StallId, string> = { bread: 'L', honey: 'J', wool: 'F', apples: 'A', eggs: 'G' };

/** The marked ground: a peg at each corner of the square and string between them, 6 by 5 tiles. */
const GROUND_W = 96;
const GROUND_H = 80;
function ground(g: Grid, winter: boolean): void {
  for (const [x, y] of [[1, 1], [GROUND_W - 3, 1], [1, GROUND_H - 3], [GROUND_W - 3, GROUND_H - 3]]) box(g, x, y, 2, 2, 'u');
  for (let x = 3; x < GROUND_W - 3; x += 2) { dot(g, x, 2, winter ? 'W' : 'p'); dot(g, x, GROUND_H - 2, winter ? 'W' : 'p'); }
  for (let y = 3; y < GROUND_H - 3; y += 2) { dot(g, 2, y, winter ? 'W' : 'p'); dot(g, GROUND_W - 2, y, winter ? 'W' : 'p'); }
}

/** A quarter of the paving, 3 tiles by 2 and a half: flags in staggered rows, half laid or whole. */
const PAVE_W = 48;
const PAVE_H = 40;
function paving(g: Grid, whole: boolean, winter: boolean): void {
  const rows = whole ? PAVE_H : PAVE_H / 2;
  for (let y = PAVE_H - rows; y < PAVE_H; y += 8) {
    for (let x = ((y / 8) % 2) * 6; x < PAVE_W; x += 12) {
      box(g, x, y, Math.min(11, PAVE_W - x), 7, (x + y) % 3 === 0 ? 'd' : 'c');
      box(g, x, y + 7, Math.min(12, PAVE_W - x), 1, 'b');
      if (winter && (x + y) % 2 === 0) box(g, x + 2, y + 1, 4, 2, 'W');
    }
  }
}

/** The well, 24 by 28: a low ring of stone, then its full wall, then its posts, roof and winch with a bucket. */
const WELL_W = 24;
const WELL_H = 28;
const WELL_BASE = 26;
function well(g: Grid, stage: 'low' | 'walls' | 'done', winter: boolean): void {
  box(g, 1, WELL_BASE + 1, WELL_W - 2, 1, 'k');
  const height = stage === 'low' ? 4 : 9;
  box(g, 3, WELL_BASE - height + 1, WELL_W - 6, height, 'c');
  for (let y = WELL_BASE - 2; y > WELL_BASE - height; y -= 3) box(g, 3, y, WELL_W - 6, 1, 'b');
  box(g, 3, WELL_BASE - height + 1, WELL_W - 6, 1, winter ? 'W' : 'd');
  box(g, 5, WELL_BASE - height + 2, WELL_W - 10, 1, 'n');
  if (stage !== 'done') return;
  box(g, 4, WELL_BASE - 22, 2, 14, 'u');
  box(g, WELL_W - 6, WELL_BASE - 22, 2, 14, 'u');
  for (let row = 0; row < 5; row++) box(g, 2 + row, WELL_BASE - 26 + row, WELL_W - 4 - row * 2, 1, row === 0 && winter ? 'W' : 't');
  box(g, 6, WELL_BASE - 15, WELL_W - 12, 1, 'q');
  box(g, WELL_W / 2 - 1, WELL_BASE - 14, 1, 4, 'i');
  box(g, WELL_W / 2 - 3, WELL_BASE - 10, 5, 3, 'q');
}

/** A stall, 24 by 26: two posts and a counter, then a striped awning in its own colours, with its good on the counter. */
const STALL_W = 24;
const STALL_H = 26;
const STALL_BASE = 24;
function stall(g: Grid, id: StallId | null, goods: number, winter: boolean): void {
  box(g, 1, STALL_BASE + 1, STALL_W - 2, 1, 'k');
  box(g, 2, STALL_BASE - 18, 2, 19, 'u');
  box(g, STALL_W - 4, STALL_BASE - 18, 2, 19, 'u');
  box(g, 1, STALL_BASE - 8, STALL_W - 2, 3, 'q');
  box(g, 2, STALL_BASE - 5, STALL_W - 4, 5, 't');
  if (id === null) { box(g, 1, STALL_BASE - 19, STALL_W - 2, 1, 'u'); return; }
  const [colour, stripe] = STRIPE[id];
  for (let row = 0; row < 6; row++) {
    for (let x = 0; x < STALL_W; x++) dot(g, x, STALL_BASE - 23 + row, Math.floor(x / 3) % 2 === 0 ? colour : stripe);
  }
  if (winter) box(g, 1, STALL_BASE - 23, STALL_W - 2, 1, 'W');
  for (let x = 1; x < STALL_W; x += 3) dot(g, x, STALL_BASE - 17, colour);
  for (let i = 0; i < goods; i++) box(g, 4 + i * 3, STALL_BASE - 10, 2, 2, GOOD[id]);
}

const STALL_IDS: readonly StallId[] = ['bread', 'honey', 'wool', 'apples', 'eggs'];
const seasons = <T extends string>(names: readonly T[], paint: (g: Grid, name: T, winter: boolean) => void): Record<string, (g: Grid) => void> =>
  Object.fromEntries(names.flatMap(name => [[name, (g: Grid) => paint(g, name, false)], [`${name}s`, (g: Grid) => paint(g, name, true)]]));

const stallNames = ['frame', ...STALL_IDS.flatMap(id => [id, `${id}-some`, `${id}-full`])] as const;
const stallFrames = seasons(stallNames, (g, name, winter) => {
  if (name === 'frame') return stall(g, null, 0, winter);
  const [id, level] = name.split('-') as [StallId, string | undefined];
  stall(g, id, level === 'full' ? 6 : level === 'some' ? 3 : 0, winter);
});

export const squareSprites: Record<string, SpriteDef> = {
  squareGround: define(GROUND_W, GROUND_H, seasons(['marked'] as const, (g, _, winter) => ground(g, winter)), [GROUND_W / 2, GROUND_H / 2], chars),
  squarePaving: define(PAVE_W, PAVE_H, seasons(['half', 'done'] as const, (g, name, winter) => paving(g, name === 'done', winter)), [PAVE_W / 2, PAVE_H / 2], chars),
  townWell: define(WELL_W, WELL_H, seasons(['low', 'walls', 'done'] as const, (g, name, winter) => well(g, name, winter)), [WELL_W / 2, WELL_BASE + 1], chars),
  townStall: define(STALL_W, STALL_H, stallFrames, [STALL_W / 2, STALL_BASE + 1], chars)
};

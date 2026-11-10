import type { PaletteKey } from './palette';
import { box, define, dot, type Grid } from './sheepSprites';
import type { SpriteDef } from './sprites';

// EASTER EGG: the town, see src/game/town.ts. Market day: the painted sign by the well, and the traders and their carts.

const chars: Record<string, PaletteKey> = {
  k: 'shadow', i: 'ink', W: 'paper', t: 'wood1', u: 'wood2', q: 'wood3', p: 'canvas3', o: 'canvas4',
  R: 'berry2', r: 'berry3', Y: 'scarf3', G: 'grass2', B: 'flower4'
};

/** The sign, 14 by 18: a board on two legs. The eve's face is lettered with a little awning; the day's is the other
 * side, painted in the market's colours under a string of flags. */
const SIGN_W = 14;
const SIGN_H = 18;
function sign(g: Grid, face: 'eve' | 'day', winter: boolean): void {
  box(g, 1, SIGN_H - 1, SIGN_W - 2, 1, 'k');
  box(g, 2, 6, 1, SIGN_H - 7, 'u');
  box(g, SIGN_W - 3, 6, 1, SIGN_H - 7, 'u');
  box(g, 0, 4, SIGN_W, 9, 't');
  box(g, 1, 5, SIGN_W - 2, 7, face === 'eve' ? 'o' : 'R');
  if (face === 'eve') {
    for (let x = 2; x < SIGN_W - 2; x += 2) box(g, x, 6, 1, 1, x % 4 === 0 ? 'R' : 'W');
    box(g, 2, 7, SIGN_W - 4, 1, 'R');
    for (const y of [9, 10]) for (let x = 2; x < SIGN_W - 2; x += 1) if ((x + y) % 3 !== 0) dot(g, x, y, 'i');
  } else {
    for (let x = 1; x < SIGN_W - 1; x += 2) box(g, x, 5, 1, 7, 'r');
    box(g, 3, 7, SIGN_W - 6, 3, 'Y');
    for (let x = 0; x < SIGN_W; x += 3) { dot(g, x, 1, 'i'); dot(g, x + 1, 2, (x / 3) % 2 === 0 ? 'B' : 'G'); }
    box(g, 0, 0, SIGN_W, 1, 'i');
  }
  if (winter) box(g, 0, 3, SIGN_W, 1, 'W');
}

const seasons = <T extends string>(names: readonly T[], paint: (g: Grid, name: T, winter: boolean) => void): Record<string, (g: Grid) => void> =>
  Object.fromEntries(names.flatMap(name => [[name, (g: Grid) => paint(g, name, false)], [`${name}s`, (g: Grid) => paint(g, name, true)]]));

export const marketSprites: Record<string, SpriteDef> = {
  marketSign: define(SIGN_W, SIGN_H, seasons(['eve', 'day'] as const, (g, face, winter) => sign(g, face, winter)), [SIGN_W / 2, SIGN_H - 1], chars)
};

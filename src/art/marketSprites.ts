import type { PaletteKey } from './palette';
import { box, define, dot, type Grid } from './sheepSprites';
import type { SpriteDef } from './sprites';
import { person } from './townsfolkSprites';

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

/** A trader: a townsperson's shape in a travelling cloak, under a broad hat. */
const TRADER_DRESS: Record<'glass' | 'spice', Record<string, PaletteKey>> = {
  glass: { a: 'hair0', f: 'storm', g: 'bird1', h: 'bird2', k: 'scarf2', m: 'ink', n: 'storm', o: 'frost' },
  spice: { a: 'hair2', f: 'berry0', g: 'berry1', h: 'scarf2', k: 'scarf3', m: 'berry0', n: 'berry2', o: 'scarf3' }
};
const TRADER_BASE: Record<string, PaletteKey> = { s: 'shadow', c: 'skin2', d: 'skin3', e: 'skin4', q: 'wood1', r: 'wood3', i: 'ink' };
function trader(g: Grid, stride: number): void {
  person(g, stride, 0);
  // A broad-brimmed hat with a band, wider than any townsperson's head, and a cloak's collar over the shoulders.
  box(g, 0, 4, 16, 1, 'm');
  box(g, 1, 5, 14, 1, 'm');
  box(g, 4, 0, 8, 4, 'n');
  box(g, 4, 3, 8, 1, 'o');
  box(g, 3, 11, 11, 1, 'm');
}
const traderFrames: Record<string, (g: Grid) => void> = { stand: g => trader(g, 0), walk0: g => trader(g, 1), walk1: g => trader(g, -1) };

/** A handcart, 28 by 22, on two wheels, loaded with what the hills can't make: panes of glass and a brass pot, or
 * sacks and jars of spice. */
const CART_W = 28;
const CART_H = 22;
const cartChars: Record<string, PaletteKey> = {
  ...chars, f: 'frost', b: 'scarf3', S: 'canvas2', s: 'canvas1', J: 'fire2', j: 'berry2', g: 'leaf2'
};
function cart(g: Grid, load: 'glass' | 'spice'): void {
  box(g, 2, CART_H - 1, CART_W - 4, 1, 'k');
  box(g, 1, 12, CART_W - 2, 3, 'u');
  box(g, 1, 11, CART_W - 2, 1, 'q');
  box(g, 0, 13, 1, 1, 't');
  for (const cx of [6, CART_W - 7]) {
    box(g, cx - 3, 15, 7, 6, 't');
    box(g, cx - 2, 16, 5, 4, 'u');
    dot(g, cx, 18, 'i');
  }
  if (load === 'glass') {
    for (const x of [3, 9, 15]) {
      box(g, x, 2, 5, 9, 'i');
      box(g, x + 1, 3, 3, 7, 'f');
      dot(g, x + 1, 3, 'W');
    }
    box(g, 21, 5, 5, 6, 'b');
    box(g, 22, 4, 3, 1, 'b');
    box(g, 22, 6, 1, 3, 'W');
  } else {
    for (const x of [2, 9]) {
      box(g, x, 4, 7, 7, 'S');
      box(g, x + 1, 3, 5, 1, 's');
      box(g, x + 2, 6, 3, 1, 's');
    }
    for (const [x, colour] of [[17, 'J'], [21, 'j'], [24, 'g']] as const) {
      box(g, x, 6, 3, 5, colour);
      box(g, x, 5, 3, 1, 'u');
    }
  }
}

export const marketSprites: Record<string, SpriteDef> = {
  marketSign: define(SIGN_W, SIGN_H, seasons(['eve', 'day'] as const, (g, face, winter) => sign(g, face, winter)), [SIGN_W / 2, SIGN_H - 1], chars),
  traderglass: define(16, 24, traderFrames, [8, 21], { ...TRADER_BASE, ...TRADER_DRESS.glass }),
  traderspice: define(16, 24, traderFrames, [8, 21], { ...TRADER_BASE, ...TRADER_DRESS.spice }),
  traderCart: define(CART_W, CART_H, { glass: g => cart(g, 'glass'), spice: g => cart(g, 'spice') }, [CART_W / 2, CART_H - 2], cartChars)
};

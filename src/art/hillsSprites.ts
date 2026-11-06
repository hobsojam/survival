import type { PaletteKey } from './palette';
import { box, define, dot, oval, type Grid } from './sheepSprites';
import type { SpriteDef } from './sprites';

// The hills: the rocky outcrop with its rust-red ore, a dropped pile of it, and the forge that works it.

const legend: Record<string, PaletteKey> = { a: 'stone0', b: 'stone1', c: 'stone2', d: 'stone3', e: 'stone4', r: 'fire0', s: 'fire1', t: 'fire3', u: 'earth1', v: 'earth2', k: 'shadow' };

const OUTCROP_W = 44;
const OUTCROP_H = 32;

function rock(g: Grid): void {
  oval(g, 22, 29, 21, 3, 'k');
  oval(g, 22, 20, 19, 11, 'a');
  oval(g, 21, 19, 18, 10, 'b');
  oval(g, 13, 22, 9, 7, 'c');
  oval(g, 28, 15, 11, 8, 'c');
  oval(g, 27, 12, 7, 4, 'd');
  oval(g, 12, 19, 4, 2, 'd');
  box(g, 25, 9, 4, 1, 'e');
  box(g, 10, 17, 3, 1, 'e');
}

/** Rust-red streaks that a pickaxe could follow. */
function seam(g: Grid, x: number, y: number, length: number): void {
  for (let i = 0; i < length; i++) {
    const drift = Math.floor(i / 2);
    dot(g, x + i, y + drift, 's');
    dot(g, x + i, y + drift + 1, 'r');
    if (i % 3 === 0) dot(g, x + i, y + drift - 1, 's');
  }
}

function outcropReady(g: Grid): void {
  rock(g);
  seam(g, 9, 15, 11);
  seam(g, 22, 12, 12);
  seam(g, 16, 23, 9);
}

/** Dug out for today: the streaks are chipped pale, with a few chips at the foot. */
function outcropSpent(g: Grid): void {
  rock(g);
  seam(g, 22, 12, 4);
  box(g, 11, 17, 8, 3, 'a');
  box(g, 26, 16, 7, 3, 'a');
  box(g, 17, 25, 7, 2, 'a');
  for (const [x, y] of [[8, 27], [15, 29], [30, 28], [34, 26]] as const) box(g, x, y, 2, 1, 'd');
}

function orePile(g: Grid, count: 1 | 2 | 3): void {
  const lump = (x: number, y: number): void => {
    oval(g, x, y, 4, 3, 'b');
    oval(g, x - 1, y - 1, 2.5, 1.5, 'c');
    dot(g, x, y, 's');
    dot(g, x + 1, y, 'r');
    dot(g, x - 1, y + 1, 's');
  };
  oval(g, 8, 13, 7, 2, 'k');
  lump(5, 10);
  if (count >= 2) lump(11, 10);
  if (count >= 3) lump(8, 7);
}

const FORGE_W = 30;
const FORGE_H = 32;

/** A stone lean-to against the workshop: a chimney, a sloping roof, an anvil on a block, and coals in the hearth. */
function forge(g: Grid, coals: 'a' | 'b'): void {
  box(g, 1, 27, 28, 3, 'k');
  box(g, 16, 2, 8, 26, 'b');
  box(g, 17, 3, 6, 24, 'c');
  for (let y = 5; y < 26; y += 4) box(g, 17, y, 6, 1, 'b');
  box(g, 15, 1, 10, 2, 'a');
  box(g, 2, 13, 15, 2, 'u');
  box(g, 1, 11, 17, 2, 'v');
  box(g, 3, 15, 2, 13, 'u');
  // The hearth, set into the chimney's foot.
  box(g, 16, 19, 8, 8, 'a');
  box(g, 17, 22, 6, 5, coals === 'a' ? 'r' : 's');
  box(g, 18, 24, 4, 3, coals === 'a' ? 's' : 't');
  dot(g, 19 + (coals === 'a' ? 0 : 1), 25, 't');
  // The anvil on its block.
  box(g, 8, 24, 5, 4, 'u');
  box(g, 9, 22, 3, 2, 'a');
  box(g, 6, 20, 8, 2, 'b');
  box(g, 6, 20, 8, 1, 'c');
  dot(g, 5, 20, 'b');
}

const hillLegend: Record<string, PaletteKey> = {
  h: 'flower0', i: 'flower3', y: 'flower1', g: 'leaf1', l: 'leaf2', m: 'leaf3', n: 'leaf4', f: 'fox2', o: 'fox3', r: 'fire1',
  t: 'wood1', u: 'wood2', w: 'frost', W: 'paper', x: 'berry2', k: 'shadow'
};

const low = (g: Grid, cx: number, cy: number, rx: number, ry: number, dark: string, light: string): void => {
  oval(g, cx, cy, rx, ry, dark);
  oval(g, cx - 1, cy - 1, rx - 1, Math.max(1, ry - 1), light);
};
/** A low clump of heather, in or out of flower. */
function heather(g: Grid, flower: boolean): void {
  low(g, 8, 11, 6, 3, 'g', 'l');
  if (!flower) return;
  for (const [x, y] of [[4, 10], [6, 8], [8, 9], [10, 8], [12, 10], [7, 11], [10, 11], [5, 12]] as const) {
    dot(g, x, y, 'i');
    dot(g, x + 1, y, 'h');
  }
}
/** A dark, spiny gorse bush; yellow all over in spring. */
function gorse(g: Grid, flower: boolean): void {
  low(g, 8, 9, 6, 5, 'g', 'l');
  for (const [x, y] of [[4, 7], [7, 5], [10, 6], [12, 9], [5, 11], [9, 9], [7, 12], [11, 12], [3, 9], [8, 7]] as const) {
    dot(g, x, y, flower ? 'y' : 'm');
    if (flower) dot(g, x + 1, y, 'y');
  }
}
/** Bracken: fronds arching out from one foot, with leaflets along them, green or rust. */
function bracken(g: Grid, dark: string, light: string): void {
  for (const lean of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const x = 8 + lean * i;
      const y = 13 - Math.round(7 * Math.sin((i + 1) / 6.5 * Math.PI * 0.72));
      dot(g, x, y, dark);
      dot(g, x, y + 1, light);
      if (i % 2 === 1) dot(g, x, y - 1, light);
    }
  }
  for (let y = 7; y < 14; y++) dot(g, 8, y, dark);
  dot(g, 7, 7, light);
  dot(g, 9, 7, light);
  dot(g, 8, 6, light);
}

const TREE_W = 28;
const TREE_H = 34;
interface TreeLook { dark: string; light: string; speck?: string; bare?: boolean }

/** A small tree bent by the wind: a leaning trunk and a crown blown to one side. */
function hillTree(g: Grid, look: TreeLook, stoop: number): void {
  oval(g, 13, 31, 9, 2, 'k');
  for (let y = 31; y >= 14; y--) {
    const x = 12 + Math.round((31 - y) * stoop);
    box(g, x, y, 3, 1, 't');
    dot(g, x, y, 'u');
  }
  const crown = 12 + Math.round(17 * stoop);
  if (look.bare) {
    for (let i = 0; i < 6; i++) {
      const y = 15 - i;
      dot(g, crown + i, y, 't');
      dot(g, crown - i, y + 1, 't');
      dot(g, crown + 2, y - 1, 't');
    }
    box(g, crown + 2, 9, 5, 1, 'W');
    box(g, crown - 6, 10, 5, 1, 'W');
    box(g, crown - 1, 12, 4, 1, 'w');
    return;
  }
  oval(g, crown + 1, 12, 10, 7, look.dark);
  oval(g, crown, 10, 8, 5, look.light);
  if (!look.speck) return;
  for (const [dx, dy] of [[-6, 9], [-3, 7], [0, 11], [3, 8], [6, 11], [-4, 13], [2, 14], [7, 14], [-1, 6]] as const) dot(g, crown + dx, dy, look.speck);
}
const SEASON_LOOKS = (spring: TreeLook, summer: TreeLook, autumn: TreeLook, stoop: number): Record<string, (g: Grid) => void> => ({
  spring: g => hillTree(g, spring, stoop),
  summer: g => hillTree(g, summer, stoop),
  autumn: g => hillTree(g, autumn, stoop),
  snow: g => hillTree(g, { dark: 'w', light: 'W', bare: true }, stoop)
});

const plant = (paint: (g: Grid) => void): SpriteDef => define(16, 16, { still: paint }, [8, 12], hillLegend);

const ponyLegend: Record<string, PaletteKey> = {
  a: 'bird0', b: 'bird1', c: 'bird2', d: 'bird3', e: 'bird4', m: 'hair1', n: 'hair2', i: 'ink', s: 'stone3',
  p: 'canvas1', q: 'canvas2', r: 'canvas3', t: 'wood1', k: 'shadow'
};
const PONY_W = 28;
const PONY_H = 26;
const PONY_FOOT = 23;
const PONY_MIDDLE = 14;

/** A small, shaggy, round-bellied pony, side on and facing right; `step` moves its legs, and `load` adds its packs and shoes. */
function ponyBody(g: Grid, { head, step, load }: { head: 'up' | 'down0' | 'down1'; step: 0 | 1 | null; load: boolean }): void {
  oval(g, PONY_MIDDLE, PONY_FOOT + 1, 11, 2, 'k');
  // Four short legs, the near pair drawn last.
  const legs: [number, 0 | 1, string][] = [[7, 0, 'b'], [17, 1, 'b'], [10, 1, 'c'], [20, 0, 'c']];
  for (const [x, pair, colour] of legs) {
    const lift = step !== null && pair === step ? 1 : 0;
    const swing = step === null ? 0 : (pair === step ? 1 : -1);
    box(g, x + swing, 15, 3, PONY_FOOT - 15 - lift, colour);
    box(g, x + swing, PONY_FOOT - 1 - lift, 3, 1, load ? 's' : 'i');
    if (load) box(g, x + swing, PONY_FOOT - 2 - lift, 3, 1, 'i');
  }
  // A round body, with feathering hanging off the belly.
  oval(g, 14, 12, 10, 6, 'b');
  oval(g, 14, 11, 9, 5, 'c');
  oval(g, 13, 9, 7, 2.5, 'd');
  for (const x of [7, 9, 12, 14, 17, 19]) dot(g, x, 18, 'b');
  // A thick tail.
  box(g, 3, 9, 2, 8, 'm');
  box(g, 2, 11, 2, 8, 'm');
  dot(g, 3, 19, 'n');
  if (head === 'up') {
    box(g, 20, 5, 4, 7, 'c');
    oval(g, 24, 5, 3.5, 2.5, 'c');
    box(g, 25, 5, 3, 3, 'd');
    dot(g, 27, 7, 'i');
    dot(g, 24, 4, 'i');
    box(g, 22, 1, 2, 2, 'b');
    box(g, 18, 3, 3, 9, 'm');
    box(g, 21, 2, 3, 3, 'm');
    dot(g, 25, 3, 'n');
  } else {
    const nose = head === 'down0' ? 0 : 1;
    box(g, 21, 9, 4, 6, 'c');
    oval(g, 25, 16 + nose, 2.5, 3, 'c');
    box(g, 25, 18 + nose, 2, 2, 'd');
    dot(g, 26, 15 + nose, 'i');
    box(g, 19, 7, 3, 8, 'm');
    box(g, 22, 8, 2, 7, 'm');
    box(g, 24, 13 + nose, 2, 1, 'b');
  }
  if (!load) return;
  // Two packs across its back, on a strap.
  box(g, 5, 5, 16, 4, 'q');
  box(g, 5, 5, 16, 1, 'r');
  box(g, 5, 8, 16, 1, 'p');
  box(g, 7, 9, 7, 6, 'q');
  box(g, 7, 9, 7, 1, 'r');
  box(g, 7, 14, 7, 1, 'p');
  box(g, 15, 2, 5, 3, 'p');
  box(g, 15, 2, 5, 1, 'r');
  box(g, 15, 5, 1, 11, 't');
}

export const hillsSprites: Record<string, SpriteDef> = {
  pony: define(PONY_W, PONY_H, {
    stand: g => ponyBody(g, { head: 'up', step: null, load: false }),
    walk0: g => ponyBody(g, { head: 'up', step: 0, load: false }),
    walk1: g => ponyBody(g, { head: 'up', step: 1, load: false }),
    graze0: g => ponyBody(g, { head: 'down0', step: null, load: false }),
    graze1: g => ponyBody(g, { head: 'down1', step: null, load: false }),
    loadStand: g => ponyBody(g, { head: 'up', step: null, load: true }),
    loadWalk0: g => ponyBody(g, { head: 'up', step: 0, load: true }),
    loadWalk1: g => ponyBody(g, { head: 'up', step: 1, load: true })
  }, [PONY_MIDDLE, PONY_FOOT], ponyLegend),
  hillHeather: plant(g => heather(g, false)),
  hillHeatherBloom: plant(g => heather(g, true)),
  hillGorse: plant(g => gorse(g, false)),
  hillGorseBloom: plant(g => gorse(g, true)),
  hillBracken: plant(g => bracken(g, 'l', 'm')),
  hillBrackenRust: plant(g => bracken(g, 'r', 'f')),
  hillThorn: define(TREE_W, TREE_H, SEASON_LOOKS(
    { dark: 'l', light: 'n', speck: 'W' }, { dark: 'g', light: 'l', speck: 'm' }, { dark: 't', light: 'r', speck: 'x' }, 0.25
  ), [13, 31], hillLegend),
  hillRowan: define(TREE_W, TREE_H, SEASON_LOOKS(
    { dark: 'l', light: 'n' }, { dark: 'l', light: 'm', speck: 'W' }, { dark: 'r', light: 'o', speck: 'x' }, 0.15
  ), [13, 31], hillLegend),
  forge: define(FORGE_W, FORGE_H, { a: g => forge(g, 'a'), b: g => forge(g, 'b') }, [FORGE_W / 2, FORGE_H - 4], legend),
  outcrop: define(OUTCROP_W, OUTCROP_H, { ready: outcropReady, spent: outcropSpent }, [OUTCROP_W / 2, OUTCROP_H - 3], legend),
  orePile: define(16, 16, { one: g => orePile(g, 1), two: g => orePile(g, 2), many: g => orePile(g, 3) }, [8, 12], legend)
};

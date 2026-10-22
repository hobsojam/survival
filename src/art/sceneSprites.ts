import type { PaletteKey } from './palette';
import type { SpriteDef } from './sprites';

type Grid = string[][];
const grid = (w: number, h: number): Grid => Array.from({ length: h }, () => Array(w).fill('.'));
const pixel = (g: Grid, x: number, y: number, c: string) => { if (g[y]?.[x] !== undefined) g[y][x] = c; };
const rect = (g: Grid, x: number, y: number, w: number, h: number, c: string) => {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) pixel(g, i, j, c);
};
const oval = (g: Grid, cx: number, cy: number, rx: number, ry: number, c: string) => {
  for (let y = Math.ceil(cy - ry); y <= cy + ry; y++) for (let x = Math.ceil(cx - rx); x <= cx + rx; x++)
    if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) pixel(g, x, y, c);
};
const line = (g: Grid, x0: number, y0: number, x1: number, y1: number, c: string) => {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i++) pixel(g, Math.round(x0 + (x1 - x0) * i / steps), Math.round(y0 + (y1 - y0) * i / steps), c);
};
const rows = (g: Grid): string[] => g.map(row => row.join(''));
function define(w: number, h: number, legend: Record<string, PaletteKey>, frames: Record<string, (g: Grid) => void>, anchor: [number, number] = [Math.floor(w / 2), h - 2]): SpriteDef {
  return { size: [w, h], anchor, legend, frames: Object.fromEntries(Object.entries(frames).map(([name, paint]) => {
    const g = grid(w, h); paint(g); return [name, rows(g)];
  })) };
}

const bushLegend = { s: 'shadow', a: 'leaf0', b: 'leaf1', c: 'leaf2', d: 'leaf3', e: 'leaf4', f: 'berry1', g: 'berry2', h: 'berry3', i: 'berry4' } as const;
function bush(g: Grid, berries: boolean): void {
  oval(g, 8, 14, 7, 2, 's');
  rect(g, 7, 9, 3, 5, 'a');
  oval(g, 5, 8, 4, 5, 'a'); oval(g, 11, 8, 4, 5, 'a');
  oval(g, 6, 7, 4, 4, 'b'); oval(g, 11, 7, 4, 4, 'c');
  rect(g, 4, 4, 3, 1, 'd'); rect(g, 9, 3, 3, 1, 'd'); pixel(g, 12, 6, 'e');
  if (berries) for (const [x, y] of [[4, 8], [8, 5], [12, 9], [7, 11], [11, 4]]) {
    rect(g, x, y, 2, 2, 'f'); pixel(g, x, y, 'g'); pixel(g, x + 1, y, 'h'); pixel(g, x, y + 1, 'i');
  }
}

const reedLegend = { s: 'shadow', a: 'grass0', b: 'grass1', c: 'grass2', d: 'grass3', e: 'grass4', f: 'canvas2', g: 'canvas3' } as const;
function reeds(g: Grid, ready: boolean): void {
  oval(g, 8, 14, 7, 2, 's');
  for (const [x, top] of [[3, 5], [6, 3], [9, 5], [12, 4]]) {
    const y = ready ? top : 10;
    line(g, x, 13, x + 1, y, 'b'); line(g, x + 1, 12, x + 2, y + 2, 'c');
    if (ready) { rect(g, x, y - 2, 2, 3, 'f'); pixel(g, x, y - 2, 'g'); }
  }
  pixel(g, 4, 11, 'd'); pixel(g, 10, 10, 'e');
}

const campLegend = { s: 'shadow', a: 'wood0', b: 'wood1', c: 'wood2', d: 'wood3', e: 'wood4', f: 'canvas0', g: 'canvas1', h: 'canvas2', i: 'canvas3', j: 'canvas4', k: 'berry2', l: 'berry4', m: 'stone0', n: 'stone1', o: 'stone2', p: 'stone3', q: 'stone4', r: 'fire0', t: 'fire1', u: 'fire2', v: 'fire3', w: 'fire4', z: 'earth2' } as const;
function site(g: Grid, x: number, y: number, w: number, h: number): void {
  oval(g, x + w / 2, y + h - 1, w / 2, 2, 's');
  line(g, x, y, x + w - 1, y, 'i'); line(g, x, y + h - 1, x + w - 1, y + h - 1, 'i');
  line(g, x, y, x, y + h - 1, 'h'); line(g, x + w - 1, y, x + w - 1, y + h - 1, 'h');
  line(g, x + 2, y + 2, x + w - 3, y + h - 3, 'h');
  line(g, x + w - 3, y + 2, x + 2, y + h - 3, 'h');
  for (const px of [x, x + w - 1]) for (const py of [y, y + h - 1]) rect(g, px - 1, py - 1, 3, 3, 'd');
}
function shelter(g: Grid, built: boolean, bed: boolean): void {
  if (!built) { site(g, 5, 19, 38, 15); return; }
  oval(g, 24, 34, 23, 4, 's');
  rect(g, 3, 18, 42, 15, 'a'); rect(g, 5, 17, 38, 14, 'g');
  for (let y = 5; y < 24; y++) {
    const half = Math.min(21, Math.floor((y - 5) * 1.18));
    rect(g, 24 - half, y, half + 1, 1, 'h'); rect(g, 25, y, half, 1, 'i');
    pixel(g, 24 - half, y, 'f'); pixel(g, 24 + half, y, 'g');
  }
  line(g, 24, 5, 24, 29, 'j');
  rect(g, 16, 22, 17, 11, 'f'); rect(g, 19, 23, 11, 10, 'a');
  rect(g, 6, 30, 36, 2, 'd'); rect(g, 3, 32, 42, 2, 'b');
  if (bed) { rect(g, 18, 28, 12, 5, 'i'); rect(g, 18, 28, 4, 4, 'j'); rect(g, 22, 29, 8, 2, 'h'); }
}
function crate(g: Grid, built: boolean): void {
  if (!built) { site(g, 2, 8, 20, 10); return; }
  oval(g, 12, 17, 10, 2, 's'); rect(g, 2, 7, 20, 10, 'a');
  rect(g, 4, 9, 16, 7, 'c'); rect(g, 3, 6, 18, 4, 'd');
  rect(g, 5, 7, 14, 1, 'e'); rect(g, 5, 11, 14, 1, 'b');
  line(g, 5, 10, 18, 15, 'd'); line(g, 18, 10, 5, 15, 'b');
  rect(g, 10, 7, 4, 3, 'e');
}
function rack(g: Grid, built: boolean): void {
  if (!built) { site(g, 2, 14, 28, 9); return; }
  oval(g, 16, 23, 15, 2, 's');
  rect(g, 3, 4, 3, 18, 'a'); rect(g, 26, 4, 3, 18, 'a');
  rect(g, 2, 3, 28, 3, 'c'); rect(g, 3, 13, 26, 2, 'd');
  for (const x of [8, 13, 18, 23]) {
    rect(g, x, 6, 1, 7, 'e'); rect(g, x - 1, 13, 3, 3, 'k'); pixel(g, x, 13, 'l');
  }
}
function windbreak(g: Grid, built: boolean): void {
  if (!built) { site(g, 2, 16, 44, 5); return; }
  oval(g, 24, 20, 22, 2, 's');
  rect(g, 2, 5, 44, 15, 'a');
  for (let x = 4; x < 44; x += 6) {
    rect(g, x, 6, 5, 12, x % 3 ? 'c' : 'd'); rect(g, x + 1, 7, 1, 9, 'e');
  }
  rect(g, 2, 4, 44, 2, 'd'); rect(g, 1, 17, 46, 3, 'b');
}
function fire(g: Grid, hearth: boolean): void {
  oval(g, 16, 24, 14, 3, 's');
  oval(g, 16, 18, hearth ? 13 : 11, 8, hearth ? 'n' : 'z');
  oval(g, 16, 18, 9, 5, 'm');
  for (const [x, y] of [[6, 17], [10, 11], [16, 10], [22, 11], [26, 17], [24, 23], [16, 25], [8, 23]]) {
    rect(g, x - 2, y, 4, 3, hearth ? 'o' : 'h'); pixel(g, x - 1, y, hearth ? 'q' : 'j');
  }
  if (hearth) { rect(g, 4, 24, 24, 2, 'p'); rect(g, 6, 22, 20, 2, 'o'); }
  line(g, 10, 23, 21, 17, 'c'); line(g, 10, 18, 22, 23, 'd');
}

function flame(g: Grid, alternate: boolean): void {
  for (let y = 2 + (alternate ? 2 : 0); y < 18; y++) {
    const half = Math.floor((y + 1) / 4);
    rect(g, 8 - half + (alternate ? 1 : 0), y, half * 2 + 1, 1, y < 9 ? 'c' : 'b');
  }
  for (let y = 9; y < 18; y++) rect(g, 7 - Math.floor((y - 8) / 5), y, 3 + Math.floor((y - 8) / 3), 1, y < 14 ? 'e' : 'd');
  pixel(g, alternate ? 13 : 3, 1, 'e');
}

const personLegend = { s: 'shadow', a: 'hair0', b: 'hair1', c: 'hair2', d: 'skin1', e: 'skin3', f: 'skin4', g: 'coat0', h: 'coat1', i: 'coat2', j: 'coat3', k: 'coat4', l: 'scarf1', m: 'scarf3', n: 'scarf4', o: 'canvas1', p: 'canvas3', q: 'wood1' } as const;
function survivor(g: Grid, step: boolean): void {
  oval(g, 10, 26, 8, 2, 's');
  rect(g, step ? 6 : 5, 22, 4, 4, 'q'); rect(g, step ? 12 : 11, 22, 4, 4, 'q');
  rect(g, 3, 13, 5, 10, 'o'); rect(g, 4, 14, 3, 8, 'p');
  rect(g, 5, 11, 11, 13, 'g'); rect(g, 6, 12, 9, 11, 'i');
  rect(g, 2, 13, 3, 8, 'h'); rect(g, 16, 13, 3, 8, 'h');
  rect(g, 3, 19, 2, 2, 'j'); rect(g, 16, 19, 2, 2, 'j');
  rect(g, 6, 11, 9, 3, 'm'); rect(g, 7, 11, 6, 1, 'n');
  rect(g, 6, 3, 9, 8, 'b'); rect(g, 7, 5, 7, 6, 'e');
  rect(g, 8, 6, 5, 3, 'f'); rect(g, 6, 3, 9, 3, 'a');
  rect(g, 8, 2, 6, 2, 'c'); pixel(g, 13, 8, 'd');
  rect(g, 8, 15, 5, 2, 'k');
}

const animalLegend = { s: 'shadow', a: 'bird0', b: 'bird1', c: 'bird2', d: 'bird3', e: 'bird4', f: 'beak', g: 'fox0', h: 'fox1', i: 'fox2', j: 'fox3', k: 'fox4' } as const;
function bird(g: Grid, flying: boolean): void {
  if (flying) {
    line(g, 1, 6, 6, 3, 'c'); line(g, 6, 3, 12, 6, 'c');
    rect(g, 5, 5, 5, 3, 'd'); rect(g, 9, 4, 3, 3, 'c'); pixel(g, 12, 5, 'f');
  } else {
    oval(g, 7, 10, 6, 1, 's'); oval(g, 6, 7, 5, 3, 'b');
    oval(g, 7, 6, 4, 2, 'c'); rect(g, 9, 3, 4, 4, 'd');
    pixel(g, 11, 4, 'a'); pixel(g, 13, 5, 'f'); rect(g, 5, 8, 4, 1, 'e');
  }
}
function fox(g: Grid, sitting: boolean): void {
  oval(g, 16, 19, 13, 2, 's');
  if (sitting) {
    oval(g, 10, 15, 8, 4, 'i'); rect(g, 13, 7, 11, 11, 'h');
    rect(g, 15, 8, 8, 9, 'j'); rect(g, 18, 12, 4, 5, 'k');
    rect(g, 17, 4, 8, 6, 'j'); rect(g, 17, 2, 2, 4, 'h'); rect(g, 23, 2, 2, 4, 'h');
    pixel(g, 23, 6, 'g'); pixel(g, 26, 8, 'g'); rect(g, 6, 15, 4, 2, 'k');
  } else {
    rect(g, 3, 11, 9, 4, 'i'); rect(g, 4, 12, 3, 2, 'k');
    oval(g, 17, 12, 9, 5, 'h'); rect(g, 10, 10, 14, 4, 'j');
    rect(g, 11, 15, 3, 4, 'g'); rect(g, 21, 15, 3, 4, 'g');
    rect(g, 23, 6, 6, 7, 'j'); rect(g, 23, 4, 2, 4, 'h'); rect(g, 28, 4, 2, 4, 'h');
    rect(g, 27, 10, 4, 2, 'k'); pixel(g, 31, 10, 'g'); pixel(g, 27, 8, 'g');
  }
}

export const sceneSprites: Record<string, SpriteDef> = {
  berryBush: define(16, 16, bushLegend, { ready: g => bush(g, true), depleted: g => bush(g, false) }),
  fiberReeds: define(16, 16, reedLegend, { ready: g => reeds(g, true), depleted: g => reeds(g, false) }),
  shelter: define(48, 40, campLegend, { site: g => shelter(g, false, false), built: g => shelter(g, true, false), builtBed: g => shelter(g, true, true) }),
  crate: define(24, 20, campLegend, { site: g => crate(g, false), built: g => crate(g, true) }),
  dryingRack: define(32, 26, campLegend, { site: g => rack(g, false), built: g => rack(g, true) }),
  windbreak: define(48, 24, campLegend, { site: g => windbreak(g, false), built: g => windbreak(g, true) }),
  firePit: define(32, 28, campLegend, { unlit: g => fire(g, false), burning: g => fire(g, false), burningB: g => fire(g, false) }),
  hearth: define(32, 28, campLegend, { unlit: g => fire(g, true), burning: g => fire(g, true), burningB: g => fire(g, true) }),
  flame: define(16, 20, { b: 'fire1', c: 'fire2', d: 'fire3', e: 'fire4' }, { out: () => {}, burning: g => flame(g, false), burningB: g => flame(g, true) }, [8, 18]),
  survivor: define(20, 28, personLegend, { idle: g => survivor(g, false), step: g => survivor(g, true) }),
  bird: define(14, 12, animalLegend, { ground: g => bird(g, false), flying: g => bird(g, true) }),
  fox: define(32, 22, animalLegend, { standing: g => fox(g, false), sitting: g => fox(g, true) }),
  firefly: define(3, 3, { a: 'firefly', b: 'fire4' }, { still: g => { pixel(g, 1, 0, 'a'); pixel(g, 0, 1, 'a'); pixel(g, 1, 1, 'b'); pixel(g, 2, 1, 'a'); pixel(g, 1, 2, 'a'); } }, [1, 1])
};

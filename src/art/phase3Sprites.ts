import type { PaletteKey } from './palette';
import type { SpriteDef } from './sprites';

type Grid = string[][];
const blank = (w: number, h: number): Grid => Array.from({ length: h }, () => Array.from({ length: w }, () => '.'));
const dot = (g: Grid, x: number, y: number, c: string): void => { if (g[y]?.[x] !== undefined) g[y][x] = c; };
const box = (g: Grid, x: number, y: number, w: number, h: number, c: string): void => {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) dot(g, xx, yy, c);
};
const line = (g: Grid, x0: number, y0: number, x1: number, y1: number, c: string): void => {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i++) dot(g, Math.round(x0 + (x1 - x0) * i / steps), Math.round(y0 + (y1 - y0) * i / steps), c);
};
const oval = (g: Grid, cx: number, cy: number, rx: number, ry: number, c: string): void => {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
    if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) dot(g, x, y, c);
};
function define(w: number, h: number, legend: Record<string, PaletteKey>, frames: Record<string, (g: Grid) => void>, anchor: [number, number] = [Math.floor(w / 2), h - 2], animations?: SpriteDef['animations']): SpriteDef {
  return { size: [w, h], anchor, legend, frames: Object.fromEntries(Object.entries(frames).map(([name, draw]) => {
    const g = blank(w, h); draw(g); return [name, g.map(row => row.join(''))];
  })), animations };
}

const nodeLegend = { s: 'shadow', a: 'wood0', b: 'wood1', c: 'wood2', d: 'wood3', e: 'wood4', f: 'earth2', g: 'earth3', h: 'leaf0', i: 'leaf1', j: 'leaf2', k: 'leaf3', l: 'leaf4', m: 'berry1', n: 'berry2', o: 'berry3', p: 'berry4', q: 'grass0', r: 'grass1', t: 'grass3', u: 'grass4', v: 'canvas2', w: 'canvas3', z: 'canvas4' } as const;
function branch(g: Grid, ready: boolean): void {
  oval(g, 8, 13, ready ? 6 : 5, 2, 's');
  if (!ready) {
    box(g, 4, 12, 8, 2, 'f'); box(g, 5, 12, 3, 1, 'g');
    line(g, 4, 11, 8, 13, 'b'); line(g, 9, 12, 12, 10, 'c'); dot(g, 4, 11, 'e');
    return;
  }
  for (const [x0, y0, x1, y1] of [[2, 11, 13, 6], [3, 8, 13, 12], [4, 12, 11, 5], [2, 10, 12, 10]]) {
    line(g, x0, y0 + 1, x1, y1 + 1, 'a'); line(g, x0, y0, x1, y1, 'c');
    dot(g, x0, y0, 'e'); dot(g, x1, y1, 'd');
  }
}
function bush(g: Grid, berries: boolean, rustle = 0): void {
  oval(g, 8, 14, 6, 2, 's'); box(g, 7, 9, 3, 5, 'b');
  oval(g, 8 + rustle, 9, 7, 5, 'h');
  oval(g, 6 + rustle, 7, 4, 3, 'i'); oval(g, 11 + rustle, 8, 3, 3, 'j');
  box(g, 4 + rustle, 4, 4, 2, 'k'); box(g, 9 + rustle, 5, 3, 2, 'k');
  box(g, 4 + rustle, 4, 2, 1, 'l'); box(g, 10 + rustle, 5, 2, 1, 'l');
  if (berries) for (const [x, y] of [[4, 9], [7, 6], [11, 9], [7, 11], [12, 6]]) {
    box(g, x + rustle, y, 2, 2, 'm'); dot(g, x + rustle, y, 'p');
    dot(g, x + rustle + 1, y, 'o'); dot(g, x + rustle + 1, y + 1, 'n');
  }
}
function reeds(g: Grid, ready: boolean, lean = 0): void {
  oval(g, 8, 14, 6, 2, 's');
  for (const [x, top] of [[3, 5], [6, 3], [9, 4], [12, 6], [7, 6]]) {
    if (!ready) {
      line(g, x, 13, x + 1, 10, 'r'); box(g, x + 1, 10, 2, 1, 'v');
      continue;
    }
    line(g, x, 13, x + lean, top + 2, 'q');
    line(g, x + 1, 13, x + lean + 1, top + 2, 't');
    box(g, x + lean, top, 2, 3, 'v'); box(g, x + lean, top, 2, 1, 'z');
    dot(g, x + lean + 1, top + 1, 'w');
  }
}

// Seasonal forage. The hazel's leaves use the broadleaf crown colours, so they turn with the trees in autumn.
const forageLegend = { s: 'shadow', a: 'wood0', b: 'wood1', c: 'wood2', d: 'wood3', e: 'wood4', h: 'leaf0', i: 'leaf1', j: 'leaf2', k: 'leaf3', l: 'leaf4',
  m: 'crown1', n: 'crown2', o: 'crown3', p: 'crown4', q: 'grass1', r: 'grass3', t: 'grass4', u: 'scarf2', v: 'scarf3', w: 'scarf4', x: 'ink', y: 'earth2', z: 'earth3' } as const;
function hazel(g: Grid, ready: boolean): void {
  oval(g, 8, 14, 6, 2, 's');
  for (const [x0, x1] of [[5, 3], [8, 8], [11, 13]]) line(g, x0, 13, x1, 6, 'b');
  oval(g, 8, 8, 6, 4, 'm'); oval(g, 6, 7, 3, 2, 'n'); oval(g, 11, 7, 3, 3, 'n');
  box(g, 4, 5, 3, 1, 'o'); box(g, 10, 4, 3, 1, 'o'); dot(g, 5, 5, 'p'); dot(g, 11, 4, 'p');
  if (!ready) return;
  // Nuts in pale husks, in twos and threes.
  for (const [x, y] of [[4, 9], [9, 10], [11, 7], [6, 6]]) {
    box(g, x, y, 2, 2, 'd'); dot(g, x, y, 'e'); dot(g, x + 1, y + 1, 'c');
    dot(g, x, y - 1, 'l'); dot(g, x + 1, y - 1, 'k');
  }
}
function pineSapling(g: Grid, ready: boolean): void {
  oval(g, 8, 14, 5, 2, 's'); box(g, 7, 11, 2, 3, 'b'); dot(g, 7, 11, 'c');
  for (const [y, half] of [[2, 1], [3, 2], [5, 3], [6, 4], [8, 5], [9, 6], [10, 6]]) {
    box(g, 8 - half, y, half * 2, 1, 'i'); box(g, 8, y, half, 1, 'h');
  }
  dot(g, 7, 1, 'j'); dot(g, 8, 1, 'j');
  if (!ready) {
    for (const [x, y] of [[4, 8], [11, 9], [6, 5], [10, 6]]) dot(g, x, y, 'c');
    return;
  }
  // Bright new needle tips, frosted at their ends in winter.
  for (const [x, y] of [[6, 3], [9, 3], [5, 5], [10, 5], [4, 8], [11, 8], [3, 10], [12, 10], [7, 7]]) {
    dot(g, x, y, 'k'); dot(g, x, y - 1, 'l');
  }
}
function greens(g: Grid, ready: boolean): void {
  oval(g, 8, 14, 6, 2, 's');
  if (!ready) {
    box(g, 4, 12, 8, 2, 'y'); box(g, 5, 12, 3, 1, 'z');
    for (const x of [5, 8, 11]) line(g, x, 13, x, 11, 'q');
    return;
  }
  // Broad wild-garlic leaves fanning from the ground, with a few white flower heads.
  for (const [x0, y0, x1, y1] of [[8, 13, 3, 7], [8, 13, 6, 5], [8, 13, 10, 5], [8, 13, 13, 7], [8, 13, 8, 4]]) {
    line(g, x0 - 1, y0, x1 - 1, y1 + 1, 'j'); line(g, x0, y0, x1, y1, 'k'); dot(g, x1, y1, 'l');
  }
  box(g, 5, 11, 6, 2, 'j'); line(g, 4, 12, 12, 12, 'r'); dot(g, 3, 12, 'q'); dot(g, 12, 11, 't');
  for (const [x, y] of [[5, 4], [11, 4]]) { dot(g, x, y, 'w'); dot(g, x, y + 1, 'q'); }
}
/** A tuft of wild grain: thin pale stalks, each bending under a golden seed head; gathered, only short stubble is left. */
function wildGrain(g: Grid, ready: boolean): void {
  oval(g, 8, 14, 6, 2, 's');
  const stalks = [[4, 6], [6, 4], [8, 3], [10, 4], [12, 6]];
  if (!ready) {
    for (const [x] of stalks) line(g, x, 13, x, 11, 'r');
    dot(g, 6, 11, 'v'); dot(g, 10, 11, 'v');
    return;
  }
  for (const [x, top] of stalks) {
    line(g, x, 13, x, top + 3, 'r');
    // The seed head leans a little, dark-edged so it reads against the meadow.
    line(g, x, top + 2, x + 1, top, 'v'); dot(g, x, top + 1, 'w'); dot(g, x + 1, top + 2, 'u');
  }
  line(g, 5, 13, 11, 13, 'q');
}
type HollowFrame = 'ready' | 'gathered' | 'bees0' | 'bees1';
function hollowTree(g: Grid, frame: HollowFrame): void {
  oval(g, 12, 30, 9, 2, 's');
  // An old broken trunk with roots, a stub of a branch and a few green shoots on top.
  box(g, 7, 6, 10, 24, 'b'); box(g, 7, 6, 3, 24, 'a'); box(g, 14, 6, 2, 24, 'c'); line(g, 16, 6, 16, 29, 'd');
  line(g, 4, 30, 7, 26, 'b'); line(g, 20, 30, 17, 26, 'c'); line(g, 3, 30, 5, 30, 'a');
  for (const [x, y] of [[7, 5], [9, 4], [11, 5], [13, 3], [15, 5], [16, 4]]) box(g, x, y, 2, 2, 'b');
  dot(g, 13, 3, 'e'); dot(g, 16, 4, 'd');
  line(g, 17, 12, 21, 9, 'c'); dot(g, 21, 9, 'e');
  oval(g, 20, 8, 2, 1.5, 'j'); oval(g, 9, 3, 2, 1.5, 'j'); dot(g, 9, 2, 'l'); dot(g, 20, 7, 'l');
  for (const y of [10, 16, 23]) line(g, 11, y, 12, y + 2, 'a');
  // The hollow, with the comb glowing gold inside until the honey is taken.
  oval(g, 12, 18, 2.5, 3.5, 'x'); oval(g, 12, 18, 3.5, 4.5, 'a'); oval(g, 12, 18, 2.5, 3.5, 'x');
  if (frame === 'gathered') return;
  box(g, 11, 18, 3, 3, 'u'); dot(g, 11, 18, 'v'); dot(g, 13, 19, 'v'); dot(g, 12, 20, 'w');
  if (frame === 'ready') return;
  // A few bees about the opening, drifting from side to side.
  const spots = frame === 'bees0' ? [[16, 14], [8, 12], [17, 20]] : [[17, 13], [7, 14], [16, 21]];
  for (const [x, y] of spots) { dot(g, x, y, 'v'); dot(g, x + 1, y, 'x'); }
}

const campLegend = { s: 'shadow', a: 'wood0', b: 'wood1', c: 'wood2', d: 'wood3', e: 'wood4', f: 'canvas0', g: 'canvas1', h: 'canvas2', i: 'canvas3', j: 'canvas4', k: 'berry2', l: 'berry4', m: 'stone0', n: 'stone1', o: 'stone2', p: 'stone3', q: 'stone4', r: 'fire0', t: 'fire1', u: 'fire2', v: 'fire3', w: 'fire4', z: 'earth3', A: 'earth2', B: 'earth4', C: 'scarf3', D: 'berry1', E: 'berry2', F: 'berry3', G: 'leaf1', H: 'leaf2', I: 'leaf3', J: 'flower1', K: 'flower3', L: 'leaf4' } as const;
function stake(g: Grid, x: number, y: number): void {
  box(g, x, y, 2, 4, 'a'); box(g, x, y, 1, 2, 'd'); dot(g, x, y, 'e');
}
function shelterSite(g: Grid): void {
  box(g, 6, 20, 36, 8, 'z');
  for (const [x, y] of [[4, 18], [42, 18], [4, 27], [42, 27]]) stake(g, x, y);
  line(g, 6, 19, 42, 19, 'h'); line(g, 6, 27, 42, 27, 'h');
  line(g, 5, 20, 5, 27, 'h'); line(g, 43, 20, 43, 27, 'h');
}
/** How full a camp store looks: the larder, woodpile and fibre stack share these frames. */
export type StockLevel = 'empty' | 'some' | 'full';
type ShelterStage = 'plain' | 'thatched' | 'stonework' | 'porch' | 'finished';
function shelter(g: Grid, bed: boolean, stage: ShelterStage = 'plain'): void {
  oval(g, 24, 36, 21, 3, 's');
  box(g, 3, 17, 42, 17, 'a'); box(g, 5, 18, 38, 14, 'g');
  for (let y = 4; y <= 28; y++) {
    const half = Math.min(21, Math.floor((y - 4) * .88));
    const roof = stage === 'plain' ? 'h' : 'A';
    const highlight = stage === 'plain' ? 'g' : 'B';
    box(g, 24 - half, y, half + 1, 1, roof); box(g, 25, y, half, 1, highlight);
    dot(g, 24 - half, y, stage === 'plain' ? 'f' : 'C');
  }
  if (stage !== 'plain') {
    for (let y = 8; y < 25; y += 4) {
      line(g, 24 - Math.min(21, Math.floor((y - 4) * .88)), y, 17, y + 3, 'C');
      line(g, 25 + Math.min(21, Math.floor((y - 4) * .88)), y, 31, y + 3, 'A');
    }
  }
  line(g, 24, 4, 24, 25, 'j');
  box(g, 16, 23, 17, 11, 'f'); box(g, 19, 24, 11, 10, 'a');
  if (bed) { box(g, 19, 29, 11, 5, 'i'); box(g, 20, 28, 9, 2, 'j'); box(g, 20, 32, 9, 2, 'g'); }
  if (stage === 'stonework' || stage === 'porch' || stage === 'finished') {
    box(g, 4, 33, 40, 4, 'm');
    for (const x of [8, 16, 24, 32, 40]) { line(g, x, 33, x, 36, 'o'); }
    box(g, 37, 5, 5, 13, 'm'); box(g, 38, 4, 3, 2, 'p'); box(g, 38, 7, 3, 8, 'n');
  } else {
    box(g, 4, 34, 40, 2, 'c'); box(g, 5, 34, 38, 1, 'e');
  }
  for (const x of [4, 43]) { line(g, 24, 5, x, 33, 'b'); dot(g, x, 33, 'e'); }
  if (stage === 'porch' || stage === 'finished') {
    box(g, 13, 34, 23, 2, 'a'); box(g, 14, 35, 21, 3, 'c'); box(g, 14, 35, 21, 1, 'e');
    for (const x of [15, 34]) { box(g, x, 30, 2, 8, 'b'); dot(g, x, 30, 'e'); }
    line(g, 14, 30, 36, 30, 'e');
  }
  if (stage === 'finished') {
    box(g, 29, 24, 5, 10, 'b'); box(g, 30, 25, 3, 8, 'c'); dot(g, 32, 29, 'e');
    box(g, 10, 21, 5, 4, 'a'); box(g, 11, 22, 3, 2, 'j'); line(g, 12, 22, 12, 24, 'b');
    box(g, 34, 21, 4, 4, 'a'); box(g, 35, 22, 2, 2, 'j'); line(g, 36, 22, 36, 24, 'b');
  }
}
function rackSite(g: Grid): void {
  for (const x of [3, 27]) for (const y of [7, 12]) stake(g, x, y);
  line(g, 5, 8, 27, 8, 'h'); line(g, 5, 12, 27, 12, 'h');
}
function rack(g: Grid): void {
  oval(g, 16, 29, 14, 2, 's');
  for (const x of [3, 27]) { box(g, x, 6, 3, 24, 'a'); box(g, x, 6, 1, 21, 'd'); dot(g, x, 6, 'e'); }
  box(g, 3, 5, 27, 3, 'a'); box(g, 4, 5, 25, 1, 'e');
  for (const x of [8, 14, 20, 25]) {
    line(g, x, 8, x, 16, 'h'); box(g, x - 2, 16, 5, 4, 'k');
    box(g, x - 1, 15, 3, 2, 'l'); dot(g, x, 19, 'l');
  }
}
function windbreakSite(g: Grid): void {
  for (const [x, y] of [[3, 8], [10, 6], [19, 5], [28, 5], [37, 6], [44, 8]]) stake(g, x, y);
}
function windbreak(g: Grid): void {
  oval(g, 24, 28, 22, 2, 's');
  for (let x = 2; x < 46; x += 5) {
    const top = Math.trunc(9 + Math.abs(x - 24) / 7);
    box(g, x, top, 5, 27 - top, 'a'); box(g, x + 1, top + 1, 3, 25 - top, 'c');
    box(g, x + 1, top, 2, 1, 'e');
  }
  for (const y of [16, 22]) { line(g, 3, y + 1, 44, y + 1, 'a'); line(g, 3, y, 44, y, 'd'); }
}
function fireBase(g: Grid, hearth: boolean): void {
  const cx = g[0].length / 2, cy = g.length - 8;
  oval(g, cx, cy + 5, hearth ? 14 : 10, 2, 's');
  if (hearth) {
    oval(g, cx, cy + 1, 14, 8, 'm'); oval(g, cx, cy, 11, 5, 'n');
    box(g, 3, cy + 2, 26, 6, 'm'); box(g, 4, cy + 2, 24, 4, 'o');
    for (const x of [6, 13, 20, 27]) box(g, x, cy + 3, 1, 3, 'm');
    box(g, 5, cy + 1, 22, 2, 'p'); box(g, 7, cy + 1, 18, 1, 'q');
  } else {
    oval(g, cx, cy + 1, 10, 5, 'm'); oval(g, cx, cy, 7, 3, 'n');
    for (const [dx, dy] of [[-9, 0], [-7, -4], [-3, -5], [3, -5], [7, -4], [9, 0], [6, 4], [0, 5], [-6, 4]]) {
      box(g, cx + dx - 1, cy + dy, 3, 3, 'o'); dot(g, cx + dx - 1, cy + dy, 'q');
    }
  }
  line(g, cx - 6, cy + 3, cx + 5, cy - 2, 'a'); line(g, cx - 5, cy - 2, cx + 6, cy + 3, 'c');
  dot(g, cx - 6, cy + 3, 'e'); dot(g, cx - 5, cy - 2, 'e');
}
function flameHeight(hearth: boolean, low: boolean): number {
  if (low) return 6;
  return hearth ? 14 : 12;
}
/** White at the base, then yellow, then orange toward the tip. */
function flameShade(y: number, height: number): string {
  if (y < height * .3) return 'w';
  return y < height * .6 ? 'v' : 't';
}
function flames(g: Grid, hearth: boolean, mode: 'burning' | 'low' | 'windy' | 'lowWindy', frame: number): void {
  const cx = g[0].length / 2, base = g.length - 8;
  const low = mode === 'low' || mode === 'lowWindy';
  const height = flameHeight(hearth, low);
  const lean = mode === 'windy' || mode === 'lowWindy' ? 3 : 0;
  for (let y = 0; y < height; y++) {
    const half = Math.max(0, Math.floor((height - y) / 4));
    const x = cx + Math.round(lean * y / height) + (frame % 2 && y > height / 2 ? 1 : 0);
    box(g, x - half, base - y, half * 2 + 1, 1, flameShade(y, height));
  }
  box(g, cx - 2, base - 3, 4, 3, 'u'); box(g, cx - 1, base - 4, 2, 3, 'w');
  dot(g, cx + lean + frame - 1, base - height - frame % 2, low ? 'v' : 'w');
  if (lean) dot(g, cx + 5 + frame % 2, base - height + 1, 'w');
  if (low) for (const x of [cx - 5, cx + 4]) dot(g, x, base + 2, 'v');
}
function fireFrames(hearth: boolean): SpriteDef {
  const frames: Record<string, (g: Grid) => void> = { unlit: g => fireBase(g, hearth) };
  for (const mode of ['burning', 'low', 'windy', 'lowWindy'] as const) for (let i = 0; i < 4; i++)
    frames[`${mode}${i}`] = g => { fireBase(g, hearth); flames(g, hearth, mode, i); };
  return define(hearth ? 32 : 24, hearth ? 28 : 24, campLegend, frames,
    [hearth ? 16 : 12, hearth ? 20 : 16], Object.fromEntries(['burning', 'low', 'windy', 'lowWindy'].map(mode => [mode, {
      frames: Array.from({ length: 4 }, (_, i) => `${mode}${i}`), frameRate: 6, repeat: -1
    }])));
}
function flameOverlay(hearth: boolean): SpriteDef {
  const frames: Record<string, (g: Grid) => void> = { out: () => {} };
  for (const mode of ['burning', 'low', 'windy', 'lowWindy'] as const) for (let i = 0; i < 4; i++)
    frames[`${mode}${i}`] = g => flames(g, hearth, mode, i);
  return define(16, hearth ? 24 : 20, campLegend, frames, [8, hearth ? 16 : 12]);
}
/** Three poles lashed at the top, a dark pot hung on a cord beneath; steam curls up while the fire burns. */
function potTripod(g: Grid, steam: number | null): void {
  line(g, 12, 3, 2, 23, 'a'); line(g, 12, 3, 3, 23, 'c');
  line(g, 12, 3, 22, 23, 'a'); line(g, 12, 3, 21, 23, 'b');
  line(g, 12, 3, 13, 21, 'b');
  box(g, 11, 2, 3, 2, 'h'); dot(g, 12, 2, 'j');
  line(g, 12, 4, 12, 9, 'h');
  line(g, 9, 10, 15, 10, 'n');
  oval(g, 12, 13, 5, 3.5, 'm'); box(g, 7, 10, 11, 2, 'n'); box(g, 8, 10, 9, 1, 'o');
  dot(g, 9, 12, 'n'); dot(g, 9, 13, 'n');
  if (steam === null) return;
  for (const [x, y] of steam ? [[11, 8], [13, 6], [12, 4]] : [[13, 8], [11, 6], [12, 5]]) { dot(g, x, y, 'q'); dot(g, x, y - 1, 'p'); }
}
function hearthSite(g: Grid): void {
  line(g, 2, 9, 21, 9, 'q'); line(g, 4, 3, 4, 9, 'q'); line(g, 21, 4, 21, 9, 'q');
  for (const [x, y] of [[7, 5], [12, 4], [17, 6]]) {
    box(g, x, y, 5, 4, 'm'); box(g, x + 1, y, 4, 2, 'o'); box(g, x + 1, y, 2, 1, 'q');
  }
}
function logSeat(g: Grid): void {
  oval(g, 12, 10, 10, 1, 's'); box(g, 3, 5, 18, 5, 'a');
  box(g, 4, 4, 16, 2, 'c'); box(g, 5, 4, 14, 1, 'e');
  oval(g, 4, 7, 3, 3, 'b'); oval(g, 4, 7, 2, 2, 'd'); dot(g, 4, 7, 'b');
  line(g, 8, 7, 18, 7, 'b');
}
function lookout(g: Grid, restored: boolean): void {
  oval(g, 16, 29, 13, 2, 's');
  for (const x of [5, 24]) {
    box(g, x, 13, 3, 17, 'a'); box(g, x + 1, 14, 1, 15, 'c'); dot(g, x, 13, 'e');
  }
  box(g, 3, 19, 26, 4, 'a'); box(g, 4, 19, 24, 1, 'e');
  line(g, 7, 23, 7, 29, 'c'); line(g, 11, 23, 11, 29, 'c');
  for (const y of [25, 28]) line(g, 7, y, 11, y, 'd');
  if (restored) {
    box(g, 5, 10, 3, 9, 'd'); box(g, 24, 10, 3, 9, 'd');
    box(g, 5, 10, 22, 2, 'c'); box(g, 5, 10, 22, 1, 'e');
    line(g, 5, 8, 16, 2, 'c'); line(g, 16, 2, 27, 8, 'd');
    box(g, 15, 2, 2, 3, 'e');
  } else {
    line(g, 5, 14, 11, 11, 'd'); line(g, 11, 11, 14, 15, 'a');
    line(g, 23, 12, 27, 17, 'c'); dot(g, 27, 17, 'e');
    box(g, 15, 20, 5, 2, 'z');
  }
}

function stoneLump(g: Grid, x: number, y: number, w: number, h: number): void {
  box(g, x, y + 1, w, h - 1, 'n'); box(g, x + 1, y, w - 2, h, 'n');
  box(g, x + 1, y + h - 1, w - 2, 1, 'm'); box(g, x + 1, y + 1, w - 2, h - 3, 'o');
  box(g, x + 1, y, 2, 1, 'q'); dot(g, x + 1, y + 1, 'p');
}
/** Loose stone left on the ground: big, separate, highlighted stones, unlike the flat pebbles of a spent rock. */
function looseStones(g: Grid, count: 1 | 2 | 3): void {
  oval(g, 8, 13, count === 1 ? 4 : 6, 2, 's');
  if (count === 1) { stoneLump(g, 5, 8, 6, 5); return; }
  stoneLump(g, 2, 9, 6, 4); stoneLump(g, 8, 8, 6, 5);
  if (count === 3) stoneLump(g, 5, 5, 6, 4);
}
function stonePileSite(g: Grid): void {
  for (const [x, y] of [[1, 9], [13, 9], [1, 13], [13, 13]]) stake(g, x, y);
  line(g, 3, 13, 12, 13, 'h'); dot(g, 7, 11, 'o'); dot(g, 8, 11, 'q');
}
function stonePile(g: Grid): void {
  oval(g, 8, 14, 7, 2, 's');
  box(g, 1, 10, 14, 4, 'a'); box(g, 2, 10, 12, 1, 'e'); line(g, 2, 12, 13, 12, 'c');
  stoneLump(g, 2, 6, 6, 5); stoneLump(g, 8, 6, 6, 5); stoneLump(g, 5, 2, 6, 5);
}
/** The worked spot at the foot of the quarry face: a big cut block standing proud, ready to break free, or the pale
 * stump where one came out, with chips on the gravel. */
function quarry(g: Grid, ready: boolean): void {
  oval(g, 16, 22, 14, 1, 's');
  if (ready) {
    box(g, 7, 0, 18, 22, 'm');
    box(g, 7, 0, 17, 5, 'p'); box(g, 7, 0, 9, 1, 'q'); dot(g, 7, 0, 'q');
    box(g, 7, 5, 17, 16, 'o'); line(g, 7, 5, 23, 5, 'n');
    line(g, 9, 12, 21, 12, 'n'); line(g, 9, 13, 21, 13, 'p');
    for (const x of [10, 14, 18]) line(g, x, 6, x, 9, 'n');
    box(g, 25, 14, 5, 8, 'm'); box(g, 25, 14, 4, 2, 'p'); box(g, 25, 16, 4, 5, 'o');
  } else {
    box(g, 7, 13, 18, 9, 'm');
    box(g, 7, 13, 17, 3, 'q'); box(g, 8, 14, 15, 1, 'p');
    box(g, 7, 16, 17, 5, 'o'); line(g, 7, 16, 23, 16, 'n');
    for (const [x, y] of [[3, 20], [5, 21], [26, 19], [28, 21], [30, 20], [11, 11], [20, 12]]) { dot(g, x, y, 'q'); dot(g, x + 1, y, 'n'); }
  }
}
/** Heavy timber posts and a braced lintel hold the worked rock face open. */
function mine(g: Grid, ready: boolean, full: boolean): void {
  quarry(g, ready);
  box(g, 2, 2, 4, 21, 'b'); box(g, 26, 2, 4, 21, 'b');
  line(g, 2, 2, 29, 2, 'a'); line(g, 2, 3, 29, 3, 'c');
  line(g, 5, 7, 13, 2, 'd'); line(g, 26, 7, 18, 2, 'd');
  for (const x of [3, 27]) { dot(g, x, 5, 'e'); dot(g, x, 18, 'e'); }
  if (full) { box(g, 20, 10, 4, 3, 'p'); line(g, 20, 10, 23, 10, 'q'); }
}
/** Loose rubble at the quarry's foot: a heap of small broken stones, or just grit once it's picked over. */
function rubble(g: Grid, ready: boolean): void {
  oval(g, 12, 13, ready ? 9 : 7, 2, 's');
  if (!ready) {
    for (const [x, y, c] of [[4, 12, 'o'], [8, 13, 'n'], [11, 11, 'p'], [14, 13, 'o'], [17, 12, 'p'], [19, 13, 'n']] as const) { dot(g, x, y, c); dot(g, x + 1, y, 'n'); }
    return;
  }
  stoneLump(g, 2, 9, 6, 4); stoneLump(g, 16, 9, 6, 4); stoneLump(g, 8, 8, 8, 5);
  stoneLump(g, 5, 5, 6, 5); stoneLump(g, 11, 4, 6, 5); stoneLump(g, 9, 1, 5, 4);
  for (const [x, y] of [[1, 13], [21, 13], [14, 13]]) dot(g, x, y, 'p');
}
function toolshedSite(g: Grid): void {
  for (const [x, y] of [[1, 5], [21, 5], [1, 11], [21, 11]]) stake(g, x, y);
  line(g, 3, 6, 21, 6, 'h'); line(g, 3, 12, 21, 12, 'h');
  box(g, 6, 9, 11, 2, 'a'); box(g, 6, 9, 11, 1, 'c'); dot(g, 6, 9, 'e');
}
/** A small plank shed: a lit roof over a seamed front wall, a pick hung inside the open door and an axe on the wall. */
function toolshed(g: Grid): void {
  oval(g, 13, 26, 10, 2, 's');
  box(g, 2, 10, 20, 16, 'a'); box(g, 3, 11, 18, 14, 'c');
  for (const x of [8, 15, 19]) line(g, x, 11, x, 24, 'b');
  box(g, 4, 13, 9, 13, 'a'); line(g, 4, 13, 12, 13, 'd'); line(g, 4, 13, 4, 25, 'd');
  dot(g, 6, 18, 'p'); dot(g, 7, 17, 'p'); line(g, 8, 16, 10, 16, 'q'); dot(g, 11, 17, 'p'); line(g, 9, 17, 9, 24, 'c');
  line(g, 17, 15, 17, 23, 'e'); box(g, 15, 15, 2, 3, 'o'); dot(g, 15, 15, 'q');
  box(g, 0, 3, 24, 6, 'd'); box(g, 1, 3, 11, 1, 'e');
  for (const [x, top] of [[6, 4], [12, 5], [18, 4]]) line(g, x, top, x, 8, 'c');
  line(g, 23, 3, 23, 8, 'b'); box(g, 0, 9, 24, 1, 'b'); box(g, 0, 10, 24, 1, 'a');
  box(g, 2, 25, 20, 1, 'a');
}
function larderSite(g: Grid): void {
  for (const [x, y] of [[3, 6], [19, 6], [3, 11], [19, 11]]) stake(g, x, y);
  line(g, 5, 7, 19, 7, 'h'); line(g, 5, 12, 19, 12, 'h');
  line(g, 10, 9, 14, 9, 'z');
}
/** A raised cache on four legs with a little ladder: a plank box under a lit roof, its open front showing what is kept. */
function larder(g: Grid, stock: StockLevel): void {
  oval(g, 12, 26, 10, 2, 's');
  for (const x of [7, 17]) box(g, x, 13, 1, 11, 'a');
  for (const x of [3, 19]) { box(g, x, 13, 2, 14, 'b'); line(g, x, 13, x, 25, 'd'); }
  box(g, 2, 11, 20, 2, 'a'); line(g, 2, 11, 21, 11, 'c');
  box(g, 3, 4, 18, 7, 'c'); for (const x of [7, 17]) line(g, x, 4, x, 10, 'b');
  box(g, 9, 5, 7, 5, 'a');
  box(g, 1, 1, 22, 3, 'd'); box(g, 2, 1, 10, 1, 'e'); line(g, 1, 3, 22, 3, 'b');
  // The ladder leans from the platform's front edge down to the ground, its rails drifting two pixels left.
  const rail = (top: number, y: number): number => Math.round(top - 2 * (y - 13) / 13);
  line(g, 13, 13, 11, 26, 'd'); line(g, 16, 13, 14, 26, 'c');
  for (const y of [16, 19, 22, 25]) line(g, rail(13, y) + 1, y, rail(16, y) - 1, y, 'e');
  if (stock === 'empty') return;
  box(g, 10, 8, 2, 2, 'k'); dot(g, 10, 8, 'l');
  box(g, 13, 7, 2, 3, 'h'); dot(g, 13, 7, 'j');
  if (stock === 'some') return;
  box(g, 10, 5, 2, 3, 'h'); dot(g, 10, 5, 'j');
  box(g, 12, 8, 1, 2, 'k'); dot(g, 14, 5, 'k'); dot(g, 15, 6, 'l');
  box(g, 14, 8, 2, 2, 'B');
}
/** A broader raised store with a deeper roof and shuttered bays, replacing the larder in place. */
function storehouse(g: Grid, stock: StockLevel): void {
  oval(g, 16, 30, 14, 2, 's');
  for (const x of [4, 26]) { box(g, x, 17, 2, 12, 'b'); line(g, x, 17, x, 28, 'd'); }
  box(g, 3, 14, 26, 4, 'a'); line(g, 3, 15, 28, 15, 'e');
  box(g, 4, 7, 24, 7, 'c');
  for (const x of [10, 21]) line(g, x, 7, x, 13, 'b');
  box(g, 12, 8, 8, 5, 'a');
  box(g, 2, 3, 28, 4, 'd'); box(g, 3, 3, 12, 1, 'e'); line(g, 2, 6, 29, 6, 'b');
  line(g, 14, 18, 12, 29, 'd'); line(g, 18, 18, 16, 29, 'c');
  for (const y of [21, 24, 27]) line(g, 14 - Math.round((y - 18) / 6), y, 17 - Math.round((y - 18) / 6), y, 'e');
  if (stock === 'empty') return;
  box(g, 13, 10, 2, 3, 'k'); dot(g, 13, 10, 'l');
  box(g, 17, 9, 2, 4, 'h'); dot(g, 17, 9, 'j');
  if (stock === 'some') return;
  box(g, 14, 8, 2, 2, 'h'); dot(g, 14, 8, 'j');
  box(g, 19, 11, 1, 2, 'k'); dot(g, 19, 11, 'l');
}
function woodpileSite(g: Grid): void {
  for (const [x, y] of [[2, 7], [21, 7], [2, 11], [21, 11]]) stake(g, x, y);
  line(g, 4, 8, 20, 8, 'h'); line(g, 4, 12, 20, 12, 'h');
  line(g, 10, 10, 14, 10, 'z');
}
/** Split logs stacked in rows under a little lean-to roof; the roof is drawn last so the logs peek out beneath it. */
function woodpile(g: Grid, stock: StockLevel): void {
  oval(g, 12, 18, 10, 2, 's');
  for (const x of [2, 20]) { box(g, x, 5, 2, 13, 'b'); line(g, x, 5, x, 17, 'd'); }
  box(g, 4, 16, 16, 2, 'a'); line(g, 4, 17, 19, 17, 'b');
  const log = (x: number, y: number): void => { box(g, x, y, 4, 3, 'c'); line(g, x, y, x + 3, y, 'e'); dot(g, x + 3, y + 1, 'd'); };
  if (stock !== 'empty') {
    for (const x of [4, 8, 12, 16]) {
      log(x, 13);
    }
  }
  if (stock === 'full') {
    for (const x of [6, 10, 14]) {
      log(x, 10);
    }
    log(8, 7);
    log(12, 7);
  }
  box(g, 0, 2, 24, 3, 'd'); box(g, 1, 2, 12, 1, 'e'); line(g, 0, 4, 23, 4, 'b');
}
/** The timber yard adds a second rack of split logs and a broader roof beside the original pile. */
function timberYard(g: Grid, stock: StockLevel): void {
  woodpile(g, stock);
  for (const x of [25, 33]) { box(g, x, 5, 2, 13, 'b'); line(g, x, 5, x, 17, 'd'); }
  box(g, 25, 16, 10, 2, 'a');
  if (stock !== 'empty') {
    for (const x of [25, 29, 33]) { box(g, x, 12, 4, 3, 'c'); line(g, x, 12, x + 3, 12, 'e'); }
  }
  if (stock === 'full') {
    for (const x of [27, 31]) { box(g, x, 9, 4, 3, 'c'); line(g, x, 9, x + 3, 9, 'e'); }
  }
  box(g, 23, 2, 16, 3, 'd'); line(g, 23, 4, 38, 4, 'b');
}
function fibreStackSite(g: Grid): void {
  for (const [x, y] of [[3, 7], [20, 7], [3, 11], [20, 11]]) stake(g, x, y);
  line(g, 5, 8, 19, 8, 'h'); line(g, 5, 12, 19, 12, 'h');
  line(g, 10, 10, 14, 10, 'i');
}
/** A small rick of pale fibre bundles on a log base, under a thatched cap on two posts; the cap is drawn last so it overhangs the bundles. */
function fibreStack(g: Grid, stock: StockLevel): void {
  oval(g, 12, 18, 10, 2, 's');
  for (const x of [3, 19]) { box(g, x, 6, 2, 12, 'b'); line(g, x, 6, x, 17, 'd'); }
  box(g, 5, 16, 14, 2, 'a'); line(g, 5, 16, 18, 16, 'c');
  // Each bundle stands upright: pale stalks bound at the waist with a twist of darker fibre.
  const bundle = (x: number, y: number): void => {
    box(g, x, y, 3, 4, 'h'); line(g, x, y, x + 2, y, 'j'); dot(g, x + 1, y + 1, 'i'); line(g, x, y + 2, x + 2, y + 2, 'b');
  };
  if (stock !== 'empty') for (const x of [6, 10, 14]) bundle(x, 12);
  if (stock === 'full') for (const x of [8, 12]) bundle(x, 8);
  // The thatch is lighter than the trodden camp earth and edged in dark wood, so the cap reads against the ground.
  for (let y = 1; y <= 5; y++) {
    const half = Math.min(11, 3 + (y - 1) * 2);
    box(g, 12 - half, y, half, 1, 'z'); box(g, 12, y, half, 1, 'B');
    dot(g, 12 - half - 1, y, 'd'); dot(g, 12 + half, y, 'd');
  }
  line(g, 11, 0, 12, 0, 'd');
  for (const x of [4, 8, 16, 20]) dot(g, x, 4, 'C');
  line(g, 0, 6, 23, 6, 'd'); line(g, 1, 5, 22, 5, 'A');
}
function houseSite(g: Grid): void {
  box(g, 5, 18, 30, 9, 'z');
  for (const [x, y] of [[3, 16], [35, 16], [3, 26], [35, 26]]) stake(g, x, y);
  line(g, 5, 17, 35, 17, 'h'); line(g, 5, 27, 35, 27, 'h');
  line(g, 4, 18, 4, 26, 'h'); line(g, 36, 18, 36, 26, 'h');
  // A few footing stones already laid along the front, and one set for the chimney.
  for (const x of [8, 14, 20]) { box(g, x, 24, 4, 2, 'n'); line(g, x, 24, x + 2, 24, 'p'); }
  box(g, 28, 19, 4, 3, 'n'); line(g, 28, 19, 30, 19, 'p');
}
function houseWallColors(paint: 'natural' | 'berry' | 'leaf'): [string, string, string] {
  if (paint === 'berry') return ['D', 'E', 'F'];
  if (paint === 'leaf') return ['G', 'H', 'I'];
  return ['a', 'c', 'e'];
}

/** A small log house on a stone footing: a shingled roof edged in dark wood, a stone chimney, a door and one window, dark or lit from within. */
function house(g: Grid, lit: boolean, paint: 'natural' | 'berry' | 'leaf' = 'natural', flowerBoxes = false): void {
  oval(g, 20, 30, 19, 2, 's');
  // Log walls: dark ends, each course a lit top over a shaded underside.
  const [wallBase, wallMain, wallLight] = houseWallColors(paint);
  box(g, 3, 14, 34, 14, wallBase);
  for (let y = 15; y < 27; y += 3) { box(g, 4, y, 32, 2, wallMain); line(g, 4, y, 35, y, wallLight); line(g, 4, y + 2, 35, y + 2, wallBase); }
  for (const x of [3, 36]) for (let y = 15; y < 27; y += 3) dot(g, x, y, 'd');
  box(g, 2, 27, 36, 3, 'n'); line(g, 2, 27, 37, 27, 'p');
  for (const x of [7, 13, 19, 25, 31]) dot(g, x, 28, 'm');
  // The door, a plank step before it, and the window: glass dark by day, warm when the fireplace burns.
  box(g, 8, 18, 7, 10, 'a'); box(g, 9, 19, 5, 9, 'b'); line(g, 11, 19, 11, 27, 'a'); dot(g, 13, 23, 'e');
  box(g, 7, 28, 9, 2, 'd'); line(g, 7, 28, 15, 28, 'e');
  box(g, 22, 18, 8, 7, 'a');
  box(g, 23, 19, 6, 5, lit ? 'v' : 'a');
  if (lit) { box(g, 24, 20, 2, 2, 'w'); box(g, 27, 22, 1, 1, 'w'); dot(g, 23, 23, 'u'); dot(g, 28, 23, 'u'); }
  else { dot(g, 24, 20, 'n'); dot(g, 23, 19, 'o'); }
  line(g, 26, 19, 26, 23, 'b'); line(g, 23, 21, 28, 21, 'b');
  box(g, 21, 25, 10, 1, 'd');
  if (flowerBoxes) {
    for (const x of [21, 27]) {
      box(g, x, 26, 5, 3, 'b'); line(g, x, 26, x + 4, 26, 'e');
      dot(g, x + 2, 25, 'L'); dot(g, x + 1, 24, 'K'); dot(g, x + 3, 24, 'J');
    }
  }
  // The roof: shingle courses under a pale ridge, its rim drawn in the darkest wood so it reads against the camp's earth.
  for (let y = 2; y <= 13; y++) {
    const half = Math.min(20, 3 + Math.floor((y - 2) * 1.6));
    box(g, 20 - half, y, half, 1, 'b'); box(g, 20, y, half, 1, 'c');
    if (y % 3 === 1) { line(g, 20 - half + 1, y, 19, y, 'a'); line(g, 21, y, 20 + half - 2, y, 'b'); }
    dot(g, 20 - half - 1, y, 'a'); dot(g, 20 + half, y, 'a');
  }
  line(g, 18, 1, 21, 1, 'a'); line(g, 18, 2, 21, 2, 'd');
  box(g, 0, 13, 40, 1, 'a'); line(g, 1, 12, 38, 12, 'd');
  // The stone chimney stands through the roof's right slope, wider at its shoulders.
  box(g, 28, 0, 6, 12, 'm'); box(g, 29, 1, 4, 10, 'n');
  for (const [x, y] of [[29, 3], [31, 5], [30, 8], [32, 9]]) line(g, x, y, x + 1, y, 'o');
  box(g, 27, 0, 8, 2, 'o'); line(g, 27, 0, 34, 0, 'p');
  if (lit) { dot(g, 30, 2, 'u'); dot(g, 31, 2, 'v'); }
}
function fenceSide(g: Grid): void {
  for (const y of [5, 11]) { box(g, 9, y, 4, 3, 'c'); line(g, 9, y, 12, y, 'e'); }
  for (const y of [2, 13]) { box(g, 8, y, 6, 4, 'b'); line(g, 8, y, 13, y, 'e'); }
}
function fenceRail(g: Grid): void {
  for (const x of [2, 11, 20]) { box(g, x, 3, 4, 12, 'b'); line(g, x, 3, x + 3, 3, 'e'); }
  for (const y of [6, 11]) { box(g, 2, y, 22, 3, 'c'); line(g, 2, y, 23, y, 'e'); }
}

/** The finished shelter once the bed has gone into the house: its door taken off, the front left open and logs stacked inside. */
function woodshed(g: Grid, stock: StockLevel): void {
  shelter(g, false, 'finished');
  // The open front: a dark bay under a lintel, between two posts, where the door and the bed were.
  box(g, 17, 23, 16, 11, 'a');
  for (const x of [16, 33]) { box(g, x, 22, 2, 12, 'b'); line(g, x, 22, x, 33, 'd'); }
  box(g, 16, 21, 19, 2, 'b'); line(g, 16, 21, 34, 21, 'e');
  const log = (x: number, y: number): void => { box(g, x, y, 4, 3, 'c'); line(g, x, y, x + 3, y, 'e'); dot(g, x + 3, y + 1, 'd'); dot(g, x + 1, y + 1, 'b'); };
  if (stock === 'empty') return;
  for (const x of [18, 22, 26, 30]) log(x, 31);
  log(20, 28); log(24, 28);
  if (stock !== 'full') return;
  log(28, 28);
  for (const x of [18, 22, 26, 30]) log(x, 25);
  for (const x of [20, 24, 28]) log(x, 23);
}
const DIGITS: Record<string, string[]> = {
  2: ['###', '..#', '###', '#..', '###'], 3: ['###', '..#', '.##', '..#', '###'], 4: ['#.#', '#.#', '###', '..#', '..#'],
  5: ['###', '#..', '###', '..#', '###'], 6: ['###', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'], 9: ['###', '#.#', '###', '..#', '###'], '+': ['...', '.#.', '###', '.#.', '...']
};
/** A tiny ×N tag over loose piles: paper glyphs on an ink backing. */
function pileCount(g: Grid, glyphs: string[]): void {
  const left = glyphs.length === 1 ? 2 : 0;
  box(g, left, 0, 9 + 4 * (glyphs.length - 1), 7, 'k');
  for (const [x, y] of [[1, 2], [3, 2], [2, 3], [1, 4], [3, 4]]) dot(g, left + x, y, 'p');
  glyphs.forEach((glyph, i) => DIGITS[glyph].forEach((row, y) => [...row].forEach((c, x) => { if (c === '#') dot(g, left + 5 + 4 * i + x, 1 + y, 'p'); })));
}
const countLegend = { k: 'ink', p: 'paper' } as const;

const siteLegend = { ...campLegend, u: 'flower4', v: 'frost', x: 'paper' } as const;
function oldBasket(g: Grid, full: boolean): void {
  oval(g, 8, 14, 6, 2, 's');
  line(g, 3, 9, 6, 5, 'd'); line(g, 6, 5, 10, 5, 'd'); line(g, 10, 5, 13, 9, 'd');
  box(g, 2, 9, 12, 5, 'a'); box(g, 3, 10, 10, 3, 'c');
  for (const x of [4, 7, 10]) line(g, x, 10, x + 1, 13, 'b');
  if (full) for (const [x, y] of [[5, 8], [8, 7], [11, 8]]) { box(g, x, y, 2, 2, 'k'); dot(g, x, y, 'l'); }
}
function spring(g: Grid, frozen = false): void {
  oval(g, 12, 13, 10, 2, 's'); oval(g, 12, 10, 10, 5, 'm');
  if (frozen) {
    // Ice: pale frost with bright streaks and one blue crack.
    oval(g, 12, 9, 8, 3, 'v');
    line(g, 7, 8, 10, 8, 'x'); line(g, 13, 10, 16, 10, 'x'); line(g, 9, 10, 14, 8, 'u');
  } else {
    oval(g, 12, 9, 8, 3, 'u'); line(g, 6, 9, 18, 9, 'v');
  }
  for (const [x, y] of [[3, 7], [7, 5], [17, 6], [20, 10]]) {
    box(g, x, y, 3, 3, 'n'); dot(g, x, y, 'q');
  }
}
function gardenBed(g: Grid): void {
  oval(g, 24, 22, 22, 3, 's');
  box(g, 3, 9, 42, 10, 'a'); box(g, 4, 10, 40, 8, 'b');
  for (const x of [8, 21, 34]) { box(g, x, 12, 8, 4, 'A'); box(g, x + 1, 12, 6, 2, 'z'); }
  box(g, 3, 9, 42, 2, 'c'); box(g, 3, 17, 42, 2, 'a');
}
function gardenPlant(g: Grid, stage: string): void {
  oval(g, 8, 14, 7, 2, 's');
  if (stage === 'dormant') { box(g, 7, 12, 3, 2, 'a'); dot(g, 8, 10, 'b'); return; }
  if (stage === 'seedling') { box(g, 7, 10, 2, 4, 'a'); dot(g, 6, 9, 'h'); dot(g, 9, 8, 'i'); return; }
  box(g, 7, 9, 2, 5, 'a'); oval(g, 8, 8, 5, 4, 'h'); oval(g, 5, 9, 3, 2, 'i'); oval(g, 11, 9, 3, 2, 'j');
  if (stage === 'ripe') { for (const [x, y] of [[5, 8], [10, 7], [8, 10]]) { dot(g, x, y, 'm'); dot(g, x + 1, y, 'n'); } }
}

/** Where the three vegetable beds will go: a staked, strung plot with three patches of turned earth, one under each bed. */
function workshopSite(g: Grid): void {
  for (const [x, y] of [[2, 4], [32, 4], [2, 10], [32, 10]]) stake(g, x, y);
  line(g, 4, 5, 32, 5, 'h'); line(g, 4, 11, 32, 11, 'h');
  box(g, 10, 7, 16, 3, 'A'); line(g, 11, 7, 24, 7, 'z');
  for (const x of [12, 17, 22]) line(g, x, 8, x + 3, 8, 'c');
}
/**
 * An open-fronted timber workshop: a plank back wall with a saw and tools hung on it, a sturdy workbench across the
 * front, and a lean roof on four posts. Every post, the bench and the roof are edged in dark wood so it reads on bare earth.
 */
function workshop(g: Grid): void {
  oval(g, 18, 26, 17, 2, 's');
  // The back wall, in vertical planks, shaded inside the open front.
  box(g, 3, 7, 30, 18, 'a'); box(g, 4, 8, 28, 16, 'b');
  for (const x of [8, 13, 18, 23, 28]) line(g, x, 8, x, 23, 'a');
  // A bow saw and a mallet hang on the wall.
  line(g, 6, 11, 12, 11, 'q'); line(g, 6, 11, 6, 13, 'c'); line(g, 12, 11, 12, 13, 'c'); line(g, 6, 13, 12, 13, 'd');
  box(g, 22, 10, 4, 2, 'd'); line(g, 24, 12, 24, 16, 'c');
  dot(g, 16, 11, 'p'); line(g, 16, 12, 16, 15, 'e');
  // The workbench: a thick top with a log on it, on two stout legs.
  box(g, 5, 17, 26, 3, 'a'); box(g, 6, 17, 24, 1, 'e'); line(g, 6, 18, 29, 18, 'd');
  box(g, 14, 15, 7, 2, 'c'); line(g, 14, 15, 20, 15, 'e'); dot(g, 20, 16, 'd');
  for (const x of [7, 27]) { box(g, x, 20, 2, 5, 'a'); line(g, x + 1, 20, x + 1, 24, 'c'); }
  // Shavings on the floor, and the four posts at the corners.
  for (const [x, y] of [[11, 24], [13, 23], [21, 24], [24, 23]]) dot(g, x, y, 'e');
  for (const x of [1, 33]) { box(g, x, 6, 2, 19, 'a'); line(g, x + 1, 6, x + 1, 24, 'd'); }
  box(g, 1, 25, 34, 1, 'a');
  // The lean roof is drawn last so it overhangs the posts.
  box(g, 0, 1, 36, 5, 'd'); box(g, 1, 1, 17, 1, 'e');
  for (const x of [6, 12, 18, 24, 30]) line(g, x, 2, x, 5, 'c');
  line(g, 0, 0, 35, 0, 'a'); line(g, 0, 5, 35, 5, 'b'); box(g, 0, 6, 36, 1, 'a');
  dot(g, 0, 1, 'a'); dot(g, 35, 1, 'a');
}
/** A two-wheeled handcart with long handles, parked by the workshop, its bed piled with logs as it fills. */
function handcart(g: Grid, stock: StockLevel): void {
  oval(g, 10, 12, 9, 1.5, 's');
  // The handles reach out to the right, resting on a little prop.
  line(g, 13, 8, 19, 10, 'a'); line(g, 13, 7, 19, 9, 'c'); line(g, 18, 10, 18, 12, 'a');
  const log = (x: number, y: number): void => { box(g, x, y, 4, 2, 'c'); line(g, x, y, x + 3, y, 'e'); dot(g, x + 3, y + 1, 'd'); };
  if (stock !== 'empty') { log(2, 4); log(7, 4); }
  if (stock === 'full') { log(4, 2); log(9, 2); log(6, 0); }
  // The cart bed: plank sides edged in dark wood.
  box(g, 1, 6, 13, 4, 'a'); box(g, 2, 6, 11, 3, 'd'); line(g, 2, 7, 12, 7, 'c'); line(g, 7, 6, 7, 8, 'b');
  // The wheel, with its rim, hub and spokes.
  oval(g, 7, 10.5, 3, 2.5, 'a'); oval(g, 7, 10.5, 2, 1.5, 'b');
  line(g, 5, 10, 9, 11, 'c'); line(g, 7, 9, 7, 12, 'c'); dot(g, 7, 10, 'e');
}

function vegetableBedsSite(g: Grid): void {
  for (const [x, y] of [[1, 4], [45, 4], [1, 11], [45, 11]]) stake(g, x, y);
  line(g, 3, 5, 45, 5, 'h'); line(g, 3, 12, 45, 12, 'h');
  for (const x of [5, 19, 33]) { box(g, x, 7, 10, 4, 'A'); line(g, x + 1, 7, x + 8, 7, 'z'); }
}

/** Where the well will go: a staked, strung square of turned earth with a few stones laid out in a ring. */
function wellSite(g: Grid): void {
  oval(g, 10, 6, 6, 3, 'A'); oval(g, 10, 6, 4, 2, 'z');
  for (const [x, y] of [[1, 1], [17, 1], [1, 7], [17, 7]]) stake(g, x, y);
  line(g, 3, 2, 16, 2, 'h'); line(g, 3, 8, 16, 8, 'h');
  for (const [x, y] of [[5, 5], [14, 5], [7, 8], [12, 8], [10, 3]]) { dot(g, x, y, 'o'); dot(g, x + 1, y, 'q'); }
}

const wellLegend = { ...campLegend, W: 'storm', x: 'frost' } as const;

/**
 * A round stone well under a little peaked wooden roof, with a crank on its axle and a bucket on the rope. The stone
 * wall, the posts and the roof are all edged in dark wood, so the well reads against the bare earth of the camp.
 */
function well(g: Grid): void {
  oval(g, 9.5, 22, 9, 1.5, 's');
  // Two posts carry the axle, standing behind the rim.
  for (const x of [3, 15]) { box(g, x, 5, 2, 9, 'a'); line(g, x + 1, 5, x + 1, 12, 'c'); }
  // The wall: courses of grey stone with darker mortar and pale tops, edged in dark wood.
  box(g, 2, 14, 16, 8, 'a'); box(g, 3, 14, 14, 7, 'o');
  line(g, 3, 17, 16, 17, 'n'); line(g, 3, 19, 16, 19, 'n');
  for (const [x, y] of [[6, 16], [10, 16], [14, 16], [4, 18], [8, 18], [12, 18], [6, 20], [10, 20], [14, 20]]) dot(g, x, y, 'n');
  for (const [x, y] of [[3, 16], [7, 16], [11, 16], [5, 18], [9, 18], [13, 18], [3, 20], [7, 20], [11, 20]]) dot(g, x, y, 'p');
  // The rim, seen from above: a ring of pale stone round dark water with one glint of sky.
  oval(g, 9.5, 13.5, 8, 2.5, 'a'); oval(g, 9.5, 13.5, 7, 1.6, 'p'); oval(g, 9.5, 13.5, 5, 0.8, 'W');
  line(g, 3, 15, 16, 15, 'a'); dot(g, 7, 13, 'x'); for (const x of [4, 9, 14]) dot(g, x, 12, 'q');
  // The axle with its crank on the right, and the bucket on its rope over the water.
  line(g, 5, 7, 14, 7, 'b'); line(g, 5, 8, 14, 8, 'a');
  line(g, 17, 7, 18, 7, 'a'); line(g, 18, 8, 18, 10, 'a'); dot(g, 18, 10, 'd');
  dot(g, 10, 9, 'h');
  box(g, 8, 10, 4, 3, 'a'); box(g, 9, 11, 2, 1, 'c'); line(g, 9, 10, 10, 10, 'd');
  // The roof is drawn last so its eaves overhang the posts.
  for (let y = 1; y <= 4; y++) {
    const half = Math.min(10, 2 * y + 1);
    box(g, 10 - half, y, half * 2, 1, y % 2 ? 'c' : 'd');
    dot(g, 10 - half, y, 'a'); dot(g, 9 + half, y, 'a');
  }
  line(g, 8, 0, 11, 0, 'a'); line(g, 0, 5, 19, 5, 'a'); line(g, 1, 4, 18, 4, 'b');
}

const bedLegend = { s: 'shadow', a: 'wood0', b: 'wood1', c: 'wood2', d: 'wood3', f: 'earth0', g: 'earth1', h: 'earth3',
  j: 'leaf1', k: 'leaf2', l: 'leaf3', m: 'leaf4', n: 'grass4', o: 'flower2', p: 'scarf2', u: 'fire2', w: 'fire3', x: 'canvas2', v: 'frost' } as const;
type BedCrop = 'potatoes' | 'beans' | 'carrots';
type BedStageName = 'empty' | 'sprout' | 'growing' | 'ripe';
type BedSoilName = 'fresh' | 'dry' | 'wilted' | 'frost';

/** Leafy potato clumps; ripe, they flower white and a pale tuber shows at the soil. */
function potatoPlants(g: Grid, ripe: boolean): void {
  const top = ripe ? 1 : 2;
  for (const x of [2, 6, 10]) {
    box(g, x, top + 1, 3, 5 - top, 'k'); dot(g, x + 1, top, 'l');
    dot(g, x, top + 1, 'l'); dot(g, x + 2, top + 2, 'j'); dot(g, x + 1, 5, 'j');
    if (ripe) { dot(g, x + 1, top, 'o'); dot(g, x - 1, top + 2, 'k'); dot(g, x + 1, 7, 'p'); }
  }
}
/** A pole for each plant with leaves climbing it and pods hanging; ripe, the vines reach the top and hang heavy with pods. */
function beanPlants(g: Grid, ripe: boolean): void {
  const top = ripe ? 0 : 2;
  for (const x of [3, 7, 11]) {
    line(g, x, top, x, 7, 'd'); dot(g, x, top, 'c');
    for (let y = top + 1; y <= 6; y += 2) { dot(g, x - 1, y, 'k'); dot(g, x + 1, y + 1, 'l'); }
    line(g, x + 1, 3, x + 1, 4, 'm');
    if (ripe) { line(g, x - 1, 1, x - 1, 2, 'm'); line(g, x + 1, 5, x + 1, 6, 'n'); }
  }
}
/** Feathery carrot tops in a row; ripe, they stand taller and orange shoulders show at the soil. */
function carrotPlants(g: Grid, ripe: boolean): void {
  const top = ripe ? 1 : 3;
  for (const x of [2, 5, 8, 11]) {
    line(g, x, top + 1, x, 6, 'k');
    dot(g, x - 1, top + 1, 'm'); dot(g, x + 1, top + 1, 'm'); dot(g, x, top, 'l');
    dot(g, x - 1, top + 3, 'l'); dot(g, x + 1, top + 3, 'l');
    if (ripe) { dot(g, x, 7, 'u'); dot(g, x + 1, 7, 'w'); }
  }
}

/** The plants of a bed at its stage, on a clear layer of their own. */
function bedPlants(crop: BedCrop, stage: BedStageName): Grid {
  const plants = blank(14, 12);
  if (stage === 'sprout') for (const x of [3, 7, 10]) { dot(plants, x, 6, 'n'); dot(plants, x + 1, 5, 'n'); }
  if (stage === 'growing' || stage === 'ripe') {
    const ripe = stage === 'ripe';
    if (crop === 'potatoes') potatoPlants(plants, ripe);
    else if (crop === 'beans') beanPlants(plants, ripe);
    else carrotPlants(plants, ripe);
  }
  return plants;
}

/**
 * A small raised bed edged in dark wood, so it reads on the bare earth of the camp. The soil is dark when fresh and pale and
 * cracked when dry; wilting plants sag a pixel and their pale tips yellow, and frost flecks the soil and the leaves white.
 */
function vegBed(g: Grid, crop: BedCrop, stage: BedStageName, soil: BedSoilName): void {
  line(g, 1, 11, 12, 11, 's');
  box(g, 0, 4, 14, 7, 'a');
  const parched = soil === 'dry' || soil === 'wilted';
  box(g, 1, 5, 12, 3, parched ? 'h' : 'f');
  if (parched) { line(g, 2, 6, 4, 6, 'g'); dot(g, 4, 7, 'g'); line(g, 8, 5, 9, 6, 'g'); dot(g, 11, 6, 'g'); dot(g, 12, 7, 'g'); }
  else for (const [x, y] of [[3, 6], [7, 5], [10, 7], [12, 5]]) dot(g, x, y, soil === 'frost' ? 'v' : 'g');
  line(g, 1, 4, 12, 4, 'b');
  box(g, 1, 8, 12, 2, 'c'); line(g, 1, 8, 12, 8, 'd');
  const sag = soil === 'wilted' ? 1 : 0;
  bedPlants(crop, stage).forEach((row, y) => row.forEach((pixel, x) => {
    // Plants stop at the front plank, so a sagging leaf tucks behind it.
    if (pixel === '.' || y + sag > 7) return;
    let shade = pixel;
    if (sag && (pixel === 'l' || pixel === 'm')) shade = 'x';
    if (soil === 'frost' && (pixel === 'l' || pixel === 'm')) shade = 'v';
    dot(g, x, y + sag, shade);
  }));
}

/** Where the field will go: a long staked, strung plot with a few furrows already scratched into it. */
function fieldSite(g: Grid): void {
  for (const [x, y] of [[1, 2], [61, 2], [1, 10], [61, 10]]) stake(g, x, y);
  line(g, 3, 3, 61, 3, 'h'); line(g, 3, 11, 61, 11, 'h');
  for (const y of [6, 9]) for (let x = 6; x < 58; x += 9) line(g, x, y, x + 5, y, 'z');
}

const fieldLegend = { s: 'shadow', a: 'wood0', b: 'wood1', f: 'earth0', g: 'earth1', h: 'earth2', i: 'earth3',
  j: 'leaf2', k: 'leaf3', l: 'leaf4', n: 'grass4', p: 'scarf1', q: 'scarf2', r: 'scarf3', t: 'scarf4' } as const;
type StripStageName = 'bare' | 'shoots' | 'green' | 'gold' | 'stooks';

/** A stook: sheaves leant together into a little tent of straw, tied at the top. */
function stook(g: Grid, x: number, y: number): void {
  for (let row = 0; row < 6; row++) line(g, x - Math.floor(row / 2), y + row, x + 1 + Math.floor(row / 2), y + row, row % 2 ? 'r' : 'q');
  line(g, x - 3, y + 6, x + 4, y + 6, 'p'); dot(g, x, y + 1, 'b'); dot(g, x + 1, y + 1, 'b'); dot(g, x, y, 't');
}

/**
 * One strip of the field, running away from the fire: dark furrowed earth between edges of dark wood, so it reads on the
 * bare camp earth. Green shoots come up in rows, grow tall, turn gold with heavy heads, and once cut leave stubble and stooks.
 */
function fieldStrip(g: Grid, stage: StripStageName): void {
  line(g, 1, 23, 14, 23, 's');
  box(g, 0, 2, 16, 21, 'a');
  box(g, 1, 3, 14, 19, 'g');
  for (let y = 4; y < 22; y += 3) line(g, 2, y, 13, y, 'f');
  for (const [x, y] of [[4, 6], [10, 9], [6, 15], [12, 18]]) dot(g, x, y, 'h');
  if (stage === 'bare') return;
  if (stage === 'stooks') {
    for (let y = 5; y < 22; y += 3) for (let x = 2; x < 14; x += 2) dot(g, x, y, 'p');
    stook(g, 4, 5); stook(g, 10, 13);
    return;
  }
  if (stage === 'shoots') {
    for (let y = 5; y < 22; y += 3) for (let x = 3; x < 14; x += 3) { dot(g, x, y, 'k'); dot(g, x, y - 1, 'n'); }
    return;
  }
  const gold = stage === 'gold';
  for (let y = 6; y < 23; y += 3) for (let x = 2; x < 14; x += 2) {
    line(g, x, y, x, y - 3, gold ? 'q' : 'j');
    dot(g, x, y - 4, gold ? 't' : 'l'); dot(g, x + 1, y - 3, gold ? 'r' : 'k');
  }
}

function granarySite(g: Grid): void {
  for (const [x, y] of [[2, 7], [24, 7], [2, 12], [24, 12]]) stake(g, x, y);
  line(g, 4, 8, 24, 8, 'h'); line(g, 4, 13, 24, 13, 'h');
  for (const x of [6, 13, 20]) { box(g, x, 10, 2, 2, 'o'); dot(g, x, 10, 'q'); }
}

/**
 * A small timber granary raised on stone legs to keep the grain dry, under a steep thatched roof. Its door stands open,
 * and sacks of grain show inside as it fills. Edged in dark wood so it reads against the earth.
 */
function granary(g: Grid, stock: StockLevel): void {
  oval(g, 14, 30, 12, 2, 's');
  // Mushroom-capped stone legs, the old way of keeping mice out.
  for (const x of [4, 12, 20]) { box(g, x, 24, 4, 5, 'n'); box(g, x + 1, 24, 2, 4, 'o'); box(g, x - 1, 22, 6, 2, 'p'); line(g, x - 1, 22, x + 4, 22, 'q'); }
  box(g, 2, 21, 24, 2, 'a'); line(g, 2, 21, 25, 21, 'c');
  box(g, 3, 11, 22, 10, 'c'); for (const x of [3, 9, 18, 24]) line(g, x, 11, x, 20, 'b');
  for (const y of [14, 17]) line(g, 4, y, 23, y, 'd');
  // The open door, dark inside.
  box(g, 11, 13, 6, 8, 'a'); box(g, 12, 14, 4, 7, 'f');
  if (stock !== 'empty') { box(g, 12, 18, 2, 3, 'h'); dot(g, 12, 18, 'j'); box(g, 14, 19, 2, 2, 'i'); }
  if (stock === 'full') { box(g, 13, 15, 2, 3, 'h'); dot(g, 13, 15, 'j'); box(g, 14, 16, 2, 2, 'i'); dot(g, 15, 16, 'j'); }
  // Steep thatch, drawn last so its eaves hang over the walls.
  for (let y = 1; y <= 10; y++) {
    const half = Math.min(14, y + 4);
    box(g, 14 - half, y, half * 2, 1, y % 2 ? 'C' : 'i');
    dot(g, 14 - half, y, 'a'); dot(g, 13 + half, y, 'a');
  }
  line(g, 11, 0, 16, 0, 'a'); line(g, 0, 11, 27, 11, 'a');
}

function windmillSite(g: Grid): void {
  for (const [x, y] of [[2, 6], [20, 6], [2, 11], [20, 11]]) stake(g, x, y);
  oval(g, 11, 10, 6, 2, 'o'); oval(g, 11, 10, 4, 1, 'z');
  for (const x of [6, 15]) { box(g, x, 12, 2, 2, 'n'); dot(g, x, 12, 'p'); }
}

/** One lattice sail from the hub at (16, 15), turned `degrees` clockwise from straight up. */
function windmillSail(g: Grid, degrees: number): void {
  const radians = degrees * Math.PI / 180;
  const along = (r: number): [number, number] => [16 + Math.sin(radians) * r, 15 - Math.cos(radians) * r];
  const across = (r: number, side: number): [number, number] => {
    const [x, y] = along(r);
    return [x + Math.cos(radians) * side, y + Math.sin(radians) * side];
  };
  // The canvas sail on one side of the stock, then the stock itself drawn over its edge.
  for (let r = 4; r <= 14; r++) for (let side = 1; side <= 3; side++) {
    const [x, y] = across(r, side);
    dot(g, Math.round(x), Math.round(y), (r + side) % 3 === 0 ? 'h' : 'i');
  }
  for (let r = 1; r <= 15; r++) {
    const [x, y] = along(r);
    dot(g, Math.round(x), Math.round(y), 'a');
  }
}

/**
 * A small stone tower mill with a timber cap and four lattice sails, turned a quarter of the way between frames so the
 * four frames loop. The tower tapers upward, edged in dark stone so it reads against the earth.
 */
function windmill(g: Grid, turn: number): void {
  oval(g, 16, 45, 11, 2, 's');
  for (let y = 18; y <= 44; y++) {
    const half = 6 + Math.floor((y - 18) / 7);
    box(g, 16 - half, y, half * 2, 1, (y % 5 === 0) ? 'n' : 'o');
    dot(g, 16 - half, y, 'm'); dot(g, 15 + half, y, 'm');
  }
  box(g, 14, 37, 4, 8, 'a'); box(g, 15, 38, 2, 7, 'b');
  box(g, 15, 26, 2, 3, 'a');
  // The cap, a timber hood the sails hang from.
  for (let y = 11; y <= 18; y++) {
    const half = Math.min(8, y - 9);
    box(g, 16 - half, y, half * 2, 1, y % 2 ? 'c' : 'd');
    dot(g, 16 - half, y, 'a'); dot(g, 15 + half, y, 'a');
  }
  for (let arm = 0; arm < 4; arm++) windmillSail(g, turn * 22.5 + arm * 90);
  box(g, 15, 14, 3, 3, 'a'); dot(g, 16, 15, 'e');
}

function bakerySite(g: Grid): void {
  for (const [x, y] of [[2, 6], [28, 6], [2, 11], [28, 11]]) stake(g, x, y);
  line(g, 4, 7, 28, 7, 'h'); line(g, 4, 12, 28, 12, 'h');
  box(g, 20, 8, 4, 3, 'n'); dot(g, 20, 8, 'p');
}

function beehiveSite(g: Grid): void {
  box(g, 3, 3, 10, 4, 'z'); stake(g, 2, 2); stake(g, 12, 2);
  line(g, 4, 3, 12, 3, 'h');
}

const hiveLegend = { s: 'shadow', a: 'wood0', b: 'wood1', c: 'wood2', f: 'canvas1', g: 'canvas2', h: 'canvas3', i: 'canvas4', k: 'ink', y: 'fire4' } as const;
type HiveLook = 'still' | 'bees0' | 'bees1' | 'winter0' | 'winter1';

/** A bee: a dark body with a bright stripe, a pixel of wing above. */
function bee(g: Grid, x: number, y: number): void {
  dot(g, x, y, 'k'); dot(g, x + 1, y, 'y'); dot(g, x, y - 1, 'i');
}

/**
 * A domed straw skep on a little wooden stand: coils of straw in bands, shaded on the right, with a dark entrance at the
 * foot. By day a bee or two drift around it, only one in winter.
 */
function beehive(g: Grid, look: HiveLook): void {
  oval(g, 8, 15, 6, 1, 's');
  box(g, 3, 12, 10, 2, 'b'); line(g, 3, 12, 12, 12, 'c'); dot(g, 4, 14, 'a'); dot(g, 11, 14, 'a');
  // The dome, widest at the bottom, in coils of straw.
  for (let y = 3; y <= 11; y++) {
    const half = Math.min(5, Math.round(Math.sqrt(Math.max(0, 1 - ((11 - y) / 8.5) ** 2)) * 5));
    box(g, 8 - half, y, half * 2, 1, y % 2 ? 'h' : 'g');
    dot(g, 8 + half - 1, y, 'f');
    if (half > 1) dot(g, 8 - half, y, 'g');
  }
  dot(g, 7, 2, 'g'); dot(g, 8, 2, 'f');
  for (const [x, y] of [[5, 5], [6, 7], [5, 9], [9, 6], [10, 8]]) dot(g, x, y, 'i');
  box(g, 7, 10, 2, 2, 'a');
  if (look === 'bees0') { bee(g, 1, 6); bee(g, 13, 3); }
  if (look === 'bees1') { bee(g, 2, 3); bee(g, 13, 8); }
  if (look === 'winter0') bee(g, 12, 4);
  if (look === 'winter1') bee(g, 13, 6);
}

/**
 * A stone bakehouse with a thatched roof and a tall chimney. Loaves sit on a shelf by the door when there are any, and
 * smoke rises from the chimney the morning the oven bakes.
 */
function bakery(g: Grid, look: 'cold' | 'loaves' | 'baking'): void {
  oval(g, 16, 30, 14, 2, 's');
  box(g, 3, 15, 26, 14, 'o');
  for (const y of [18, 22, 26]) for (let x = 3 + (y % 4); x < 29; x += 5) line(g, x, y, x + 3, y, 'n');
  line(g, 3, 15, 3, 28, 'm'); line(g, 28, 15, 28, 28, 'm'); line(g, 3, 28, 28, 28, 'm');
  // The door, and the oven's glowing mouth beside it.
  box(g, 7, 20, 6, 9, 'a'); box(g, 8, 21, 4, 8, 'b');
  box(g, 18, 22, 6, 4, 'm'); box(g, 19, 23, 4, 3, look === 'baking' ? 'u' : 'a');
  // The shelf under the window, with the loaves on it.
  line(g, 16, 27, 26, 27, 'c');
  if (look !== 'cold') { box(g, 17, 25, 3, 2, 'A'); dot(g, 17, 25, 'B'); box(g, 21, 25, 3, 2, 'A'); dot(g, 21, 25, 'B'); }
  // The chimney, then the thatch drawn over the walls' top.
  box(g, 22, 3, 4, 10, 'n'); box(g, 22, 3, 4, 1, 'p'); line(g, 22, 3, 22, 12, 'm');
  for (let y = 6; y <= 15; y++) {
    const half = Math.min(15, y + 3);
    box(g, 16 - half, y, half * 2, 1, y % 2 ? 'C' : 'i');
    dot(g, 16 - half, y, 'a'); dot(g, 15 + half, y, 'a');
  }
  if (look === 'baking') for (const [x, y] of [[24, 1], [23, 0], [25, 0], [26, 2]]) dot(g, x, y, 'q');
}

const BED_FRAMES = Object.fromEntries((['potatoes', 'beans', 'carrots'] as const).flatMap(crop =>
  (['empty', 'sprout', 'growing', 'ripe'] as const).flatMap(stage =>
    (['fresh', 'dry', 'wilted', 'frost'] as const).map(soil => [`${crop}-${stage}-${soil}`, (g: Grid) => vegBed(g, crop, stage, soil)]))));

function cairn(g: Grid, full: boolean): void {
  oval(g, 8, 14, 6, 2, 's');
  for (const [x, y, w] of [[3, 10, 5], [8, 9, 5], [5, 6, 6]]) {
    box(g, x, y, w, 4, 'm'); box(g, x + 1, y, w - 2, 2, 'o'); dot(g, x + 1, y, 'q');
  }
  if (full) { box(g, 7, 3, 4, 4, 'n'); box(g, 8, 3, 2, 2, 'q'); }
}

export const phase3Sprites: Record<string, SpriteDef> = {
  branchPile: define(16, 16, nodeLegend, { ready: g => branch(g, true), depleted: g => branch(g, false) }),
  berryBush: define(16, 16, nodeLegend, { ready: g => bush(g, true), picked: g => bush(g, false), rustle0: g => bush(g, true, -1), rustle1: g => bush(g, true, 1) }, [8, 14],
    { rustle: { frames: ['rustle0', 'rustle1', 'ready'], frameRate: 8, repeat: 0 } }),
  fiberReeds: define(16, 16, nodeLegend, { ready: g => reeds(g, true), cut: g => reeds(g, false), sway0: g => reeds(g, true, -1), sway1: g => reeds(g, true, 1) }, [8, 14],
    { sway: { frames: ['ready', 'sway0', 'ready', 'sway1'], frameRate: 2, repeat: -1 } }),
  hazelSpot: define(16, 16, forageLegend, { ready: g => hazel(g, true), gathered: g => hazel(g, false) }, [8, 14]),
  pineForage: define(16, 16, forageLegend, { ready: g => pineSapling(g, true), gathered: g => pineSapling(g, false) }, [8, 14]),
  greensPatch: define(16, 16, forageLegend, { ready: g => greens(g, true), gathered: g => greens(g, false) }, [8, 14]),
  wildGrain: define(16, 16, forageLegend, { ready: g => wildGrain(g, true), gathered: g => wildGrain(g, false) }, [8, 14]),
  hollowTree: define(24, 32, forageLegend, {
    ready: g => hollowTree(g, 'ready'), gathered: g => hollowTree(g, 'gathered'), bees0: g => hollowTree(g, 'bees0'), bees1: g => hollowTree(g, 'bees1')
  }, [12, 30], { buzz: { frames: ['ready', 'bees0', 'ready', 'bees1'], frameRate: 2, repeat: -1 } }),
  firePit: fireFrames(false), hearth: fireFrames(true), flame: flameOverlay(false), hearthFlame: flameOverlay(true),
  hearthSite: define(24, 12, campLegend, { still: hearthSite }),
  potTripod: define(24, 28, campLegend, { still: g => potTripod(g, null), steaming0: g => potTripod(g, 0), steaming1: g => potTripod(g, 1) }, [12, 20]),
  shelterSite: define(48, 32, campLegend, { still: shelterSite }),
  shelter: define(48, 40, campLegend, {
    built: g => shelter(g, false), builtBed: g => shelter(g, true),
    thatched: g => shelter(g, false, 'thatched'), thatchedBed: g => shelter(g, true, 'thatched'),
    stonework: g => shelter(g, false, 'stonework'), stoneworkBed: g => shelter(g, true, 'stonework'),
    porch: g => shelter(g, false, 'porch'), porchBed: g => shelter(g, true, 'porch'),
    finished: g => shelter(g, false, 'finished'), finishedBed: g => shelter(g, true, 'finished')
  }),
  gardenSite: define(48, 24, campLegend, { still: gardenBed }),
  garden: define(48, 24, campLegend, { built: gardenBed }),
  gardenPlant: define(16, 16, nodeLegend, { seedling: g => gardenPlant(g, 'seedling'), growing: g => gardenPlant(g, 'growing'), ripe: g => gardenPlant(g, 'ripe'), dormant: g => gardenPlant(g, 'dormant') }),
  dryingRackSite: define(32, 16, campLegend, { still: rackSite }),
  dryingRack: define(32, 32, campLegend, { built: rack }),
  windbreakSite: define(48, 16, campLegend, { still: windbreakSite }),
  windbreak: define(48, 32, campLegend, { built: windbreak }),
  logSeat: define(24, 12, campLegend, { still: logSeat }),
  lookout: define(32, 32, campLegend, { damaged: g => lookout(g, false), restored: g => lookout(g, true) }, [16, 29]),
  oldBasket: define(16, 16, siteLegend, { full: g => oldBasket(g, true), empty: g => oldBasket(g, false) }),
  spring: define(24, 16, siteLegend, { still: g => spring(g), frozen: g => spring(g, true) }),
  cairn: define(16, 16, siteLegend, { full: g => cairn(g, true), empty: g => cairn(g, false) }),
  looseStones: define(16, 16, campLegend, { one: g => looseStones(g, 1), two: g => looseStones(g, 2), many: g => looseStones(g, 3) }),
  stonePileSite: define(16, 16, campLegend, { still: stonePileSite }),
  stonePile: define(16, 16, campLegend, { built: stonePile }),
  quarry: define(32, 24, campLegend, { ready: g => quarry(g, true), spent: g => quarry(g, false) }, [16, 22]),
  mine: define(32, 24, campLegend, { full: g => mine(g, true, true), one: g => mine(g, true, false), spent: g => mine(g, false, false) }, [16, 22]),
  rubble: define(24, 16, campLegend, { ready: g => rubble(g, true), gathered: g => rubble(g, false) }),
  toolshedSite: define(24, 16, campLegend, { still: toolshedSite }),
  toolshed: define(24, 28, campLegend, { built: toolshed }),
  woodpileSite: define(24, 16, campLegend, { still: woodpileSite }),
  woodpile: define(24, 20, campLegend, { empty: g => woodpile(g, 'empty'), some: g => woodpile(g, 'some'), full: g => woodpile(g, 'full') }),
  timberYard: define(40, 20, campLegend, { empty: g => timberYard(g, 'empty'), some: g => timberYard(g, 'some'), full: g => timberYard(g, 'full') }),
  fibreStackSite: define(24, 16, campLegend, { still: fibreStackSite }),
  fibreStack: define(24, 20, campLegend, { empty: g => fibreStack(g, 'empty'), some: g => fibreStack(g, 'some'), full: g => fibreStack(g, 'full') }),
  houseSite: define(40, 32, campLegend, { still: houseSite }),
  house: define(40, 32, campLegend, { dark: g => house(g, false), lit: g => house(g, true), ...Object.fromEntries((['natural', 'berry', 'leaf'] as const).flatMap(paint => [false, true].flatMap(boxes => [false, true].map(lit => [
    `${paint}-${boxes ? 'boxes' : 'bare'}-${lit ? 'lit' : 'dark'}`, (g: Grid) => house(g, lit, paint, boxes)
  ])))) }),
  fence: define(26, 17, campLegend, { rail: fenceRail, side: fenceSide }),
  woodshed: define(48, 40, campLegend, { empty: g => woodshed(g, 'empty'), some: g => woodshed(g, 'some'), full: g => woodshed(g, 'full') }),
  larderSite: define(24, 16, campLegend, { still: larderSite }),
  larder: define(24, 28, campLegend, { empty: g => larder(g, 'empty'), some: g => larder(g, 'some'), full: g => larder(g, 'full') }),
  storehouse: define(32, 32, campLegend, { empty: g => storehouse(g, 'empty'), some: g => storehouse(g, 'some'), full: g => storehouse(g, 'full') }),
  vegetableBedsSite: define(48, 16, campLegend, { still: vegetableBedsSite }),
  vegBed: define(14, 12, bedLegend, BED_FRAMES),
  wellSite: define(20, 12, campLegend, { still: wellSite }),
  workshopSite: define(36, 16, campLegend, { still: workshopSite }),
  workshop: define(36, 28, campLegend, { built: workshop }),
  handcart: define(20, 14, campLegend, { empty: g => handcart(g, 'empty'), some: g => handcart(g, 'some'), full: g => handcart(g, 'full') }),
  well: define(20, 24, wellLegend, { built: well }),
  fieldSite: define(64, 16, campLegend, { still: fieldSite }),
  fieldStrip: define(16, 24, fieldLegend, Object.fromEntries((['bare', 'shoots', 'green', 'gold', 'stooks'] as const).map(stage => [stage, (g: Grid) => fieldStrip(g, stage)]))),
  granarySite: define(28, 16, campLegend, { still: granarySite }),
  granary: define(28, 32, campLegend, { empty: g => granary(g, 'empty'), some: g => granary(g, 'some'), full: g => granary(g, 'full') }),
  windmillSite: define(24, 16, campLegend, { still: windmillSite }),
  windmill: define(32, 48, campLegend, Object.fromEntries([0, 1, 2, 3].map(turn => [`turn${turn}`, (g: Grid) => windmill(g, turn)]))),
  bakerySite: define(32, 16, campLegend, { still: bakerySite }),
  beehiveSite: define(16, 8, campLegend, { still: beehiveSite }),
  beehive: define(16, 16, hiveLegend, Object.fromEntries((['still', 'bees0', 'bees1', 'winter0', 'winter1'] as const).map(look => [look, (g: Grid) => beehive(g, look)]))),
  bakery: define(32, 32, campLegend, { cold: g => bakery(g, 'cold'), loaves: g => bakery(g, 'loaves'), baking: g => bakery(g, 'baking') }),
  pileCount: define(13, 7, countLegend, {
    ...Object.fromEntries([2, 3, 4, 5, 6, 7, 8, 9].map(n => [`n${n}`, (g: Grid) => pileCount(g, [String(n)])])),
    lots: g => pileCount(g, ['9', '+'])
  }, [6, 6])
};

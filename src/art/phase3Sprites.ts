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

const campLegend = { s: 'shadow', a: 'wood0', b: 'wood1', c: 'wood2', d: 'wood3', e: 'wood4', f: 'canvas0', g: 'canvas1', h: 'canvas2', i: 'canvas3', j: 'canvas4', k: 'berry2', l: 'berry4', m: 'stone0', n: 'stone1', o: 'stone2', p: 'stone3', q: 'stone4', r: 'fire0', t: 'fire1', u: 'fire2', v: 'fire3', w: 'fire4', z: 'earth3', A: 'earth2', B: 'earth4', C: 'scarf3' } as const;
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
/** One cut terrace of the quarry: a flat top lit from the top-left over a seamed front face. */
function quarryTier(g: Grid, x: number, y: number, w: number, face: number, seam: number): void {
  box(g, x, y, w, 3, 'p'); box(g, x + 1, y, Math.floor(w / 2), 1, 'q'); dot(g, x, y, 'q');
  box(g, x, y + 3, w, face, 'o'); line(g, x, y + 3, x + w - 1, y + 3, 'n');
  for (let sx = x + seam; sx < x + w - 2; sx += 9) line(g, sx, y + 4, sx, y + 2 + face, 'n');
  line(g, x + w - 1, y, x + w - 1, y + 2 + face, 'm'); line(g, x, y + 2 + face, x + w - 1, y + 2 + face, 'm');
}
/** The quarry: three cut terraces of grey stone, with a loose block ready to break free, or a fresh notch where one was. */
function quarry(g: Grid, ready: boolean): void {
  oval(g, 21, 29, 18, 2, 's');
  quarryTier(g, 8, 2, 25, 5, 6);
  quarryTier(g, 3, 10, 34, 5, 4);
  quarryTier(g, 0, 18, 40, 7, 7);
  if (ready) {
    box(g, 24, 21, 10, 8, 'm'); box(g, 24, 21, 9, 3, 'p'); box(g, 24, 21, 4, 1, 'q');
    box(g, 24, 24, 9, 4, 'o'); line(g, 26, 26, 30, 26, 'p');
  } else {
    box(g, 24, 20, 9, 6, 'm'); box(g, 25, 20, 7, 1, 'n'); dot(g, 24, 20, 'n');
    for (const [x, y] of [[19, 27], [23, 28], [29, 28], [34, 27], [37, 28]]) { dot(g, x, y, 'p'); dot(g, x + 1, y, 'n'); }
  }
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
/** A small log house on a stone footing: a shingled roof edged in dark wood, a stone chimney, a door and one window, dark or lit from within. */
function house(g: Grid, lit: boolean): void {
  oval(g, 20, 30, 19, 2, 's');
  // Log walls: dark ends, each course a lit top over a shaded underside.
  box(g, 3, 14, 34, 14, 'a');
  for (let y = 15; y < 27; y += 3) { box(g, 4, y, 32, 2, 'c'); line(g, 4, y, 35, y, 'e'); line(g, 4, y + 2, 35, y + 2, 'b'); }
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
  quarry: define(40, 32, campLegend, { ready: g => quarry(g, true), spent: g => quarry(g, false) }, [20, 29]),
  rubble: define(24, 16, campLegend, { ready: g => rubble(g, true), gathered: g => rubble(g, false) }),
  toolshedSite: define(24, 16, campLegend, { still: toolshedSite }),
  toolshed: define(24, 28, campLegend, { built: toolshed }),
  woodpileSite: define(24, 16, campLegend, { still: woodpileSite }),
  woodpile: define(24, 20, campLegend, { empty: g => woodpile(g, 'empty'), some: g => woodpile(g, 'some'), full: g => woodpile(g, 'full') }),
  fibreStackSite: define(24, 16, campLegend, { still: fibreStackSite }),
  fibreStack: define(24, 20, campLegend, { empty: g => fibreStack(g, 'empty'), some: g => fibreStack(g, 'some'), full: g => fibreStack(g, 'full') }),
  houseSite: define(40, 32, campLegend, { still: houseSite }),
  house: define(40, 32, campLegend, { dark: g => house(g, false), lit: g => house(g, true) }),
  woodshed: define(48, 40, campLegend, { empty: g => woodshed(g, 'empty'), some: g => woodshed(g, 'some'), full: g => woodshed(g, 'full') }),
  larderSite: define(24, 16, campLegend, { still: larderSite }),
  larder: define(24, 28, campLegend, { empty: g => larder(g, 'empty'), some: g => larder(g, 'some'), full: g => larder(g, 'full') }),
  pileCount: define(13, 7, countLegend, {
    ...Object.fromEntries([2, 3, 4, 5, 6, 7, 8, 9].map(n => [`n${n}`, (g: Grid) => pileCount(g, [String(n)])])),
    lots: g => pileCount(g, ['9', '+'])
  }, [6, 6])
};

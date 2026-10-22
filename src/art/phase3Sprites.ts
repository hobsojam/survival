import type { PaletteKey } from './palette';
import type { SpriteDef } from './sprites';

type Grid = string[][];
const blank = (w: number, h: number): Grid => Array.from({ length: h }, () => new Array(w).fill('.'));
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

const campLegend = { s: 'shadow', a: 'wood0', b: 'wood1', c: 'wood2', d: 'wood3', e: 'wood4', f: 'canvas0', g: 'canvas1', h: 'canvas2', i: 'canvas3', j: 'canvas4', k: 'berry2', l: 'berry4', m: 'stone0', n: 'stone1', o: 'stone2', p: 'stone3', q: 'stone4', r: 'fire0', t: 'fire1', u: 'fire2', v: 'fire3', w: 'fire4', z: 'earth3' } as const;
function stake(g: Grid, x: number, y: number): void {
  box(g, x, y, 2, 4, 'a'); box(g, x, y, 1, 2, 'd'); dot(g, x, y, 'e');
}
function shelterSite(g: Grid): void {
  box(g, 6, 20, 36, 8, 'z');
  for (const [x, y] of [[4, 18], [42, 18], [4, 27], [42, 27]]) stake(g, x, y);
  line(g, 6, 19, 42, 19, 'h'); line(g, 6, 27, 42, 27, 'h');
  line(g, 5, 20, 5, 27, 'h'); line(g, 43, 20, 43, 27, 'h');
}
function shelter(g: Grid, bed: boolean): void {
  oval(g, 24, 36, 21, 3, 's');
  box(g, 3, 17, 42, 17, 'a'); box(g, 5, 18, 38, 14, 'g');
  for (let y = 4; y <= 28; y++) {
    const half = Math.min(21, Math.floor((y - 4) * .88));
    box(g, 24 - half, y, half + 1, 1, 'h'); box(g, 25, y, half, 1, 'g');
    dot(g, 24 - half, y, 'f');
  }
  line(g, 24, 4, 24, 25, 'j');
  box(g, 16, 23, 17, 11, 'f'); box(g, 19, 24, 11, 10, 'a');
  if (bed) { box(g, 19, 29, 11, 5, 'i'); box(g, 20, 28, 9, 2, 'j'); box(g, 20, 32, 9, 2, 'g'); }
  box(g, 4, 34, 40, 2, 'c'); box(g, 5, 34, 38, 1, 'e');
  for (const x of [4, 43]) { line(g, 24, 5, x, 33, 'b'); dot(g, x, 33, 'e'); }
}
function crateSite(g: Grid): void {
  for (const [x, y] of [[2, 9], [12, 9], [2, 13], [12, 13]]) stake(g, x, y);
  line(g, 4, 11, 11, 11, 'j'); line(g, 7, 8, 7, 13, 'j');
}
function crate(g: Grid): void {
  oval(g, 8, 13, 6, 2, 's');
  box(g, 2, 5, 12, 8, 'a'); box(g, 3, 6, 10, 6, 'c');
  box(g, 2, 4, 12, 3, 'd'); box(g, 3, 4, 10, 1, 'e');
  line(g, 5, 5, 5, 12, 'b'); line(g, 10, 5, 10, 12, 'b');
  line(g, 3, 9, 12, 9, 'a'); dot(g, 3, 8, 'e'); dot(g, 12, 8, 'e');
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
function flames(g: Grid, hearth: boolean, mode: 'burning' | 'low' | 'windy' | 'lowWindy', frame: number): void {
  const cx = g[0].length / 2, base = g.length - 8;
  const low = mode === 'low' || mode === 'lowWindy';
  const height = low ? 6 : hearth ? 14 : 12;
  const lean = mode === 'windy' || mode === 'lowWindy' ? 3 : 0;
  for (let y = 0; y < height; y++) {
    const half = Math.max(0, Math.floor((height - y) / 4));
    const x = cx + Math.round(lean * y / height) + (frame % 2 && y > height / 2 ? 1 : 0);
    box(g, x - half, base - y, half * 2 + 1, 1, y < height * .3 ? 'w' : y < height * .6 ? 'v' : 't');
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

export const phase3Sprites: Record<string, SpriteDef> = {
  branchPile: define(16, 16, nodeLegend, { ready: g => branch(g, true), depleted: g => branch(g, false) }),
  berryBush: define(16, 16, nodeLegend, { ready: g => bush(g, true), picked: g => bush(g, false), rustle0: g => bush(g, true, -1), rustle1: g => bush(g, true, 1) }, [8, 14],
    { rustle: { frames: ['rustle0', 'rustle1', 'ready'], frameRate: 8, repeat: 0 } }),
  fiberReeds: define(16, 16, nodeLegend, { ready: g => reeds(g, true), cut: g => reeds(g, false), sway0: g => reeds(g, true, -1), sway1: g => reeds(g, true, 1) }, [8, 14],
    { sway: { frames: ['ready', 'sway0', 'ready', 'sway1'], frameRate: 2, repeat: -1 } }),
  firePit: fireFrames(false), hearth: fireFrames(true), flame: flameOverlay(false), hearthFlame: flameOverlay(true),
  hearthSite: define(24, 12, campLegend, { still: hearthSite }),
  shelterSite: define(48, 32, campLegend, { still: shelterSite }),
  shelter: define(48, 40, campLegend, { built: g => shelter(g, false), builtBed: g => shelter(g, true) }),
  crateSite: define(16, 16, campLegend, { still: crateSite }),
  crate: define(16, 16, campLegend, { built: crate }),
  dryingRackSite: define(32, 16, campLegend, { still: rackSite }),
  dryingRack: define(32, 32, campLegend, { built: rack }),
  windbreakSite: define(48, 16, campLegend, { still: windbreakSite }),
  windbreak: define(48, 32, campLegend, { built: windbreak }),
  logSeat: define(24, 12, campLegend, { still: logSeat })
};

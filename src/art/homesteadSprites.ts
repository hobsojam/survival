import type { PaletteKey } from './palette';
import type { SpriteDef } from './sprites';

type Grid = string[][];
const blank = (width: number, height: number): Grid => Array.from({ length: height }, () => Array.from({ length: width }, () => '.'));
const dot = (g: Grid, x: number, y: number, c: string): void => { if (g[y]?.[x] !== undefined) g[y][x] = c; };
const box = (g: Grid, x: number, y: number, width: number, height: number, c: string): void => {
  for (let yy = y; yy < y + height; yy++) for (let xx = x; xx < x + width; xx++) dot(g, xx, yy, c);
};
const line = (g: Grid, x0: number, y0: number, x1: number, y1: number, c: string): void => {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i++) dot(g, Math.round(x0 + (x1 - x0) * i / steps), Math.round(y0 + (y1 - y0) * i / steps), c);
};
const oval = (g: Grid, cx: number, cy: number, rx: number, ry: number, c: string): void => {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
    if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) dot(g, x, y, c);
};
function define(width: number, height: number, legend: Record<string, PaletteKey>, painters: Record<string, (g: Grid) => void>, anchor: [number, number]): SpriteDef {
  return { size: [width, height], anchor, legend, frames: Object.fromEntries(Object.entries(painters).map(([name, paint]) => {
    const g = blank(width, height); paint(g); return [name, g.map(row => row.join(''))];
  })) };
}

const woodLegend = { s: 'shadow', a: 'wood0', b: 'wood1', c: 'wood2', d: 'wood3', e: 'wood4', t: 'canvas1', u: 'canvas2', v: 'canvas3', f: 'earth2', g: 'earth3', h: 'leaf1', i: 'leaf2', j: 'leaf3', k: 'leaf4', r: 'berry2', q: 'berry3', w: 'paper' } as const;

function chicken(g: Grid, stride: -1 | 0 | 1): void {
  oval(g, 9, 14, 7, 1, 's');
  box(g, 2, 7, 3, 3, 'w'); box(g, 3, 6, 2, 2, 'v'); // upright tail
  oval(g, 8, 9, 5, 4, 'u'); oval(g, 7, 9, 3, 2, 'v');
  box(g, 10, 5, 4, 4, 'u'); box(g, 11, 5, 2, 2, 'w');
  dot(g, 11, 4, 'r'); dot(g, 12, 3, 'r'); dot(g, 13, 4, 'q'); // comb
  dot(g, 13, 6, 'a'); dot(g, 13, 8, 'r');
  box(g, 14, 7, 2, 1, 'e'); dot(g, 15, 8, 'd'); // beak
  line(g, 6, 12, 6 + stride, 14, 'e'); line(g, 10, 12, 10 - stride, 14, 'e');
  box(g, 5 + stride, 14, 3, 1, 'd'); box(g, 9 - stride, 14, 3, 1, 'd');
}

function coop(g: Grid): void {
  oval(g, 16, 27, 15, 3, 's');
  box(g, 4, 13, 24, 13, 'b'); box(g, 6, 13, 20, 11, 'c');
  for (const x of [8, 13, 18, 23]) box(g, x, 15, 1, 8, 'd');
  for (let y = 7; y < 14; y++) box(g, 15 - (y - 7) * 2, y, 2 + (y - 7) * 4, 1, y % 2 ? 'a' : 'b');
  box(g, 13, 17, 7, 9, 'a'); box(g, 14, 18, 5, 8, 'h'); // dark entrance
  box(g, 3, 25, 27, 2, 'd'); box(g, 4, 24, 25, 1, 'e');
  box(g, 7, 27, 3, 3, 'b'); box(g, 23, 27, 3, 3, 'b');
  line(g, 20, 24, 28, 27, 'e'); line(g, 20, 25, 28, 28, 'c'); // short ramp
}

function coopSite(g: Grid): void {
  oval(g, 16, 14, 14, 3, 's');
  box(g, 4, 11, 24, 2, 'b'); box(g, 5, 10, 22, 1, 'd');
  box(g, 4, 8, 2, 6, 'c'); box(g, 26, 8, 2, 6, 'c');
  line(g, 6, 9, 24, 12, 'e'); line(g, 7, 12, 21, 8, 'c');
}

function birdhouse(g: Grid): void {
  oval(g, 12, 23, 8, 2, 's');
  box(g, 11, 9, 2, 15, 'b'); box(g, 12, 10, 1, 13, 'd');
  box(g, 5, 6, 14, 10, 'c'); box(g, 6, 7, 12, 7, 'd');
  for (let y = 2; y < 7; y++) box(g, 11 - (y - 2) * 2, y, 2 + (y - 2) * 4, 1, 'b');
  box(g, 10, 8, 4, 4, 'a'); box(g, 11, 9, 2, 2, 'h');
  box(g, 8, 15, 8, 1, 'e');
}

function wolfHouse(g: Grid): void {
  oval(g, 16, 27, 15, 3, 's');
  box(g, 3, 14, 26, 12, 'b'); box(g, 5, 14, 22, 11, 'c');
  for (let y = 6; y < 15; y++) box(g, 15 - (y - 6) * 2, y, 2 + (y - 6) * 4, 1, y % 2 ? 'a' : 'd');
  box(g, 12, 17, 9, 9, 'a'); box(g, 13, 18, 7, 8, 'h');
  box(g, 3, 25, 27, 2, 'd'); box(g, 5, 27, 3, 2, 'b'); box(g, 25, 27, 3, 2, 'b');
  box(g, 14, 25, 6, 2, 't'); // bedding at the threshold
}

function foxDen(g: Grid): void {
  oval(g, 16, 22, 15, 5, 's');
  oval(g, 16, 19, 14, 7, 'f'); oval(g, 16, 20, 10, 5, 'g');
  oval(g, 16, 21, 7, 5, 'a'); oval(g, 16, 23, 6, 2, 'b');
  line(g, 4, 17, 12, 12, 'c'); line(g, 20, 12, 28, 17, 'c');
  line(g, 6, 16, 14, 13, 'e'); line(g, 18, 13, 26, 16, 'd');
  for (const x of [9, 13, 19, 23]) line(g, x, 24, x + 3, 23, 'u');
  dot(g, 3, 20, 'j'); dot(g, 28, 20, 'j');
}

function shed(g: Grid): void {
  oval(g, 20, 30, 18, 3, 's');
  box(g, 4, 15, 32, 15, 'b'); box(g, 6, 15, 28, 14, 'c');
  for (const x of [8, 15, 22, 29]) box(g, x, 18, 2, 11, 'd');
  for (let y = 6; y < 15; y++) box(g, 19 - (y - 6) * 2, y, 2 + (y - 6) * 4, 1, y % 2 ? 'a' : 't');
  box(g, 17, 19, 10, 11, 'a'); box(g, 18, 20, 8, 10, 'h');
  line(g, 17, 19, 25, 29, 'd'); box(g, 17, 29, 10, 1, 'e');
  dot(g, 23, 24, 'e');
}

function appleTree(g: Grid, full: boolean): void {
  oval(g, 24, 45, 12, 2, 's');
  box(g, 22, 26, 5, 19, 'b'); box(g, 24, 28, 2, 17, 'd');
  line(g, 24, 32, 12, 22, 'b'); line(g, 25, 31, 37, 20, 'b');
  line(g, 24, 37, 14, 31, 'c'); line(g, 26, 37, 35, 30, 'c');
  oval(g, 24, 18, 17, 15, 'h');
  oval(g, 14, 20, 9, 11, 'i'); oval(g, 34, 20, 9, 11, 'i');
  oval(g, 23, 12, 12, 9, 'j');
  for (const [x, y] of [[9, 17], [13, 11], [22, 7], [31, 10], [38, 18], [14, 26], [31, 27]]) box(g, x, y, 3, 2, 'k');
  if (full) for (const [x, y] of [[10, 18], [17, 12], [24, 18], [33, 14], [38, 22], [15, 27], [28, 27], [22, 7]]) {
    box(g, x, y, 3, 3, 'r'); dot(g, x, y, 'q'); dot(g, x + 2, y + 1, 'q');
  }
}

function apples(g: Grid): void {
  oval(g, 8, 13, 7, 2, 's');
  for (const [x, y] of [[3, 10], [7, 11], [10, 9], [6, 7], [11, 12]]) {
    box(g, x, y, 4, 3, 'r'); dot(g, x, y, 'q'); dot(g, x + 1, y - 1, 'b'); dot(g, x + 2, y, 'q');
  }
}

export const homesteadSprites: Record<string, SpriteDef> = {
  chicken: define(16, 16, woodLegend, { idle: g => chicken(g, 0), walk0: g => chicken(g, -1), walk1: g => chicken(g, 1) }, [8, 15]),
  chickenCoop: define(32, 32, woodLegend, { built: coop }, [16, 29]),
  chickenCoopSite: define(32, 16, woodLegend, { still: coopSite }, [16, 14]),
  birdhouse: define(24, 24, woodLegend, { built: birdhouse }, [12, 23]),
  wolfHouse: define(32, 32, woodLegend, { built: wolfHouse }, [16, 29]),
  foxDen: define(32, 28, woodLegend, { built: foxDen }, [16, 25]),
  homesteadShed: define(40, 32, woodLegend, { still: shed }, [20, 30]),
  appleTree: define(48, 48, woodLegend, { full: g => appleTree(g, true), bare: g => appleTree(g, false) }, [24, 45]),
  applePile: define(16, 16, woodLegend, { still: apples }, [8, 14])
};

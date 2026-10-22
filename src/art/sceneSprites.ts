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
  bird: define(14, 12, animalLegend, { ground: g => bird(g, false), flying: g => bird(g, true) }),
  fox: define(32, 22, animalLegend, { standing: g => fox(g, false), sitting: g => fox(g, true) }),
  firefly: define(3, 3, { a: 'firefly', b: 'fire4' }, { still: g => { pixel(g, 1, 0, 'a'); pixel(g, 0, 1, 'a'); pixel(g, 1, 1, 'b'); pixel(g, 2, 1, 'a'); pixel(g, 1, 2, 'a'); } }, [1, 1])
};

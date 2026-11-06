import type { Season } from '../game/calendar';
import { journalEntry, type JournalId } from '../game/journalEntries';
import type { CampView } from './keepViewCamp';

// The view from the top of the keep, painted as rectangles on a small grid so it can be looked at without Phaser.
// It's composed to feel right, not to be accurate: the game's areas don't line up on any real map.

export const PICTURE_WIDTH = 320;
export const PICTURE_HEIGHT = 200;
export const SAIL_COLOR = '#f0ece0';
export const APPLE_COLOR = '#c8352a';

export interface PictureRect { x: number; y: number; w: number; h: number; color: string }

interface SeasonLook {
  sky: readonly [string, string, string];
  far: string;
  woods: readonly [string, string, string, string];
  woodsShade: string;
  hills: readonly [string, string, string];
  ground: string;
  /** What lies on roofs and wall tops, in the one season anything does. */
  snow: string | null;
  leaf: string;
  grain: string;
  /** What drifts down across the picture, and how much of it. */
  falling: { color: string; count: number } | null;
}

const LOOKS: Record<Season, SeasonLook> = {
  autumn: { sky: ['#9fb9c9', '#c6cfc4', '#e6d3ac'], far: '#8a97a0', woods: ['#b5652a', '#c98a2e', '#8f4a24', '#3f5a3c'], woodsShade: '#3e3524', hills: ['#9a7a3c', '#8a5a2c', '#a8864a'], ground: '#8f9a55', snow: null, leaf: '#7f8f3a', grain: '#d4b24a', falling: { color: '#d08a30', count: 12 } },
  winter: { sky: ['#aab8c6', '#c6ced6', '#dde0e0'], far: '#b4bfca', woods: ['#7d6f60', '#8c7f70', '#6a5f53', '#3f5548'], woodsShade: '#59606a', hills: ['#e8edf0', '#d6dee6', '#f4f6f6'], ground: '#eef2f4', snow: '#f4f6f6', leaf: '#6a5f53', grain: '#d6dee6', falling: { color: '#ffffff', count: 45 } },
  spring: { sky: ['#8fc0dc', '#b8dae4', '#e2ecd8'], far: '#8fa8ad', woods: ['#6d9c48', '#86b354', '#527f3e', '#3a6444'], woodsShade: '#2f4a30', hills: ['#7f9a4a', '#d9b92e', '#8fa856'], ground: '#8fbb5a', snow: null, leaf: '#e6c8d4', grain: '#7fa64a', falling: { color: '#f2d5e0', count: 12 } },
  summer: { sky: ['#6fb0dc', '#a2d0e6', '#e8e6c8'], far: '#7d9aa8', woods: ['#3f7a3a', '#55913f', '#2f6432', '#2c5438'], woodsShade: '#233f26', hills: ['#7f5f8f', '#94709f', '#6d8a48'], ground: '#7aa648', snow: null, leaf: '#4f8f3f', grain: '#c9b447', falling: null }
};

const VIEW_LINES: Record<Season, JournalId> = { autumn: 'keepViewAutumn', winter: 'keepViewWinter', spring: 'keepViewSpring', summer: 'keepViewSummer' };

const CAMP_X = 118;
const CAMP_Y = 101;
/** Left and right of everything the camp can draw, in picture pixels: fitting the frame must keep these on screen. */
const CAMP_LEFT = 85;
const CAMP_RIGHT = 155;
const MILL_X = CAMP_X + 4;
const MILL_Y = CAMP_Y + 13;
const SMOKE = '#d8d4ca';
const WOOD_DARK = '#54391f';
const ROOF = '#5a3a22';

const noise = (seed: number): number => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

class Painter {
  readonly rects: PictureRect[] = [];

  rect(x: number, y: number, w: number, h: number, color: string): void {
    this.rects.push({ x: Math.round(x), y: Math.round(y), w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)), color });
  }

  ridge(y: number, amplitude: number, step: number, color: string, seed: number): void {
    for (let x = 0; x < PICTURE_WIDTH; x++) {
      const top = y + Math.sin((x + seed) / step) * amplitude + Math.sin((x + seed * 3) / (step / 2.7)) * amplitude * 0.4;
      this.rect(x, top, 1, PICTURE_HEIGHT - top, color);
    }
  }
}

function paintWoods(p: Painter, look: SeasonLook): void {
  for (let row = 0; row < 9; row++) {
    const baseY = 78 + row * 7;
    const size = 2 + Math.floor(row / 2);
    for (let i = 0; i < 44; i++) {
      const x = (i * 8 + noise(row * 50 + i) * 10) % 330 - 5;
      const y = baseY + noise(i + row) * 4;
      const color = look.woods[Math.floor(noise(row * 13 + i * 7) * 4)];
      p.rect(x - size, y - size, size * 2 + 1, size + 1, color);
      p.rect(x - size + 1, y - size - 1, size * 2 - 1, 1, color);
      p.rect(x - size, y, size * 2 + 1, 1, look.woodsShade);
    }
  }
}

function paintOrchard(p: Painter, look: SeasonLook, orchard: NonNullable<CampView['orchard']>): void {
  orchard.forEach((tree, i) => {
    const x = CAMP_X - 28 + (i % 3) * 4;
    const y = CAMP_Y - 4 + (i > 2 ? 3 : 0);
    if (tree.stage === 'sprout') {
      p.rect(x + 1, y + 2, 1, 1, look.leaf);
      return;
    }
    if (tree.stage === 'sapling') {
      p.rect(x + 1, y + 1, 2, 2, look.leaf);
      return;
    }
    const grown = tree.stage === 'grown';
    p.rect(x, grown ? y - 1 : y, 3, grown ? 3 : 2, look.leaf);
    p.rect(x + 1, y + 2, 1, 1, '#4a3520');
    if (tree.apples) p.rect(x + 1, y, 1, 1, APPLE_COLOR);
  });
}

function paintCamp(p: Painter, look: SeasonLook, camp: CampView): void {
  const cx = CAMP_X;
  const cy = CAMP_Y;
  const roofOf = (color: string): string => look.snow ?? color;
  for (let dy = -9; dy <= 9; dy++) {
    const half = Math.sqrt(1 - (dy * dy) / 82) * camp.clearingRadius;
    p.rect(cx - half, cy + dy, half * 2, 1, look.ground);
  }
  if (camp.shelter !== 'none') {
    p.rect(cx + 8, cy - 1, 5, 3, camp.shelter === 'woodshed' ? '#8a6840' : '#6e5233');
    p.rect(cx + 7, cy - 2, 7, 1, roofOf('#50391f'));
  }
  if (camp.campfire) p.rect(cx - 1, cy + 3, 2, 1, '#e8932e');
  if (camp.field) for (let i = 0; i < 4; i++) p.rect(cx - 6 + i * 4, cy + 6, 3, 2, look.grain);
  if (camp.beds) {
    p.rect(cx - 18, cy + 2, 3, 2, WOOD_DARK);
    p.rect(cx - 14, cy + 2, 3, 2, WOOD_DARK);
  }
  if (camp.well) {
    p.rect(cx - 20, cy - 3, 3, 2, '#8d8d86');
    p.rect(cx - 20, cy - 4, 3, 1, '#50391f');
  }
  if (camp.workshop) {
    p.rect(cx + 14, cy + 2, 6, 3, '#7a5c36');
    p.rect(cx + 13, cy + 1, 8, 1, roofOf('#5c4023'));
  }
  if (camp.house) {
    p.rect(cx - 5, cy - 6, 9, 5, '#8a6840');
    p.rect(cx - 6, cy - 7, 11, 1, roofOf(ROOF));
    p.rect(cx - 5, cy - 8, 9, 1, roofOf(ROOF));
    p.rect(cx + 2, cy - 11, 2, 3, '#77756e');
    p.rect(cx - 2, cy - 3, 2, 2, '#f0c460');
  }
  if (camp.bakery) {
    p.rect(cx - 13, cy - 9, 5, 3, '#a07a4c');
    p.rect(cx - 14, cy - 10, 7, 1, roofOf('#7a4a2a'));
  }
  if (camp.orchard) paintOrchard(p, look, camp.orchard);
  if (camp.windmill) {
    p.rect(MILL_X - 2, MILL_Y - 8, 5, 9, '#c9c1ab');
    p.rect(MILL_X - 1, MILL_Y - 10, 3, 2, roofOf(ROOF));
  }
}

function paintCliff(p: Painter, look: SeasonLook): void {
  for (let i = 0; i < 16; i++) {
    const inset = Math.abs(i - 8) * 1.4;
    p.rect(214 + i * 3, 110 + inset, 3, 28 - inset, i % 3 ? '#8d8a82' : '#74716a');
  }
  p.rect(222, 126, 30, 12, look.snow ? '#e8edf0' : '#a8a292');
}

function paintHills(p: Painter, look: SeasonLook): void {
  p.ridge(140, 5, 48, look.hills[0], 3);
  for (let i = 0; i < 300; i++) {
    p.rect(noise(i) * PICTURE_WIDTH, 142 + noise(i * 3) * 36, 2 + (i % 3), 1, look.hills[1 + (i % 2)]);
  }
  const path = look.snow ? '#c6ced6' : '#b7a57c';
  for (let d = 0; d < 80; d++) {
    const along = d / 80;
    p.rect(165 + Math.sin(along * 5) * 32 * (1 - along) + along * 55, 178 - along * 42, 4 - along * 3, 1, path);
  }
}

function paintBattlements(p: Painter, look: SeasonLook): void {
  const stone = look.snow ? '#8b8f92' : '#77736a';
  const top = look.snow ?? '#928d81';
  const shade = '#4e4b44';
  p.rect(0, 183, PICTURE_WIDTH, 17, stone);
  for (let x = 0; x < PICTURE_WIDTH; x += 32) {
    p.rect(x + 4, 170, 22, 14, stone);
    p.rect(x + 4, 170, 22, 2, top);
    p.rect(x + 24, 172, 2, 12, shade);
    p.rect(x + 9, 176, 7, 1, shade);
    p.rect(x + 13, 180, 8, 1, shade);
  }
  p.rect(0, 183, PICTURE_WIDTH, 2, top);
  for (let row = 0; row < 3; row++) {
    for (let x = (row % 2) * 12; x < PICTURE_WIDTH; x += 24) p.rect(x, 188 + row * 5, 12, 1, shade);
  }
}

/** What doesn't move: sky, ridges, woods, cliff, hills, path, battlements and the camp's buildings. */
export function stillRects(season: Season, camp: CampView): PictureRect[] {
  const look = LOOKS[season];
  const p = new Painter();
  look.sky.forEach((color, i) => p.rect(0, i * 24, PICTURE_WIDTH, 26, color));
  p.ridge(60, 6, 34, look.far, 11);
  p.ridge(70, 4, 22, look.woods[3], 57);
  paintWoods(p, look);
  paintCamp(p, look, camp);
  paintCliff(p, look);
  paintHills(p, look);
  paintBattlements(p, look);
  return p.rects;
}

/** What moves at this tick (8 ticks a second): clouds, smoke, sails, sheep, and falling snow, leaves or petals. */
export function movingRects(season: Season, camp: CampView, tick: number): PictureRect[] {
  const look = LOOKS[season];
  const p = new Painter();
  for (let i = 0; i < 4; i++) {
    const x = ((i * 97 + tick / 9) % 380) - 40;
    const y = 10 + i * 9;
    p.rect(x, y, 26 + i * 4, 3, '#f4f2e8');
    p.rect(x + 5, y - 2, 14, 2, '#f4f2e8');
  }
  if (camp.campfire) {
    const flicker = Math.floor(tick / 2) % 3;
    p.rect(CAMP_X - 1 + (flicker === 1 ? 1 : 0), CAMP_Y - 1 - flicker, 1, 2, '#cfcac0');
  }
  if (camp.house) {
    for (let i = 0; i < 6; i++) {
      const rise = (tick / 6 + i * 2) % 12;
      p.rect(CAMP_X + 2 + Math.sin(rise / 2) * 1.6 + rise / 3, CAMP_Y - 12 - rise * 1.5, rise > 7 ? 2 : 1, 1, SMOKE);
    }
  }
  if (camp.windmill) {
    for (let sail = 0; sail < 4; sail++) {
      const angle = tick / 12 + sail * Math.PI / 2;
      for (let d = 1; d <= 6; d++) p.rect(MILL_X + Math.cos(angle) * d, MILL_Y - 7 + Math.sin(angle) * d, 1, 1, SAIL_COLOR);
    }
  }
  for (let i = 0; i < camp.sheep; i++) {
    const x = CAMP_X + 22 + i * 3 + Math.sin(tick / 40 + i * 2) * 1.5;
    const y = CAMP_Y - 6 + (i === 1 ? 2 : 0);
    p.rect(x, y, 2, 2, '#f6f3ea');
    p.rect(x, y + 2, 1, 1, '#3a342c');
  }
  if (look.falling) {
    for (let i = 0; i < look.falling.count; i++) {
      const x = (noise(i) * 340 + tick / 3 + Math.sin(tick / 15 + i) * 4 + PICTURE_WIDTH) % PICTURE_WIDTH;
      const y = (noise(i * 2) * PICTURE_HEIGHT + tick * (0.5 + noise(i) * 0.5)) % PICTURE_HEIGHT;
      p.rect(x, y, 1, 1, look.falling.color);
    }
  }
  return p.rects;
}

/** The journal's line for looking out in this season. */
export function viewLine(season: Season): string {
  return journalEntry(VIEW_LINES[season])?.lines[0] ?? '';
}

export interface PictureFit { scale: number; x: number; y: number }

/** Covers the frame with the battlements along its bottom, centred as far as that keeps the camp in view. */
export function pictureFit(viewWidth: number, viewHeight: number): PictureFit {
  const scale = Math.max(viewWidth / PICTURE_WIDTH, viewHeight / PICTURE_HEIGHT);
  const centred = (viewWidth - PICTURE_WIDTH * scale) / 2;
  return {
    scale,
    x: Math.max(Math.min(centred, viewWidth - CAMP_RIGHT * scale), -CAMP_LEFT * scale),
    y: viewHeight - PICTURE_HEIGHT * scale
  };
}

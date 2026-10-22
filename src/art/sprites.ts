import type { PaletteKey } from './palette';
import { terrainSprites } from './terrain';
import { sceneSprites } from './sceneSprites';
import { phase3Sprites } from './phase3Sprites';

export interface SpriteDef {
  size: [number, number];
  anchor: [number, number];
  legend: Record<string, PaletteKey>;
  frames: Record<string, string[]>;
  animations?: Record<string, { frames: string[]; frameRate: number; repeat: number }>;
}

const grassPlain: SpriteDef = {
  size: [16, 16], anchor: [8, 15], legend: { g: 'grass2' },
  frames: { plain: Array(16).fill('gggggggggggggggg') }
};

/** Palette-indexed art shared by the game and contact sheet. */
export const sprites: Record<string, SpriteDef> = { grassPlain, ...terrainSprites, ...sceneSprites, ...phase3Sprites };

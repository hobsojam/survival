import type { PaletteKey } from './palette';
import { terrainSprites } from './terrain';
import { wildlifeSprites } from './wildlifeSprites';
import { phase3Sprites } from './phase3Sprites';
import { survivorSprite } from './survivor';

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

const branchPile: SpriteDef = {
  size: [16, 16], anchor: [8, 15],
  legend: { o: 'wood0', d: 'wood1', w: 'wood2', l: 'wood3', h: 'wood4', e: 'earth1', q: 'earth3', s: 'shadow' },
  frames: {
    ready: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '.........hho....',
      '...od..hhll.....',
      '.....ddll.......',
      '......lddwwwo...',
      '....llwwwdd.....',
      '..oow......o....',
      '................',
      '....ssssssss....',
      '................'
    ],
    readyB: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '........hho.....',
      '...od.hhll......',
      '....ddll........',
      '......ldd.wwo...',
      '....ll.wwd......',
      '...owww...d.....',
      '..ow.......o....',
      '....ssssssss....',
      '................'
    ],
    depleted: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '.......o........',
      '.....wd..o......',
      '....o..e..wde...',
      '...e.ee.qe.eoe..',
      '.....eeqeeeq....',
      '.....ssssss.....',
      '................'
    ]
  },
  animations: { rustle: { frames: ['ready', 'readyB'], frameRate: 6, repeat: 0 } }
};

/** Palette-indexed art shared by the game and contact sheet. */
export const sprites: Record<string, SpriteDef> = { grassPlain, ...terrainSprites, ...wildlifeSprites, ...phase3Sprites, branchPile, survivor: survivorSprite };

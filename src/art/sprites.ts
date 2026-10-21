import type { PaletteKey } from './palette';

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
  legend: { o: 'wood0', d: 'wood1', w: 'wood2', l: 'wood3', h: 'wood4', e: 'earth2', s: 'shadow' },
  frames: {
    ready: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '......oo........',
      '.....olwo.......',
      '....owllwo......',
      '...odwwhhdo.....',
      '..oowwoowwoo....',
      '..owhwwddwho....',
      '...oowwwwoo.....',
      '....oooooo......',
      '....ssssss......',
      '................'
    ],
    readyB: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '.......oo.......',
      '......olwo......',
      '.....owllwo.....',
      '...odwwhhdo.....',
      '..oowwoowwoo....',
      '..owhwwddwho....',
      '...oowwwwoo.....',
      '....oooooo......',
      '....ssssss......',
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
      '................',
      '......ee........',
      '....eewwee......',
      '.....oddo.......',
      '....eewwee......',
      '.....ssss.......',
      '................'
    ]
  },
  animations: { rustle: { frames: ['ready', 'readyB'], frameRate: 6, repeat: 0 } }
};

/** Phase 1 prototypes; later phases add the production terrain, nodes, and actors. */
export const sprites: Record<string, SpriteDef> = { grassPlain, branchPile };

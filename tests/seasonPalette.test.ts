import { describe, expect, it } from 'vitest';
import { palette, type PaletteKey } from '../src/art/palette';
import { seasonPalette } from '../src/art/seasonPalette';
import { sprites } from '../src/art/sprites';
import { rasterizeFrame } from '../src/art/textures';

const hasColor = (pixels: Uint8ClampedArray, hex: string) => {
  const [r, g, b] = [1, 3, 5].map(at => Number.parseInt(hex.slice(at, at + 2), 16));
  for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] && pixels[i] === r && pixels[i + 1] === g && pixels[i + 2] === b) return true;
  return false;
};

describe('season palettes', () => {
  it('keeps summer as the painted look and changes the others', () => {
    expect(seasonPalette('summer')).toEqual(palette);
    expect(seasonPalette('autumn').crown2).toBe('#c25a24');
    expect(seasonPalette('autumn').leaf2).toBe(palette.leaf2);
    expect(seasonPalette('winter').grass2).toBe('#d4e0e6');
    expect(seasonPalette('spring').grass2).toBe('#64a04a');
  });

  it('gives every season every colour', () => {
    for (const season of ['autumn', 'winter', 'spring', 'summer'] as const)
      expect(Object.keys(seasonPalette(season)).sort()).toEqual((Object.keys(palette) as PaletteKey[]).sort());
  });

  it('turns broadleaf crowns in autumn but leaves the pines green', () => {
    const autumn = seasonPalette('autumn');
    expect(hasColor(rasterizeFrame(sprites.treeBroadleaf, 'still', autumn), '#c25a24')).toBe(true);
    const pine = rasterizeFrame(sprites.treePine, 'still', autumn);
    for (const key of ['crown0', 'crown1', 'crown2', 'crown3', 'crown4'] as const) expect(hasColor(pine, autumn[key])).toBe(false);
    expect(hasColor(pine, palette.leaf2)).toBe(true);
  });

  it('snows over the paths in winter but keeps the camp circle trodden earth', () => {
    const winter = seasonPalette('winter');
    for (let i = 0; i < 5; i++) {
      const key = `path${i}` as PaletteKey;
      expect(winter[key]).not.toBe(palette[`earth${i}` as PaletteKey]);
      for (const season of ['autumn', 'spring', 'summer'] as const) expect(seasonPalette(season)[key]).toBe(palette[`earth${i}` as PaletteKey]);
    }
    expect(winter.earth2).toBe(palette.earth2);
  });
});

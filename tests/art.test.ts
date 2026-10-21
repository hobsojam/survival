import { describe, expect, it } from 'vitest';
import { palette } from '../src/art/palette';
import { sprites, type SpriteDef } from '../src/art/sprites';
import { rasterizeFrame, validateSprite } from '../src/art/textures';

function clone(def: SpriteDef): SpriteDef {
  return { ...def, size: [...def.size], anchor: [...def.anchor], legend: { ...def.legend }, frames: Object.fromEntries(Object.entries(def.frames).map(([key, rows]) => [key, [...rows]])) };
}

describe('sprite pipeline', () => {
  it('validates every registered frame, palette symbol, and anchor', () => {
    expect(Object.keys(sprites)).toEqual(expect.arrayContaining(['grassPlain', 'branchPile']));
    for (const [name, def] of Object.entries(sprites)) {
      expect(() => validateSprite(def), name).not.toThrow();
      expect(Object.keys(def.frames).length).toBeGreaterThan(0);
    }
  });

  it('rejects a frame with wrong dimensions or an unknown symbol', () => {
    const short = clone(sprites.branchPile);
    short.frames.ready = short.frames.ready.slice(1);
    expect(() => validateSprite(short)).toThrow(/height/i);
    const badPixel = clone(sprites.branchPile);
    badPixel.frames.ready[0] = '?'.repeat(16);
    expect(() => validateSprite(badPixel)).toThrow(/symbol/i);
  });

  it('turns palette symbols into exact RGBA bytes and leaves dots transparent', () => {
    const def: SpriteDef = { size: [2, 1], anchor: [0, 0], legend: { a: 'grass0', s: 'shadow' }, frames: { still: ['a.'] } };
    expect(rasterizeFrame(def, 'still')).toEqual(new Uint8ClampedArray([47, 82, 54, 255, 0, 0, 0, 0]));
    def.frames.still = ['s.'];
    expect(rasterizeFrame(def, 'still')[3]).toBe(115);
    expect(palette.grass0).toBe('#2f5236');
  });
});

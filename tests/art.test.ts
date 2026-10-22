import { describe, expect, it } from 'vitest';
import { palette } from '../src/art/palette';
import { sprites, type SpriteDef } from '../src/art/sprites';
import { animationConfigs, rasterizeFrame, validateSprite } from '../src/art/textures';

function clone(def: SpriteDef): SpriteDef {
  return { ...def, size: [...def.size], anchor: [...def.anchor], legend: { ...def.legend }, frames: Object.fromEntries(Object.entries(def.frames).map(([key, rows]) => [key, [...rows]])) };
}

describe('sprite pipeline', () => {
  it('provides complete phase 3 resource and camp art', () => {
    const required: Record<string, { size: [number, number]; frames: string[] }> = {
      branchPile: { size: [16, 16], frames: ['ready', 'depleted'] },
      berryBush: { size: [16, 16], frames: ['ready', 'picked', 'rustle0', 'rustle1'] },
      fiberReeds: { size: [16, 16], frames: ['ready', 'cut', 'sway0', 'sway1'] },
      firePit: { size: [24, 24], frames: ['unlit', 'burning0', 'burning1', 'burning2', 'burning3', 'low0', 'low1', 'low2', 'low3', 'windy0', 'windy1', 'windy2', 'windy3', 'lowWindy0', 'lowWindy1', 'lowWindy2', 'lowWindy3'] },
      hearth: { size: [32, 28], frames: ['unlit', 'burning0', 'burning1', 'burning2', 'burning3', 'low0', 'low1', 'low2', 'low3', 'windy0', 'windy1', 'windy2', 'windy3', 'lowWindy0', 'lowWindy1', 'lowWindy2', 'lowWindy3'] },
      flame: { size: [16, 20], frames: ['burning0', 'low0', 'windy0', 'lowWindy0'] },
      hearthFlame: { size: [16, 24], frames: ['burning0', 'low0', 'windy0', 'lowWindy0'] },
      hearthSite: { size: [24, 12], frames: ['still'] },
      shelter: { size: [48, 40], frames: ['built', 'builtBed'] },
      shelterSite: { size: [48, 32], frames: ['still'] },
      crate: { size: [16, 16], frames: ['built'] },
      crateSite: { size: [16, 16], frames: ['still'] },
      dryingRack: { size: [32, 32], frames: ['built'] },
      dryingRackSite: { size: [32, 16], frames: ['still'] },
      windbreak: { size: [48, 32], frames: ['built'] },
      windbreakSite: { size: [48, 16], frames: ['still'] },
      logSeat: { size: [24, 12], frames: ['still'] }
    };
    for (const [name, expected] of Object.entries(required)) {
      expect(sprites[name]?.size, name).toEqual(expected.size);
      expect(Object.keys(sprites[name]?.frames ?? {}), name).toEqual(expect.arrayContaining(expected.frames));
      expect(() => validateSprite(sprites[name]), name).not.toThrow();
    }
    expect(sprites.firePit.frames.burning0).not.toEqual(sprites.firePit.frames.unlit);
    for (const name of ['firePit', 'hearth']) for (const mode of ['burning', 'low', 'windy', 'lowWindy'])
      expect(new Set(Array.from({ length: 4 }, (_, i) => sprites[name].frames[`${mode}${i}`].join(''))).size, `${name}:${mode}`).toBe(4);
    expect(sprites.hearth.frames.unlit).not.toEqual(sprites.firePit.frames.unlit);
    expect(sprites.berryBush.frames.ready).not.toEqual(sprites.berryBush.frames.picked);
    expect(sprites.berryBush.frames.ready.join('')).toContain('p');
    expect(sprites.fiberReeds.frames.ready).not.toEqual(sprites.fiberReeds.frames.cut);
  });
  it('validates every registered frame, palette symbol, and anchor', () => {
    expect(Object.keys(sprites)).toEqual(expect.arrayContaining([
      'branchPile', ...Array.from({ length: 4 }, (_, i) => `grass${i}`),
      ...Array.from({ length: 3 }, (_, i) => `earth${i}`),
      ...Array.from({ length: 16 }, (_, i) => `transition${i}`),
      'tuft0', 'tuft1', 'flower0', 'flower1', 'flower2', 'pebbles0', 'pebbles1',
      'stump', 'mushrooms', 'fallenLeaf', 'rimStone0', 'rimStone1',
      'treeBroadleaf', 'treePine', 'treeYoung', 'rock0', 'rock1'
    ]));
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

  it('provides registered frame sequences for Phaser animations', () => {
    const rustle = animationConfigs(sprites).find(config => config.key === 'berryBush:rustle');
    expect(rustle).toMatchObject({ frameRate: 8, repeat: 0, frames: [
      { key: 'berryBush:rustle0' }, { key: 'berryBush:rustle1' }, { key: 'berryBush:ready' }
    ] });
  });

  it('keeps the branch pile as a small stick stack with a contrasting depleted scuff', () => {
    const pile = sprites.branchPile;
    const wood = (frame: string[]) => frame.join('').split('').filter(symbol =>
      symbol !== '.' && symbol !== 's' && !pile.legend[symbol]?.startsWith('earth')
    ).length;
    expect(wood(pile.frames.ready)).toBeLessThanOrEqual(42);
    expect(wood(pile.frames.ready)).toBeGreaterThanOrEqual(24);
    expect(wood(pile.frames.depleted)).toBeLessThanOrEqual(8);
    const depletedColours = new Set(pile.frames.depleted.join('').split('').map(symbol => pile.legend[symbol]));
    expect(depletedColours).toContain('earth1');
    expect(depletedColours).toContain('earth3');
    expect(depletedColours).not.toContain('earth2');
  });

  it('moves the branch pile visibly through its rustle animation', () => {
    const { ready, readyB } = sprites.branchPile.frames;
    const moved = ready.flatMap((row, y) => [...row].map((pixel, x) =>
      (pixel === '.') !== (readyB[y][x] === '.') ? y : -1
    )).filter(y => y >= 0);
    expect(moved.length).toBeGreaterThanOrEqual(16);
    expect(moved.some(y => y >= 9)).toBe(true);
  });

  it('keeps corner transition edges seamless for adjacent tiles', () => {
    for (let left = 0; left < 16; left++) for (let right = 0; right < 16; right++) {
      const leftEdge = [Boolean(left & 2), Boolean(left & 4)];
      const rightEdge = [Boolean(right & 1), Boolean(right & 8)];
      if (leftEdge[0] !== rightEdge[0] || leftEdge[1] !== rightEdge[1]) continue;
      const a = sprites[`transition${left}`].frames.still;
      const b = sprites[`transition${right}`].frames.still;
      for (let y = 0; y < 16; y++) expect(a[y][15]).toBe(b[y][0]);
    }
  });

  it('rejects animations that refer to missing frames', () => {
    const bad = clone(sprites.branchPile);
    bad.animations = { broken: { frames: ['missing'], frameRate: 6, repeat: 0 } };
    expect(() => validateSprite(bad)).toThrow(/animation/i);
  });

  it('turns palette symbols into exact RGBA bytes and leaves dots transparent', () => {
    const def: SpriteDef = { size: [2, 1], anchor: [0, 0], legend: { a: 'grass0', s: 'shadow' }, frames: { still: ['a.'] } };
    expect(rasterizeFrame(def, 'still')).toEqual(new Uint8ClampedArray([47, 82, 54, 255, 0, 0, 0, 0]));
    def.frames.still = ['s.'];
    expect(rasterizeFrame(def, 'still')[3]).toBe(115);
    expect(palette.grass0).toBe('#2f5236');
  });
});

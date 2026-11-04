import { describe, expect, it } from 'vitest';
import { sprites } from '../src/art/sprites';
import { validateSprite } from '../src/art/textures';

const expected: Record<string, string[]> = {
  chicken: ['idle', 'walk0', 'walk1'], chickenCoop: ['built'], chickenCoopSite: ['still'],
  birdhouse: ['built'], wolfHouse: ['built'], foxDen: ['built'], homesteadShed: ['still'],
  appleTree: ['full', 'bare'], applePile: ['still']
};

describe('homestead sprite art', () => {
  it('registers valid frames for every new scene texture', () => {
    for (const [name, frames] of Object.entries(expected)) {
      expect(sprites[name], name).toBeDefined();
      expect(() => validateSprite(sprites[name]), name).not.toThrow();
      for (const frame of frames) expect(sprites[name].frames[frame], `${name}:${frame}`).toBeDefined();
    }
  });

  it('shows walking motion and a harvested apple tree without losing its trunk', () => {
    const chicken = sprites.chicken.frames;
    expect(chicken.walk0).not.toEqual(chicken.walk1);
    expect(chicken.idle).not.toEqual(chicken.walk0);
    const tree = sprites.appleTree;
    expect(tree.frames.full).not.toEqual(tree.frames.bare);
    const reds = Object.entries(tree.legend).filter(([, color]) => color.startsWith('berry')).map(([symbol]) => symbol);
    const count = (frame: string[]) => [...frame.join('')].filter(symbol => reds.includes(symbol)).length;
    expect(count(tree.frames.full)).toBeGreaterThan(0);
    expect(count(tree.frames.bare)).toBe(0);
    expect(tree.frames.full.at(-3)?.slice(22, 26)).toEqual(tree.frames.bare.at(-3)?.slice(22, 26));
  });
});

import { describe, expect, it } from 'vitest';
import { validateSprite } from '../src/art/textures';
import { wildlifeSprites } from '../src/art/wildlifeSprites';
import { birdGroundFrame, birdFlightFrame, foxFrame, fireflyFrame } from '../src/scene/ambient';

describe('wildlife frame selection', () => {
  it('uses idle, peck, and hop ground poses without changing bird positions', () => {
    expect(birdGroundFrame(0, 0)).toBe('bird:idle');
    expect(birdGroundFrame(0, 2700)).toBe('bird:peck0');
    expect(birdGroundFrame(0, 2850)).toBe('bird:peck1');
    expect(birdGroundFrame(0, 3700)).toBe('bird:hop');
  });

  it('flies at 12 fps and trots, runs, and tail flicks at their own rates', () => {
    expect(birdFlightFrame(0)).toBe('bird:fly0');
    expect(birdFlightFrame(0.09)).toBe('bird:fly1');
    expect(foxFrame('trot', 0.31)).toBe('fox:trot3');
    expect(foxFrame('run', 0.22)).toBe('fox:run3');
    expect(foxFrame('sit', 0.5)).toBe('fox:sit1');
  });

  it('alternates the firefly cross without changing its glow timing', () => {
    expect(fireflyFrame(0, 0)).toBe('firefly:glow0');
    expect(fireflyFrame(0, 500)).toBe('firefly:glow1');
    expect(fireflyFrame(0, 1000)).toBe('firefly:glow0');
  });
});

describe('the falling leaf', () => {
  it('is a valid sprite with two tumbling frames', () => {
    expect(() => validateSprite(wildlifeSprites.leaf)).not.toThrow();
    expect(Object.keys(wildlifeSprites.leaf.frames)).toEqual(['fall0', 'fall1']);
  });
});

describe('wolf tracks', () => {
  it('is a valid ring of prints', () => {
    expect(() => validateSprite(wildlifeSprites.wolfTracks)).not.toThrow();
    expect(wildlifeSprites.wolfTracks.size).toEqual([40, 24]);
    expect(Object.keys(wildlifeSprites.wolfTracks.frames)).toEqual(['still']);
  });
});

describe('rain art', () => {
  it('has a valid rain streak and puddle', () => {
    expect(() => validateSprite(wildlifeSprites.rainStreak)).not.toThrow();
    expect(() => validateSprite(wildlifeSprites.puddle)).not.toThrow();
    expect(wildlifeSprites.puddle.size).toEqual([16, 6]);
  });
});

describe('the rabbit', () => {
  it('is a valid sprite that sits, nibbles and hops', () => {
    expect(() => validateSprite(wildlifeSprites.rabbit)).not.toThrow();
    expect(wildlifeSprites.rabbit.size).toEqual([10, 8]);
    expect(Object.keys(wildlifeSprites.rabbit.frames)).toEqual(['sit', 'nibble0', 'nibble1', 'hop0', 'hop1']);
  });
});

describe('the friends', () => {
  it('has a young wolf that walks, sits and lies down', () => {
    expect(() => validateSprite(wildlifeSprites.wolf)).not.toThrow();
    expect(Object.keys(wildlifeSprites.wolf.frames)).toEqual(['walk0', 'walk1', 'sit', 'lie']);
  });

  it('has a feather and a tuft of fur to leave by the fire', () => {
    expect(() => validateSprite(wildlifeSprites.keepsake)).not.toThrow();
    expect(Object.keys(wildlifeSprites.keepsake.frames)).toEqual(['feather', 'fur']);
  });
});

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

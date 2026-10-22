import { describe, expect, it } from 'vitest';
import { sprites } from '../src/art/sprites';
import { animationConfigs, validateSprite } from '../src/art/textures';

const required: Record<string, { size: [number, number]; frames: string[] }> = {
  bird: { size: [8, 8], frames: ['idle', 'peck0', 'peck1', 'hop', 'fly0', 'fly1'] },
  fox: { size: [24, 16], frames: ['trot0', 'trot1', 'trot2', 'trot3', 'run0', 'run1', 'run2', 'run3', 'sit0', 'sit1'] },
  firefly: { size: [3, 3], frames: ['glow0', 'glow1'] },
  gatherPop: { size: [8, 8], frames: ['wood', 'berry', 'fiber', 'stone'] },
  smokePuff: { size: [8, 8], frames: ['puff0', 'puff1', 'puff2'] },
  spark: { size: [1, 1], frames: ['still'] },
  windStreak: { size: [12, 3], frames: ['streak0', 'streak1', 'streak2'] },
  sleetFleck: { size: [2, 1], frames: ['still'] },
  cookSteam: { size: [4, 6], frames: ['steam0', 'steam1', 'steam2'] },
  shootingStar: { size: [6, 2], frames: ['star0', 'star1', 'star2'] },
  morningFrost: { size: [16, 16], frames: ['frost0', 'frost1', 'frost2'] }
};

describe('phase 5 wildlife and effect art', () => {
  it('registers valid palette-indexed frames at the specified dimensions', () => {
    for (const [name, expected] of Object.entries(required)) {
      const sprite = sprites[name];
      expect(sprite?.size, name).toEqual(expected.size);
      expect(Object.keys(sprite?.frames ?? {}), name).toEqual(expect.arrayContaining(expected.frames));
      expect(() => validateSprite(sprite), name).not.toThrow();
      expect(new Set(expected.frames.map(frame => sprite.frames[frame].join(''))).size, name).toBe(expected.frames.length);
    }
  });

  it('sets the requested wildlife animation rates', () => {
    const animations = animationConfigs(sprites);
    for (const [key, rate] of Object.entries({ 'bird:fly': 12, 'fox:trot': 10, 'fox:run': 14 })) {
      expect(animations.find(animation => animation.key === key)?.frameRate).toBe(rate);
    }
    expect(sprites.smokePuff.legend).toMatchObject({ a: 'stone3', b: 'stone4' });
    expect(Object.values(sprites.spark.legend)).toEqual(['fire4']);
    expect(Object.values(sprites.windStreak.legend)).toContain('frost');
    expect(sprites.firefly.legend).toMatchObject({ a: 'fire4', b: 'firefly' });
    expect(sprites.firefly.frames.glow1[1][1]).toBe('b');
  });
});

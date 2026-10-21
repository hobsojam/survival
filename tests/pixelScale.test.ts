import { describe, expect, it } from 'vitest';
import { displayScale } from '../src/scene/pixelScale';

describe('pixel canvas scale', () => {
  it('uses whole-number desktop magnification and centers spare space', () => {
    expect(displayScale(1000, 640)).toBe(2);
    expect(displayScale(1440, 900)).toBe(3);
  });

  it('fits small frames without cropping the game', () => {
    expect(displayScale(390, 244)).toBeCloseTo(0.8125);
    expect(displayScale(480, 300)).toBe(1);
    expect(displayScale(800, 500)).toBeCloseTo(5 / 3);
  });
});

import { describe, expect, it } from 'vitest';
import { displayScale, viewportSize, canvasOffset } from '../src/scene/pixelScale';

describe('pixel canvas scale', () => {
  it('uses whole-number desktop magnification and centers spare space', () => {
    expect(displayScale(1000, 640)).toBe(2);
    expect(displayScale(1440, 900)).toBe(3);
  });

  it('uses one art pixel per screen pixel on compact frames', () => {
    expect(displayScale(390, 244)).toBe(1);
    expect(displayScale(480, 300)).toBe(1);
    expect(displayScale(800, 500)).toBe(1);
    expect(viewportSize(350, 219)).toEqual({ width: 350, height: 219 });
    expect(viewportSize(800, 500)).toEqual({ width: 480, height: 300 });
  });

  it('grows the viewport to fill portrait phone frames', () => {
    expect(viewportSize(390, 640)).toEqual({ width: 390, height: 480 });
    expect(viewportSize(390, 400)).toEqual({ width: 390, height: 400 });
  });

  it('places the canvas on whole CSS pixels', () => {
    expect(canvasOffset(1001, 641, 480, 300, 2)).toEqual({ x: 20, y: 20 });
  });
});

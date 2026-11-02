import { describe, expect, it } from 'vitest';
import { displayScale, viewportSize, canvasOffset, canvasDisplaySize, portraitViewport } from '../src/scene/pixelScale';

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

  it('magnifies portrait phone frames so tiles are thumb-sized and fill the frame', () => {
    expect(portraitViewport(390, 679)).toEqual({ scale: 2, width: 195, height: 339 });
    expect(portraitViewport(320, 500)).toEqual({ scale: 2, width: 160, height: 250 });
    expect(portraitViewport(390, 2000)).toEqual({ scale: 2, width: 195, height: 480 });
  });

  it('leaves landscape and desktop frames to the normal scale', () => {
    expect(portraitViewport(1000, 640)).toBeNull();
    expect(portraitViewport(800, 900)).toBeNull();
  });

  it('places the canvas on whole CSS pixels', () => {
    expect(canvasOffset(1001, 641, 480, 300, 2)).toEqual({ x: 20, y: 20 });
  });

  it('places the canvas on whole screen pixels on high-density screens', () => {
    expect(canvasOffset(861, 537, 480, 300, 1.5, 2)).toEqual({ x: 70.5, y: 43.5 });
    expect(canvasOffset(861, 537, 480, 300, 4 / 3, 1.5)).toEqual({ x: 110, y: 68 });
  });

  it('allows for a frame that itself starts between screen pixels', () => {
    // A frame at 151 CSS px on a 150% screen starts at 226.5 screen pixels; the canvas must still start on a whole one.
    const origin = { x: 151, y: 171 };
    const offset = canvasOffset(860, 536, 480, 300, 4 / 3, 1.5, origin);
    for (const [start, at] of [[origin.x, offset.x], [origin.y, offset.y]]) {
      expect(Number.isInteger(Math.round((start + at) * 1.5 * 1e6) / 1e6)).toBe(true);
      expect(Math.abs(at - (start === origin.x ? 110 : 68))).toBeLessThan(1);
    }
  });
});

describe('crisp sizes on high-density screens', () => {
  it('draws a 1920x1200 laptop at 150% at two screen pixels per art pixel, not at 1x', () => {
    const scale = displayScale(860, 536, 1.5);
    expect(scale).toBeCloseTo(4 / 3, 10);
    expect(canvasDisplaySize(480, 300, scale, 1.5)).toEqual({ width: 640, height: 400 });
  });

  it('draws a 2x screen too small for 2x at three screen pixels per art pixel', () => {
    expect(displayScale(860, 536, 2)).toBe(1.5);
    expect(canvasDisplaySize(480, 300, 1.5, 2)).toEqual({ width: 720, height: 450 });
  });

  it('keeps the whole-number size where it is bigger, and ordinary screens as they were', () => {
    expect(displayScale(1116, 696, 1.25)).toBe(2);
    expect(displayScale(1480, 924, 1.5)).toBe(3);
    expect(displayScale(860, 536, 1)).toBe(1);
    expect(displayScale(860, 536)).toBe(1);
    expect(displayScale(400, 250, 2)).toBe(1);
  });

  it('sizes the canvas on whole CSS pixels at whole-number scales', () => {
    expect(canvasDisplaySize(480, 300, 2, 1)).toEqual({ width: 960, height: 600 });
  });
});

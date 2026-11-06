import { describe, expect, it } from 'vitest';
import { displayScale, canvasOffset, canvasDisplaySize, canvasLayout, portraitViewport } from '../src/scene/pixelScale';

describe('pixel canvas scale', () => {
  it('uses whole-number desktop magnification and centers spare space', () => {
    expect(displayScale(1000, 640)).toBe(2);
    expect(displayScale(1440, 900)).toBe(3);
  });

  it('uses one art pixel per screen pixel on compact frames', () => {
    expect(displayScale(390, 244)).toBe(1);
    expect(displayScale(480, 300)).toBe(1);
    expect(displayScale(799, 500)).toBe(1);
    expect(displayScale(800, 500)).toBe(2);
    expect(canvasLayout(350, 219).viewport).toEqual({ width: 350, height: 219 });
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
  it('draws a 1920x1200 laptop at 150% at three screen pixels per art pixel', () => {
    const scale = displayScale(860, 536, 1.5);
    expect(scale).toBe(2);
    expect(canvasDisplaySize(430, 268, scale, 1.5)).toEqual({ width: 860, height: 536 });
  });

  it('takes a size between whole numbers where it lands on whole screen pixels', () => {
    expect(displayScale(1116, 696, 1.25)).toBeCloseTo(2.4, 10);
    expect(displayScale(1480, 924, 1.5)).toBeCloseTo(10 / 3, 10);
    expect(displayScale(800, 500, 2)).toBe(2);
    expect(displayScale(700, 437, 2)).toBe(1.5);
  });

  it('keeps ordinary screens to whole numbers', () => {
    expect(displayScale(860, 536, 1)).toBe(2);
    expect(displayScale(860, 536)).toBe(2);
    expect(displayScale(400, 250, 2)).toBe(1);
  });

  it('sizes the canvas on whole CSS pixels at whole-number scales', () => {
    expect(canvasDisplaySize(480, 300, 2, 1)).toEqual({ width: 960, height: 600 });
  });
});

describe('laying out the canvas in its frame', () => {
  it('lays a 1920x1200 laptop at 150% out crisp and centred on whole screen pixels', () => {
    const layout = canvasLayout(860, 536, 1.5, { x: 151, y: 171 });
    expect(layout.scale).toBe(2);
    expect(layout.viewport).toEqual({ width: 430, height: 268 });
    expect(layout.size).toEqual({ width: 860, height: 536 });
    expect(layout.offset).toEqual(canvasOffset(860, 536, 430, 268, layout.scale, 1.5, { x: 151, y: 171 }));
  });

  it('shows less of the world in a compact frame at 1x', () => {
    expect(canvasLayout(350, 219)).toEqual({ scale: 1, viewport: { width: 350, height: 219 }, size: { width: 350, height: 219 }, offset: { x: 0, y: 0 } });
  });

  it('fills a portrait phone frame with magnified art', () => {
    const layout = canvasLayout(390, 679, 3);
    expect([layout.scale, layout.viewport]).toEqual([2, { width: 195, height: 339 }]);
    expect(layout.size).toEqual({ width: 390, height: 678 });
  });

  it('centres the sliver a whole-number scale leaves over', () => {
    expect(canvasLayout(1001, 641)).toEqual({ scale: 2, viewport: { width: 500, height: 320 }, size: { width: 1000, height: 640 }, offset: { x: 0, y: 0 } });
  });
});

describe('filling the frame', () => {
  it('fills a desktop frame at the largest crisp scale, with no border', () => {
    const layout = canvasLayout(860, 536);
    expect(layout.scale).toBe(2);
    expect(layout.viewport).toEqual({ width: 430, height: 268 });
    expect(layout.size).toEqual({ width: 860, height: 536 });
    expect(layout.offset).toEqual({ x: 0, y: 0 });
  });

  it.each([[800, 500], [860, 536], [1000, 640], [1100, 688], [1440, 900], [1920, 1200], [2560, 1600]])('leaves no more than a sliver of a %i x %i frame', (width, height) => {
    const { size } = canvasLayout(width, height);
    expect(width - size.width).toBeLessThan(canvasLayout(width, height).scale);
    expect(height - size.height).toBeLessThan(canvasLayout(width, height).scale);
  });

  it.each([[800, 500], [860, 536], [1000, 640], [1440, 900], [1920, 1200], [2560, 1600]])('always shows a good stretch of the world in a %i x %i frame', (width, height) => {
    const { viewport } = canvasLayout(width, height);
    expect(viewport.width).toBeGreaterThanOrEqual(400);
    expect(viewport.height).toBeGreaterThanOrEqual(250);
  });

  it('shows more of the world, up to all of it, when a small frame cannot magnify', () => {
    expect(canvasLayout(700, 437).viewport).toEqual({ width: 640, height: 437 });
    expect(canvasLayout(700, 437).scale).toBe(1);
    expect(canvasLayout(390, 244).viewport).toEqual({ width: 390, height: 244 });
  });

  it('never shows past the edge of the map', () => {
    expect(canvasLayout(799, 490).viewport.width).toBeLessThanOrEqual(640);
    expect(canvasLayout(760, 600).viewport.height).toBeLessThanOrEqual(480);
  });

  it('fills a frame on a high-density screen with a scale that lands on whole screen pixels', () => {
    const { scale, viewport, size } = canvasLayout(860, 536, 1.5);
    expect(scale).toBe(2);
    expect(viewport).toEqual({ width: 430, height: 268 });
    expect(size).toEqual({ width: 860, height: 536 });
    const fine = canvasLayout(1000, 625, 1.5);
    expect(fine.scale * 1.5).toBe(Math.round(fine.scale * 1.5));
    expect(1000 - fine.size.width).toBeLessThan(fine.scale);
  });

  it('leaves phone portrait frames as they were', () => {
    expect(canvasLayout(390, 679).viewport).toEqual({ width: 195, height: 339 });
    expect(canvasLayout(390, 679).scale).toBe(2);
  });

  it('fills a phone on its side', () => {
    const { viewport, scale } = canvasLayout(844, 300);
    expect([scale, viewport.width, viewport.height]).toEqual([1, 640, 300]);
  });
});


import { describe, expect, it } from 'vitest';
import type { Season } from '../src/game/calendar';
import { APPLE_COLOR, CLIFF_SHADES, SAIL_COLOR, movingRects, pictureFit, stillRects, viewLine, type PictureRect } from '../src/scene/keepViewArt';
import type { CampView } from '../src/scene/keepViewCamp';

const SEASONS: readonly Season[] = ['autumn', 'winter', 'spring', 'summer'];
const bare: CampView = {
  clearingRadius: 15, shelter: 'none', campfire: true, house: false, beds: false, well: false, workshop: false, field: false, windmill: false, bakery: false, sheep: 0, orchard: null
};
const grownTree = { stage: 'grown', apples: false } as const;
const full: CampView = {
  clearingRadius: 30, shelter: 'woodshed', campfire: false, house: true, beds: true, well: true, workshop: true, field: true, windmill: true, bakery: true, sheep: 3, orchard: [grownTree, grownTree, grownTree, grownTree, grownTree, grownTree]
};
const key = (rect: PictureRect): string => `${rect.x},${rect.y},${rect.w},${rect.h},${rect.color}`;
const added = (rects: PictureRect[], base: PictureRect[]): PictureRect[] => {
  const known = new Set(base.map(key));
  return rects.filter(rect => !known.has(key(rect)));
};
const everything = (season: Season, camp: CampView, tick = 0): PictureRect[] => [...stillRects(season, camp), ...movingRects(season, camp, tick)];
const FRAMES = [[480, 300], [640, 480], [640, 300], [195, 339], [180, 340], [320, 568]] as const;

describe('the picture', () => {
  it('each season paints differently', () => {
    const painted = SEASONS.map(season => JSON.stringify(stillRects(season, full)));
    expect(new Set(painted).size).toBe(4);
  });

  it('the same inputs always paint the same picture', () => {
    expect(stillRects('winter', full)).toEqual(stillRects('winter', full));
    expect(movingRects('winter', full, 7)).toEqual(movingRects('winter', full, 7));
  });

  it.each<[string, Partial<CampView>]>([
    ['a wider clearing', { clearingRadius: 30 }], ['the shelter', { shelter: 'shelter' }], ['the woodshed', { shelter: 'woodshed', campfire: false }], ['the house', { house: true, campfire: false }],
    ['the beds', { beds: true }], ['the well', { well: true }], ['the workshop', { workshop: true }], ['the field', { field: true }], ['the windmill', { windmill: true }],
    ['the bakery', { bakery: true }], ['the sheep', { sheep: 3 }], ['the orchard', { orchard: [{ stage: 'sprout', apples: false }, grownTree] }]
  ])('%s adds to the picture, only around the camp', (_name, change) => {
    const fresh = added(everything('spring', { ...bare, ...change }), everything('spring', bare));
    expect(fresh.length).toBeGreaterThan(0);
    for (const rect of fresh) {
      expect(rect.x).toBeGreaterThanOrEqual(85);
      expect(rect.x + rect.w).toBeLessThanOrEqual(155);
      expect(rect.y).toBeGreaterThanOrEqual(65);
      expect(rect.y + rect.h).toBeLessThanOrEqual(120);
    }
  });

  it('an unbuilt windmill turns nothing, and a built one turns', () => {
    const sails = (camp: CampView, tick: number): PictureRect[] => movingRects('summer', camp, tick).filter(rect => rect.color === SAIL_COLOR);
    expect(sails(bare, 0)).toEqual([]);
    expect(sails(bare, 5)).toEqual([]);
    const windy = { ...bare, windmill: true };
    expect(sails(windy, 0).length).toBeGreaterThan(0);
    expect(sails(windy, 5)).not.toEqual(sails(windy, 0));
  });

  it('shows apples only on trees that have them', () => {
    const apples = (camp: CampView): PictureRect[] => stillRects('autumn', camp).filter(rect => rect.color === APPLE_COLOR);
    expect(apples({ ...bare, orchard: [grownTree] })).toEqual([]);
    expect(apples({ ...bare, orchard: [{ ...grownTree, apples: true }] }).length).toBeGreaterThan(0);
  });

  it('in winter the roofs, sheep and sails stand out from the snowy clearing', () => {
    const luminance = (color: string): number => [1, 3, 5].reduce((sum, at, i) => sum + [0.2126, 0.7152, 0.0722][i] * Number.parseInt(color.slice(at, at + 2), 16) / 255, 0);
    const wide = { ...bare, clearingRadius: 30 };
    const clearing = added(stillRects('winter', wide), stillRects('winter', bare))[0].color;
    const roof = added(stillRects('winter', { ...wide, workshop: true }), stillRects('winter', wide)).find(rect => rect.h === 1)!.color;
    const sheep = added(movingRects('winter', { ...wide, sheep: 1 }, 0), movingRects('winter', wide, 0))[0].color;
    for (const color of [roof, sheep, SAIL_COLOR]) expect(luminance(color) - luminance(clearing)).toBeGreaterThan(0.08);
  });

  it('snow lies on the well in winter, like the other roofs', () => {
    const fresh = (season: Season): string[] => added(stillRects(season, { ...bare, well: true }), stillRects(season, bare)).map(rect => rect.color);
    const snowRoof = added(stillRects('winter', { ...bare, workshop: true }), stillRects('winter', bare)).find(rect => rect.h === 1)!.color;
    expect(fresh('winter')).toContain(snowRoof);
    expect(fresh('summer')).not.toContain(snowRoof);
  });

  it('only a tree old enough to blossom is pink in spring', () => {
    const colors = (stage: 'sprout' | 'sapling' | 'young'): string[] => added(stillRects('spring', { ...bare, orchard: [{ stage, apples: false }] }), stillRects('spring', bare)).map(rect => rect.color);
    const blossom = colors('young')[0];
    expect(colors('sprout')).not.toContain(blossom);
    expect(colors('sapling')).not.toContain(blossom);
  });

  it('the quarry cliff has a broken, lopsided top rather than a neat roof', () => {
    const tops = new Map<number, number>();
    for (const rect of stillRects('summer', bare)) {
      if (!CLIFF_SHADES.includes(rect.color)) continue;
      for (let x = rect.x; x < rect.x + rect.w; x++) tops.set(x, Math.min(tops.get(x) ?? Infinity, rect.y));
    }
    const skyline = [...tops.entries()].sort(([a], [b]) => a - b).map(([, y]) => y);
    expect(new Set(skyline).size).toBeGreaterThanOrEqual(6);
    expect(skyline).not.toEqual([...skyline].reverse());
    expect(skyline.indexOf(Math.min(...skyline))).toBeLessThan(skyline.length / 2 - 4);
  });

  it('each stage of a tree looks different', () => {
    const stages = (['sprout', 'sapling', 'young', 'grown'] as const).map(stage => JSON.stringify(added(stillRects('summer', { ...bare, orchard: [{ stage, apples: false }] }), stillRects('summer', bare))));
    expect(new Set(stages).size).toBe(4);
  });

  it('summer has nothing falling, and winter has the most', () => {
    const counts = Object.fromEntries(SEASONS.map(season => [season, movingRects(season, bare, 3).length]));
    expect(counts.summer).toBeLessThan(counts.autumn);
    expect(counts.summer).toBeLessThan(counts.spring);
    expect(counts.winter).toBeGreaterThan(counts.autumn);
    expect(counts.winter).toBeGreaterThan(counts.spring);
  });

  it('every rectangle has whole pixels', () => {
    for (const rect of everything('winter', full, 11)) {
      for (const value of [rect.x, rect.y, rect.w, rect.h]) expect(Number.isInteger(value)).toBe(true);
    }
  });

  it.each<[Season, string]>([
    ['autumn', 'From the top of the keep, the woods have all turned.'],
    ['winter', 'Snow as far as I can see from the top of the keep.'],
    ['spring', 'From the top of the keep, the gorse is out all the way down.'],
    ['summer', 'Heather as far as I can see from the top of the keep.']
  ])('in %s the line uses the journal\'s words', (season, line) => {
    expect(viewLine(season)).toBe(line);
  });
});

describe('how the picture fits the frame', () => {
  it.each(FRAMES)('it fills a %i by %i frame', (w, h) => {
    const { scale, x, y } = pictureFit(w, h);
    expect(scale * 320).toBeGreaterThanOrEqual(w);
    expect(scale * 200).toBeGreaterThanOrEqual(h);
    expect(x).toBeLessThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(0);
    expect(x + 320 * scale).toBeGreaterThanOrEqual(w);
    expect(y + 200 * scale).toBeGreaterThanOrEqual(h);
  });

  it.each(FRAMES)('the camp stays in view in a %i by %i frame', (w, h) => {
    const { scale, x, y } = pictureFit(w, h);
    expect(x + 85 * scale).toBeGreaterThanOrEqual(0);
    expect(x + 155 * scale).toBeLessThanOrEqual(w);
    expect(y + 85 * scale).toBeGreaterThanOrEqual(0);
    expect(y + 120 * scale).toBeLessThanOrEqual(h);
  });

  it.each(FRAMES)('the battlements stay along the bottom of a %i by %i frame', (w, h) => {
    const { scale, y } = pictureFit(w, h);
    expect(y + 200 * scale).toBeCloseTo(h);
  });
});

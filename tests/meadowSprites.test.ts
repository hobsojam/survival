import { describe, expect, it } from 'vitest';
import { meadowSprites } from '../src/art/meadowSprites';
import { sprites } from '../src/art/sprites';
import { townSprites } from '../src/art/townSprites';
import { BRIDGE_SITE } from '../src/game/bridgeSites';
import { emptyRoad, type RoadState } from '../src/game/meadow';
import { MILESTONE_SITE, ROAD_SPOTS } from '../src/game/roadSites';
import type { GameState } from '../src/game/state';
import { HOUSE_PLOTS } from '../src/game/townSites';
import { MEADOW_PATHS, pathDistance } from '../src/scene/mapGeometry';
import { sceneVisuals } from '../src/scene/visuals';
import { finishedCastleCamp, street } from './townStreet';

// EASTER EGG: the town, see src/game/town.ts. The bridge, the meadow's road and its milestone as they are drawn.

const built = (doneDay: number) => ({ stone: 30, beams: 4, fittings: 1, doneDay });
const DONE = { stone: 50, beams: 4, fittings: 2, doneDays: { piers: 40, arch: 45, parapet: 50 } };
const SUMMER = 75;
const WINTER = 53;

/** Eight houses on a summer day in the given area, with the bridge and the road as given. */
const at = (area: 'hills' | 'meadow' | 'camp' | 'quarry', bridge: Partial<GameState['town']['bridge']> = {}, road: Partial<RoadState> = {}, day = SUMMER): GameState => {
  const state = finishedCastleCamp();
  state.day = day;
  state.area = area;
  state.town.houses = street(...Array.from({ length: 8 }, (_, i) => built(20 + i)));
  state.town.bridge = { stone: 0, beams: 0, fittings: 0, doneDays: {}, ...bridge };
  state.town.road = { ...emptyRoad(), ...road };
  return state;
};
const drawn = (state: GameState, prefix: RegExp) => Object.fromEntries(sceneVisuals(state, 0).filter(visual => prefix.test(visual.id)).map(visual => [visual.id, visual.texture]));

describe('drawing the bridge', () => {
  it('draws nothing before the first stone, then each stage as it goes up', () => {
    expect(drawn(at('hills'), /^bridge$/)).toEqual({});
    expect(drawn(at('hills', { stone: 3 }), /^bridge$/)).toEqual({ bridge: 'townBridge:piers' });
    expect(drawn(at('hills', { stone: 24, beams: 2, doneDays: { piers: 40 } }), /^bridge$/)).toEqual({ bridge: 'townBridge:arch' });
    expect(drawn(at('hills', { stone: 42, beams: 4, doneDays: { piers: 40, arch: 45 } }), /^bridge$/)).toEqual({ bridge: 'townBridge:deck' });
    expect(drawn(at('hills', DONE), /^bridge$/)).toEqual({ bridge: 'townBridge:done' });
    expect(drawn(at('hills', DONE, {}, WINTER), /^bridge$/)).toEqual({ bridge: 'townBridge:dones' });
  });

  it('stands only on the hills', () => {
    for (const area of ['meadow', 'camp', 'quarry'] as const) expect(drawn(at(area, DONE), /^bridge$/)).toEqual({});
  });
});

describe('drawing the meadow', () => {
  it('covers each uncleared stretch of the road in bracken, thinner while it is being cleared, and shows the road once clear', () => {
    expect(drawn(at('meadow', DONE), /^road-/)).toEqual(Object.fromEntries(ROAD_SPOTS.map((_, i) => [`road-${i}`, 'roadBrush:wild'])));
    const partly = drawn(at('meadow', DONE, { cleared: 1, work: 2 }), /^road-/);
    expect(partly['road-3']).toBeUndefined();
    expect(partly['road-4']).toBe('roadBrush:half');
    expect(partly['road-2']).toBe('roadBrush:wild');
    expect(drawn(at('meadow', DONE, { cleared: 6, doneDays: { road: 52 } }), /^road-/)).toEqual({});
    expect(drawn(at('meadow', DONE, {}, WINTER), /^road-0$/)).toEqual({ 'road-0': 'roadBrush:wilds' });
  });

  it('raises the milestone once its first stone is set', () => {
    const road = { cleared: 6, doneDays: { road: 52 } };
    expect(drawn(at('meadow', DONE, road), /^milestone$/)).toEqual({});
    expect(drawn(at('meadow', DONE, { ...road, milestone: 2 }), /^milestone$/)).toEqual({ milestone: 'milestone:low' });
    expect(drawn(at('meadow', DONE, { ...road, milestone: 6, doneDays: { road: 52, milestone: 55 } }), /^milestone$/)).toEqual({ milestone: 'milestone:done' });
  });

  it('draws the meadow\'s houses there and nowhere else', () => {
    const state = at('meadow', DONE);
    state.town.houses = street(...Array.from({ length: 12 }, (_, i) => built(20 + i)), { stone: 12, beams: 0, fittings: 0, doneDay: null });
    expect(drawn(state, /^town-house-/)).toEqual({ 'town-house-12': 'townHouse:1' });
    expect(drawn({ ...state, area: 'hills' }, /^town-house-12$/)).toEqual({});
    expect(drawn({ ...state, area: 'hills' }, /^(road-|milestone)/)).toEqual({});
  });
});

describe('the meadow\'s pictures', () => {
  it('has every frame it draws, at its size, and registered with the rest', () => {
    expect(meadowSprites.townBridge.size).toEqual([56, 40]);
    expect(meadowSprites.townBridge.anchor).toEqual([28, 30]);
    expect(meadowSprites.roadBrush.size).toEqual([104, 24]);
    expect(meadowSprites.milestone.size).toEqual([12, 20]);
    for (const frame of ['piers', 'arch', 'deck', 'done']) for (const snow of ['', 's']) expect(meadowSprites.townBridge.frames).toHaveProperty(frame + snow);
    for (const frame of ['wild', 'half', 'wilds', 'halfs']) expect(meadowSprites.roadBrush.frames).toHaveProperty(frame);
    for (const frame of ['low', 'done', 'lows', 'dones']) expect(meadowSprites.milestone.frames).toHaveProperty(frame);
    expect(sprites.townBridge).toBe(meadowSprites.townBridge);
  });

  it('keeps the meadow\'s houses, the milestone and the lane off each other', () => {
    const box = (spot: { x: number; y: number }, def: { anchor: number[]; size: number[] }) => {
      const left = Math.round((spot.x + 0.5) * 16) - def.anchor[0];
      const top = Math.round((spot.y + 0.5) * 16) - def.anchor[1];
      return { left, top, right: left + def.size[0], bottom: top + def.size[1] };
    };
    const overlap = (a: ReturnType<typeof box>, b: ReturnType<typeof box>) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const lane = { left: 25 * 16, top: 0, right: 26 * 16, bottom: 19 * 16 };
    const pieces = [...HOUSE_PLOTS.filter(plot => plot.area === 'meadow').map(plot => box(plot, townSprites.townHouse)), box(MILESTONE_SITE, meadowSprites.milestone)];
    pieces.forEach((a, i) => {
      expect(overlap(a, lane), `${i}`).toBe(false);
      pieces.forEach((b, j) => { if (i < j) expect(overlap(a, b), `${i} ${j}`).toBe(false); });
    });
    expect(pathDistance(MILESTONE_SITE.x + 0.5, MILESTONE_SITE.y + 0.5, MEADOW_PATHS)).toBeGreaterThanOrEqual(1);
  });

  it('keeps the bridge inside the hills and off their houses', () => {
    const left = Math.round((BRIDGE_SITE.x + 0.5) * 16) - 28;
    const top = Math.round((BRIDGE_SITE.y + 0.5) * 16) - 30;
    expect(left >= 0 && top + 40 <= 30 * 16).toBe(true);
    for (const plot of HOUSE_PLOTS.filter(each => each.area === 'hills')) {
      const house = { left: Math.round((plot.x + 0.5) * 16) - townSprites.townHouse.anchor[0], top: Math.round((plot.y + 0.5) * 16) - townSprites.townHouse.anchor[1] };
      const apart = house.left + 36 <= left || left + 56 <= house.left || house.top + 38 <= top || top + 40 <= house.top;
      expect(apart, `${plot.x},${plot.y}`).toBe(true);
    }
  });
});

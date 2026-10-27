import { describe, expect, it } from 'vitest';
import { createGame } from '../src/game/state';
import { palette } from '../src/art/palette';
import { nightStart } from '../src/game/calendar';
import { darkness } from '../src/scene/ambient';
import { fireGlow, fireRadii, lightMaskPixels, lightScreenPosition, lightingTint } from '../src/scene/lighting';

const rgb = (hex: string) => parseInt(hex.slice(1), 16);
// Day 6 is mid-autumn, when night falls at 160 s.
const state = { ...createGame(), day: 6 };

describe('time-of-day lighting', () => {
  it('has no day tint and warms the last thirty seconds before night', () => {
    expect(lightingTint({ ...state, timeOfDay: 60 })).toEqual({ color: rgb(palette.dusk), alpha: 0 });
    expect(lightingTint({ ...state, timeOfDay: 145 }).color).toBe(rgb(palette.dusk));
    expect(lightingTint({ ...state, timeOfDay: 145 }).alpha).toBeCloseTo(0.06);
    expect(lightingTint({ ...state, timeOfDay: 160 })).toEqual({ color: rgb(palette.night), alpha: 0 });
  });

  it('reaches 55% at ordinary night and 64% during a cold front', () => {
    expect(lightingTint({ ...state, timeOfDay: 190 })).toEqual({ color: rgb(palette.night), alpha: 0.55 });
    const storm = { ...state, day: 3, timeOfDay: 204, progress: { ...state.progress, nextStormDay: 3 } };
    expect(lightingTint(storm)).toEqual({ color: rgb(palette.storm), alpha: 0.64 });
  });

  it('passes through a 15% dawn tint and clears by second 25', () => {
    expect(lightingTint({ ...state, day: 2, timeOfDay: 0 })).toEqual({ color: rgb(palette.night), alpha: 0.55 });
    expect(lightingTint({ ...state, day: 2, timeOfDay: 12.5 }).color).toBe(rgb(palette.dawn));
    expect(lightingTint({ ...state, day: 2, timeOfDay: 12.5 }).alpha).toBeCloseTo(0.15);
    expect(lightingTint({ ...state, day: 2, timeOfDay: 25 })).toEqual({ color: rgb(palette.dusk), alpha: 0 });
  });
});

describe('stepped light masks', () => {
  it('grows with fuel, adds one pixel per hearth band, and flickers on the flame cycle', () => {
    expect(fireRadii(0, false, 0)).toBeNull();
    const full = fireRadii(60, false, 0)!;
    expect(fireRadii(100, false, 0)).toEqual(full);
    const low = fireRadii(1, false, 0)!;
    expect(low.outer).toBeLessThan(full.outer);
    expect(low.inner).toBeLessThan(full.inner);
    const hearth = fireRadii(60, true, 0)!;
    expect(hearth).toEqual({ inner: full.inner + 1, middle: full.middle + 1, outer: full.outer + 1 });
    expect(fireRadii(60, false, 180)!.outer).toBe(full.outer + 1);
    expect(fireRadii(60, false, 540)!.outer).toBe(full.outer - 1);
  });

  it('makes three hard-edged alpha bands with transparent outside pixels', () => {
    const mask = lightMaskPixels({ inner: 2, middle: 4, outer: 6 });
    expect(mask.size).toBe(13);
    const alpha = (x: number, y: number) => mask.pixels[(y * mask.size + x) * 4 + 3];
    expect(alpha(6, 6)).toBe(255);
    expect(alpha(9, 6)).toBe(153);
    expect(alpha(11, 6)).toBe(77);
    expect(alpha(0, 0)).toBe(0);
  });

  it('snaps moving world lights to whole screen pixels', () => {
    expect(lightScreenPosition(328, 248, 84.6, 97.4)).toEqual({ x: 243, y: 151 });
  });
});

describe('fire glow by area', () => {
  it('glows at camp while the fire burns, and never in the quarry area', () => {
    const lit = { ...state, fireFuel: 40 };
    expect(fireGlow(lit, 0)).toEqual(fireRadii(40, false, 0));
    expect(fireGlow({ ...lit, fireFuel: 0 }, 0)).toBeNull();
    expect(fireGlow({ ...lit, area: 'quarry' }, 0)).toBeNull();
  });
});

describe('lighting through the year', () => {
  it('darkens early in midwinter and holds the dusk late in midsummer', () => {
    // Night has fallen by 135 s in midwinter, and winter nights take the bitter tint.
    expect(lightingTint({ ...state, day: 16, timeOfDay: 135 }).color).toBe(rgb(palette.storm));
    const summer = lightingTint({ ...state, day: 36, timeOfDay: 165 });
    expect(summer.color).toBe(rgb(palette.golden));
    expect(summer.alpha).toBeCloseTo(0.16 * 20 / 45);
  });
});

describe('winter night tint', () => {
  it('tints every winter night like the cold front, and autumn nights as plain night', () => {
    const base = createGame();
    const winter = { ...base, day: 12, timeOfDay: nightStart(12) + 15, progress: { ...base.progress, hearthUnlocked: true, nextStormDay: null } };
    expect(lightingTint(winter)).toEqual({ color: rgb(palette.storm), alpha: darkness(12, nightStart(12) + 15) * 0.64 });
    const autumn = { ...winter, day: 8, timeOfDay: nightStart(8) + 15 };
    expect(lightingTint(autumn)).toEqual({ color: rgb(palette.night), alpha: darkness(8, nightStart(8) + 15) * 0.55 });
  });
});

describe('rain tint', () => {
  it('greys the day while it rains', () => {
    const base = createGame();
    expect(lightingTint({ ...base, day: 22, timeOfDay: 40 })).toEqual({ color: rgb(palette.storm), alpha: 0.18 });
    expect(lightingTint({ ...base, day: 22, timeOfDay: 80 }).alpha).toBe(0);
  });
});

describe('summer evenings', () => {
  const base = createGame();
  const at = (day: number, beforeNight: number) => lightingTint({ ...base, day, timeOfDay: nightStart(day) - beforeNight });

  it('glows gold for longer on a summer evening', () => {
    expect(at(34, 40).color).toBe(rgb(palette.golden));
    expect(at(34, 40).alpha).toBeGreaterThan(0);
    expect(at(34, 1).alpha).toBeCloseTo(0.16 * 44 / 45);
  });

  it('keeps the other seasons\' short orange dusk', () => {
    expect(at(24, 40).alpha).toBe(0);
    expect(at(24, 1).color).toBe(rgb(palette.dusk));
  });
});

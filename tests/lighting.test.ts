import { describe, expect, it } from 'vitest';
import { createGame } from '../src/game/state';
import { palette } from '../src/art/palette';
import { nightStart } from '../src/game/calendar';
import { darkness } from '../src/scene/ambient';
import { ICY_NIGHT, SUNRISE_MS, fireGlow, fireRadii, lightMaskPixels, lightScreenPosition, lightingTint, withSunrise } from '../src/scene/lighting';
import { afternoonStart } from '../src/game/calendar';

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

  it('reaches 55% at ordinary night and 64% during a cold night', () => {
    expect(lightingTint({ ...state, timeOfDay: 190 })).toEqual({ color: rgb(palette.night), alpha: 0.55 });
    const storm = { ...state, day: 3, timeOfDay: 204, progress: { ...state.progress, nextStormDay: 3 } };
    expect(lightingTint(storm)).toEqual({ color: ICY_NIGHT, alpha: 0.64 });
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
    expect(lightingTint({ ...state, day: 16, timeOfDay: 135 }).color).toBe(ICY_NIGHT);
    const summer = lightingTint({ ...state, day: 36, timeOfDay: 165 });
    expect(summer.color).toBe(rgb(palette.golden));
    expect(summer.alpha).toBeCloseTo(0.16 * 20 / 45);
  });
});

describe('winter night tint', () => {
  it('tints every winter night like the cold night, and autumn nights as plain night', () => {
    const base = createGame();
    const winter = { ...base, day: 12, timeOfDay: nightStart(12) + 15, progress: { ...base.progress, hearthUnlocked: true, nextStormDay: null } };
    expect(lightingTint(winter)).toEqual({ color: ICY_NIGHT, alpha: darkness(12, nightStart(12) + 15) * 0.64 });
    const autumn = { ...winter, day: 8, timeOfDay: nightStart(8) + 15 };
    expect(lightingTint(autumn)).toEqual({ color: rgb(palette.night), alpha: darkness(8, nightStart(8) + 15) * 0.55 });
  });
});

describe('the cold night look', () => {
  const channels = (value: number) => [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  const base = createGame();
  const coldDay = (timeOfDay: number) => ({ ...base, day: 3, timeOfDay, progress: { ...base.progress, nextStormDay: 3 } });

  it('tints a freezing night a deep icy blue: still dark, but bluer than an ordinary night', () => {
    const [r, g, b] = channels(ICY_NIGHT);
    const [nr, , nb] = channels(rgb(palette.night));
    expect(r + g + b).toBeLessThan(300);
    expect(b - r).toBeGreaterThan(nb - nr + 20);
  });

  it('turns the dusk icy on the cold night\'s day instead of gold', () => {
    const late = lightingTint(coldDay(nightStart(3) - 1));
    expect(late.color).not.toBe(rgb(palette.dusk));
    const [r, , b] = channels(late.color);
    expect(b).toBeGreaterThan(r + 40);
    // A third of the way in, it is already blue rather than a muddy grey.
    const early = lightingTint(coldDay(afternoonStart(3) + (nightStart(3) - afternoonStart(3)) / 3));
    expect(channels(early.color)[2]).toBeGreaterThan(channels(early.color)[0] + 40);
    expect(late.alpha).toBeGreaterThanOrEqual(0.25);
    // Before the afternoon turns, the day looks like any other.
    expect(lightingTint(coldDay(afternoonStart(3) - 1))).toEqual(lightingTint({ ...base, day: 3, timeOfDay: afternoonStart(3) - 1 }));
  });

  it('warms the morning after the fire held, then fades back to the plain day', () => {
    const day = { color: rgb(palette.dusk), alpha: 0 };
    const fresh = withSunrise(day, 0);
    expect(fresh.color).toBe(rgb(palette.golden));
    expect(fresh.alpha).toBeGreaterThanOrEqual(0.2);
    expect(withSunrise(day, SUNRISE_MS / 2).alpha).toBeGreaterThan(0);
    expect(withSunrise(day, SUNRISE_MS / 2).alpha).toBeLessThan(fresh.alpha);
    expect(withSunrise(day, SUNRISE_MS)).toEqual(day);
  });
});

describe('rain tint', () => {
  const base = createGame();
  it('greys the day while it rains', () => {
    expect(lightingTint({ ...base, day: 22, timeOfDay: 40 })).toEqual({ color: rgb(palette.storm), alpha: 0.18 });
    expect(lightingTint({ ...base, day: 22, timeOfDay: 80 }).alpha).toBe(0);
  });

  it('fades in as a shower starts and out as it ends', () => {
    // Day 22's shower runs from 30 s to 76 s.
    expect(lightingTint({ ...base, day: 22, timeOfDay: 32 }).alpha).toBeCloseTo(0.09);
    expect(lightingTint({ ...base, day: 22, timeOfDay: 74 }).alpha).toBeCloseTo(0.09);
    expect(lightingTint({ ...base, day: 22, timeOfDay: 29 }).alpha).toBe(0);
  });

  it('lets a late shower give way to the dusk glow', () => {
    // Day 61's shower runs from 63 s to 118 s, and its dusk begins at 109 s.
    const dusk = (time: number) => lightingTint({ ...base, day: 61, timeOfDay: time });
    expect(dusk(112).alpha).toBeGreaterThan(0.12 * 3 / 30);
    expect(dusk(112).color).not.toBe(rgb(palette.storm));
    expect(dusk(118.01).color).toBe(rgb(palette.dusk));
    expect(Math.abs(dusk(117.9).alpha - dusk(118.01).alpha)).toBeLessThan(0.01);
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

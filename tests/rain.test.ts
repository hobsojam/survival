import { describe, expect, it } from 'vitest';
import { nightStart } from '../src/game/calendar';
import { BALANCE, createGame, type GameState } from '../src/game/state';
import { advanceTime } from '../src/game/rules';
import { isRaining, rainMessage, rainWindow } from '../src/game/rain';

describe('spring rain', () => {
  it('rains on a few spring days, for part of the day', () => {
    expect([22, 25, 30].map(rainWindow)).toEqual([{ start: 30, end: 76 }, { start: 63, end: 119 }, { start: 27, end: 68 }]);
    for (let day = 1; day <= 40; day++) if (![22, 25, 30].includes(day)) expect(rainWindow(day), `day ${day}`).toBeNull();
    let rainy = 0;
    for (let year = 0; year < 50; year++) for (let day = 21; day <= 30; day++) if (rainWindow(day + 40 * year)) rainy++;
    expect(rainy / 500).toBeGreaterThan(0.25);
    expect(rainy / 500).toBeLessThan(0.45);
  });

  it('ends every shower before nightfall', () => {
    for (let year = 0; year < 3; year++) for (let day = 21 + 40 * year; day <= 30 + 40 * year; day++) {
      const window = rainWindow(day);
      if (window) expect(window.end, `day ${day}`).toBeLessThanOrEqual(nightStart(day));
    }
  });

  it('knows when it is raining', () => {
    expect([29.9, 30, 75.9, 76].map(timeOfDay => isRaining({ day: 22, timeOfDay }))).toEqual([false, true, true, false]);
  });

  const base = createGame();
  const shower: GameState = { ...base, day: 22, timeOfDay: 40, fireFuel: 30,
    progress: { ...base.progress, hearthUnlocked: true, nextStormDay: null } };

  it('chills the survivor away from camp and hurries the fire', () => {
    const away = advanceTime({ ...shower, player: { ...shower.player, x: 5, y: 25, warmth: 80 } }, 10);
    expect(away.player.warmth).toBeCloseTo(75);
    expect(away.fireFuel).toBeCloseTo(15);
    const quarry = advanceTime({ ...shower, area: 'quarry', player: { ...shower.player, warmth: 80 } }, 10);
    expect(quarry.player.warmth).toBeCloseTo(75);
    const sheltered = advanceTime({ ...shower, fireFuel: 0, structures: { ...shower.structures, shelter: true }, player: { ...shower.player, warmth: 80 } }, 10);
    expect(sheltered.player.warmth).toBeCloseTo(81);
    const byFire = advanceTime({ ...shower, player: { ...shower.player, warmth: 80 } }, 10);
    expect(byFire.player.warmth).toBeCloseTo(85);
    const dry = advanceTime({ ...shower, day: 21, player: { ...shower.player, x: 5, y: 25, warmth: 80 } }, 10);
    expect(dry.player.warmth).toBeCloseTo(81);
    expect(dry.fireFuel).toBeCloseTo(20);
    expect(BALANCE.rainFireBurn).toBe(1.5);
  });

  it('announces the rain once', () => {
    const at = (timeOfDay: number) => ({ ...shower, timeOfDay });
    expect(rainMessage(at(29.5), at(30.5))).toBe('Rain is coming in.');
    expect(rainMessage(at(30.5), at(31.5))).toBeNull();
    expect(rainMessage(at(10), at(11))).toBeNull();
  });
});

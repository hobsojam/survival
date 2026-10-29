import { describe, expect, it } from 'vitest';
import { afternoonStart, nightStart } from '../src/game/calendar';
import { COLD_WARNING, coldNightApproach, coldNightMessage, coldNightWarning, dawnEffect } from '../src/game/coldNight';
import { createGame, type GameState } from '../src/game/state';

const base = createGame();
const on = (day: number, timeOfDay: number, progress: Partial<GameState['progress']> = {}): GameState =>
  ({ ...base, day, timeOfDay, progress: { ...base.progress, nextStormDay: 3, ...progress } });

describe('the cold night drawing in', () => {
  it('builds from mid-afternoon on its day and is full once night falls', () => {
    const from = afternoonStart(3), to = nightStart(3);
    expect(coldNightApproach(on(3, from - 1))).toBe(0);
    expect(coldNightApproach(on(3, (from + to) / 2))).toBeCloseTo(0.5);
    expect(coldNightApproach(on(3, to))).toBe(1);
    expect(coldNightApproach(on(3, to + 30))).toBe(1);
  });

  it('is nothing on other days, or once the cold night is weathered', () => {
    expect(coldNightApproach(on(2, nightStart(2)))).toBe(0);
    expect(coldNightApproach(on(3, nightStart(3), { nextStormDay: null, hearthUnlocked: true }))).toBe(0);
  });

  it('warns once, as the afternoon turns on the cold night\'s day', () => {
    const turn = afternoonStart(3);
    expect(coldNightWarning(on(3, turn - 0.1), on(3, turn + 0.1))).toBe(COLD_WARNING);
    expect(coldNightWarning(on(3, turn + 0.1), on(3, turn + 0.2))).toBeNull();
    expect(coldNightWarning(on(2, afternoonStart(2) - 0.1), on(2, afternoonStart(2) + 0.1))).toBeNull();
  });
});

describe('the cold night\'s messages', () => {
  it('names the night as it falls', () => {
    expect(coldNightMessage(on(3, nightStart(3) - 0.1), on(3, nightStart(3) + 0.1))).toBe('The cold night is here. Keep the fire alive until dawn.');
  });

  it('says plainly at dawn whether the fire held', () => {
    const night = on(3, 239);
    expect(coldNightMessage(night, on(4, 0, { nextStormDay: null, hearthUnlocked: true })))
      .toBe('The fire held through the cold night. The stone hearth is now unlocked.');
    expect(coldNightMessage(night, on(4, 30, { nextStormDay: 6 })))
      .toBe('The fire went out in the night. Rest today; another cold night comes on day 6.');
  });

  it('says nothing on an ordinary evening', () => {
    expect(coldNightMessage(on(2, 100), on(2, 101))).toBeNull();
  });
});

describe('the dawn after the cold night', () => {
  it('breaks into a sunrise if the fire held, and frost if it went out', () => {
    const night = on(3, 239);
    expect(dawnEffect(night, on(4, 0, { nextStormDay: null, hearthUnlocked: true }))).toBe('sunrise');
    expect(dawnEffect(night, on(4, 30, { nextStormDay: 6 }))).toBe('frost');
    expect(dawnEffect(on(2, 239), on(3, 0))).toBeNull();
  });
});

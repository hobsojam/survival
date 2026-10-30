import { describe, expect, it } from 'vitest';
import { afternoonStart, nightStart } from '../src/game/calendar';
import { BALANCE, createGame } from '../src/game/state';
import { loadGame, saveGame } from '../src/game/save';
import { dayPhase, formatClock, nextChange } from '../src/game/clock';
import { advanceLiveTime } from '../src/game/rules';

describe('clock', () => {
  it('names the part of the day', () => {
    expect(dayPhase(0, 6)).toBe('Morning');
    expect(dayPhase(afternoonStart(6), 6)).toBe('Afternoon');
    expect(dayPhase(nightStart(6), 6)).toBe('Night');
    expect(dayPhase(BALANCE.daySeconds - 1, 6)).toBe('Night');
  });

  it('counts down to nightfall by day and to dawn by night', () => {
    expect(nextChange(0, 6)).toEqual({ event: 'Night', seconds: Math.ceil(nightStart(6) / BALANCE.clockRate) });
    expect(nextChange(100, 6)).toEqual({ event: 'Night', seconds: Math.ceil((nightStart(6) - 100) / BALANCE.clockRate) });
    expect(nextChange(nightStart(6), 6)).toEqual({ event: 'Dawn', seconds: Math.ceil((BALANCE.daySeconds - nightStart(6)) / BALANCE.clockRate) });
    expect(nextChange(BALANCE.daySeconds - 0.4, 6)).toEqual({ event: 'Dawn', seconds: 1 });
  });

  it('formats seconds as minutes and seconds', () => {
    expect(formatClock(160)).toBe('2:40');
    expect(formatClock(80)).toBe('1:20');
    expect(formatClock(5)).toBe('0:05');
  });
});

describe('the clock through the year', () => {
  it('names the part of the day from that day’s light', () => {
    expect(dayPhase(155, 16)).toBe('Night');
    expect(dayPhase(135, 36)).toBe('Afternoon');
    expect(dayPhase(100, 36)).toBe('Morning');
  });

  it('counts down to that day’s nightfall and dawn', () => {
    expect(nextChange(0, 36)).toEqual({ event: 'Night', seconds: 255 });
    expect(nextChange(149, 16)).toEqual({ event: 'Dawn', seconds: 126 });
  });

  it('reads a winter save from mid-evening as night', () => {
    const fresh = createGame();
    const state = { ...fresh, day: 16, timeOfDay: 155, progress: { ...fresh.progress, nextStormDay: 18 } };
    const saved = new Map<string, string>();
    const storage = { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => { saved.set(key, value); } } as Storage;
    saveGame(storage, state);
    const loaded = loadGame(storage);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind === 'loaded') expect(dayPhase(loaded.state.timeOfDay, loaded.state.day)).toBe('Night');
  });
});

describe('live clock pacing', () => {
  it('takes 330 real seconds to pass a 240-second game day', () => {
    const day = advanceLiveTime(createGame(), 330);
    expect(day.day).toBe(2);
    expect(day.timeOfDay).toBeCloseTo(0);
  });

  it('advances eight game seconds after eleven real seconds', () => {
    expect(advanceLiveTime(createGame(), 11).timeOfDay).toBeCloseTo(8);
  });
});

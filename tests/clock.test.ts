import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/game/state';
import { dayPhase, formatClock, nextChange } from '../src/game/clock';

describe('clock', () => {
  it('names the part of the day', () => {
    expect(dayPhase(0)).toBe('Morning');
    expect(dayPhase(BALANCE.afternoonStart)).toBe('Afternoon');
    expect(dayPhase(BALANCE.nightStart)).toBe('Night');
    expect(dayPhase(BALANCE.daySeconds - 1)).toBe('Night');
  });

  it('counts down to nightfall by day and to dawn by night', () => {
    expect(nextChange(0)).toEqual({ event: 'Night', seconds: BALANCE.nightStart });
    expect(nextChange(100)).toEqual({ event: 'Night', seconds: BALANCE.nightStart - 100 });
    expect(nextChange(BALANCE.nightStart)).toEqual({ event: 'Dawn', seconds: BALANCE.daySeconds - BALANCE.nightStart });
    expect(nextChange(BALANCE.daySeconds - 0.4)).toEqual({ event: 'Dawn', seconds: 1 });
  });

  it('formats seconds as minutes and seconds', () => {
    expect(formatClock(160)).toBe('2:40');
    expect(formatClock(80)).toBe('1:20');
    expect(formatClock(5)).toBe('0:05');
  });
});

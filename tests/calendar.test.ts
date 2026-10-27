import { describe, expect, it } from 'vitest';
import {
  afternoonStart, daysLeftInSeason, firefliesOut, isSpring, isSummer, isWinter, leavesFalling, nightStart, season, seasonMessage, seasonName
} from '../src/game/calendar';

describe('the seasonal calendar', () => {
  it('turns through ten-day seasons, starting in autumn, and repeats each forty days', () => {
    expect([1, 10, 11, 20, 21, 30, 31, 40, 41, 81].map(season))
      .toEqual(['autumn', 'autumn', 'winter', 'winter', 'spring', 'spring', 'summer', 'summer', 'autumn', 'autumn']);
    expect(seasonName('winter')).toBe('Winter');
  });

  it('counts the days left in the season', () => {
    expect([1, 10, 11, 45].map(daysLeftInSeason)).toEqual([10, 1, 10, 6]);
  });

  it('lets night fall earliest in midwinter and latest in midsummer', () => {
    expect([1, 6, 11, 16, 26, 36, 76].map(nightStart)).toEqual([181, 160, 139, 130, 160, 190, 190]);
    for (let day = 1; day <= 40; day++) {
      expect(nightStart(day)).toBeGreaterThanOrEqual(130);
      expect(nightStart(day)).toBeLessThanOrEqual(190);
      expect(Math.abs(nightStart(day + 1) - nightStart(day))).toBeLessThanOrEqual(5);
    }
  });

  it('starts the afternoon in proportion to the daylight', () => {
    expect(afternoonStart(6)).toBe(110);
    for (let day = 1; day <= 40; day++) expect(afternoonStart(day)).toBeLessThan(nightStart(day));
  });

  it('announces a new season on its first morning only', () => {
    expect(seasonMessage(10, 11)).toBe('Snow fell in the night. Winter has come.');
    expect(seasonMessage(40, 41)).toBe('The leaves are turning gold. Autumn has come.');
    expect(seasonMessage(20, 21)).toBe('The snow is melting. Spring has come.');
    expect(seasonMessage(30, 31)).toBe('The days are long and warm. Summer has come.');
    expect(seasonMessage(9, 11)).toBe('Snow fell in the night. Winter has come.');
    expect(seasonMessage(4, 5)).toBeNull();
    expect(seasonMessage(11, 11)).toBeNull();
  });

  it('brings out fireflies in summer and falling leaves in autumn', () => {
    expect([31, 40, 1, 11, 21].map(firefliesOut)).toEqual([true, true, false, false, false]);
    expect([1, 11, 31].map(leavesFalling)).toEqual([true, false, false]);
  });

  it('treats the second year\'s winter as winter', () => {
    expect([10, 11, 20, 21, 51].map(isWinter)).toEqual([false, true, true, false, true]);
  });

  it('knows spring, in any year', () => {
    expect([20, 21, 30, 31, 61].map(isSpring)).toEqual([false, true, true, false, true]);
  });

  it('knows summer, in any year', () => {
    expect([30, 31, 40, 41, 71].map(isSummer)).toEqual([false, true, true, false, true]);
  });
});

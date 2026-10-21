import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/game/state';
import {
  BIRD_FLEE_RADIUS, FIREFLY_HOMES, FOX, birdMayReturn, birdShouldLeave, darkness, fireflyGlow, foxAt, foxVisits
} from '../src/scene/ambient';

const visitDay = Array.from({ length: 20 }, (_, i) => i + 1).find(foxVisits)!;
const quietDay = Array.from({ length: 20 }, (_, i) => i + 1).find(day => !foxVisits(day))!;

describe('darkness', () => {
  it('is zero by day, deepens after nightfall, and lifts after dawn', () => {
    expect(darkness(1, 0)).toBe(0);
    expect(darkness(1, 100)).toBe(0);
    expect(darkness(1, BALANCE.nightStart + 15)).toBeCloseTo(0.5);
    expect(darkness(1, BALANCE.daySeconds - 1)).toBe(1);
    expect(darkness(2, 0)).toBe(1);
    expect(darkness(2, 30)).toBe(0);
  });
});

describe('fox', () => {
  it('visits on some evenings but not all, the same way every time', () => {
    expect(visitDay).toBeDefined();
    expect(quietDay).toBeDefined();
    expect(foxVisits(visitDay)).toBe(foxVisits(visitDay));
    expect(foxVisits(1)).toBe(true);
  });

  it('is absent outside its visit window and on quiet days', () => {
    expect(foxAt(visitDay, 60)).toBeNull();
    expect(foxAt(visitDay, FOX.leave + 1)).toBeNull();
    expect(foxAt(quietDay, FOX.arrive + FOX.travel + 5)).toBeNull();
  });

  it('trots in from the den, sits facing the fire, and leaves the way it came', () => {
    const start = foxAt(visitDay, FOX.arrive)!;
    expect(start).toMatchObject({ x: FOX.den.x, y: FOX.den.y, sitting: false });
    const sitting = foxAt(visitDay, FOX.arrive + FOX.travel + 5)!;
    expect(sitting).toMatchObject({ x: FOX.seat.x, y: FOX.seat.y, sitting: true });
    expect(Math.sign(BALANCE.campX - sitting.x)).toBe(sitting.facing);
    const leaving = foxAt(visitDay, FOX.leave - FOX.travel / 2)!;
    expect(leaving.sitting).toBe(false);
    expect(Math.sign(FOX.den.x - FOX.seat.x)).toBe(leaving.facing);
  });

  it('sits close enough to the fire to be seen in its glow', () => {
    const distance = Math.hypot(FOX.seat.x - BALANCE.campX, FOX.seat.y - BALANCE.campY);
    expect(distance).toBeLessThan(BALANCE.campRadius);
    expect(distance).toBeGreaterThan(FOX.spookRadius);
  });
});

describe('birds', () => {
  const home = { x: 10, y: 10 };

  it('leave when the survivor comes close or night falls', () => {
    expect(birdShouldLeave(home, { x: 10 + BIRD_FLEE_RADIUS - 0.1, y: 10 }, 0)).toBe(true);
    expect(birdShouldLeave(home, { x: 20, y: 20 }, 0)).toBe(false);
    expect(birdShouldLeave(home, { x: 20, y: 20 }, 0.6)).toBe(true);
  });

  it('only return in daylight once the survivor has moved off', () => {
    expect(birdMayReturn(home, { x: 20, y: 20 }, 0)).toBe(true);
    expect(birdMayReturn(home, { x: 10 + BIRD_FLEE_RADIUS + 0.5, y: 10 }, 0)).toBe(false);
    expect(birdMayReturn(home, { x: 20, y: 20 }, 0.5)).toBe(false);
  });
});

describe('fireflies', () => {
  it('stay dark by day and glow at night', () => {
    expect(fireflyGlow(0, 1234, 0)).toBe(0);
    const glows = FIREFLY_HOMES.map((_, i) => fireflyGlow(i, 1234, 1));
    expect(Math.max(...glows)).toBeGreaterThan(0.5);
    glows.forEach(glow => expect(glow).toBeLessThanOrEqual(1));
  });

  it('live on the map and outside the fire pit', () => {
    for (const { x, y } of FIREFLY_HOMES) {
      expect(x).toBeGreaterThanOrEqual(1);
      expect(x).toBeLessThanOrEqual(BALANCE.mapWidth - 2);
      expect(y).toBeGreaterThanOrEqual(1);
      expect(y).toBeLessThanOrEqual(BALANCE.mapHeight - 2);
      expect(Math.hypot(x - BALANCE.campX, y - BALANCE.campY)).toBeGreaterThan(2);
    }
  });
});

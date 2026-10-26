import { describe, expect, it } from 'vitest';
import { nightStart } from '../src/game/calendar';
import { QUARRY_SITE } from '../src/game/areas';
import { BALANCE, createGame } from '../src/game/state';
import {
  BIRD_FLEE_RADIUS, BIRD_FORAGE_RADIUS, BIRD_HOMES, FIREFLY_HOMES, FOX, birdForageTarget, birdMayReturn, birdShouldLeave, EYE_SPOTS, darkness, eyesAt, fireflyGlow, foxAt, foxVisits, foxWindow
} from '../src/scene/ambient';

const visitDay = Array.from({ length: 20 }, (_, i) => i + 1).find(foxVisits)!;
const quietDay = Array.from({ length: 20 }, (_, i) => i + 1).find(day => !foxVisits(day))!;

describe('darkness', () => {
  it('is zero by day, deepens after nightfall, and lifts after dawn', () => {
    expect(darkness(1, 0)).toBe(0);
    expect(darkness(1, 100)).toBe(0);
    expect(darkness(1, nightStart(1) + 15)).toBeCloseTo(0.5);
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
    expect(foxAt(visitDay, foxWindow(visitDay).leave + 1)).toBeNull();
    expect(foxAt(quietDay, foxWindow(quietDay).arrive + FOX.travel + 5)).toBeNull();
  });

  it('trots in from the den, sits facing the fire, and leaves the way it came', () => {
    const { arrive, leave } = foxWindow(visitDay);
    const start = foxAt(visitDay, arrive)!;
    expect(start).toMatchObject({ x: FOX.den.x, y: FOX.den.y, sitting: false });
    const sitting = foxAt(visitDay, arrive + FOX.travel + 5)!;
    expect(sitting).toMatchObject({ x: FOX.seat.x, y: FOX.seat.y, sitting: true });
    expect(Math.sign(BALANCE.campX - sitting.x)).toBe(sitting.facing);
    const leaving = foxAt(visitDay, leave - FOX.travel / 2)!;
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

  it('chooses a nearby ripe bush on half of foraging attempts', () => {
    const berries = createGame().nodes.filter(node => node.kind === 'berry');
    for (const home of BIRD_HOMES) {
      const target = birdForageTarget(home, berries, 0.49);
      expect(target).not.toBeNull();
      expect(Math.hypot(target!.x - home.x, target!.y - home.y)).toBeLessThanOrEqual(BIRD_FORAGE_RADIUS);
      expect(birdForageTarget(home, berries, 0.5)).toBeNull();
    }
  });

  it('ignores picked and distant bushes while choosing a destination', () => {
    const home = { x: 10, y: 10 };
    const berries = createGame().nodes.filter(node => node.kind === 'berry');
    expect(birdForageTarget(home, berries.map(node => ({ ...node, amount: 0 })), 0)).toBeNull();
    expect(birdForageTarget(home, [{ ...berries[0], x: 30, y: 20 }], 0)).toBeNull();
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

describe('quarry eyes', () => {
  const far = { x: 38, y: 2 };
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

  it('has six spots, each at least 5 tiles from the quarry site', () => {
    expect(EYE_SPOTS).toHaveLength(6);
    for (const spot of EYE_SPOTS) expect(dist(spot, QUARRY_SITE)).toBeGreaterThanOrEqual(5);
  });

  it('only shows in the dark', () => {
    for (let i = 0; i < EYE_SPOTS.length; i++) for (let t = 0; t < 24000; t += 500) expect(eyesAt(i, t, 0.4, far)).toBeNull();
  });

  it('shows no more than three pairs at once, and every pair at some point', () => {
    const seen = new Set<number>();
    for (let t = 0; t < 60000; t += 250) {
      const visible = EYE_SPOTS.map((_, i) => eyesAt(i, t, 1, far)).filter(Boolean).length;
      expect(visible).toBeLessThanOrEqual(3);
      EYE_SPOTS.forEach((_, i) => { if (eyesAt(i, t, 1, far)) seen.add(i); });
    }
    expect(seen.size).toBe(EYE_SPOTS.length);
  });

  it('backs off and fades near the survivor', () => {
    const t = Array.from({ length: 48 }, (_, k) => k * 250).find(ms => eyesAt(0, ms, 1, far))! + 3000;
    const spot = EYE_SPOTS[0];
    const at = (d: number) => eyesAt(0, t, 1, { x: spot.x + d, y: spot.y });
    expect(at(6)).not.toBeNull();
    const near = at(-4.5)!;
    expect(near).not.toBeNull();
    expect(dist(near, { x: spot.x - 4.5, y: spot.y })).toBeGreaterThan(4.5);
    expect(near.alpha).toBeLessThan(1);
    expect(at(3.9)).toBeNull();
  });

  it('fades all the way out before vanishing, rather than blinking off', () => {
    const t = Array.from({ length: 48 }, (_, k) => k * 250).find(ms => eyesAt(0, ms, 1, far))! + 3000;
    const spot = EYE_SPOTS[0];
    const alpha = (d: number) => eyesAt(0, t, 1, { x: spot.x + d, y: spot.y })?.alpha ?? 0;
    expect(alpha(6)).toBeCloseTo(1);
    expect(alpha(5)).toBeGreaterThan(alpha(4.5));
    expect(alpha(4.01)).toBeLessThan(0.02);
  });

  it('blinks', () => {
    const frames = new Set<string>();
    for (let t = 0; t < 12000; t += 50) { const e = eyesAt(0, t, 1, far); if (e) frames.add(e.frame); }
    expect(frames).toEqual(new Set(['open', 'blink']));
  });
});

describe('evening life through the year', () => {
  it('darkens from each day’s own nightfall', () => {
    expect(darkness(16, 145)).toBeCloseTo(0.5);
    expect(darkness(36, 145)).toBe(0);
  });

  it('brings the fox by earlier on winter evenings', () => {
    expect(foxWindow(16)).toEqual({ arrive: 110, leave: 180 });
    const winterVisit = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20].find(foxVisits)!;
    const { arrive, leave } = foxWindow(winterVisit);
    expect(foxAt(winterVisit, arrive + 5)).not.toBeNull();
    expect(foxAt(winterVisit, leave + 1)).toBeNull();
  });
});

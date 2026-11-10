// EASTER EGG: the town, see src/game/town.ts. The townsfolk on market day and the day before.
import { describe, expect, it } from 'vitest';
import { duskLength, nightStart } from '../src/game/calendar';
import { jobsDawn } from '../src/game/jobs';
import { MARKET_CROWD_SPOTS, SIGN_SPOT } from '../src/game/market';
import { STALL_JOBS } from '../src/game/square';
import { STALL_SPOTS, WELL_SPOT } from '../src/game/squareSites';
import type { GameState } from '../src/game/state';
import { greeting, personSpot } from '../src/game/townsfolk';
import { sceneVisuals } from '../src/scene/visuals';
import { fullTown, opened } from './marketTown';

const away = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const on = (day: number, timeOfDay = 60, change: (state: GameState) => void = () => {}) =>
  opened(100, state => { state.day = day; state.timeOfDay = timeOfDay; change(state); });
const index = (state: GameState, job: string) => state.town.people.findIndex(person => person.job === job);

describe('the town on market day', () => {
  it('spreads out around the square, clear of the well, the stalls and the sign', () => {
    expect(MARKET_CROWD_SPOTS).toHaveLength(10);
    for (const spot of MARKET_CROWD_SPOTS) {
      expect(away(spot, WELL_SPOT)).toBeGreaterThanOrEqual(1);
      expect(away(spot, SIGN_SPOT)).toBeGreaterThanOrEqual(1);
      for (const stall of Object.values(STALL_SPOTS)) expect(away(spot, stall)).toBeGreaterThanOrEqual(1);
    }
  });

  it('brings everyone but the stallholders to the square, and keeps the stallholders at their stalls', () => {
    const state = on(102);
    const wood = index(state, 'wood');
    expect(personSpot(state, wood)).toEqual({ area: 'hills', ...MARKET_CROWD_SPOTS[wood % MARKET_CROWD_SPOTS.length], walking: false });
    expect(personSpot(on(103), wood)?.area).toBe('camp');
    const bread = index(state, STALL_JOBS.bread);
    expect(personSpot(state, bread)).toEqual({ area: 'hills', x: STALL_SPOTS.bread.x, y: STALL_SPOTS.bread.y + 1, walking: false });
  });

  it('walks them home from the square at dusk', () => {
    const start = nightStart(102) - duskLength(102);
    const state = on(102, start);
    const wood = index(state, 'wood');
    expect(personSpot(state, wood)).toEqual({ area: 'hills', ...MARKET_CROWD_SPOTS[wood % MARKET_CROWD_SPOTS.length], walking: true });
  });

  it('still does every job on market day', () => {
    const work = (day: number) => {
      const next = on(day, 0, state => { state.storedWood = 0; });
      jobsDawn(next);
      return next.storedWood;
    };
    expect(work(102)).toBe(work(103));
    expect(work(102)).toBeGreaterThan(0);
  });
});

describe('what the town says of the market', () => {
  it('talks of tomorrow\'s market on the eve, and of the crowd on the day, until the evening', () => {
    expect(greeting(on(101), 'Ada')).toBe('Ada · Market tomorrow.');
    expect(greeting(on(102), 'Ada')).toBe('Ada · Busy one today.');
    expect(greeting(on(102, nightStart(102) - 5), 'Ada')).toBe('Ada · Good evening.');
    expect(greeting(on(103), 'Ada')).not.toMatch(/Market|Busy/);
  });

  it('has the stallholders say what the traders are waiting on while the old road is not ready', () => {
    const waiting = fullTown(state => { state.timeOfDay = 60; state.town.road = { ...state.town.road, milestone: 3, doneDays: { road: 60 } }; });
    const keeper = waiting.town.people.find(person => person.job === STALL_JOBS.bread)!.name;
    const woodman = waiting.town.people.find(person => person.job === 'wood')!.name;
    expect(greeting(waiting, keeper)).toBe(`${keeper} · The traders won't come till the old road's clear and marked.`);
    expect(greeting(waiting, woodman)).not.toMatch(/traders/);
    expect(greeting(fullTown(state => { state.timeOfDay = 60; }), keeper)).not.toMatch(/traders/);
  });
});

describe('the crowd as drawn', () => {
  it('stands about the square on market day while the stallholders work, and walks home at dusk', () => {
    const frames = (state: GameState) => Object.fromEntries(sceneVisuals(state, 0).filter(visual => visual.id.startsWith('townsfolk-')).map(visual => [visual.id, visual.texture.split(':')[1]]));
    const day = on(102, 60, state => { state.area = 'hills'; });
    const wood = index(day, 'wood');
    const bread = index(day, STALL_JOBS.bread);
    expect(frames(day)[`townsfolk-${wood}`]).toBe('stand');
    expect(frames(day)[`townsfolk-${bread}`]).toBe('work');
    const dusk = on(102, nightStart(102) - duskLength(102) + 1, state => { state.area = 'hills'; });
    expect(frames(dusk)[`townsfolk-${wood}`]).toBe('walk0');
  });
});

describe('the crowd in a town hired in the usual order', () => {
  it('gives everyone who isn\'t a stallholder a spot of their own', () => {
    const state = on(102);
    const spots = state.town.people.flatMap((person, i) => (Object.values(STALL_JOBS).includes(person.job as never) ? [] : [personSpot(state, i)]))
      .map(spot => `${spot!.x},${spot!.y}`);
    expect(spots).toHaveLength(10);
    expect(new Set(spots).size).toBe(10);
  });
});

import { street } from './townStreet';
import { describe, expect, it } from 'vitest';
import { townsfolkSprites } from '../src/art/townsfolkSprites';
import { CAMP_EXIT } from '../src/game/areas';
import { afternoonStart, duskLength, nightStart } from '../src/game/calendar';
import { HALL_DOOR_SPOT } from '../src/game/castle';
import { COOP_SITE } from '../src/game/chickens';
import { HILLS_EXIT } from '../src/game/hills';
import { JOBS } from '../src/game/jobs';
import { createGame, type GameState } from '../src/game/state';
import type { Person } from '../src/game/town';
import { HOUSE_PLOTS } from '../src/game/townSites';
import { greeting, personSpot, travellerSpot } from '../src/game/townsfolk';
import { promptFor, useKeyAction } from '../src/scene/prompts';
import { pickTapTarget } from '../src/scene/tapTarget';
import { rainWindow } from '../src/game/rain';
import { sceneVisuals } from '../src/scene/visuals';

// EASTER EGG: the town, see src/game/town.ts. The town's people at their work and on their way home.

const SPRING = 65;
const WINTER = 55;
const ada: Person = { name: 'Ada', job: 'hens', house: null, arrivedDay: 62 };

/** Ada looks after the hens, on a spring day at the given time. */
const town = (time: number, change: (state: GameState) => void = () => {}): GameState => {
  const state = createGame();
  state.day = SPRING;
  state.timeOfDay = time;
  Object.assign(state.structures, { chickenCoop: true, larder: true, shelter: true });
  state.chickens = { discovered: true, following: false, rescued: true, eggs: 0, nextEggDay: 66 };
  state.town = { ...state.town, people: [ada], namesUsed: 1 };
  change(state);
  return state;
};
const duskStart = nightStart(SPRING) - duskLength(SPRING);
const gap = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('where the town\'s people are', () => {
  it('puts a hens worker beside the coop by day', () => {
    const spot = personSpot(town(60), 0)!;
    expect(spot).toMatchObject({ walking: false, ...JOBS.hens.spot });
    expect(spot.area).toBe('camp');
    expect(gap(spot, COOP_SITE)).toBeLessThanOrEqual(1.5);
  });

  it('walks them to the camp\'s edge, then up the hills toward home, through the dusk', () => {
    const steps = [0.1, 0.3, 0.45].map(f => personSpot(town(duskStart + duskLength(SPRING) * f), 0)!);
    for (const step of steps) expect(step).toMatchObject({ area: 'camp', walking: true });
    expect(gap(steps[2], CAMP_EXIT)).toBeLessThan(gap(steps[0], CAMP_EXIT));
    const later = [0.55, 0.75, 0.95].map(f => personSpot(town(duskStart + duskLength(SPRING) * f), 0)!);
    for (const step of later) expect(step).toMatchObject({ area: 'hills', walking: true });
    expect(gap(later[0], HILLS_EXIT)).toBeLessThan(gap(later[0], HALL_DOOR_SPOT));
    expect(gap(later[2], HALL_DOOR_SPOT)).toBeLessThan(gap(later[0], HALL_DOOR_SPOT));
  });

  it('has them indoors from nightfall', () => {
    expect(personSpot(town(nightStart(SPRING)), 0)).toBeNull();
    expect(personSpot(town(nightStart(SPRING) + 30), 0)).toBeNull();
    expect(personSpot(town(60), 3)).toBeNull();
  });

  it('heads for the hall door before their house is finished, and for the house after', () => {
    const end = duskStart + duskLength(SPRING) * 0.999;
    expect(gap(personSpot(town(end), 0)!, HALL_DOOR_SPOT)).toBeLessThan(0.2);
    const housed = town(end, state => {
      state.town.people = [{ ...ada, house: 0 }];
      state.town.houses = street({ stone: 30, beams: 4, fittings: 1, doneDay: 64 });
    });
    expect(gap(personSpot(housed, 0)!, HOUSE_PLOTS[0])).toBeLessThan(0.2);
  });

  it('shows the traveller by the hall door only after their first night', () => {
    const waiting = (day: number, time = 60) => town(time, state => {
      state.day = day;
      state.town = { ...state.town, people: [], traveller: { name: 'Tomas', arrivedDay: 64, refusals: 0, askedDay: null } };
    });
    expect(travellerSpot(waiting(64, nightStart(64) + 5))).toBeNull();
    expect(travellerSpot(waiting(65))).toEqual({ area: 'hills', x: HALL_DOOR_SPOT.x + 1.5, y: HALL_DOOR_SPOT.y + 1 });
    expect(travellerSpot(waiting(65, nightStart(65) + 5))).toBeNull();
    expect(travellerSpot(town(60))).toBeNull();
  });
});

describe('saying hello', () => {
  /** A spring day with no rain, odd or even. Ada's name is the first, so on an odd day she remarks on the season. */
  const dryDay = (odd: boolean, from = 61) => Array.from({ length: 10 }, (_, i) => from + i).find(day => rainWindow(day) === null && day % 2 === (odd ? 1 : 0))!;
  const on = (day: number, time = 10) => town(time, state => { state.day = day; });

  it('greets by the time of day on some days', () => {
    const even = dryDay(false);
    expect(greeting(on(even), 'Ada')).toBe('Ada · Good morning.');
    expect(greeting(on(even, afternoonStart(even) + 1), 'Ada')).toBe('Ada · Good afternoon.');
  });

  it('remarks on the season on the others', () => {
    expect(greeting(on(dryDay(true)), 'Ada')).toBe('Ada · The grass is coming on.');
    expect(greeting(on(71), 'Ada')).toBe('Ada · Warm one today.');
    expect(greeting(on(81), 'Ada')).toBe('Ada · The leaves are turning.');
    expect(greeting(on(72), 'Ada')).toBe('Ada · Good morning.');
  });

  it('says good evening through the dusk, whatever the day', () => {
    expect(greeting(town(duskStart + 1), 'Ada')).toBe('Ada · Good evening.');
    expect(greeting(on(WINTER, nightStart(WINTER) - duskLength(WINTER) + 1), 'Ada')).toBe('Ada · Good evening.');
  });

  it('talks of the rain while it rains, and of the cold in winter', () => {
    const wet = Array.from({ length: 10 }, (_, i) => 61 + i).find(day => rainWindow(day) !== null)!;
    const window = rainWindow(wet)!;
    expect(greeting(on(wet, window.start + 1), 'Ada')).toBe('Ada · Wet one today.');
    expect(greeting(on(wet, window.end + 1), 'Ada')).not.toBe('Ada · Wet one today.');
    expect(greeting(on(WINTER), 'Ada')).toBe('Ada · Cold one today.');
    expect(greeting(on(WINTER + 1), 'Ada')).toBe('Ada · Cold one today.');
  });

  it('has two people say different things on the same day', () => {
    const day = on(dryDay(true));
    expect(greeting(day, 'Ada')).toBe('Ada · The grass is coming on.');
    expect(greeting(day, 'Tomas')).toBe('Tomas · Good morning.');
  });

  it('adds the greeting to the prompt when the survivor passes, and leaves E and taps alone', () => {
    const near = town(60, state => { state.player = { ...state.player, x: JOBS.hens.spot.x + 1, y: JOBS.hens.spot.y }; });
    const alone = { ...near, town: { ...near.town, people: [] } };
    expect(promptFor(near)).toContain(greeting(near, 'Ada'));
    expect(promptFor(near)).toContain(promptFor(alone));
    expect(useKeyAction(near)).toEqual(useKeyAction(alone));
    expect(pickTapTarget(near, JOBS.hens.spot.x, JOBS.hens.spot.y)).toEqual(pickTapTarget(alone, JOBS.hens.spot.x, JOBS.hens.spot.y));
    const far = town(60, state => { state.player = { ...state.player, x: JOBS.hens.spot.x + 3, y: JOBS.hens.spot.y }; });
    expect(promptFor(far)).not.toContain('Ada');
  });

  it('greets on the hills too, from the traveller by the door', () => {
    const hills = town(60, state => {
      state.area = 'hills';
      state.town = { ...state.town, people: [], traveller: { name: 'Tomas', arrivedDay: 64, refusals: 0, askedDay: null }, namesUsed: 2 };
      state.player = { ...state.player, x: HALL_DOOR_SPOT.x + 2, y: HALL_DOOR_SPOT.y + 1 };
    });
    expect(promptFor(hills)).toContain(greeting(hills, 'Tomas'));
    expect(greeting(hills, 'Tomas')).toMatch(/^Tomas · /);
  });
});

describe('drawing the town\'s people', () => {
  it('draws each person in their own area only, as one of the townsfolk', () => {
    const atCamp = sceneVisuals(town(60), 0).find(visual => visual.id === 'townsfolk-0');
    expect(atCamp?.texture).toMatch(/^townsfolk\d:work$/);
    expect(sceneVisuals(town(60, state => { state.area = 'hills'; }), 0).find(visual => visual.id === 'townsfolk-0')).toBeUndefined();
    const walking = sceneVisuals(town(duskStart + 5), 0).find(visual => visual.id === 'townsfolk-0');
    expect(walking?.texture).toMatch(/^townsfolk\d:walk\d$/);
    expect(sceneVisuals(town(nightStart(SPRING) + 1), 0).find(visual => visual.id === 'townsfolk-0')).toBeUndefined();
  });

  it('draws the traveller at the hall door', () => {
    const state = town(60, state => {
      state.area = 'hills';
      state.town = { ...state.town, people: [], traveller: { name: 'Tomas', arrivedDay: 64, refusals: 0, askedDay: null }, namesUsed: 2 };
    });
    expect(sceneVisuals(state, 0).find(visual => visual.id === 'townsfolk-traveller')?.texture).toMatch(/^townsfolk\d:stand$/);
  });

  it('dresses different names differently, at 16 by 24', () => {
    const variants = Object.keys(townsfolkSprites);
    expect(variants.length).toBeGreaterThanOrEqual(3);
    for (const id of variants) {
      expect(townsfolkSprites[id].size).toEqual([16, 24]);
      for (const frame of ['stand', 'walk0', 'walk1', 'work']) expect(townsfolkSprites[id].frames).toHaveProperty(frame);
    }
    expect(townsfolkSprites.townsfolk0.legend).not.toEqual(townsfolkSprites.townsfolk1.legend);
  });
});

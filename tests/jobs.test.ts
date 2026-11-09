import { describe, expect, it } from 'vitest';
import { BALANCE, createGame, type GameState } from '../src/game/state';
import { advanceTime, applyAction } from '../src/game/rules';
import { chickensDawn, COOP_SITE } from '../src/game/chickens';
import { addFood, foodCount, storeTotal } from '../src/game/food';
import { JOBS, JOB_ORDER, jobsDawn, openJob } from '../src/game/jobs';
import type { JobId, Person } from '../src/game/town';

const worker = (job: JobId, name = 'Ada'): Person => ({ name, job, house: null, arrivedDay: 1 });

/** A camp with the hens home in their coop, the bees in their hive and a larder, at the very end of day 20. */
const camp = (people: Person[] = []): GameState => {
  const state = createGame();
  state.day = 20;
  state.timeOfDay = BALANCE.daySeconds - 0.5;
  Object.assign(state.structures, { chickenCoop: true, granary: true, larder: true, beehive: true });
  state.field.grain = 100;
  state.chickens = { discovered: true, following: false, rescued: true, eggs: 0, nextEggDay: 21 };
  state.beehive = { honey: 0, nextHoney: 50 };
  state.town.people = people;
  state.town.namesUsed = people.length;
  return state;
};

/** Fills the larder with apples, leaving `room` spaces. */
const fillLarder = (state: GameState, room: number): void => {
  state.larder = addFood(state.larder, 'apple', BALANCE.larderCapacity - room - storeTotal(state.larder), state.day);
};

describe('the hens job', () => {
  it('puts the eggs laid at dawn in the larder that morning', () => {
    const after = advanceTime(camp([worker('hens')]), 1);
    expect(after.day).toBe(21);
    expect(after.chickens.eggs).toBe(0);
    expect(foodCount(after.larder, 'egg')).toBe(1);
  });

  it('leaves eggs in the coop, up to its three, when the larder is full, and loses none', () => {
    const state = camp([worker('hens')]);
    fillLarder(state, 0);
    state.chickens.eggs = 2;
    const after = advanceTime(state, 1);
    expect(after.chickens.eggs).toBe(3);
    expect(foodCount(after.larder, 'egg')).toBe(0);
  });

  it('moves only as many eggs as the larder has room for', () => {
    const state = camp([worker('hens')]);
    fillLarder(state, 1);
    state.chickens.eggs = 2;
    const after = advanceTime(state, 1);
    expect(foodCount(after.larder, 'egg')).toBe(1);
    expect(after.chickens.eggs).toBe(2);
  });

  it('moves nothing with no one on the job', () => {
    const after = advanceTime(camp(), 1);
    expect(after.chickens.eggs).toBe(1);
    expect(foodCount(after.larder, 'egg')).toBe(0);
  });

  it('still lets the survivor take an egg by hand', () => {
    const state = camp([worker('hens')]);
    state.timeOfDay = 100;
    state.chickens.eggs = 1;
    state.player = { ...state.player, x: COOP_SITE.x, y: COOP_SITE.y + 1 };
    const taken = applyAction(state, { type: 'takeEgg' }).state;
    expect(taken.chickens.eggs).toBe(0);
    expect(foodCount(taken.inventory.food, 'egg')).toBe(1);
  });

  it('puts more eggs by over forty dawns than the coop could ever hold', () => {
    const state = camp([worker('hens')]);
    state.structures.storehouse = true;
    let gathered = 0;
    for (let dawn = 0; dawn < 40; dawn++) {
      state.day += 1;
      chickensDawn(state);
      const before = foodCount(state.larder, 'egg');
      jobsDawn(state);
      gathered += foodCount(state.larder, 'egg') - before;
    }
    expect(gathered).toBeGreaterThan(3);
  });
});

describe('the honey job', () => {
  it('empties the hive into the larder, and the bees make the next honey on time', () => {
    const state = camp([worker('honey')]);
    state.beehive = { honey: BALANCE.hiveHoneyCapacity, nextHoney: 18 };
    const morning = advanceTime(state, 1);
    expect(morning.beehive.honey).toBe(0);
    expect(foodCount(morning.larder, 'honey')).toBe(BALANCE.hiveHoneyCapacity);
    // The full hive waited, so the bees make the next honey at the first dawn after it was emptied.
    const next = advanceTime({ ...morning, timeOfDay: BALANCE.daySeconds - 0.5 }, 1);
    expect(foodCount(next.larder, 'honey')).toBe(BALANCE.hiveHoneyCapacity + 1);
    expect(next.beehive.nextHoney).toBe(22 + BALANCE.hiveHoneyDays);
  });
});

describe('which job is open', () => {
  it('offers the hens first, then the bees, then nothing', () => {
    expect(JOB_ORDER).toEqual(['hens', 'honey']);
    expect(openJob(camp())).toBe('hens');
    expect(openJob(camp([worker('hens')]))).toBe('honey');
    expect(openJob(camp([worker('hens'), worker('honey', 'Tomas')]))).toBeNull();
  });

  it('opens a job only once its buildings are up', () => {
    const noCoop = camp();
    noCoop.structures.chickenCoop = false;
    expect(openJob(noCoop)).toBe('honey');
    const noLarder = camp();
    noLarder.structures.larder = false;
    expect(openJob(noLarder)).toBeNull();
    const noHens = camp();
    noHens.chickens.rescued = false;
    noHens.structures.beehive = false;
    expect(openJob(noHens)).toBeNull();
  });

  it('words each job as an offer and puts it beside its work', () => {
    expect(JOBS.hens.offer).toBe('look after the hens');
    expect(JOBS.honey.offer).toBe('keep the bees');
    expect(JOBS.hens.spot.area).toBe('camp');
    expect(Math.hypot(JOBS.hens.spot.x - COOP_SITE.x, JOBS.hens.spot.y - COOP_SITE.y)).toBeLessThanOrEqual(1.5);
    expect(Math.hypot(JOBS.honey.spot.x - (BALANCE.campX + 2), JOBS.honey.spot.y - (BALANCE.campY - 7))).toBeLessThanOrEqual(1.5);
  });
});

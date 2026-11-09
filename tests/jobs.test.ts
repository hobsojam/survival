import { describe, expect, it } from 'vitest';
import { BALANCE, createGame, type GameState } from '../src/game/state';
import { advanceTime, applyAction } from '../src/game/rules';
import { chickensDawn, COOP_SITE } from '../src/game/chickens';
import { addFood, foodCount, storeTotal } from '../src/game/food';
import { JOBS, JOB_ORDER, WORKER_WOOD, jobsDawn, openJob, openJobs } from '../src/game/jobs';
import { woodStoreCapacity } from '../src/game/home';
import { ORCHARD_SPOTS } from '../src/game/orchard';
import { CAMP_STRUCTURES } from '../src/scene/visuals';
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
    expect(JOB_ORDER).toEqual(['hens', 'honey', 'loaves', 'wood', 'beds', 'field', 'sheep', 'orchard']);
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

const SPRING_DAY = 63;
const SUMMER_DAY = 76;
const AUTUMN_DAY = 123;
const WINTER_DAY = 53;

/** The camp with every building a worker could need, on the very end of the day before `day`, with the workers given. */
const fullCamp = (people: Person[], day: number): GameState => {
  const state = camp(people);
  state.day = day;
  Object.assign(state.structures, { bakery: true, windmill: true, woodpile: true, vegetableBeds: true, well: true, field: true, sheepPen: true, orchard: true });
  Object.assign(state.progress.workshop, { harvestTools: true, shears: true });
  state.field = { ...state.field, grain: 0 };
  state.sheep = { ...state.sheep, arrived: true, fluff: 60, fedUntil: day - 1, lastShornYear: null };
  return state;
};
/** One dawn of the workers' jobs on the day `state` is set to. */
const workDawn = (state: GameState): GameState => {
  const next = structuredClone(state);
  jobsDawn(next);
  return next;
};
const everyJob = (): Person[] => JOB_ORDER.map((job, index) => worker(job, `W${index}`));

describe('the bread job', () => {
  it('moves the shelf loaves into the larder, oldest first, keeping their bake days', () => {
    const state = fullCamp([worker('loaves')], SPRING_DAY);
    state.bakery = { ...state.bakery, shelf: [SPRING_DAY, SPRING_DAY - 2] };
    const after = workDawn(state);
    expect(after.bakery.shelf).toEqual([]);
    expect(after.larder.bread).toEqual([SPRING_DAY - 2, SPRING_DAY]);
  });

  it('leaves loaves on the shelf when the larder is full, and moves none without a worker', () => {
    const state = fullCamp([worker('loaves')], SPRING_DAY);
    state.bakery = { ...state.bakery, shelf: [SPRING_DAY, SPRING_DAY - 2] };
    fillLarder(state, 1);
    const after = workDawn(state);
    expect(after.larder.bread).toEqual([SPRING_DAY - 2]);
    expect(after.bakery.shelf).toEqual([SPRING_DAY]);
    expect(workDawn(fullCamp([], SPRING_DAY)).larder.bread).toEqual([]);
  });
});

describe('the wood job', () => {
  it('stocks the wood store a little each dawn, up to what it holds', () => {
    const state = fullCamp([worker('wood')], SPRING_DAY);
    expect(workDawn(state).storedWood).toBe(WORKER_WOOD);
    expect(WORKER_WOOD).toBe(2);
    state.storedWood = woodStoreCapacity(state) - 1;
    expect(workDawn(state).storedWood).toBe(woodStoreCapacity(state));
    expect(workDawn(fullCamp([], SPRING_DAY)).storedWood).toBe(0);
  });
});

describe('the beds job', () => {
  it('harvests ripe beds into the larder, sows the empty ones and waters the growing ones', () => {
    const state = fullCamp([worker('beds')], SUMMER_DAY);
    state.beds = [{ sown: true, grown: BALANCE.cropGrowDays, dryDays: 0, wateredDay: null }, { sown: false, grown: 0, dryDays: 0, wateredDay: null }, { sown: true, grown: 1, dryDays: 1, wateredDay: null }];
    const after = workDawn(state);
    expect(foodCount(after.larder, 'vegetables')).toBe(BALANCE.cropYield);
    expect(after.beds.every(bed => bed.sown)).toBe(true);
    expect(after.beds.map(bed => bed.grown)).toEqual([0, 0, 1]);
    expect(after.beds.every(bed => bed.wateredDay === SUMMER_DAY)).toBe(true);
  });

  it('leaves a ripe bed standing when the larder has no room for it, and draws no water without a well', () => {
    const state = fullCamp([worker('beds')], SUMMER_DAY);
    state.structures.well = false;
    state.beds = [{ sown: true, grown: BALANCE.cropGrowDays, dryDays: 0, wateredDay: null }, { sown: true, grown: 1, dryDays: 0, wateredDay: null }, { sown: true, grown: 1, dryDays: 0, wateredDay: null }];
    fillLarder(state, BALANCE.cropYield - 1);
    const after = workDawn(state);
    expect(after.beds[0]).toEqual(state.beds[0]);
    expect(foodCount(after.larder, 'vegetables')).toBe(0);
    expect(after.beds[1].wateredDay).toBeNull();
  });

  it('lets the beds rest in winter, and does nothing without a worker', () => {
    const winter = fullCamp([worker('beds')], WINTER_DAY);
    expect(workDawn(winter).beds).toEqual(winter.beds);
    const idle = fullCamp([], SUMMER_DAY);
    expect(workDawn(idle).beds).toEqual(idle.beds);
  });
});

describe('the field job', () => {
  it('threshes the stooks, cuts the gold strips and mills the grain', () => {
    const state = fullCamp([worker('field')], SUMMER_DAY);
    state.field = { ...state.field, seed: 0, grain: 0, straw: 0, strips: [{ sownDay: SPRING_DAY, cut: true }, { sownDay: SPRING_DAY, cut: false }, { sownDay: null, cut: false }, { sownDay: null, cut: false }] };
    const after = workDawn(state);
    expect(after.field.strips[0]).toEqual({ sownDay: null, cut: false });
    expect(after.field.strips[1].cut).toBe(true);
    expect(after.millFlour).toBe(BALANCE.grainPerStrip / BALANCE.grainPerFlour);
    expect(after.field.grain).toBe(0);
  });

  it('sows the bare strips in spring while the seed lasts', () => {
    const state = fullCamp([worker('field')], SPRING_DAY);
    state.field = { ...state.field, seed: 3 };
    const after = workDawn(state);
    expect(after.field.strips.filter(strip => strip.sownDay === SPRING_DAY)).toHaveLength(3);
    expect(after.field.seed).toBe(0);
    const summer = fullCamp([worker('field')], SUMMER_DAY);
    summer.field = { ...summer.field, seed: 3 };
    expect(workDawn(summer).field.strips.every(strip => strip.sownDay === null)).toBe(true);
  });

  it('leaves the stooks standing while the granary is full, losing no grain, and does nothing without a worker', () => {
    const state = fullCamp([worker('field')], SUMMER_DAY);
    state.structures.windmill = false;
    state.field = { ...state.field, grain: BALANCE.granaryCapacity - 1, strips: [{ sownDay: SPRING_DAY, cut: true }, ...state.field.strips.slice(1)] };
    const after = workDawn(state);
    expect(after.field.strips[0].cut).toBe(true);
    expect(after.field.grain).toBe(BALANCE.granaryCapacity - 1);
    const idle = fullCamp([], SUMMER_DAY);
    idle.field = state.field;
    expect(workDawn(idle).field).toEqual(idle.field);
  });
});

describe('the sheep job', () => {
  it('puts feed out once it has run out, and shears the flock in spring', () => {
    const state = fullCamp([worker('sheep')], SPRING_DAY);
    state.field = { ...state.field, straw: 2 };
    const after = workDawn(state);
    expect(after.field.straw).toBe(1);
    expect(after.sheep.fedUntil).toBe(SPRING_DAY + BALANCE.feedDays);
    expect(after.sheep.fluff).toBe(0);
    expect(after.sheep.wool).toBe(BALANCE.woolPerShearing);
  });

  it('leaves the feed while it lasts, shears only in spring, and never past what the basket holds', () => {
    const fed = fullCamp([worker('sheep')], SUMMER_DAY);
    fed.field = { ...fed.field, straw: 2 };
    fed.sheep.fedUntil = SUMMER_DAY + 1;
    expect(workDawn(fed).field.straw).toBe(2);
    expect(workDawn(fed).sheep.fluff).toBe(60);
    const full = fullCamp([worker('sheep')], SPRING_DAY);
    full.sheep.wool = BALANCE.woolCapacity - 1;
    expect(workDawn(full).sheep).toMatchObject({ fluff: 60, wool: BALANCE.woolCapacity - 1 });
    const idle = fullCamp([], SPRING_DAY);
    idle.field = { ...idle.field, straw: 2 };
    expect(workDawn(idle).sheep).toEqual(idle.sheep);
  });
});

describe('the orchard job', () => {
  const grownTree = (ripeDay: number) => ({ plantedDay: 3, ripeDay });

  it('picks an apple from each ripe tree into the larder, and the tree ripens again', () => {
    const state = fullCamp([worker('orchard')], AUTUMN_DAY);
    state.orchard = { ...state.orchard, trees: [grownTree(AUTUMN_DAY), grownTree(AUTUMN_DAY + 1), null, null, null, null] };
    const after = workDawn(state);
    expect(foodCount(after.larder, 'apple')).toBe(1);
    expect(after.orchard.trees[0]?.ripeDay).toBe(AUTUMN_DAY + BALANCE.orchardRipenDays);
    expect(after.orchard.trees[1]?.ripeDay).toBe(AUTUMN_DAY + 1);
  });

  it('leaves the apples on the tree when the larder is full, and picks none without a worker', () => {
    const state = fullCamp([worker('orchard')], AUTUMN_DAY);
    state.orchard = { ...state.orchard, trees: [grownTree(AUTUMN_DAY), null, null, null, null, null] };
    fillLarder(state, 0);
    expect(workDawn(state).orchard).toEqual(state.orchard);
    const idle = fullCamp([], AUTUMN_DAY);
    idle.orchard = state.orchard;
    expect(workDawn(idle).orchard).toEqual(idle.orchard);
  });
});

describe('the open jobs', () => {
  it('lists every job free, in order, skipping the held ones and the ones without their buildings', () => {
    expect(openJobs(fullCamp([], SPRING_DAY))).toEqual(JOB_ORDER);
    expect(openJobs(fullCamp([worker('hens'), worker('wood', 'Tomas')], SPRING_DAY))).toEqual(['honey', 'loaves', 'beds', 'field', 'sheep', 'orchard']);
    const bare = fullCamp([], SPRING_DAY);
    Object.assign(bare.structures, { bakery: false, woodpile: false, vegetableBeds: false, granary: false, orchard: false });
    bare.sheep.arrived = false;
    expect(openJobs(bare)).toEqual(['hens', 'honey']);
    expect(openJob(fullCamp(everyJob(), SPRING_DAY))).toBeNull();
  });

  it('opens the field only with the sickle and flail, and the sheep only with shears', () => {
    const state = fullCamp([], SPRING_DAY);
    Object.assign(state.progress.workshop, { harvestTools: false, shears: false });
    expect(openJobs(state)).not.toContain('field');
    expect(openJobs(state)).not.toContain('sheep');
  });

  it('words each new job as an offer', () => {
    expect(['loaves', 'wood', 'beds', 'field', 'sheep', 'orchard'].map(job => JOBS[job as JobId].offer)).toEqual([
      'see to the bread', 'keep the wood store stocked', 'tend the vegetable beds', 'work the field and the mill', 'look after the sheep', 'pick the orchard'
    ]);
  });

  it('puts each worker beside their work, and no two on the same spot', () => {
    const building: Record<string, string> = { hens: 'chickenCoop', honey: 'beehive', loaves: 'bakery', wood: 'woodpile', beds: 'vegetableBeds', field: 'field', sheep: 'sheepPen' };
    for (const job of JOB_ORDER) {
      const spot = JOBS[job].spot;
      expect(spot.area).toBe('camp');
      if (job === 'orchard') {
        expect(Math.min(...ORCHARD_SPOTS.map(tree => Math.hypot(tree.x - spot.x, tree.y - spot.y)))).toBeLessThanOrEqual(3);
      } else if (job === 'hens') {
        expect(Math.hypot(spot.x - COOP_SITE.x, spot.y - COOP_SITE.y)).toBeLessThanOrEqual(3);
      } else {
        const [, dx, dy] = CAMP_STRUCTURES.find(([id]) => id === building[job])!;
        expect(Math.hypot(spot.x - (BALANCE.campX + dx), spot.y - (BALANCE.campY + dy)), job).toBeLessThanOrEqual(3);
      }
    }
    for (const a of JOB_ORDER) for (const b of JOB_ORDER) {
      if (a < b) expect(Math.hypot(JOBS[a].spot.x - JOBS[b].spot.x, JOBS[a].spot.y - JOBS[b].spot.y), `${a} ${b}`).toBeGreaterThan(1);
    }
  });
});

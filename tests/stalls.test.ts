import { describe, expect, it } from 'vitest';
import { addFood, foodCount } from '../src/game/food';
import { PLOT_DAYS, houseOpen } from '../src/game/houseOpen';
import { JOBS, STALL_JOBS, jobsDawn, openJobs } from '../src/game/jobs';
import { STALL_STOCK, type StallId } from '../src/game/square';
import { STALL_SPOTS } from '../src/game/squareSites';
import type { GameState } from '../src/game/state';
import { JOB_IDS, type JobId, type Person } from '../src/game/town';
import { finishedCastleCamp, street } from './townStreet';

// EASTER EGG: the town, see src/game/town.ts. The stallholders, who stock the square's stalls from what the camp can spare.

const CAMP_JOBS = JOB_IDS.slice(0, 8);
const built = (doneDay: number) => ({ stone: 30, beams: 4, fittings: 1, doneDay });
const person = (job: JobId, house: number): Person => ({ name: `N${house}`, job, house, arrivedDay: 20 + house });

/** Every camp job held from the first eight houses, the square paved, the given stalls up and kept, and a larder. */
const square = (stalls: StallId[], keepers: StallId[] = stalls, change: (state: GameState) => void = () => {}): GameState => {
  const state = finishedCastleCamp();
  state.structures.larder = true;
  state.town.houses = street(...CAMP_JOBS.map((_, i) => built(20 + i)));
  state.town.people = [...CAMP_JOBS.map(person), ...keepers.map((id, i) => ({ ...person(STALL_JOBS[id], 8 + i), house: null }))];
  state.town.namesUsed = state.town.people.length;
  state.town.square.paving = 40;
  state.town.square.doneDays = { paving: 40 };
  for (const id of stalls) { state.town.square.stalls[id] = { beams: 2, hangings: 1 }; state.town.square.doneDays[id] = 41; }
  change(state);
  return state;
};
const dawn = (state: GameState): GameState => { const next = structuredClone(state); jobsDawn(next); return next; };

describe('the stallholders', () => {
  it('names each stall job after its good, and stands in front of the stall', () => {
    expect(JOB_IDS.slice(8)).toEqual(['breadStall', 'honeyStall', 'woolStall', 'appleStall', 'eggStall']);
    expect(STALL_JOBS).toEqual({ bread: 'breadStall', honey: 'honeyStall', wool: 'woolStall', apples: 'appleStall', eggs: 'eggStall' });
    expect(JOBS.breadStall.offer).toBe('keep the bread stall');
    expect(JOBS.appleStall.offer).toBe('keep the apple stall');
    expect(JOBS.eggStall.spot).toEqual({ area: 'hills', x: STALL_SPOTS.eggs.x, y: STALL_SPOTS.eggs.y + 1 });
  });

  it('takes one of each good at dawn, oldest first, from what is spare above the reserve', () => {
    const after = dawn(square(['bread', 'honey', 'apples', 'eggs', 'wool'], undefined, state => {
      state.larder = addFood(addFood(addFood(addFood(state.larder, 'bread', 3, 50), 'honey', 3, 50), 'apple', 3, 50), 'egg', 2, 40);
      state.larder = addFood(state.larder, 'egg', 1, 58);
      state.sheep = { ...state.sheep, wool: 4 };
    }));
    expect(after.town.square.stock).toEqual({ bread: 1, honey: 1, wool: 1, apples: 1, eggs: 1 });
    expect(foodCount(after.larder, 'bread')).toBe(2);
    expect(foodCount(after.larder, 'honey')).toBe(2);
    expect(foodCount(after.larder, 'apple')).toBe(2);
    expect(after.larder.egg).toEqual([40, 58]);
    expect(after.sheep.wool).toBe(3);
  });

  it('leaves the reserve alone: two of a food, three of wool', () => {
    const after = dawn(square(['eggs', 'wool'], undefined, state => { state.larder = addFood(state.larder, 'egg', 2, 50); state.sheep = { ...state.sheep, wool: 3 }; }));
    expect(after.town.square.stock).toMatchObject({ eggs: 0, wool: 0 });
    expect(foodCount(after.larder, 'egg')).toBe(2);
    expect(after.sheep.wool).toBe(3);
  });

  it('takes nothing for a full stall or a stall with no keeper', () => {
    const full = dawn(square(['bread'], undefined, state => { state.larder = addFood(state.larder, 'bread', 5, 50); state.town.square.stock.bread = STALL_STOCK; }));
    expect(full.town.square.stock.bread).toBe(STALL_STOCK);
    expect(foodCount(full.larder, 'bread')).toBe(5);
    const unkept = dawn(square(['bread'], [], state => { state.larder = addFood(state.larder, 'bread', 5, 50); }));
    expect(unkept.town.square.stock.bread).toBe(0);
  });

  it('keeps stocking a stall after a camp job opens', () => {
    const after = dawn(square(['bread'], undefined, state => {
      state.larder = addFood(state.larder, 'bread', 5, 50);
      state.structures.vegetableBeds = true;
      state.town.people = state.town.people.filter(p => p.job !== 'beds');
    }));
    expect(after.town.square.stock.bread).toBe(1);
  });

  it('offers a stall only once it stands and every camp job that is open is taken', () => {
    expect(openJobs(square([], []))).toEqual([]);
    expect(openJobs(square(['bread'], []))).toEqual(['breadStall']);
    const bedsFree = square(['bread'], [], state => {
      state.structures.vegetableBeds = true;
      state.town.people = state.town.people.filter(p => p.job !== 'beds');
    });
    expect(openJobs(bedsFree)).toEqual(['beds']);
  });

  it('opens the next plot for a stall once every house is lived in', () => {
    const waiting = square(['bread'], [], state => { state.day = 27 + PLOT_DAYS; });
    expect(houseOpen({ ...waiting, day: waiting.day - 1 }, 8)).toBe(false);
    expect(houseOpen(waiting, 8)).toBe(true);
    expect(openJobs(waiting)).toEqual(['breadStall']);
  });
});

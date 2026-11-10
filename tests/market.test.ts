// EASTER EGG: the town, see src/game/town.ts. Market day: when the square opens, the schedule, and the stalls cleared after each market.
import { describe, expect, it } from 'vitest';
import { firstMarketDay, isMarketDay, isMarketEve, marketDawn, roadReady, townFull } from '../src/game/market';
import { applyAction } from '../src/game/rules';
import { SAVE_KEY, loadGame, saveGame } from '../src/game/save';
import { STALL_IDS } from '../src/game/square';
import type { GameState } from '../src/game/state';
import { JOB_IDS, TOWN_NAMES, type JobId, type Person } from '../src/game/town';
import { finishedCastleCamp, street } from './townStreet';

const built = (doneDay: number) => ({ stone: 30, beams: 4, fittings: 1, doneDay });
const STALL = { beams: 2, hangings: 1 };

/** A town as full as it gets: fifteen houses lived in, every job held, the bridge done, and the road cleared and marked. */
export const fullTown = (change: (state: GameState) => void = () => {}, jobs: readonly JobId[] = JOB_IDS): GameState => {
  const state = finishedCastleCamp();
  state.day = 100;
  Object.assign(state.structures, { woodpile: true, larder: true });
  const people: Person[] = jobs.map((job, index) => ({ name: TOWN_NAMES[index], job, house: index, arrivedDay: 10 + index }));
  state.town = { ...state.town, namesUsed: people.length, people,
    houses: street(...jobs.map((_, i) => built(20 + i * 2))),
    square: { ...state.town.square, paving: 40, well: { stone: 12, fittings: 1 },
      stalls: Object.fromEntries(STALL_IDS.map(id => [id, { ...STALL }])) as GameState['town']['square']['stalls'],
      doneDays: { paving: 30, well: 31, bread: 32, honey: 32, wool: 32, apples: 32, eggs: 32 } },
    bridge: { stone: 50, beams: 4, fittings: 2, doneDays: { piers: 40, arch: 45, parapet: 50 } },
    road: { cleared: 6, work: 0, milestone: 6, doneDays: { road: 60, milestone: 62 } } };
  change(state);
  return state;
};

const dawned = (state: GameState): GameState => {
  const next = structuredClone(state);
  next.day += 1;
  marketDawn(next);
  return next;
};

const opened = (openDay: number, change: (state: GameState) => void = () => {}): GameState =>
  fullTown(state => { state.town.market = { openDay, lensDay: null }; change(state); });

describe('when the square opens', () => {
  it('counts a town as full once everyone is housed, every stall kept and nothing more can come', () => {
    expect(townFull(fullTown())).toBe(true);
    expect(townFull(fullTown(state => { state.town.traveller = { name: 'Ralf', arrivedDay: 99, refusals: 0, askedDay: null }; }))).toBe(false);
    expect(townFull(fullTown(state => { state.town.people[3] = { ...state.town.people[3], house: null }; }))).toBe(false);
    expect(townFull(fullTown(state => { state.town.people = state.town.people.slice(0, 14); }))).toBe(false);
    const unkept = JOB_IDS.filter(job => job !== 'eggStall');
    expect(townFull(fullTown(state => { state.town.houses[14] = built(60); }, unkept))).toBe(false);
  });

  it('counts a camp with no orchard as full at fourteen people', () => {
    const noOrchard = JOB_IDS.filter(job => job !== 'orchard');
    const state = fullTown(each => { each.structures.orchard = false; }, noOrchard);
    expect(state.town.people).toHaveLength(14);
    expect(townFull(state)).toBe(true);
    // With an orchard, its job would be free, and the town not yet full.
    expect(townFull({ ...state, structures: { ...state.structures, orchard: true } })).toBe(false);
  });

  it('waits for the old road to be cleared and its milestone set', () => {
    expect(roadReady(fullTown())).toBe(true);
    const unmarked = fullTown(state => { state.town.road = { ...state.town.road, milestone: 3, doneDays: { road: 60 } }; });
    expect(roadReady(unmarked)).toBe(false);
    expect(dawned(unmarked).town.market.openDay).toBeNull();
  });

  it('opens on the first dawn the town is full and the road ready, and stays open when a job frees up later', () => {
    expect(dawned(fullTown()).town.market.openDay).toBe(101);
    const later = dawned(opened(90, state => { state.structures.orchard = true; state.town.people = state.town.people.filter(person => person.job !== 'orchard'); }));
    expect(later.town.market.openDay).toBe(90);
  });
});

describe('the market\'s days', () => {
  it('comes two dawns after the square opens, then every fifth day', () => {
    const market = (day: number) => opened(100, state => { state.day = day; });
    expect(firstMarketDay(market(100))).toBe(102);
    expect(firstMarketDay(fullTown())).toBeNull();
    expect([102, 107, 112].map(day => isMarketDay(market(day)))).toEqual([true, true, true]);
    expect([100, 101, 103, 106].map(day => isMarketDay(market(day)))).toEqual([false, false, false, false]);
    expect([101, 106].map(day => isMarketEve(market(day)))).toEqual([true, true]);
    expect(isMarketEve(market(102))).toBe(false);
  });

  it('clears the stalls at the dawn after each market, and at no other', () => {
    const stocked = (day: number) => opened(100, state => {
      state.day = day;
      state.town.square.stock = Object.fromEntries(STALL_IDS.map(id => [id, 5])) as GameState['town']['square']['stock'];
    });
    expect(Object.values(dawned(stocked(102)).town.square.stock)).toEqual([0, 0, 0, 0, 0]);
    for (const day of [101, 103, 104]) expect(Object.values(dawned(stocked(day)).town.square.stock)).toEqual([5, 5, 5, 5, 5]);
  });

  it('clears the stalls after both markets over eleven nights of sleep, with the keepers stocking again the same dawn', () => {
    let state = opened(100, each => { each.day = 101; });
    const cleared: number[] = [];
    for (let night = 0; night < 11; night++) {
      // An empty larder, so the keepers have nothing to add and only the traders change the stock.
      state.town.square.stock = Object.fromEntries(STALL_IDS.map(id => [id, 5])) as GameState['town']['square']['stock'];
      state = applyAction({ ...state, timeOfDay: 230 }, { type: 'sleep' }).state;
      if (state.town.square.stock.bread === 0) cleared.push(state.day);
    }
    expect(state.day).toBe(112);
    expect(cleared).toEqual([103, 108]);
  });
});

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
}

describe('the market in the save', () => {
  const accepts = (state: GameState) => saveGame(new MemoryStorage(), state).ok;

  it('accepts a market not yet open, an open one, and one whose lens was given', () => {
    expect(accepts(fullTown())).toBe(true);
    expect(accepts(opened(90))).toBe(true);
    expect(accepts(opened(90, state => { state.town.market.lensDay = 92; }))).toBe(true);
  });

  it.each([
    ['no market at all', (state: GameState) => { delete (state.town as Partial<GameState['town']>).market; }],
    ['an open day that is not a whole day', (state: GameState) => { state.town.market.openDay = 90.5; }],
    ['an open day after today', (state: GameState) => { state.town.market.openDay = 101; }],
    ['an open square with a stall unkept', (state: GameState) => { state.town.people = state.town.people.filter(person => person.job !== 'eggStall'); }],
    ['an open square before the milestone was set', (state: GameState) => { state.town.road.doneDays.milestone = 95; }],
    ['an open square with no milestone', (state: GameState) => { state.town.road = { ...state.town.road, milestone: 3, doneDays: { road: 60 } }; }],
    ['a lens with the square never opened', (state: GameState) => { state.town.market = { openDay: null, lensDay: 95 }; }],
    ['a lens before the first market', (state: GameState) => { state.town.market.lensDay = 91; }],
    ['a lens after today', (state: GameState) => { state.town.market.lensDay = 101; }]
  ])('rejects %s', (_, change) => {
    expect(accepts(opened(90, change))).toBe(false);
  });

  it('brings a version 43 save up with the market unopened, and opens it at the next dawn when the town is already full', () => {
    const old = fullTown() as unknown as { town: Record<string, unknown> };
    delete old.town.market;
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 43, state: old }));
    const loaded = loadGame(storage);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;
    expect(loaded.state.town.market).toEqual({ openDay: null, lensDay: null });
    expect(applyAction({ ...loaded.state, timeOfDay: 230 }, { type: 'sleep' }).state.town.market.openDay).toBe(101);
  });
});

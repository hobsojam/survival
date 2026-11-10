// EASTER EGG: the town, see src/game/town.ts. A full town ready for market day, shared by the market's tests.
import { STALL_IDS } from '../src/game/square';
import type { GameState } from '../src/game/state';
import { JOB_IDS, TOWN_NAMES, type JobId, type Person } from '../src/game/town';
import { finishedCastleCamp, street } from './townStreet';

export const built = (doneDay: number) => ({ stone: 30, beams: 4, fittings: 1, doneDay });
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

/** The full town with the square opened on the given day. */
export const opened = (openDay: number, change: (state: GameState) => void = () => {}): GameState =>
  fullTown(state => { state.town.market = { openDay, lensDay: null }; change(state); });

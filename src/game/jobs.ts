import { COOP_SITE } from './chickens';
import { addFood, storeTotal } from './food';
import { BALANCE, foodStoreCapacity, type AreaId, type GameState } from './state';
import type { JobId } from './town';

// EASTER EGG: the town, see src/game/town.ts. A worker takes over one of the survivor's regular jobs and does it every
// dawn without fail. What won't fit is left where it is for another day, so nothing is wasted.

export interface Job {
  /** How the job is put to someone at the door: "{name} could {offer}." */
  offer: string;
  /** Whether the camp has what the job needs. */
  open: (state: GameState) => boolean;
  /** Where the worker stands by day. */
  spot: { area: AreaId; x: number; y: number };
  /** The job's work on the day just begun. */
  dawn: (next: GameState) => void;
}

const larderRoom = (state: GameState): number => Math.max(0, foodStoreCapacity(state) - storeTotal(state.larder));

export const JOBS: Record<JobId, Job> = {
  hens: {
    offer: 'look after the hens',
    open: state => state.chickens.rescued && state.structures.chickenCoop && state.structures.larder,
    spot: { area: 'camp', x: COOP_SITE.x + 1, y: COOP_SITE.y + 0.5 },
    dawn: next => {
      const moved = Math.min(next.chickens.eggs, larderRoom(next));
      if (moved <= 0) return;
      next.chickens = { ...next.chickens, eggs: next.chickens.eggs - moved };
      next.larder = addFood(next.larder, 'egg', moved, next.day);
    }
  },
  honey: {
    offer: 'keep the bees',
    open: state => state.structures.beehive && state.structures.larder,
    spot: { area: 'camp', x: BALANCE.campX + 3, y: BALANCE.campY - 6.5 },
    // A hive emptied waits for no one: the bees make the next honey at the next dawn they are due, as after taking it by hand.
    dawn: next => {
      const moved = Math.min(next.beehive.honey, larderRoom(next));
      if (moved <= 0) return;
      next.beehive = { ...next.beehive, honey: next.beehive.honey - moved };
      next.larder = addFood(next.larder, 'honey', moved, next.day);
    }
  }
};

/** The order jobs are offered in. */
export const JOB_ORDER: readonly JobId[] = ['hens', 'honey'];

const held = (state: GameState, job: JobId): boolean => state.town.people.some(person => person.job === job);

/** The first job the camp has ready that no one holds yet, or null. */
export function openJob(state: GameState): JobId | null {
  return JOB_ORDER.find(job => !held(state, job) && JOBS[job].open(state)) ?? null;
}

/** Each worker does their job at dawn. */
export function jobsDawn(next: GameState): void {
  for (const job of JOB_ORDER) if (held(next, job) && JOBS[job].open(next)) JOBS[job].dawn(next);
}

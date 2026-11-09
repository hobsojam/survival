import { milledFlour, milledState } from './bakehouse';
import { emptyBed, needsWater } from './beds';
import { isSpring, isWinter, yearOf } from './calendar';
import { COOP_SITE } from './chickens';
import { cutField, sownField, stripStage, threshGrain, threshedField } from './field';
import { addFood, storeTotal } from './food';
import { hasWoodStore, woodStoreCapacity } from './home';
import { treeRipe } from './orchard';
import { fedSheep, shornSheep } from './sheep';
import { BALANCE, foodStoreCapacity, type AreaId, type GameState } from './state';
import { JOB_IDS, type JobId } from './town';

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
const campSpot = (dx: number, dy: number) => ({ area: 'camp' as const, x: BALANCE.campX + dx, y: BALANCE.campY + dy });

/** How much wood the wood worker brings in each dawn. */
export const WORKER_WOOD = 2;

/** The shelf's loaves moved into the larder, oldest first, as far as it has room. Each keeps its bake day. */
function loavesDawn(next: GameState): void {
  const shelf = [...next.bakery.shelf].sort((a, b) => a - b);
  const moved = shelf.slice(0, larderRoom(next));
  if (moved.length === 0) return;
  for (const baked of moved) next.larder = addFood(next.larder, 'bread', 1, baked);
  next.bakery = { ...next.bakery, shelf: shelf.slice(moved.length) };
}

/** A little more wood in the store, never past what it holds. */
function woodDawn(next: GameState): void {
  next.storedWood = Math.min(woodStoreCapacity(next), next.storedWood + WORKER_WOOD);
}

/** Outside winter: ripe beds are picked into the larder if the whole crop fits, empty beds sown, and, with a well, the growing beds watered. */
function bedsWorkDawn(next: GameState): void {
  if (isWinter(next.day)) return;
  next.beds = next.beds.map(bed => {
    if (bed.sown && bed.grown >= BALANCE.cropGrowDays) {
      if (larderRoom(next) < BALANCE.cropYield) return bed;
      next.larder = addFood(next.larder, 'vegetables', BALANCE.cropYield, next.day);
      return { ...emptyBed(), sown: true };
    }
    return bed.sown ? bed : { ...emptyBed(), sown: true };
  });
  if (next.structures.well) next.beds = next.beds.map(bed => (needsWater(bed) ? { ...bed, wateredDay: next.day } : bed));
}

/** Stooks threshed while a whole strip's grain fits, gold strips cut, bare strips sown in spring while seed lasts, and the grain milled. */
function fieldDawn(next: GameState): void {
  next.field.strips.forEach((strip, index) => {
    if (strip.cut && threshGrain(next) === BALANCE.grainPerStrip) next.field = threshedField(next, index).field;
  });
  next.field.strips.forEach((strip, index) => {
    if (stripStage(strip, next.day) === 'gold') next.field = cutField(next, index);
  });
  if (isSpring(next.day)) next.field.strips.forEach((strip, index) => {
    if (strip.sownDay === null && !strip.cut && next.field.seed > 0) next.field = sownField(next, index);
  });
  if (next.structures.windmill && milledFlour(next) > 0) Object.assign(next, milledState(next).state);
}

/** Feed put out once the last has run out, and in spring the flock shorn, if the basket has room for all its wool. */
function sheepWorkDawn(next: GameState): void {
  const { sheep } = next;
  if ((sheep.fedUntil === null || next.day >= sheep.fedUntil) && next.field.straw > 0) Object.assign(next, fedSheep(next));
  const shearable = isSpring(next.day) && next.sheep.lastShornYear !== yearOf(next.day) && next.sheep.fluff >= BALANCE.fluffOnArrival;
  if (shearable && next.sheep.wool + BALANCE.woolPerShearing <= BALANCE.woolCapacity) Object.assign(next, shornSheep(next).state);
}

/** An apple from each ripe tree into the larder while it has room, and the tree ripens again a few days on. */
function orchardDawn(next: GameState): void {
  next.orchard = { ...next.orchard, trees: next.orchard.trees.map(tree => {
    if (!tree || !treeRipe(tree, next.day) || larderRoom(next) < 1) return tree;
    next.larder = addFood(next.larder, 'apple', 1, next.day);
    return { ...tree, ripeDay: next.day + BALANCE.orchardRipenDays };
  }) };
}

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
  },
  loaves: {
    offer: 'see to the bread',
    open: state => state.structures.bakery && state.structures.larder,
    spot: campSpot(-0.5, -9),
    dawn: loavesDawn
  },
  wood: {
    offer: 'keep the wood store stocked',
    open: hasWoodStore,
    spot: campSpot(6.5, -0.5),
    dawn: woodDawn
  },
  beds: {
    offer: 'tend the vegetable beds',
    open: state => state.structures.vegetableBeds && state.structures.larder,
    spot: campSpot(-4.5, 1.5),
    dawn: bedsWorkDawn
  },
  field: {
    offer: 'work the field and the mill',
    open: state => state.structures.field && state.structures.granary && state.progress.workshop.harvestTools,
    spot: campSpot(0.5, 7.5),
    dawn: fieldDawn
  },
  sheep: {
    offer: 'look after the sheep',
    open: state => state.sheep.arrived && state.progress.workshop.shears,
    spot: campSpot(12.5, -9.5),
    dawn: sheepWorkDawn
  },
  orchard: {
    offer: 'pick the orchard',
    open: state => state.structures.orchard && state.structures.larder,
    spot: { area: 'camp', x: 6, y: 11.5 },
    dawn: orchardDawn
  }
};

/** The order jobs are offered in. */
export const JOB_ORDER: readonly JobId[] = JOB_IDS;

const held = (state: GameState, job: JobId): boolean => state.town.people.some(person => person.job === job);

/** The jobs the camp has ready that no one holds yet, in the order they are offered. */
export function openJobs(state: GameState): JobId[] {
  return JOB_ORDER.filter(job => !held(state, job) && JOBS[job].open(state));
}

/** The first job the camp has ready that no one holds yet, or null. */
export function openJob(state: GameState): JobId | null {
  return openJobs(state)[0] ?? null;
}

/** Each worker does their job at dawn. */
export function jobsDawn(next: GameState): void {
  for (const job of JOB_ORDER) if (held(next, job) && JOBS[job].open(next)) JOBS[job].dawn(next);
}

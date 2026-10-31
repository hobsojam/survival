import { isWinter } from './calendar';
import { freeSpaces, isInClearing } from './camp';
import { TOO_TIRED_MESSAGE, isExhausted } from './needs';
import { rainWindow } from './rain';
import { BALANCE, type GameState } from './state';

// Three raised beds on the west ground, each with its own crop. A bed keeps its seed through every harvest and every withering,
// so an empty bed can always be sown again for nothing. It grows a day at each dawn after a watered day, dries on a dry one,
// and withers after four dry days (five with the workshop's bed tools); a ripe crop waits safely, and winter pauses everything.

export const BED_CROPS = ['potatoes', 'beans', 'carrots'] as const;
export type Crop = (typeof BED_CROPS)[number];

export interface Bed {
  sown: boolean;
  /** Days the crop has grown; ripe at BALANCE.cropGrowDays. */
  grown: number;
  /** Dry days in a row since it was last watered. */
  dryDays: number;
  /** The last day water was drawn for it. */
  wateredDay: number | null;
}

export type BedStage = 'empty' | 'sprout' | 'growing' | 'ripe';
export type BedSoil = 'fresh' | 'dry' | 'wilted' | 'frost';

/**
 * How many dry days in a row a bed takes to show dry soil, to stop growing, and to wither. The workshop's hoe and
 * watering can move each of them a day later.
 */
export function dryLimitsFor(bedTools: boolean): { dry: number; stall: number; wither: number } {
  return bedTools ? { dry: 3, stall: 4, wither: 5 } : { dry: 2, stall: 3, wither: 4 };
}

export const dryLimits = (state: Pick<GameState, 'progress'>) => dryLimitsFor(state.progress.workshop.bedTools);

export const emptyBed = (): Bed => ({ sown: false, grown: 0, dryDays: 0, wateredDay: null });

export function bedStage(bed: Bed): BedStage {
  if (!bed.sown) return 'empty';
  if (bed.grown >= BALANCE.cropGrowDays) return 'ripe';
  return bed.grown === 0 ? 'sprout' : 'growing';
}

export function bedSoil(state: GameState, bed: Bed): BedSoil {
  if (isWinter(state.day)) return 'frost';
  const { dry, stall } = dryLimits(state);
  if (bed.dryDays >= stall) return 'wilted';
  return bed.dryDays >= dry ? 'dry' : 'fresh';
}

/** Whether a bed had water on a day: drawn for it from the well, or a spring shower. */
export function wateredOn(_state: GameState, bed: Bed, day: number): boolean {
  return bed.wateredDay === day || rainWindow(day) !== null;
}

/** One growing bed at the dawn that ends `day`: watered, it grows and is fresh again; dry, it grows twice more, stalls, then withers. */
function grownBed(state: GameState, bed: Bed, day: number): Bed {
  if (!bed.sown || bed.grown >= BALANCE.cropGrowDays) return bed;
  const dryDays = wateredOn(state, bed, day) ? 0 : bed.dryDays + 1;
  const { stall, wither } = dryLimits(state);
  if (dryDays >= wither) return emptyBed();
  const grown = dryDays < stall ? bed.grown + 1 : bed.grown;
  // A ripe crop never dries out while it waits to be picked.
  return { ...bed, grown, dryDays: grown >= BALANCE.cropGrowDays ? 0 : dryDays };
}

/** Updates every bed from the day that just ended, unless that day was in winter, when the beds rest as they are. */
export function bedsDawn(next: GameState, endedDay: number): void {
  if (isWinter(endedDay)) return;
  next.beds = next.beds.map(bed => grownBed(next, bed, endedDay));
}

/** A sown bed that isn't ripe yet: the only kind that water helps. */
export const needsWater = (bed: Bed): boolean => bed.sown && bed.grown < BALANCE.cropGrowDays;

const validIndex = (index: number): boolean => Number.isInteger(index) && index >= 0 && index < BED_CROPS.length;

/** The refusals both sowing and harvesting share: a real bed, built, and the survivor in the clearing. */
function tendBlocker(state: GameState, index: number): string | null {
  if (!validIndex(index)) return 'That bed is unavailable.';
  if (!state.structures.vegetableBeds) return 'Build the vegetable beds first.';
  if (!isInClearing(state)) return 'Return to camp to tend the beds.';
  return null;
}

export function sowBedBlocker(state: GameState, index: number): string | null {
  const blocker = tendBlocker(state, index);
  if (blocker) return blocker;
  if (isWinter(state.day)) return 'The beds rest in winter. Sow again in spring.';
  if (state.beds[index].sown) return 'That bed is already growing.';
  if (isExhausted(state)) return TOO_TIRED_MESSAGE;
  return null;
}

export function harvestBedBlocker(state: GameState, index: number): string | null {
  const blocker = tendBlocker(state, index);
  if (blocker) return blocker;
  if (bedStage(state.beds[index]) !== 'ripe') return 'That bed is not ready yet.';
  if (freeSpaces(state) < BALANCE.cropYield) return `Make room for ${BALANCE.cropYield} vegetables before harvesting.`;
  if (isExhausted(state)) return TOO_TIRED_MESSAGE;
  return null;
}

/** Why water can't be drawn for the beds now, or null: it waters every sown bed still growing, once a day, and not after the rain has. */
export function drawWaterBlocker(state: GameState): string | null {
  if (!state.structures.well) return 'Build the well first.';
  if (!isInClearing(state)) return 'Return to camp to draw water.';
  if (isWinter(state.day)) return 'The beds are resting for winter.';
  const thirsty = state.beds.filter(needsWater);
  if (thirsty.length === 0) return 'Nothing in the beds needs water.';
  if (thirsty.every(bed => bed.wateredDay === state.day)) return 'The beds are already watered today.';
  const rain = rainWindow(state.day);
  if (rain && state.timeOfDay >= rain.start) return 'The rain has watered the beds today.';
  if (isExhausted(state)) return TOO_TIRED_MESSAGE;
  return null;
}

/** "carrots", "potatoes and carrots", or "potatoes, beans and carrots". */
function cropList(crops: Crop[]): string {
  return crops.length > 1 ? `${crops.slice(0, -1).join(', ')} and ${crops.at(-1)}` : crops[0];
}

/** The morning line for beds that withered in the dry, or null. Only a growing bed can wither, so a harvest never reads as one. */
export function witheredMessage(before: GameState, after: GameState): string | null {
  const withered = BED_CROPS.filter((_, index) => {
    const was = before.beds[index], now = after.beds[index];
    return was?.sown && bedStage(was) !== 'ripe' && now && !now.sown;
  });
  if (withered.length === 0) return null;
  return `The ${cropList(withered)} withered in the dry. You saved the seed.`;
}

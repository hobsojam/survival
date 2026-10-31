import { isWinter } from './calendar';
import { freeSpaces, isInClearing } from './camp';
import { TOO_TIRED_MESSAGE, isExhausted } from './needs';
import { rainWindow } from './rain';
import { BALANCE, type GameState } from './state';

// Three raised beds on the west ground, each with its own crop. A bed keeps its seed through every harvest and every withering,
// so an empty bed can always be sown again for nothing. It grows a day at each dawn after a watered day, dries on a dry one,
// and withers after four dry days; a ripe crop waits safely, and winter pauses everything.

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

/** A bed's fourth dry day in a row withers it; on its third it stops growing. */
const WITHER_DAYS = 4;
const STALL_DAYS = 3;

export const emptyBed = (): Bed => ({ sown: false, grown: 0, dryDays: 0, wateredDay: null });

export function bedStage(bed: Bed): BedStage {
  if (!bed.sown) return 'empty';
  if (bed.grown >= BALANCE.cropGrowDays) return 'ripe';
  return bed.grown === 0 ? 'sprout' : 'growing';
}

export function bedSoil(state: GameState, bed: Bed): BedSoil {
  if (bed.sown && isWinter(state.day)) return 'frost';
  if (bed.dryDays >= STALL_DAYS) return 'wilted';
  return bed.dryDays === 2 ? 'dry' : 'fresh';
}

/** Whether a bed had water on a day: drawn for it from the well, or a spring shower. */
export function wateredOn(_state: GameState, bed: Bed, day: number): boolean {
  return bed.wateredDay === day || rainWindow(day) !== null;
}

/** One growing bed at the dawn that ends `day`: watered, it grows and is fresh again; dry, it grows twice more, stalls, then withers. */
function grownBed(state: GameState, bed: Bed, day: number): Bed {
  if (!bed.sown || bed.grown >= BALANCE.cropGrowDays) return bed;
  const dryDays = wateredOn(state, bed, day) ? 0 : bed.dryDays + 1;
  if (dryDays >= WITHER_DAYS) return emptyBed();
  const grown = dryDays < STALL_DAYS ? bed.grown + 1 : bed.grown;
  // A ripe crop never dries out while it waits to be picked.
  return { ...bed, grown, dryDays: grown >= BALANCE.cropGrowDays ? 0 : dryDays };
}

/** Updates every bed from the day that just ended, unless that day was in winter, when the beds rest as they are. */
export function bedsDawn(next: GameState, endedDay: number): void {
  if (isWinter(endedDay)) return;
  next.beds = next.beds.map(bed => grownBed(next, bed, endedDay));
}

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

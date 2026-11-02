import { YEAR_LENGTH, isSpring, isSummer, yearOf } from './calendar';
import { isInClearing } from './camp';
import { TOO_TIRED_MESSAGE, isExhausted } from './needs';
import { BALANCE, type GameState } from './state';

// The grain field on the south far ground: four strips sown in spring that ripen gold on summer's fifth day and wait,
// however long, to be cut and threshed. Threshed grain goes into the granary, which holds one harvest and no more, and
// every threshed strip keeps back one strip's seed for next year.

export const FIELD_STRIPS = 4;

export interface FieldStrip {
  /** The day the strip was sown, or null while it lies bare. */
  sownDay: number | null;
  /** Cut and standing in stooks, waiting to be threshed. */
  cut: boolean;
}

export interface FieldState {
  strips: FieldStrip[];
  /** Seed kept for sowing, counted in strips. */
  seed: number;
  /** Grain in the granary. */
  grain: number;
}

export const bareStrip = (): FieldStrip => ({ sownDay: null, cut: false });

export const emptyField = (): FieldState => ({ strips: Array.from({ length: FIELD_STRIPS }, bareStrip), seed: 0, grain: 0 });

/** The first day a strip sown on `sownDay` is ripe: summer's fifth day of the same year. */
export function ripeDay(sownDay: number): number {
  return (yearOf(sownDay) - 1) * YEAR_LENGTH + BALANCE.grainRipeDayOfYear;
}

export type StripStage = 'bare' | 'shoots' | 'green' | 'gold' | 'stooks';

/** How a strip looks on a day: bare, green shoots in spring, tall and green in summer, gold once ripe, stooks once cut. */
export function stripStage(strip: FieldStrip, day: number): StripStage {
  if (strip.sownDay === null) return 'bare';
  if (strip.cut) return 'stooks';
  if (day >= ripeDay(strip.sownDay)) return 'gold';
  return isSummer(day) ? 'green' : 'shoots';
}

const validIndex = (index: number): boolean => Number.isInteger(index) && index >= 0 && index < FIELD_STRIPS;

/** The refusals every job on the field shares: a real strip, the field built, and the survivor in the clearing. */
function fieldBlocker(state: GameState, index: number): string | null {
  if (!validIndex(index)) return 'That strip is unavailable.';
  if (!state.structures.field) return 'Build the field first.';
  if (!isInClearing(state)) return 'Return to camp to work the field.';
  return null;
}

const NO_TOOLS = 'Make a sickle and flail at the workshop first.';

export function sowStripBlocker(state: GameState, index: number): string | null {
  const blocker = fieldBlocker(state, index);
  if (blocker) return blocker;
  if (!isSpring(state.day)) return 'Sow the field in spring.';
  const strip = state.field.strips[index];
  if (strip.cut) return 'Thresh that strip before sowing it again.';
  if (strip.sownDay !== null) return 'That strip is already sown.';
  if (state.field.seed <= 0) return 'You have no seed. Gather wild grain at the edge of the clearing.';
  if (isExhausted(state)) return TOO_TIRED_MESSAGE;
  return null;
}

export function cutStripBlocker(state: GameState, index: number): string | null {
  const blocker = fieldBlocker(state, index);
  if (blocker) return blocker;
  if (stripStage(state.field.strips[index], state.day) !== 'gold') return 'That strip isn\'t ripe yet.';
  if (!state.progress.workshop.harvestTools) return NO_TOOLS;
  if (isExhausted(state)) return TOO_TIRED_MESSAGE;
  return null;
}

export function threshStripBlocker(state: GameState, index: number): string | null {
  const blocker = fieldBlocker(state, index);
  if (blocker) return blocker;
  if (!state.field.strips[index].cut) return 'Cut that strip before threshing it.';
  if (!state.progress.workshop.harvestTools) return NO_TOOLS;
  if (!state.structures.granary) return 'Build the granary first.';
  if (isExhausted(state)) return TOO_TIRED_MESSAGE;
  return null;
}

/** Grain a thresh would add to the granary now: a strip's worth, or only what still fits. */
export function threshGrain(state: GameState): number {
  return Math.max(0, Math.min(BALANCE.grainPerStrip, BALANCE.granaryCapacity - state.field.grain));
}

/** The field after sowing a strip from the seed kept. */
export function sownField(state: GameState, index: number): FieldState {
  const strips = state.field.strips.map((strip, i) => i === index ? { sownDay: state.day, cut: false } : strip);
  return { ...state.field, strips, seed: state.field.seed - 1 };
}

/** The field after cutting a strip into stooks. */
export function cutField(state: GameState, index: number): FieldState {
  return { ...state.field, strips: state.field.strips.map((strip, i) => i === index ? { ...strip, cut: true } : strip) };
}

/** The field after threshing a strip: bare again, its grain in the granary as far as it fits, and a strip's seed kept. */
export function threshedField(state: GameState, index: number): { field: FieldState; message: string } {
  const stored = threshGrain(state);
  const field = {
    strips: state.field.strips.map((strip, i) => i === index ? bareStrip() : strip),
    seed: Math.min(FIELD_STRIPS, state.field.seed + 1),
    grain: state.field.grain + stored
  };
  if (stored === 0) return { field, message: 'The granary is already full. You kept the seed, and the rest stays as straw.' };
  if (stored < BALANCE.grainPerStrip) return { field, message: 'Threshed the strip. The granary is full now, and the rest stays as straw.' };
  return { field, message: `Threshed the strip. ${stored} grain went into the granary.` };
}

import { YEAR_LENGTH, yearOf } from './calendar';
import { BALANCE } from './state';

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

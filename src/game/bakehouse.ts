import { isInClearing } from './clearing';
import { TOO_TIRED_MESSAGE, isExhausted } from './needs';
import { BALANCE, type GameState } from './state';

// The windmill and the bakery: the mill grinds a whole granary of grain into its flour bin in one job, and the bakery's
// oven bakes a loaf from that flour each morning onto a small shelf, waiting while the shelf is full.

/** Flour a mill job would grind now: every two grain in the granary, as far as the bin has room. */
export function milledFlour(state: GameState): number {
  return Math.max(0, Math.min(Math.floor(state.field.grain / BALANCE.grainPerFlour), BALANCE.millFlourCapacity - state.millFlour));
}

/** Why the windmill can't grind now, or null. */
export function millGrainBlocker(state: GameState): string | null {
  if (!state.structures.windmill) return 'Build the windmill first.';
  if (!isInClearing(state)) return 'Return to camp to mill the grain.';
  if (state.field.grain < BALANCE.grainPerFlour) return 'There isn\'t enough grain in the granary to mill.';
  if (state.millFlour >= BALANCE.millFlourCapacity) return 'The mill\'s flour bin is full.';
  if (isExhausted(state)) return TOO_TIRED_MESSAGE;
  return null;
}

/** The state after a mill job, before its time and effort, with the message saying what it ground. */
export function milledState(state: GameState): { state: GameState; message: string } {
  const flour = milledFlour(state);
  const millFlour = state.millFlour + flour;
  const grain = state.field.grain - flour * BALANCE.grainPerFlour;
  const full = millFlour >= BALANCE.millFlourCapacity && grain >= BALANCE.grainPerFlour ? ' The bin is full.' : '';
  return {
    state: { ...state, millFlour, field: { ...state.field, grain } },
    message: `The sails turn, and the millstones grind ${flour} flour.${full}`
  };
}

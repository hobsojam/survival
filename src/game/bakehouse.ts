import { freeSpaces } from './camp';
import { isInClearing } from './clearing';
import { addFood, emptyFood, spoil } from './food';
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

/**
 * The bakery's dawn, on the day just begun: shelf loaves five dawns old are thrown out, by the larder's rule, then the oven
 * bakes one loaf from the mill's flour if the shelf has room. Returns how many loaves went soft.
 */
export function bakeryDawn(next: GameState): { lost: number } {
  if (!next.structures.bakery) return { lost: 0 };
  const kept = spoil({ ...emptyFood(), bread: next.bakery.shelf }, next.day, BALANCE.larderFreshDays);
  const shelf = kept.store.bread;
  const bakes = next.millFlour >= 1 && shelf.length < BALANCE.bakeryShelfCapacity;
  // A bake the morning after another carries on; any other starts the oven afresh, which the morning line remarks on.
  const resumed = bakes && next.bakery.lastBaked !== next.day - 1 ? next.day : next.bakery.resumed;
  next.bakery = bakes ? { shelf: [...shelf, next.day], lastBaked: next.day, resumed } : { ...next.bakery, shelf };
  if (bakes) next.millFlour -= 1;
  return { lost: kept.lost.bread };
}

/** The morning line when the oven bakes for the first time, or again after a morning it didn't, however many dawns passed. */
export function bakeryNews(before: GameState, after: GameState): string | null {
  return after.day > before.day && after.bakery.resumed === after.day ? 'Fresh bread from the oven this morning.' : null;
}

/** Why a loaf can't come off the bakery shelf now, or null. */
export function takeLoafBlocker(state: GameState): string | null {
  if (!state.structures.bakery) return 'Build the bakery first.';
  if (!isInClearing(state)) return 'Return to camp to take a loaf.';
  if (state.bakery.shelf.length === 0) return 'There\'s no loaf on the shelf yet.';
  if (freeSpaces(state) < 1) return 'Make room in your bag for the loaf.';
  return null;
}

/** The oldest loaf moved from the shelf into the bag, keeping its bake day. */
export function takenLoaf(state: GameState): GameState {
  const shelf = [...state.bakery.shelf].sort((a, b) => a - b);
  const [oldest, ...rest] = shelf;
  return { ...state, bakery: { ...state.bakery, shelf: rest }, inventory: { ...state.inventory, food: addFood(state.inventory.food, 'bread', 1, oldest) } };
}

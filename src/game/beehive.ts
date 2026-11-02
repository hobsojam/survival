import { freeSpaces } from './camp';
import { isInClearing } from './clearing';
import { addFood } from './food';
import { BALANCE, type GameState } from './state';

// The beehive: a straw skep whose bees make one honey every few dawns, in every season, and keep up to two for the
// taking. While the hive is full the bees wait, and make the next honey at the first dawn after it is emptied.

/** The hive's dawn, on the day just begun: one more honey if the bees are due and the hive has room. */
export function beehiveDawn(next: GameState): void {
  const { honey, nextHoney } = next.beehive;
  if (!next.structures.beehive || nextHoney === null || next.day < nextHoney || honey >= BALANCE.hiveHoneyCapacity) return;
  next.beehive = { honey: honey + 1, nextHoney: next.day + BALANCE.hiveHoneyDays };
}

/** Why the honey can't come out of the hive now, or null. */
export function takeHoneyBlocker(state: GameState): string | null {
  if (!state.structures.beehive) return 'Build the beehive first.';
  if (!isInClearing(state)) return 'Return to camp to take the honey.';
  if (state.beehive.honey === 0) return 'The bees have no honey for you yet.';
  if (freeSpaces(state) < 1) return 'Make room in your bag for the honey.';
  return null;
}

/** The waiting honey moved into the bag, as much as fits, and how much that was. */
export function takenHoney(state: GameState): { state: GameState; taken: number } {
  const taken = Math.min(state.beehive.honey, freeSpaces(state));
  return {
    state: { ...state, beehive: { ...state.beehive, honey: state.beehive.honey - taken }, inventory: { ...state.inventory, food: addFood(state.inventory.food, 'honey', taken, state.day) } },
    taken
  };
}

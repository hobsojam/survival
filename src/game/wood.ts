import type { GameState } from './state';

/** Wood a build or the fire can use: the bag plus the woodpile, which counts from anywhere. */
export function availableWood(state: GameState): number {
  return state.inventory.wood + state.storedWood;
}

/** Pays wood from the bag first, then from the woodpile. */
export function spendWood(state: GameState, amount: number): GameState {
  const fromBag = Math.min(amount, state.inventory.wood);
  return { ...state, inventory: { ...state.inventory, wood: state.inventory.wood - fromBag }, storedWood: state.storedWood - (amount - fromBag) };
}

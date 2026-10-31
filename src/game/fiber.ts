import type { GameState } from './state';

/** Fiber a build, a craft or the fire can use: the bag plus the fibre stack, which counts from anywhere. */
export function availableFiber(state: GameState): number {
  return state.inventory.fiber + state.storedFiber;
}

/** Pays fiber from the bag first, then from the fibre stack. */
export function spendFiber(state: GameState, amount: number): GameState {
  const fromBag = Math.min(amount, state.inventory.fiber);
  return { ...state, inventory: { ...state.inventory, fiber: state.inventory.fiber - fromBag }, storedFiber: state.storedFiber - (amount - fromBag) };
}

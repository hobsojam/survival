import type { GameState } from './state';

/** Stone a build can use: the bag plus the camp stone pile, which counts from anywhere. */
export function availableStone(state: GameState): number {
  return state.inventory.stone + state.storedStone;
}

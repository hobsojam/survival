import { BALANCE, type GameState } from './state';

// Living in the house: where it stands, whether the survivor has moved in, and the wood store it adds.

/** Where the house stands: on the north side's far ground, up and to the right of the fire. */
export const HOUSE_SPOT = { x: BALANCE.campX + 4.5, y: BALANCE.campY - 6.5 } as const;

/** The survivor moves in the moment the house is built. */
export function livesInHouse(state: GameState): boolean {
  return state.structures.house;
}

/** The single wood store: the woodpile's share if it is built, and the woodshed's once the house stands. */
export function woodStoreCapacity(state: GameState): number {
  return (state.structures.woodpile ? BALANCE.woodpileCapacity : 0) + (state.structures.house ? BALANCE.woodshedCapacity : 0);
}

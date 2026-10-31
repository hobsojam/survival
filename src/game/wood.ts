import type { GameState } from './state';

/** Wood kept outside the bag: the woodpile and woodshed, and the handcart. */
export function logsInStore(state: GameState): number {
  return state.storedWood + state.cartWood;
}

/** Wood a build or the fire can use: the bag, the handcart and the wood store, which count from anywhere. */
export function availableWood(state: GameState): number {
  return state.inventory.wood + logsInStore(state);
}

/** Pays wood from the bag first, then the handcart, then the wood store. */
export function spendWood(state: GameState, amount: number): GameState {
  const fromBag = Math.min(amount, state.inventory.wood);
  const fromCart = Math.min(amount - fromBag, state.cartWood);
  return {
    ...state,
    inventory: { ...state.inventory, wood: state.inventory.wood - fromBag },
    cartWood: state.cartWood - fromCart,
    storedWood: state.storedWood - (amount - fromBag - fromCart)
  };
}

import { isInClearing } from './camp';
import { hasWoodStore, woodStoreCapacity } from './home';
import { BALANCE, type GameState } from './state';

// Building materials store themselves. Everything kept in a store already counts for building, crafting and the fires
// from anywhere, so in the clearing the bag's wood, fiber and stone go to their stores as far as there is room, and the
// handcart empties into the wood store. Food never moves by itself: the larder is the player's to fill and empty.

/** The bag and the handcart emptied into the camp stores while in the clearing; the same state if nothing moves. */
export function settleStores(state: GameState): GameState {
  if (!isInClearing(state)) return state;
  const { structures, inventory } = state;
  const woodRoom = hasWoodStore(state) ? woodStoreCapacity(state) - state.storedWood : 0;
  const wood = Math.max(0, Math.min(inventory.wood, woodRoom));
  const cart = Math.max(0, Math.min(state.cartWood, woodRoom - wood));
  const fiber = structures.fibreStack ? Math.max(0, Math.min(inventory.fiber, BALANCE.fibreStackCapacity - state.storedFiber)) : 0;
  const stone = structures.stonePile ? Math.max(0, Math.min(inventory.stone, BALANCE.stonePileCapacity - state.storedStone)) : 0;
  if (wood + cart + fiber + stone === 0) return state;
  return {
    ...state,
    inventory: { ...inventory, wood: inventory.wood - wood, fiber: inventory.fiber - fiber, stone: inventory.stone - stone },
    cartWood: state.cartWood - cart,
    storedWood: state.storedWood + wood + cart,
    storedFiber: state.storedFiber + fiber,
    storedStone: state.storedStone + stone
  };
}

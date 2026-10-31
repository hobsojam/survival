import { storeTotal } from './food';
import { BALANCE, type GameState } from './state';

export { isInClearing } from './clearing';
export { availableWood, spendWood } from './wood';
export { availableFiber, spendFiber } from './fiber';

// Where the survivor is and what their bag holds: plain reads of the state that the rules and the companion both use.

export function isAtCamp(state: GameState): boolean {
  return state.area === 'camp' && Math.hypot(state.player.x - BALANCE.campX, state.player.y - BALANCE.campY) <= BALANCE.campRadius;
}

/** Bag spaces one of this supply takes; stone is heavy, and each piece of food takes one. */
export function spaceFor(resource: keyof GameState['inventory']): number {
  return resource === 'stone' ? BALANCE.stoneSpaces : 1;
}

/** Bag spaces in use, counting stone at its weight. */
export function carriedCount(state: GameState): number {
  const { wood, fiber, stone, food } = state.inventory;
  return wood + fiber + stone * BALANCE.stoneSpaces + storeTotal(food);
}

export function bagCapacity(state: GameState): number {
  return state.structures.crate ? BALANCE.crateCapacity : BALANCE.baseCapacity;
}

export function freeSpaces(state: GameState): number {
  return bagCapacity(state) - carriedCount(state);
}

/** Stone a build can use: the bag plus the camp stone pile, which counts from anywhere. */
export function availableStone(state: GameState): number {
  return state.inventory.stone + state.storedStone;
}

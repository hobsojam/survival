import { storeTotal } from './food';
import { ponyWith } from './pony';
import { BALANCE, type GameState } from './state';

export { isInClearing } from './clearing';
export { availableWood, spendWood } from './wood';
export { availableFiber, spendFiber } from './fiber';
export { availableStone } from './stone';

// Where the survivor is and what their bag holds: plain reads of the state that the rules and the companion both use.

export function isAtCamp(state: GameState): boolean {
  return state.area === 'camp' && Math.hypot(state.player.x - BALANCE.campX, state.player.y - BALANCE.campY) <= BALANCE.campRadius;
}

/** Bag spaces one of this supply takes; stone is heavy, and each piece of food takes one. */
export function spaceFor(resource: keyof GameState['inventory']): number {
  return resource === 'stone' || resource === 'ore' ? BALANCE.stoneSpaces : 1;
}

/** Bag spaces in use, counting stone at its weight. */
export function carriedCount(state: GameState): number {
  const { wood, fiber, stone, ore, food } = state.inventory;
  return wood + fiber + (stone + ore) * BALANCE.stoneSpaces + storeTotal(food);
}

/** What the bag holds when the pony is with the survivor; a bag over its limit while the pony is elsewhere is a real one. */
export function fullCapacity(state: GameState): number {
  return (state.progress.packWoven ? BALANCE.packCapacity : BALANCE.baseCapacity) + (state.pony.shod === null ? 0 : BALANCE.ponySpaces);
}

export function bagCapacity(state: GameState): number {
  return (state.progress.packWoven ? BALANCE.packCapacity : BALANCE.baseCapacity) + (ponyWith(state) ? BALANCE.ponySpaces : 0);
}

export function freeSpaces(state: GameState): number {
  return bagCapacity(state) - carriedCount(state);
}


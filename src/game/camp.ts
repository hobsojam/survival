import { inClearing } from './clearing';
import { BALANCE, type GameState } from './state';

// Where the survivor is and what their bag holds: plain reads of the state that the rules and the companion both use.

export function isAtCamp(state: GameState): boolean {
  return state.area === 'camp' && Math.hypot(state.player.x - BALANCE.campX, state.player.y - BALANCE.campY) <= BALANCE.campRadius;
}

/** Whether the survivor stands anywhere in the camp clearing, including ground cleared beyond the fire's warmth. */
export function isInClearing(state: GameState): boolean {
  return state.area === 'camp' && inClearing(state.player.x, state.player.y, state.clearing.cleared);
}

/** Bag spaces one of this supply takes; stone is heavy. */
export function spaceFor(resource: keyof GameState['inventory']): number {
  return resource === 'stone' ? BALANCE.stoneSpaces : 1;
}

/** Bag spaces in use, counting stone at its weight. */
export function carriedCount(state: GameState): number {
  return (Object.keys(state.inventory) as (keyof GameState['inventory'])[])
    .reduce((total, resource) => total + state.inventory[resource] * spaceFor(resource), 0);
}

export function bagCapacity(state: GameState): number {
  return state.structures.crate ? BALANCE.crateCapacity : BALANCE.baseCapacity;
}

export function freeSpaces(state: GameState): number {
  return bagCapacity(state) - carriedCount(state);
}

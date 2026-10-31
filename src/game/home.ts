import { nightStart } from './calendar';
import { isAtCamp } from './camp';
import { BALANCE, type GameState } from './state';

// Living in the house: where it stands, whether the survivor has moved in, the wood store it adds,
// and the fireplace that feeds itself from that store at night and takes over the campfire's work.

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

/** Where the survivor sleeps, rests and cooks: by the house once they live there, otherwise by the campfire. */
export function isAtHome(state: GameState): boolean {
  if (!livesInHouse(state)) return isAtCamp(state);
  return state.area === 'camp' && Math.hypot(state.player.x - HOUSE_SPOT.x, state.player.y - HOUSE_SPOT.y) <= BALANCE.homeRadius;
}

/** The fuel in the fire that keeps the survivor warm at home: the fireplace's once they live in the house, otherwise the campfire's. */
export function warmFuel(state: GameState): number {
  return livesInHouse(state) ? state.fireplaceFuel : state.fireFuel;
}

/** Seconds of fire still to come: for the house, the fireplace and every log it will draw from the store; otherwise the campfire's fuel. */
export function fuelLeft(state: GameState): number {
  return livesInHouse(state) ? state.fireplaceFuel + state.storedWood * BALANCE.fireplaceSecondsPerWood : state.fireFuel;
}

/** One step of the fireplace inside advanceTime's loop: draw a log at night when empty, then burn. Mutates the working copy. */
export function tendFireplace(next: GameState, step: number, coldNight: boolean): void {
  // By day the fireplace is banked: whatever is left waits for nightfall.
  if (!livesInHouse(next) || next.timeOfDay < nightStart(next.day)) return;
  if (next.fireplaceFuel <= 0 && next.storedWood > 0) {
    next.storedWood -= 1;
    next.fireplaceFuel += BALANCE.fireplaceSecondsPerWood;
  }
  next.fireplaceFuel = Math.max(0, next.fireplaceFuel - step * (coldNight ? BALANCE.coldNightFireBurn : 1));
}

/** Whether the fireplace is alight now: only at night, while it has fuel. */
export function fireplaceBurning(state: GameState): boolean {
  return livesInHouse(state) && state.fireplaceFuel > 0 && state.timeOfDay >= nightStart(state.day);
}

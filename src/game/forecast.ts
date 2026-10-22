import { BALANCE, type GameState } from './state';
import { isColdNight } from './rules';

export interface StormReadiness {
  /** Seconds of fire the survivor can count on when it matters: at nightfall, or right now during the storm. */
  fuel: number;
  /** Seconds of fire the night still needs. */
  needed: number;
  ready: boolean;
  /** Logs still to find, beyond those already carried. */
  logsShort: number;
  storm: boolean;
}

export const secondsPerLog = (state: GameState) =>
  state.structures.hearth ? BALANCE.hearthFireSecondsPerWood : BALANCE.fireSecondsPerWood;

/** Whether the camp fire will last through the next cold night, counting wood in the bag. */
export function stormReadiness(state: GameState): StormReadiness {
  const perLog = secondsPerLog(state);
  const storm = isColdNight(state);
  const carried = state.inventory.wood * perLog;
  let fuel: number;
  let needed: number;
  if (storm) {
    fuel = state.fireFuel;
    needed = Math.ceil((BALANCE.daySeconds - state.timeOfDay) * BALANCE.coldNightFireBurn);
  } else {
    // The fire burns one second per second until nightfall; before the storm day it will be long out.
    const left = state.day === state.progress.nextStormDay ? Math.max(0, state.fireFuel - (BALANCE.nightStart - state.timeOfDay)) : 0;
    fuel = left + carried;
    needed = (BALANCE.daySeconds - BALANCE.nightStart) * BALANCE.coldNightFireBurn;
  }
  const ready = fuel > needed;
  const reach = storm ? fuel + carried : fuel;
  const logsShort = reach > needed ? 0 : Math.floor((needed - reach) / perLog) + 1;
  return { fuel, needed, ready, logsShort, storm };
}

/** The forecast card's fire line. */
export function forecastFireCheck(state: GameState): string {
  const { fuel, needed, ready, logsShort, storm } = stormReadiness(state);
  let hint = '';
  if (!ready && logsShort === 0) hint = ' · add a log';
  else if (!ready) hint = ` · ${logsShort} more log${logsShort === 1 ? '' : 's'}`;
  return `${ready ? '✓' : '○'} Fire: ${Math.ceil(fuel)} / ${needed}s ${storm ? 'to dawn' : 'for the night'}${hint}`;
}

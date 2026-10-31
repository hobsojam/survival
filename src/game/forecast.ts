import { nightStart } from './calendar';
import { BALANCE, type GameState } from './state';
import { isFreezingNight } from './rules';
import { availableWood } from './camp';
import { fuelLeft, livesInHouse } from './home';
import { rainWindow } from './rain';

export interface StormReadiness {
  /** Seconds of fuel already in the pit when it matters: at nightfall, or right now during the storm. */
  fuel: number;
  /** Seconds of fire the night still needs. */
  needed: number;
  ready: boolean;
  /** Logs still to find, beyond those already carried. */
  logsShort: number;
  storm: boolean;
}

/** Plain logs that last the whole cold night on that day at double burn. Nights lengthen toward winter. */
export function logsForColdNight(day: number): number {
  return Math.ceil((BALANCE.daySeconds - nightStart(day)) * BALANCE.coldNightFireBurn / BALANCE.fireSecondsPerWood);
}

export const secondsPerLog = (state: GameState) => {
  if (livesInHouse(state)) return BALANCE.fireplaceSecondsPerWood;
  return state.structures.hearth ? BALANCE.hearthFireSecondsPerWood : BALANCE.fireSecondsPerWood;
};

/** The freezing night the forecast plans for: the cold night while one is pending, otherwise tonight's. */
const plannedNight = (state: GameState): number => state.progress.nextStormDay ?? state.day;

/** Fuel the fire burns from now until nightfall: a second a second, and half again for the part in a shower. */
function burnUntilNightfall(state: GameState): number {
  const night = nightStart(state.day);
  const shower = rainWindow(state.day);
  const wet = shower ? Math.max(0, Math.min(shower.end, night) - Math.max(shower.start, state.timeOfDay)) : 0;
  return night - state.timeOfDay + wet * (BALANCE.rainFireBurn - 1);
}

/** Whether the camp fire already has enough fuel to last through the freezing night. In the house, the fireplace and the logs in store count, and carried wood is what could still be stored. */
export function stormReadiness(state: GameState): StormReadiness {
  const perLog = secondsPerLog(state);
  const storm = isFreezingNight(state);
  const night = plannedNight(state);
  const house = livesInHouse(state);
  const carried = (house ? state.inventory.wood : availableWood(state)) * perLog;
  let fuel: number;
  let needed: number;
  if (house) {
    fuel = fuelLeft(state);
    needed = storm ? Math.ceil((BALANCE.daySeconds - state.timeOfDay) * BALANCE.coldNightFireBurn) : (BALANCE.daySeconds - nightStart(night)) * BALANCE.coldNightFireBurn;
  } else if (storm) {
    fuel = state.fireFuel;
    needed = Math.ceil((BALANCE.daySeconds - state.timeOfDay) * BALANCE.coldNightFireBurn);
  } else {
    // The fire burns one second per second until nightfall, faster in a spring shower; before the storm day it will be long out.
    const left = state.day === night ? Math.max(0, state.fireFuel - burnUntilNightfall(state)) : 0;
    fuel = left;
    needed = (BALANCE.daySeconds - nightStart(night)) * BALANCE.coldNightFireBurn;
  }
  const ready = fuel > needed;
  const reach = fuel + carried;
  const logsShort = reach > needed ? 0 : Math.floor((needed - reach) / perLog) + 1;
  return { fuel, needed, ready, logsShort, storm };
}

/** The forecast card's fire line. */
export function forecastFireCheck(state: GameState): string {
  const { fuel, needed, ready, logsShort, storm } = stormReadiness(state);
  let hint = '';
  if (!ready && logsShort === 0) {
    if (livesInHouse(state)) hint = ' · bring the wood you carry home';
    else if (storm) hint = ' · add carried wood to the fire';
    else if (state.day === plannedNight(state)) hint = ' · add carried wood at nightfall';
    else hint = ' · keep the logs for nightfall';
  }
  else if (!ready) hint = ` · ${logsShort} more log${logsShort === 1 ? '' : 's'}`;
  return `${ready ? '✓' : '○'} Fire: ${Math.ceil(fuel)} / ${needed}s ${storm ? 'to dawn' : 'for the night'}${hint}`;
}

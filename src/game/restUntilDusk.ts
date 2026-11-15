import { nightStart } from './calendar';
import { coldNightWarning } from './coldNight';
import { fuelLeft, isAtHome, livesInHouse } from './home';
import { recordJournal } from './journalEntries';
import { traderSpot } from './market';
import { newsBetween } from './news';
import { isRaining } from './rain';
import { advanceTime, restFor } from './rules';
import { BALANCE, type GameState } from './state';
import { foxAt } from './wildlife';

export interface LongRestResult {
  state: GameState;
  message: string;
  notices: string[];
  stop: 'blocked' | 'nightfall' | 'event' | 'need' | 'ending';
}

type Stop = { kind: LongRestResult['stop']; message: string };

export function restUntilDuskBlocker(state: GameState): string | null {
  if (state.ending) return 'Your story has ended.';
  if (state.timeOfDay >= nightStart(state.day)) return 'Night has fallen. Sleep when you are ready.';
  if (!state.structures.shelter) return 'Build a shelter before resting until dusk.';
  if (!isAtHome(state)) return livesInHouse(state) ? 'Go home to rest until dusk.' : 'Move closer to the fire to rest until dusk.';
  return null;
}

/** The first new concern reached during this piece of rest. */
function interruption(before: GameState, after: GameState): Stop | null {
  if (after.ending) return { kind: 'ending', message: 'Your strength has given out.' };
  if (before.player.hunger > BALANCE.lowNeed && after.player.hunger <= BALANCE.lowNeed)
    return { kind: 'need', message: 'You are getting hungry. Eat before resting longer.' };
  if (before.player.warmth > BALANCE.lowNeed && after.player.warmth <= BALANCE.lowNeed)
    return { kind: 'need', message: 'You are getting cold. Warm up before resting longer.' };
  if (fuelLeft(before) > 0 && fuelLeft(after) <= 0)
    return { kind: 'need', message: 'The fire has gone out. Tend it before resting longer.' };
  if (!isRaining(before) && isRaining(after)) return { kind: 'event', message: 'You pause as the rain begins.' };
  if (coldNightWarning(before, after)) return { kind: 'event', message: 'You pause as the cold wind rises.' };
  if (!before.sickness.sick && after.sickness.sick) return { kind: 'event', message: 'You feel ill. Rest a moment before deciding what to do.' };
  if (foxAt(before.day, before.timeOfDay) === null && foxAt(after.day, after.timeOfDay) !== null)
    return { kind: 'event', message: 'A fox has come by. You pause to watch.' };
  if (traderSpot(before, 'glass') === null && traderSpot(after, 'glass') !== null)
    return { kind: 'event', message: 'A trader has arrived. You pause to look.' };
  if (traderSpot(before, 'spice') === null && traderSpot(after, 'spice') !== null)
    return { kind: 'event', message: 'A trader has arrived. You pause to look.' };
  if (before.town.traveller === null && after.town.traveller !== null)
    return { kind: 'event', message: 'Someone has arrived. You pause to look.' };
  return null;
}

/** Check one-second transitions, but grant Rest recovery once per completed portion. */
function portionLength(state: GameState, seconds: number): { seconds: number; stop: Stop | null } {
  let trial = state;
  let elapsed = 0;
  while (elapsed < seconds && !trial.ending) {
    const before = trial;
    const step = Math.min(1, seconds - elapsed);
    trial = advanceTime(trial, step, 'resting');
    elapsed += step;
    const stop = interruption(before, trial);
    if (stop) return { seconds: elapsed, stop };
  }
  return { seconds: elapsed, stop: null };
}

/** The one-click equivalent of resting through the remaining daylight. */
export function restUntilDusk(state: GameState): LongRestResult {
  const blocker = restUntilDuskBlocker(state);
  if (blocker) return { state, message: blocker, notices: [], stop: 'blocked' };
  if (state.player.hunger <= BALANCE.lowNeed)
    return { state, message: 'You are already hungry. Eat before resting longer.', notices: [], stop: 'need' };
  if (state.player.warmth <= BALANCE.lowNeed)
    return { state, message: 'You are already cold. Warm up before resting longer.', notices: [], stop: 'need' };
  let next = state;
  const notices: string[] = [];
  let stop: Stop | null = null;
  while (next.timeOfDay < nightStart(next.day) && !next.ending) {
    const seconds = Math.min(BALANCE.restSeconds, nightStart(next.day) - next.timeOfDay);
    const portion = portionLength(next, seconds);
    const before = next;
    const rested = restFor(before, portion.seconds).state;
    const written = recordJournal(before, rested, { type: 'rest' });
    next = written.state;
    notices.push(...newsBetween(before, next), ...written.messages);
    if (portion.stop) {
      stop = portion.stop;
      break;
    }
  }
  if (stop) return { state: next, message: stop.message, notices, stop: stop.kind };
  return { state: next, message: 'You rest until dusk. Night has fallen.', notices, stop: 'nightfall' };
}


export interface LongRestPreview {
  seconds: number;
  hunger: number;
  warmth: number;
  fuel: number;
  warning: string | null;
  visitorWarning: boolean;
}

/** What an uninterrupted rest would cost by nightfall; this never changes the live state. */
export function restUntilDuskPreview(state: GameState): LongRestPreview {
  const seconds = Math.max(0, nightStart(state.day) - state.timeOfDay);
  const projected = advanceTime(structuredClone(state), seconds, 'resting');
  const fuel = fuelLeft(projected);
  const warnings: string[] = [];
  if (projected.player.hunger <= BALANCE.lowNeed) warnings.push('Hunger will run low');
  if (projected.player.warmth <= BALANCE.lowNeed) warnings.push('Warmth will run low');
  if (Number.isFinite(fuel) && fuel <= 0) {
    if (fuelLeft(state) <= 0) warnings.push('The fire is already out');
    else warnings.push('The fire will go out');
  }
  if (projected.ending) warnings.push('Your strength may give out');
  const visitorWarning = foxAt(state.day, state.timeOfDay) !== null
    || traderSpot(state, 'glass') !== null || traderSpot(state, 'spice') !== null
    || state.town.traveller !== null;
  return {
    seconds, hunger: projected.player.hunger, warmth: projected.player.warmth, fuel,
    warning: warnings.length ? `${warnings.join('; ')}.` : null, visitorWarning
  };
}

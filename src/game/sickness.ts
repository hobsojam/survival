import { isAtCamp } from './camp';
import { fuelLeft, isAtHome, livesInHouse } from './home';
import { BALANCE, type GameState } from './state';

// Going a whole day without food makes the survivor sick. Sickness wears them down until it is cared for:
// a day with a warm meal and a warm rest counts toward getting well, any other day toward the end of the run.

export type Sickness = GameState['sickness'];

export const ENDED_MESSAGE = 'Your story has ended.';
/** Said when the story ends overnight, as it does at the dawn that judges the last sick day. */
export const GAVE_OUT_MESSAGE = 'Your strength gave out in the night.';
export const FALLING_ILL_MESSAGE = "You've gone too long without food, and you're falling ill.";

export function wellSickness(): Sickness {
  return { starvedSeconds: 0, sick: false, sickFromDay: null, cared: 0, uncared: 0, ateWarm: false, restedWarm: false };
}

export const isSick = (state: GameState): boolean => state.sickness.sick;

/** One step of time: counts the seconds spent at zero hunger, falls sick after a whole day of them, and lets sickness drain. */
export function sicknessTick(next: GameState, step: number): void {
  const sickness = next.sickness;
  const starvedSeconds = next.player.hunger <= 0 ? sickness.starvedSeconds + step : 0;
  const sickens = !sickness.sick && starvedSeconds >= BALANCE.starvedSecondsToSicken - 0.000001;
  next.sickness = sickens ? { ...sickness, starvedSeconds, sick: true, sickFromDay: next.day } : { ...sickness, starvedSeconds };
  if (!next.sickness.sick) return;
  next.player.energy = Math.max(0, next.player.energy - step * BALANCE.sickEnergyDrainPerSecond);
  next.player.warmth = Math.max(0, next.player.warmth - step * BALANCE.sickWarmthDrainPerSecond);
}

/** At dawn: a sick day that began sick is judged cared for or not, which may make the survivor well or end the run. */
export function judgeSickDay(next: GameState, endedDay: number): void {
  const sickness = next.sickness;
  if (!sickness.sick || sickness.sickFromDay === null || sickness.sickFromDay >= endedDay) return;
  const caredFor = sickness.ateWarm && sickness.restedWarm;
  const cared = sickness.cared + (caredFor ? 1 : 0);
  const uncared = sickness.uncared + (caredFor ? 0 : 1);
  if (cared >= BALANCE.sickDaysToRecover) {
    next.sickness = { ...wellSickness(), starvedSeconds: sickness.starvedSeconds };
    return;
  }
  next.sickness = { ...sickness, cared, uncared, ateWarm: false, restedWarm: false };
  if (uncared >= BALANCE.sickDaysToDie) next.ending = { day: endedDay };
}

/** A warm meal eaten: it counts toward a cared-for day while sick. */
export function markWarmMeal(state: GameState): GameState {
  return state.sickness.sick ? { ...state, sickness: { ...state.sickness, ateWarm: true } } : state;
}

/** Resting or sleeping here is warm: by the lit fireplace at home, or by the burning campfire. */
export function isWarmRestHere(state: GameState): boolean {
  return livesInHouse(state) ? isAtHome(state) && fuelLeft(state) > 0 : isAtCamp(state) && state.fireFuel > 0;
}

/** A rest or sleep taken where it is warm: it counts toward a cared-for day while sick. */
export function markWarmRest(state: GameState): GameState {
  return state.sickness.sick && isWarmRestHere(state) ? { ...state, sickness: { ...state.sickness, restedWarm: true } } : state;
}

/** The morning-style note when the survivor has just fallen sick, or null. */
export function fallingIllMessage(before: GameState, after: GameState): string | null {
  return !before.sickness.sick && after.sickness.sick ? FALLING_ILL_MESSAGE : null;
}

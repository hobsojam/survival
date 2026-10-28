import { afternoonStart, nightStart } from './calendar';
import { isColdNight } from './rules';
import type { GameState } from './state';

// The autumn cold night is the camp's one real test, so it draws in through the afternoon
// and says plainly when it comes and how the night went.

/** Whether tonight is the cold night, not yet weathered. */
const coldNightToday = (state: GameState): boolean => !state.progress.hearthUnlocked && state.progress.nextStormDay === state.day;

/** How far the cold night has drawn in, 0–1: it builds from mid-afternoon on its day and is full once night falls. */
export function coldNightApproach(state: GameState): number {
  if (!coldNightToday(state)) return 0;
  const from = afternoonStart(state.day);
  return Math.max(0, Math.min(1, (state.timeOfDay - from) / (nightStart(state.day) - from)));
}

export const COLD_WARNING = 'The wind is turning cold. Tonight will be bitter.';

/** The warning as the afternoon turns on the cold night's day, once. */
export function coldNightWarning(before: GameState, after: GameState): string | null {
  const turn = afternoonStart(after.day);
  const turned = before.day === after.day && before.timeOfDay < turn && after.timeOfDay >= turn;
  return turned && coldNightToday(after) ? COLD_WARNING : null;
}

/** The message as the cold night falls, and at the dawn that ends it. */
export function coldNightMessage(before: GameState, after: GameState): string | null {
  if (!isColdNight(before) && isColdNight(after)) return 'The cold night is here. Keep the fire alive until dawn.';
  if (!isColdNight(before) || isColdNight(after)) return null;
  return after.progress.hearthUnlocked
    ? 'The fire held through the cold night. The stone hearth is now unlocked.'
    : `The fire went out in the night. Rest today; another cold night comes on day ${after.progress.nextStormDay}.`;
}

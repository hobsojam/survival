import { season } from './calendar';
import type { GameState } from './state';

// Spring showers are worked out from the day number alone, so nothing here is saved.

const hash = (n: number): number => {
  const value = Math.sin(n * 78.233) * 43758.5453;
  return value - Math.floor(value);
};

/** When it rains on a day: about one spring day in three, for 40–59 s starting between 20 s and 79 s, always ending by 138 s, before any spring nightfall. */
export function rainWindow(day: number): { start: number; end: number } | null {
  if (season(day) !== 'spring' || hash(day) >= 1 / 3) return null;
  const start = 20 + Math.floor(hash(day + 101) * 60);
  return { start, end: start + 40 + Math.floor(hash(day + 211) * 20) };
}

export function isRaining(state: Pick<GameState, 'day' | 'timeOfDay'>): boolean {
  const window = rainWindow(state.day);
  return window !== null && state.timeOfDay >= window.start && state.timeOfDay < window.end;
}

const RAIN_FADE_SECONDS = 4;

/** How heavy the shower looks, 0–1: it builds over its first 4 s and eases off over its last 4 s. */
export function rainFade(state: Pick<GameState, 'day' | 'timeOfDay'>): number {
  const window = rainWindow(state.day);
  if (!window || !isRaining(state)) return 0;
  return Math.min(1, (state.timeOfDay - window.start) / RAIN_FADE_SECONDS, (window.end - state.timeOfDay) / RAIN_FADE_SECONDS);
}

/** The message as a shower begins, once. */
export function rainMessage(before: GameState, after: GameState): string | null {
  return !isRaining(before) && isRaining(after) ? 'Rain is coming in.' : null;
}

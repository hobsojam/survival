import { nightStart } from './calendar';
import { BALANCE } from './state';

// The wild animals' comings and goings are worked out from the day number alone,
// so the rules and the scene agree on them and nothing here is saved.

export interface Point { x: number; y: number }

/** A steady 0–1 value for any whole number, the same every time: the day's dice. */
export const dayHash = (n: number): number => {
  const value = Math.sin(n * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};

/** Where the spring rabbits live: in the meadow beside the bushes at (16, 18), (25, 11) and (23, 17). */
export const RABBIT_HOMES: readonly Point[] = [{ x: 14.5, y: 17.5 }, { x: 26.5, y: 13.5 }, { x: 22.5, y: 20.5 }];

export const FOX = {
  travel: 12,
  den: { x: 26, y: -1 },
  seat: { x: 20.8, y: 11.6 },
  spookRadius: 2
} as const;

export interface FoxPose extends Point { sitting: boolean; facing: 1 | -1 }

/** The fox comes by on the first evening, then on roughly two evenings in three. */
export const foxVisits = (day: number) => day === 1 || dayHash(day) < 0.65;

/** The fox arrives 20 s before that evening's nightfall and leaves 50 s after it. */
export function foxWindow(day: number): { arrive: number; leave: number } {
  const night = nightStart(day);
  return { arrive: night - 20, leave: night + 50 };
}

export function foxAt(day: number, timeOfDay: number): FoxPose | null {
  const { arrive, leave } = foxWindow(day);
  if (!foxVisits(day) || timeOfDay < arrive || timeOfDay > leave) return null;
  const progress = Math.min(1, (timeOfDay - arrive) / FOX.travel, (leave - timeOfDay) / FOX.travel);
  const leaving = timeOfDay - arrive > leave - timeOfDay;
  const sitting = progress >= 1;
  // Sitting, the fox faces the fire; walking, it faces where it's going.
  let heading: number;
  if (sitting) heading = BALANCE.campX - FOX.seat.x;
  else if (leaving) heading = FOX.den.x - FOX.seat.x;
  else heading = FOX.seat.x - FOX.den.x;
  return {
    x: FOX.den.x + (FOX.seat.x - FOX.den.x) * progress,
    y: FOX.den.y + (FOX.seat.y - FOX.den.y) * progress,
    sitting,
    facing: heading < 0 ? -1 : 1
  };
}

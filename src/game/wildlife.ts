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
  /** Beside the bush at (19, 13): the fox noses at it for a few seconds on the way in. */
  bush: { x: 19.6, y: 12.6 },
  nibble: 4,
  toSeat: 3,
  seat: { x: 20.8, y: 11.6 },
  spookRadius: 2
} as const;

/** Each offering the fox has taken brings its seat this much nearer the fire. */
const TRUST_STEP = 0.3;

export interface FoxPose extends Point { sitting: boolean; nibbling: boolean; facing: 1 | -1 }

/** The fox comes by on the first evening, then on roughly two evenings in three. */
export const foxVisits = (day: number) => day === 1 || dayHash(day) < 0.65;

/** The fox arrives 20 s before that evening's nightfall and leaves 50 s after it. */
export function foxWindow(day: number): { arrive: number; leave: number } {
  const night = nightStart(day);
  return { arrive: night - 20, leave: night + 50 };
}

const between = (from: Point, to: Point, progress: number): Point =>
  ({ x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress });
const facingFrom = (dx: number): 1 | -1 => (dx < 0 ? -1 : 1);

/** Where the fox sits: its usual seat, drawn nearer the fire by each offering it has taken. */
function seatFor(trust: number): Point {
  const dx = BALANCE.campX - FOX.seat.x;
  const dy = BALANCE.campY - FOX.seat.y;
  const length = Math.hypot(dx, dy);
  return { x: FOX.seat.x + dx / length * TRUST_STEP * trust, y: FOX.seat.y + dy / length * TRUST_STEP * trust };
}

/**
 * The fox's evening: it trots from its den to a berry bush, noses at it, goes on to its seat and sits facing the fire,
 * then goes back the way it came.
 */
export function foxAt(day: number, timeOfDay: number, trust = 0): FoxPose | null {
  const { arrive, leave } = foxWindow(day);
  if (!foxVisits(day) || timeOfDay < arrive || timeOfDay > leave) return null;
  const seat = seatFor(trust);
  const since = timeOfDay - arrive;
  const pose = (at: Point, facing: 1 | -1, state: { sitting?: boolean; nibbling?: boolean } = {}): FoxPose =>
    ({ ...at, sitting: state.sitting ?? false, nibbling: state.nibbling ?? false, facing });
  if (leave - timeOfDay < FOX.travel) return pose(between(FOX.den, seat, (leave - timeOfDay) / FOX.travel), facingFrom(FOX.den.x - seat.x));
  if (since < FOX.travel) return pose(between(FOX.den, FOX.bush, since / FOX.travel), facingFrom(FOX.bush.x - FOX.den.x));
  if (since < FOX.travel + FOX.nibble) return pose(FOX.bush, -1, { nibbling: true });
  const walked = (since - FOX.travel - FOX.nibble) / FOX.toSeat;
  if (walked < 1) return pose(between(FOX.bush, seat, walked), facingFrom(seat.x - FOX.bush.x));
  return pose(seat, facingFrom(BALANCE.campX - seat.x), { sitting: true });
}

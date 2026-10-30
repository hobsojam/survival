import { BALANCE } from '../src/game/state';

// Where the camp's paths run, for tests that keep things off them.

const FIRE = { x: BALANCE.campX, y: BALANCE.campY };

/** The far ends of the four camp paths that lead out from the fire. */
export const PATH_DESTINATIONS = [[9, 9], [30, 9], [10, 21], [30, 21]];

/** How far a point lies from the path running from the fire to (bx, by). */
export function segmentDistance(px: number, py: number, bx: number, by: number): number {
  const dx = bx - FIRE.x, dy = by - FIRE.y;
  const t = Math.max(0, Math.min(1, ((px - FIRE.x) * dx + (py - FIRE.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - FIRE.x - t * dx, py - FIRE.y - t * dy);
}

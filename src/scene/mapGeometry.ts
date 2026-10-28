import { BALANCE } from '../game/state';
import { CAMP_EXIT, QUARRY_EXIT, QUARRY_SITE } from '../game/areas';

/** A path runs between two tile centres: [fromX, fromY, toX, toY]. */
export type PathRoute = readonly [number, number, number, number];

export const PATH_DESTINATIONS = [[9, 9], [30, 9], [10, 21], [30, 21]] as const;
export const CAMP_CENTER_X = BALANCE.campX + .5;
export const CAMP_CENTER_Y = BALANCE.campY + .5;

const fromCamp = ([x, y]: readonly [number, number]): PathRoute => [BALANCE.campX, BALANCE.campY, x, y];
export const CAMP_PATHS: readonly PathRoute[] = PATH_DESTINATIONS.map(fromCamp);
/** Once the shelter stands, a fifth path leads west to the crossing. */
export const CAMP_OPEN_PATHS: readonly PathRoute[] = [...CAMP_PATHS, fromCamp([CAMP_EXIT.x, CAMP_EXIT.y])];

/** In the quarry, a worn path runs from the foot of the quarry face east to the way home. */
export const QUARRY_PATHS: readonly PathRoute[] = [[QUARRY_SITE.x + 1, QUARRY_SITE.y + 2, QUARRY_EXIT.x, QUARRY_EXIT.y]];

/** Signposts beside each end of the west path: one at the quarry pointing home, one at camp pointing to the quarry. */
export const QUARRY_SIGN = { x: QUARRY_EXIT.x - 2, y: QUARRY_EXIT.y - 2 } as const;
export const CAMP_SIGN = { x: CAMP_EXIT.x + 2, y: CAMP_EXIT.y - 2 } as const;

export function segmentDistance(x: number, y: number, [fromX, fromY, toX, toY]: PathRoute): number {
  const startX = fromX + .5, startY = fromY + .5;
  const dx = toX - fromX, dy = toY - fromY;
  const t = Math.max(0, Math.min(1, ((x - startX) * dx + (y - startY) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - startX - t * dx, y - startY - t * dy);
}

export function pathDistance(x: number, y: number, destinations: readonly PathRoute[]): number {
  return Math.min(...destinations.map(route => segmentDistance(x, y, route)));
}

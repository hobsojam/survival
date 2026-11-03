import { BALANCE } from '../game/state';
import { CAMP_EXIT, QUARRY_EXIT } from '../game/areas';

/** A path runs between two tile centres: [fromX, fromY, toX, toY]. */
export type PathRoute = readonly [number, number, number, number];

export const PATH_DESTINATIONS = [[9, 9], [30, 9], [10, 21], [30, 21]] as const;
export const CAMP_CENTER_X = BALANCE.campX + .5;
export const CAMP_CENTER_Y = BALANCE.campY + .5;

const fromCamp = ([x, y]: readonly [number, number]): PathRoute => [BALANCE.campX, BALANCE.campY, x, y];
export const CAMP_PATHS: readonly PathRoute[] = PATH_DESTINATIONS.map(fromCamp);
/** Once the shelter stands, a fifth path leads west and continues through the map edge. */
export const CAMP_OPEN_PATHS: readonly PathRoute[] = [...CAMP_PATHS, fromCamp([CAMP_EXIT.x, CAMP_EXIT.y]), [CAMP_EXIT.x, CAMP_EXIT.y, CAMP_EXIT.x - 1, CAMP_EXIT.y]];

/** In the quarry, a worn track runs from the floor through the east edge to the way home. */
export const QUARRY_PATHS: readonly PathRoute[] = [[19, 14, QUARRY_EXIT.x, QUARRY_EXIT.y], [QUARRY_EXIT.x, QUARRY_EXIT.y, QUARRY_EXIT.x + 1, QUARRY_EXIT.y]];

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

/** A steady integer hash of a tile (or any grid cell), so the scenery is the same every time it is drawn. */
export function mixHash(x: number, y: number, salt = 0): number {
  let n = Math.imul(x + salt * 31, 374761393) + Math.imul(y - salt * 17, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}

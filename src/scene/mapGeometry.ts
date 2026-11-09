import { BALANCE } from '../game/state';
import { CAMP_EXIT, CAMP_HOMESTEAD_EXIT, HOMESTEAD_EXIT, QUARRY_EXIT } from '../game/areas';
import { HILLS_EXIT, QUARRY_HILLS_EXIT } from '../game/hills';
import { KEEP_SITE } from '../game/keep';

/** A path runs between two tile centres: [fromX, fromY, toX, toY]. */
export type PathRoute = readonly [number, number, number, number];

export const PATH_DESTINATIONS = [[9, 9], [30, 9], [10, 21], [30, 21]] as const;
export const CAMP_CENTER_X = BALANCE.campX + .5;
export const CAMP_CENTER_Y = BALANCE.campY + .5;

const fromCamp = ([x, y]: readonly [number, number]): PathRoute => [BALANCE.campX, BALANCE.campY, x, y];
export const CAMP_PATHS: readonly PathRoute[] = PATH_DESTINATIONS.map(fromCamp);
/** Once the shelter stands, a fifth path leads west and continues through the map edge. */
export const CAMP_OPEN_PATHS: readonly PathRoute[] = [...CAMP_PATHS, fromCamp([CAMP_EXIT.x, CAMP_EXIT.y]), [CAMP_EXIT.x, CAMP_EXIT.y, CAMP_EXIT.x - 1, CAMP_EXIT.y]];
/** A second path runs east to the old homestead. Either edge can open independently. */
export const CAMP_HOMESTEAD_PATHS: readonly PathRoute[] = [...CAMP_PATHS,
  [30, 9, 34, 9], [34, 9, CAMP_HOMESTEAD_EXIT.x, CAMP_HOMESTEAD_EXIT.y],
  [CAMP_HOMESTEAD_EXIT.x, CAMP_HOMESTEAD_EXIT.y, CAMP_HOMESTEAD_EXIT.x + 1, CAMP_HOMESTEAD_EXIT.y]];
export const CAMP_BOTH_OPEN_PATHS: readonly PathRoute[] = [...CAMP_OPEN_PATHS, ...CAMP_HOMESTEAD_PATHS.slice(CAMP_PATHS.length)];

/** In the quarry, a worn track runs from the floor through the east edge to the way home. */
export const QUARRY_PATHS: readonly PathRoute[] = [[19, 14, QUARRY_EXIT.x, QUARRY_EXIT.y], [QUARRY_EXIT.x, QUARRY_EXIT.y, QUARRY_EXIT.x + 1, QUARRY_EXIT.y]];
/** The way on from the quarry floor to the hills, leaving by the west edge. */
export const QUARRY_HILLS_PATHS: readonly PathRoute[] = [[QUARRY_HILLS_EXIT.x - 1, QUARRY_HILLS_EXIT.y, QUARRY_HILLS_EXIT.x, QUARRY_HILLS_EXIT.y], [QUARRY_HILLS_EXIT.x, QUARRY_HILLS_EXIT.y, 10, 18], [10, 18, 19, 17]];
/** The path up the hills from their east edge to the outcrop, with a short way up to the keep's door. */
export const HILLS_PATHS: readonly PathRoute[] = [[HILLS_EXIT.x + 1, HILLS_EXIT.y, HILLS_EXIT.x, HILLS_EXIT.y], [HILLS_EXIT.x, HILLS_EXIT.y, 26, 13], [26, 13, 12, 9], [KEEP_SITE.x, KEEP_SITE.y + 1, KEEP_SITE.x, KEEP_SITE.y]];
/** EASTER EGG: the town, see src/game/town.ts. Once the bridge is begun, a lane runs down from the street to it. */
export const HILLS_BRIDGE_PATHS: readonly PathRoute[] = [...HILLS_PATHS, [25, 23, 25, 29]];
/** In the meadow, a lane from the bridge down to the old road, and the road itself running east to west. */
export const MEADOW_PATHS: readonly PathRoute[] = [[25, 0, 25, 18], [0, 18, 39, 18]];

/** The old homestead's entrance reaches an open yard from the west edge. */
export const HOMESTEAD_PATHS: readonly PathRoute[] = [[HOMESTEAD_EXIT.x - 1, HOMESTEAD_EXIT.y, 19, 15], [19, 15, 24, 15]];

/** Signposts beside each end of the west path: one at the quarry pointing home, one at camp pointing to the quarry. */
export const QUARRY_SIGN = { x: QUARRY_EXIT.x - 2, y: QUARRY_EXIT.y - 2 } as const;
export const CAMP_SIGN = { x: CAMP_EXIT.x + 2, y: CAMP_EXIT.y - 2 } as const;
export const HILLS_SIGN = { x: HILLS_EXIT.x - 2, y: HILLS_EXIT.y + 2 } as const;
export const HOMESTEAD_SIGN = { x: HOMESTEAD_EXIT.x + 2, y: HOMESTEAD_EXIT.y - 2 } as const;

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

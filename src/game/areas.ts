import { bridgeDone } from './bridge';
import { HILLS_EXIT } from './hills';
import { BALANCE, type AreaId, type GameState } from './state';

/** The west path: a gap in the camp's west edge that leads to the quarry's east edge. */
export const CROSSING = { y: 15, halfWidth: 1 };
export const CAMP_EXIT = { x: 0, y: 15 };
export const QUARRY_EXIT = { x: BALANCE.mapWidth - 1, y: 15 };
export const CAMP_HOMESTEAD_EXIT = { x: BALANCE.mapWidth - 1, y: 15 };
export const HOMESTEAD_EXIT = { x: 0, y: 15 };
export const QUARRY_SITE = { x: 12, y: 12 };
export const RUBBLE_SITE = { x: 16, y: 16 };

/** EASTER EGG: the town, see src/game/town.ts. The bridge's span over the stream on the hills' last row: the way down
 * to the meadow once it is finished, and the meadow's only way out. */
export const BRIDGE_SPAN = { x: 25, halfWidth: 1 };
/** Where the bridge leaves the hills, and where it comes out at the top of the meadow. */
export const HILLS_BRIDGE_EXIT = { x: 25, y: BALANCE.mapHeight - 1 };
export const MEADOW_ENTRY = { x: 25, y: 0.5 };
/** How far down the hills the survivor can walk off the bridge, so they don't wade in the stream. */
export const STREAM_BANK_Y = BALANCE.mapHeight - 2;

const onSpan = (x: number): boolean => Math.abs(x - BRIDGE_SPAN.x) <= BRIDGE_SPAN.halfWidth;

/** How far down the survivor can walk here: to the map's edge, except on the hills, where the stream stops them off the finished bridge. */
export const lowestY = (state: GameState, x: number): number =>
  (state.area === 'hills' && !(onSpan(x) && bridgeDone(state.town.bridge)) ? STREAM_BANK_Y : BALANCE.mapHeight - 1);

/** The path only opens once the shelter is built. */
export function pathOpen(state: GameState): boolean {
  return state.structures.shelter;
}

export function homesteadPathOpen(state: GameState): boolean {
  return state.structures.shelter;
}

/** The way on to the hills opens once the quarry is found. */
export function hillsPathOpen(state: GameState): boolean {
  return state.progress.quarryFound;
}

/** Where walking to (rawX, rawY) lands the survivor in the other area, or null if they stay put. */
export function crossing(state: GameState, rawX: number, rawY: number): { area: AreaId; x: number; y: number } | null {
  if (state.area === 'meadow') return rawY < 0 && onSpan(rawX) ? { area: 'hills', x: rawX, y: BALANCE.mapHeight - 1.5 } : null;
  if (state.area === 'hills' && rawY > HILLS_BRIDGE_EXIT.y && onSpan(rawX) && bridgeDone(state.town.bridge)) return { area: 'meadow', x: rawX, y: MEADOW_ENTRY.y };
  // Inside the crossing's half-width, y is already well within the map, so it needs no clamp.
  if (Math.abs(rawY - CROSSING.y) > CROSSING.halfWidth) return null;
  if (state.area === 'camp') {
    if (pathOpen(state) && rawX < 0) return { area: 'quarry', x: BALANCE.mapWidth - 1.5, y: rawY };
    if (homesteadPathOpen(state) && rawX > BALANCE.mapWidth - 1) return { area: 'homestead', x: 0.5, y: rawY };
    return null;
  }
  if (state.area === 'homestead') return rawX < 0 ? { area: 'camp', x: BALANCE.mapWidth - 1.5, y: rawY } : null;
  if (state.area === 'hills') return rawX > HILLS_EXIT.x ? { area: 'quarry', x: 0.5, y: rawY } : null;
  if (hillsPathOpen(state) && rawX < 0) return { area: 'hills', x: BALANCE.mapWidth - 1.5, y: rawY };
  return rawX > BALANCE.mapWidth - 1 ? { area: 'camp', x: 0.5, y: rawY } : null;
}

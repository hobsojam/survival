import { BALANCE, type AreaId, type GameState } from './state';

/** The west path: a gap in the camp's west edge that leads to the quarry's east edge. */
export const CROSSING = { y: 15, halfWidth: 1 };
export const CAMP_EXIT = { x: 0, y: 15 };
export const QUARRY_EXIT = { x: BALANCE.mapWidth - 1, y: 15 };
export const QUARRY_SITE = { x: 12, y: 12 };
export const RUBBLE_SITE = { x: 16, y: 16 };

/** The path only opens once the shelter is built. */
export function pathOpen(state: GameState): boolean {
  return state.structures.shelter;
}

/** Where walking to (rawX, rawY) lands the survivor in the other area, or null if they stay put. */
export function crossing(state: GameState, rawX: number, rawY: number): { area: AreaId; x: number; y: number } | null {
  if (Math.abs(rawY - CROSSING.y) > CROSSING.halfWidth) return null;
  const y = Math.max(0, Math.min(BALANCE.mapHeight - 1, rawY));
  if (state.area === 'camp') {
    return pathOpen(state) && rawX < 0 ? { area: 'quarry', x: BALANCE.mapWidth - 1.5, y } : null;
  }
  return rawX > BALANCE.mapWidth - 1 ? { area: 'camp', x: 0.5, y } : null;
}

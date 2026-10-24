import { BALANCE } from '../game/state';

export const PATH_DESTINATIONS = [[9, 9], [30, 9], [10, 21], [30, 21]] as const;
export const CAMP_CENTER_X = BALANCE.campX + .5;
export const CAMP_CENTER_Y = BALANCE.campY + .5;

export function distanceToPath(x: number, y: number, endX: number, endY: number): number {
  const dx = endX + .5 - CAMP_CENTER_X;
  const dy = endY + .5 - CAMP_CENTER_Y;
  const t = Math.max(0, Math.min(1, ((x - CAMP_CENTER_X) * dx + (y - CAMP_CENTER_Y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - CAMP_CENTER_X - t * dx, y - CAMP_CENTER_Y - t * dy);
}

export function pathDistance(x: number, y: number): number {
  return Math.min(...PATH_DESTINATIONS.map(([endX, endY]) => distanceToPath(x, y, endX, endY)));
}

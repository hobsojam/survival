import { MOAT_TILES } from '../game/castle';
import { OUTCROP_SITE } from '../game/hills';

// The shape of the hills, in tile units: long folds of light and shade across the slope, and rock near the top.

/** How much light a spot catches, from -1 to 1: broad folds, so the ground reads as low rounded hills. */
export function hillFold(x: number, y: number): number {
  return Math.sin(x * 0.2 + y * 0.42 + Math.sin(y * 0.17) * 2) * 0.8 + Math.sin(x * 0.07 - y * 0.2) * 0.2;
}

/** How far out from the rock's middle a spot is: 1 is its uneven edge. */
export function hillRockDepth(x: number, y: number): number {
  const wobble = Math.sin(x * 1.1 + y * 0.6) * 0.09 + Math.cos(y * 1.4 - x * 0.5) * 0.09;
  return Math.hypot((x - OUTCROP_SITE.x) / 8.5, (y - OUTCROP_SITE.y) / 5) + wobble;
}

/** Whether bare rock shows here: only near the top, around the outcrop. */
export const hillRockAt = (x: number, y: number): boolean => hillRockDepth(x, y) < 1;

const MOAT_AT = new Set(MOAT_TILES.map(tile => `${tile.x},${tile.y}`));

/** Whether the tile a point falls on lies in the moat's ring, so nothing grows there. */
export const moatAt = (x: number, y: number): boolean => MOAT_AT.has(`${Math.round(x)},${Math.round(y)}`);

import { BALANCE } from '../game/state';
import { QUARRY_PATHS, mixHash, pathDistance } from './mapGeometry';

// The quarry's shapes, in tile units (a tile's centre is x + .5): a cut rock face along the west with a grassy plateau
// above it, a pale gravel floor spreading from its foot around the dig spot and the rubble, and a worn track east to
// the way home. One classifier says what any world pixel is, so the ground tiles can be cut from it.

/** How tall the cut face stands above its foot, in tiles. */
export const FACE_HEIGHT = 2.5;
/** Half the track's width, in tiles; its soft edge runs a fifth of a tile further. */
export const TRACK_HALF_WIDTH = 0.8;
const TRACK_EDGE = 0.2;
/** Where the floor's soft edge starts and ends, as floor depth. */
export const FLOOR_EDGE_IN = .92;
export const FLOOR_EDGE_OUT = 1.04;
/** The broad quarry track narrows over its last four tiles to meet the camp footpath. */
const trackTaper = (x: number): number => Math.max(0, Math.min(1, (x - (BALANCE.mapWidth - 5)) / 4));
export function trackHalfWidth(x: number): number { return TRACK_HALF_WIDTH - .41 * trackTaper(x); }
export function trackEdgeOut(x: number): number { return trackHalfWidth(x) + TRACK_EDGE - .06 * trackTaper(x); }
/** Where the quarry's meadow flowers gather, out in the open grass clear of the floor, the track and the woods. */
export const QUARRY_MEADOWS: readonly (readonly [number, number])[] = [[26, 9], [30, 20], [20, 23], [9, 21]];
const FLOOR = { x: 13.5, y: 14, rx: 7, ry: 4 } as const;

/** The y of the cliff's foot at this x: level to x 14, then stepping back a tile per tile to its east end at 18. */
export function faceBottom(x: number): number | null {
  if (x <= 14) return 11;
  return x <= 18 ? 11 - (x - 14) : null;
}

/** A small, steady wobble over quarter-tile cells, so edges are uneven but don't speckle. */
const wobble = (x: number, y: number, salt: number, size: number): number =>
  ((mixHash(Math.floor(x * 4), Math.floor(y * 4), salt) % 1000) / 1000 - .5) * 2 * size;

/** Below 1 inside the gravel floor, an uneven ellipse around the dig spot and the rubble. */
export function floorDepth(x: number, y: number): number {
  return Math.hypot((x - FLOOR.x) / FLOOR.rx, (y - FLOOR.y) / FLOOR.ry) + wobble(x, y, 41, .12);
}

/** How far a point is from the track's centre line, give or take the wobble of its edges. */
export function trackDistance(x: number, y: number): number {
  return pathDistance(x, y, QUARRY_PATHS) + wobble(x, y, 43, .05);
}

export type QuarryGround = 'grass' | 'plateau' | 'lip' | 'face' | 'seam' | 'foot' | 'floor' | 'floorEdge' | 'track' | 'trackEdge';

/** What the world pixel (px, py) is: the face and what lies above and below it first, then the floor and the track. */
export function quarryGroundAt(px: number, py: number): QuarryGround {
  const x = (px + .5) / 16, y = (py + .5) / 16;
  const foot = faceBottom(x);
  if (foot !== null) {
    const top = foot - FACE_HEIGHT;
    if (y >= top && y < foot) {
      const down = py - Math.floor(top * 16), band = Math.floor(down / 13);
      return down % 13 === 0 || (px + band * 9) % 22 === 0 ? 'seam' : 'face';
    }
    if (y >= foot && y < foot + 2 / 16) return 'foot';
    if (y < top) return y >= top - 3 / 16 ? 'lip' : 'plateau';
  }
  const depth = floorDepth(x, y), track = trackDistance(x, y);
  if (depth < FLOOR_EDGE_IN) return 'floor';
  if (track < trackHalfWidth(x)) return 'track';
  if (depth < FLOOR_EDGE_OUT) return 'floorEdge';
  return track < trackEdgeOut(x) ? 'trackEdge' : 'grass';
}

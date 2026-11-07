import type { GameState } from './state';

// EASTER EGG: the castle after the keep is deliberately left out of the README and hidden on screen until the survivor
// has climbed the keep on a second day and seen the line of stones. Nothing here shows before that reveal.
// It is built a stone at a time from the quarry: a road, a cart, timber frames, a curtain wall, four towers, a gatehouse,
// a moat and a great hall, then a feast to finish. Laid stone stays laid and dug moat stays dug: nothing wears away.

export type WallSide = 'north' | 'east' | 'south' | 'west';
export type TowerId = 'nw' | 'ne' | 'se' | 'sw';
export type FeastItem = 'bread' | 'roastedHazelnuts' | 'honey' | 'apple' | 'vegetables';

/** The sections that are finished one at a time, each of which can leave a note for the morning after. */
export type CastleSection = 'road' | 'frames' | 'wall-north' | 'wall-east' | 'wall-south' | 'wall-west' | 'tower-nw' | 'tower-ne' | 'tower-se' | 'tower-sw' | 'gatehouse' | 'moat' | 'hall';
export const CASTLE_SECTIONS: readonly CastleSection[] = ['road', 'frames', 'wall-north', 'wall-east', 'wall-south', 'wall-west', 'tower-nw', 'tower-ne', 'tower-se', 'tower-sw', 'gatehouse', 'moat', 'hall'];

export interface Tower { stones: number; beams: number; fittings: number }

export interface CastleState {
  /** The first day the survivor climbed the finished keep, and the day the line of stones first showed. */
  firstClimbDay: number | null;
  revealedDay: number | null;
  road: number;
  /** Stone in the cart, and where the cart stands. */
  cart: { stone: number; at: 'quarry' | 'hills' };
  frames: number;
  wall: Record<WallSide, number>;
  towers: Record<TowerId, Tower>;
  gatehouse: number;
  moat: { stretches: number; lastDugDay: number | null; dugDay: number | null };
  hall: { stones: number; beams: number; fittings: number; hangings: number };
  /** Goods made at camp, which count from anywhere. */
  goods: { beams: number; fittings: number; hangings: number };
  feast: Record<FeastItem, number>;
  /** The day each section was finished, once it is. */
  doneDays: Partial<Record<CastleSection, number>>;
  finishedDay: number | null;
  home: 'house' | 'hall';
  offeredHome: boolean;
}

export const SIDES: readonly WallSide[] = ['north', 'east', 'south', 'west'];
export const TOWERS: readonly TowerId[] = ['nw', 'ne', 'se', 'sw'];
export const FEAST_ITEMS: readonly FeastItem[] = ['bread', 'roastedHazelnuts', 'honey', 'apple', 'vegetables'];

export const emptyCastle = (): CastleState => ({
  firstClimbDay: null, revealedDay: null,
  road: 0,
  cart: { stone: 0, at: 'quarry' },
  frames: 0,
  wall: { north: 0, east: 0, south: 0, west: 0 },
  towers: { nw: { stones: 0, beams: 0, fittings: 0 }, ne: { stones: 0, beams: 0, fittings: 0 }, se: { stones: 0, beams: 0, fittings: 0 }, sw: { stones: 0, beams: 0, fittings: 0 } },
  gatehouse: 0,
  moat: { stretches: 0, lastDugDay: null, dugDay: null },
  hall: { stones: 0, beams: 0, fittings: 0, hangings: 0 },
  goods: { beams: 0, fittings: 0, hangings: 0 },
  feast: { bread: 0, roastedHazelnuts: 0, honey: 0, apple: 0, vegetables: 0 },
  doneDays: {},
  finishedDay: null,
  home: 'house',
  offeredHome: false
});

/** What each section asks for. */
export const NEEDS = {
  road: 30, cartStone: 40, frames: 12, wallSide: 30, towerStones: 20, towerBeams: 4, towerFittings: 2, gatehouse: 30,
  moat: 16, hallStones: 40, hallBeams: 12, hallFittings: 6, hallHangings: 2,
  feast: { bread: 4, roastedHazelnuts: 4, honey: 3, apple: 3, vegetables: 4 }
} as const;

/** Whether the line of stones has shown yet. */
export const isRevealed = (state: GameState): boolean => state.castle.revealedDay !== null;

/** Whether a tower has its stones, its roof beams and its iron. */
export const towerFinished = (tower: Tower): boolean => tower.stones === NEEDS.towerStones && tower.beams === NEEDS.towerBeams && tower.fittings === NEEDS.towerFittings;

/** Whether all four sides of the curtain wall are done. */
export const wallFinished = (castle: CastleState): boolean => SIDES.every(side => castle.wall[side] === NEEDS.wallSide);

/** The curtain wall's corners on the hills, in tiles, with the keep standing inside. */
export const WALLS = { left: 13, right: 24, top: 5, bottom: 15 } as const;

/** How far a point is from the line the walls follow, whichever side it is on. */
export const lineDistance = (point: { x: number; y: number }): number => {
  const dx = Math.max(WALLS.left - point.x, 0, point.x - WALLS.right);
  const dy = Math.max(WALLS.top - point.y, 0, point.y - WALLS.bottom);
  if (dx > 0 || dy > 0) return Math.hypot(dx, dy);
  return Math.min(point.x - WALLS.left, WALLS.right - point.x, point.y - WALLS.top, WALLS.bottom - point.y);
};

/** The wall side a point inside the walls is nearest. */
const nearestSide = (point: { x: number; y: number }): WallSide => {
  const gaps: [WallSide, number][] = [['west', point.x - WALLS.left], ['east', WALLS.right - point.x], ['north', point.y - WALLS.top], ['south', WALLS.bottom - point.y]];
  return gaps.reduce((best, gap) => (gap[1] < best[1] ? gap : best))[0];
};

/** Whether a tree inside the walls has been cleared, once the wall side nearest it has begun. Outside the walls nothing is cleared. */
export const treeUnderWall = (castle: CastleState, tree: { x: number; y: number }): boolean => {
  const inside = tree.x >= WALLS.left && tree.x <= WALLS.right && tree.y >= WALLS.top && tree.y <= WALLS.bottom;
  return inside && castle.wall[nearestSide(tree)] > 0;
};

/** What a climb to the top of the keep on this day shows: the first only marks the day, and one on a later day sees the line of stones. */
export const castleSeen = (castle: CastleState, day: number): CastleState => {
  if (castle.firstClimbDay === null) return { ...castle, firstClimbDay: day };
  return castle.revealedDay === null && day > castle.firstClimbDay ? { ...castle, revealedDay: day } : castle;
};

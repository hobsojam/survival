import { YEAR_LENGTH } from './calendar';
import { rainWindow } from './rain';
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
  return gaps.reduce((best, gap) => (gap[1] < best[1] ? gap : best), gaps[0])[0];
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

/**
 * The moat's ring, one tile outside the curtain wall, clockwise from the gatehouse on the east side. A bank of land is left
 * where the road crosses it at the gate and where the path to the outcrop crosses it on the west. Each tile belongs to one of
 * the sixteen stretches, which share the tiles out evenly.
 */
export const MOAT_TILES: readonly { x: number; y: number; stretch: number }[] = (() => {
  const { left, right, top, bottom } = { left: WALLS.left - 1, right: WALLS.right + 1, top: WALLS.top - 1, bottom: WALLS.bottom + 1 };
  const range = (from: number, to: number): number[] => Array.from({ length: Math.abs(to - from) + 1 }, (_, i) => from + Math.sign(to - from) * i);
  const gate = (y: number): boolean => y >= 11 && y <= 13;
  const path = (y: number): boolean => y >= 8 && y <= 10;
  const ring = [
    ...range(14, bottom).map(y => ({ x: right, y })),
    ...range(right - 1, left).map(x => ({ x, y: bottom })),
    ...range(bottom - 1, top).filter(y => !path(y)).map(y => ({ x: left, y })),
    ...range(left + 1, right).map(x => ({ x, y: top })),
    ...range(top + 1, 10).map(y => ({ x: right, y }))
  ].filter(tile => tile.x !== right || !gate(tile.y));
  return ring.map((tile, i) => ({ ...tile, stretch: Math.floor(i * NEEDS.moat / ring.length) }));
})();

/** Which piece of moat a ring tile is: a run across (`h`) or up and down (`v`), or the corner it turns at. */
export const moatPiece = (tile: { x: number; y: number }): 'h' | 'v' | 'nw' | 'ne' | 'sw' | 'se' => {
  const ns = tile.y === WALLS.top - 1 ? 'n' : tile.y === WALLS.bottom + 1 ? 's' : null;
  const we = tile.x === WALLS.left - 1 ? 'w' : tile.x === WALLS.right + 1 ? 'e' : null;
  if (ns && we) return `${ns}${we}`;
  return ns ? 'h' : 'v';
};

/** Where a stretch of the moat is dug from: the middle of its run of tiles. */
export const moatStretchSpot = (stretch: number): { x: number; y: number } => {
  const run = MOAT_TILES.filter(tile => tile.stretch === stretch);
  const { x, y } = run[Math.floor(run.length / 2)];
  return { x, y };
};

/** The rainy spring days that fill the moat: the spring it was dug in, after that day, or else the next spring. */
const fillSpring = (dugDay: number): { from: number; to: number } => {
  const yearStart = Math.floor((dugDay - 1) / YEAR_LENGTH) * YEAR_LENGTH + 1;
  const springStart = yearStart + 2 * (YEAR_LENGTH / 4);
  const springEnd = springStart + YEAR_LENGTH / 4 - 1;
  if (dugDay > springEnd) return { from: springStart + YEAR_LENGTH, to: springEnd + YEAR_LENGTH };
  return { from: Math.max(springStart, dugDay + 1), to: springEnd };
};

const rainyDays = (from: number, to: number): number => {
  let count = 0;
  for (let day = from; day <= to; day++) if (rainWindow(day) !== null) count++;
  return count;
};

/** How full the moat is, 0 to 1, from the day it was dug and today alone: it rises a little on each rainy spring day after it is dug, and is full from the summer after. */
export const moatFill = (state: Pick<GameState, 'day' | 'castle'>): number => {
  const { dugDay } = state.castle.moat;
  if (dugDay === null) return 0;
  const { from, to } = fillSpring(dugDay);
  if (state.day > to) return 1;
  const total = rainyDays(from, to);
  return total === 0 ? 0 : rainyDays(from, state.day) / total;
};

/** Which of five pictures a fill shows: dry, then three rising, then full. Any rain shows at least a little. */
export const moatLevel = (fill: number): number => (fill <= 0 ? 0 : fill >= 1 ? 4 : Math.min(3, Math.max(1, Math.ceil(fill * 4))));

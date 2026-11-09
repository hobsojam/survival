import type { JobId } from './town';
import type { GameState } from './state';

// EASTER EGG: the town, see src/game/town.ts. The market square at the west end of the street, marked out once two
// houses are finished and built a piece at a time: its paving first, then a well and five stalls in any order. Once
// the camp's jobs are all taken, newcomers keep the stalls and stock them from what the camp can spare.

/** The five stalls, one for each good the town will sell on market day. */
export type StallId = 'bread' | 'honey' | 'wool' | 'apples' | 'eggs';
/** How many stalls have their awning up. Each hanging is cut in two, so every other awning is the half left over. */
export const awningsUp = (square: SquareState): number => STALL_IDS.filter(id => square.stalls[id].hangings > 0).length;
/** Whether half a hanging is left over from the last awning, ready for the next. */
export const halfHangingLeft = (square: SquareState): boolean => awningsUp(square) % 2 === 1;

/** The stall jobs, one for each stall. */
export const STALL_JOBS = { bread: 'breadStall', honey: 'honeyStall', wool: 'woolStall', apples: 'appleStall', eggs: 'eggStall' } as const satisfies Record<StallId, JobId>;

export const STALL_IDS: readonly StallId[] = ['bread', 'honey', 'wool', 'apples', 'eggs'];

/** A piece of the square that is built on its own. */
export type SquarePiece = 'paving' | 'well' | StallId;
export const SQUARE_PIECES: readonly SquarePiece[] = ['paving', 'well', ...STALL_IDS];

/** The stalls around the square's edges: two along the top, three along the bottom. */
export const STALL_SPOTS: Record<StallId, { x: number; y: number }> = {
  bread: { x: 6.5, y: 21 }, honey: { x: 10.5, y: 21 }, apples: { x: 6, y: 25.5 }, wool: { x: 8.5, y: 25.5 }, eggs: { x: 11, y: 25.5 }
};
/** Each stall's good as one word: "the apple stall". */
export const STALL_WORDS: Record<StallId, string> = { bread: 'bread', honey: 'honey', wool: 'wool', apples: 'apple', eggs: 'egg' };

/** What each piece takes: paving stones, the well's stone and its iron winch, and each stall's beams and wool awning. */
export const SQUARE_NEEDS = { paving: 40, well: { stone: 12, fittings: 1 }, stall: { beams: 2, hangings: 1 } } as const;
/** The paving is laid a quarter of the square at a time. */
export const PAVING_SECTION = 10;

/** How many of its good a stall holds. */
export const STALL_STOCK = 12;
/** How many of each food a stallholder always leaves in the larder for the survivor. */
export const STALL_RESERVE = 2;
/** How much wool the wool stall leaves in the basket: enough for a hanging. */
export const WOOL_RESERVE = 3;

export interface StallState { beams: number; hangings: number }

export interface SquareState {
  /** Paving stones laid, up to SQUARE_NEEDS.paving. */
  paving: number;
  well: { stone: number; fittings: number };
  stalls: Record<StallId, StallState>;
  /** What each stall holds, waiting for market day. */
  stock: Record<StallId, number>;
  /** The day each finished piece was finished. */
  doneDays: Partial<Record<SquarePiece, number>>;
}

const eachStall = <T>(make: () => T): Record<StallId, T> => Object.fromEntries(STALL_IDS.map(id => [id, make()])) as Record<StallId, T>;

export const emptySquare = (): SquareState => ({
  paving: 0, well: { stone: 0, fittings: 0 }, stalls: eachStall(() => ({ beams: 0, hangings: 0 })), stock: eachStall(() => 0), doneDays: {}
});

/** How many houses must be finished before the square is marked out. */
export const SQUARE_HOUSES = 2;

/** Whether the square's ground is marked out: once two houses are finished. */
export const squareMarked = (state: GameState): boolean => state.town.houses.filter(house => house.doneDay !== null).length >= SQUARE_HOUSES;

/** Whether every part of a piece is laid. */
export function pieceDone(square: SquareState, piece: SquarePiece): boolean {
  if (piece === 'paving') return square.paving === SQUARE_NEEDS.paving;
  if (piece === 'well') return square.well.stone === SQUARE_NEEDS.well.stone && square.well.fittings === SQUARE_NEEDS.well.fittings;
  const stall = square.stalls[piece];
  return stall.beams === SQUARE_NEEDS.stall.beams && stall.hangings === SQUARE_NEEDS.stall.hangings;
}

/** Whether a piece can be worked on now: the square is marked out, the piece isn't finished, and it is the paving or the paving is down. */
export const pieceOpen = (state: GameState, piece: SquarePiece): boolean => {
  const { square } = state.town;
  return squareMarked(state) && !pieceDone(square, piece) && (piece === 'paving' || pieceDone(square, 'paving'));
};

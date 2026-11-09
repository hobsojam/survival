import { spendCastleStone } from './castleSites';
import { TOO_TIRED_MESSAGE, isExhausted } from './needs';
import { PAVING_SECTION, SQUARE_NEEDS, STALL_IDS, STALL_SPOTS, STALL_WORDS, pieceDone, pieceOpen, type SquarePiece, type SquareState } from './square';
import { BALANCE, type AreaId, type GameState } from './state';

// EASTER EGG: the town, see src/game/town.ts. Where the square's pieces stand on the hills, at the west end of the
// street, and how each is built: paving stone by stone, the well's stone and its winch, and each stall's beams and awning.

/** The middle of the square. */
export const SQUARE_CENTRE = { x: 8.5, y: 23 } as const;
/** The four quarters of the paving, laid in this order, each where its stones go. */
export const PAVING_SPOTS: readonly { x: number; y: number }[] = [{ x: 7, y: 22 }, { x: 10, y: 22 }, { x: 7, y: 24.5 }, { x: 10, y: 24.5 }];
/** The well stands in the middle. */
export const WELL_SPOT = SQUARE_CENTRE;
export { STALL_SPOTS, STALL_WORDS } from './square';

export interface SquareSpot { piece: SquarePiece; area: AreaId; x: number; y: number }

const spotFor = (square: SquareState, piece: SquarePiece): { x: number; y: number } => {
  if (piece === 'paving') return PAVING_SPOTS[Math.min(PAVING_SPOTS.length - 1, Math.floor(square.paving / PAVING_SECTION))];
  return piece === 'well' ? WELL_SPOT : STALL_SPOTS[piece];
};

/** The square's pieces open to build now, each where its next piece goes. */
export const squareSpots = (state: GameState): SquareSpot[] => (['paving', 'well', ...STALL_IDS] as const)
  .filter(piece => pieceOpen(state, piece))
  .map(piece => ({ piece, area: 'hills' as const, ...spotFor(state.town.square, piece) }));

type Need = 'stone' | 'beams' | 'fittings' | 'hangings';

/** What a piece takes next. */
function pieceNeed(square: SquareState, piece: SquarePiece): Need {
  if (piece === 'paving') return 'stone';
  if (piece === 'well') return square.well.stone < SQUARE_NEEDS.well.stone ? 'stone' : 'fittings';
  return square.stalls[piece].beams < SQUARE_NEEDS.stall.beams ? 'beams' : 'hangings';
}

const cartStone = (state: GameState): number => (state.castle.cart.at === 'hills' ? state.castle.cart.stone : 0);
const has = (state: GameState, need: Need): boolean => (need === 'stone' ? state.inventory.stone + cartStone(state) >= 1 : state.castle.goods[need] >= 1);

const SHORT: Record<Need, string> = {
  stone: 'Bring stone up from the quarry.', beams: 'Make beams at the workshop.', fittings: 'Make an iron fitting at the forge.', hangings: 'Weave a hanging at the loom.'
};
const pieceWord = (piece: SquarePiece): string => (piece === 'paving' ? 'Square' : piece === 'well' ? 'Well' : 'Stall');
const ASK: Record<Need, string> = {
  stone: 'bring stone up from the quarry', beams: 'make beams at the workshop', fittings: 'make an iron fitting at the forge', hangings: 'weave a hanging at the loom'
};

/** Why the next piece of the square can't be laid now, or null if it can. */
export function squareWorkBlocker(state: GameState, piece: SquarePiece): string | null {
  if (!pieceOpen(state, piece)) return 'There is nothing to build here yet.';
  const spot = spotFor(state.town.square, piece);
  if (state.area !== 'hills' || Math.hypot(state.player.x - spot.x, state.player.y - spot.y) > BALANCE.interactionRadius) return 'Move closer to the square.';
  const need = pieceNeed(state.town.square, piece);
  if (!has(state, need)) return SHORT[need];
  return isExhausted(state) ? TOO_TIRED_MESSAGE : null;
}

/** What the prompt says at a piece: the work on offer, or what is missing for it. */
export function squarePrompt(state: GameState, piece: SquarePiece): string {
  const { square } = state.town;
  const need = pieceNeed(square, piece);
  if (!has(state, need)) return `${pieceWord(piece)} · ${ASK[need]}`;
  if (piece === 'paving') return `Lay a paving stone (${square.paving}/${SQUARE_NEEDS.paving})`;
  if (piece === 'well') return need === 'stone' ? `Lay a well stone (${square.well.stone}/${SQUARE_NEEDS.well.stone})` : 'Fit the well\'s winch';
  return need === 'beams' ? `Raise a stall beam (${square.stalls[piece].beams}/${SQUARE_NEEDS.stall.beams})` : 'Hang the stall\'s awning';
}

/** The square with one more of what a piece takes laid. */
function laid(square: SquareState, piece: SquarePiece, need: Need): SquareState {
  if (piece === 'paving') return { ...square, paving: square.paving + 1 };
  if (piece === 'well') {
    const key = need === 'stone' ? 'stone' : 'fittings';
    return { ...square, well: { ...square.well, [key]: square.well[key] + 1 } };
  }
  const key = need === 'beams' ? 'beams' : 'hangings';
  return { ...square, stalls: { ...square.stalls, [piece]: { ...square.stalls[piece], [key]: square.stalls[piece][key] + 1 } } };
}

/** The state with one piece of the square laid: stone from the cart and the bag, a beam, fitting or hanging from the castle goods. */
export function doSquareWork(state: GameState, piece: SquarePiece): GameState {
  const need = pieceNeed(state.town.square, piece);
  const paid = need === 'stone' ? spendCastleStone(state) : { ...state, castle: { ...state.castle, goods: { ...state.castle.goods, [need]: state.castle.goods[need] - 1 } } };
  if (!paid) return state;
  const square = laid(state.town.square, piece, need);
  const doneDays = pieceDone(square, piece) ? { ...square.doneDays, [piece]: state.day } : square.doneDays;
  return { ...paid, town: { ...paid.town, square: { ...square, doneDays } } };
}

/** What a piece of work on the square says, read from the square after it. */
export function squareWorkLine(after: SquareState, piece: SquarePiece): string {
  if (piece === 'paving') {
    if (after.paving === SQUARE_NEEDS.paving) return 'The square is paved.';
    return after.paving % PAVING_SECTION === 0 ? 'A quarter of the square is paved.' : 'You lay another paving stone.';
  }
  if (piece === 'well') return pieceDone(after, 'well') ? 'The well is finished. The bucket comes up full.' : 'You lay another stone on the well.';
  return pieceDone(after, piece) ? `The ${STALL_WORDS[piece]} stall is up, with its awning.` : 'You raise a beam for the stall.';
}

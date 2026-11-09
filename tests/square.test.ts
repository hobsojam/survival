import { describe, expect, it } from 'vitest';
import type { GameState } from '../src/game/state';
import { SQUARE_NEEDS, STALL_IDS, emptySquare, pieceDone, pieceOpen, squareMarked } from '../src/game/square';
import { finishedCastleCamp, street } from './townStreet';

// EASTER EGG: the town, see src/game/town.ts. The square at the west end of the street.

const built = (doneDay: number) => ({ stone: 30, beams: 4, fittings: 1, doneDay });
/** A finished castle with the given number of houses finished. */
const withHouses = (count: number, change: (state: GameState) => void = () => {}): GameState => {
  const state = finishedCastleCamp();
  state.town.houses = street(...Array.from({ length: count }, (_, i) => built(20 + i)));
  change(state);
  return state;
};
const open = (state: GameState) => (['paving', 'well', ...STALL_IDS] as const).filter(piece => pieceOpen(state, piece));

describe('the square', () => {
  it('starts with nothing laid', () => {
    expect(emptySquare()).toEqual({
      paving: 0, well: { stone: 0, fittings: 0 },
      stalls: { bread: { beams: 0, hangings: 0 }, honey: { beams: 0, hangings: 0 }, wool: { beams: 0, hangings: 0 }, apples: { beams: 0, hangings: 0 }, eggs: { beams: 0, hangings: 0 } },
      stock: { bread: 0, honey: 0, wool: 0, apples: 0, eggs: 0 }, doneDays: {}
    });
    expect(STALL_IDS).toEqual(['bread', 'honey', 'wool', 'apples', 'eggs']);
  });

  it('is marked out once two houses are finished', () => {
    expect(squareMarked(withHouses(1))).toBe(false);
    expect(squareMarked(withHouses(2))).toBe(true);
    expect(open(withHouses(1))).toEqual([]);
  });

  it('opens the paving first, then the well and every stall', () => {
    expect(open(withHouses(2))).toEqual(['paving']);
    const paved = withHouses(2, state => { state.town.square.paving = SQUARE_NEEDS.paving; state.town.square.doneDays = { paving: 30 }; });
    expect(open(paved)).toEqual(['well', 'bread', 'honey', 'wool', 'apples', 'eggs']);
  });

  it('closes a piece once it is done', () => {
    const state = withHouses(2, state => {
      Object.assign(state.town.square, { paving: 40, well: { stone: 12, fittings: 1 }, doneDays: { paving: 30, well: 31 } });
      state.town.square.stalls.bread = { beams: 2, hangings: 1 };
      state.town.square.doneDays.bread = 32;
    });
    expect(pieceDone(state.town.square, 'well')).toBe(true);
    expect(pieceDone(state.town.square, 'bread')).toBe(true);
    expect(pieceDone(state.town.square, 'honey')).toBe(false);
    expect(open(state)).toEqual(['honey', 'wool', 'apples', 'eggs']);
  });
});

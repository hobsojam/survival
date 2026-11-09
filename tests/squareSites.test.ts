import { describe, expect, it } from 'vitest';
import { goodBlocker, goodRoom } from '../src/game/castleSites';
import { goodCopy } from '../src/ui/panels';
import { townGoodNeed } from '../src/game/houseOpen';
import { applyAction } from '../src/game/rules';
import { SQUARE_NEEDS, STALL_IDS, type SquarePiece } from '../src/game/square';
import { PAVING_SPOTS, SQUARE_CENTRE, STALL_SPOTS, WELL_SPOT, squareSpots, squareWorkBlocker } from '../src/game/squareSites';
import type { GameState } from '../src/game/state';
import { HOUSE_PLOTS } from '../src/game/townSites';
import { HILLS_PATHS, pathDistance } from '../src/scene/mapGeometry';
import { promptFor, useKeyAction } from '../src/scene/prompts';
import { pickTapTarget, targetAction } from '../src/scene/tapTarget';
import { finishedCastleCamp, street } from './townStreet';

// EASTER EGG: the town, see src/game/town.ts. Building the square a piece at a time.

const built = (doneDay: number) => ({ stone: 30, beams: 4, fittings: 1, doneDay });
const spotOf = (piece: SquarePiece, state: GameState) => squareSpots(state).find(spot => spot.piece === piece)!;

/** Two houses finished and lived in, the square marked out, and the survivor rested on the hills at the given piece with stone and goods to hand. */
const marked = (piece: SquarePiece = 'paving', change: (state: GameState) => void = () => {}): GameState => {
  const state = finishedCastleCamp();
  state.town = { ...state.town, namesUsed: 2, houses: street(built(30), built(40)),
    people: [{ name: 'Ada', job: 'hens', house: 0, arrivedDay: 20 }, { name: 'Tomas', job: 'honey', house: 1, arrivedDay: 35 }] };
  state.area = 'hills';
  state.inventory = { ...state.inventory, stone: 5 };
  state.castle.goods = { beams: 4, fittings: 1, hangings: 1 };
  state.player = { ...state.player, energy: 100 };
  change(state);
  const spot = piece === 'paving' ? PAVING_SPOTS[Math.min(3, Math.floor(state.town.square.paving / 10))] : piece === 'well' ? WELL_SPOT : STALL_SPOTS[piece];
  state.player = { ...state.player, x: spot.x, y: spot.y + 0.5 };
  return state;
};
const paved = (state: GameState) => { state.town.square.paving = SQUARE_NEEDS.paving; state.town.square.doneDays = { paving: 45 }; };
const work = (state: GameState, piece: SquarePiece) => applyAction(state, { type: 'squareWork', piece });

describe('the square\'s pieces', () => {
  it('stands in the square at the west end of the street, clear of the houses and the paths', () => {
    expect(SQUARE_CENTRE).toEqual({ x: 8.5, y: 23 });
    expect(WELL_SPOT).toEqual(SQUARE_CENTRE);
    for (const spot of [...PAVING_SPOTS, WELL_SPOT, ...Object.values(STALL_SPOTS)]) {
      expect(spot.x >= 5.5 && spot.x <= 11.5 && spot.y >= 20.5 && spot.y <= 25.5, `${spot.x},${spot.y}`).toBe(true);
      expect(pathDistance(spot.x, spot.y, HILLS_PATHS)).toBeGreaterThan(1.5);
      for (const plot of HOUSE_PLOTS) expect(Math.hypot(plot.x - spot.x, plot.y - spot.y)).toBeGreaterThan(1.5);
    }
  });

  it('offers only the paving at first, then the well and every stall', () => {
    expect(squareSpots(marked()).map(spot => spot.piece)).toEqual(['paving']);
    expect(squareSpots(marked('well', paved)).map(spot => spot.piece)).toEqual(['well', ...STALL_IDS]);
    expect(squareSpots(marked('paving', state => { state.town.houses = street(built(30)); }))).toEqual([]);
  });

  it('gives the same work from the prompt, the E key and a tap', () => {
    const state = marked();
    const spot = spotOf('paving', state);
    expect(promptFor(state)).toContain('Lay a paving stone (0/40)');
    expect(useKeyAction(state)).toEqual({ type: 'squareWork', piece: 'paving' });
    expect(targetAction(pickTapTarget(state, spot.x, spot.y))).toEqual({ type: 'squareWork', piece: 'paving' });
  });
});

describe('building the square', () => {
  it('lays the paving a quarter at a time, moving on to the next quarter', () => {
    expect(work(marked(), 'paving').message).toBe('You lay another paving stone.');
    const quarter = work(marked('paving', state => { state.town.square.paving = 9; }), 'paving');
    expect(quarter.message).toBe('A quarter of the square is paved.');
    expect(spotOf('paving', quarter.state)).toMatchObject(PAVING_SPOTS[1]);
    const last = work(marked('paving', state => { state.town.square.paving = 39; }), 'paving');
    expect(last.message).toBe('The square is paved.');
    expect(last.state.town.square.doneDays.paving).toBe(last.state.day);
  });

  it('builds the well from stone, then its winch', () => {
    expect(work(marked('well', paved), 'well').message).toBe('You lay another stone on the well.');
    const walls = marked('well', state => { paved(state); state.town.square.well.stone = 12; });
    expect(promptFor(walls)).toContain('Fit the well\'s winch');
    const done = work(walls, 'well');
    expect(done.message).toBe('The well is finished. The bucket comes up full.');
    expect(done.state.castle.goods.fittings).toBe(0);
    expect(done.state.town.square.doneDays.well).toBe(done.state.day);
    const noIron = marked('well', state => { paved(state); state.town.square.well.stone = 12; state.castle.goods.fittings = 0; });
    expect(promptFor(noIron)).toContain('Well · make an iron fitting at the forge');
  });

  it('raises a stall from beams, then hangs its awning', () => {
    expect(work(marked('bread', paved), 'bread').message).toBe('You raise a beam for the stall.');
    expect(promptFor(marked('bread', paved))).toContain('Raise a stall beam (0/2)');
    const frame = marked('apples', state => { paved(state); state.town.square.stalls.apples.beams = 2; });
    expect(promptFor(frame)).toContain('Hang the stall\'s awning');
    expect(work(frame, 'apples').message).toBe('The apple stall is up, with half a hanging for its awning.');
  });

  it('cuts each hanging in two, so every other awning needs no new hanging', () => {
    const halfUp = (state: GameState) => {
      paved(state);
      state.town.square.stalls.bread = { beams: 2, hangings: 1 };
      state.town.square.doneDays.bread = 46;
      state.town.square.stalls.apples.beams = 2;
      state.castle.goods.hangings = 0;
    };
    const second = marked('apples', halfUp);
    expect(promptFor(second)).toContain('Hang the stall\'s awning');
    const done = work(second, 'apples');
    expect(done.message).toBe('The apple stall is up, with the other half for its awning.');
    expect(done.state.castle.goods.hangings).toBe(0);
    const first = work(marked('apples', state => { paved(state); state.town.square.stalls.apples.beams = 2; }), 'apples');
    expect(first.state.castle.goods.hangings).toBe(0);
  });

  it('asks for a hanging from the loom when there is none, and still lets the rest be built', () => {
    const bare = marked('eggs', state => { paved(state); state.town.square.stalls.eggs.beams = 2; state.castle.goods.hangings = 0; });
    expect(promptFor(bare)).toContain('Stall · weave a hanging at the loom');
    expect(work(bare, 'eggs').message).toBe('Weave a hanging at the loom.');
    expect(squareWorkBlocker({ ...bare, player: { ...bare.player, ...WELL_SPOT } }, 'well')).toBeNull();
  });

  it('says what is missing, and refuses from too far away', () => {
    expect(work(marked('paving', state => { state.inventory.stone = 0; }), 'paving').message).toBe('Bring stone up from the quarry.');
    expect(promptFor(marked('paving', state => { state.inventory.stone = 0; }))).toContain('Square · bring stone up from the quarry');
    expect(work(marked('bread', state => { paved(state); state.castle.goods.beams = 0; }), 'bread').message).toBe('Make beams at the workshop.');
    expect(promptFor(marked('bread', state => { paved(state); state.castle.goods.beams = 0; }))).toContain('Stall · make beams at the workshop');
    const far = marked();
    expect(work({ ...far, player: { ...far.player, x: far.player.x + 4 } }, 'paving').message).toBe('Move closer to the square.');
    expect(work(marked(), 'well').message).toBe('There is nothing to build here yet.');
  });

  it('takes the cart\'s stone before the bag\'s', () => {
    const after = work(marked('paving', state => { state.castle.cart = { ...state.castle.cart, at: 'hills', stone: 2 }; }), 'paving').state;
    expect(after.castle.cart.stone).toBe(1);
    expect(after.inventory.stone).toBe(5);
  });
});

describe('the goods the square needs', () => {
  it('asks the loom for hangings for the stalls once the paving is down, and fewer as awnings go up', () => {
    const none = (state: GameState) => { state.castle.goods = { beams: 0, fittings: 0, hangings: 0 }; };
    expect(goodRoom(marked('paving', none), 'hangings')).toBe(0);
    expect(goodRoom(marked('well', state => { none(state); paved(state); }), 'hangings')).toBe(3);
    const hung = marked('bread', state => { none(state); paved(state); state.town.square.stalls.bread = { beams: 2, hangings: 1 }; state.town.square.doneDays.bread = 46; });
    expect(goodRoom(hung, 'hangings')).toBe(2);
    const two = marked('honey', state => { none(state); paved(state); for (const id of ['bread', 'honey'] as const) { state.town.square.stalls[id] = { beams: 2, hangings: 1 }; state.town.square.doneDays[id] = 46; } });
    expect(goodRoom(two, 'hangings')).toBe(2);
    expect(townGoodNeed(marked('well', state => { none(state); paved(state); }), 'beams')).toBe(10 + townGoodNeed(marked('paving', none), 'beams'));
    expect(townGoodNeed(marked('well', state => { none(state); paved(state); }), 'fittings')).toBe(1 + townGoodNeed(marked('paving', none), 'fittings'));
  });

  it('words the goods for the town once the castle is finished', () => {
    const town = marked('well', paved);
    expect(goodCopy(town, 'beams')).toBe('Four at a time, cut and dressed for the town\'s houses, stalls and bridge.');
    expect(goodCopy(town, 'hangings')).toBe('One at a time, woven from wool and cut in two for the stalls\' awnings.');
    expect(goodCopy(town, 'fittings')).toBe('One at a time, to fit the beams.');
    const castle = { ...town, castle: { ...town.castle, finishedDay: null } };
    expect(goodCopy(castle, 'beams')).toBe('Four at a time, cut and dressed for the towers and the hall.');
    const hung = marked('paving', state => { state.castle.goods = { beams: 0, fittings: 0, hangings: 0 }; state.structures.loom = true; state.area = 'camp'; });
    expect(goodBlocker(hung, 'hangings')).toBe('There are enough hangings for now.');
  });
});

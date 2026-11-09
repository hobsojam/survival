import { spendCastleStone } from './castleSites';
import { TOO_TIRED_MESSAGE, isExhausted } from './needs';
import { BALANCE, type AreaId, type GameState } from './state';
import { houseOpen } from './houseOpen';
import { HOUSE_NEEDS, houseFinished, type HouseState } from './town';

// EASTER EGG: the town, see src/game/town.ts. Houses on fixed plots on the hills outside the castle walls, built in
// stages from stone, the workshop's beams and the forge's iron. The first is built for the first neighbour.

/** Where the houses stand, in the order they are built: a street of two rows on the open ground below the castle wall,
 * with a lane between them, starting south-east of the castle and growing west to the square, then four around the square. */
export const HOUSE_PLOTS: readonly { area: AreaId; x: number; y: number }[] = [
  ...([[31, 23], [26, 21], [22, 21], [27, 25], [18, 21], [23, 25], [14, 21], [19, 25], [15, 25], [3, 21], [3, 26], [13, 28]] as const)
    .map(([x, y]) => ({ area: 'hills' as const, x, y })),
  // Over the bridge, in the meadow, either side of the lane down to the old road.
  ...([[20, 7], [28, 7], [20, 12]] as const).map(([x, y]) => ({ area: 'meadow' as const, x, y }))
];

/** How far a house has got: none, its footings at ten stone, its walls at thirty, its roof at four beams, its door and hearth at its fitting. */
export function houseStage(house: HouseState): 0 | 1 | 2 | 3 | 4 {
  if (houseFinished(house)) return 4;
  if (house.beams === HOUSE_NEEDS.beams) return 3;
  if (house.stone === HOUSE_NEEDS.stone) return 2;
  return house.stone >= 10 ? 1 : 0;
}

export interface TownSpot { plot: number; area: AreaId; x: number; y: number }

/** The plots open to build on now. */
export const townSpots = (state: GameState): TownSpot[] =>
  HOUSE_PLOTS.flatMap((spot, plot) => (houseOpen(state, plot) ? [{ plot, ...spot }] : []));

/** What a house takes next. */
const houseNeed = (house: HouseState): 'stone' | 'beams' | 'fittings' => {
  if (house.stone < HOUSE_NEEDS.stone) return 'stone';
  return house.beams < HOUSE_NEEDS.beams ? 'beams' : 'fittings';
};

const cartStone = (state: GameState): number => (state.castle.cart.at === 'hills' && state.area === 'hills' ? state.castle.cart.stone : 0);
const SHORT = { stone: 'Bring stone up from the quarry.', beams: 'Make beams at the workshop.', fittings: 'Make an iron fitting at the forge.' } as const;
const LABELS = { stone: 'Lay a house stone', beams: 'Set a house beam', fittings: 'Hang the house door' } as const;
const ASKS = { stone: 'House · bring stone up from the quarry', beams: 'House · make beams at the workshop', fittings: 'House · make an iron fitting at the forge' } as const;

const has = (state: GameState, need: 'stone' | 'beams' | 'fittings'): boolean =>
  need === 'stone' ? state.inventory.stone + cartStone(state) >= 1 : state.castle.goods[need] >= 1;

/** Why the next piece of a house can't be laid now, or null if it can. */
export function townWorkBlocker(state: GameState, plot: number): string | null {
  const spot = HOUSE_PLOTS[plot];
  if (!spot || !houseOpen(state, plot)) return 'There is nothing to build here yet.';
  if (state.area !== spot.area || Math.hypot(state.player.x - spot.x, state.player.y - spot.y) > BALANCE.interactionRadius) return 'Move closer to the house.';
  const need = houseNeed(state.town.houses[plot]);
  if (!has(state, need)) return SHORT[need];
  return isExhausted(state) ? TOO_TIRED_MESSAGE : null;
}

/** What the prompt says at a plot: the work on offer, or what is missing for it. */
export function townPrompt(state: GameState, plot: number): string {
  const house = state.town.houses[plot];
  const need = houseNeed(house);
  if (!has(state, need)) return ASKS[need];
  return `${LABELS[need]} (${house[need]}/${HOUSE_NEEDS[need]})`;
}

/** The state with one piece of a house laid: stone from the cart and the bag, a beam or fitting from the castle goods. Finishing it moves the first neighbour still waiting in. */
export function doTownWork(state: GameState, plot: number): GameState {
  const house = state.town.houses[plot];
  const need = houseNeed(house);
  const paid = need === 'stone' ? spendCastleStone(state) : { ...state, castle: { ...state.castle, goods: { ...state.castle.goods, [need]: state.castle.goods[need] - 1 } } };
  if (!paid) return state;
  const laid = { ...house, [need]: house[need] + 1 };
  const done = houseFinished(laid);
  const houses = state.town.houses.map((each, i) => (i === plot ? { ...laid, doneDay: done ? state.day : null } : each));
  const mover = done ? state.town.people.findIndex(person => person.house === null) : -1;
  const people = state.town.people.map((person, i) => (i === mover ? { ...person, house: plot } : person));
  return { ...paid, town: { ...state.town, houses, people } };
}

/** What a piece of work on a house says, read from the house after it. */
export function townWorkLine(after: HouseState): string {
  if (houseFinished(after)) return 'You hang the door and lay the hearth. The house is finished.';
  if (after.beams === HOUSE_NEEDS.beams) return 'The roof is on.';
  if (after.beams > 0) return 'You fit another beam.';
  if (after.stone === HOUSE_NEEDS.stone) return 'The walls are up.';
  return after.stone === 10 ? 'The footings are in.' : 'You lay another stone on the house.';
}

/** The mornings after a house is finished: who moved in. */
export function houseNews(before: GameState, after: GameState): string[] {
  if (after.day <= before.day) return [];
  return after.town.houses.flatMap((house, plot) => {
    const person = house.doneDay === before.day ? after.town.people.find(each => each.house === plot) : undefined;
    return person ? [`${person.name} has moved into the new house.`] : [];
  });
}

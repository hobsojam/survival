import { openJobs } from './jobs';
import type { GameState } from './state';
import { SQUARE_NEEDS, STALL_IDS, pieceOpen } from './square';
import { HOUSE_NEEDS } from './town';

// EASTER EGG: the town, see src/game/town.ts. Which house is open to build. This sits apart from town.ts because it
// asks the jobs what is free, and the jobs need the game state, which needs the town.

/** How many days after a house is finished the next plot opens, so the street grows at a steady pace. */
export const PLOT_DAYS = 5;

/** Whether a house is open to build. Houses go up one at a time, in plot order, each plot a few days after the house
 * before it: the next one opens for someone already waiting in the hall, or, once every finished house is lived in,
 * while there is a job free for a newcomer to take. */
export const houseOpen = (state: GameState, plot: number): boolean => {
  const { houses, people } = state.town;
  const house = houses[plot];
  if (house === undefined || house.doneDay !== null || houses.slice(0, plot).some(lower => lower.doneDay === null)) return false;
  if (plot > 0 && houses[plot - 1].doneDay! + PLOT_DAYS > state.day) return false;
  if (people.some(person => person.house === null)) return true;
  const allLivedIn = houses.every((built, index) => built.doneDay === null || people.some(person => person.house === index));
  return people.length > 0 && allLivedIn && openJobs(state).length > 0;
};

/** How many more beams, fittings or hangings the open square pieces still take: the well's winch, and each stall's beams and awning. */
function squareGoodNeed(state: GameState, good: 'beams' | 'fittings' | 'hangings'): number {
  const { square } = state.town;
  if (good === 'fittings') return pieceOpen(state, 'well') ? SQUARE_NEEDS.well.fittings - square.well.fittings : 0;
  return STALL_IDS.reduce((total, id) => total + (pieceOpen(state, id) ? SQUARE_NEEDS.stall[good] - square.stalls[id][good] : 0), 0);
}

/** How many more beams, fittings or hangings the open houses and the open pieces of the square still take. Houses take no hangings. */
export const townGoodNeed = (state: GameState, good: 'beams' | 'fittings' | 'hangings'): number =>
  squareGoodNeed(state, good) + (good === 'hangings' ? 0
    : state.town.houses.reduce((total, house, plot) => total + (houseOpen(state, plot) ? HOUSE_NEEDS[good] - house[good] : 0), 0));

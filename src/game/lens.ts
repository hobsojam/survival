import { firstMarketDay, traderSpot } from './market';
import { STALL_IDS, STALL_JOBS } from './square';
import type { GameState } from './state';
import { personSpot } from './townsfolk';

// EASTER EGG: the town, see src/game/town.ts. The glass lens: the first market's glass trader hands it to the survivor,
// or, if they never came to that market, leaves it with a stallholder to pass on. No one in the town could make it, and
// it has no use yet. It sits apart from market.ts because it needs the townsfolk, who need the market.

const NEAR = 1.5;
const near = (state: GameState, spot: { area: string; x: number; y: number }): boolean =>
  spot.area === state.area && Math.hypot(spot.x - state.player.x, spot.y - state.player.y) <= NEAR;

const given = (state: GameState, message: string): { state: GameState; message: string } =>
  ({ state: { ...state, town: { ...state.town, market: { ...state.town.market, lensDay: state.day } } }, message });

/** The lens handed over, if the survivor has come near whoever has it: the glass trader on the first market day, or a
 * stallholder at their stall on any day after it. */
export function lensHandover(state: GameState): { state: GameState; message: string } {
  const first = firstMarketDay(state);
  if (first === null || state.town.market.lensDay !== null || state.day < first) return { state, message: '' };
  if (state.day === first) {
    const trader = traderSpot(state, 'glass');
    return trader && near(state, trader) ? given(state, 'A trader from beyond the hills hands you a glass lens. No one here could have made it.') : { state, message: '' };
  }
  const keeper = state.town.people.find((person, index) => {
    const spot = STALL_IDS.some(id => STALL_JOBS[id] === person.job) ? personSpot(state, index) : null;
    return spot !== null && !spot.walking && near(state, spot);
  });
  return keeper ? given(state, `${keeper.name} hands you a glass lens a trader left for you.`) : { state, message: '' };
}

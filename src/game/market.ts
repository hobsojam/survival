import { houseOpen } from './houseOpen';
import { openJobs } from './jobs';
import { milestoneDone, roadDone } from './meadow';
import { duskLength, nightStart } from './calendar';
import { STALL_FULL, STALL_IDS, STALL_JOBS, pieceDone, type StallId } from './square';
import type { GameState } from './state';

// EASTER EGG: the town, see src/game/town.ts. Market day: once the town is as full as it can get and the meadow's old
// road is cleared and marked, the square opens, and every fifth day after that is market day. The first brings
// traders over the bridge, and one of them a glass lens. See docs/superpowers/specs/2026-11-10-market-day-design.md.

export { emptyMarket, type MarketState } from './town';

/** Days from one market to the next: the town's week. */
export const MARKET_EVERY = 5;
/** The first market comes two dawns after the square opens: the sign goes up the next day, and the market is the day after. */
const FIRST_MARKET_AFTER = 2;

/** Whether the town is as full as it can get: the castle finished, everyone housed, every finished house lived in, every
 * stall kept, no traveller waiting, and no job or plot left to offer. Some camps never fill all fifteen plots. */
export function townFull(state: GameState): boolean {
  const { town, castle } = state;
  if (castle.finishedDay === null || town.people.length === 0 || town.traveller !== null) return false;
  if (town.people.some(person => person.house === null)) return false;
  const livedIn = town.houses.every((house, plot) => house.doneDay === null || town.people.some(person => person.house === plot));
  if (!livedIn || openJobs(state).length > 0 || town.houses.some((_, plot) => houseOpen(state, plot))) return false;
  return STALL_IDS.every(id => town.people.some(person => person.job === STALL_JOBS[id]));
}

/** Whether the meadow's old road is ready for traders: cleared and marked with its milestone. */
export const roadReady = (state: GameState): boolean => roadDone(state.town.road) && milestoneDone(state.town.road);

/** The first market day, or null before the square opens. */
export const firstMarketDay = (state: GameState): number | null =>
  state.town.market.openDay === null ? null : state.town.market.openDay + FIRST_MARKET_AFTER;

/** Whether a day is market day: the first market, and every fifth day after it. */
export function isMarketDay(state: GameState, day: number = state.day): boolean {
  const first = firstMarketDay(state);
  return first !== null && day >= first && (day - first) % MARKET_EVERY === 0;
}

/** Whether tomorrow is market day. */
export const isMarketEve = (state: GameState): boolean => isMarketDay(state, state.day + 1);

/** At dawn, before the keepers stock their stalls: the traders took what was left yesterday, and the square opens on the
 * first dawn the town is full and the road ready. Once open, it stays open. */
export function marketDawn(next: GameState): void {
  const { square, market } = next.town;
  if (isMarketDay(next, next.day - 1)) {
    next.town = { ...next.town, square: { ...square, stock: Object.fromEntries(STALL_IDS.map(id => [id, 0])) as typeof square.stock } };
  }
  if (market.openDay === null && townFull(next) && roadReady(next)) next.town = { ...next.town, market: { ...market, openDay: next.day } };
}

/** How much of the stalls' stock has gone so far today: none off market days, then a steady share from dawn until the
 * dusk begins, when the traders take the rest. */
export function marketSold(state: GameState): number {
  if (!isMarketDay(state)) return 0;
  return Math.min(1, state.timeOfDay / (nightStart(state.day) - duskLength(state.day)));
}

/** A stall's picture: its frame while it is being built, then empty, some or full by what is left on its counter. */
export function stallFrame(state: GameState, id: StallId): string {
  const { square } = state.town;
  if (!pieceDone(square, id)) return 'frame';
  const left = Math.round(square.stock[id] * (1 - marketSold(state)));
  if (left === 0) return id;
  return `${id}-${left >= STALL_FULL ? 'full' : 'some'}`;
}

/** Where the market sign leans, by the well and clear of the stalls. */
export const SIGN_SPOT = { x: 10, y: 23.5 } as const;

/** The sign's face: the eve's, advertising tomorrow's market, or the day's. It's taken down the next dawn. */
export function signFace(state: GameState): 'eve' | 'day' | null {
  if (isMarketDay(state)) return 'day';
  return isMarketEve(state) ? 'eve' : null;
}

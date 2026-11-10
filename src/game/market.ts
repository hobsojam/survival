import { HILLS_BRIDGE_EXIT, MEADOW_ENTRY } from './areas';
import { houseOpen } from './houseOpen';
import { openJobs } from './jobs';
import { milestoneDone, roadDone } from './meadow';
import { duskLength, nightStart } from './calendar';
import { STALL_FULL, STALL_IDS, STALL_JOBS, pieceDone, type StallId } from './square';
import { BALANCE, type AreaId, type GameState } from './state';

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

/** Where the townsfolk who don't keep a stall stand about the square on market day, clear of the well, the stalls and the sign. */
export const MARKET_CROWD_SPOTS: readonly { x: number; y: number }[] = [
  { x: 6, y: 23 }, { x: 7.2, y: 22.2 }, { x: 7.2, y: 24.2 }, { x: 8.5, y: 21.6 }, { x: 9.6, y: 24.6 },
  { x: 11.6, y: 22.2 }, { x: 11.8, y: 24.4 }, { x: 5.2, y: 24.4 }, { x: 9.4, y: 21.9 }, { x: 4.8, y: 22.6 }
];

/** The two traders who come on market day, each with their own cart: one with glass and brass, one with spices. */
export const TRADERS = ['glass', 'spice'] as const;
export type Trader = (typeof TRADERS)[number];
/** Where each cart stands for the day: on the street east of the square, clear of the houses and the crowd. */
export const TRADER_CART_SPOTS: Record<Trader, { x: number; y: number }> = { glass: { x: 13, y: 23 }, spice: { x: 17, y: 23 } };
/** Game seconds the traders take to come in from the meadow's east edge to their carts. The spice trader follows a little behind. */
export const TRADER_ARRIVE = 30;
const TRADER_DELAY: Record<Trader, number> = { glass: 0, spice: 8 };

type Point = { x: number; y: number };
type Leg = { area: AreaId; from: Point; to: Point };

const between = (from: Point, to: Point, f: number): Point => ({ x: from.x + (to.x - from.x) * f, y: from.y + (to.y - from.y) * f });

/** The way in: west along the meadow's old road, up the lane to the bridge, then up the hills' lane and along the street. */
function traderLegs(trader: Trader): Leg[] {
  const roadEnd = { x: BALANCE.mapWidth - 0.5, y: 18 };
  const roadTurn = { x: MEADOW_ENTRY.x, y: 18 };
  const street = { x: HILLS_BRIDGE_EXIT.x, y: 23 };
  const stand = { x: TRADER_CART_SPOTS[trader].x, y: TRADER_CART_SPOTS[trader].y + 1 };
  return [
    { area: 'meadow', from: roadEnd, to: roadTurn }, { area: 'meadow', from: roadTurn, to: MEADOW_ENTRY },
    { area: 'hills', from: HILLS_BRIDGE_EXIT, to: street }, { area: 'hills', from: street, to: stand }
  ];
}

/** How far along the way in a trader is at a time of day, from 0 at the road's end to 1 at their cart, or null when they're gone. */
function traderProgress(state: GameState, trader: Trader, timeOfDay: number): number | null {
  if (!isMarketDay(state) || timeOfDay >= nightStart(state.day)) return null;
  const duskStart = nightStart(state.day) - duskLength(state.day);
  if (timeOfDay >= duskStart) {
    // Over the dusk they go back the way they came, the spice trader setting off a little after.
    const lag = TRADER_DELAY[trader] / TRADER_ARRIVE / 2;
    return 1 - Math.max(0, ((timeOfDay - duskStart) / duskLength(state.day) - lag) / (1 - lag));
  }
  const arrived = (timeOfDay - TRADER_DELAY[trader]) / TRADER_ARRIVE;
  return arrived < 0 ? null : Math.min(1, arrived);
}

function alongLegs(legs: Leg[], f: number): { area: AreaId; x: number; y: number } {
  const index = Math.min(legs.length - 1, Math.floor(f * legs.length));
  const leg = legs[index];
  return { area: leg.area, ...between(leg.from, leg.to, f * legs.length - index) };
}

/** Where a trader is on market day: walking in, standing by their cart, or walking out over the dusk. Null when they aren't here. */
export function traderSpot(state: GameState, trader: Trader): { area: AreaId; x: number; y: number; walking: boolean } | null {
  const f = traderProgress(state, trader, state.timeOfDay);
  return f === null ? null : { ...alongLegs(traderLegs(trader), f), walking: f < 1 };
}

/** Where a trader's cart is: at its spot while they stand by it, and just behind them, in the same area, while they walk. */
export function traderCartSpot(state: GameState, trader: Trader): { area: AreaId; x: number; y: number } | null {
  const f = traderProgress(state, trader, state.timeOfDay);
  if (f === null) return null;
  if (f >= 1) return { area: 'hills', ...TRADER_CART_SPOTS[trader] };
  const here = alongLegs(traderLegs(trader), f);
  const behind = alongLegs(traderLegs(trader), Math.max(0, f - 0.02));
  return behind.area === here.area ? behind : null;
}

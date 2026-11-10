import { CAMP_EXIT, HILLS_BRIDGE_EXIT, HOMESTEAD_EXIT, MEADOW_ENTRY } from './areas';
import { afternoonStart, duskLength, nightStart, season, type Season } from './calendar';
import { HALL_DOOR_SPOT } from './castle';
import { HILLS_EXIT } from './hills';
import { JOBS } from './jobs';
import { MARKET_CROWD_SPOTS, isMarketDay, isMarketEve, roadReady, townFull } from './market';
import { STALL_IDS, STALL_JOBS } from './square';
import { isRaining } from './rain';
import type { AreaId, GameState } from './state';
import { TOWN_NAMES } from './town';
import { HOUSE_PLOTS } from './townSites';

// EASTER EGG: the town, see src/game/town.ts. Where the town's people are through the day: at their work by day,
// walking home over the dusk, and indoors at night. They say hello as the survivor passes, and that is all.

export interface PersonSpot { area: AreaId; x: number; y: number; walking: boolean }

/** The way out of each area toward the hills. */
const EXITS: Partial<Record<AreaId, { x: number; y: number }>> = { camp: CAMP_EXIT, homestead: HOMESTEAD_EXIT, quarry: { x: 0, y: 15 }, meadow: { x: MEADOW_ENTRY.x, y: 0 } };

const between = (from: { x: number; y: number }, to: { x: number; y: number }, f: number) => ({ x: from.x + (to.x - from.x) * f, y: from.y + (to.y - from.y) * f });

/** How far through the walk home the day is, from 0 as the dusk begins, or null outside it. */
const walkHome = (state: GameState): number | null => {
  const start = nightStart(state.day) - duskLength(state.day);
  return state.timeOfDay >= start && state.timeOfDay < nightStart(state.day) ? (state.timeOfDay - start) / duskLength(state.day) : null;
};

/** Where someone who stayed is now, or null while they're indoors. Over the dusk they walk out of their job's area, then up the hills to home. */
export function personSpot(state: GameState, index: number): PersonSpot | null {
  const person = state.town.people[index];
  if (!person || state.timeOfDay >= nightStart(state.day)) return null;
  const work = marketSpot(state, index) ?? JOBS[person.job].spot;
  const walk = walkHome(state);
  if (walk === null) return { ...work, walking: false };
  const home = person.house === null ? { area: 'hills' as const, ...HALL_DOOR_SPOT } : HOUSE_PLOTS[person.house];
  return { ...onTheWay(walkLegs(work, home), walk), walking: true };
}

const keepsAStall = (job: string): boolean => STALL_IDS.some(id => STALL_JOBS[id] === job);

/** On market day, where someone who doesn't keep a stall stands about the square instead of at their work. Their work is still done. */
function marketSpot(state: GameState, index: number): { area: AreaId; x: number; y: number } | null {
  if (!isMarketDay(state) || keepsAStall(state.town.people[index].job)) return null;
  // Counted among those who don't keep a stall, so each of them has a spot of their own.
  const place = state.town.people.slice(0, index).filter(person => !keepsAStall(person.job)).length;
  return { area: 'hills', ...MARKET_CROWD_SPOTS[place % MARKET_CROWD_SPOTS.length] };
}

type Leg = { area: AreaId; from: { x: number; y: number }; to: { x: number; y: number } };

/** The stretches of the walk home: out of the work's area to the hills, across them, and over the bridge to a meadow home. */
function walkLegs(work: { area: AreaId; x: number; y: number }, home: { area: AreaId; x: number; y: number }): Leg[] {
  const legs: Leg[] = [];
  let at = { x: work.x, y: work.y };
  if (work.area !== 'hills') {
    legs.push({ area: work.area, from: at, to: EXITS[work.area] ?? at });
    at = HILLS_EXIT;
  }
  if (home.area === 'meadow') {
    legs.push({ area: 'hills', from: at, to: HILLS_BRIDGE_EXIT });
    legs.push({ area: 'meadow', from: MEADOW_ENTRY, to: home });
  } else legs.push({ area: 'hills', from: at, to: home });
  return legs;
}

/** Where along the legs the walk has come, each leg an even share of it. */
function onTheWay(legs: Leg[], walk: number): { area: AreaId; x: number; y: number } {
  const index = Math.min(legs.length - 1, Math.floor(walk * legs.length));
  const leg = legs[index];
  return { area: leg.area, ...between(leg.from, leg.to, walk * legs.length - index) };
}

/** Where the traveller waits by the hall door, by day once they have slept a night by the fire. */
export function travellerSpot(state: GameState): { area: AreaId; x: number; y: number } | null {
  const { traveller } = state.town;
  if (!traveller || state.day <= traveller.arrivedDay || state.timeOfDay >= nightStart(state.day)) return null;
  return { area: 'hills', x: HALL_DOOR_SPOT.x + 1.5, y: HALL_DOOR_SPOT.y + 1 };
}

/** What people say of the season, outside winter. */
const SEASON_LINES: Record<Exclude<Season, 'winter'>, string> = {
  spring: 'The grass is coming on.',
  summer: 'Warm one today.',
  autumn: 'The leaves are turning.'
};

/** What people say of market day: tomorrow's on the eve, the crowd on the day, and, from the stallholders, what the
 * traders wait on while the town is full but the old road isn't ready. */
function marketLine(state: GameState, name: string): string | null {
  if (isMarketEve(state)) return 'Market tomorrow.';
  if (isMarketDay(state)) return 'Busy one today.';
  const person = state.town.people.find(each => each.name === name);
  if (person && keepsAStall(person.job) && state.town.market.openDay === null && townFull(state) && !roadReady(state)) {
    return 'The traders won\'t come till the old road\'s clear and marked.';
  }
  return null;
}

function greetingLine(state: GameState, name: string): string {
  if (walkHome(state) !== null) return 'Good evening.';
  const market = marketLine(state, name);
  if (market) return market;
  if (isRaining(state)) return 'Wet one today.';
  const now = season(state.day);
  if (now === 'winter') return 'Cold one today.';
  // Every other day each person remarks on the season instead, and not all on the same days.
  if ((TOWN_NAMES.indexOf(name) + state.day) % 2 !== 0) return SEASON_LINES[now];
  return state.timeOfDay < afternoonStart(state.day) ? 'Good morning.' : 'Good afternoon.';
}

/** What someone says as the survivor passes. */
export function greeting(state: GameState, name: string): string {
  return `${name} · ${greetingLine(state, name)}`;
}

/** Everyone out in the survivor's area now, with their names and where they are. */
export function townsfolkHere(state: GameState): { name: string; index: number; x: number; y: number; walking: boolean; traveller: boolean }[] {
  const people = state.town.people.flatMap((person, index) => {
    const spot = personSpot(state, index);
    return spot && spot.area === state.area ? [{ name: person.name, index, x: spot.x, y: spot.y, walking: spot.walking, traveller: false }] : [];
  });
  const waiting = travellerSpot(state);
  const { traveller } = state.town;
  return waiting && traveller && waiting.area === state.area
    ? [...people, { name: traveller.name, index: -1, x: waiting.x, y: waiting.y, walking: false, traveller: true }]
    : people;
}

/** The greeting of whoever is within a tile and a half of the survivor, nearest first, or null. */
export function greetingHere(state: GameState): string | null {
  const near = townsfolkHere(state)
    .map(each => ({ each, gap: Math.hypot(each.x - state.player.x, each.y - state.player.y) }))
    .filter(({ gap }) => gap <= 1.5)
    .sort((a, b) => a.gap - b.gap)[0];
  return near ? greeting(state, near.each.name) : null;
}

import { CAMP_EXIT, HOMESTEAD_EXIT } from './areas';
import { afternoonStart, duskLength, isWinter, nightStart } from './calendar';
import { HALL_DOOR_SPOT } from './castle';
import { HILLS_EXIT } from './hills';
import { JOBS } from './jobs';
import type { AreaId, GameState } from './state';
import { HOUSE_PLOTS } from './townSites';

// EASTER EGG: the town, see src/game/town.ts. Where the town's people are through the day: at their work by day,
// walking home over the dusk, and indoors at night. They say hello as the survivor passes, and that is all.

export interface PersonSpot { area: AreaId; x: number; y: number; walking: boolean }

/** The way out of each area toward the hills. */
const EXITS: Partial<Record<AreaId, { x: number; y: number }>> = { camp: CAMP_EXIT, homestead: HOMESTEAD_EXIT, quarry: { x: 0, y: 15 } };

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
  const work = JOBS[person.job].spot;
  const walk = walkHome(state);
  if (walk === null) return { ...work, walking: false };
  const home = person.house === null ? HALL_DOOR_SPOT : HOUSE_PLOTS[person.house];
  if (work.area === 'hills') return { area: 'hills', ...between(work, home, walk), walking: true };
  if (walk < 0.5) return { area: work.area, ...between(work, EXITS[work.area] ?? work, walk * 2), walking: true };
  return { area: 'hills', ...between(HILLS_EXIT, home, (walk - 0.5) * 2), walking: true };
}

/** Where the traveller waits by the hall door, by day once they have slept a night by the fire. */
export function travellerSpot(state: GameState): { area: AreaId; x: number; y: number } | null {
  const { traveller } = state.town;
  if (!traveller || state.day <= traveller.arrivedDay || state.timeOfDay >= nightStart(state.day)) return null;
  return { area: 'hills', x: HALL_DOOR_SPOT.x + 1.5, y: HALL_DOOR_SPOT.y + 1 };
}

/** What someone says as the survivor passes. */
export function greeting(state: GameState, name: string): string {
  if (walkHome(state) !== null) return `${name} · Good evening.`;
  if (isWinter(state.day)) return `${name} · Cold one today.`;
  return state.timeOfDay < afternoonStart(state.day) ? `${name} · Good morning.` : `${name} · Good afternoon.`;
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

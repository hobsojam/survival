import { openJobs } from './jobs';
import type { GameState } from './state';
import { TOWN_NAMES, townStarted, type JobId } from './town';
import { houseNews } from './townSites';

// EASTER EGG: the town, see src/game/town.ts. A lost traveller turns up at the hall door at nightfall, sleeps by the fire,
// and from the next morning asks if there is any work. A yes and they stay; a no and they ask again the next morning,
// until the third, when they go on their way. Someone else comes some days later, so the town is never lost for good.
// After the first has stayed, word gets around: someone new comes a few days after each house is finished, while
// there is still a job for them.

/** How many days after a traveller goes on their way the next one comes. */
export const TRAVELLER_RETURN_DAYS = 10;
/** How many noes a traveller takes before going on their way. */
export const TRAVELLER_REFUSALS = 3;
/** How many days after a house is finished word of it brings someone new. */
export const WORD_DAYS = 5;

/** The lowest finished house no one lives in yet, or null. */
const vacantHouse = (state: GameState): number | null => {
  const index = state.town.houses.findIndex((house, plot) => house.doneDay !== null && !state.town.people.some(person => person.house === plot));
  return index < 0 ? null : index;
};

/** Whether word of a finished house has had time to get around: one stands empty, finished WORD_DAYS or more ago. */
const wordGotAround = (state: GameState): boolean => {
  const plot = vacantHouse(state);
  return plot !== null && state.town.houses[plot].doneDay! + WORD_DAYS <= state.day;
};

/** At nightfall: someone comes to the hall door. The first, once the hall is home and there is work to offer; after
 * someone has stayed, once a house stands empty and word of it has got around, and while there is still a job free. */
export function travellerArrives(next: GameState): void {
  const { town, castle } = next;
  const first = town.people.length === 0;
  // Only the very first traveller needs the hall to be home; after that, word has got around.
  if ((castle.home !== 'hall' && town.namesUsed === 0) || castle.finishedDay === null || town.traveller !== null || town.namesUsed >= TOWN_NAMES.length || openJobs(next).length === 0) return;
  if (!first && !wordGotAround(next)) return;
  if (first && townStarted(next)) return;
  if (town.goneDay !== null && next.day < town.goneDay + TRAVELLER_RETURN_DAYS) return;
  next.town = { ...town, traveller: { name: TOWN_NAMES[town.namesUsed], arrivedDay: next.day, refusals: 0, askedDay: null }, namesUsed: town.namesUsed + 1 };
}

/** Whether the traveller is asking for work now: from the morning after they came, and once a day. */
export function travellerAsking(state: GameState): boolean {
  const { traveller } = state.town;
  return traveller !== null && state.day > traveller.arrivedDay && traveller.askedDay !== state.day;
}

/** Who is asking and the jobs free for them, if they are asking. */
export function travellerOffer(state: GameState): { name: string; jobs: JobId[] } | null {
  const jobs = openJobs(state);
  if (!travellerAsking(state) || jobs.length === 0) return null;
  return { name: state.town.traveller!.name, jobs };
}

/** The survivor's answer: a yes and they take the job given, or the first free, and stay, in the empty house if there
 * is one; a no and they ask again, or after the last one go on their way. A job that isn't free is no answer at all. */
export function answeredTraveller(state: GameState, yes: boolean, given?: JobId): { state: GameState; message: string } {
  const jobs = openJobs(state);
  const job = given ?? jobs[0];
  const { traveller } = state.town;
  if (!travellerAsking(state) || traveller === null || jobs.length === 0 || (yes && !jobs.includes(job))) return { state, message: '' };
  const { name } = traveller;
  if (yes) {
    const town = { ...state.town, traveller: null, people: [...state.town.people, { name, job, house: vacantHouse(state), arrivedDay: traveller.arrivedDay }] };
    return { state: { ...state, town }, message: `${name} will stay.` };
  }
  const refusals = traveller.refusals + 1;
  if (refusals >= TRAVELLER_REFUSALS) {
    return { state: { ...state, town: { ...state.town, traveller: null, goneDay: state.day } }, message: `${name} thanks you for the shelter and goes on their way.` };
  }
  return { state: { ...state, town: { ...state.town, traveller: { ...traveller, refusals, askedDay: state.day } } }, message: `${name} will ask again tomorrow.` };
}

/** The morning after someone came to the door, and after a house was finished. */
export function townNews(before: GameState, after: GameState): string[] {
  const { traveller } = after.town;
  const arrived = after.day > before.day && traveller !== null && traveller.arrivedDay === after.day - 1;
  const line = after.town.people.length === 0
    ? `${traveller?.name}, a lost traveller, came to the hall door at nightfall and slept by the fire.`
    : `${traveller?.name} heard there was work here, and came to the hall door at nightfall.`;
  return [...(arrived ? [line] : []), ...houseNews(before, after), ...meadowNews(before, after)];
}

/** The mornings after the bridge is finished, the meadow road cleared, and its milestone set. */
function meadowNews(before: GameState, after: GameState): string[] {
  if (after.day <= before.day) return [];
  const { bridge, road } = after.town;
  return [
    ...(bridge.doneDays.parapet === before.day ? ['The bridge over the stream is finished.'] : []),
    ...(road.doneDays.road === before.day ? ['The old road through the meadow is clear.'] : []),
    ...(road.doneDays.milestone === before.day ? ['The milestone stands by the meadow road.'] : [])
  ];
}

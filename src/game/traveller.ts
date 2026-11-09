import { JOBS, openJob } from './jobs';
import type { GameState } from './state';
import { TOWN_NAMES, townStarted } from './town';
import { houseNews } from './townSites';

// EASTER EGG: the town, see src/game/town.ts. A lost traveller turns up at the hall door at nightfall, sleeps by the fire,
// and from the next morning asks if there is any work. A yes and they stay; a no and they ask again the next morning,
// until the third, when they go on their way. Someone else comes some days later, so the town is never lost for good.

/** How many days after a traveller goes on their way the next one comes. */
export const TRAVELLER_RETURN_DAYS = 10;
/** How many noes a traveller takes before going on their way. */
export const TRAVELLER_REFUSALS = 3;

/** At nightfall: someone comes to the hall door, once the hall is home and there is work to offer. */
export function travellerArrives(next: GameState): void {
  const { town, castle } = next;
  if (castle.home !== 'hall' || castle.finishedDay === null || townStarted(next) || town.namesUsed >= TOWN_NAMES.length || openJob(next) === null) return;
  if (town.goneDay !== null && next.day < town.goneDay + TRAVELLER_RETURN_DAYS) return;
  next.town = { ...town, traveller: { name: TOWN_NAMES[town.namesUsed], arrivedDay: next.day, refusals: 0, askedDay: null }, namesUsed: town.namesUsed + 1 };
}

/** Whether the traveller is asking for work now: from the morning after they came, and once a day. */
export function travellerAsking(state: GameState): boolean {
  const { traveller } = state.town;
  return traveller !== null && state.day > traveller.arrivedDay && traveller.askedDay !== state.day;
}

/** What the traveller is asking to do, if they are asking. */
export function travellerOffer(state: GameState): { name: string; offer: string } | null {
  const job = openJob(state);
  if (!travellerAsking(state) || job === null) return null;
  return { name: state.town.traveller!.name, offer: JOBS[job].offer };
}

/** The survivor's answer: a yes and they take the first open job and stay; a no and they ask again, or after the last one go on their way. */
export function answeredTraveller(state: GameState, yes: boolean): { state: GameState; message: string } {
  const job = openJob(state);
  const { traveller } = state.town;
  if (!travellerAsking(state) || traveller === null || job === null) return { state, message: '' };
  const { name } = traveller;
  if (yes) {
    const town = { ...state.town, traveller: null, people: [...state.town.people, { name, job, house: null, arrivedDay: traveller.arrivedDay }] };
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
  return [...(arrived ? [`${traveller.name}, a lost traveller, came to the hall door at nightfall and slept by the fire.`] : []), ...houseNews(before, after)];
}

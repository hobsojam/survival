import { isWinter, nightStart } from './calendar';
import { availableFood, spendFood, type FoodItem } from './food';
import { keepFinished } from './keep';
import { BALANCE, type GameState } from './state';

// The wild pony on the hills, won over slowly with apples or vegetables. Once it has its horseshoes it walks beside the
// survivor and carries a load. It is not one of the animal friends: it gives no gifts or keepsakes, and it never leaves.

export interface PonyState {
  /** Offers it has taken. */
  trust: number;
  /** The day of the last offer. */
  lastOffer: number | null;
  /** The day it was won over. */
  won: number | null;
  /** Whether it has reached camp since it was won. */
  home: boolean;
  /** The day it was shod. */
  shod: number | null;
  /** Which of its spots on the hills it is grazing at. */
  spot: number;
  /** Whether the survivor has been told why an unshod pony stays at camp. */
  toldHooves: boolean;
}

export const emptyPony = (): PonyState => ({ trust: 0, lastOffer: null, won: null, home: false, shod: null, spot: 0, toldHooves: false });

/** Where the wild pony grazes, on the grass near the top of the hills. */
export const PONY_SPOTS = [{ x: 22, y: 9 }, { x: 21, y: 4 }, { x: 26, y: 7 }, { x: 16, y: 16 }] as const;

/** Nearer than this and the wild pony ambles off, without costing the day's offer. */
export const SPOOK_RADIUS = 1.5;
/** How near the survivor must be to offer it something: further than the distance that startles it. */
export const OFFER_RANGE = 3;

const isNight = (state: GameState): boolean => state.timeOfDay >= nightStart(state.day);

/** Where the wild pony is grazing: every day, until it is won over. */
export function wildPonyAt(state: GameState): { x: number; y: number } | null {
  return state.pony.won === null && !isNight(state) ? PONY_SPOTS[state.pony.spot] : null;
}

const distanceFrom = (state: GameState, spot: { x: number; y: number }): number => Math.hypot(state.player.x - spot.x, state.player.y - spot.y);

/** What the pony would be offered: apples first, as they don't keep. */
function ponyFood(state: GameState): Extract<FoodItem, 'apple' | 'vegetables'> | null {
  if (availableFood(state, 'apple') > 0) return 'apple';
  return availableFood(state, 'vegetables') > 0 ? 'vegetables' : null;
}

/** Why the pony can't be offered anything now, or null. */
export function ponyOfferBlocker(state: GameState): string | null {
  if (state.pony.won !== null) return 'The pony is yours already.';
  if (state.area !== 'hills') return 'The pony is up on the hills.';
  const pony = wildPonyAt(state);
  if (!pony) return 'The pony has gone off for the night.';
  if (distanceFrom(state, pony) > OFFER_RANGE) return 'Walk a little closer to the pony.';
  if (state.pony.lastOffer === state.day) return 'You have already offered the pony something today.';
  return ponyFood(state) ? null : 'The pony would take an apple or vegetables.';
}

/** The words for the offer a prompt can make, or null. */
export function ponyOfferLabel(state: GameState): string | null {
  if (ponyOfferBlocker(state)) return null;
  return ponyFood(state) === 'apple' ? 'Offer the pony an apple' : 'Offer the pony vegetables';
}

/** Why the wild pony in reach can't be offered anything now, for the prompt; null if it can, or if it isn't in reach. */
export function ponyNote(state: GameState): string | null {
  if (state.pony.won !== null || state.area !== 'hills') return null;
  const pony = wildPonyAt(state);
  if (!pony || distanceFrom(state, pony) > OFFER_RANGE) return null;
  if (state.pony.lastOffer === state.day) return 'Pony · has had its offer today';
  return ponyFood(state) ? null : 'Pony · would take an apple or vegetables';
}

/** Gives the pony its offer and counts it; the fourth wins it over. Time passes in the caller. */
export function offerToPony(state: GameState): { state: GameState; message: string } | null {
  const item = ponyFood(state);
  const spent = item && spendFood(state, item, 1);
  if (!spent) return null;
  const trust = state.pony.trust + 1;
  const won = trust >= BALANCE.ponyTrustTarget;
  return {
    state: { ...spent, pony: { ...state.pony, trust, lastOffer: state.day, won: won ? state.day : null } },
    message: won ? 'The pony pushes its nose into your hand. It follows when you walk on.' : `The pony takes the ${item === 'apple' ? 'apple' : 'vegetables'}, and lets you stand a little nearer.`
  };
}

/** The wild pony ambles to its next spot if the survivor comes too close. Mutates advanceTime's working copy. */
export function startlePony(next: GameState): void {
  if (next.area !== 'hills') return;
  const pony = wildPonyAt(next);
  if (!pony || distanceFrom(next, pony) >= SPOOK_RADIUS) return;
  const onward = PONY_SPOTS.map((_, step) => (next.pony.spot + 1 + step) % PONY_SPOTS.length);
  const spot = onward.find(index => distanceFrom(next, PONY_SPOTS[index]) > SPOOK_RADIUS) ?? next.pony.spot;
  next.pony = { ...next.pony, spot };
}

/** Whether the shod pony is with the survivor now: it stays out of the snow on the hills, and goes home at nightfall unless it stayed by the finished keep tonight. */
export function ponyWith(state: GameState): boolean {
  if (state.pony.shod === null) return false;
  if (state.area === 'hills' && isWinter(state.day)) return false;
  return !isNight(state) || state.area === 'camp' || (state.area === 'hills' && state.keep.ponyNight === state.day);
}

/** Night falling on the survivor and the pony at the finished keep: it stays up there tonight instead of going home. Mutates advanceTime's working copy. */
export function ponyStaysAtKeep(next: GameState): void {
  if (next.pony.shod !== null && next.area === 'hills' && keepFinished(next) && !isWinter(next.day)) next.keep = { ...next.keep, ponyNight: next.day };
}

/** What changing area means for the pony: it can reach home, stay behind for want of shoes, or wait below the snow. */
export function ponyArrives(before: GameState, after: GameState): { state: GameState; message: string } {
  const { pony } = after;
  if (before.area === after.area || pony.won === null) return { state: after, message: '' };
  // Back at camp it is home, wherever it spent the evening.
  if (after.area === 'camp') return { state: { ...after, pony: { ...pony, home: true }, keep: { ...after.keep, ponyNight: null } }, message: '' };
  if (before.area === 'camp' && pony.shod === null && pony.home && !pony.toldHooves) {
    return { state: { ...after, pony: { ...pony, toldHooves: true } }, message: "The pony stops at the edge of camp. Its hooves can't take the stony path yet." };
  }
  if (after.area === 'hills' && pony.shod !== null && isWinter(after.day)) return { state: after, message: "The pony won't go up in the snow. It waits at the foot of the path." };
  return { state: after, message: '' };
}

/** The mornings after the hills' firsts: the first ore, the pony won over and its shoes. Each is worked out from the saved day, so it comes once. */
export function hillsNews(before: GameState, after: GameState): string[] {
  if (after.day <= before.day) return [];
  const pony = after.names.pony ?? 'The pony';
  const notes: string[] = [];
  if (after.progress.oreFoundDay === before.day) notes.push('You could make something of that ore, with a forge at the workshop.');
  if (after.pony.won === before.day) notes.push(`${pony} was grazing near you this morning.`);
  if (after.pony.shod === before.day) notes.push(`${pony} stood easy in the new shoes this morning.`);
  return notes;
}

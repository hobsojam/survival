import { isWinter, nightStart } from './calendar';
import { takeFromBag } from './food';
import { fuelLeft } from './home';
import type { GameState, WolfTake } from './state';

// Wolves come only on winter nights. A visit is saved as the day it happened and what was taken;
// the message, the tracks and the eyes are all worked out from that and the clock.

/** Below this much fuel on a winter night, wolves gather at the camp edge. In the house, the logs in store count too, since the fireplace draws them itself. */
export const WOLF_LOW_FUEL = 20;

const MESSAGES: Record<WolfTake, string | null> = {
  ration: 'A wolf slipped into the dark camp and took a ration.',
  berry: 'A wolf slipped into the dark camp and took a berry.',
  nothing: 'A wolf circled the dark camp but found nothing to take.',
  // The offering said so itself.
  offered: null,
  chased: 'Your wolf saw the others off into the dark.'
};

const winterNight = (state: GameState): boolean => isWinter(state.day) && state.timeOfDay >= nightStart(state.day);

export function wolvesClose(state: GameState): boolean {
  return winterNight(state) && fuelLeft(state) < WOLF_LOW_FUEL;
}

/** The first moment of a winter night that the fire is out (in the house, the fireplace with nothing left in store), a wolf takes a ration, else a berry, unless a friendly wolf sees it off. Mutates advanceTime's working copy. */
export function wolfVisit(next: GameState): void {
  if (!winterNight(next) || fuelLeft(next) > 0 || next.lastWolf?.day === next.day) return;
  if (next.companion.friend === 'wolf') {
    next.lastWolf = { day: next.day, took: 'chased' };
    return;
  }
  const ration = takeFromBag(next, 'trailFood', 1);
  const berry = ration ? null : takeFromBag(next, 'berry', 1);
  const took: WolfTake = ration ? 'ration' : berry ? 'berry' : 'nothing';
  next.inventory = (ration ?? berry ?? next).inventory;
  next.lastWolf = { day: next.day, took };
}

/** What the survivor hears of a wolf visit between two states, once. */
export function wolfMessage(before: GameState, after: GameState): string | null {
  const visit = after.lastWolf;
  if (!visit || visit.day === before.lastWolf?.day) return null;
  return MESSAGES[visit.took];
}

/** Paw prints circle the fire pit from the visit until the next nightfall. */
export function wolfTracksShown(state: GameState): boolean {
  const visit = state.lastWolf;
  if (!visit) return false;
  return visit.day === state.day || (visit.day === state.day - 1 && state.timeOfDay < nightStart(state.day));
}

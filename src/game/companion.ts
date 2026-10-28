import { isWinter, nightStart } from './calendar';
import { isAtCamp } from './rules';
import { BALANCE, type Friend, type GameState } from './state';
import { dayHash, foxAt } from './wildlife';

// One wild animal can become the camp's friend, won over by small offerings it already likes:
// the birds peck at berries, the fox noses at the bushes, and the winter wolves take rations.

/** Offerings each animal takes before it stays. */
export const TRUST_TARGET: Record<Friend, number> = { bird: 5, fox: 4, wolf: 3 };

export const OFFER_PROMPT: Record<Friend, string> = {
  bird: 'Scatter a berry for the birds',
  fox: 'Leave a berry for the fox',
  wolf: 'Leave a ration out for the wolves'
};

const OFFERED: Record<Friend, string> = {
  bird: 'The birds peck at the berry. One lingers a moment longer.',
  fox: 'The fox takes the berry, and watches you a while.',
  wolf: 'Something takes the ration from the edge of the firelight.'
};

const STAYED: Record<Friend, string> = {
  bird: 'A little bird has decided to stay.',
  fox: 'The fox curled up by the fire, and stayed.',
  wolf: 'A young wolf stepped into the firelight, and lay down.'
};

const night = (state: GameState): boolean => state.timeOfDay >= nightStart(state.day);
const byBush = (state: GameState): boolean => state.nodes.some(node => node.kind === 'berry'
  && Math.hypot(node.x - state.player.x, node.y - state.player.y) <= BALANCE.interactionRadius);

/** Whether each animal is here and in the mood, and the survivor has what it likes. */
const WILLING: Record<Friend, (state: GameState) => boolean> = {
  fox: state => state.inventory.food > 0 && foxAt(state.day, state.timeOfDay)?.sitting === true,
  wolf: state => state.inventory.trailFood > 0 && isWinter(state.day) && night(state),
  bird: state => state.inventory.food > 0 && !isWinter(state.day) && !night(state) && byBush(state)
};
const ORDER: readonly Friend[] = ['fox', 'wolf', 'bird'];

/** Which animal an offering would go to here and now, the fox first; none once a friend has stayed. */
export function offerFor(state: GameState): Friend | null {
  if (state.companion.friend || !isAtCamp(state)) return null;
  return ORDER.find(animal => state.companion.lastOffer[animal] !== state.day && WILLING[animal](state)) ?? null;
}

export function offerBlocker(state: GameState): string | null {
  if (offerFor(state)) return null;
  const waiting = !state.companion.friend && isAtCamp(state) && ORDER.some(animal => WILLING[animal](state));
  return waiting ? 'You have already left something out today.' : 'Nothing here wants an offering right now.';
}

/** Leaves the offering out and counts it; the animal that reaches its count stays. Time passes in the caller. */
export function makeOffering(state: GameState): { state: GameState; message: string } | null {
  const animal = offerFor(state);
  if (!animal) return null;
  const trust = { ...state.companion.trust, [animal]: state.companion.trust[animal] + 1 };
  const stays = trust[animal] >= TRUST_TARGET[animal];
  const inventory = animal === 'wolf'
    ? { ...state.inventory, trailFood: state.inventory.trailFood - 1 }
    : { ...state.inventory, food: state.inventory.food - 1 };
  // A ration left out is that night's wolf visit, so nothing more is taken.
  const lastWolf = animal === 'wolf' && state.lastWolf?.day !== state.day ? { day: state.day, took: 'offered' as const } : state.lastWolf;
  const companion = {
    ...state.companion, trust, lastOffer: { ...state.companion.lastOffer, [animal]: state.day },
    ...(stays ? { friend: animal, since: state.day, lastFind: state.day, lastGift: state.day } : {})
  };
  return { state: { ...state, inventory, lastWolf, companion }, message: stays ? STAYED[animal] : OFFERED[animal] };
}

/**
 * Whether a find comes at this dawn: never in the two dawns after the last, then an even chance each dawn.
 * The salt keeps separate kinds of find on their own sequences.
 */
export function findDue(day: number, lastDay: number, salt: number): boolean {
  return day - lastDay >= 3 && dayHash(day + salt) < 0.5;
}

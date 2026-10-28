import { isWinter, nightStart } from './calendar';
import { TOO_TIRED_MESSAGE, isExhausted } from './needs';
import { freeSpaces, isAtCamp } from './camp';
import { BALANCE, type Friend, type GameState } from './state';
import { dayHash, foxAt, foxSpookRadius } from './wildlife';

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
  fox: state => {
    const fox = foxAt(state.day, state.timeOfDay);
    return state.inventory.food > 0 && state.companion.foxFled !== state.day && (fox?.sitting === true || fox?.nibbling === true);
  },
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

/** The wild fox runs off for the evening if the survivor comes too close. Mutates advanceTime's working copy. */
export function startleFox(next: GameState): void {
  const { friend, trust, foxFled } = next.companion;
  if (friend === 'fox' || foxFled === next.day || next.area !== 'camp') return;
  const fox = foxAt(next.day, next.timeOfDay, trust.fox);
  if (fox && Math.hypot(fox.x - next.player.x, fox.y - next.player.y) < foxSpookRadius(trust.fox)) {
    next.companion = { ...next.companion, foxFled: next.day };
  }
}

/**
 * Whether a find comes at this dawn: never in the two dawns after the last, then an even chance each dawn.
 * The salt keeps separate kinds of find on their own sequences.
 */
export function findDue(day: number, lastDay: number, salt: number): boolean {
  return day - lastDay >= 3 && dayHash(day + salt) < 0.5;
}

/** Pieces of fur or feathers an item takes; the friend stops shedding while this many are held. */
export const KEEPSAKES_NEEDED = 6;
/** Where a shed piece lies, just beside the fire, and how near the survivor walks to pick it up. */
export const KEEPSAKE_SPOT = { x: BALANCE.campX - 0.6, y: BALANCE.campY - 0.9 } as const;
const PICK_UP_RADIUS = 0.9;
// Shedding and the fox's berry each roll their own dice, on sequences of their own.
const SHED_SALT = 71;
const GIFT_SALT = 50;

export const keepsakeKind = (friend: Friend): 'feather' | 'fur' => (friend === 'bird' ? 'feather' : 'fur');
const itemMade = (state: GameState): boolean => state.companion.pillow || state.companion.cloak;

/** Once the item is made, a shed piece still shows by the fire on its dawn, as scenery only. */
export const sceneryKeepsake = (state: GameState): boolean => itemMade(state) && state.companion.lastFind === state.day;

/** The friend's dawn: now and then a piece of fur or a feather by the fire, and the fox's berry. Mutates advanceTime's working copy. */
export function companionDawn(next: GameState): void {
  const companion = next.companion;
  if (!companion.friend) return;
  let changes: Partial<GameState['companion']> = {};
  if (findDue(next.day, companion.lastFind, SHED_SALT)) {
    if (itemMade(next)) changes = { lastFind: next.day };
    else if (!companion.keepsakeLying && companion.keepsakes < KEEPSAKES_NEEDED) changes = { lastFind: next.day, keepsakeLying: true };
  }
  // The fox leaves its berry by the bedroll, so only on a dawn the survivor wakes at camp.
  const home = next.area === 'camp';
  if (companion.friend === 'fox' && home && findDue(next.day, companion.lastGift, GIFT_SALT) && freeSpaces(next) >= 1) {
    changes = { ...changes, lastGift: next.day };
    next.inventory = { ...next.inventory, food: next.inventory.food + 1 };
  }
  next.companion = { ...companion, ...changes };
}

/** Walking up to a shed piece picks it up. */
export function pickUpKeepsake(state: GameState): GameState {
  const near = Math.hypot(state.player.x - KEEPSAKE_SPOT.x, state.player.y - KEEPSAKE_SPOT.y) <= PICK_UP_RADIUS;
  if (!state.companion.keepsakeLying || state.area !== 'camp' || !near) return state;
  return { ...state, companion: { ...state.companion, keepsakeLying: false, keepsakes: state.companion.keepsakes + 1 } };
}

/** What the survivor notices of their friend between two states. */
export function companionNews(before: GameState, after: GameState): string[] {
  const friend = after.companion.friend;
  if (!friend) return [];
  const piece = keepsakeKind(friend) === 'feather' ? 'a feather' : 'a tuft of fur';
  const news: string[] = [];
  if (after.companion.lastGift > before.companion.lastGift && friend === 'fox') news.push('The fox left a berry by your bedroll.');
  if (after.companion.keepsakeLying && !before.companion.keepsakeLying) news.push(`${piece[0].toUpperCase()}${piece.slice(1)} lies by the fire.`);
  if (after.companion.keepsakes > before.companion.keepsakes) news.push(`You found ${piece} by the fire.`);
  return news;
}

/** Seconds of sleep before a friendly bird wakes the sleeper on a winter night, as the fire falls to 20 s; null if it won't. */
export function alarmAfter(state: GameState): number | null {
  const { friend, alarmDay } = state.companion;
  if (friend !== 'bird' || !isWinter(state.day) || !night(state) || alarmDay === state.day || state.fireFuel <= 0) return null;
  return Math.max(0, (state.fireFuel - BALANCE.alarmFuel) / BALANCE.coldNightFireBurn);
}

const ITEMS = {
  pillow: { friendly: (friend: Friend | null) => friend === 'bird', name: 'pillow', pieces: 'feathers' },
  cloak: { friendly: (friend: Friend | null) => friend !== null && friend !== 'bird', name: 'cloak', pieces: 'fur' }
} as const;

function itemBlocker(state: GameState, item: keyof typeof ITEMS): string | null {
  const { friendly, name, pieces } = ITEMS[item];
  if (state.companion[item]) return `You already have the ${name}.`;
  if (!friendly(state.companion.friend)) return `You need ${pieces} for a ${name}.`;
  if (!state.structures.toolshed) return 'Build a toolshed first.';
  if (item === 'pillow' && !state.structures.bed) return 'Build a bed first.';
  if (!isAtCamp(state)) return `Return to camp to make the ${name}.`;
  if (isExhausted(state)) return TOO_TIRED_MESSAGE;
  if (state.companion.keepsakes < KEEPSAKES_NEEDED) return `Need ${KEEPSAKES_NEEDED} ${pieces} for the ${name}.`;
  return null;
}

export const pillowBlocker = (state: GameState): string | null => itemBlocker(state, 'pillow');
export const cloakBlocker = (state: GameState): string | null => itemBlocker(state, 'cloak');

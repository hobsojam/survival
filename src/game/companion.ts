import { isWinter, nightStart } from './calendar';
import { TOO_TIRED_MESSAGE, isExhausted } from './needs';
import { freeSpaces, isInClearing } from './camp';
import { fuelLeft } from './home';
import { inKeep } from './keep';
import { addFood, availableFood, spendFood, type FoodItem } from './food';
import { BALANCE, type Friend, type GameState } from './state';
import { friendCalled } from './names';
import { dayHash, foxAt, foxSpookRadius } from './wildlife';

// Wild animals can become camp friends, won over by small offerings they already like:
// the birds peck at berries, the fox noses at the bushes, and the winter wolves take rations.

/** Offerings each animal takes before it stays. */
export const TRUST_TARGET: Record<Friend, number> = { bird: 5, fox: 4, wolf: 3 };

/** What the fox is offered: in winter a hazelnut if any is to hand, else a berry; null if there is neither. */
function foxFood(state: GameState): 'hazelnut' | 'berry' | null {
  if (isWinter(state.day) && availableFood(state, 'hazelnut') > 0) return 'hazelnut';
  return availableFood(state, 'berry') > 0 ? 'berry' : null;
}

/** What is spent on an offering to this animal. */
function offeringFood(state: GameState, animal: Friend): FoodItem {
  if (animal === 'wolf') return 'trailFood';
  if (animal === 'fox') return foxFood(state) ?? 'berry';
  return 'berry';
}

export function offerPrompt(state: GameState, animal: Friend): string {
  if (animal === 'bird') return 'Scatter a berry for the birds';
  if (animal === 'wolf') return 'Leave a ration out for the wolves';
  return `Leave a ${offeringFood(state, 'fox') === 'hazelnut' ? 'hazelnut' : 'berry'} for the fox`;
}

const offeredMessage = (state: GameState, animal: Friend): string => {
  if (animal === 'bird') return 'The birds peck at the berry. One lingers a moment longer.';
  if (animal === 'wolf') return 'Something takes the ration from the edge of the firelight.';
  return `The fox takes the ${offeringFood(state, 'fox') === 'hazelnut' ? 'hazelnut' : 'berry'}, and watches you a while.`;
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
    return foxFood(state) !== null && state.companion.foxFled !== state.day && (fox?.sitting === true || fox?.nibbling === true);
  },
  wolf: state => availableFood(state, 'trailFood') > 0 && isWinter(state.day) && night(state),
  bird: state => availableFood(state, 'berry') > 0 && !isWinter(state.day) && !night(state) && byBush(state)
};
const ORDER: readonly Friend[] = ['fox', 'wolf', 'bird'];

export function hasFriend(state: GameState, animal: Friend): boolean {
  return state.companion.friends[animal] !== null || state.companion.friend === animal;
}

/** Which still-wild animal an offering would go to here and now, the fox first. */
export function offerFor(state: GameState): Friend | null {
  if (!isInClearing(state)) return null;
  return ORDER.find(animal => !hasFriend(state, animal) && state.companion.lastOffer[animal] !== state.day && WILLING[animal](state)) ?? null;
}

export function offerBlocker(state: GameState): string | null {
  if (offerFor(state)) return null;
  const waiting = isInClearing(state) && ORDER.some(animal => !hasFriend(state, animal) && WILLING[animal](state));
  return waiting ? 'You have already left something out today.' : 'Nothing here wants an offering right now.';
}

/** Leaves the offering out and counts it; the animal that reaches its count stays. Time passes in the caller. */
export function makeOffering(state: GameState): { state: GameState; message: string } | null {
  const animal = offerFor(state);
  const spent = animal && spendFood(state, offeringFood(state, animal), 1);
  if (!animal || !spent) return null;
  const trust = { ...state.companion.trust, [animal]: state.companion.trust[animal] + 1 };
  const stays = trust[animal] >= TRUST_TARGET[animal];
  // A ration left out is that night's wolf visit, so nothing more is taken.
  const lastWolf = animal === 'wolf' && state.lastWolf?.day !== state.day ? { day: state.day, took: 'offered' as const } : state.lastWolf;
  const companion = {
    ...state.companion, trust, lastOffer: { ...state.companion.lastOffer, [animal]: state.day },
    ...(stays ? {
      friends: { ...state.companion.friends, [animal]: state.day },
      lastFindByKind: { ...state.companion.lastFindByKind, [keepsakeKind(animal)]: state.day },
      ...(animal === 'fox' || animal === 'wolf' ? { lastGiftByFriend: { ...state.companion.lastGiftByFriend, [animal]: state.day } } : {}),
      ...(state.companion.friend ? {} : { friend: animal, since: state.day, lastFind: state.day, lastGift: state.day })
    } : {})
  };
  return { state: { ...spent, lastWolf, companion }, message: stays ? STAYED[animal] : offeredMessage(state, animal) };
}

/** The wild fox runs off for the evening if the survivor comes too close. Mutates advanceTime's working copy. */
export function startleFox(next: GameState): void {
  const { trust, foxFled } = next.companion;
  if (hasFriend(next, 'fox') || foxFled === next.day || next.area !== 'camp') return;
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
const itemMade = (state: GameState, kind: 'feather' | 'fur'): boolean => kind === 'feather' ? state.companion.pillow : state.companion.cloak;

function stockFor(state: GameState, kind: 'feather' | 'fur'): number {
  if (state.companion.friend && keepsakeKind(state.companion.friend) === kind) {
    return Math.max(state.companion.keepsakesByKind[kind], state.companion.keepsakes);
  }
  return state.companion.keepsakesByKind[kind];
}

export function keepsakeStock(state: GameState, kind: 'feather' | 'fur'): number { return stockFor(state, kind); }

/** Whether a feather has ever been picked up: one still held, or those spent on the pillow. */
export const feathersFound = (state: GameState): boolean => stockFor(state, 'feather') > 0 || state.companion.pillow;

/** Whether a friend can still leave a keepsake: each kind stops once its item is made. */
export const keepsakesToCome = (state: GameState): boolean =>
  (hasFriend(state, 'bird') && !state.companion.pillow) || ((hasFriend(state, 'fox') || hasFriend(state, 'wolf')) && !state.companion.cloak);

/** Once the item is made, a shed piece still shows by the fire on its dawn, as scenery only. */
export const sceneryKeepsake = (state: GameState): boolean => (['feather', 'fur'] as const).some(kind =>
  itemMade(state, kind) && state.companion.lastFindByKind[kind] === state.day);

/** The friend's dawn: now and then a piece of fur or a feather by the fire, and the fox's berry. Mutates advanceTime's working copy. */
export function companionDawn(next: GameState): void {
  const companion = next.companion;
  if (!(['bird', 'fox', 'wolf'] as const).some(animal => hasFriend(next, animal))) return;
  const stock = { ...companion.keepsakesByKind };
  const lying = { ...companion.lyingByKind };
  const lastFind = { ...companion.lastFindByKind };
  const gifts = { ...companion.lastGiftByFriend };
  const firstKind = companion.friend ? keepsakeKind(companion.friend) : null;
  if (firstKind && companion.keepsakeLying) lying[firstKind] = true;
  for (const kind of ['feather', 'fur'] as const) {
    const friendHere = kind === 'feather' ? hasFriend(next, 'bird') : hasFriend(next, 'fox') || hasFriend(next, 'wolf');
    const previous = companion.friend && keepsakeKind(companion.friend) === kind ? Math.max(lastFind[kind], companion.lastFind) : lastFind[kind];
    if (!friendHere || !findDue(next.day, previous, SHED_SALT)) continue;
    if (itemMade(next, kind)) lastFind[kind] = next.day;
    else if (!lying[kind] && stockFor(next, kind) < KEEPSAKES_NEEDED) {
      lastFind[kind] = next.day;
      lying[kind] = true;
    }
  }
  // The fox leaves its berry by the bedroll, so only on a dawn the survivor wakes at camp.
  const home = next.area === 'camp';
  const foxGift = companion.friend === 'fox' ? Math.max(gifts.fox, companion.lastGift) : gifts.fox;
  if (hasFriend(next, 'fox') && home && findDue(next.day, foxGift, GIFT_SALT) && freeSpaces(next) >= 1) {
    gifts.fox = next.day;
    next.inventory = { ...next.inventory, food: addFood(next.inventory.food, 'berry', 1, next.day) };
  }
  // A wolf friend hunts in winter, and now and then brings a rabbit home, like a dog with a stick.
  // EASTER EGG: the rabbit is deliberately left out of the README and hidden on screen until the first
  // one arrives, so finding it is a surprise. Don't document it for players. See AGENTS.md.
  const wolfGift = companion.friend === 'wolf' ? Math.max(gifts.wolf, companion.lastGift) : gifts.wolf;
  if (hasFriend(next, 'wolf') && home && isWinter(next.day) && next.day - wolfGift >= BALANCE.rabbitEveryDays && freeSpaces(next) >= 1) {
    gifts.wolf = next.day;
    next.inventory = { ...next.inventory, food: addFood(next.inventory.food, 'rabbit', 1, next.day) };
  }
  next.companion = { ...companion, keepsakesByKind: stock, lyingByKind: lying, lastFindByKind: lastFind,
    lastGiftByFriend: gifts, lastFind: firstKind && lastFind[firstKind] > companion.lastFind ? lastFind[firstKind] : companion.lastFind,
    lastGift: companion.friend === 'fox' || companion.friend === 'wolf'
      ? Math.max(gifts[companion.friend], companion.lastGift) : companion.lastGift,
    keepsakeLying: firstKind ? lying[firstKind] : false };
}

/** Walking up to a shed piece picks it up. */
export function pickUpKeepsake(state: GameState): GameState {
  const near = Math.hypot(state.player.x - KEEPSAKE_SPOT.x, state.player.y - KEEPSAKE_SPOT.y) <= PICK_UP_RADIUS;
  if (state.area !== 'camp' || !near) return state;
  const lying = { ...state.companion.lyingByKind };
  const stock = { ...state.companion.keepsakesByKind };
  const first = state.companion.friend ? keepsakeKind(state.companion.friend) : null;
  if (first && state.companion.keepsakeLying) lying[first] = true;
  if (!lying.feather && !lying.fur) return state;
  for (const kind of ['feather', 'fur'] as const) if (lying[kind]) {
    stock[kind] = stockFor(state, kind) + 1;
    lying[kind] = false;
  }
  return { ...state, companion: { ...state.companion, keepsakesByKind: stock, lyingByKind: lying,
    keepsakes: first ? stock[first] : state.companion.keepsakes, keepsakeLying: first ? lying[first] : false } };
}

/** What the survivor notices of their friend between two states. */
export function companionNews(before: GameState, after: GameState): string[] {
  const news: string[] = [];
  if (after.companion.lastGiftByFriend.fox > before.companion.lastGiftByFriend.fox) news.push(`${friendCalled(after, 'fox', 'The fox')} left a berry by your bedroll.`);
  if (after.companion.lastGiftByFriend.wolf > before.companion.lastGiftByFriend.wolf) news.push(`${friendCalled(after, 'wolf', 'Your wolf')} left a rabbit by your bedroll.`);
  for (const kind of ['feather', 'fur'] as const) {
    const piece = kind === 'feather' ? 'a feather' : 'a tuft of fur';
    if (after.companion.lyingByKind[kind] && !before.companion.lyingByKind[kind]) news.push(`${piece[0].toUpperCase()}${piece.slice(1)} lies by the fire.`);
    if (after.companion.keepsakesByKind[kind] > before.companion.keepsakesByKind[kind]) news.push(`You found ${piece} by the fire.`);
  }
  return news;
}

/** Seconds of sleep before a friendly bird wakes the sleeper on a winter night, as the fire falls to 20 s; null if it won't. In the house, the logs in store keep the fireplace going. */
export function alarmAfter(state: GameState): number | null {
  const { alarmDay } = state.companion;
  const fuel = fuelLeft(state);
  if (!hasFriend(state, 'bird') || !isWinter(state.day) || !night(state) || alarmDay === state.day || fuel <= 0 || inKeep(state)) return null;
  return Math.max(0, (fuel - BALANCE.alarmFuel) / BALANCE.coldNightFireBurn);
}

const ITEMS = {
  pillow: { friendly: (state: GameState) => hasFriend(state, 'bird'), name: 'pillow', pieces: 'feathers', kind: 'feather' },
  cloak: { friendly: (state: GameState) => hasFriend(state, 'fox') || hasFriend(state, 'wolf'), name: 'cloak', pieces: 'fur', kind: 'fur' }
} as const;

function itemBlocker(state: GameState, item: keyof typeof ITEMS): string | null {
  const { friendly, name, pieces, kind } = ITEMS[item];
  if (state.companion[item]) return `You already have the ${name}.`;
  if (!friendly(state)) return `You need ${pieces} for a ${name}.`;
  if (!state.structures.toolshed) return 'Build a toolshed first.';
  if (item === 'pillow' && !state.structures.bed) return 'Build a bed first.';
  if (!isInClearing(state)) return `Return to camp to make the ${name}.`;
  if (isExhausted(state)) return TOO_TIRED_MESSAGE;
  if (stockFor(state, kind) < KEEPSAKES_NEEDED) return `Need ${KEEPSAKES_NEEDED} ${pieces} for the ${name}.`;
  return null;
}

export const pillowBlocker = (state: GameState): string | null => itemBlocker(state, 'pillow');
export const cloakBlocker = (state: GameState): string | null => itemBlocker(state, 'cloak');

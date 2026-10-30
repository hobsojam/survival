import { BALANCE, type GameState } from './state';


// Food the survivor carries. Fresh food remembers the day each piece was picked, so it can spoil;
// kept food is just a count. Every eater goes through availableFood and spendFood.

export type FreshFood = 'berry' | 'greens';
export type KeptFood = 'hazelnut' | 'honey' | 'pineNeedles' | 'roastedHazelnuts' | 'trailFood';
export type FoodItem = FreshFood | KeptFood;

export const FOOD_ITEMS: readonly FoodItem[] = ['berry', 'greens', 'hazelnut', 'honey', 'pineNeedles', 'roastedHazelnuts', 'trailFood'];

export interface FoodStore {
  berry: number[];
  greens: number[];
  hazelnut: number;
  honey: number;
  pineNeedles: number;
  roastedHazelnuts: number;
  trailFood: number;
}

export function emptyFood(): FoodStore {
  return { berry: [], greens: [], hazelnut: 0, honey: 0, pineNeedles: 0, roastedHazelnuts: 0, trailFood: 0 };
}

export function isFresh(item: FoodItem): item is FreshFood {
  return item === 'berry' || item === 'greens';
}

export function foodCount(store: FoodStore, item: FoodItem): number {
  return isFresh(item) ? store[item].length : store[item];
}

export function storeTotal(store: FoodStore): number {
  return FOOD_ITEMS.reduce((total, item) => total + foodCount(store, item), 0);
}

/** Adds n of an item; fresh items are recorded as picked on `day`. */
export function addFood(store: FoodStore, item: FoodItem, n: number, day: number): FoodStore {
  if (isFresh(item)) return { ...store, [item]: [...store[item], ...Array.from({ length: n }, () => day)] };
  return { ...store, [item]: store[item] + n };
}

/** Takes n of an item from one store, the oldest fresh pieces first. Null if there isn't enough. */
function takeFrom(store: FoodStore, item: FoodItem, n: number): FoodStore | null {
  if (foodCount(store, item) < n) return null;
  if (isFresh(item)) return { ...store, [item]: [...store[item]].sort((a, b) => a - b).slice(n) };
  return { ...store, [item]: store[item] - n };
}

/** The food the survivor can reach: the bag only, until a larder is within reach. */
export function availableFood(state: GameState, item: FoodItem): number {
  return foodCount(state.inventory.food, item);
}

/** Spends n of an item from reachable food: fresh oldest-first, kept bag-first. Null if there isn't enough. */
export function spendFood(state: GameState, item: FoodItem, n: number): GameState | null {
  return takeFromBag(state, item, n);
}

/** Takes from the bag alone, oldest-first: for the wolf. */
export function takeFromBag(state: GameState, item: FoodItem, n: number): GameState | null {
  const food = takeFrom(state.inventory.food, item, n);
  return food && { ...state, inventory: { ...state.inventory, food } };
}

/** Food eaten as it is. Pine needles are for tea, and rations have their own key. */
export type EdibleFood = 'berry' | 'greens' | 'hazelnut' | 'honey' | 'roastedHazelnuts';

/** What eating one of each gives, as BALANCE keys: state.ts loads this module first, so BALANCE is read only when eating. */
const EAT_EFFECTS: Record<EdibleFood, { hunger: keyof typeof BALANCE; energy?: keyof typeof BALANCE; message: string }> = {
  berry: { hunger: 'eatHungerGain', message: 'Ate some berries.' },
  greens: { hunger: 'greensHunger', message: 'Ate a handful of greens.' },
  hazelnut: { hunger: 'hazelnutHunger', message: 'Ate a hazelnut.' },
  honey: { hunger: 'honeyHunger', energy: 'honeyEnergy', message: 'Ate some honey.' },
  roastedHazelnuts: { hunger: 'roastedHazelnutHunger', message: 'Ate the roasted hazelnuts.' }
};

/** The hunger and energy one of an item gives, and the line said on eating it. */
export function eatEffect(item: EdibleFood): { hunger: number; energy: number; message: string } {
  const { hunger, energy, message } = EAT_EFFECTS[item];
  return { hunger: BALANCE[hunger], energy: energy ? BALANCE[energy] : 0, message };
}

/** The day the oldest piece of a fresh item in the bag was picked, or Infinity if there is none. */
const oldestPick = (state: GameState, item: FreshFood): number => availableFood(state, item) > 0 ? Math.min(...state.inventory.food[item]) : Infinity;

/** What Q eats: the fresh item nearest to going soft (berry wins a tie), then hazelnut, honey, roasted hazelnuts. Never pine needles or rations. */
export function quickEatItem(state: GameState): FoodItem | null {
  const berry = oldestPick(state, 'berry'), greens = oldestPick(state, 'greens');
  if (berry !== Infinity || greens !== Infinity) return berry <= greens ? 'berry' : 'greens';
  return (['hazelnut', 'honey', 'roastedHazelnuts'] as const).find(item => availableFood(state, item) > 0) ?? null;
}

/** Fresh food is gone at a dawn once it has been kept for keepDays or more. */
const gone = (picked: number, day: number, keepDays: number): boolean => day - picked >= keepDays;

/** What a dawn on `day` throws out of a store, and what is left. */
export function spoil(store: FoodStore, day: number, keepDays: number): { store: FoodStore; lost: Record<FreshFood, number> } {
  const kept: FoodStore = { ...store };
  const lost: Record<FreshFood, number> = { berry: 0, greens: 0 };
  for (const item of ['berry', 'greens'] as const) {
    kept[item] = store[item].filter(picked => !gone(picked, day, keepDays));
    lost[item] = store[item].length - kept[item].length;
  }
  return { store: kept, lost };
}

/** How many of a fresh item will be gone at the next dawn. */
export function goingSoft(store: FoodStore, item: FreshFood, day: number, keepDays: number): number {
  return store[item].filter(picked => gone(picked, day + 1, keepDays)).length;
}

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** "a berry" or "two berries": number words up to ten, then digits. */
const quantity = (n: number, one: string, many: string): string => n === 1 ? one : `${NUMBER_WORDS[n] ?? n} ${many}`;

/** The morning line about food thrown out at this dawn, or null if nothing went soft. */
export function spoilMessage(before: GameState, after: GameState): string | null {
  const spoiled = after.lastSpoiled;
  if (!spoiled || spoiled.day === before.lastSpoiled?.day) return null;
  const text = [
    spoiled.berry ? quantity(spoiled.berry, 'a berry', 'berries') : '',
    spoiled.greens ? quantity(spoiled.greens, 'a handful of greens', 'handfuls of greens') : ''
  ].filter(Boolean).join(' and ');
  const them = spoiled.berry + spoiled.greens === 1 ? 'it' : 'them';
  return `${text[0].toUpperCase()}${text.slice(1)} had gone soft, so you threw ${them} out.`;
}

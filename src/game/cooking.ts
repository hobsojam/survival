import { nightStart } from './calendar';
import { availableStone, availableWood, freeSpaces, isAtCamp, isInClearing } from './camp';
import { fuelLeft, isAtHome, livesInHouse } from './home';
import { addFood, availableFood, spendFood, type FoodItem } from './food';
import { TOO_TIRED_MESSAGE, isExhausted } from './needs';
import { BALANCE, type GameState } from './state';

// Cooking at the evening fire. Without the pot it is one berry toasted on a stick; the pot, made at the toolshed,
// adds tea, salad, roasted nuts, honey cake and, once the well stands, vegetable stew. Every dish is cooked after dark, at camp, at a lit fire.

export type DishId = 'fish' | 'berries' | 'pineTea' | 'salad' | 'roastedHazelnuts' | 'honeyCake' | 'stew';

export const DISHES: Record<DishId, { name: string; ingredients: Partial<Record<FoodItem, number>>; potOnly: boolean }> = {
  fish: { name: 'a fish', ingredients: { fish: 1 }, potOnly: false },
  berries: { name: 'a berry', ingredients: { berry: 1 }, potOnly: false },
  pineTea: { name: 'pine needle tea', ingredients: { pineNeedles: 1 }, potOnly: true },
  salad: { name: 'greens and berry salad', ingredients: { greens: 1, berry: 1 }, potOnly: true },
  roastedHazelnuts: { name: 'roasted hazelnuts', ingredients: { hazelnut: 2 }, potOnly: true },
  honeyCake: { name: 'honey cake', ingredients: { honey: 1, hazelnut: 1, berry: 1 }, potOnly: true },
  stew: { name: 'vegetable stew', ingredients: { vegetables: 2 }, potOnly: true }
};

export const DISH_ORDER: readonly DishId[] = ['fish', 'berries', 'pineTea', 'salad', 'roastedHazelnuts', 'honeyCake', 'stew'];

export const POT_COST = { wood: 1, fiber: 0, stone: 2 } as const;

/** Why the pot can't be made right now, or null if it can. Stone can come from the camp stone pile. */
export function potBlocker(state: GameState): string | null {
  if (state.progress.potCrafted) return 'You already have a cooking pot.';
  if (!state.structures.toolshed) return 'Build a toolshed first.';
  if (!isInClearing(state)) return 'Return to camp to make the pot.';
  if (isExhausted(state)) return TOO_TIRED_MESSAGE;
  if (availableWood(state) < POT_COST.wood || availableStone(state) < POT_COST.stone) return 'Need 1 wood and 2 stone for the pot.';
  return null;
}

/** Why there is no fire to cook at here: in the house it is the fireplace, otherwise the campfire. */
function cookingFireBlocker(state: GameState): string | null {
  if (livesInHouse(state)) {
    if (!isAtHome(state)) return 'Go home to cook.';
    return fuelLeft(state) <= 0 ? 'The fireplace is out. Stock the wood store.' : null;
  }
  if (!isAtCamp(state)) return 'Return to camp to cook.';
  return state.fireFuel <= 0 ? 'Light the campfire before cooking.' : null;
}

/** Why the survivor can't toast a berry right now, or null if they can: the cooking there is without the pot. */
export function cookBlocker(state: GameState): string | null {
  if (state.timeOfDay < nightStart(state.day)) return 'Cook berries after nightfall.';
  const fire = cookingFireBlocker(state);
  if (fire) return fire;
  if (availableFood(state, 'berry') <= 0) return 'Gather a berry to cook.';
  return null;
}

const FOOD_WORDS: Record<FoodItem, [string, string]> = {
  berry: ['berry', 'berries'], greens: ['greens', 'greens'], hazelnut: ['hazelnut', 'hazelnuts'], honey: ['honey', 'honey'],
  pineNeedles: ['pine needles', 'pine needles'], roastedHazelnuts: ['roasted hazelnuts', 'roasted hazelnuts'], trailFood: ['ration', 'rations'],
  vegetables: ['vegetable', 'vegetables'], fish: ['fish', 'fish']
};

/** An item's name for a count of it: "berry" or "berries". */
export const foodWord = (item: FoodItem, n: number): string => FOOD_WORDS[item][n === 1 ? 0 : 1];

const recipe = (dish: DishId): [FoodItem, number][] => Object.entries(DISHES[dish].ingredients) as [FoodItem, number][];

/** "1 greens and 1 berry", or "1 honey, 1 hazelnut and 1 berry". */
export function ingredientList(dish: DishId): string {
  const parts = recipe(dish).map(([item, n]) => `${n} ${foodWord(item, n)}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0];
}

/** The state with a dish's ingredients paid for, oldest first, or null if any is short. */
export function spendIngredients(state: GameState, dish: DishId): GameState | null {
  return recipe(dish).reduce<GameState | null>((paid, [item, n]) => paid && spendFood(paid, item, n), state);
}

/** Why this dish can't be cooked now, or null. Includes cookBlocker's time/place/fire checks. */
export function dishBlocker(state: GameState, dish: DishId): string | null {
  if (dish === 'berries') return cookBlocker(state);
  if (dish === 'stew' && !state.structures.well) return 'Build the well to cook stew.';
  // A fish cooks on a stick at the fire, like a berry: no pot needed.
  if (DISHES[dish].potOnly && !state.progress.potCrafted) return 'Make a cooking pot first.';
  if (state.timeOfDay < nightStart(state.day)) return 'Cook after nightfall.';
  const fire = cookingFireBlocker(state);
  if (fire) return fire;
  const paid = spendIngredients(state, dish);
  if (!paid) return `You need ${ingredientList(dish)} for ${DISHES[dish].name}.`;
  if (dish === 'roastedHazelnuts' && freeSpaces(paid) < 1) return 'Make room in your bag for the roasted hazelnuts.';
  return null;
}

/** The dish C cooks: the first in DISH_ORDER with no blocker, or null. */
export function defaultDish(state: GameState): DishId | null {
  return DISH_ORDER.find(dish => !dishBlocker(state, dish)) ?? null;
}

const up = (value: number, gain: number): number => Math.min(100, value + gain);

/** The paid state with what a dish leaves in the bag, put there before the cooking time runs so a dawn's gift can't take its space. */
export function packDish(paid: GameState, dish: DishId): GameState {
  if (dish !== 'roastedHazelnuts') return paid;
  return { ...paid, inventory: { ...paid.inventory, food: addFood(paid.inventory.food, 'roastedHazelnuts', 1, paid.day) } };
}

/** What a dish does once cooked: `cooked` has paid for it, been packed and spent the time; the rack is read from before. */
export function serveDish(cooked: GameState, dish: DishId, dryingRack: boolean): { state: GameState; message: string } {
  const { player } = cooked;
  switch (dish) {
    case 'fish': return {
      state: { ...cooked, player: { ...player, hunger: up(player.hunger, BALANCE.cookedFishHunger), warmth: up(player.warmth, BALANCE.cookWarmthGain) } },
      message: 'You cook the fish over the fire. A warm, filling meal.'
    };
    case 'berries': return {
      state: { ...cooked, player: { ...player,
        hunger: up(player.hunger, dryingRack ? BALANCE.rackCookHungerGain : BALANCE.cookHungerGain),
        warmth: up(player.warmth, BALANCE.cookWarmthGain) } },
      message: 'You toast a berry by the fire. A warm little meal.'
    };
    case 'pineTea': return {
      state: { ...cooked, player: { ...player, warmth: up(player.warmth, BALANCE.teaWarmthGain), energy: up(player.energy, BALANCE.teaEnergyGain) } },
      message: 'You brew pine needle tea in the pot. It warms you through.'
    };
    case 'salad': return {
      state: { ...cooked, player: { ...player, hunger: up(player.hunger, BALANCE.saladHungerGain), energy: up(player.energy, BALANCE.saladEnergyGain) } },
      message: 'You toss greens and berries together. A fresh little supper.'
    };
    case 'roastedHazelnuts': return {
      state: cooked,
      message: 'You roast the hazelnuts in the pot and keep them for later.'
    };
    case 'honeyCake': return {
      state: { ...cooked, player: { ...player, hunger: up(player.hunger, BALANCE.honeyCakeHungerGain) }, cakeBonus: true },
      message: 'You bake a little honey cake. You will rest well tonight.'
    };
    case 'stew': return {
      state: { ...cooked, player: { ...player, hunger: up(player.hunger, BALANCE.stewHungerGain), warmth: up(player.warmth, BALANCE.stewWarmthGain) } },
      message: 'You simmer a vegetable stew. It fills you up and warms you through.'
    };
  }
}

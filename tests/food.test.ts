import { describe, expect, it } from 'vitest';
import { BALANCE, createGame, type GameState } from '../src/game/state';
import { advanceTime, applyAction, carriedCount } from '../src/game/rules';
import { findDue } from '../src/game/companion';
import { FOOD_ITEMS, addFood, availableFood, emptyFood, foodCount, isFresh, spendFood, storeTotal, takeFromBag } from '../src/game/food';
import { nightStart } from '../src/game/calendar';

const base = createGame();
const withFood = (state: GameState, food: GameState['inventory']['food']): GameState => ({ ...state, inventory: { ...state.inventory, food } });

describe('the food store', () => {
  it('lists every item, fresh ones first', () => {
    expect(FOOD_ITEMS).toEqual(['berry', 'greens', 'hazelnut', 'honey', 'pineNeedles', 'roastedHazelnuts', 'trailFood']);
    expect(FOOD_ITEMS.filter(isFresh)).toEqual(['berry', 'greens']);
  });

  it('records the day each fresh item was picked, and counts kept items', () => {
    expect(addFood(emptyFood(), 'berry', 2, 5).berry).toEqual([5, 5]);
    expect(addFood(emptyFood(), 'hazelnut', 2, 5).hazelnut).toBe(2);
    expect(foodCount(addFood(emptyFood(), 'berry', 3, 1), 'berry')).toBe(3);
  });

  it('counts every item in the store', () => {
    const store = addFood(addFood(addFood(emptyFood(), 'berry', 2, 1), 'greens', 1, 1), 'trailFood', 3, 1);
    expect(storeTotal(store)).toBe(6);
  });

  it('spends the oldest fresh food first, and refuses to spend what is not there', () => {
    const state = withFood(base, { ...emptyFood(), berry: [4, 2, 3] });
    expect(availableFood(state, 'berry')).toBe(3);
    expect(spendFood(state, 'berry', 2)!.inventory.food.berry).toEqual([4]);
    expect(spendFood(state, 'berry', 4)).toBeNull();
    expect(spendFood(state, 'trailFood', 1)).toBeNull();
    expect(spendFood(withFood(base, { ...emptyFood(), trailFood: 2 }), 'trailFood', 1)!.inventory.food.trailFood).toBe(1);
  });

  it('takes from the bag oldest-first for the wolf', () => {
    const state = withFood(base, { ...emptyFood(), berry: [7, 3] });
    expect(takeFromBag(state, 'berry', 1)!.inventory.food.berry).toEqual([7]);
    expect(takeFromBag(state, 'trailFood', 1)).toBeNull();
  });
});

describe('food comes in on the day it was found', () => {
  const bush = base.nodes.find(node => node.id === 'berry-0')!;
  const atBush = (day: number, wood: number): GameState => ({
    ...base, day, player: { ...base.player, x: bush.x, y: bush.y }, inventory: { ...base.inventory, wood }
  });

  it('adds one summer berry to a bag with one space left', () => {
    const result = applyAction(atBush(34, 7), { type: 'gather', nodeId: 'berry-0' }).state;
    expect(result.inventory.food.berry).toEqual([34]);
    expect(carriedCount(result)).toBe(BALANCE.baseCapacity);
  });

  it('needs two free spaces for the basket, and dates both berries', () => {
    const state: GameState = { ...base, day: 4, player: { ...base.player, x: 8, y: 8 }, inventory: { ...base.inventory, wood: 7 } };
    expect(applyAction(state, { type: 'visitSite', siteId: 'basket' }).state).toBe(state);
    const roomy = { ...state, inventory: { ...state.inventory, wood: 6 } };
    expect(applyAction(roomy, { type: 'visitSite', siteId: 'basket' }).state.inventory.food.berry).toEqual([4, 4]);
  });

  it("dates the fox's dawn gift and the garden harvest", () => {
    const day = Array.from({ length: 60 }, (_, i) => 42 + i).find(d => findDue(d, d - 3, 50))!;
    const fox: GameState = {
      ...base, day: day - 1, timeOfDay: BALANCE.daySeconds - 0.5, fireFuel: 100,
      player: { ...base.player, x: 19, y: 14 },
      structures: { ...base.structures, shelter: true, toolshed: true },
      progress: { ...base.progress, hearthUnlocked: true, nextStormDay: null },
      companion: { ...base.companion, friend: 'fox', since: 1, trust: { ...base.companion.trust, fox: 4 }, lastGift: day - 3, lastFind: day }
    };
    expect(advanceTime(fox, 1).inventory.food.berry).toEqual([day]);

    const garden: GameState = {
      ...base, day: 41, structures: { ...base.structures, garden: true },
      gardenPlots: [{ plantedYear: 1, harvestedYear: null, harvestReady: true }, ...base.gardenPlots.slice(1)]
    };
    expect(applyAction(garden, { type: 'harvestGarden', plotIndex: 0 }).state.inventory.food.berry).toEqual([41, 41]);
  });

  it('loses a ration to the wolf first, then the oldest berry', () => {
    const dark: GameState = {
      ...base, day: 12, timeOfDay: nightStart(12) + 5, fireFuel: 0,
      structures: { ...base.structures, shelter: true },
      progress: { ...base.progress, hearthUnlocked: true, nextStormDay: null }
    };
    const rationed = advanceTime(withFood(dark, { ...emptyFood(), berry: [9, 5], trailFood: 1 }), 1);
    expect([rationed.inventory.food.trailFood, rationed.inventory.food.berry, rationed.lastWolf?.took]).toEqual([0, [9, 5], 'ration']);
    const berries = advanceTime(withFood(dark, { ...emptyFood(), berry: [9, 5] }), 1);
    expect([berries.inventory.food.berry, berries.lastWolf?.took]).toEqual([[9], 'berry']);
  });
});

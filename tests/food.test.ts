import { describe, expect, it } from 'vitest';
import { BALANCE, createGame, type GameState } from '../src/game/state';
import { advanceTime, applyAction, carriedCount } from '../src/game/rules';
import { findDue } from '../src/game/companion';
import { FOOD_ITEMS, addFood, availableFood, emptyFood, foodCount, goingSoft, isFresh, spendFood, spoil, spoilMessage, storeTotal, takeFromBag } from '../src/game/food';
import { newsBetween } from '../src/game/news';
import { nightStart } from '../src/game/calendar';

const base = createGame();
const withFood = (state: GameState, food: GameState['inventory']['food']): GameState => ({ ...state, inventory: { ...state.inventory, food } });

describe('the food store', () => {
  it('lists every item, fresh ones first', () => {
    expect(FOOD_ITEMS).toEqual(['berry', 'greens', 'hazelnut', 'honey', 'pineNeedles', 'roastedHazelnuts', 'trailFood', 'vegetables']);
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

describe('berries going soft', () => {
  const berries = (...days: number[]) => days.reduce((store, day) => addFood(store, 'berry', 1, day), emptyFood());
  const aged = (state: GameState, picked: number[], extra: Partial<GameState> = {}): GameState =>
    ({ ...withFood(state, { ...emptyFood(), berry: picked }), ...extra });
  const nearDawn = (state: GameState): GameState => ({ ...state, timeOfDay: BALANCE.daySeconds - 1 });
  const message = (before: GameState, after: GameState) => spoilMessage(before, after);
  const lastSpoiled = (berry: number, greens = 0): GameState => ({ ...base, day: 4, lastSpoiled: { day: 4, berry, greens } });

  it('throws out berries picked three or more days ago', () => {
    const result = spoil(berries(1, 2, 3), 4, 3);
    expect(result.store.berry).toEqual([2, 3]);
    expect(result.lost).toEqual({ berry: 1, greens: 0 });
  });

  it('counts the berries that will be gone at the next dawn', () => {
    expect(goingSoft(berries(1, 2, 3), 'berry', 3, 3)).toBe(1);
    expect(goingSoft(berries(1, 2, 3), 'berry', 2, 3)).toBe(0);
  });

  it('words the morning line', () => {
    const before = { ...base, day: 3 };
    expect(message(before, lastSpoiled(1))).toBe('A berry had gone soft, so you threw it out.');
    expect(message(before, lastSpoiled(2))).toBe('Two berries had gone soft, so you threw them out.');
    expect(message(before, lastSpoiled(2, 1))).toBe('Two berries and a handful of greens had gone soft, so you threw them out.');
    expect(message(before, lastSpoiled(0, 3))).toBe('Three handfuls of greens had gone soft, so you threw them out.');
    expect(message(before, lastSpoiled(12))).toBe('12 berries had gone soft, so you threw them out.');
    expect(message(lastSpoiled(2), lastSpoiled(2))).toBeNull();
    expect(message(before, base)).toBeNull();
  });

  it('removes old berries across a dawn, records it, and reports it once', () => {
    const before = nearDawn(aged({ ...base, day: 3 }, [1, 1, 3]));
    const after = advanceTime(before, 2, 'working');
    expect(after.day).toBe(4);
    expect(after.inventory.food.berry).toEqual([3]);
    expect(after.lastSpoiled).toEqual({ day: 4, berry: 2, greens: 0 });
    expect(newsBetween(before, after)).toEqual(['Two berries had gone soft, so you threw them out.']);
    expect(newsBetween(after, advanceTime(after, 2, 'working'))).toEqual([]);
  });

  it('leaves lastSpoiled alone when nothing went soft', () => {
    const before = nearDawn(aged({ ...base, day: 3 }, [3]));
    expect(advanceTime(before, 2, 'working').lastSpoiled).toBeNull();
  });

  it('spoils in winter too', () => {
    const before = nearDawn(aged({ ...base, day: 49 }, [46]));
    expect(advanceTime(before, 2, 'working').inventory.food.berry).toEqual([]);
  });

  it('spoils bag berries at dawn in the quarry', () => {
    const before = nearDawn(aged({ ...base, day: 3, area: 'quarry' }, [1]));
    expect(advanceTime(before, 2, 'working').inventory.food.berry).toEqual([]);
  });

  it('reports the spoilage after sleeping through the dawn', () => {
    const night = aged({ ...base, day: 3, structures: { ...base.structures, shelter: true }, player: { ...base.player, x: BALANCE.campX, y: BALANCE.campY } }, [1], { timeOfDay: nightStart(3) });
    const slept = applyAction(night, { type: 'sleep' }).state;
    expect(slept.day).toBe(4);
    expect(newsBetween(night, slept)).toContain('A berry had gone soft, so you threw it out.');
  });

  it('never costs a friend any trust', () => {
    const friend = { ...base.companion, friend: 'bird' as const, since: 1, trust: { bird: 5, fox: 0, wolf: 0 }, lastOffer: { bird: 2, fox: 0, wolf: 0 } };
    const before = nearDawn(aged({ ...base, day: 3, companion: friend }, [1]));
    const after = advanceTime(before, 2, 'working');
    expect(after.lastSpoiled).not.toBeNull();
    expect(after.companion.trust).toEqual(friend.trust);
    expect(after.companion.lastOffer).toEqual(friend.lastOffer);
  });
});

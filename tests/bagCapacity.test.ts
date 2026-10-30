import { describe, expect, it } from 'vitest';
import { BALANCE, createGame, type GameState } from '../src/game/state';
import { findDue } from '../src/game/companion';
import { addFood, emptyFood, type FoodItem, type FoodStore } from '../src/game/food';
import { applyAction, bagCapacity, carriedCount, type GameAction } from '../src/game/rules';
import { DISH_ORDER } from '../src/game/cooking';

// Whatever adds to the bag must leave room for it even when its time runs across a dawn on which the fox brings a berry:
// the bag is never over capacity, because a save with it over is refused.

const { campX, campY, daySeconds } = BALANCE;
/** A dawn on which the fox's gift is due, three days after its last. */
const GIFT_DAWN = Array.from({ length: 60 }, (_, i) => 42 + i).find(day => findDue(day, day - 3, 50))!;
const food = (entries: Partial<Record<FoodItem, number>>, day: number): FoodStore =>
  (Object.entries(entries) as [FoodItem, number][]).reduce((store, [item, n]) => addFood(store, item, n, day), emptyFood());

/** At the lit fire with the fox as friend, a few seconds before the gift dawn, every store built, the bag one short of full. */
function lateNight(larder: Partial<Record<FoodItem, number>>, bag: Partial<Record<FoodItem, number>> = {}, free = 1): GameState {
  const base = createGame();
  const day = GIFT_DAWN - 1;
  const bagFood = food(bag, day);
  const fill = (n: number) => BALANCE.baseCapacity - free - n;
  const state: GameState = {
    ...base,
    day,
    timeOfDay: daySeconds - 3,
    fireFuel: 100,
    clearing: { cleared: ['north-near', 'east-near'], marked: null, felled: [] },
    structures: { ...base.structures, shelter: true, toolshed: true, dryingRack: true, garden: true, larder: true, woodpile: true },
    progress: { ...base.progress, potCrafted: true, hearthUnlocked: true, nextStormDay: null },
    companion: { ...base.companion, friend: 'fox', since: 1, trust: { ...base.companion.trust, fox: 3 }, lastGift: GIFT_DAWN - 3, lastFind: GIFT_DAWN },
    player: { ...base.player, x: campX, y: campY, energy: 80, hunger: 50, warmth: 60 },
    larder: food(larder, day),
    storedWood: 3,
    gardenPlots: base.gardenPlots.map((plot, i) => i === 0 ? { ...plot, plantedYear: 1, harvestReady: true } : plot),
    inventory: { ...base.inventory, food: bagFood, wood: 0, stone: 0, fiber: 0 }
  };
  const carried = carriedCount(state);
  return { ...state, inventory: { ...state.inventory, fiber: fill(carried) } };
}

/** Runs an action that should succeed, and checks the bag after it. */
function expectWithinBag(state: GameState, action: GameAction, crossesDawn = true): GameState {
  expect(carriedCount(state)).toBeLessThan(bagCapacity(state));
  const { state: after, message } = applyAction(state, action);
  expect(after, message).not.toBe(state);
  if (crossesDawn) expect(after.day, message).toBe(GIFT_DAWN);
  expect(carriedCount(after), `${action.type}: ${message}`).toBeLessThanOrEqual(bagCapacity(after));
  return after;
}

describe('the bag across a dawn with the fox\'s gift due', () => {
  it('roasts hazelnuts from the larder into the last free space before the fox can fill it', () => {
    const state = lateNight({ hazelnut: 2 });
    expect(carriedCount(state)).toBe(7);
    const after = expectWithinBag(state, { type: 'cook', dish: 'roastedHazelnuts' });
    expect(after.inventory.food.roastedHazelnuts).toBe(1);
    // The fox found no room, so its gift waits for another dawn.
    expect(after.companion.lastGift).toBe(GIFT_DAWN - 3);
    expect(carriedCount(after)).toBe(8);
  });

  it.each(DISH_ORDER)('cooks %s from the larder without overfilling the bag', dish => {
    const state = lateNight({ berry: 1, greens: 1, pineNeedles: 1, hazelnut: 2, honey: 1 });
    expectWithinBag(state, { type: 'cook', dish });
  });

  it('dries a ration from a larder berry without overfilling the bag', () => {
    const after = expectWithinBag(lateNight({ berry: 1 }), { type: 'prepareTrailFood' });
    expect(after.inventory.food.trailFood).toBe(1);
  });

  it('gathers into the last free space without overfilling the bag', () => {
    const state = lateNight({});
    const branch = state.nodes.find(node => node.kind === 'branch')!;
    expectWithinBag({ ...state, player: { ...state.player, x: branch.x, y: branch.y } }, { type: 'gather', nodeId: branch.id });
  });

  it('harvests the garden without overfilling the bag', () => {
    expectWithinBag(lateNight({}, {}, 2), { type: 'harvestGarden', plotIndex: 0 });
  });

  it('takes food and wood from their stores without overfilling the bag', () => {
    expectWithinBag(lateNight({ hazelnut: 1 }), { type: 'takeFood', item: 'hazelnut' }, false);
    expectWithinBag(lateNight({}), { type: 'takeWood' }, false);
  });
});

import { describe, expect, it } from 'vitest';
import { nightStart } from '../src/game/calendar';
import { BALANCE, BUILDINGS, createGame, type GameState } from '../src/game/state';
import { CLEARING_STEPS, STEP_IDS, inClearing, placeBranches } from '../src/game/clearing';
import { addFood, availableFood, emptyFood, quickEatItem, reachableLarder, spendFood, spoilMessage, type FoodStore } from '../src/game/food';
import { FULL_BAG_MESSAGE, advanceTime, applyAction, buildStatus, carriedCount, groundBlocker, trailFoodBlocker } from '../src/game/rules';
import { offerFor } from '../src/game/companion';
import { buildButtonView } from '../src/ui/panels';
import { CAMP_STRUCTURES } from '../src/scene/visuals';
import { PATH_DESTINATIONS, segmentDistance } from './placement';

const { campX, campY } = BALANCE;
const LARDER_SPOT = { x: campX + 2.5, y: campY - 4.5 };
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const food = (entries: [keyof FoodStore, number, number][]): FoodStore =>
  entries.reduce((store, [item, n, day]) => addFood(store, item, n, day), emptyFood());

/** A camp with the north side's near ground cleared, standing at the fire, with the larder built or not. */
function camp(built = true, changes: Partial<GameState> = {}): GameState {
  const base = createGame();
  const cleared: GameState['clearing']['cleared'] = ['north-near'];
  const placed = placeBranches(base.nodes, cleared);
  return {
    ...base,
    day: 6,
    nodes: base.nodes.map((node, i) => ({ ...node, x: placed[i].x, y: placed[i].y })),
    clearing: { cleared, marked: null, felled: [] },
    structures: { ...base.structures, larder: built },
    player: { ...base.player, x: campX, y: campY, hunger: 40 },
    ...changes
  };
}
const withStores = (state: GameState, bag: FoodStore, larder: FoodStore): GameState =>
  ({ ...state, inventory: { ...state.inventory, food: bag }, larder });
const away = (state: GameState): GameState => ({ ...state, player: { ...state.player, x: 5, y: 5 } });
const inQuarry = (state: GameState): GameState => ({ ...state, area: 'quarry', player: { ...state.player, x: 30, y: 15 } });

describe('building the larder', () => {
  const supplies = { wood: 5, fiber: 2, stone: 2, food: emptyFood() };

  it('is defined as asked', () => {
    expect(BUILDINGS.larder).toEqual({ name: 'Larder', description: 'Keep up to 10 food raised off the ground', symbol: '▥',
      cost: { wood: 5, fiber: 2, stone: 2 }, prerequisite: null, ground: 'north-near' });
    expect(BALANCE.larderCapacity).toBe(10);
    expect(createGame().larder).toEqual(emptyFood());
    expect(createGame().structures.larder).toBe(false);
  });

  it('waits for the north side\'s near ground to be cleared', () => {
    const base = createGame();
    const state = { ...base, inventory: supplies, player: { ...base.player, x: campX, y: campY } };
    expect(buildStatus(state, 'larder')).toBe('needsGround');
    expect(groundBlocker(state, 'larder')).toBe("Clear the north side's near ground first.");
    expect(groundBlocker(state, 'shelter')).toBeNull();
    expect(applyAction(state, { type: 'build', structureId: 'larder' })).toEqual({ state, message: "Clear the north side's near ground first." });
    expect(buildButtonView(state, 'larder')).toMatchObject({ verb: 'Blocked', description: "Clear the north side's near ground first", disabled: true });
  });

  it('builds for 5 wood, 2 fiber and 2 stone once the ground is clear', () => {
    const state = { ...camp(false), inventory: supplies };
    expect(groundBlocker(state, 'larder')).toBeNull();
    expect(buildStatus(state, 'larder')).toBe('ready');
    const built = applyAction(state, { type: 'build', structureId: 'larder' });
    expect(built.message).toBe('Built the larder.');
    expect(built.state.structures.larder).toBe(true);
    expect(built.state.inventory).toMatchObject({ wood: 0, fiber: 0, stone: 0 });
    expect(applyAction(built.state, { type: 'build', structureId: 'larder' }).message).toBe('Already built.');
  });
});

describe('where the larder stands', () => {
  it('stands on the north side\'s near ground, outside the starting ring', () => {
    expect(CAMP_STRUCTURES).toContainEqual(['larder', 2.5, -4.5]);
    expect(inClearing(LARDER_SPOT.x, LARDER_SPOT.y, ['north-near'])).toBe(true);
    expect(inClearing(LARDER_SPOT.x, LARDER_SPOT.y, [])).toBe(false);
  });

  it('keeps clear of nodes, forage, trees and paths', () => {
    const nodes = placeBranches(createGame().nodes, ['north-near']);
    for (const node of nodes) expect(distance(LARDER_SPOT, node), node.id).toBeGreaterThanOrEqual(1.5);
    for (const tree of createGame().trees) expect(distance(LARDER_SPOT, tree), tree.id).toBeGreaterThanOrEqual(1.5);
    // The trees of every step still standing once north-near is cleared.
    for (const id of STEP_IDS.filter(step => step !== 'north-near')) {
      for (const tree of CLEARING_STEPS[id].trees) expect(distance(LARDER_SPOT, tree), id).toBeGreaterThanOrEqual(1.5);
    }
    for (const [dx, dy] of PATH_DESTINATIONS) expect(segmentDistance(LARDER_SPOT.x + 0.5, LARDER_SPOT.y + 0.5, dx, dy)).toBeGreaterThanOrEqual(1.35);
  });

  it('keeps 2 tiles from the other camp buildings and the shelter', () => {
    const others = [{ x: campX - 3, y: campY - 2 }, ...CAMP_STRUCTURES.filter(([id]) => id !== 'larder').map(([, dx, dy]) => ({ x: campX + dx, y: campY + dy }))];
    for (const other of others) expect(distance(LARDER_SPOT, other)).toBeGreaterThanOrEqual(2);
  });
});

describe('storing and taking food', () => {
  it('stores the bag\'s oldest piece and takes the larder\'s freshest', () => {
    const state = withStores(camp(), food([['berry', 1, 5], ['berry', 1, 3]]), food([['berry', 1, 2], ['berry', 1, 4]]));
    const stored = applyAction(state, { type: 'storeFood', item: 'berry' });
    expect(stored.state.inventory.food.berry).toEqual([5]);
    expect([...stored.state.larder.berry].sort()).toEqual([2, 3, 4]);
    const taken = applyAction(stored.state, { type: 'takeFood', item: 'berry' });
    expect([...taken.state.larder.berry].sort()).toEqual([2, 3]);
    expect([...taken.state.inventory.food.berry].sort()).toEqual([4, 5]);
  });

  it('moves kept food one at a time', () => {
    const state = withStores(camp(), food([['hazelnut', 3, 1]]), emptyFood());
    const stored = applyAction(state, { type: 'storeFood', item: 'hazelnut' }).state;
    expect(stored.inventory.food.hazelnut).toBe(2);
    expect(stored.larder.hazelnut).toBe(1);
    expect(applyAction(stored, { type: 'takeFood', item: 'hazelnut' }).state.inventory.food.hazelnut).toBe(3);
  });

  it('refuses a full larder, a full bag, and nothing to move', () => {
    const full = withStores(camp(), food([['berry', 1, 5]]), food([['hazelnut', 10, 1]]));
    expect(applyAction(full, { type: 'storeFood', item: 'berry' })).toEqual({ state: full, message: 'The larder is full.' });
    const packed = withStores(camp(), food([['berry', 8, 5]]), food([['honey', 1, 1]]));
    expect(applyAction(packed, { type: 'takeFood', item: 'honey' })).toEqual({ state: packed, message: FULL_BAG_MESSAGE });
    expect(applyAction(camp(), { type: 'storeFood', item: 'berry' }).state).toEqual(camp());
    expect(applyAction(camp(), { type: 'takeFood', item: 'berry' }).state).toEqual(camp());
  });

  it('works only in the clearing, and only once built', () => {
    const state = withStores(camp(), food([['berry', 1, 5]]), food([['berry', 1, 5]]));
    for (const type of ['storeFood', 'takeFood'] as const) {
      expect(applyAction(away(state), { type, item: 'berry' }).message).toBe('Return to camp to use the larder.');
      expect(applyAction(inQuarry(state), { type, item: 'berry' }).message).toBe('Return to camp to use the larder.');
      expect(applyAction({ ...state, structures: { ...state.structures, larder: false } }, { type, item: 'berry' }).message).toBe('Build a larder first.');
    }
  });
});

describe('eating from the bag and the larder', () => {
  it('reaches the larder only while built and standing in the clearing', () => {
    const state = withStores(camp(), emptyFood(), food([['berry', 2, 5]]));
    expect(reachableLarder(state)).toBe(state.larder);
    expect(reachableLarder(away(state))).toBeNull();
    expect(reachableLarder(inQuarry(state))).toBeNull();
    expect(reachableLarder({ ...state, structures: { ...state.structures, larder: false } })).toBeNull();
    expect(availableFood(state, 'berry')).toBe(2);
    expect(availableFood(away(state), 'berry')).toBe(0);
  });

  it('eats the oldest fresh piece across both, the bag first on a tie', () => {
    const older = withStores(camp(), food([['berry', 1, 6]]), food([['berry', 1, 4]]));
    const ate = applyAction(older, { type: 'eat', item: 'berry' }).state;
    expect(ate.larder.berry).toEqual([]);
    expect(ate.inventory.food.berry).toEqual([6]);
    const tie = withStores(camp(), food([['berry', 1, 4]]), food([['berry', 1, 4]]));
    const spent = spendFood(tie, 'berry', 1)!;
    expect(spent.inventory.food.berry).toEqual([]);
    expect(spent.larder.berry).toEqual([4]);
    const both = spendFood(withStores(camp(), food([['berry', 2, 5]]), food([['berry', 1, 3], ['berry', 1, 6]])), 'berry', 3)!;
    expect(both.inventory.food.berry).toEqual([]);
    expect(both.larder.berry).toEqual([6]);
  });

  it('spends the oldest pieces when both stores contain unsorted picks', () => {
    const state = withStores(camp(), { ...emptyFood(), berry: [8, 2, 6] }, { ...emptyFood(), berry: [7, 1, 5] });
    const spent = spendFood(state, 'berry', 3)!;
    expect(spent.inventory.food.berry).toEqual([6, 8]);
    expect(spent.larder.berry).toEqual([7]);
  });

  it('refuses to spend more fresh food than the two stores contain', () => {
    const state = withStores(camp(), { ...emptyFood(), berry: [3] }, emptyFood());
    expect(spendFood(state, 'berry', 2)).toBeNull();
  });

  it('takes kept food from the bag first', () => {
    const state = withStores(camp(), food([['hazelnut', 1, 1]]), food([['hazelnut', 2, 1]]));
    const one = spendFood(state, 'hazelnut', 1)!;
    expect([one.inventory.food.hazelnut, one.larder.hazelnut]).toEqual([0, 2]);
    const two = spendFood(state, 'hazelnut', 2)!;
    expect([two.inventory.food.hazelnut, two.larder.hazelnut]).toEqual([0, 1]);
    expect(spendFood(state, 'hazelnut', 4)).toBeNull();
  });

  it('lets Q rank fresh food across the bag and the larder', () => {
    const state = withStores(camp(), food([['berry', 1, 6]]), food([['greens', 1, 4]]));
    expect(quickEatItem(state)).toBe('greens');
    expect(quickEatItem(away(state))).toBe('berry');
    expect(quickEatItem(withStores(camp(), emptyFood(), food([['berry', 1, 4]])))).toBe('berry');
    expect(quickEatItem(withStores(camp(), food([['hazelnut', 1, 1]]), emptyFood()))).toBe('hazelnut');
    expect(quickEatItem(away(withStores(camp(), emptyFood(), food([['berry', 1, 4]]))))).toBeNull();
  });

  it('lets Q choose the oldest piece when one food has several ages', () => {
    const state = withStores(camp(), { ...emptyFood(), berry: [9, 2] }, { ...emptyFood(), greens: [5] });
    expect(quickEatItem(state)).toBe('berry');
  });

  it('ignores the larder away from camp, whatever it holds', () => {
    const stocked = food([['berry', 4, 5], ['trailFood', 2, 1], ['hazelnut', 2, 1], ['greens', 2, 5]]);
    const night = nightStart(6) + 5;
    const base = withStores(camp(true, {
      timeOfDay: night, fireFuel: 60,
      structures: { ...createGame().structures, larder: true, shelter: true, toolshed: true, dryingRack: true, garden: true }
    }), emptyFood(), stocked);
    const potted = { ...base, progress: { ...base.progress, potCrafted: true } };
    for (const place of [away, inQuarry]) {
      const out = place(potted);
      expect(availableFood(out, 'berry')).toBe(0);
      expect(applyAction(out, { type: 'eat' }).message).toBe('No food in your bag.');
      expect(applyAction(out, { type: 'eat', item: 'berry' }).state).toEqual(out);
      expect(applyAction(out, { type: 'eatTrailFood' }).state).toEqual(out);
      expect(applyAction(out, { type: 'prepareTrailFood' }).state).toEqual(out);
      expect(applyAction(out, { type: 'cook', dish: 'salad' }).state).toEqual(out);
      expect(applyAction({ ...out, day: 21 }, { type: 'plantGarden', plotIndex: 0 })).toEqual({ state: { ...out, day: 21 }, message: 'Return to camp to tend the garden.' });
      expect(offerFor({ ...out, day: 12, timeOfDay: nightStart(12) + 5 })).toBeNull();
    }
  });

  it('cooks, dries and plants from the larder at camp', () => {
    const night = nightStart(6) + 5;
    const state = withStores(camp(true, {
      timeOfDay: night, fireFuel: 60,
      structures: { ...createGame().structures, larder: true, shelter: true, toolshed: true, dryingRack: true, garden: true },
      progress: { ...createGame().progress, potCrafted: true }
    }), emptyFood(), food([['berry', 3, 5], ['greens', 1, 5]]));
    expect(applyAction(state, { type: 'cook', dish: 'salad' }).state.larder).toMatchObject({ berry: [5, 5], greens: [] });
    expect(applyAction(state, { type: 'prepareTrailFood' }).state).toMatchObject({ larder: { berry: [5, 5] }, inventory: { food: { trailFood: 1 } } });
  });

  it('plants a larder berry in spring with an empty bag, and ignores an unbuilt larder', () => {
    const spring = withStores(camp(true, { day: 21, structures: { ...createGame().structures, larder: true, garden: true } }), emptyFood(), food([['berry', 2, 20]]));
    const planted = applyAction(spring, { type: 'plantGarden', plotIndex: 0 });
    expect(planted.message).toBe('Planted a berry bush.');
    expect(planted.state.larder.berry).toEqual([20]);
    expect(planted.state.gardenPlots[0].plantedYear).toBe(1);
    const unbuilt = { ...spring, structures: { ...spring.structures, larder: false } };
    expect(applyAction(unbuilt, { type: 'plantGarden', plotIndex: 0 })).toEqual({ state: unbuilt, message: 'You need a berry to plant.' });
  });

  it('dries a ration only with room for it in the bag', () => {
    const rack = (bag: FoodStore, larder: FoodStore, wood: number) => {
      const state = withStores(camp(true, { structures: { ...createGame().structures, larder: true, dryingRack: true } }), bag, larder);
      return { ...state, inventory: { ...state.inventory, wood } };
    };
    // A full bag and only larder berries: the berry leaves the larder, so the ration has nowhere to go.
    const full = rack(emptyFood(), food([['berry', 2, 5]]), 8);
    expect(trailFoodBlocker(full)).toBe('Make room in your bag for the ration.');
    expect(applyAction(full, { type: 'prepareTrailFood' })).toEqual({ state: full, message: 'Make room in your bag for the ration.' });
    // With a bag berry too, oldest-first takes the larder's older one, so a full bag still has no room.
    const olderInLarder = rack(food([['berry', 1, 5]]), food([['berry', 1, 4]]), 7);
    expect(trailFoodBlocker(olderInLarder)).toBe('Make room in your bag for the ration.');
    // A full bag drying its own berry swaps the berry for the ration.
    const swap = rack(food([['berry', 1, 4]]), food([['berry', 1, 5]]), 7);
    expect(trailFoodBlocker(swap)).toBeNull();
    const dried = applyAction(swap, { type: 'prepareTrailFood' }).state;
    expect(dried.inventory.food).toMatchObject({ berry: [], trailFood: 1 });
    expect(carriedCount(dried)).toBe(8);
  });
});

describe('the larder at dawn', () => {
  const lateNight = (state: GameState): GameState => ({ ...state, timeOfDay: BALANCE.daySeconds - 1 });

  it('keeps fresh food five days', () => {
    // At the dawn of day 7, a berry picked on day 3 is 4 days old and one picked on day 2 is 5.
    const state = lateNight(withStores(camp(), emptyFood(), food([['berry', 1, 3], ['berry', 1, 2]])));
    const next = advanceTime(state, 2);
    expect(next.day).toBe(7);
    expect(next.larder.berry).toEqual([3]);
    expect(next.lastSpoiled).toEqual({ day: 7, berry: 1, greens: 0 });
  });

  it('spoils even while the survivor is in the quarry', () => {
    const state = lateNight(inQuarry(withStores(camp(), emptyFood(), food([['greens', 2, 2]]))));
    expect(advanceTime(state, 2).larder.greens).toEqual([]);
  });

  it('tells of bag and larder losses in one line', () => {
    const state = lateNight(withStores(camp(), food([['berry', 1, 4]]), food([['berry', 1, 2], ['greens', 1, 2]])));
    const next = advanceTime(state, 2);
    expect(next.lastSpoiled).toEqual({ day: 7, berry: 2, greens: 1 });
    expect(spoilMessage(state, next)).toBe('Two berries and a handful of greens had gone soft, so you threw them out.');
  });
});

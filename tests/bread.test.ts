import { describe, expect, it } from 'vitest';
import { BALANCE, type GameState } from '../src/game/state';
import { nightStart } from '../src/game/calendar';
import { addFood, emptyFood, quickEatItem, spoil, spoilMessage, type FoodStore } from '../src/game/food';
import { grindGrainBlocker } from '../src/game/field';
import { dishBlocker } from '../src/game/cooking';
import { TOO_TIRED_MESSAGE, workSeconds } from '../src/game/needs';
import { applyAction } from '../src/game/rules';
import { bagFoodMarkup, bagView, foodLaidByDays, nightDishMarkup, nightDishesView } from '../src/ui/panels';
import { fieldCamp, withField } from './fieldCamp';

/** At the fire with the granary, the quern and some grain in it, the bag holding what's asked. */
function granary(grain = 6, food: FoodStore = emptyFood()): GameState {
  const base = fieldCamp({ granary: true, workshop: true, toolshed: true, shelter: true });
  return withField({
    ...base,
    progress: { ...base.progress, workshop: { ...base.progress.workshop, quern: true } },
    inventory: { ...base.inventory, food }
  }, { grain });
}

/** An evening at a lit campfire, without the pot, with the bag holding what's given. */
const evening = (food: FoodStore): GameState => ({ ...granary(0, food), timeOfDay: nightStart(22) + 10, fireFuel: 60 });

const fullBag = (state: GameState): GameState => ({ ...state, inventory: { ...state.inventory, wood: 8 - state.inventory.food.flour } });

describe('grinding grain at the granary', () => {
  it('needs the granary, the quern, the clearing, enough grain, room in the bag, and some energy', () => {
    const state = granary();
    expect(grindGrainBlocker(state)).toBeNull();
    expect(grindGrainBlocker({ ...state, structures: { ...state.structures, granary: false } })).toBe('Build the granary first.');
    expect(grindGrainBlocker({ ...state, progress: { ...state.progress, workshop: { ...state.progress.workshop, quern: false } } }))
      .toBe('Make a hand quern at the workshop first.');
    expect(grindGrainBlocker({ ...state, player: { ...state.player, x: 2, y: 2 } })).toBe('Return to camp to grind grain.');
    expect(grindGrainBlocker(granary(1))).toBe('There isn\'t enough grain in the granary to grind.');
    expect(grindGrainBlocker(fullBag(state))).toBe('Make room in your bag for the flour.');
    expect(grindGrainBlocker({ ...state, player: { ...state.player, energy: 0 } })).toBe(TOO_TIRED_MESSAGE);
  });

  it('turns two grain into a flour in the bag, in the time and energy of a gather', () => {
    const state = granary();
    const { state: after, message } = applyAction(state, { type: 'grindGrain' });
    expect(after.field.grain).toBe(4);
    expect(after.inventory.food.flour).toBe(1);
    expect(message).toBe('You grind a little grain into flour.');
    expect(after.player.energy).toBe(state.player.energy - BALANCE.gatherEnergyCost);
    expect(after.timeOfDay).toBeCloseTo(state.timeOfDay + workSeconds(state, BALANCE.gatherSeconds));
  });

  it('refuses without changing anything', () => {
    const state = granary(1);
    expect(applyAction(state, { type: 'grindGrain' })).toEqual({ state, message: 'There isn\'t enough grain in the granary to grind.' });
  });
});

describe('baking and eating bread', () => {
  it('bakes a flour into a loaf at the campfire, without the pot, and keeps it in the bag', () => {
    const state = evening(addFood(emptyFood(), 'flour', 1, 22));
    expect(dishBlocker(state, 'loaf')).toBeNull();
    const { state: after, message } = applyAction(state, { type: 'cook', dish: 'loaf' });
    expect(after.inventory.food.flour).toBe(0);
    expect(after.inventory.food.bread).toEqual([22]);
    expect(message).toBe('You bake a loaf on the hot stones by the fire and keep it for later.');
  });

  it('needs flour for a loaf', () => {
    expect(dishBlocker(evening(emptyFood()), 'loaf')).toBe('You need 1 flour for a loaf of bread.');
  });

  it('needs room in the bag for the loaf, unless the flour came out of it', () => {
    const fromLarder = { ...fullBag(evening(emptyFood())), structures: { ...evening(emptyFood()).structures, larder: true, house: false } };
    const larder = { ...fromLarder, larder: addFood(emptyFood(), 'flour', 1, 22), clearing: { ...fromLarder.clearing, cleared: [...fromLarder.clearing.cleared, 'north-near' as const] } };
    expect(dishBlocker(larder, 'loaf')).toBe('Make room in your bag for the loaf.');
    const fromBag = fullBag(evening(addFood(emptyFood(), 'flour', 1, 22)));
    expect(dishBlocker(fromBag, 'loaf')).toBeNull();
  });

  it('fills fifty hunger', () => {
    const state = { ...granary(0, addFood(emptyFood(), 'bread', 1, 22)), player: { ...granary().player, hunger: 20 } };
    const { state: after, message } = applyAction(state, { type: 'eat', item: 'bread' });
    expect(after.player.hunger).toBe(70);
    expect(message).toBe('Ate a loaf of bread.');
  });

  it('won\'t eat flour as it is', () => {
    const state = granary(0, addFood(emptyFood(), 'flour', 1, 22));
    expect(applyAction(state, { type: 'eat', item: 'flour' }).message).toBe('Bake the flour into a loaf at the fire first.');
  });

  it('eats the bread first when it is nearest going soft', () => {
    const food = addFood(addFood(emptyFood(), 'bread', 1, 2), 'berry', 1, 3);
    expect(quickEatItem({ ...granary(0, food), day: 4 })).toBe('bread');
    const berryOlder = addFood(addFood(emptyFood(), 'bread', 1, 3), 'berry', 1, 2);
    expect(quickEatItem({ ...granary(0, berryOlder), day: 4 })).toBe('berry');
  });
});

describe('bread going soft', () => {
  it('goes soft in the bag like a berry, and keeps longer in the larder', () => {
    const loaf = addFood(emptyFood(), 'bread', 1, 1);
    expect(spoil(loaf, 3, BALANCE.bagFreshDays).store.bread).toEqual([1]);
    expect(spoil(loaf, 4, BALANCE.bagFreshDays)).toEqual({ store: emptyFood(), lost: { berry: 0, greens: 0, bread: 1 } });
    expect(spoil(loaf, 5, BALANCE.larderFreshDays).store.bread).toEqual([1]);
    expect(spoil(loaf, 6, BALANCE.larderFreshDays).lost.bread).toBe(1);
  });

  it('is named in the morning line', () => {
    const before = granary();
    const after = (berry: number, bread: number): GameState => ({ ...before, lastSpoiled: { day: 22, berry, greens: 0, bread } });
    expect(spoilMessage(before, after(0, 1))).toBe('A loaf had gone soft, so you threw it out.');
    expect(spoilMessage(before, after(0, 2))).toBe('Two loaves had gone soft, so you threw them out.');
    expect(spoilMessage(before, after(1, 1))).toBe('A berry and a loaf had gone soft, so you threw them out.');
  });

  it('is thrown out across a dawn and recorded', () => {
    const state = { ...granary(0, addFood(emptyFood(), 'bread', 1, 19)), timeOfDay: BALANCE.daySeconds - 1 };
    const after = applyAction(state, { type: 'rest' }).state;
    expect(after.inventory.food.bread).toEqual([]);
    expect(after.lastSpoiled).toEqual({ day: 23, berry: 0, greens: 0, bread: 1 });
  });
});

describe('grain laid by for winter', () => {
  it('counts the granary\'s grain and the flour as the loaves they make', () => {
    expect(foodLaidByDays(granary(16))).toBe(10);
    expect(foodLaidByDays(granary(4))).toBe(3);
    expect(foodLaidByDays(granary(5))).toBe(3);
    expect(foodLaidByDays(granary(0, addFood(emptyFood(), 'flour', 3, 22)))).toBe(5);
  });
});

describe('bread in the panels', () => {
  it('offers a loaf at the fire whenever there is flour to bake, pot or no pot', () => {
    expect(nightDishesView(evening(emptyFood())).some(view => view.dish === 'loaf')).toBe(false);
    const loaf = nightDishesView(evening(addFood(emptyFood(), 'flour', 1, 22))).find(view => view.dish === 'loaf');
    expect(loaf).toMatchObject({ name: 'A loaf of bread', disabled: false });
    expect(loaf!.cost).toMatch(/^1 flour · /);
    expect(nightDishMarkup()).toContain('data-dish="loaf"');
  });

  it('shows bread in the bag with an Eat button, and flour without one', () => {
    const view = bagView(granary(0, addFood(addFood(emptyFood(), 'bread', 2, 21), 'flour', 1, 22)));
    expect(view.foods.bread).toEqual({ count: 2, shown: true, note: '' });
    expect(view.foods.flour).toEqual({ count: 1, shown: true, note: '' });
    expect(view.eatable.bread).toBe(true);
    expect(bagFoodMarkup()).toContain('data-action="eat" data-item="bread"');
    expect(bagFoodMarkup()).not.toContain('data-item="flour"');
    expect(bagView({ ...granary(0, addFood(emptyFood(), 'bread', 1, 20)) }).foods.bread.note).toBe('(1 going soft)');
  });
});

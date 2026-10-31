import { describe, expect, it } from 'vitest';
import { BALANCE, createGame, type GameState } from '../src/game/state';
import { nightStart } from '../src/game/calendar';
import { addFood, emptyFood, type FoodItem } from '../src/game/food';
import { applyAction } from '../src/game/rules';
import { DISHES, DISH_ORDER, defaultDish, dishBlocker, potBlocker } from '../src/game/cooking';

const NIGHT = nightStart(1);

/** A camp with the toolshed built, standing at the fire. */
function toolshedCamp(): GameState {
  const state = createGame();
  return {
    ...state,
    structures: { ...state.structures, shelter: true, toolshed: true },
    player: { ...state.player, x: BALANCE.campX, y: BALANCE.campY }
  };
}

/** An evening at a lit fire with the pot made and the food given, picked on day 1. */
function evening(food: Partial<Record<FoodItem, number>>, pot = true): GameState {
  const state = toolshedCamp();
  let store = emptyFood();
  for (const [item, n] of Object.entries(food) as [FoodItem, number][]) store = addFood(store, item, n, 1);
  return {
    ...state,
    timeOfDay: NIGHT + 10,
    fireFuel: 60,
    progress: { ...state.progress, potCrafted: pot },
    inventory: { ...state.inventory, food: store },
    player: { ...state.player, energy: 40, hunger: 30, warmth: 40 }
  };
}

describe('the cooking pot', () => {
  it('needs the toolshed, then the clearing', () => {
    const state = createGame();
    state.inventory.wood = 1;
    state.inventory.stone = 2;
    expect(potBlocker(state)).toBe('Build a toolshed first.');
    const shed = { ...toolshedCamp(), inventory: state.inventory };
    expect(potBlocker({ ...shed, player: { ...shed.player, x: 0, y: 0 } })).toBe('Return to camp to make the pot.');
    expect(potBlocker(shed)).toBeNull();
  });

  it('needs 1 wood and 2 stone, counting the stone pile, and is made once', () => {
    const shed = toolshedCamp();
    expect(potBlocker(shed)).toBe('Need 1 wood and 2 stone for the pot.');
    const piled = { ...shed, inventory: { ...shed.inventory, wood: 1, stone: 1 }, storedStone: 1, structures: { ...shed.structures, stonePile: true } };
    expect(potBlocker(piled)).toBeNull();
    expect(potBlocker({ ...piled, storedStone: 0 })).toBe('Need 1 wood and 2 stone for the pot.');
    const made = applyAction(piled, { type: 'craftPot' });
    expect(made.message).toBe('Made a cooking pot. It hangs over the fire on a little tripod.');
    expect(made.state.progress.potCrafted).toBe(true);
    expect(made.state.inventory).toMatchObject({ wood: 0, stone: 0 });
    expect(made.state.storedStone).toBe(0);
    expect(made.state.timeOfDay).toBe(BALANCE.buildSeconds);
    expect(made.state.player.energy).toBeLessThanOrEqual(100 - BALANCE.buildEnergyCost);
    expect(potBlocker(made.state)).toBe('You already have a cooking pot.');
    expect(applyAction(made.state, { type: 'craftPot' }).state).toBe(made.state);
  });
});

describe('the dishes', () => {
  it('lists every dish in order, and only a fish and berries cook without the pot', () => {
    expect(DISH_ORDER).toEqual(['fish', 'berries', 'pineTea', 'salad', 'roastedHazelnuts', 'honeyCake', 'stew']);
    expect(DISH_ORDER.filter(dish => !DISHES[dish].potOnly)).toEqual(['fish', 'berries']);
  });

  it('cooks berries without the pot exactly as before', () => {
    const state = evening({ berry: 1 }, false);
    const cooked = applyAction(state, { type: 'cook' });
    expect(cooked.message).toBe('You toast a berry by the fire. A warm little meal.');
    expect(cooked.state.inventory.food.berry).toEqual([]);
    expect(cooked.state.timeOfDay).toBe(NIGHT + 18);
    expect(cooked.state.player.hunger).toBeCloseTo(30 - 1 + BALANCE.cookHungerGain);
    expect(cooked.state.player.warmth).toBe(40 + 4 + BALANCE.cookWarmthGain);
    expect(applyAction(state, { type: 'cook', dish: 'berries' }).state).toEqual(cooked.state);
  });

  it('brews pine needle tea for warmth and a little energy', () => {
    const state = evening({ pineNeedles: 1 });
    const brewed = applyAction(state, { type: 'cook', dish: 'pineTea' });
    expect(brewed.state.inventory.food.pineNeedles).toBe(0);
    expect(brewed.state.timeOfDay).toBe(NIGHT + 18);
    expect(brewed.state.player.warmth).toBe(40 + 4 + BALANCE.teaWarmthGain);
    expect(brewed.state.player.energy).toBe(40 + BALANCE.teaEnergyGain);
    expect(brewed.state.player.hunger).toBeCloseTo(29);
  });

  it('tosses a salad for hunger and energy', () => {
    const state = evening({ greens: 1, berry: 1 });
    const tossed = applyAction(state, { type: 'cook', dish: 'salad' }).state;
    expect(tossed.inventory.food).toMatchObject({ greens: [], berry: [] });
    expect(tossed.player.hunger).toBeCloseTo(29 + BALANCE.saladHungerGain);
    expect(tossed.player.energy).toBe(40 + BALANCE.saladEnergyGain);
    expect(tossed.player.warmth).toBe(44);
  });

  it('roasts two hazelnuts into one for the bag', () => {
    const state = evening({ hazelnut: 3 });
    const roasted = applyAction(state, { type: 'cook', dish: 'roastedHazelnuts' }).state;
    expect(roasted.inventory.food).toMatchObject({ hazelnut: 1, roastedHazelnuts: 1 });
    expect(roasted.player).toMatchObject({ energy: 40, warmth: 44 });
    expect(roasted.player.hunger).toBeCloseTo(29);
  });

  it('bakes a honey cake that feeds well and saves a little rest for later', () => {
    const state = evening({ honey: 1, hazelnut: 1, berry: 1 });
    const baked = applyAction(state, { type: 'cook', dish: 'honeyCake' }).state;
    expect(baked.inventory.food).toMatchObject({ honey: 0, hazelnut: 0, berry: [] });
    expect(baked.player.hunger).toBeCloseTo(29 + BALANCE.honeyCakeHungerGain);
    expect(baked.player.energy).toBe(40);
    expect(baked.cakeBonus).toBe(true);
  });

  it('refuses a pot dish without the pot', () => {
    const state = evening({ pineNeedles: 1 }, false);
    expect(dishBlocker(state, 'pineTea')).toBe('Make a cooking pot first.');
    expect(applyAction(state, { type: 'cook', dish: 'pineTea' })).toEqual({ state, message: 'Make a cooking pot first.' });
  });

  it('names the whole recipe when an ingredient is missing', () => {
    const state = evening({ berry: 1 });
    expect(applyAction(state, { type: 'cook', dish: 'salad' }).message).toBe('You need 1 greens and 1 berry for greens and berry salad.');
    expect(dishBlocker(state, 'roastedHazelnuts')).toBe('You need 2 hazelnuts for roasted hazelnuts.');
    expect(dishBlocker(state, 'honeyCake')).toBe('You need 1 honey, 1 hazelnut and 1 berry for honey cake.');
    expect(dishBlocker(state, 'pineTea')).toBe('You need 1 pine needles for pine needle tea.');
  });

  it('cooks only after nightfall, at camp, at a lit fire', () => {
    const state = evening({ pineNeedles: 1 });
    const day = { ...state, timeOfDay: 100 };
    expect(applyAction(day, { type: 'cook', dish: 'pineTea' })).toEqual({ state: day, message: 'Cook after nightfall.' });
    expect(dishBlocker({ ...state, player: { ...state.player, x: 0 } }, 'pineTea')).toBe('Return to camp to cook.');
    expect(dishBlocker({ ...state, fireFuel: 0 }, 'pineTea')).toBe('Light the campfire before cooking.');
    expect(applyAction({ ...state, timeOfDay: 100, progress: { ...state.progress, potCrafted: false } }, { type: 'cook' }).message).toBe('Cook berries after nightfall.');
  });

  it('refuses to roast into a bag still full after paying', () => {
    const state = evening({ hazelnut: 2 });
    // Ten in an eight-space bag: the two hazelnuts paid still leave it full.
    const full = { ...state, inventory: { ...state.inventory, wood: 8 } };
    expect(dishBlocker(full, 'roastedHazelnuts')).toBe('Make room in your bag for the roasted hazelnuts.');
    expect(applyAction(full, { type: 'cook', dish: 'roastedHazelnuts' }).state).toBe(full);
    expect(dishBlocker({ ...full, inventory: { ...full.inventory, wood: 7 } }, 'roastedHazelnuts')).toBeNull();
  });
});

describe('the C key', () => {
  it('cooks the first dish that can be made', () => {
    expect(defaultDish(evening({ berry: 1, pineNeedles: 1 }))).toBe('berries');
    expect(defaultDish(evening({ pineNeedles: 1 }))).toBe('pineTea');
    expect(defaultDish(evening({ pineNeedles: 1 }, false))).toBeNull();
    expect(defaultDish(evening({}))).toBeNull();
    const state = evening({ pineNeedles: 1 });
    expect(applyAction(state, { type: 'cook' }).state).toEqual(applyAction(state, { type: 'cook', dish: 'pineTea' }).state);
  });
});

describe('the honey cake\'s bonus', () => {
  const baked = (): GameState => applyAction(evening({ honey: 1, hazelnut: 1, berry: 1 }), { type: 'cook', dish: 'honeyCake' }).state;

  it('adds 10 energy to the next rest at camp, then clears', () => {
    const cake = baked();
    const plain = applyAction({ ...cake, cakeBonus: false }, { type: 'rest' }).state;
    const rested = applyAction(cake, { type: 'rest' }).state;
    expect(rested.player.energy).toBeCloseTo(plain.player.energy + BALANCE.honeyCakeRestBonus);
    expect(rested.cakeBonus).toBe(false);
  });

  it('adds 10 energy to the next sleep, then clears', () => {
    const cake = { ...baked(), player: { ...baked().player, energy: 20 } };
    const plain = applyAction({ ...cake, cakeBonus: false }, { type: 'sleep' }).state;
    const slept = applyAction(cake, { type: 'sleep' }).state;
    expect(slept.player.energy).toBeCloseTo(plain.player.energy + BALANCE.honeyCakeRestBonus);
    expect(slept.cakeBonus).toBe(false);
  });

  it('is kept through a rest at the spring', () => {
    const cake = baked();
    const atSpring = { ...cake, day: 2, timeOfDay: 50, player: { ...cake.player, x: 10, y: 20 } };
    const rested = applyAction(atSpring, { type: 'visitSite', siteId: 'spring' });
    expect(rested.message).toBe('You pause beside the quiet spring and feel rested.');
    expect(rested.state.cakeBonus).toBe(true);
  });
});

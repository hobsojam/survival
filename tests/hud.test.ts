import { describe, expect, it } from 'vitest';
import { nightStart } from '../src/game/calendar';
import { BALANCE, createGame } from '../src/game/state';
import { buildStatus, cookBlocker, pickaxeBlocker, stargazeBlocker } from '../src/game/rules';
import { stock } from './stock';
import { emptyFood } from '../src/game/food';

describe('build buttons', () => {
  it('locks the hearth until the cold night is weathered', () => {
    const state = createGame();
    state.inventory = { wood: 9, fiber: 0, stone: 3, food: emptyFood() };
    expect(buildStatus(state, 'hearth')).toBe('locked');
    state.progress = { nextStormDay: null, hearthUnlocked: true, lookoutRepaired: false, axeCrafted: false, quarryFound: false, pickaxeCrafted: false, potCrafted: false, packWoven: false, fishingLine: false, workshop: { saw: false, handcart: false, bedTools: false },
      discoveries: { basket: false, spring: false, cairn: false } };
    expect(buildStatus(state, 'hearth')).toBe('ready');
  });

  it('blocks the bed until there is a shelter', () => {
    const state = createGame();
    state.inventory = { wood: 6, fiber: 2, stone: 0, food: emptyFood() };
    expect(buildStatus(state, 'bed')).toBe('needsShelter');
    state.structures.shelter = true;
    expect(buildStatus(state, 'bed')).toBe('ready');
    expect(buildStatus(state, 'shelter')).toBe('built');
  });

  it('is only ready at camp with the materials in hand', () => {
    const state = createGame();
    state.inventory.wood = 3;
    expect(buildStatus(state, 'dryingRack')).toBe('unavailable');
    state.inventory.wood = 4;
    expect(buildStatus(state, 'dryingRack')).toBe('ready');
    state.player.x = BALANCE.campX + BALANCE.campRadius + 1;
    expect(buildStatus(state, 'dryingRack')).toBe('unavailable');
  });
});

describe('after-dark actions', () => {
  it('wait for nightfall, camp, and (for cooking) a lit fire and a berry', () => {
    const state = createGame();
    expect(cookBlocker(state)).toMatch(/nightfall/);
    expect(stargazeBlocker(state)).toMatch(/nightfall/);
    state.timeOfDay = nightStart(1);
    expect(stargazeBlocker(state)).toBeNull();
    state.fireFuel = 0;
    expect(cookBlocker(state)).toMatch(/campfire/);
    state.fireFuel = 30;
    state.inventory.food = stock(0);
    expect(cookBlocker(state)).toMatch(/berry/);
    state.inventory.food = stock(1);
    expect(cookBlocker(state)).toBeNull();
    state.player.x = BALANCE.campX + BALANCE.campRadius + 1;
    expect(cookBlocker(state)).toMatch(/camp/);
    expect(stargazeBlocker(state)).toMatch(/camp/);
  });
});

describe('pickaxe blocker', () => {
  it('names what is missing and clears when crafting is possible', () => {
    const state = createGame();
    state.inventory = { wood: 2, fiber: 1, stone: 2, food: emptyFood() };
    expect(pickaxeBlocker(state)).toBe('Find the quarry first.');
    state.progress.quarryFound = true;
    expect(pickaxeBlocker(state)).toBe('Build a toolshed first.');
    state.structures.toolshed = true;
    expect(pickaxeBlocker(state)).toBeNull();
    state.inventory.stone = 1;
    expect(pickaxeBlocker(state)).toMatch(/stone/);
  });
});

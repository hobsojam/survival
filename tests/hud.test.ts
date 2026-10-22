import { describe, expect, it } from 'vitest';
import { BALANCE, createGame } from '../src/game/state';
import { buildStatus, cookBlocker, stargazeBlocker } from '../src/game/rules';

describe('build buttons', () => {
  it('locks the hearth until the cold night is weathered', () => {
    const state = createGame();
    state.inventory = { wood: 9, food: 0, fiber: 0, stone: 3 };
    expect(buildStatus(state, 'hearth')).toBe('locked');
    state.progress = { nextStormDay: null, hearthUnlocked: true };
    expect(buildStatus(state, 'hearth')).toBe('ready');
  });

  it('blocks the bed until there is a shelter', () => {
    const state = createGame();
    state.inventory = { wood: 6, food: 0, fiber: 2, stone: 0 };
    expect(buildStatus(state, 'bed')).toBe('needsShelter');
    state.structures.shelter = true;
    expect(buildStatus(state, 'bed')).toBe('ready');
    expect(buildStatus(state, 'shelter')).toBe('built');
  });

  it('is only ready at camp with the materials in hand', () => {
    const state = createGame();
    state.inventory.wood = 3;
    expect(buildStatus(state, 'crate')).toBe('unavailable');
    state.inventory.wood = 4;
    expect(buildStatus(state, 'crate')).toBe('ready');
    state.player.x = BALANCE.campX + BALANCE.campRadius + 1;
    expect(buildStatus(state, 'crate')).toBe('unavailable');
  });
});

describe('after-dark actions', () => {
  it('wait for nightfall, camp, and (for cooking) a lit fire and a berry', () => {
    const state = createGame();
    expect(cookBlocker(state)).toMatch(/nightfall/);
    expect(stargazeBlocker(state)).toMatch(/nightfall/);
    state.timeOfDay = BALANCE.nightStart;
    expect(stargazeBlocker(state)).toBeNull();
    state.fireFuel = 0;
    expect(cookBlocker(state)).toMatch(/campfire/);
    state.fireFuel = 30;
    state.inventory.food = 0;
    expect(cookBlocker(state)).toMatch(/berry/);
    state.inventory.food = 1;
    expect(cookBlocker(state)).toBeNull();
    state.player.x = BALANCE.campX + BALANCE.campRadius + 1;
    expect(cookBlocker(state)).toMatch(/camp/);
    expect(stargazeBlocker(state)).toMatch(/camp/);
  });
});

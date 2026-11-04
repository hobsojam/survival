import { describe, expect, it } from 'vitest';
import { createGame, type GameState } from '../src/game/state';
import { advanceTime, applyAction, buildStatus } from '../src/game/rules';
import { BALANCE } from '../src/game/state';

const homestead = (): GameState => {
  const state = createGame();
  state.structures.shelter = true;
  state.area = 'homestead';
  state.player = { ...state.player, x: 20, y: 16 };
  return state;
};

describe('chicken rescue', () => {
  it('unlocks the coop when the flock is found and waits for it before following', () => {
    const first = homestead();
    expect(buildStatus(first, 'chickenCoop')).toBe('locked');
    const found = applyAction(first, { type: 'meetChickens' });
    expect(found.state.chickens.discovered).toBe(true);
    expect(applyAction(found.state, { type: 'leadChickens' }).state.chickens.following).toBe(false);
    const atCamp = { ...found.state, area: 'camp' as const, player: { ...found.state.player, x: 20, y: 16 }, inventory: {
      ...found.state.inventory, wood: 4, fiber: 2
    } };
    expect(buildStatus(atCamp, 'chickenCoop')).toBe('ready');
    const built = applyAction(atCamp, { type: 'build', structureId: 'chickenCoop' });
    expect(built.state.structures.chickenCoop).toBe(true);
    const returned = { ...built.state, area: 'homestead' as const, player: { ...built.state.player, x: 20, y: 16 } };
    expect(applyAction(returned, { type: 'leadChickens' }).state.chickens.following).toBe(true);
  });

  it('keeps the flock following across areas until it reaches the coop', () => {
    const state = homestead();
    state.structures.chickenCoop = true;
    state.chickens = { ...state.chickens, discovered: true, following: true };
    state.player = { ...state.player, x: 0.1, y: 15 };
    const crossed = applyAction(state, { type: 'move', dx: -0.3, dy: 0 }).state;
    expect(crossed.area).toBe('camp');
    expect(crossed.chickens.following).toBe(true);
    const home = { ...crossed, player: { ...crossed.player, x: 22, y: 14 } };
    const arrived = applyAction(home, { type: 'move', dx: 0.1, dy: 0 }).state;
    expect(arrived.chickens.rescued).toBe(true);
    expect(arrived.chickens.following).toBe(false);
  });

  it('uses stored grain automatically and lays less often without it', () => {
    const state = createGame();
    state.day = 20;
    state.timeOfDay = BALANCE.daySeconds - 0.5;
    state.structures.chickenCoop = true;
    state.structures.granary = true;
    state.chickens = { discovered: true, following: false, rescued: true, eggs: 0, nextEggDay: 21 };
    state.field.grain = 2;
    const fed = advanceTime(state, 1);
    expect(fed.chickens.eggs).toBe(1);
    expect(fed.field.grain).toBe(1);
    expect(fed.chickens.nextEggDay).toBe(23);
    const foraging = { ...fed, field: { ...fed.field, grain: 0 }, day: 22, timeOfDay: BALANCE.daySeconds - 0.5 };
    const unfed = advanceTime(foraging, 1);
    expect(unfed.chickens.eggs).toBe(2);
    expect(unfed.chickens.nextEggDay).toBe(27);
  });

  it('keeps the chickens safe through a winter dawn without grain', () => {
    const state = createGame();
    state.day = 11;
    state.timeOfDay = BALANCE.daySeconds - 0.5;
    state.structures.chickenCoop = true;
    state.chickens = { discovered: true, following: false, rescued: true, eggs: 0, nextEggDay: 12 };
    const after = advanceTime(state, 1);
    expect(after.chickens).toMatchObject({ rescued: true, eggs: 0 });
  });

  it('collects eggs from the coop when the bag has room', () => {
    const state = createGame();
    state.structures.chickenCoop = true;
    state.player = { ...state.player, x: 22, y: 13 };
    state.chickens = { discovered: true, following: false, rescued: true, eggs: 2, nextEggDay: 4 };
    const taken = applyAction(state, { type: 'takeEgg' }).state;
    expect(taken.chickens.eggs).toBe(1);
    expect(taken.inventory.food.egg).toEqual([1]);
    const full = { ...state, inventory: { ...state.inventory, wood: 8 } };
    expect(applyAction(full, { type: 'takeEgg' }).state.chickens.eggs).toBe(2);
  });

  it('picks autumn apples again after three dawns but leaves them when the bag is full', () => {
    const state = homestead();
    state.day = 1;
    state.player = { ...state.player, x: 29, y: 19 };
    const picked = applyAction(state, { type: 'gatherApples' }).state;
    expect(picked.inventory.food.apple).toEqual([1]);
    expect(picked.homestead.applesReadyDay).toBe(4);
    expect(applyAction({ ...picked, day: 3 }, { type: 'gatherApples' }).state.inventory.food.apple).toEqual([1]);
    const ready = { ...picked, day: 4 };
    expect(applyAction(ready, { type: 'gatherApples' }).state.inventory.food.apple).toEqual([1, 4]);
    const full = { ...state, inventory: { ...state.inventory, wood: 8 } };
    expect(applyAction(full, { type: 'gatherApples' }).state.homestead.applesReadyDay).toBe(1);
  });

  it('finds a small useful bundle in the shed only once', () => {
    const state = homestead();
    state.player = { ...state.player, x: 22, y: 12 };
    const found = applyAction(state, { type: 'searchShed' }).state;
    expect(found.homestead.shedSearched).toBe(true);
    expect(found.inventory.wood).toBe(2);
    expect(found.inventory.fiber).toBe(1);
    expect(applyAction(found, { type: 'searchShed' }).state.inventory.wood).toBe(2);
  });
});

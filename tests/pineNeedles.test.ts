import { describe, expect, it } from 'vitest';
import { createGame } from '../src/game/state';
import { applyAction, bagCapacity, carriedCount } from '../src/game/rules';
import { bagFoodMarkup } from '../src/ui/panels';

describe('pine needle bag actions', () => {
  it('can drop a bunch anywhere to free a full bag', () => {
    const state = createGame();
    state.area = 'quarry';
    state.inventory.food.pineNeedles = bagCapacity(state);
    expect(carriedCount(state)).toBe(bagCapacity(state));
    const dropped = applyAction(state, { type: 'dropPineNeedles' });
    expect(dropped.state.inventory.food.pineNeedles).toBe(bagCapacity(state) - 1);
    expect(carriedCount(dropped.state)).toBe(bagCapacity(state) - 1);
  });

  it('burns one bunch as camp kindling, but not away from camp', () => {
    const state = createGame();
    state.inventory.food.pineNeedles = 2;
    state.fireFuel = 0;
    const burned = applyAction(state, { type: 'burnPineNeedles' });
    expect(burned.state.inventory.food.pineNeedles).toBe(1);
    expect(burned.state.fireFuel).toBe(30);
    expect(applyAction({ ...state, area: 'quarry' }, { type: 'burnPineNeedles' }).state).toEqual({ ...state, area: 'quarry' });
  });

  it('feeds the fireplace after moving into the house', () => {
    const state = createGame();
    state.structures.house = true;
    state.player.x = 19.5;
    state.player.y = 8.5;
    state.inventory.food.pineNeedles = 1;
    const burned = applyAction(state, { type: 'burnPineNeedles' }).state;
    expect(burned.fireplaceFuel).toBe(30);
    expect(burned.inventory.food.pineNeedles).toBe(0);
  });

  it('offers both actions beside pine needles in the bag', () => {
    expect(bagFoodMarkup()).toContain('data-action="burnPineNeedles"');
    expect(bagFoodMarkup()).toContain('data-action="dropPineNeedles"');
  });
});

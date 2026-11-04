import { describe, expect, it } from 'vitest';
import { createGame } from '../src/game/state';
import { sceneVisuals } from '../src/scene/visuals';
import { pickTapTarget, targetAction } from '../src/scene/tapTarget';
import { promptFor, useKeyAction } from '../src/scene/prompts';

describe('the old homestead in the scene', () => {
  it('shows the shed, orchard, and flock and lets a tap find each', () => {
    const state = createGame();
    state.structures.shelter = true;
    state.area = 'homestead';
    const visuals = sceneVisuals(state, 1000);
    expect(visuals.map(item => item.id)).toEqual(expect.arrayContaining(['homestead-shed', 'apple-tree', 'chicken-0', 'chicken-1', 'chicken-2']));
    expect(targetAction(pickTapTarget(state, 22, 12))).toEqual({ type: 'searchShed' });
    expect(targetAction(pickTapTarget(state, 29, 19))).toEqual({ type: 'gatherApples' });
    expect(targetAction(pickTapTarget(state, 20, 16))).toEqual({ type: 'meetChickens' });
  });

  it('shows chickens following the survivor through camp and settles them at the coop', () => {
    const state = createGame();
    state.structures.chickenCoop = true;
    state.chickens = { discovered: true, following: true, rescued: false, eggs: 0, nextEggDay: 1 };
    const travelling = sceneVisuals(state, 1000);
    expect(travelling.filter(item => /^chicken-\d$/.test(item.id))).toHaveLength(3);
    const home = { ...state, chickens: { ...state.chickens, following: false, rescued: true } };
    expect(sceneVisuals(home, 1000).filter(item => /^chicken-\d$/.test(item.id))).toHaveLength(3);
  });

  it('offers the chicken and orchard actions with E in reach', () => {
    const state = createGame();
    state.area = 'homestead';
    state.player = { ...state.player, x: 20, y: 16 };
    expect(useKeyAction(state)).toEqual({ type: 'meetChickens' });
    expect(promptFor(state)).toContain('chickens');
    state.chickens.discovered = true;
    state.structures.chickenCoop = true;
    expect(useKeyAction(state)).toEqual({ type: 'leadChickens' });
  });
});

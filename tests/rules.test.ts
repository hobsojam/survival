import { describe, expect, it } from 'vitest';
import { createGame } from '../src/game/state';
import { applyAction } from '../src/game/rules';

describe('gathering and inventory', () => {
  it('gathers nearby wood and spends energy without mutating the old state', () => {
    const before = createGame();
    const result = applyAction(before, { type: 'gather', nodeId: 'branch-0' });
    expect(result.state.inventory.wood).toBe(1);
    expect(result.state.player.energy).toBe(96);
    expect(result.state.nodes[0].amount).toBe(0);
    expect(before.inventory.wood).toBe(0);
    expect(before.nodes[0].amount).toBe(1);
  });

  it('gathers berries into food', () => {
    const state = createGame();
    state.player.x = 19;
    state.player.y = 13;
    expect(applyAction(state, { type: 'gather', nodeId: 'berry-0' }).state.inventory.food).toBe(1);
  });

  it('does not gather a distant or depleted node', () => {
    const state = createGame();
    const far = applyAction(state, { type: 'gather', nodeId: 'branch-11' });
    expect(far.state.inventory.wood).toBe(0);
    state.nodes[0].amount = 0;
    const depleted = applyAction(state, { type: 'gather', nodeId: 'branch-0' });
    expect(depleted.state.inventory.wood).toBe(0);
  });

  it('eats one food to restore hunger within its bound', () => {
    const state = createGame();
    state.inventory.food = 1;
    state.player.hunger = 80;
    const result = applyAction(state, { type: 'eat' });
    expect(result.state.inventory.food).toBe(0);
    expect(result.state.player.hunger).toBe(100);
  });

  it('leaves a full bag and the node untouched with useful feedback', () => {
    const state = createGame();
    state.inventory.wood = 8;
    const result = applyAction(state, { type: 'gather', nodeId: 'branch-0' });
    expect(result.state.inventory.wood).toBe(8);
    expect(result.state.nodes[0].amount).toBe(1);
    expect(result.message.toLowerCase()).toContain('full');
  });

  it('allows gathering at zero energy so the player cannot soft lock', () => {
    const state = createGame();
    state.player.energy = 0;
    expect(applyAction(state, { type: 'gather', nodeId: 'branch-0' }).state.inventory.wood).toBe(1);
  });
});

describe('time and gentle survival', () => {
  it('rolls the day over at 240 seconds and replenishes gathered nodes', async () => {
    const { advanceTime } = await import('../src/game/rules');
    const state = createGame();
    state.nodes[0].amount = 0;
    state.nodes[0].readyDay = 2;
    const next = advanceTime(state, 240);
    expect(next.day).toBe(2);
    expect(next.timeOfDay).toBe(0);
    expect(next.nodes[0].amount).toBe(1);
  });

  it('handles two dawns in one time step', async () => {
    const { advanceTime } = await import('../src/game/rules');
    const state = createGame();
    state.nodes[0].amount = 0;
    state.nodes[0].readyDay = 2;
    const next = advanceTime(state, 490);
    expect(next.day).toBe(3);
    expect(next.timeOfDay).toBe(10);
    expect(next.nodes[0].amount).toBe(1);
  });

  it('starts cold exposure at night and keeps meters within bounds', async () => {
    const { advanceTime } = await import('../src/game/rules');
    const state = createGame();
    state.player.x = 0;
    state.player.y = 0;
    state.player.hunger = 1;
    state.timeOfDay = 159;
    const beforeNight = advanceTime(state, 1);
    expect(beforeNight.player.warmth).toBe(100);
    const atNight = advanceTime(beforeNight, 2);
    expect(atNight.player.warmth).toBe(99);
    expect(atNight.player.hunger).toBeGreaterThanOrEqual(0);
    const longNight = advanceTime(atNight, 3000);
    expect(longNight.player.hunger).toBe(0);
    expect(longNight.player.warmth).toBeGreaterThanOrEqual(0);
    expect(longNight.player.warmth).toBeLessThanOrEqual(100);
  });

  it('slows but never blocks movement at depleted meters', async () => {
    const { movementFactor } = await import('../src/game/rules');
    const state = createGame();
    state.player.energy = 0;
    state.player.hunger = 0;
    state.player.warmth = 0;
    expect(movementFactor(state)).toBe(0.65);
    expect(applyAction(state, { type: 'move', dx: 1, dy: 0 }).state.player.x).toBeGreaterThan(20);
    expect(applyAction(state, { type: 'gather', nodeId: 'branch-0' }).state.inventory.wood).toBe(1);
  });

  it('stops movement at the map boundary', () => {
    const state = createGame();
    expect(applyAction(state, { type: 'move', dx: 1, dy: 0 }).state.player.x).toBe(21);
    state.player.x = 39;
    state.player.y = 0;
    const moved = applyAction(state, { type: 'move', dx: 2, dy: -2 }).state;
    expect(moved.player.x).toBe(39);
    expect(moved.player.y).toBe(0);
  });

  it('rest advances time and restores energy', () => {
    const state = createGame();
    state.player.energy = 30;
    const rested = applyAction(state, { type: 'rest' }).state;
    expect(rested.player.energy).toBe(55);
    expect(rested.timeOfDay).toBe(20);
  });
});

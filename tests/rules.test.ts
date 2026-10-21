import { describe, expect, it } from 'vitest';
import { BALANCE, createGame } from '../src/game/state';
import { advanceTime, applyAction } from '../src/game/rules';

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

describe('fire and camp upgrades', () => {
  it('builds while standing at the visible shelter and crate sites', () => {
    const shelterState = createGame();
    shelterState.inventory.wood = 6;
    shelterState.player.x = 17;
    shelterState.player.y = 13;
    expect(applyAction(shelterState, { type: 'build', structureId: 'shelter' }).state.structures.shelter).toBe(true);

    const crateState = createGame();
    crateState.inventory.wood = 4;
    crateState.player.x = 23;
    crateState.player.y = 16;
    expect(applyAction(crateState, { type: 'build', structureId: 'crate' }).state.structures.crate).toBe(true);
  });

  it('uses one wood to fuel the fire for 90 seconds', async () => {
    const { advanceTime } = await import('../src/game/rules');
    const state = createGame();
    state.inventory.wood = 1;
    const lit = applyAction(state, { type: 'stokeFire' }).state;
    expect(lit.inventory.wood).toBe(0);
    expect(lit.fireFuel).toBe(90);
    expect(advanceTime(lit, 100).fireFuel).toBe(0);
  });

  it('builds the shelter with six wood and six energy', () => {
    const state = createGame();
    state.inventory.wood = 6;
    const built = applyAction(state, { type: 'build', structureId: 'shelter' }).state;
    expect(built.structures.shelter).toBe(true);
    expect(built.inventory.wood).toBe(0);
    expect(built.player.energy).toBe(94);
  });

  it('bed improves rest and costs four wood', () => {
    const state = createGame();
    state.structures.shelter = true;
    state.inventory.wood = 4;
    state.player.energy = 20;
    const built = applyAction(state, { type: 'build', structureId: 'bed' }).state;
    expect(built.structures.bed).toBe(true);
    expect(built.inventory.wood).toBe(0);
    expect(applyAction(built, { type: 'rest' }).state.player.energy).toBe(64);
  });

  it('crate costs four wood and raises carrying capacity to sixteen', () => {
    const state = createGame();
    state.inventory.wood = 4;
    const built = applyAction(state, { type: 'build', structureId: 'crate' }).state;
    expect(built.structures.crate).toBe(true);
    expect(built.inventory.wood).toBe(0);
    built.inventory.wood = 8;
    expect(applyAction(built, { type: 'gather', nodeId: 'branch-0' }).state.inventory.wood).toBe(9);
  });

  it('does not build twice, overspend, or build away from camp', () => {
    const state = createGame();
    expect(applyAction(state, { type: 'build', structureId: 'shelter' }).state.structures.shelter).toBe(false);
    state.inventory.wood = 8;
    state.player.x = 0;
    expect(applyAction(state, { type: 'build', structureId: 'shelter' }).state.inventory.wood).toBe(8);
    state.player.x = 20;
    const built = applyAction(state, { type: 'build', structureId: 'shelter' }).state;
    expect(applyAction(built, { type: 'build', structureId: 'shelter' }).state.inventory.wood).toBe(2);
  });

  it('shelter and fire reduce cold exposure at camp', async () => {
    const { advanceTime } = await import('../src/game/rules');
    const state = createGame();
    state.timeOfDay = 160;
    state.player.warmth = 50;
    const outdoors = advanceTime(state, 4).player.warmth;
    state.structures.shelter = true;
    const sheltered = advanceTime(state, 4).player.warmth;
    state.fireFuel = 10;
    const byFire = advanceTime(state, 4).player.warmth;
    expect(outdoors).toBe(48);
    expect(sheltered).toBe(49);
    expect(byFire).toBe(52);
  });
});

describe('daylight spent on work', () => {
  it('gathering takes six seconds of daylight', () => {
    const result = applyAction(createGame(), { type: 'gather', nodeId: 'branch-0' });
    expect(result.state.timeOfDay).toBe(6);
    expect(result.state.player.hunger).toBe(99.25);
  });

  it('building takes twelve seconds of daylight', () => {
    const state = createGame();
    state.inventory.wood = 6;
    const result = applyAction(state, { type: 'build', structureId: 'shelter' });
    expect(result.state.timeOfDay).toBe(12);
    expect(result.state.player.hunger).toBe(98.5);
  });
});

describe('tiredness and sleep', () => {
  const nightAtCamp = () => {
    const state = createGame();
    state.timeOfDay = BALANCE.nightStart + 10;
    state.structures.shelter = true;
    state.player.energy = 20;
    return state;
  };

  it('drains energy slowly while awake but not while resting', () => {
    const state = createGame();
    expect(advanceTime(state, 60).player.energy).toBeCloseTo(100 - 60 * BALANCE.energyDrainPerSecond);
    expect(advanceTime(state, 60, 'resting').player.energy).toBe(100);
    expect(advanceTime(state, 60, 'working').player.energy).toBe(100);
    state.player.energy = 1;
    expect(advanceTime(state, 600).player.energy).toBe(0);
  });

  it('sleeps through to dawn, letting the night play out', () => {
    const state = nightAtCamp();
    state.fireFuel = 30;
    const result = applyAction(state, { type: 'sleep' });
    expect(result.state.day).toBe(2);
    expect(result.state.timeOfDay).toBe(0);
    expect(result.state.fireFuel).toBe(0);
    expect(result.state.player.hunger).toBeLessThan(state.player.hunger);
    expect(result.state.player.energy).toBe(20 + BALANCE.sleepEnergyGain);
    expect(result.message).toMatch(/morning/i);
  });

  it('sleeps fully restored in a bed', () => {
    const state = nightAtCamp();
    state.structures.bed = true;
    expect(applyAction(state, { type: 'sleep' }).state.player.energy).toBe(100);
  });

  it('only sleeps at night, at camp, with a shelter', () => {
    const day = nightAtCamp();
    day.timeOfDay = 60;
    expect(applyAction(day, { type: 'sleep' })).toMatchObject({ state: day, message: expect.stringMatching(/night/i) });
    const away = nightAtCamp();
    away.player.x = 0;
    expect(applyAction(away, { type: 'sleep' })).toMatchObject({ state: away, message: expect.stringMatching(/camp/i) });
    const unsheltered = nightAtCamp();
    unsheltered.structures.shelter = false;
    expect(applyAction(unsheltered, { type: 'sleep' })).toMatchObject({ state: unsheltered, message: expect.stringMatching(/shelter/i) });
  });
});

describe('optional night activities', () => {
  it('cooks one berry by a lit campfire for a warm meal', () => {
    const state = createGame();
    state.timeOfDay = 170;
    state.inventory.food = 1;
    state.fireFuel = 30;
    state.player.hunger = 30;
    state.player.warmth = 40;
    const cooked = applyAction(state, { type: 'cook' });
    expect(cooked.state.inventory.food).toBe(0);
    expect(cooked.state.timeOfDay).toBe(178);
    expect(cooked.state.fireFuel).toBe(22);
    expect(cooked.state.player.hunger).toBeCloseTo(64);
    expect(cooked.state.player.warmth).toBe(54);
    expect(state.inventory.food).toBe(1);
  });

  it('does not cook in daylight, away from camp, without berries, or without fire', () => {
    const state = createGame();
    state.inventory.food = 1;
    state.fireFuel = 20;
    for (const setup of [
      (s: typeof state) => { s.timeOfDay = 100; },
      (s: typeof state) => { s.timeOfDay = 170; s.player.x = 0; },
      (s: typeof state) => { s.timeOfDay = 170; s.inventory.food = 0; },
      (s: typeof state) => { s.timeOfDay = 170; s.fireFuel = 0; }
    ]) {
      const attempt = structuredClone(state);
      setup(attempt);
      expect(applyAction(attempt, { type: 'cook' }).state).toBe(attempt);
    }
  });

  it('stargazes at camp at night, restoring a little energy without supplies', () => {
    const state = createGame();
    state.timeOfDay = 230;
    state.player.energy = 15;
    const result = applyAction(state, { type: 'stargaze' });
    expect(result.state.day).toBe(2);
    expect(result.state.timeOfDay).toBe(2);
    expect(result.state.player.energy).toBe(25);
    expect(result.state.inventory).toEqual(state.inventory);
    expect(result.message).toMatch(/stars|sky|moon/i);
  });

  it('does not stargaze during daylight or away from camp', () => {
    const state = createGame();
    expect(applyAction(state, { type: 'stargaze' }).state).toBe(state);
    state.timeOfDay = 170;
    state.player.x = 0;
    expect(applyAction(state, { type: 'stargaze' }).state).toBe(state);
  });
});

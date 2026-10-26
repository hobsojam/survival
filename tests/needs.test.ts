import { describe, expect, it } from 'vitest';
import { nightStart } from '../src/game/calendar';
import { BALANCE, LOOKOUT, createGame, type GameState } from '../src/game/state';
import { QUARRY_SITE } from '../src/game/areas';
import { advanceTime, applyAction, buildStatus } from '../src/game/rules';
import { ALL_NEED_ALERTS, isExhausted, isLowMeter, isHungry, isStarving, isTired, needAlerts, needsMessage } from '../src/game/needs';

/** A survivor at the fire with the given energy and hunger, wood for a crate, berries, and room in the bag. */
function camp(energy: number, hunger = 100): GameState {
  const state = createGame();
  state.player = { ...state.player, x: BALANCE.campX, y: BALANCE.campY, energy, hunger };
  state.inventory = { ...state.inventory, wood: 4, food: 2 };
  return state;
}

const elapsed = (before: GameState, after: GameState) => (after.day - before.day) * BALANCE.daySeconds + after.timeOfDay - before.timeOfDay;

describe('need levels', () => {
  it('names tired and hungry at 20 or less, exhausted below 10, and starving at 0', () => {
    expect([isTired(camp(21)), isTired(camp(20))]).toEqual([false, true]);
    expect([isExhausted(camp(10)), isExhausted(camp(9.9))]).toEqual([false, true]);
    expect([isHungry(camp(100, 21)), isHungry(camp(100, 20))]).toEqual([false, true]);
    expect([isStarving(camp(100, 0.1)), isStarving(camp(100, 0))]).toEqual([false, true]);
  });

  it('marks any meter at 20 or less as low, for the amber bars', () => {
    expect([isLowMeter(20.4), isLowMeter(20), isLowMeter(0)]).toEqual([false, true, true]);
  });
});

describe('tired work', () => {
  it('takes one and a half times as long when tired', () => {
    const rested = camp(50);
    const node = rested.nodes.find(item => item.kind === 'branch')!;
    rested.player = { ...rested.player, x: node.x, y: node.y };
    const tired = { ...rested, player: { ...rested.player, energy: 20 } };
    const gather = { type: 'gather' as const, nodeId: node.id };
    expect(elapsed(rested, applyAction(rested, gather).state)).toBeCloseTo(BALANCE.gatherSeconds);
    expect(elapsed(tired, applyAction(tired, gather).state)).toBeCloseTo(BALANCE.gatherSeconds * BALANCE.tiredWorkFactor);
  });

  it('slows building and preparing rations too', () => {
    const tired = camp(20);
    const built = applyAction(tired, { type: 'build', structureId: 'crate' }).state;
    expect(elapsed(tired, built)).toBeCloseTo(BALANCE.buildSeconds * BALANCE.tiredWorkFactor);
    const rack = { ...camp(20), structures: { ...camp(20).structures, dryingRack: true } };
    expect(elapsed(rack, applyAction(rack, { type: 'prepareTrailFood' }).state)).toBeCloseTo(BALANCE.trailFoodSeconds * BALANCE.tiredWorkFactor);
  });
});

describe('exhaustion', () => {
  const tooTired = /too tired for heavy work/i;

  it('refuses building, crafting and lookout repairs', () => {
    const state = camp(9);
    state.structures = { ...state.structures, shelter: true, toolshed: true };
    state.progress = { ...state.progress, hearthUnlocked: true, nextStormDay: null, quarryFound: true };
    expect(applyAction(state, { type: 'build', structureId: 'crate' })).toMatchObject({ state, message: expect.stringMatching(tooTired) });
    expect(applyAction(state, { type: 'craftAxe' }).message).toMatch(tooTired);
    expect(applyAction(state, { type: 'craftPickaxe' }).message).toMatch(tooTired);
    const atLookout = { ...state, player: { ...state.player, x: LOOKOUT.x, y: LOOKOUT.y } };
    expect(applyAction(atLookout, { type: 'repairLookout' }).message).toMatch(tooTired);
    expect(buildStatus(state, 'crate')).toBe('unavailable');
    expect(buildStatus({ ...state, player: { ...state.player, energy: 10 } }, 'crate')).toBe('ready');
  });

  it('refuses chopping and digging', () => {
    const state = camp(9);
    state.progress = { ...state.progress, axeCrafted: true, pickaxeCrafted: true, quarryFound: true };
    const tree = state.trees[0];
    const byTree = { ...state, player: { ...state.player, x: tree.x, y: tree.y } };
    expect(applyAction(byTree, { type: 'chopTree', treeId: tree.id }).message).toMatch(tooTired);
    const quarry: GameState = { ...state, area: 'quarry', structures: { ...state.structures, shelter: true }, player: { ...state.player, x: QUARRY_SITE.x, y: QUARRY_SITE.y } };
    expect(applyAction(quarry, { type: 'digQuarry' }).message).toMatch(tooTired);
  });

  it('still allows gathering by hand, eating and resting', () => {
    const state = camp(0);
    const node = state.nodes.find(item => item.kind === 'berry')!;
    const byBush = { ...state, player: { ...state.player, x: node.x, y: node.y } };
    expect(applyAction(byBush, { type: 'gather', nodeId: node.id }).state.inventory.food).toBe(3);
    expect(applyAction(state, { type: 'eat' }).state.inventory.food).toBe(1);
    expect(applyAction(state, { type: 'rest' }).state.player.energy).toBe(BALANCE.restEnergyGain);
  });
});

describe('hungry recovery', () => {
  it('halves the energy a rest restores', () => {
    expect(applyAction(camp(40, 20), { type: 'rest' }).state.player.energy).toBe(40 + BALANCE.restEnergyGain / 2);
  });

  it('halves sleep and stops it above 50, even in a bed', () => {
    const night = (energy: number, bed: boolean) => {
      const state = camp(energy, 20);
      state.timeOfDay = nightStart(1) + 10;
      state.structures = { ...state.structures, shelter: true, bed };
      return state;
    };
    expect(applyAction(night(10, false), { type: 'sleep' }).state.player.energy).toBe(10 + BALANCE.sleepEnergyGain / 2);
    expect(applyAction(night(10, true), { type: 'sleep' }).state.player.energy).toBe(50);
    expect(applyAction(night(70, true), { type: 'sleep' }).state.player.energy).toBe(70);
  });

  it('halves stargazing', () => {
    const state = { ...camp(40, 20), timeOfDay: nightStart(1) + 10, fireFuel: 60 };
    expect(applyAction(state, { type: 'stargaze' }).state.player.energy).toBe(40 + BALANCE.stargazeEnergyGain / 2);
  });
});

describe('starving', () => {
  it('drains energy even while resting', () => {
    const state = camp(50, 0);
    expect(advanceTime(state, 40, 'resting').player.energy).toBeCloseTo(50 - 40 * BALANCE.starvingEnergyDrainPerSecond);
    expect(advanceTime(state, 40).player.energy).toBeCloseTo(50 - 40 * (BALANCE.starvingEnergyDrainPerSecond + BALANCE.energyDrainPerSecond));
  });

  it('starts draining once hunger runs out partway through', () => {
    const state = camp(50, 1);
    // Hunger lasts 8 more seconds, then 32 seconds of starving.
    expect(advanceTime(state, 40, 'resting').player.energy).toBeCloseTo(50 - 32 * BALANCE.starvingEnergyDrainPerSecond);
  });
});

describe('need alerts', () => {
  const all = new Set(ALL_NEED_ALERTS);

  it('fires once when a meter drops to its line, then waits until it recovers', () => {
    const first = needAlerts(all, camp(20));
    expect(first.fired).toEqual(['tired']);
    expect(needAlerts(first.armed, camp(18)).fired).toEqual([]);
    expect(needAlerts(needAlerts(first.armed, camp(28)).armed, camp(20)).fired).toEqual([]);
    const recovered = needAlerts(first.armed, camp(31)).armed;
    expect(needAlerts(recovered, camp(20)).fired).toEqual(['tired']);
  });

  it('names exhaustion and starving as their own alerts', () => {
    expect(needAlerts(all, camp(5, 100)).fired).toEqual(['exhausted']);
    expect(needAlerts(all, camp(100, 0)).fired).toEqual(['starving']);
    expect(needAlerts(all, camp(100, 15)).fired).toEqual(['hungry']);
  });

  it('stays quiet while every meter is comfortable', () => {
    expect(needAlerts(all, camp(100, 100))).toEqual({ armed: all, fired: [] });
  });

  it('turns alerts into one message, worst first', () => {
    expect(needsMessage([])).toBe('');
    expect(needsMessage(['tired'])).toBe("You're getting tired. Rest at camp or sleep tonight.");
    expect(needsMessage(['hungry', 'exhausted'])).toBe("You're exhausted. Heavy work will have to wait until you rest. You're hungry. Eat something soon.");
    expect(needsMessage(['starving'])).toBe("You're starving, and it's wearing you down. Eat something now.");
  });
});

import { describe, expect, it } from 'vitest';
import { gardenDawn, gardenPlotLabel, gardenPlotStage } from '../src/game/garden';
import { applyAction, harvestGardenBlocker, plantGardenBlocker } from '../src/game/rules';
import { BALANCE, createGame, type GardenPlot, type GameState } from '../src/game/state';

const plot = (changes: Partial<GardenPlot> = {}): GardenPlot => ({ plantedYear: null, harvestedYear: null, harvestReady: false, ...changes });
const gardenState = (day: number, changes: Partial<GameState> = {}): GameState => {
  const state = createGame();
  return { ...state, day, structures: { ...state.structures, garden: true }, ...changes };
};

describe('garden seasons', () => {
  it('shows each perennial bush at its seasonal stage', () => {
    const planted = plot({ plantedYear: 1 });
    expect(gardenPlotStage(gardenState(21), plot())).toBe('empty');
    expect(gardenPlotStage(gardenState(21), plot({ ...planted, harvestReady: true }))).toBe('ripe');
    expect(gardenPlotStage(gardenState(21), planted)).toBe('seedling');
    expect(gardenPlotStage(gardenState(31), planted)).toBe('growing');
    expect(gardenPlotStage(gardenState(41), planted)).toBe('ripe');
    expect(gardenPlotStage(gardenState(11), planted)).toBe('dormant');
    expect(gardenPlotStage(gardenState(35), plot({ ...planted, harvestedYear: 1 }))).toBe('growing');
    expect(gardenPlotStage(gardenState(11), plot({ ...planted, harvestedYear: 1 }))).toBe('dormant');
  });

  it('labels all plot stages and keeps a ready harvest explicit', () => {
    expect(gardenPlotLabel('empty', false)).toBe('Empty plot');
    expect(gardenPlotLabel('seedling', false)).toBe('Spring seedling');
    expect(gardenPlotLabel('growing', false)).toBe('Growing through summer');
    expect(gardenPlotLabel('ripe', false)).toBe('Berries ready to pick');
    expect(gardenPlotLabel('dormant', false)).toBe('Dormant until spring');
    expect(gardenPlotLabel('dormant', true)).toBe('Berries ready to pick');
  });

  it('readies planted bushes at autumn dawn and preserves prior readiness', () => {
    const plots = [plot(), plot({ plantedYear: 1 }), plot({ plantedYear: 1, harvestReady: true }), plot({ plantedYear: 1, harvestedYear: 1 })];
    const outsideAutumn = gardenState(21, { gardenPlots: plots });
    expect(gardenDawn(outsideAutumn)).toBe(plots);
    const autumn = gardenState(41, { gardenPlots: plots });
    expect(gardenDawn(autumn)).toEqual([
      plots[0],
      { ...plots[1], harvestReady: true },
      plots[2],
      { ...plots[3], harvestReady: true }
    ]);
  });

  it('sets harvest ready when a day advances into autumn', () => {
    const state = gardenState(40, {
      timeOfDay: BALANCE.daySeconds - 1,
      gardenPlots: [plot({ plantedYear: 1 }), plot(), plot()]
    });
    const next = applyAction(state, { type: 'rest' }).state;
    expect(next.day).toBe(41);
    expect(next.gardenPlots[0].harvestReady).toBe(true);
  });
});

describe('garden actions', () => {
  it('blocks planting outside an available spring plot', () => {
    const spring = gardenState(21, { inventory: { ...createGame().inventory, food: 1 } });
    expect(plantGardenBlocker(spring, -1)).toContain('unavailable');
    expect(plantGardenBlocker({ ...spring, structures: { ...spring.structures, garden: false } }, 0)).toContain('Build a garden');
    expect(plantGardenBlocker({ ...spring, area: 'quarry' }, 0)).toContain('camp');
    expect(plantGardenBlocker({ ...spring, day: 11 }, 0)).toContain('spring');
    expect(plantGardenBlocker({ ...spring, gardenPlots: [plot({ plantedYear: 1 }), ...spring.gardenPlots.slice(1)] }, 0)).toContain('already');
    expect(plantGardenBlocker({ ...spring, inventory: { ...spring.inventory, food: 0 } }, 0)).toContain('berry');
    expect(plantGardenBlocker({ ...spring, player: { ...spring.player, energy: 0 } }, 0)).toContain('tired');
    expect(plantGardenBlocker(spring, 0)).toBeNull();
    expect(applyAction(spring, { type: 'plantGarden', plotIndex: 9 }).state).toBe(spring);
  });

  it('plants one berry and applies gather time and energy costs', () => {
    const state = gardenState(21, { inventory: { ...createGame().inventory, food: 1 } });
    const result = applyAction(state, { type: 'plantGarden', plotIndex: 1 });
    expect(result.state.inventory.food).toBe(0);
    expect(result.state.gardenPlots[1]).toEqual({ plantedYear: 1, harvestedYear: null, harvestReady: false });
    expect(result.state.player.energy).toBeLessThan(state.player.energy);
    expect(result.state.timeOfDay).toBeGreaterThan(state.timeOfDay);
  });

  it('blocks harvests without a ready plot or room for both berries', () => {
    const readyPlot = plot({ plantedYear: 1, harvestReady: true });
    const autumn = gardenState(41, { gardenPlots: [readyPlot, ...createGame().gardenPlots.slice(1)] });
    expect(harvestGardenBlocker(autumn, 3)).toContain('unavailable');
    expect(harvestGardenBlocker({ ...autumn, structures: { ...autumn.structures, garden: false } }, 0)).toContain('Build a garden');
    expect(harvestGardenBlocker({ ...autumn, area: 'quarry' }, 0)).toContain('camp');
    expect(harvestGardenBlocker({ ...autumn, gardenPlots: createGame().gardenPlots }, 0)).toContain('not ready');
    expect(harvestGardenBlocker({ ...autumn, inventory: { ...autumn.inventory, wood: 4, stone: 2 } }, 0)).toContain('room');
    expect(harvestGardenBlocker({ ...autumn, player: { ...autumn.player, energy: 0 } }, 0)).toContain('tired');
    expect(harvestGardenBlocker(autumn, 0)).toBeNull();
    const unready = gardenState(41);
    expect(applyAction(unready, { type: 'harvestGarden', plotIndex: 0 }).state).toBe(unready);
  });

  it('harvests two berries once and records the year', () => {
    const readyPlot = plot({ plantedYear: 1, harvestReady: true });
    const state = gardenState(41, { gardenPlots: [readyPlot, ...createGame().gardenPlots.slice(1)] });
    const result = applyAction(state, { type: 'harvestGarden', plotIndex: 0 });
    expect(result.state.inventory.food).toBe(2);
    expect(result.state.gardenPlots[0]).toEqual({ plantedYear: 1, harvestedYear: 2, harvestReady: false });
    expect(result.state.player.energy).toBeLessThan(state.player.energy);
    expect(result.state.timeOfDay).toBeGreaterThan(state.timeOfDay);
  });
});

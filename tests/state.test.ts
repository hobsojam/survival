import { describe, expect, it } from 'vitest';
import { BALANCE, BUILDINGS, createGame } from '../src/game/state';
import { emptyFood } from '../src/game/food';

describe('new game', () => {
  it('starts one survivor at a valid camp with renewable supplies', () => {
    const game = createGame();
    expect(game.area).toBe('camp');
    expect(game.day).toBe(1);
    expect(game.timeOfDay).toBe(0);
    expect(game.player.x).toBeGreaterThanOrEqual(0);
    expect(game.player.x).toBeLessThan(40);
    expect(game.player.y).toBeGreaterThanOrEqual(0);
    expect(game.player.y).toBeLessThan(30);
    expect(game.inventory).toEqual({ wood: 0, fiber: 0, stone: 0, food: emptyFood() });
    expect(game.structures).toEqual({ shelter: false, shelterThatched: false, shelterStonework: false, shelterPorch: false, shelterFinished: false,
      bed: false, crate: false, hearth: false, dryingRack: false, garden: false, windbreak: false, stonePile: false, toolshed: false });
    expect(game.gardenPlots).toEqual(Array.from({ length: 3 }, () => ({ plantedYear: null, harvestedYear: null, harvestReady: false })));
    expect(BUILDINGS.dryingRack.cost).toEqual({ wood: 4, fiber: 0 });
    expect(BUILDINGS.windbreak.cost).toEqual({ wood: 5, fiber: 0 });
    expect(game.progress).toEqual({ nextStormDay: 3, hearthUnlocked: false, lookoutRepaired: false, axeCrafted: false, quarryFound: false, pickaxeCrafted: false,
      discoveries: { basket: false, spring: false, cairn: false } });
    expect(game.trees).toHaveLength(6);
    expect(game.trees.every(tree => tree.readyDay === 1)).toBe(true);
    expect(game.nodes.filter(node => node.kind === 'branch')).toHaveLength(12);
    expect(game.nodes.filter(node => node.kind === 'berry')).toHaveLength(8);
    expect(game.nodes.filter(node => node.kind === 'fiber')).toHaveLength(8);
    expect(game.nodes.filter(node => node.kind === 'stone')).toHaveLength(3);
    for (const [kind, count] of [['hazel', 3], ['pine', 3], ['greens', 5], ['honey', 1]] as const) expect(game.nodes.filter(node => node.kind === kind), kind).toHaveLength(count);
    expect(new Set(game.nodes.map(node => node.id)).size).toBe(43);
  });
});

describe('new game spawn', () => {
  it('starts the survivor beside the fire, inside camp, not on it', () => {
    const game = createGame();
    const fromFire = Math.hypot(game.player.x - BALANCE.campX, game.player.y - BALANCE.campY);
    expect(fromFire).toBeGreaterThanOrEqual(1);
    expect(fromFire).toBeLessThanOrEqual(BALANCE.campRadius);
  });
});

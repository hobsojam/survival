import { describe, expect, it } from 'vitest';
import { BALANCE, BUILDINGS, createGame } from '../src/game/state';

describe('new game', () => {
  it('starts one survivor at a valid camp with renewable supplies', () => {
    const game = createGame();
    expect(game.day).toBe(1);
    expect(game.timeOfDay).toBe(0);
    expect(game.player.x).toBeGreaterThanOrEqual(0);
    expect(game.player.x).toBeLessThan(40);
    expect(game.player.y).toBeGreaterThanOrEqual(0);
    expect(game.player.y).toBeLessThan(30);
    expect(game.inventory).toEqual({ wood: 0, food: 0, fiber: 0, stone: 0 });
    expect(game.structures).toEqual({ shelter: false, bed: false, crate: false, hearth: false, dryingRack: false, windbreak: false });
    expect(BUILDINGS.dryingRack.cost).toEqual({ wood: 4, fiber: 0 });
    expect(BUILDINGS.windbreak.cost).toEqual({ wood: 5, fiber: 0 });
    expect(game.progress).toEqual({ nextStormDay: 3, hearthUnlocked: false, lookoutRepaired: false, axeCrafted: false });
    expect(game.trees).toHaveLength(6);
    expect(game.trees.every(tree => tree.readyDay === 1)).toBe(true);
    expect(game.nodes.filter(node => node.kind === 'branch')).toHaveLength(12);
    expect(game.nodes.filter(node => node.kind === 'berry')).toHaveLength(8);
    expect(game.nodes.filter(node => node.kind === 'fiber')).toHaveLength(8);
    expect(game.nodes.filter(node => node.kind === 'stone')).toHaveLength(6);
    expect(new Set(game.nodes.map(node => node.id)).size).toBe(34);
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

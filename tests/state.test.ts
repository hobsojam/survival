import { describe, expect, it } from 'vitest';
import { BUILDINGS, createGame } from '../src/game/state';

describe('new game', () => {
  it('starts one survivor at a valid camp with renewable supplies', () => {
    const game = createGame();
    expect(game.day).toBe(1);
    expect(game.timeOfDay).toBe(0);
    expect(game.player.x).toBeGreaterThanOrEqual(0);
    expect(game.player.x).toBeLessThan(40);
    expect(game.player.y).toBeGreaterThanOrEqual(0);
    expect(game.player.y).toBeLessThan(30);
    expect(game.inventory).toEqual({ wood: 0, food: 0 });
    expect(game.structures).toEqual({ shelter: false, bed: false, crate: false, hearth: false, dryingRack: false, windbreak: false });
    expect(BUILDINGS.dryingRack.cost).toBe(4);
    expect(BUILDINGS.windbreak.cost).toBe(5);
    expect(game.progress).toEqual({ nextStormDay: 3, hearthUnlocked: false });
    expect(game.nodes.filter(node => node.kind === 'branch')).toHaveLength(12);
    expect(game.nodes.filter(node => node.kind === 'berry')).toHaveLength(8);
    expect(new Set(game.nodes.map(node => node.id)).size).toBe(20);
  });
});

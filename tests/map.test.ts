import { describe, expect, it } from 'vitest';
import { BALANCE, createGame } from '../src/game/state';
import { buildMap } from '../src/scene/map';

describe('terrain composition', () => {
  const nodes = createGame().nodes;

  it('is deterministic and leaves the camp and nodes clear of tree trunks', () => {
    const map = buildMap(nodes);
    expect(buildMap(nodes)).toEqual(map);
    expect(map.trees.length).toBeGreaterThan(50);
    for (const tree of map.trees) {
      expect(Math.hypot(tree.x - BALANCE.campX, tree.y - BALANCE.campY)).toBeGreaterThan(BALANCE.campRadius + 1);
      expect(nodes.every(node => Math.hypot(tree.x - node.x, tree.y - node.y) >= 3.5)).toBe(true);
    }
  });

  it('uses the camp radius for its visible edge and decorates sparsely', () => {
    const map = buildMap(nodes);
    expect(map.ground[BALANCE.campY][BALANCE.campX].startsWith('earth')).toBe(true);
    expect(map.rimStones.length).toBeGreaterThan(8);
    expect(map.decorations.length).toBeLessThan(BALANCE.mapWidth * BALANCE.mapHeight / 4);
    expect(map.decorations.some(item => item.sprite === 'stump')).toBe(true);
    expect(map.decorations.some(item => item.sprite === 'mushrooms')).toBe(true);
  });

  it('groups flowers into meadow patches', () => {
    const flowers = buildMap(nodes).decorations.filter(item => item.sprite.startsWith('flower'));
    for (const [x, y] of [[11, 8], [30, 7], [7, 23], [28, 23]]) {
      expect(flowers.filter(item => Math.hypot(item.x - x, item.y - y) <= 3).length).toBeGreaterThanOrEqual(2);
    }
  });
});

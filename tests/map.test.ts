import { describe, expect, it } from 'vitest';
import { BALANCE, SITES, createGame } from '../src/game/state';
import { terrainSprites } from '../src/art/terrain';
import { buildMap, shownTerrainKey, terrainKey, type TerrainMap } from '../src/scene/map';
import { CAMP_EXIT } from '../src/game/areas';

function visibleGround(map: TerrainMap, x: number, y: number, pixelX = 8, pixelY = 8): string | undefined {
  const base = terrainSprites[map.ground[y][x]];
  let color = base.legend[base.frames.still[pixelY][pixelX]];
  const path = map.pathTiles.find(item => item.x === x && item.y === y);
  if (path) {
    const sprite = terrainSprites[path.sprite];
    const pixel = sprite.frames.still[pixelY][pixelX];
    if (pixel !== '.') color = sprite.legend[pixel];
  }
  const edge = map.campEdges.find(item => item.x === x && item.y === y);
  if (edge) {
    const sprite = terrainSprites[edge.sprite];
    const pixel = sprite.frames.still[pixelY][pixelX];
    if (pixel !== '.') color = sprite.legend[pixel];
  }
  return color;
}

const pathEnds = [[9.5, 9.5], [30.5, 9.5], [10.5, 21.5], [30.5, 21.5]];
function pathDistance(x: number, y: number): number {
  const centerX = BALANCE.campX + .5;
  const centerY = BALANCE.campY + .5;
  return Math.min(...pathEnds.map(([endX, endY]) => {
    const dx = endX - centerX;
    const dy = endY - centerY;
    const t = Math.max(0, Math.min(1, ((x - centerX) * dx + (y - centerY) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - centerX - t * dx, y - centerY - t * dy);
  }));
}

describe('terrain composition', () => {
  const nodes = createGame().nodes;

  it('scatters quarry decorations across the open ground where the camp circle would be', () => {
    const map = buildMap([], 'quarry');
    expect(map.decorations.some(item => Math.hypot(item.x - BALANCE.campX, item.y - BALANCE.campY) <= BALANCE.campRadius)).toBe(true);
  });

  it('is deterministic and leaves the camp and nodes clear of tree trunks', () => {
    const map = buildMap(nodes, 'camp');
    for (const target of createGame().trees) {
      expect(map.trees).toContainEqual({ x: target.x, y: target.y, sprite: target.sprite });
    }
    for (const site of Object.values(SITES)) {
      expect(map.trees.every(tree => Math.hypot(tree.x - site.x, tree.y - site.y) >= 1.5)).toBe(true);
    }
    expect(buildMap(nodes, 'camp')).toEqual(map);
    expect(map.trees.length).toBeGreaterThan(50);
    for (const tree of map.trees) {
      expect(Math.hypot(tree.x - BALANCE.campX, tree.y - BALANCE.campY)).toBeGreaterThan(BALANCE.campRadius + 1);
      expect(nodes.every(node => Math.hypot(tree.x - node.x, tree.y - node.y) >= (node.kind === 'branch' ? 1.5 : 3.5))).toBe(true);
    }
  });

  it('places fallen branches beside trees while keeping starter wood near camp', () => {
    const branches = nodes.filter(node => node.kind === 'branch');
    const trees = buildMap(nodes, 'camp').trees;
    const nearTrees = branches.filter(branch => trees.some(tree => Math.hypot(tree.x - branch.x, tree.y - branch.y) <= 3.5));
    const nearCamp = branches.filter(branch => Math.hypot(branch.x - BALANCE.campX, branch.y - BALANCE.campY) <= 5);
    expect(nearTrees.length).toBeGreaterThanOrEqual(7);
    expect(nearCamp.length).toBeGreaterThanOrEqual(4);
    expect(new Set(nodes.map(node => `${node.x},${node.y}`)).size).toBe(nodes.length);
  });

  it('uses the camp radius for its visible edge and decorates sparsely', () => {
    const map = buildMap(nodes, 'camp');
    expect(map.ground[BALANCE.campY][BALANCE.campX].startsWith('earth')).toBe(true);
    expect(map.rimStones.length).toBeGreaterThan(8);
    expect(map.decorations.length).toBeLessThan(BALANCE.mapWidth * BALANCE.mapHeight / 4);
    expect(map.decorations.some(item => item.sprite === 'stump')).toBe(true);
    expect(map.decorations.some(item => item.sprite === 'mushrooms')).toBe(true);
  });

  it('keeps playable boundary tile centres visibly on earth', () => {
    const map = buildMap(nodes, 'camp');
    for (const [dx, dy] of [[4, 0], [-4, 0], [0, 4], [0, -4], [3, 2], [-3, -2]]) {
      expect(visibleGround(map, BALANCE.campX + dx, BALANCE.campY + dy), `${dx},${dy}`).toMatch(/^earth/);
    }
  });

  it('cuts the east and southeast clearing edges at the actual four-tile radius', () => {
    const map = buildMap(nodes, 'camp');
    expect(visibleGround(map, BALANCE.campX + 4, BALANCE.campY, 8, 8)).toMatch(/^earth/);
    expect(visibleGround(map, BALANCE.campX + 4, BALANCE.campY, 9, 8)).toMatch(/^grass/);
    expect(visibleGround(map, BALANCE.campX + 3, BALANCE.campY + 3, 5, 5)).toMatch(/^earth/);
    expect(visibleGround(map, BALANCE.campX + 3, BALANCE.campY + 3, 6, 6)).toMatch(/^grass/);
  });

  it('keeps earth centres outside the camp radius confined to paths', () => {
    const map = buildMap(nodes, 'camp');
    for (let y = 0; y < BALANCE.mapHeight; y++) for (let x = 0; x < BALANCE.mapWidth; x++) {
      if (Math.hypot(x - BALANCE.campX, y - BALANCE.campY) <= BALANCE.campRadius + .5) continue;
      if (pathDistance(x + .5, y + .5) < .75) continue;
      expect(visibleGround(map, x, y), `unexpected earth at ${x},${y}`).not.toMatch(/^earth/);
    }
  });

  it('keeps paths within one tile and connected to the clearing', () => {
    const map = buildMap(nodes, 'camp');
    for (let y = BALANCE.campY - 7; y <= BALANCE.campY + 7; y++) {
      for (let x = BALANCE.campX - 7; x <= BALANCE.campX + 7; x++) {
        for (let py = 0; py < 16; py += 2) for (let px = 0; px < 16; px += 2) {
          const worldX = x + (px + .5) / 16;
          const worldY = y + (py + .5) / 16;
          if (Math.hypot(worldX - BALANCE.campX - .5, worldY - BALANCE.campY - .5) <= BALANCE.campRadius + .1) continue;
          if (visibleGround(map, x, y, px, py)?.startsWith('earth')) {
            expect(pathDistance(worldX, worldY), `path too wide at ${worldX},${worldY}`).toBeLessThanOrEqual(.65);
          }
        }
      }
    }
    for (const [endX, endY] of pathEnds) {
      const dx = endX - BALANCE.campX - .5;
      const dy = endY - BALANCE.campY - .5;
      const length = Math.hypot(dx, dy);
      for (let distance = BALANCE.campRadius + .5; distance < Math.min(length, BALANCE.campRadius + 3); distance += .5) {
        const worldX = BALANCE.campX + .5 + dx * distance / length;
        const worldY = BALANCE.campY + .5 + dy * distance / length;
        const tileX = Math.floor(worldX);
        const tileY = Math.floor(worldY);
        const pixelX = Math.floor((worldX - tileX) * 16);
        const pixelY = Math.floor((worldY - tileY) * 16);
        expect(visibleGround(map, tileX, tileY, pixelX, pixelY), `path gap at ${worldX},${worldY}`).toMatch(/^earth/);
      }
    }
  });

  it('marks the camp circle with sixteen to twenty outlined high-contrast stones', () => {
    const stones = buildMap(nodes, 'camp').rimStones;
    expect(stones.length).toBeGreaterThanOrEqual(16);
    expect(stones.length).toBeLessThanOrEqual(20);
    for (const stone of stones) {
      expect(Math.hypot(stone.x - BALANCE.campX - .5, stone.y - BALANCE.campY - .5)).toBeCloseTo(BALANCE.campRadius);
      const sprite = terrainSprites[stone.sprite];
      expect(sprite.size[0]).toBeGreaterThanOrEqual(12);
      expect(sprite.size[0]).toBeLessThanOrEqual(16);
      const used = new Set(sprite.frames.still.join(''));
      expect([...used].some(pixel => sprite.legend[pixel] === 'stone0')).toBe(true);
      expect([...used].some(pixel => sprite.legend[pixel] === 'stone4')).toBe(true);
    }
  });

  it('keeps the path centre corridors clear of rim stones', () => {
    for (const stone of buildMap(nodes, 'camp').rimStones) {
      const sprite = terrainSprites[stone.sprite];
      const left = Math.round(stone.x * 16 - sprite.anchor[0]);
      const top = Math.round(stone.y * 16 - sprite.anchor[1]);
      for (let y = 0; y < sprite.size[1]; y++) for (let x = 0; x < sprite.size[0]; x++) {
        if (sprite.frames.still[y][x] === '.') continue;
        const worldX = (left + x + .5) / 16;
        const worldY = (top + y + .5) / 16;
        expect(pathDistance(worldX, worldY), `stone at ${stone.x},${stone.y} blocks path`).toBeGreaterThanOrEqual(.55);
      }
    }
  });

  it('groups flowers into meadow patches', () => {
    const flowers = buildMap(nodes, 'camp').decorations.filter(item => item.sprite.startsWith('flower'));
    for (const [x, y] of [[11, 8], [30, 7], [7, 23], [28, 23]]) {
      expect(flowers.filter(item => Math.hypot(item.x - x, item.y - y) <= 3).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('places six to nine actual groves of three to seven trees', () => {
    const map = buildMap(nodes, 'camp');
    expect(map.groves).toBeDefined();
    expect(map.groves.length).toBeGreaterThanOrEqual(6);
    expect(map.groves.length).toBeLessThanOrEqual(9);
    const groveTrees = map.groves.flat();
    expect(new Set(groveTrees.map(tree => `${tree.x},${tree.y}`)).size).toBe(groveTrees.length);
    for (const grove of map.groves) {
      expect(grove.length).toBeGreaterThanOrEqual(3);
      expect(grove.length).toBeLessThanOrEqual(7);
      for (const tree of grove) {
        expect(Math.min(tree.x, tree.y, BALANCE.mapWidth - 1 - tree.x, BALANCE.mapHeight - 1 - tree.y)).toBeGreaterThan(2);
        expect(map.trees).toContainEqual(tree);
      }
    }
  });

  it('terrainKey follows the area and the shelter', () => {
    const state = createGame();
    expect(terrainKey(state)).toBe('camp');
    const sheltered = { ...state, structures: { ...state.structures, shelter: true } };
    expect(terrainKey(sheltered)).toBe('camp-open');
    expect(terrainKey({ ...sheltered, area: 'quarry' })).toBe('quarry');
  });

  it('the west path is drawn only once open', () => {
    const westOnRow = (map: TerrainMap) => map.pathTiles.filter(item => item.y === CAMP_EXIT.y && item.x <= 2);
    expect(westOnRow(buildMap(nodes, 'camp'))).toEqual([]);
    const open = buildMap(nodes, 'camp-open');
    expect(westOnRow(open).length).toBeGreaterThan(0);
    const centerX = BALANCE.campX + .5, centerY = BALANCE.campY + .5;
    const endX = CAMP_EXIT.x + .5, endY = CAMP_EXIT.y + .5;
    for (const tree of open.trees) {
      const x = tree.x + .5, y = tree.y + .5, dx = endX - centerX, dy = endY - centerY;
      const t = Math.max(0, Math.min(1, ((x - centerX) * dx + (y - centerY) * dy) / (dx * dx + dy * dy)));
      expect(Math.hypot(x - centerX - t * dx, y - centerY - t * dy), `tree at ${tree.x},${tree.y}`).toBeGreaterThanOrEqual(1.35);
    }
  });

  it('the quarry map is rocky and open', () => {
    const camp = buildMap(nodes, 'camp');
    const quarry = buildMap([], 'quarry');
    expect(quarry.campEdges).toEqual([]);
    // No path is drawn in the quarry; the open ground leads straight to the quarry face.
    expect(quarry.pathTiles).toEqual([]);
    expect(quarry.trees.length).toBeLessThan(camp.trees.length / 2);
    const stones = (map: TerrainMap) => map.decorations.filter(item => item.sprite.startsWith('pebbles')).length;
    expect(stones(quarry)).toBeGreaterThanOrEqual(2 * stones(camp));
  });
});

describe('the shown terrain through the year', () => {
  it('is redrawn for each season as well as each area', () => {
    expect(shownTerrainKey(createGame())).toBe('camp-autumn');
    expect(shownTerrainKey({ ...createGame(), day: 11, area: 'quarry' })).toBe('quarry-winter');
  });
});

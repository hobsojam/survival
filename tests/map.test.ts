import { describe, expect, it } from 'vitest';
import { BALANCE, SITES, createGame } from '../src/game/state';
import { terrainSprites } from '../src/art/terrain';
import { buildMap, shownTerrainKey, terrainKey, type TerrainMap } from '../src/scene/map';
import { CAMP_EXIT, QUARRY_EXIT, QUARRY_SITE, RUBBLE_SITE } from '../src/game/areas';
import { CLEARING_STEPS, STEP_IDS, clearingReach, inClearing, type ClearingState, type StepId } from '../src/game/clearing';
import { CAMP_CENTER_X, CAMP_CENTER_Y, CAMP_OPEN_PATHS, CAMP_SIGN, QUARRY_PATHS, QUARRY_SIGN, pathDistance as routeDistance } from '../src/scene/mapGeometry';

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
    // The scene draws the choppable trees itself, so the map only needs to hold them where it leaves room for a step's trees.
    const stepSpots = STEP_IDS.flatMap(id => CLEARING_STEPS[id].trees);
    for (const target of createGame().trees) {
      expect(map.trees).toContainEqual({ x: target.x, y: target.y, sprite: target.sprite });
    }
    for (const site of Object.values(SITES)) {
      expect(map.trees.every(tree => Math.hypot(tree.x - site.x, tree.y - site.y) >= 1.5)).toBe(true);
    }
    expect(buildMap(nodes, 'camp')).toEqual(map);
    expect(map.trees.length).toBeGreaterThan(50);
    for (const tree of map.trees) {
      if (stepSpots.some(spot => spot.x === tree.x && spot.y === tree.y)) continue; // these stand just past the old edge, where the steps put them
      expect(Math.hypot(tree.x - BALANCE.campX, tree.y - BALANCE.campY)).toBeGreaterThan(BALANCE.campRadius + 1);
      expect(nodes.every(node => Math.hypot(tree.x - node.x, tree.y - node.y) >= (node.kind === 'branch' ? 1.5 : 3.5))).toBe(true);
    }
  });

  it('places fallen branches beside trees while keeping starter wood near camp', () => {
    const branches = nodes.filter(node => node.kind === 'branch');
    const trees = buildMap(nodes, 'camp').trees;
    // Every pile lies under a tree it could have dropped from, the starter piles round the clearing's edge.
    for (const branch of branches) expect(trees.some(tree => Math.hypot(tree.x - branch.x, tree.y - branch.y) <= 2.5), branch.id).toBe(true);
    const nearCamp = branches.filter(branch => Math.hypot(branch.x - BALANCE.campX, branch.y - BALANCE.campY) <= 6.5);
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
          if (/^(earth|path)/.test(visibleGround(map, x, y, px, py) ?? '')) {
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
        expect(visibleGround(map, tileX, tileY, pixelX, pixelY), `path gap at ${worldX},${worldY}`).toMatch(/^(earth|path)/);
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
    // Two west-near trees cannot clear the path: the fiber, berries and diagonal paths leave the near ring no room for four.
    const crowded = CLEARING_STEPS['west-near'].trees.slice(1, 3);
    for (const tree of open.trees.filter(item => !crowded.some(spot => spot.x === item.x && spot.y === item.y))) {
      const x = tree.x + .5, y = tree.y + .5, dx = endX - centerX, dy = endY - centerY;
      const t = Math.max(0, Math.min(1, ((x - centerX) * dx + (y - centerY) * dy) / (dx * dx + dy * dy)));
      expect(Math.hypot(x - centerX - t * dx, y - centerY - t * dy), `tree at ${tree.x},${tree.y}`).toBeGreaterThanOrEqual(1.35);
    }
  });

  it('the quarry map is rocky and wooded, not a second meadow', () => {
    const camp = buildMap(nodes, 'camp');
    const quarry = buildMap([], 'quarry');
    expect(quarry.campEdges).toEqual([]);
    expect(quarry.trees.length).toBeLessThan(camp.trees.length);
    const stones = (map: TerrainMap) => map.decorations.filter(item => item.sprite.startsWith('pebbles')).length;
    expect(stones(quarry)).toBeGreaterThanOrEqual(2 * stones(camp));
    expect(quarry.decorations.filter(item => item.sprite.startsWith('boulder')).length).toBeGreaterThanOrEqual(6);
  });
});

describe('the quarry scenery', () => {
  const nodes = createGame().nodes;
  const quarry = buildMap([], 'quarry');
  const clearOf = (x: number, y: number, spot: { x: number; y: number }) => Math.hypot(x - spot.x, y - spot.y);

  it('rings the quarry with trees on every side', () => {
    const edge = (test: (tree: { x: number; y: number }) => boolean) => quarry.trees.filter(test).length;
    expect(edge(tree => tree.x <= 1)).toBeGreaterThanOrEqual(10);
    expect(edge(tree => tree.x >= BALANCE.mapWidth - 2)).toBeGreaterThanOrEqual(10);
    expect(edge(tree => tree.y <= 1)).toBeGreaterThanOrEqual(15);
    expect(edge(tree => tree.y >= BALANCE.mapHeight - 2)).toBeGreaterThanOrEqual(15);
  });

  it('plants small clumps of trees out in the open ground', () => {
    const inland = quarry.trees.filter(tree => Math.min(tree.x, tree.y, BALANCE.mapWidth - 1 - tree.x, BALANCE.mapHeight - 1 - tree.y) >= 3);
    expect(inland.length).toBeGreaterThanOrEqual(10);
    // Some of them stand where the survivor first arrives, by the east edge.
    expect(inland.some(tree => tree.x >= 26)).toBe(true);
  });

  it('wears a path from the quarry face to the way home', () => {
    expect(quarry.pathTiles.some(item => item.x === QUARRY_EXIT.x && Math.abs(item.y - QUARRY_EXIT.y) <= 1)).toBe(true);
    expect(quarry.pathTiles.some(item => clearOf(item.x, item.y, QUARRY_SITE) <= 3)).toBe(true);
    // The path is unbroken: every tile has a neighbour on it.
    const on = new Set(quarry.pathTiles.map(item => `${item.x},${item.y}`));
    expect(quarry.pathTiles.every(item => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => on.has(`${item.x + dx},${item.y + dy}`)))).toBe(true);
  });

  it('lays the path over grass, so it stands out from the bare earth', () => {
    for (const item of quarry.pathTiles) expect(quarry.ground[item.y][item.x], `${item.x},${item.y}`).toMatch(/^grass/);
  });

  it('keeps old stumps few, so the quarry does not look logged', () => {
    expect(quarry.decorations.filter(item => item.sprite === 'stump').length).toBeLessThanOrEqual(4);
  });

  it('keeps trees and boulders off the path, the exit and the quarry workings', () => {
    const boulders = quarry.decorations.filter(item => item.sprite.startsWith('boulder'));
    for (const item of [...quarry.trees, ...boulders]) {
      const where = `${item.sprite} at ${item.x},${item.y}`;
      expect(routeDistance(item.x + .5, item.y + .5, QUARRY_PATHS), where).toBeGreaterThanOrEqual(1.35);
      expect(Math.abs(item.y - QUARRY_EXIT.y) > 2 || item.x < QUARRY_EXIT.x - 3, where).toBe(true);
      for (const site of [QUARRY_SITE, RUBBLE_SITE]) expect(clearOf(item.x, item.y, site), where).toBeGreaterThanOrEqual(2.5);
    }
    for (const tree of quarry.trees) for (const boulder of boulders)
      expect(clearOf(tree.x, tree.y, boulder), `tree ${tree.x},${tree.y}`).toBeGreaterThanOrEqual(1.2);
  });

  it('signposts the way home beside the exit, with nothing standing on it', () => {
    expect(quarry.signs).toEqual([{ ...QUARRY_SIGN, sprite: 'signpostCamp' }]);
    expect(routeDistance(QUARRY_SIGN.x + .5, QUARRY_SIGN.y + .5, QUARRY_PATHS)).toBeGreaterThanOrEqual(1);
    expect(QUARRY_EXIT.x - QUARRY_SIGN.x).toBeLessThanOrEqual(3);
    for (const item of [...quarry.trees, ...quarry.decorations]) expect(clearOf(item.x, item.y, QUARRY_SIGN), `${item.sprite} at ${item.x},${item.y}`).toBeGreaterThanOrEqual(1.5);
  });

  it('signposts the west path at camp only once it is open', () => {
    expect(buildMap(nodes, 'camp').signs).toEqual([]);
    const open = buildMap(nodes, 'camp-open');
    expect(open.signs).toEqual([{ ...CAMP_SIGN, sprite: 'signpostQuarry' }]);
    expect(routeDistance(CAMP_SIGN.x + .5, CAMP_SIGN.y + .5, CAMP_OPEN_PATHS)).toBeGreaterThanOrEqual(1);
    for (const item of [...open.trees, ...open.decorations]) expect(clearOf(item.x, item.y, CAMP_SIGN), `${item.sprite} at ${item.x},${item.y}`).toBeGreaterThanOrEqual(1.5);
    for (const node of nodes) expect(clearOf(node.x, node.y, CAMP_SIGN)).toBeGreaterThanOrEqual(1.5);
  });

  it('draws the signposts and boulders as real sprites', () => {
    for (const name of ['signpostCamp', 'signpostQuarry', 'boulder0', 'boulder1']) expect(terrainSprites[name], name).toBeDefined();
  });
});

describe('the shown terrain through the year', () => {
  it('is redrawn for each season as well as each area', () => {
    expect(shownTerrainKey(createGame())).toBe('camp-none-unmarked-autumn');
    expect(shownTerrainKey({ ...createGame(), day: 11, area: 'quarry' })).toBe('quarry-none-unmarked-winter');
  });

  it('is redrawn when ground is cleared or a side is marked', () => {
    const state = createGame();
    const keys = [
      shownTerrainKey(state),
      shownTerrainKey({ ...state, clearing: { ...state.clearing, marked: 'north-near' } }),
      shownTerrainKey({ ...state, clearing: { ...state.clearing, marked: 'east-near' } }),
      shownTerrainKey({ ...state, clearing: { cleared: ['north-near'], marked: null, felled: [] } }),
      shownTerrainKey({ ...state, clearing: { cleared: ['north-near', 'north-far'], marked: null, felled: [] } })
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('the grown clearing', () => {
  const nodes = createGame().nodes;
  const none: ClearingState = { cleared: [], marked: null, felled: [] };
  const grown = (cleared: StepId[], marked: StepId | null = null): ClearingState => ({ cleared, marked, felled: [] });
  const farCleared = [...STEP_IDS];

  /** The camp circle as it was drawn before the clearing could grow, pixel by pixel. */
  function oldCircle(dx: number, dy: number): string[] | 'full' | null {
    const radius = BALANCE.campRadius * 16;
    const rows = Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => '.'));
    let filled = 0;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const distanceSquared = (dx * 16 + x - 8) ** 2 + (dy * 16 + y - 8) ** 2;
      if (distanceSquared > radius ** 2) continue;
      rows[y][x] = distanceSquared >= (radius - 2) ** 2 ? 'e' : 'g';
      filled++;
    }
    if (filled === 0) return null;
    return filled === 256 ? 'full' : rows.map(row => row.join(''));
  }

  it('looks just as it did when nothing is cleared', () => {
    const map = buildMap(nodes, 'camp', 'summer', none);
    const edges = new Map(map.campEdges.map(edge => [`${edge.x},${edge.y}`, terrainSprites[edge.sprite].frames.still]));
    let expectedEdges = 0;
    for (let y = 0; y < BALANCE.mapHeight; y++) for (let x = 0; x < BALANCE.mapWidth; x++) {
      const old = oldCircle(x - BALANCE.campX, y - BALANCE.campY);
      expect(map.ground[y][x].startsWith('earth'), `ground at ${x},${y}`).toBe(old === 'full');
      if (old === null || old === 'full') { expect(edges.has(`${x},${y}`), `edge at ${x},${y}`).toBe(false); continue; }
      expectedEdges++;
      expect(edges.get(`${x},${y}`), `edge at ${x},${y}`).toEqual(old);
    }
    expect(edges.size).toBe(expectedEdges);
    const radius = BALANCE.campRadius;
    const oldStones = Array.from({ length: 26 }, (_, i) => ({ x: CAMP_CENTER_X + Math.cos(i * Math.PI * 2 / 26) * radius, y: CAMP_CENTER_Y + Math.sin(i * Math.PI * 2 / 26) * radius, sprite: `rimStone${i % 2}` }));
    expect(map.rimStones.every(stone => oldStones.some(old => old.x === stone.x && old.y === stone.y && old.sprite === stone.sprite))).toBe(true);
    expect(map.rimStones).toHaveLength(20);
    expect(buildMap(nodes, 'camp')).toEqual(map);
  });

  it('makes the ground earth where the north near step reaches', () => {
    const map = buildMap(nodes, 'camp', 'summer', grown(['north-near']));
    // Row 9 is an edge tile: its ground is grass with the earth edge laid over it.
    expect(visibleGround(map, 20, 9)).toMatch(/^earth/);
    expect(visibleGround(buildMap(nodes, 'camp'), 20, 9)).not.toMatch(/^earth/);
    expect(visibleGround(map, BALANCE.campX + 6, BALANCE.campY)).not.toMatch(/^earth/);
    expect(map.campEdges.length).toBeGreaterThan(0);
  });

  it('shares one sprite between identical edge tiles', () => {
    const map = buildMap(nodes, 'camp', 'summer', grown(farCleared));
    const names = new Set(map.campEdges.map(edge => edge.sprite));
    expect(names.size).toBeLessThan(map.campEdges.length);
    for (const name of names) expect(terrainSprites[name]).toBeDefined();
  });

  it('rings the grown edge with rim stones', () => {
    for (const cleared of [['north-near'], ['north-near', 'north-far', 'east-near'], farCleared] as StepId[][]) {
      const stones = buildMap(nodes, 'camp', 'summer', grown(cleared)).rimStones;
      expect(stones.length).toBeGreaterThanOrEqual(16);
      for (const stone of stones) {
        const dx = stone.x - CAMP_CENTER_X, dy = stone.y - CAMP_CENTER_Y;
        const reach = clearingReach(BALANCE.campX + dx, BALANCE.campY + dy, cleared);
        expect(Math.abs(Math.hypot(dx, dy) - reach)).toBeLessThan(.6);
      }
    }
  });

  it('keeps grove trees out of the clearing and off the trees still to fell', () => {
    for (const cleared of [[], ['north-near'], ['east-near', 'east-far'], farCleared] as StepId[][]) {
      const map = buildMap(nodes, 'camp', 'summer', grown(cleared));
      const standing = STEP_IDS.filter(id => !cleared.includes(id)).flatMap(id => CLEARING_STEPS[id].trees);
      for (const tree of map.groves.flat()) {
        expect(inClearing(tree.x, tree.y, cleared), `grove tree at ${tree.x},${tree.y}`).toBe(false);
        for (const marked of standing) expect(Math.hypot(tree.x - marked.x, tree.y - marked.y)).toBeGreaterThanOrEqual(1.2);
      }
    }
  });

  it('plants the trees of every step not yet cleared, but leaves out the marked step', () => {
    const map = buildMap(nodes, 'camp', 'summer', grown(['north-near'], 'east-near'));
    for (const id of STEP_IDS) {
      if (id === 'north-near' || id === 'east-near') continue;
      for (const tree of CLEARING_STEPS[id].trees) expect(map.trees, `${id} tree`).toContainEqual({ x: tree.x, y: tree.y, sprite: tree.sprite });
    }
    for (const tree of CLEARING_STEPS['east-near'].trees) expect(map.trees.some(item => item.x === tree.x && item.y === tree.y)).toBe(false);
    for (const tree of CLEARING_STEPS['north-near'].trees) expect(map.trees.some(item => item.x === tree.x && item.y === tree.y)).toBe(false);
  });
});

describe('seasonal flowers', () => {
  const nodes = createGame().nodes;
  const flowers = (map: TerrainMap) => map.decorations.filter(item => item.sprite.startsWith('flower'));
  const key = (item: { x: number; y: number }) => `${item.x},${item.y}`;

  it('scatters more flowers across the meadow in spring and none in the snow', () => {
    const summer = buildMap(nodes, 'camp', 'summer');
    const spring = buildMap(nodes, 'camp', 'spring');
    expect(flowers(spring).length).toBeGreaterThanOrEqual(flowers(summer).length * 1.5);
    const springSpots = new Set(flowers(spring).map(key));
    expect(flowers(summer).every(item => springSpots.has(key(item)))).toBe(true);
    expect(flowers(buildMap(nodes, 'camp', 'winter'))).toHaveLength(0);
    expect(buildMap(nodes, 'camp')).toEqual(summer);
  });

  it('keeps spring flowers off the paths, the camp circle and the nodes', () => {
    const spring = buildMap(nodes, 'camp', 'spring');
    // Like every decoration, a flower may share a tile with a path's edge, but sits no nearer the path than the summer ones do.
    const nearest = Math.min(...buildMap(nodes, 'camp', 'summer').decorations.map(item => pathDistance(item.x + .5, item.y + .5)));
    for (const item of flowers(spring)) {
      expect(pathDistance(item.x + .5, item.y + .5), key(item)).toBeGreaterThanOrEqual(nearest);
      expect(Math.hypot(item.x - BALANCE.campX, item.y - BALANCE.campY)).toBeGreaterThan(BALANCE.campRadius);
      expect(nodes.every(node => Math.hypot(item.x - node.x, item.y - node.y) >= 1)).toBe(true);
    }
  });
});

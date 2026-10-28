import { BALANCE, type GameState, type ResourceNode } from '../game/state';
import { season, type Season } from '../game/calendar';
import { QUARRY_EXIT, QUARRY_SITE, RUBBLE_SITE, pathOpen } from '../game/areas';
import { campCircleTile, pathTile, terrainSprites } from '../art/terrain';
import { CAMP_CENTER_X, CAMP_CENTER_Y, CAMP_OPEN_PATHS, CAMP_PATHS, CAMP_SIGN, QUARRY_PATHS, QUARRY_SIGN, pathDistance, type PathRoute } from './mapGeometry';

export interface MapItem { x: number; y: number; sprite: string }
export interface TerrainMap { ground: string[][]; pathTiles: MapItem[]; campEdges: MapItem[]; decorations: MapItem[]; rimStones: MapItem[]; trees: MapItem[]; groves: MapItem[][];
  /** Signposts, drawn standing like the trees. */
  signs: MapItem[] }

export type TerrainKey = 'camp' | 'camp-open' | 'quarry';

/** Which terrain the scene should show: the quarry, or the camp with or without its west path. */
export function terrainKey(state: GameState): TerrainKey {
  if (state.area === 'quarry') return 'quarry';
  return pathOpen(state) ? 'camp-open' : 'camp';
}

/** The terrain the scene has drawn: it is redrawn when the area, the west path or the season changes. */
export function shownTerrainKey(state: GameState): string {
  return `${terrainKey(state)}-${season(state.day)}`;
}

const ROUTES: Record<Exclude<TerrainKey, 'quarry'>, readonly PathRoute[]> = { camp: CAMP_PATHS, 'camp-open': CAMP_OPEN_PATHS };

function hash(x: number, y: number, salt = 0): number {
  let n = Math.imul(x + salt * 31, 374761393) + Math.imul(y - salt * 17, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}

const flowerPatches = [[11, 8], [30, 7], [7, 23], [28, 23]];
function earthAt(x: number, y: number, routes: readonly PathRoute[]): boolean {
  return Math.hypot(x - CAMP_CENTER_X, y - CAMP_CENTER_Y) <= BALANCE.campRadius || pathDistance(x, y, routes) <= .5;
}
const nearSign = (x: number, y: number, sign: { x: number; y: number }): boolean => Math.hypot(x - sign.x, y - sign.y) < 1.5;
function clearForTree(x: number, y: number, nodes: ResourceNode[], routes: readonly PathRoute[]): boolean {
  return Math.hypot(x - BALANCE.campX, y - BALANCE.campY) > BALANCE.campRadius + 1 && !nearSign(x, y, CAMP_SIGN) &&
    nodes.every(node => Math.hypot(x - node.x, y - node.y) >= (node.kind === 'branch' ? 1.5 : 3.5)) &&
    pathDistance(x + .5, y + .5, routes) >= 1.35;
}

function stoneClearsPaths(item: MapItem, routes: readonly PathRoute[]): boolean {
  const stone = terrainSprites[item.sprite];
  const left = Math.round(item.x * 16 - stone.anchor[0]);
  const top = Math.round(item.y * 16 - stone.anchor[1]);
  for (let y = 0; y < stone.size[1]; y++) for (let x = 0; x < stone.size[0]; x++) {
    if (stone.frames.still[y][x] === '.') continue;
    if (pathDistance((left + x + .5) / 16, (top + y + .5) / 16, routes) < .55) return false;
  }
  return true;
}

/** Smooth hash noise in [0, 1) over four-tile cells, so earth gathers in patches rather than speckles. */
function patchNoise(x: number, y: number): number {
  const cellX = Math.floor(x / 4), cellY = Math.floor(y / 4), u = (x % 4) / 4, v = (y % 4) / 4;
  const corner = (cx: number, cy: number) => (hash(cx, cy, 8) % 1000) / 1000;
  const top = corner(cellX, cellY) * (1 - u) + corner(cellX + 1, cellY) * u;
  const bottom = corner(cellX, cellY + 1) * (1 - u) + corner(cellX + 1, cellY + 1) * u;
  return top * (1 - v) + bottom * v;
}

const TREE_SPRITES = ['treeBroadleaf', 'treePine', 'treeYoung'];
const edgeDistance = (x: number, y: number): number => Math.min(x, y, BALANCE.mapWidth - 1 - x, BALANCE.mapHeight - 1 - y);
const emptyMap = (): TerrainMap => ({ ground: [], pathTiles: [], campEdges: [], decorations: [], rimStones: [], trees: [], groves: [], signs: [] });

/** Boulders sit about the quarry's open ground; clumps of trees stand between them. */
const QUARRY_BOULDERS = [[20, 9], [27, 11], [33, 19], [24, 20], [9, 17], [18, 25], [35, 7], [6, 8], [29, 26], [14, 5]];
const QUARRY_CLUMPS = [[30, 8], [33, 23], [22, 5], [7, 24], [22, 22], [27, 17]];
const CLUMP_OFFSETS = [[0, 0], [1, 0], [0, 1], [-1, 1], [1, 1], [-1, 0], [0, -1]];

/** Whether a quarry spot is free for something standing: off the path, out of the way home and clear of the workings and the sign. */
function quarryClear(x: number, y: number): boolean {
  const workings = [QUARRY_SITE, RUBBLE_SITE].every(site => Math.hypot(x - site.x, y - site.y) >= 2.5);
  const exit = Math.abs(y - QUARRY_EXIT.y) > 2 || x < QUARRY_EXIT.x - 3;
  return workings && exit && !nearSign(x, y, QUARRY_SIGN) && pathDistance(x + .5, y + .5, QUARRY_PATHS) >= 1.35;
}

/** The quarry: mixed earth and grass, boulders and scattered stones, a worn path home and woods all round. */
function buildQuarryMap(): TerrainMap {
  const map = emptyMap();
  const boulders = QUARRY_BOULDERS.filter(([x, y]) => quarryClear(x, y))
    .map(([x, y]) => ({ x, y, sprite: `boulder${hash(x, y, 11) % 2}` }));
  const taken = (x: number, y: number) => [...boulders, ...map.trees].some(item => Math.hypot(item.x - x, item.y - y) < 1.2);
  for (let y = 0; y < BALANCE.mapHeight; y++) {
    const row: string[] = [];
    for (let x = 0; x < BALANCE.mapWidth; x++) row.push(layQuarryTile(x, y, map, boulders));
    map.ground.push(row);
  }
  map.trees = map.trees.filter(tree => quarryClear(tree.x, tree.y) && !boulders.some(item => Math.hypot(item.x - tree.x, item.y - tree.y) < 1.2));
  for (const [cx, cy] of QUARRY_CLUMPS) {
    const clump = CLUMP_OFFSETS.filter((_, index) => index < 3 || hash(cx, cy, 12 + index) % 2 === 0)
      .map(([dx, dy]) => ({ x: cx + dx, y: cy + dy }))
      .filter(({ x, y }) => quarryClear(x, y) && !taken(x, y));
    map.trees.push(...clump.map(({ x, y }) => ({ x, y, sprite: TREE_SPRITES[hash(x, y, 3) % 3] })));
  }
  // Nothing lies flat under a clump's trunks; the boulders go in last, among the stones.
  map.decorations = [...map.decorations.filter(item => !taken(item.x, item.y)), ...boulders];
  map.signs = [{ ...QUARRY_SIGN, sprite: 'signpostCamp' }];
  return map;
}

/** Adds one quarry tile's path, border tree or decoration to the map and returns its ground sprite. */
function layQuarryTile(x: number, y: number, map: TerrainMap, boulders: readonly MapItem[]): string {
  const path = pathTile(x, y, QUARRY_PATHS);
  if (path) map.pathTiles.push({ x, y, sprite: path });
  const edge = edgeDistance(x, y);
  const open = !path && !nearSign(x, y, QUARRY_SIGN) && boulders.every(item => Math.hypot(item.x - x, item.y - y) >= 1.2)
    && [QUARRY_SITE, RUBBLE_SITE].every(site => Math.hypot(x - site.x, y - site.y) >= 1.5);
  // The woods close in two deep on every side, thinning on the inner row.
  if (edge <= 1 && hash(x, y, 2) % (edge === 0 ? 4 : 2) !== 0) {
    map.trees.push({ x, y, sprite: TREE_SPRITES[hash(x, y, 3) % 3] });
  } else if (edge > 0 && open && hash(x, y, 4) % 4 === 0) {
    map.decorations.push({ x, y, sprite: quarryDetail(x, y) });
  }
  // Bare earth lies in patches that grow commoner toward the quarry in the west; the path keeps to grass so it shows.
  const bare = !path && patchNoise(x, y) + (hash(x, y, 7) % 5) / 25 > .55 + x / BALANCE.mapWidth * .2;
  return bare ? `earth${hash(x, y, 1) % 3}` : `grass${hash(x, y) % 4}`;
}

/** Mostly loose stones, with a tuft of grass, an old stump or a ring of mushrooms here and there. */
function quarryDetail(x: number, y: number): string {
  const detail = hash(x, y, 5) % 40;
  if (detail === 0) return 'stump';
  if (detail < 3) return 'mushrooms';
  if (detail < 15) return `tuft${detail % 2}`;
  return `pebbles${detail % 2}`;
}

/** Builds an area's terrain. The camp meadow flowers more in spring, and its flowers are under the snow in winter. */
export function buildMap(nodes: ResourceNode[], key: TerrainKey, time: Season = 'summer'): TerrainMap {
  if (key === 'quarry') return buildQuarryMap();
  const routes = ROUTES[key];
  const map = emptyMap();
  for (let y = 0; y < BALANCE.mapHeight; y++) {
    const row: string[] = [];
    for (let x = 0; x < BALANCE.mapWidth; x++) row.push(layCampTile(x, y, nodes, routes, map, time === 'spring'));
    map.ground.push(row);
  }
  if (time === 'winter') map.decorations = map.decorations.filter(item => !item.sprite.startsWith('flower'));
  plantGroves(nodes, routes, map);
  map.rimStones = campRimStones(routes);
  map.decorations = map.decorations.filter(item => !nearSign(item.x, item.y, CAMP_SIGN));
  if (key === 'camp-open') map.signs = [{ ...CAMP_SIGN, sprite: 'signpostQuarry' }];
  return map;
}

/** Adds one camp tile's path, circle edge, tree or decoration to the map and returns its ground sprite. */
function layCampTile(x: number, y: number, nodes: ResourceNode[], routes: readonly PathRoute[], map: TerrainMap, spring: boolean): string {
  const circle = campCircleTile(x - BALANCE.campX, y - BALANCE.campY);
  const path = pathTile(x, y, routes);
  if (path && circle !== 'full') map.pathTiles.push({ x, y, sprite: path });
  if (circle && circle !== 'full') map.campEdges.push({ x, y, sprite: circle });
  const edge = edgeDistance(x, y);
  const borderTree = edge <= 2 && hash(x, y, 2) % 5 !== 0;
  if (borderTree && clearForTree(x, y, nodes, routes)) map.trees.push({ x, y, sprite: TREE_SPRITES[hash(x, y, 3) % 3] });
  else if (edge > 2 && !earthAt(x + .5, y + .5, routes)) {
    const sprite = campDecoration(x, y, nodes, routes) ?? (spring ? springFlower(x, y, nodes) : null);
    if (sprite) map.decorations.push({ x, y, sprite });
  }
  return circle === 'full' ? `earth${hash(x, y, 1) % 3}` : `grass${hash(x, y) % 4}`;
}

function campDecoration(x: number, y: number, nodes: ResourceNode[], routes: readonly PathRoute[]): string | null {
  const inPatch = flowerPatches.some(([px, py]) => Math.hypot(x - px, y - py) <= 2.5);
  if (inPatch && hash(x, y, 4) % 3 === 0 && nodes.every(node => Math.hypot(x - node.x, y - node.y) >= 1)) return `flower${hash(x, y, 5) % 3}`;
  if (hash(x, y, 4) % 9 !== 0) return null;
  const detail = hash(x, y, 5) % 17;
  const special = nodes.every(node => Math.hypot(x - node.x, y - node.y) >= 1.5) && clearForTree(x, y, nodes, routes);
  if (special && detail === 0) return 'stump';
  if (special && detail === 1) return 'mushrooms';
  return ['tuft0', 'tuft1', 'pebbles0', 'pebbles1', 'fallenLeaf'][detail % 5];
}

/** Spring scatters extra flowers across the open meadow, clear of the nodes. */
function springFlower(x: number, y: number, nodes: ResourceNode[]): string | null {
  if (hash(x, y, 6) % 5 !== 0 || nodes.some(node => Math.hypot(x - node.x, y - node.y) < 1)) return null;
  return `flower${hash(x, y, 5) % 3}`;
}

/** Preferred grove spots first, then a shuffled grid of fallbacks. */
function groveCenters(): number[][] {
  const preferredCenters = [[7, 6], [17, 6], [28, 5], [35, 12], [33, 24], [24, 26], [13, 25], [5, 17]];
  const fallbackCenters: number[][] = [];
  for (let y = 5; y < BALANCE.mapHeight - 4; y += 5) {
    for (let x = 5; x < BALANCE.mapWidth - 4; x += 5) fallbackCenters.push([x, y]);
  }
  fallbackCenters.sort(([ax, ay], [bx, by]) => hash(ax, ay, 9) - hash(bx, by, 9));
  return [...preferredCenters, ...fallbackCenters];
}

function plantGroves(nodes: ResourceNode[], routes: readonly PathRoute[], map: TerrainMap): void {
  const chosenCenters: number[][] = [];
  for (const [cx, cy] of groveCenters()) {
    if (map.groves.length === 8) break;
    if (chosenCenters.some(([x, y]) => Math.hypot(cx - x, cy - y) < 7)) continue;
    const grove = growGrove(cx, cy, nodes, routes, map.trees);
    if (grove.length < 3) continue;
    map.groves.push(grove);
    chosenCenters.push([cx, cy]);
    map.trees.push(...grove);
  }
}

function growGrove(cx: number, cy: number, nodes: ResourceNode[], routes: readonly PathRoute[], trees: MapItem[]): MapItem[] {
  const grove: MapItem[] = [];
  const inside = (x: number, y: number) => x >= 3 && x < BALANCE.mapWidth - 3 && y >= 3 && y < BALANCE.mapHeight - 3;
  for (let i = 0; i < 21 && grove.length < 7; i++) {
    const angle = i * 2.39996 + hash(cx, cy, 10) % 6, radius = 1 + (i % 3);
    const x = Math.round(cx + Math.cos(angle) * radius), y = Math.round(cy + Math.sin(angle) * radius);
    if (!inside(x, y) || !clearForTree(x, y, nodes, routes)) continue;
    if ([...trees, ...grove].some(tree => Math.hypot(tree.x - x, tree.y - y) < 1.2)) continue;
    grove.push({ x, y, sprite: TREE_SPRITES[hash(x, y, 6) % 3] });
  }
  return grove;
}

function campRimStones(routes: readonly PathRoute[]): MapItem[] {
  const rimStones: MapItem[] = [];
  for (let i = 0; i < 26; i++) {
    const angle = i * Math.PI * 2 / 26;
    const item = { x: CAMP_CENTER_X + Math.cos(angle) * BALANCE.campRadius,
      y: CAMP_CENTER_Y + Math.sin(angle) * BALANCE.campRadius, sprite: `rimStone${i % 2}` };
    if (stoneClearsPaths(item, routes)) rimStones.push(item);
  }
  return rimStones;
}

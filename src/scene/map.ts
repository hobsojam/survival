import { BALANCE, type ResourceNode } from '../game/state';
import { campCircleTile, pathTile, terrainSprites } from '../art/terrain';
import { CAMP_CENTER_X, CAMP_CENTER_Y, PATH_DESTINATIONS, distanceToPath, pathDistance } from './mapGeometry';

export interface MapItem { x: number; y: number; sprite: string }
export interface TerrainMap { ground: string[][]; pathTiles: MapItem[]; campEdges: MapItem[]; decorations: MapItem[]; rimStones: MapItem[]; trees: MapItem[]; groves: MapItem[][] }

function hash(x: number, y: number, salt = 0): number {
  let n = Math.imul(x + salt * 31, 374761393) + Math.imul(y - salt * 17, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}

const flowerPatches = [[11, 8], [30, 7], [7, 23], [28, 23]];
function earthAt(x: number, y: number): boolean {
  return Math.hypot(x - CAMP_CENTER_X, y - CAMP_CENTER_Y) <= BALANCE.campRadius || pathDistance(x, y) <= .5;
}
function clearForTree(x: number, y: number, nodes: ResourceNode[]): boolean {
  return Math.hypot(x - BALANCE.campX, y - BALANCE.campY) > BALANCE.campRadius + 1 &&
    nodes.every(node => Math.hypot(x - node.x, y - node.y) >= (node.kind === 'branch' ? 1.5 : 3.5)) &&
    PATH_DESTINATIONS.every(([dx, dy]) => distanceToPath(x + .5, y + .5, dx, dy) >= 1.35);
}

function stoneClearsPaths(item: MapItem): boolean {
  const stone = terrainSprites[item.sprite];
  const left = Math.round(item.x * 16 - stone.anchor[0]);
  const top = Math.round(item.y * 16 - stone.anchor[1]);
  for (let y = 0; y < stone.size[1]; y++) for (let x = 0; x < stone.size[0]; x++) {
    if (stone.frames.still[y][x] === '.') continue;
    if (pathDistance((left + x + .5) / 16, (top + y + .5) / 16) < .55) return false;
  }
  return true;
}

export function buildMap(nodes: ResourceNode[]): TerrainMap {
  const ground: string[][] = [];
  const pathTiles: MapItem[] = [], campEdges: MapItem[] = [], decorations: MapItem[] = [], rimStones: MapItem[] = [], trees: MapItem[] = [];
  for (let y = 0; y < BALANCE.mapHeight; y++) {
    const row: string[] = [];
    for (let x = 0; x < BALANCE.mapWidth; x++) {
      const circle = campCircleTile(x - BALANCE.campX, y - BALANCE.campY);
      row.push(circle === 'full' ? `earth${hash(x, y, 1) % 3}` : `grass${hash(x, y) % 4}`);
      const path = pathTile(x, y);
      if (path && circle !== 'full') pathTiles.push({ x, y, sprite: path });
      if (circle && circle !== 'full') campEdges.push({ x, y, sprite: circle });
      const edge = Math.min(x, y, BALANCE.mapWidth - 1 - x, BALANCE.mapHeight - 1 - y);
      const borderTree = edge <= 2 && hash(x, y, 2) % 5 !== 0;
      if (borderTree && clearForTree(x, y, nodes)) trees.push({ x, y, sprite: ['treeBroadleaf', 'treePine', 'treeYoung'][hash(x, y, 3) % 3] });
      else if (edge > 2 && !earthAt(x + .5, y + .5)) {
        const inPatch = flowerPatches.some(([px, py]) => Math.hypot(x - px, y - py) <= 2.5);
        if (inPatch && hash(x, y, 4) % 3 === 0 && nodes.every(node => Math.hypot(x - node.x, y - node.y) >= 1)) {
          decorations.push({ x, y, sprite: `flower${hash(x, y, 5) % 3}` });
        } else if (hash(x, y, 4) % 9 === 0) {
          const detail = hash(x, y, 5) % 17;
          const special = nodes.every(node => Math.hypot(x - node.x, y - node.y) >= 1.5) && clearForTree(x, y, nodes);
          const sprite = special && detail === 0 ? 'stump' : special && detail === 1 ? 'mushrooms'
            : ['tuft0', 'tuft1', 'pebbles0', 'pebbles1', 'fallenLeaf'][detail % 5];
          decorations.push({ x, y, sprite });
        }
      }
    }
    ground.push(row);
  }
  const groves: MapItem[][] = [];
  const preferredCenters = [[7, 6], [17, 6], [28, 5], [35, 12], [33, 24], [24, 26], [13, 25], [5, 17]];
  const fallbackCenters: number[][] = [];
  for (let y = 5; y < BALANCE.mapHeight - 4; y += 5) {
    for (let x = 5; x < BALANCE.mapWidth - 4; x += 5) fallbackCenters.push([x, y]);
  }
  fallbackCenters.sort(([ax, ay], [bx, by]) => hash(ax, ay, 9) - hash(bx, by, 9));
  const chosenCenters: number[][] = [];
  for (const [cx, cy] of [...preferredCenters, ...fallbackCenters]) {
    if (groves.length === 8) break;
    if (chosenCenters.some(([x, y]) => Math.hypot(cx - x, cy - y) < 7)) continue;
    const grove: MapItem[] = [];
    for (let i = 0; i < 21 && grove.length < 7; i++) {
      const angle = i * 2.39996 + hash(cx, cy, 10) % 6, radius = 1 + (i % 3);
      const x = Math.round(cx + Math.cos(angle) * radius), y = Math.round(cy + Math.sin(angle) * radius);
      if (x < 3 || x >= BALANCE.mapWidth - 3 || y < 3 || y >= BALANCE.mapHeight - 3 || !clearForTree(x, y, nodes)) continue;
      if ([...trees, ...grove].some(tree => Math.hypot(tree.x - x, tree.y - y) < 1.2)) continue;
      grove.push({ x, y, sprite: ['treeBroadleaf', 'treePine', 'treeYoung'][hash(x, y, 6) % 3] });
    }
    if (grove.length < 3) continue;
    groves.push(grove);
    chosenCenters.push([cx, cy]);
    trees.push(...grove);
  }
  for (let i = 0; i < 26; i++) {
    const angle = i * Math.PI * 2 / 26;
    const item = { x: CAMP_CENTER_X + Math.cos(angle) * BALANCE.campRadius,
      y: CAMP_CENTER_Y + Math.sin(angle) * BALANCE.campRadius, sprite: `rimStone${i % 2}` };
    if (stoneClearsPaths(item)) rimStones.push(item);
  }
  return { ground, pathTiles, campEdges, decorations, rimStones, trees, groves };
}

import { BALANCE, type ResourceNode } from '../game/state';

export interface MapItem { x: number; y: number; sprite: string }
export interface TerrainMap { ground: string[][]; decorations: MapItem[]; rimStones: MapItem[]; trees: MapItem[]; groves: MapItem[][]; rocks: MapItem[] }

function hash(x: number, y: number, salt = 0): number {
  let n = Math.imul(x + salt * 31, 374761393) + Math.imul(y - salt * 17, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}

const destinations = [[9, 9], [30, 9], [10, 21], [30, 21]];
const flowerPatches = [[11, 8], [30, 7], [7, 23], [28, 23]];
const campX = BALANCE.campX + .5, campY = BALANCE.campY + .5;
function distanceToPath(x: number, y: number, endX: number, endY: number): number {
  const dx = endX - campX, dy = endY - campY;
  const t = Math.max(0, Math.min(1, ((x - campX) * dx + (y - campY) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - campX - t * dx, y - campY - t * dy);
}
function earthAt(x: number, y: number): boolean {
  if (Math.hypot(x - campX, y - campY) <= BALANCE.campRadius) return true;
  return destinations.some(([dx, dy]) => distanceToPath(x, y, dx + .5, dy + .5) < .55);
}
function clearForTree(x: number, y: number, nodes: ResourceNode[]): boolean {
  return Math.hypot(x - BALANCE.campX, y - BALANCE.campY) > BALANCE.campRadius + 1 &&
    nodes.every(node => Math.hypot(x - node.x, y - node.y) >= 3.5) &&
    destinations.every(([dx, dy]) => distanceToPath(x + .5, y + .5, dx + .5, dy + .5) >= 1.35);
}

export function buildMap(nodes: ResourceNode[]): TerrainMap {
  const ground: string[][] = [];
  const decorations: MapItem[] = [], rimStones: MapItem[] = [], trees: MapItem[] = [], rocks: MapItem[] = [];
  for (let y = 0; y < BALANCE.mapHeight; y++) {
    const row: string[] = [];
    for (let x = 0; x < BALANCE.mapWidth; x++) {
      const mask = Number(earthAt(x, y)) | Number(earthAt(x + 1, y)) << 1 |
        Number(earthAt(x + 1, y + 1)) << 2 | Number(earthAt(x, y + 1)) << 3;
      row.push(mask === 0 ? `grass${hash(x, y) % 4}` : mask === 15 ? `earth${hash(x, y, 1) % 3}` : `transition${mask}`);
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
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI * 2 / 12;
    rimStones.push({ x: campX + Math.cos(angle) * BALANCE.campRadius, y: campY + Math.sin(angle) * BALANCE.campRadius,
      sprite: `rimStone${i % 2}` });
  }
  for (let i = 0; i < 12; i++) {
    const x = 3 + hash(i, 4, 7) % (BALANCE.mapWidth - 6), y = 3 + hash(i, 8, 8) % (BALANCE.mapHeight - 6);
    if (clearForTree(x, y, nodes)) rocks.push({ x, y, sprite: `rock${i % 2}` });
  }
  return { ground, decorations, rimStones, trees, groves, rocks };
}

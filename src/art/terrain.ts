import type { SpriteDef } from './sprites';
import type { PaletteKey } from './palette';
import { BALANCE } from '../game/state';
import { CLEARING_STEPS, STEP_IDS, clearingKey, clearingReach, type StepId } from '../game/clearing';
import { CAMP_OPEN_PATHS, CAMP_PATHS, QUARRY_PATHS, pathDistance, type PathRoute } from '../scene/mapGeometry';

type Grid = string[][];
const blank = (w: number, h: number, fill = '.'): Grid => Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
const dot = (g: Grid, x: number, y: number, c: string): void => { if (g[y]?.[x] !== undefined) g[y][x] = c; };
const rect = (g: Grid, x: number, y: number, w: number, h: number, c: string): void => {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) dot(g, i, j, c);
};
const ellipse = (g: Grid, cx: number, cy: number, rx: number, ry: number, c: string): void => {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
    if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) dot(g, x, y, c);
};
const sprite = (g: Grid, legend: Record<string, PaletteKey>, anchor?: [number, number]): SpriteDef => ({
  size: [g[0].length, g.length], anchor: anchor ?? [Math.floor(g[0].length / 2), g.length - 1],
  legend, frames: { still: g.map(row => row.join('')) }
});
const groundLegend = { a: 'grass1', b: 'grass2', c: 'grass3', d: 'grass4', e: 'earth0', f: 'earth1', g: 'earth2', h: 'earth3', i: 'earth4', s: 'stone2', t: 'stone3' } as const;

const pathLegend = { ...groundLegend, e: 'path0', f: 'path1', g: 'path2', h: 'path3', i: 'path4' } as const;

export const terrainSprites: Record<string, SpriteDef> = {};
for (let variant = 0; variant < 4; variant++) {
  const g = blank(16, 16, 'b');
  if (variant === 1) {
    dot(g, 5, 8, 'c'); dot(g, 6, 7, 'c'); dot(g, 7, 8, 'a');
    dot(g, 12, 12, 'c'); dot(g, 13, 11, 'c');
  } else if (variant === 2) {
    dot(g, 3, 12, 'c'); dot(g, 4, 11, 'c'); dot(g, 5, 12, 'a');
    dot(g, 10, 5, 'c'); dot(g, 11, 4, 'c'); dot(g, 12, 5, 'a');
  } else if (variant === 3) {
    ellipse(g, 8, 8, 4, 3, 'a');
    ellipse(g, 7, 7, 2, 1, 'b');
  }
  terrainSprites[`grass${variant}`] = sprite(g, groundLegend);
}
for (let variant = 0; variant < 3; variant++) {
  const g = blank(16, 16, 'g');
  if (variant === 1) { rect(g, 4, 5, 2, 1, 'h'); rect(g, 10, 11, 2, 1, 'f'); dot(g, 11, 10, 's'); }
  if (variant === 2) { rect(g, 3, 7, 3, 1, 'f'); rect(g, 9, 11, 3, 1, 'f'); dot(g, 4, 6, 'h'); dot(g, 10, 10, 'h'); }
  terrainSprites[`earth${variant}`] = sprite(g, groundLegend);
}
// Corner bits are TL, TR, BR, BL. Interpolation keeps shared tile edges identical.
for (let mask = 0; mask < 16; mask++) {
  const g = blank(16, 16, 'b');
  const corners = [mask & 1, (mask >> 1) & 1, (mask >> 2) & 1, (mask >> 3) & 1];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const u = x / 15, v = y / 15;
    const value = corners[0] * (1 - u) * (1 - v) + corners[1] * u * (1 - v) + corners[2] * u * v + corners[3] * (1 - u) * v;
    g[y][x] = value >= 0.5 ? 'g' : 'b';
  }
  const earth = g.map(row => row.map(c => c === 'g'));
  for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++)
    if (earth[y][x] && (!earth[y - 1][x] || !earth[y + 1][x] || !earth[y][x - 1] || !earth[y][x + 1])) g[y][x] = 'e';
  terrainSprites[`transition${mask}`] = sprite(g, groundLegend);
}

/** Terrain sprites made after start-up are also added to each sprite table that mirrors this one. */
const mirrors: Record<string, SpriteDef>[] = [];
export function mirrorTerrainSprites(target: Record<string, SpriteDef>): void {
  Object.assign(target, terrainSprites);
  mirrors.push(target);
}
function addTerrainSprite(name: string, def: SpriteDef): void {
  terrainSprites[name] = def;
  for (const target of mirrors) target[name] = def;
}

/** The farthest the clearing can reach from the fire, in tiles, with room for the tile that holds the edge. */
const MAX_REACH = Math.max(...STEP_IDS.map(id => CLEARING_STEPS[id].reach));
const EDGE_TILES = Math.ceil(MAX_REACH) + 1;

/** Clearing tiles per set of cleared steps, memoised: the offset from the fire's tile maps to 'full' or an edge sprite's name. */
const clearingTileSets = new Map<string, Map<string, string>>();
const clearingSprites = new Map<string, string>();
function clearingTiles(cleared: readonly StepId[]): Map<string, string> {
  const key = clearingKey(cleared);
  const cached = clearingTileSets.get(key);
  if (cached) return cached;
  const tiles = new Map<string, string>();
  const innerRadius = (BALANCE.campRadius - 2) * 16 - 12;
  for (let dy = -EDGE_TILES; dy <= EDGE_TILES; dy++) {
    for (let dx = -EDGE_TILES; dx <= EDGE_TILES; dx++) {
      const middle = Math.hypot(dx * 16, dy * 16);
      if (middle > MAX_REACH * 16 + 12) continue;
      if (middle < innerRadius) { tiles.set(`${dx},${dy}`, 'full'); continue; }
      const g = clearingTileGrid(dx, dy, cleared);
      if (g) tiles.set(`${dx},${dy}`, g === 'full' ? 'full' : clearingSpriteFor(g));
    }
  }
  clearingTileSets.set(key, tiles);
  return tiles;
}

/** The earth pixels on one tile, a 2-pixel rim of lighter earth inside the clearing's edge; null when none, 'full' when solid. */
function clearingTileGrid(dx: number, dy: number, cleared: readonly StepId[]): Grid | 'full' | null {
  const g = blank(16, 16);
  let filled = 0;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const offsetX = dx * 16 + x - 8, offsetY = dy * 16 + y - 8;
    const reach = clearingReach(BALANCE.campX + offsetX / 16, BALANCE.campY + offsetY / 16, cleared) * 16;
    const distanceSquared = offsetX ** 2 + offsetY ** 2;
    if (distanceSquared > reach ** 2) continue;
    g[y][x] = distanceSquared >= (reach - 2) ** 2 ? 'e' : 'g';
    filled++;
  }
  if (filled === 256) return 'full';
  return filled ? g : null;
}

function clearingSpriteFor(g: Grid): string {
  const shape = g.map(row => row.join('')).join('/');
  let name = clearingSprites.get(shape);
  if (!name) {
    name = `clearingEdge${clearingSprites.size}`;
    addTerrainSprite(name, sprite(g, { e: 'earth0', g: 'earth2' }));
    clearingSprites.set(shape, name);
  }
  return name;
}
// The ring round the fire is made up front; wider clearings make their edge tiles when first drawn.
clearingTiles([]);

/** The clearing's tile at an offset from the fire's tile: 'full' for solid earth, an edge sprite's name, or nothing. */
export function clearingTile(dx: number, dy: number, cleared: readonly StepId[]): string | undefined {
  return clearingTiles(cleared).get(`${dx},${dy}`);
}

/** Path tiles per route list, memoised; identical tiles share one sprite. */
const pathTileSets = new Map<string, Map<string, string>>();
const pathSprites = new Map<string, string>();
function pathTiles(destinations: readonly PathRoute[]): Map<string, string> {
  const key = JSON.stringify(destinations);
  const cached = pathTileSets.get(key);
  if (cached) return cached;
  const tiles = new Map<string, string>();
  for (let y = 0; y < BALANCE.mapHeight; y++) for (let x = 0; x < BALANCE.mapWidth; x++) {
    const g = pathTileGrid(x, y, destinations);
    if (g) tiles.set(`${x},${y}`, pathSpriteFor(g));
  }
  pathTileSets.set(key, tiles);
  return tiles;
}

/** The path pixels on one tile, or null when no path crosses it. */
function pathTileGrid(x: number, y: number, destinations: readonly PathRoute[]): Grid | null {
  if (pathDistance(x + .5, y + .5, destinations) > 1.25) return null;
  const g = blank(16, 16);
  let filled = 0;
  for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
    const distance = pathDistance(x + (px + .5) / 16, y + (py + .5) / 16, destinations);
    if (distance > .5) continue;
    g[py][px] = distance >= .44 ? 'e' : 'g';
    filled++;
  }
  return filled ? g : null;
}

function pathSpriteFor(g: Grid): string {
  const shape = g.map(row => row.join('')).join('/');
  let name = pathSprites.get(shape);
  if (!name) {
    name = `pathTile${pathSprites.size}`;
    terrainSprites[name] = sprite(g, pathLegend);
    pathSprites.set(shape, name);
  }
  return name;
}
// Build every area's paths up front so their sprites are registered as textures with the rest.
for (const routes of [CAMP_PATHS, CAMP_OPEN_PATHS, QUARRY_PATHS]) pathTiles(routes);

export function pathTile(x: number, y: number, destinations: readonly PathRoute[]): string | undefined {
  return pathTiles(destinations).get(`${x},${y}`);
}

const decalLegend = { a: 'grass1', b: 'grass3', c: 'grass4', d: 'flower0', e: 'flower1', f: 'flower2', g: 'flower3', h: 'flower4', i: 'stone1', j: 'stone2', k: 'stone3', l: 'stone4', m: 'wood0', n: 'wood2', o: 'wood3', p: 'earth1', q: 'earth3', r: 'leaf2', s: 'leaf4', t: 'shadow', u: 'stone0' } as const;
function addDecal(name: string, draw: (g: Grid) => void, w = 8, h = 8): void {
  const g = blank(w, h); draw(g); terrainSprites[name] = sprite(g, decalLegend);
}
addDecal('tuft0', g => { rect(g, 2, 5, 5, 1, 'a'); dot(g, 3, 4, 'b'); dot(g, 4, 3, 'b'); dot(g, 5, 4, 'c'); });
addDecal('tuft1', g => { rect(g, 1, 6, 6, 1, 'a'); rect(g, 2, 4, 1, 2, 'b'); rect(g, 5, 3, 1, 3, 'b'); });
for (let i = 0; i < 3; i++) addDecal(`flower${i}`, g => {
  rect(g, 3, 4, 1, 3, 'a'); rect(g, 5, 5, 1, 2, 'a');
  dot(g, 3, 3, ['d', 'f', 'h'][i]); dot(g, 4, 3, 'e'); dot(g, 5, 4, ['g', 'e', 'f'][i]);
});
addDecal('pebbles0', g => { rect(g, 1, 5, 3, 2, 'j'); dot(g, 1, 5, 'k'); rect(g, 5, 4, 2, 2, 'i'); });
addDecal('pebbles1', g => { rect(g, 2, 4, 3, 2, 'j'); dot(g, 2, 4, 'k'); rect(g, 5, 6, 2, 1, 'i'); });
addDecal('stump', g => { ellipse(g, 8, 13, 5, 2, 't'); rect(g, 4, 6, 9, 7, 'm'); rect(g, 5, 5, 7, 5, 'n'); rect(g, 6, 5, 5, 2, 'o'); dot(g, 8, 6, 'p'); }, 16, 16);
addDecal('mushrooms', g => { rect(g, 2, 4, 1, 3, 'l'); rect(g, 5, 5, 1, 2, 'l'); rect(g, 1, 3, 3, 2, 'q'); rect(g, 4, 4, 3, 2, 'q'); });
addDecal('fallenLeaf', g => { rect(g, 2, 3, 4, 2, 'r'); rect(g, 3, 2, 2, 1, 's'); dot(g, 6, 5, 'r'); });
for (let i = 0; i < 2; i++) addDecal(`rimStone${i}`, g => {
  rect(g, 1, 6, 12, 4, 'u');
  rect(g, 2, i ? 4 : 5, 10, 5, 'u');
  rect(g, 2, 7, 10, 2, 'i');
  rect(g, 3, i ? 5 : 6, 8, 3, 'j');
  rect(g, 4, i ? 5 : 6, 6, 1, 'k');
  rect(g, i ? 6 : 4, i ? 4 : 5, 4, 1, 'l');
}, 14, 12);

const treeLegend = { a: 'leaf0', b: 'leaf1', c: 'leaf2', d: 'leaf3', e: 'leaf4', f: 'wood0', g: 'wood1', h: 'wood2', i: 'wood3', j: 'wood4', s: 'shadow' } as const;
const crownLegend = { ...treeLegend, a: 'crown0', b: 'crown1', c: 'crown2', d: 'crown3', e: 'crown4' } as const;
function tree(name: string, w: number, h: number, shape: 'broad' | 'pine' | 'young'): void {
  const g = blank(w, h), cx = Math.floor(w / 2);
  ellipse(g, cx + 1, h - 3, w * .32, 2, 's');
  rect(g, cx - 2, h - 17, 5, 14, 'f'); rect(g, cx - 1, h - 16, 2, 12, 'g');
  if (shape === 'pine') {
    for (let tier = 0; tier < 3; tier++) {
      const top = 2 + tier * 10, half = 6 + tier * 4;
      for (let y = top; y < top + 19; y++) {
        const radius = Math.min(half, Math.floor((y - top) * .75));
        rect(g, cx - radius, y, radius * 2 + 1, 1, y < top + 8 ? 'c' : 'b');
      }
    }
  } else {
    ellipse(g, cx, h * .44, w * .45, h * .32, 'a');
    ellipse(g, cx + 4, h * .5, w * .34, h * .23, 'b');
    ellipse(g, cx - 5, h * .39, w * .29, h * .2, 'c');
    ellipse(g, cx - 7, h * .3, w * .21, h * .12, 'd');
    ellipse(g, cx + 4, h * .27, w * .19, h * .1, 'd');
  }
  for (let i = 0; i < 8; i++) {
    const x = 3 + (i * 11) % (w - 6), y = 6 + (i * 13) % Math.floor(h * .55);
    if (g[y][x] === 'c' || g[y][x] === 'd') dot(g, x, y, 'e');
  }
  const def = sprite(g, shape === 'pine' ? treeLegend : crownLegend, [cx, h - 3]);
  if (shape !== 'young') {
    // A marked tree has a band of pale fibre tied twice round its trunk, below the crown.
    const marked = g.map(row => [...row]);
    rect(marked, cx - 3, h - 7, 7, 2, 'j');
    for (const x of [cx - 2, cx, cx + 2]) dot(marked, x, h - 6, 'i');
    def.frames.marked = marked.map(row => row.join(''));
  }
  terrainSprites[name] = def;
}
tree('treeBroadleaf', 32, 48, 'broad');
tree('treePine', 32, 48, 'pine');
tree('treeYoung', 24, 32, 'young');
const rockLegend = { a: 'stone0', b: 'stone1', c: 'stone2', d: 'stone3', e: 'stone4', s: 'shadow' } as const;
for (let i = 0; i < 2; i++) {
  const g = blank(16, 16);
  ellipse(g, 8, 13, 6, 2, 's');
  ellipse(g, 8, 10, i ? 5 : 6, i ? 4 : 5, 'a');
  ellipse(g, 7, 9, i ? 4 : 5, i ? 3 : 4, 'b');
  ellipse(g, 6, 7, 3, 2, 'c');
  rect(g, 4, 6, 3, 1, 'd'); dot(g, 5, 6, 'e');
  terrainSprites[`rock${i}`] = sprite(g, rockLegend);
}

const rows = (lines: readonly string[]): Grid => lines.map(line => [...line]);

/** A signpost's board, arrow pointing east, with a little campfire painted beside it. */
const SIGN_TO_CAMP = [
  '................',
  '.oooooooooooooo.',
  '.oWWrWWWWWkWWWo.',
  '.oWrOrWWWWkkWWo.',
  '.oWrOrkkkkkkkWo.',
  '.oWrYrWWWWkkWWo.',
  '.oWdddWWWWkWWWo.',
  '.oooooooooooooo.',
  ...Array.from({ length: 7 }, () => '.......dD.......'),
  '.....tdddDt.....',
  '......tttt......'
];
const signLegend = { o: 'wood1', W: 'wood3', k: 'wood0', d: 'wood2', D: 'wood1', t: 'shadow' } as const;
terrainSprites.signpostCamp = sprite(rows(SIGN_TO_CAMP), { ...signLegend, r: 'fire1', O: 'fire2', Y: 'fire3' });
// At camp the board turns round to point west, and its picture is a heap of quarried stone.
const SIGN_TO_QUARRY = SIGN_TO_CAMP.map((line, y) => (y < 8 ? [...line].reverse().join('').replace(/d/g, 's') : line));
terrainSprites.signpostQuarry = sprite(rows(SIGN_TO_QUARRY), { ...signLegend, r: 'stone1', O: 'stone3', Y: 'stone2', s: 'stone0' });

const boulderLegend = { k: 'stone0', L: 'stone3', M: 'stone2', D: 'stone1', t: 'shadow' } as const;
/** A big boulder lit from the top left, and a pair of smaller rocks. */
terrainSprites.boulder0 = sprite(rows([
  '................',
  '......kkkk......',
  '....kkLLLLkk....',
  '...kLLLLLLMMk...',
  '..kLLLMMMMMMMk..',
  '..kLMMMMMMMMDk..',
  '.kMMMMMMMMMDDDk.',
  '.kMMMMMMMDDDDDk.',
  '.kDMMMMDDDDDDDk.',
  '..kkDDDDDDDDkk..',
  '..ttkkkkkkkktt..',
  '....tttttttt....'
]), boulderLegend);
terrainSprites.boulder1 = sprite(rows([
  '................',
  '...kkk..........',
  '..kLLMk...kkk...',
  '.kLMMMDk.kLMMk..',
  '.kMMMDDkkLMMDk..',
  '.kDDDDDkkMDDDk..',
  '..kkkkk..kkkk...',
  '..ttttttttttt...'
]), boulderLegend);

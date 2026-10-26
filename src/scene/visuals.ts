import { isWinter, nightStart } from '../game/calendar';
import { BALANCE, LOOKOUT, SITES, type GameState, type ResourceNode } from '../game/state';
import { isFreezingNight } from '../game/rules';
import { TILE, worldX, worldY } from './art';
import { QUARRY_SITE, RUBBLE_SITE } from '../game/areas';

export const NIGHT_DEPTH = BALANCE.mapHeight * TILE + 1;
export const LIGHT_DEPTH = NIGHT_DEPTH + 1;
export const WEATHER_DEPTH = LIGHT_DEPTH + 1;
export const GROUND_DECAL_DEPTH = -50;

export function playerVisualDepth(state: GameState): number {
  const nearFire = state.area === 'camp' && state.fireFuel > 0 && Math.hypot(state.player.x - BALANCE.campX, state.player.y - BALANCE.campY) < 1;
  return nearFire ? LIGHT_DEPTH + 0.5 : Math.round(worldY(state.player.y));
}

export interface SceneVisual {
  id: string;
  texture: string;
  x: number;
  y: number;
  depth: number;
}

type AddVisual = (id: string, texture: string, tileX: number, tileY: number, depth?: number) => void;
type Gathered = { id: string; atMs: number } | undefined;

export function sceneVisuals(state: GameState, timeMs: number, gathered?: Gathered): SceneVisual[] {
  const visuals: SceneVisual[] = [];
  const add: AddVisual = (id, texture, tileX, tileY, depth) => {
    const x = Math.round(worldX(tileX));
    const y = Math.round(worldY(tileY));
    visuals.push({ id, texture, x, y, depth: depth ?? y });
  };
  if (state.area === 'quarry') {
    add('quarry', state.quarryReadyDay <= state.day ? 'quarry:ready' : 'quarry:spent', QUARRY_SITE.x, QUARRY_SITE.y);
    add('rubble', state.rubbleReadyDay <= state.day ? 'rubble:ready' : 'rubble:gathered', RUBBLE_SITE.x, RUBBLE_SITE.y);
    addPiles(state, visuals, add);
    return visuals;
  }
  for (const node of state.nodes) add(node.id, nodeTexture(node, timeMs, gathered, isWinter(state.day)), node.x, node.y);
  addPiles(state, visuals, add);
  for (const tree of state.trees) add(tree.id, tree.readyDay <= state.day ? `${tree.sprite}:still` : 'stump:still', tree.x, tree.y);
  addCamp(state, add);
  addFire(state, timeMs, visuals, add);
  return visuals;
}

function addPiles(state: GameState, visuals: SceneVisual[], add: AddVisual): void {
  for (const pile of state.stonePiles) {
    if (pile.area !== state.area) continue;
    add(pile.id, `looseStones:${pileSize(pile.count)}`, pile.x, pile.y);
    if (pile.count < 2) continue;
    const base = visuals.at(-1)!;
    visuals.push({ id: `${pile.id}-count`, texture: `pileCount:${pileCountFrame(pile.count)}`, x: base.x, y: base.y - 14, depth: base.depth + 0.5 });
  }
}

function pileCountFrame(count: number): string {
  return count > 9 ? 'lots' : 'n' + count;
}

function pileSize(count: number): string {
  if (count === 1) return 'one';
  return count === 2 ? 'two' : 'many';
}

const NODE_SPRITES: Record<ResourceNode['kind'], string> = { branch: 'branchPile', berry: 'berryBush', fiber: 'fiberReeds', stone: 'rock0' };
const EMPTY_FRAMES: Record<ResourceNode['kind'], string> = { branch: 'depleted', berry: 'picked', fiber: 'cut', stone: 'depleted' };

/** In winter the berry bushes stand bare, whatever they would hold. */
function nodeTexture(node: ResourceNode, timeMs: number, gathered: Gathered, winter: boolean): string {
  if (winter && node.kind === 'berry') return 'berryBush:picked';
  if (node.kind === 'stone') return node.amount > 0 ? 'rock0:still' : 'pebbles0:still';
  return `${NODE_SPRITES[node.kind]}:${nodeFrame(node, timeMs, gathered)}`;
}

function nodeFrame(node: ResourceNode, timeMs: number, gathered: Gathered): string {
  const sinceGather = gathered?.id === node.id ? timeMs - gathered.atMs : -1;
  if (node.kind === 'berry' && sinceGather >= 0 && sinceGather < 300) return `rustle${Math.floor(sinceGather / 150)}`;
  if (node.amount <= 0) return EMPTY_FRAMES[node.kind];
  if (node.kind === 'fiber') return ['ready', 'sway0', 'ready', 'sway1'][(Math.floor(timeMs / 500) + node.id.length + node.x) % 4];
  return 'ready';
}

/** Small camp structures: where each stands from the fire, drawn as a flat site until built. */
const CAMP_STRUCTURES = [['crate', 3, 1], ['dryingRack', 2, -2], ['windbreak', -2, 2], ['stonePile', 0, -3], ['toolshed', 4, 0]] as const;

function addCamp(state: GameState, add: AddVisual): void {
  const { campX: x, campY: y } = BALANCE;
  const { structures, progress } = state;
  let shelterTexture = 'shelterSite:still';
  if (structures.shelter) shelterTexture = structures.bed ? 'shelter:builtBed' : 'shelter:built';
  add('shelter', shelterTexture, x - 3, y - 2, structures.shelter ? undefined : GROUND_DECAL_DEPTH);
  for (const [id, dx, dy] of CAMP_STRUCTURES) {
    add(id, structures[id] ? `${id}:built` : `${id}Site:still`, x + dx, y + dy, structures[id] ? undefined : GROUND_DECAL_DEPTH);
  }
  add('logSeat', 'logSeat:still', x - 1, y + 1);
  add('lookout', progress.lookoutRepaired ? 'lookout:restored' : 'lookout:damaged', LOOKOUT.x, LOOKOUT.y);
  add('site-basket', progress.discoveries.basket ? 'oldBasket:empty' : 'oldBasket:full', SITES.basket.x, SITES.basket.y);
  add('site-spring', isWinter(state.day) ? 'spring:frozen' : 'spring:still', SITES.spring.x, SITES.spring.y);
  add('site-cairn', progress.discoveries.cairn ? 'cairn:empty' : 'cairn:full', SITES.cairn.x, SITES.cairn.y);
  if (progress.hearthUnlocked && !structures.hearth) add('hearthSite', 'hearthSite:still', x + 1, y + 2, GROUND_DECAL_DEPTH);
}

function fireMode(state: GameState): string {
  if (state.fireFuel <= 0) return 'unlit';
  const storm = isFreezingNight(state);
  const low = state.fireFuel < 30;
  if (storm) return low ? 'lowWindy' : 'windy';
  return low ? 'low' : 'burning';
}

function addFire(state: GameState, timeMs: number, visuals: SceneVisual[], add: AddVisual): void {
  const { campX: x, campY: y } = BALANCE;
  const fire = state.structures.hearth ? 'hearth' : 'firePit';
  const phase = Math.floor(timeMs / 180) % 4;
  const mode = fireMode(state);
  const frame = mode === 'unlit' ? mode : mode + phase;
  add('fire', `${fire}:${frame}`, x, y);
  if (state.fireFuel > 0 && state.timeOfDay >= nightStart(state.day)) visuals.push({
    id: 'flame', texture: `${state.structures.hearth ? 'hearthFlame' : 'flame'}:${mode}${phase}`,
    x: Math.round(worldX(x)), y: Math.round(worldY(y)), depth: LIGHT_DEPTH
  });
}

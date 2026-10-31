import { isWinter, nightStart } from '../game/calendar';
import { gardenPlotStage } from '../game/garden';
import { BALANCE, LOOKOUT, SITES, type GameState, type ResourceNode } from '../game/state';
import { groundBlocker, isFreezingNight } from '../game/rules';
import { storeTotal } from '../game/food';
import { wolfTracksShown } from '../game/wolves';
import { rainWindow } from '../game/rain';
import { TILE, worldX, worldY } from './art';
import { QUARRY_SITE, RUBBLE_SITE } from '../game/areas';
import { markedTrees } from '../game/clearing';
import { nodeShown } from '../game/forage';
import { fireplaceBurning } from '../game/home';
import type { StockLevel } from '../art/phase3Sprites';

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
  for (const node of state.nodes.filter(item => nodeShown(state, item))) add(node.id, nodeTexture(node, timeMs, gathered, isWinter(state.day)), node.x, node.y);
  addPiles(state, visuals, add);
  addPuddles(state, add);
  for (const tree of state.trees) add(tree.id, tree.readyDay <= state.day ? `${tree.sprite}:still` : 'stump:still', tree.x, tree.y);
  // Trees marked for clearing wear a tie of fibre; once felled they leave a stump that is cleared away with the ground.
  for (const tree of markedTrees(state)) add(tree.id, tree.readyDay <= state.day ? `${tree.sprite}:marked` : 'stump:still', tree.x, tree.y);
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

const NODE_SPRITES: Record<ResourceNode['kind'], string> = {
  branch: 'branchPile', berry: 'berryBush', fiber: 'fiberReeds', stone: 'rock0',
  hazel: 'hazelSpot', pine: 'pineForage', greens: 'greensPatch', honey: 'hollowTree'
};
const EMPTY_FRAMES: Record<ResourceNode['kind'], string> = {
  branch: 'depleted', berry: 'picked', fiber: 'cut', stone: 'depleted', hazel: 'gathered', pine: 'gathered', greens: 'gathered', honey: 'gathered'
};
/** Reeds sway and bees drift about the hollow tree, slowly, each out of step with its neighbours. */
const IDLE_FRAMES: Partial<Record<ResourceNode['kind'], readonly string[]>> = {
  fiber: ['ready', 'sway0', 'ready', 'sway1'],
  honey: ['ready', 'bees0', 'ready', 'bees1']
};

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
  const idle = IDLE_FRAMES[node.kind];
  return idle ? idle[(Math.floor(timeMs / 500) + node.id.length + Math.floor(node.x)) % idle.length] : 'ready';
}

/** Where puddles gather at camp once a spring shower starts; they stay until the day ends. */
export const PUDDLE_SPOTS = [{ x: 15, y: 12 }, { x: 25, y: 19 }, { x: 11, y: 18 }, { x: 29, y: 9 }] as const;

function addPuddles(state: GameState, add: AddVisual): void {
  const rain = rainWindow(state.day);
  if (!rain || state.timeOfDay < rain.start) return;
  PUDDLE_SPOTS.forEach((spot, index) => add(`puddle-${index}`, 'puddle:still', spot.x, spot.y, GROUND_DECAL_DEPTH));
}

/** Small camp structures: where each stands from the fire, drawn as a flat site until built; one on cleared ground only once it is clear. */
export const CAMP_STRUCTURES = [['dryingRack', 2, -2], ['windbreak', -2, 2], ['stonePile', 0, -3], ['toolshed', 4, 0], ['garden', -6, 3], ['larder', 2.5, -4.5], ['woodpile', 5.5, -1.5], ['fibreStack', 5.5, 1.5], ['house', 4.5, -6.5]] as const;

/** A camp store shows how much it holds: nothing, some (1 to 6) or plenty (7 and up); the larder, woodpile, woodshed and fibre stack share it. */
export function stockFrame(stored: number): StockLevel {
  if (stored === 0) return 'empty';
  return stored <= 6 ? 'some' : 'full';
}

function builtTexture(state: GameState, id: (typeof CAMP_STRUCTURES)[number][0]): string {
  if (id === 'woodpile') return `woodpile:${stockFrame(state.storedWood)}`;
  if (id === 'fibreStack') return `fibreStack:${stockFrame(state.storedFiber)}`;
  if (id === 'house') return fireplaceBurning(state) ? 'house:lit' : 'house:dark';
  return id === 'larder' ? `larder:${stockFrame(storeTotal(state.larder))}` : `${id}:built`;
}

function addCamp(state: GameState, add: AddVisual): void {
  const { campX: x, campY: y } = BALANCE;
  const { structures, progress } = state;
  let shelterTexture = 'shelterSite:still';
  if (structures.shelter) {
    let stage = 'built';
    if (structures.shelterThatched) stage = 'thatched';
    if (structures.shelterStonework) stage = 'stonework';
    if (structures.shelterPorch) stage = 'porch';
    if (structures.shelterFinished) stage = 'finished';
    shelterTexture = structures.bed ? `shelter:${stage}Bed` : `shelter:${stage}`;
  }
  // Once the house stands, the bed has gone indoors and the shelter keeps the wood store as a woodshed.
  if (structures.house) shelterTexture = `woodshed:${stockFrame(state.storedWood)}`;
  add('shelter', shelterTexture, x - 3, y - 2, structures.shelter ? undefined : GROUND_DECAL_DEPTH);
  for (const [id, dx, dy] of CAMP_STRUCTURES) {
    if (groundBlocker(state, id)) continue;
    add(id, structures[id] ? builtTexture(state, id) : `${id}Site:still`, x + dx, y + dy, structures[id] ? undefined : GROUND_DECAL_DEPTH);
  }
  if (structures.garden) {
    state.gardenPlots.forEach((plot, index) => {
      const stage = gardenPlotStage(state, plot);
      if (stage !== 'empty') add(`garden-plant-${index}`, `gardenPlant:${stage}`, x - 7 + index, y + 3);
    });
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
  if (wolfTracksShown(state)) add('wolfTracks', 'wolfTracks:still', x, y, GROUND_DECAL_DEPTH);
  const frame = mode === 'unlit' ? mode : mode + phase;
  add('fire', `${fire}:${frame}`, x, y);
  // The pot hangs over the fire, steaming while it burns.
  if (state.progress.potCrafted) {
    const fireDepth = visuals.at(-1)!.depth;
    add('potTripod', state.fireFuel > 0 ? `potTripod:steaming${Math.floor(timeMs / 500) % 2}` : 'potTripod:still', x, y, fireDepth + 1);
  }
  if (state.fireFuel > 0 && state.timeOfDay >= nightStart(state.day)) visuals.push({
    id: 'flame', texture: `${state.structures.hearth ? 'hearthFlame' : 'flame'}:${mode}${phase}`,
    x: Math.round(worldX(x)), y: Math.round(worldY(y)), depth: LIGHT_DEPTH
  });
}

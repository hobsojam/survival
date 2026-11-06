import { feathersFound } from '../game/companion';
import { stripStage } from '../game/field';
import { isWinter, nightStart, season } from '../game/calendar';
import { gardenPlotStage } from '../game/garden';
import { BED_CROPS, bedSoil, bedStage } from '../game/beds';
import { BALANCE, LOOKOUT, SITES, type GameState, type ResourceNode } from '../game/state';
import { groundBlocker, isFreezingNight } from '../game/rules';
import { storeTotal } from '../game/food';
import { wolfTracksShown } from '../game/wolves';
import { rainWindow } from '../game/rain';
import { TILE, worldX, worldY } from './art';
import { QUARRY_SITE, RUBBLE_SITE } from '../game/areas';
import { OUTCROP_SITE, outcropLeft } from '../game/hills';
import { markedTrees } from '../game/clearing';
import { nodeShown } from '../game/forage';
import { fireplaceBurning, woodStoreCapacity } from '../game/home';
import { CHICKEN_SITE, COOP_SITE } from '../game/chickens';
import { ORCHARD_SPOTS, treeFrame } from '../game/orchard';
import { sheepStage, type SheepStage } from '../game/sheep';
import { APPLE_TREE, HOMESTEAD_SHED } from '../game/homestead';
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
    let quarryTexture = state.quarryReadyDay <= state.day ? 'quarry:ready' : 'quarry:spent';
    if (state.progress.mineBuilt) {
      const digs = Number(state.quarryReadyDay <= state.day) + Number(state.mineReadyDay <= state.day);
      let frame = 'spent';
      if (digs === 2) frame = 'full';
      else if (digs === 1) frame = 'one';
      quarryTexture = `mine:${frame}`;
    }
    add('quarry', quarryTexture, QUARRY_SITE.x, QUARRY_SITE.y);
    add('rubble', state.rubbleReadyDay <= state.day ? 'rubble:ready' : 'rubble:gathered', RUBBLE_SITE.x, RUBBLE_SITE.y);
    addPiles(state, visuals, add);
    return visuals;
  }
  if (state.area === 'hills') {
    add('outcrop', `outcrop:${outcropLeft(state) > 0 ? 'ready' : 'spent'}`, OUTCROP_SITE.x, OUTCROP_SITE.y);
    addPiles(state, visuals, add);
    return visuals;
  }
  if (state.area === 'homestead') {
    add('homestead-shed', 'homesteadShed:still', HOMESTEAD_SHED.x, HOMESTEAD_SHED.y);
    const full = season(state.day) === 'autumn' && state.homestead.applesReadyDay <= state.day;
    add('apple-tree', `appleTree:${full ? 'full' : 'bare'}`, APPLE_TREE.x, APPLE_TREE.y);
    addPiles(state, visuals, add);
    addChickens(state, add, timeMs);
    return visuals;
  }
  for (const node of state.nodes.filter(item => nodeShown(state, item))) add(node.id, nodeTexture(node, timeMs, gathered, isWinter(state.day)), node.x, node.y);
  addPiles(state, visuals, add);
  addPuddles(state, add);
  for (const tree of state.trees) add(tree.id, tree.readyDay <= state.day ? `${tree.sprite}:mature` : 'stump:still', tree.x, tree.y);
  // Trees marked for clearing wear a tie of fibre; once felled they leave a stump that is cleared away with the ground.
  for (const tree of markedTrees(state)) add(tree.id, tree.readyDay <= state.day ? `${tree.sprite}:marked` : 'stump:still', tree.x, tree.y);
  addCamp(state, add, timeMs);
  addChickens(state, add, timeMs);
  addFire(state, timeMs, visuals, add);
  return visuals;
}

/** Three birds stay together, regrouping around the survivor on the walk home. */
function addChickens(state: GameState, add: AddVisual, timeMs: number): void {
  let center: { x: number; y: number } | null = null;
  if (state.chickens.following) center = { x: state.player.x - 0.8, y: state.player.y + 0.6 };
  else if (state.area === 'homestead' && !state.chickens.rescued) center = CHICKEN_SITE;
  else if (state.area === 'camp' && state.chickens.rescued) center = COOP_SITE;
  if (!center) return;
  // Home at the coop they stand out in front of it: clear of the coop, the toolshed, the fibre and the fire, so each can be seen and tapped.
  const home = state.area === 'camp' && state.chickens.rescued;
  const offsets = home ? [[-0.6, 2.6], [0.6, 2], [1.7, 0.4]] : [[-0.7, 0.1], [0.3, -0.2], [0.8, 0.5]];
  offsets.forEach(([dx, dy], index) => {
    const x = Math.max(0.5, Math.min(BALANCE.mapWidth - 1.5, center.x + dx));
    const y = Math.max(0.5, Math.min(BALANCE.mapHeight - 1.5, center.y + dy));
    const frame = state.chickens.following ? `walk${Math.floor(timeMs / 300 + index) % 2}` : 'idle';
    add(`chicken-${index}`, `chicken:${frame}`, x, y);
  });
}

/** Where the feed rack stands in the pen, in tiles. */
export const SHEEP_RACK = { x: 33.5, y: 2.9 };

const SHEEP_HOMES = [{ x: 32.25, y: 5.5 }, { x: 34.75, y: 5.2 }, { x: 33.5, y: 4.2 }];
const SHEEP_AT_RACK = [{ x: 32.5, y: 4.3 }, { x: 34.5, y: 4.3 }, { x: 33.5, y: 5.6 }];
/** Clouds fill the pen, so they keep their own spots, fed or not, where every small face still shows. */
const CLOUD_SPOTS = [{ x: 32.15, y: 5.8 }, { x: 34.85, y: 5.75 }, { x: 33.5, y: 3.85 }];
/** How far above its feet each look's snow cap sits, in tiles. */
const SNOW_LIFT: Record<SheepStage, number> = { shorn: 11 / TILE, woolly: 15 / TILE, round: 22 / TILE, cloud: 36 / TILE };
const WANDER_MS: Record<SheepStage, number> = { shorn: 2600, woolly: 3200, round: 4200, cloud: 6400 };

/** Three sheep in the pen. They drift about on a slow timer, closer to the rack while the feed lasts, and always in front of the fence: their feet never reach its front rail. */
function addSheep(state: GameState, add: AddVisual, timeMs: number): void {
  const { sheep } = state;
  if (!sheep.arrived || !state.structures.sheepPen) return;
  const stage = sheepStage(sheep.fluff);
  const fed = sheep.fedUntil !== null && state.day < sheep.fedUntil;
  const cloud = stage === 'cloud';
  const homes = cloud ? CLOUD_SPOTS : fed ? SHEEP_AT_RACK : SHEEP_HOMES;
  homes.forEach((home, index) => {
    const phase = timeMs / WANDER_MS[stage] + index * 2.1;
    const x = home.x + Math.sin(phase) * (cloud ? 0.1 : 0.2);
    const y = home.y + Math.sin(phase * 0.7 + index) * (cloud ? 0.05 : 0.12);
    const walking = Math.abs(Math.cos(phase)) > 0.4 && Math.floor(timeMs / 320) % 2 === 1;
    const depth = worldY(4.5) + worldY(y) / 1000;
    add(`sheep-${index}`, `sheep:${stage}${walking ? 'Walk' : 'Idle'}`, x, y, depth);
    if (isWinter(state.day)) add(`sheep-${index}-snow`, `sheepSnow:${stage === 'cloud' || stage === 'round' ? 'large' : 'small'}`, x, y - SNOW_LIFT[stage], depth + 0.0005);
  });
}

function addPiles(state: GameState, visuals: SceneVisual[], add: AddVisual): void {
  for (const pile of state.stonePiles) {
    if (pile.area !== state.area) continue;
    add(pile.id, `${pile.item === 'ore' ? 'orePile' : 'looseStones'}:${pileSize(pile.count)}`, pile.x, pile.y);
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
  hazel: 'hazelSpot', pine: 'pineForage', greens: 'greensPatch', honey: 'hollowTree', wildGrain: 'wildGrain'
};
const EMPTY_FRAMES: Record<ResourceNode['kind'], string> = {
  branch: 'depleted', berry: 'picked', fiber: 'cut', stone: 'depleted', hazel: 'gathered', pine: 'gathered', greens: 'gathered', honey: 'gathered', wildGrain: 'gathered'
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
export const CAMP_STRUCTURES = [['dryingRack', 2, -2], ['windbreak', -2, 2], ['stonePile', 0, -3], ['toolshed', 4, 0], ['garden', -6, 3], ['larder', 2.5, -4.5], ['woodpile', 5.5, -1.5], ['fibreStack', 5.5, 1.5], ['house', -0.5, -6.5], ['vegetableBeds', -4.5, 0], ['well', -7, -1.5], ['workshop', 8, -1], ['granary', 3, 4.5], ['field', -1.5, 7], ['windmill', -2.75, 9.75], ['bakery', -2, -10], ['beehive', 2, -7], ['sheepPen', 14, -10.5], ['loom', 6.5, 3.5], ['orchard', -15.25, -4.25]] as const;

/** Where each of the field's four strips stands across from the field's spot, in tiles. */
export const FIELD_STRIP_OFFSETS = [-1.5, -0.5, 0.5, 1.5] as const;

/** The built field, one strip beside the next, each drawn as it stands today. */
function addFieldStrips(state: GameState, add: AddVisual, x: number, y: number): void {
  state.field.strips.forEach((strip, index) => add(`field-strip-${index}`, `fieldStrip:${stripStage(strip, state.day)}`, x + FIELD_STRIP_OFFSETS[index], y));
}

/** Where the handcart parks, from the fire: just below the workshop, on the same cleared ground. */
export const CART_SPOT = { dx: 7.5, dy: 1.5 } as const;

/** A camp store shows how much it holds: nothing, some (1 to 6) or plenty (7 and up); the larder, woodpile and fibre stack share it. */
export function stockFrame(stored: number): StockLevel {
  if (stored === 0) return 'empty';
  return stored <= 6 ? 'some' : 'full';
}

/** The woodshed shows its share of the whole wood store: empty at nothing, full from half the capacity up, otherwise some. */
export function woodshedFrame(state: GameState): StockLevel {
  if (state.storedWood === 0) return 'empty';
  return state.storedWood >= woodStoreCapacity(state) / 2 ? 'full' : 'some';
}

/** How long each of the windmill's four sail frames shows. */
const SAIL_FRAME_MS = 700;

/** The bakery: smoke from the chimney until noon on a morning it baked, loaves on the shelf while there are any, or cold. */
function bakeryTexture(state: GameState): string {
  if (state.bakery.lastBaked === state.day && state.timeOfDay < BALANCE.daySeconds / 2) return 'bakery:baking';
  return state.bakery.shelf.length > 0 ? 'bakery:loaves' : 'bakery:cold';
}

function builtTexture(state: GameState, id: (typeof CAMP_STRUCTURES)[number][0], timeMs: number): string {
  if (id === 'windmill') return `windmill:turn${Math.floor(timeMs / SAIL_FRAME_MS) % 4}`;
  if (id === 'bakery') return bakeryTexture(state);
  if (id === 'beehive') return beehiveTexture(state, timeMs);
  if (id === 'woodpile') {
    const sprite = state.structures.timberYard ? 'timberYard' : 'woodpile';
    return `${sprite}:${stockFrame(state.storedWood)}`;
  }
  if (id === 'fibreStack') return `fibreStack:${stockFrame(state.storedFiber)}`;
  if (id === 'house') {
    const { paint, flowerBoxes } = state.decorations;
    const light = fireplaceBurning(state) ? 'lit' : 'dark';
    if (paint === 'natural' && !flowerBoxes) return `house:${light}`;
    const boxes = flowerBoxes ? 'boxes' : 'bare';
    return `house:${paint}-${boxes}-${light}`;
  }
  if (id === 'granary') return `granary:${stockFrame(state.field.grain)}`;
  if (id === 'larder') return `${state.structures.storehouse ? 'storehouse' : 'larder'}:${stockFrame(storeTotal(state.larder))}`;
  return `${id}:built`;
}

function shelterTexture(state: GameState): string {
  const { structures } = state;
  // Once the house stands, the bed has gone indoors and the shelter keeps the wood store as a woodshed.
  if (structures.house) return `woodshed:${woodshedFrame(state)}`;
  if (!structures.shelter) return 'shelterSite:still';
  let stage = 'built';
  if (structures.shelterThatched) stage = 'thatched';
  if (structures.shelterStonework) stage = 'stonework';
  if (structures.shelterPorch) stage = 'porch';
  if (structures.shelterFinished) stage = 'finished';
  return structures.bed ? `shelter:${stage}Bed` : `shelter:${stage}`;
}

/** How far apart the three vegetable beds stand, in tiles, either side of the middle one. */
const BED_SPACING = 0.9;

/** The built beds, one per crop, each drawn at its stage of growth and the state of its soil. */
function addVegetableBeds(state: GameState, add: AddVisual, x: number, y: number): void {
  state.beds.forEach((bed, index) => {
    add(`vegBed-${index}`, `vegBed:${BED_CROPS[index]}-${bedStage(bed)}-${bedSoil(state, bed)}`, x + (index - 1) * BED_SPACING, y);
  });
}

/** How long each frame of the bees around the hive shows. */
const BEE_FRAME_MS = 400;

/** The beehive: still at night; by day a bee or two drift around it, only one in winter. */
function beehiveTexture(state: GameState, timeMs: number): string {
  if (state.timeOfDay >= nightStart(state.day)) return 'beehive:still';
  const frame = Math.floor(timeMs / BEE_FRAME_MS) % 2;
  return isWinter(state.day) ? `beehive:winter${frame}` : `beehive:bees${frame}`;
}

function addBuildableStructures(state: GameState, add: AddVisual, x: number, y: number, timeMs: number): void {
  const { structures } = state;
  for (const [id, dx, dy] of CAMP_STRUCTURES) {
    if (groundBlocker(state, id)) continue;
    // The loom stays a surprise until the first shearing brings it into the build list.
    if (id === 'loom' && state.sheep.lastShornYear === null) continue;
    if (id === 'orchard' && !state.progress.homesteadFound) continue;
    if (id === 'vegetableBeds' && structures.vegetableBeds) {
      addVegetableBeds(state, add, x + dx, y + dy);
      continue;
    }
    if (id === 'orchard' && structures.orchard) {
      add('orchard', 'orchard:built', x + dx, y + dy, GROUND_DECAL_DEPTH);
      state.orchard.trees.forEach((tree, spot) => {
        if (tree) add(`orchard-tree-${spot}`, `orchardTree:${treeFrame(tree, state.day)}`, ORCHARD_SPOTS[spot].x, ORCHARD_SPOTS[spot].y);
      });
      continue;
    }
    if (id === 'field' && structures.field) {
      addFieldStrips(state, add, x + dx, y + dy);
      continue;
    }
    add(id, structures[id] ? builtTexture(state, id, timeMs) : `${id}Site:still`, x + dx, y + dy, structures[id] ? undefined : GROUND_DECAL_DEPTH);
  }
  addSheep(state, add, timeMs);
  if (state.sheep.woven.rug && structures.house) add('rug', 'rug:still', x - 0.5, y - 5.6, GROUND_DECAL_DEPTH);
  if (state.progress.workshop.handcart && !groundBlocker(state, 'workshop')) {
    add('handcart', `handcart:${stockFrame(state.cartWood)}`, x + CART_SPOT.dx, y + CART_SPOT.dy);
  }
}

function addGardenPlants(state: GameState, add: AddVisual, x: number, y: number): void {
  if (!state.structures.garden) return;
  state.gardenPlots.forEach((plot, index) => {
    const stage = gardenPlotStage(state, plot);
    if (stage !== 'empty') add(`garden-plant-${index}`, `gardenPlant:${stage}`, x - 7 + index, y + 3);
  });
}

function addCamp(state: GameState, add: AddVisual, timeMs: number): void {
  const { campX: x, campY: y } = BALANCE;
  const { structures, progress } = state;
  add('shelter', shelterTexture(state), x - 3, y - 2, structures.shelter ? undefined : GROUND_DECAL_DEPTH);
  if (structures.shelter && feathersFound(state)) add('shelter-feathers', 'shelterFeathers:still', x - 3.75, y - 1.95);
  addBuildableStructures(state, add, x, y, timeMs);
  if (state.chickens.discovered) add('chicken-coop', structures.chickenCoop ? 'chickenCoop:built' : 'chickenCoopSite:still', COOP_SITE.x, COOP_SITE.y,
    structures.chickenCoop ? undefined : GROUND_DECAL_DEPTH);
  if (structures.house) {
    if (structures.birdhouse) add('birdhouse', 'birdhouse:built', x - 3, y - 7);
    if (structures.wolfHouse) add('wolf-house', 'wolfHouse:built', x + 5, y - 5);
    if (structures.foxDen) add('fox-den', 'foxDen:built', x - 5, y - 3.5);
  }
  const fenceSpots = [{ dx: -3, dy: -5.625, frame: 'left' }, { dx: 2, dy: -5.625, frame: 'right' }, { dx: -0.5, dy: -6.625, frame: 'rail' }];
  fenceSpots.slice(0, state.decorations.fence).forEach((spot, index) => add(`house-fence-${index}`, `fence:${spot.frame}`, x + spot.dx, y + spot.dy));
  addGardenPlants(state, add, x, y);
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

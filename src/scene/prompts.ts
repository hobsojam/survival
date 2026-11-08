import { isWinter, nightStart } from '../game/calendar';
import { BALANCE, LOOKOUT, SITES, type GameState, type ResourceKind, type SiteId, type TreeNode } from '../game/state';
import { isAtCamp, isInClearing, mineBlocker, sleepBlocker, freeSpaces, spaceFor, type GameAction } from '../game/rules';
import { CAMP_EXIT, CAMP_HOMESTEAD_EXIT, HOMESTEAD_EXIT, QUARRY_EXIT, QUARRY_SITE, RUBBLE_SITE, hillsPathOpen, pathOpen } from '../game/areas';
import { CHICKEN_SITE, COOP_SITE } from '../game/chickens';
import { HILLS_EXIT, OUTCROP_SITE, QUARRY_HILLS_EXIT, outcropNote } from '../game/hills';
import { NEEDS, isRevealed, lineDistance } from '../game/castle';
import { GATE_SPOT, cartWithin, castleNeedsStone, castlePrompt, castleWorkBlocker, nearestCastleSpot } from '../game/castleSites';
import { KEEP_DOOR_WOOD, KEEP_SITE, KEEP_STONES, atHallDoor, keepFinished, keepNeedsDoor, keepOpen, withKeepDoor } from '../game/keep';
import { ponyNote, ponyOfferLabel } from '../game/pony';
import { availableWood } from '../game/wood';
import { APPLE_TREE, HOMESTEAD_SHED } from '../game/homestead';
import { ORCHARD_SPOTS, nearestSpot, spotAction, treeBears, treeStage } from '../game/orchard';
import { choppableTrees, isClearingStump } from '../game/clearing';
import { sitePrompt } from '../game/sitePrompt';
import { offerFor, offerPrompt } from '../game/companion';
import { DISHES, defaultDish } from '../game/cooking';
import { isAtHome, livesInHouse } from '../game/home';
import { closestGatherable, type Gatherable } from './tapTarget';
import type { SurvivorAction } from './survivorVisual';

/** Older single-press keys, still working though no longer shown: only E (use), R (rest) and Z (sleep) are named on screen. */
export const KEY_ACTIONS: readonly [string, GameAction][] = [
  ['F', { type: 'stokeFire' }], ['R', { type: 'rest' }], ['Q', { type: 'eat' }], ['T', { type: 'eatTrailFood' }],
  ['P', { type: 'prepareTrailFood' }], ['C', { type: 'cook' }], ['G', { type: 'stargaze' }], ['Z', { type: 'sleep' }],
  ['L', { type: 'repairLookout' }], ['O', { type: 'befriend' }]
];

const ACTION_POSES: Partial<Record<GameAction['type'], SurvivorAction>> = {
  gather: 'gather', rest: 'rest', cook: 'cook', stargaze: 'stargaze',
  chopTree: 'gather', pickUpStone: 'gather', gatherRubble: 'gather', digQuarry: 'gather', takeCartStone: 'gather', digOre: 'gather', layStone: 'gather', castleWork: 'gather', hangDoor: 'gather', offerPony: 'gather', fish: 'gather',
  gatherApples: 'gather', plantPip: 'gather', pickOrchardApple: 'gather', searchShed: 'gather', takeEgg: 'gather'
};

/** The survivor's pose for an action that changed the game, if it has one. */
export function actionPose(type: GameAction['type']): SurvivorAction | undefined {
  return ACTION_POSES[type];
}

const GATHER_PROMPTS: Record<ResourceKind, string> = {
  branch: 'Pick up fallen branches', berry: 'Pick berries', fiber: 'Gather fiber', stone: 'Collect stone',
  hazel: 'Gather hazelnuts', pine: 'Gather pine needles', greens: 'Pick wild greens', honey: 'Take wild honey', wildGrain: 'Gather wild grain'
};

/** One thing within reach: what the prompt calls it, and what E (like a tap) would do with it, if anything. */
interface Choice { label: string; action?: GameAction }

const spotLabel = (state: GameState, spot: number, action: GameAction | null): string => {
  const tree = state.orchard.trees[spot];
  if (action) return tree ? 'Pick apples' : 'Plant a pip';
  if (!tree) return isWinter(state.day) ? 'Orchard spot · the ground is frozen' : 'Orchard spot · no pips';
  if (treeStage(tree, state.day) !== 'grown') return 'Young apple tree · not bearing yet';
  return treeBears(tree, state.day) ? 'Apple tree · no ripe apples yet' : 'Apple tree · apples come in autumn';
};

/** The orchard spot within reach, and what it offers, if the orchard stands. */
export function orchardChoice(state: GameState): Choice | null {
  const spot = nearestSpot(state);
  if (spot === null) return null;
  const action = spotAction(state, spot);
  return action ? { label: spotLabel(state, spot, action), action } : { label: spotLabel(state, spot, action) };
}

/** Gathering what is in reach; at the quarry face, digging it. */
function gatherChoice(state: GameState, found: Gatherable): Choice {
  switch (found.kind) {
    case 'node': {
      // E still tries a bare winter bush, so the survivor hears why it is empty.
      const bare = found.node.kind === 'berry' && isWinter(state.day);
      return { label: bare ? 'Search the bare bush' : GATHER_PROMPTS[found.node.kind], action: { type: 'gather', nodeId: found.node.id } };
    }
    case 'pile': return { label: `Pick up ${found.pile.item} (×${found.pile.count})`, action: { type: 'pickUpStone', pileId: found.pile.id } };
    case 'rubble': return { label: 'Gather rubble', action: { type: 'gatherRubble' } };
    case 'outcrop': return state.progress.pickaxeCrafted
      ? { label: 'Dig the outcrop', action: { type: 'digOre' } }
      : { label: 'Rust-red rock · craft a pickaxe at the toolshed' };
    default: return state.progress.pickaxeCrafted
      ? { label: 'Dig the quarry', action: { type: 'digQuarry' } }
      : { label: 'Quarry · craft a pickaxe at the toolshed' };
  }
}

/** Standing closer to an orchard spot than to anything to gather or search, the spot goes first. */
function orchardComesFirst(state: GameState, found: Gatherable | undefined): boolean {
  const spot = nearestSpot(state);
  if (spot === null) return false;
  const away = (place: { x: number; y: number }): number => Math.hypot(state.player.x - place.x, state.player.y - place.y);
  const toGather = found?.kind === 'node' ? found.node : found?.kind === 'pile' ? found.pile : null;
  const site = closestSite(state);
  const nearest = away(ORCHARD_SPOTS[spot]);
  return (!toGather || away(toGather) > nearest) && (!site || away(site) > nearest);
}

/** Everything in reach at camp, in the order E would use it: gathering, then the lookout, a place or a tree, then an offering. */
function campChoices(state: GameState): Choice[] {
  const found = closestGatherable(state);
  const site = closestSite(state);
  const nearby = lookoutChoice(state) ?? (site ? { label: sitePrompt(state, site.id), action: { type: 'visitSite', siteId: site.id } as GameAction } : null) ?? treeChoice(state);
  const animal = offerFor(state);
  const offer: Choice | null = animal ? { label: offerPrompt(state, animal), action: { type: 'befriend' } } : null;
  const coop: Choice | null = state.chickens.rescued && within(state, COOP_SITE)
    ? { label: state.chickens.eggs ? `Collect egg (×${state.chickens.eggs})` : 'Coop · no eggs yet',
      ...(state.chickens.eggs ? { action: { type: 'takeEgg' as const } } : {}) } : null;
  const gather = found ? gatherChoice(state, found) : null;
  const orchard = orchardChoice(state);
  const inOrder = orchardComesFirst(state, found) ? [orchard, gather, nearby, coop, offer] : [gather, nearby, coop, orchard, offer];
  return inOrder.filter((choice): choice is Choice => choice !== null);
}

function homesteadChoices(state: GameState): Choice[] {
  const choices: Choice[] = [];
  if (within(state, HOMESTEAD_SHED)) choices.push(state.homestead.shedSearched
    ? { label: 'The shed has been searched' } : { label: 'Search the old shed', action: { type: 'searchShed' } });
  if (within(state, APPLE_TREE)) choices.push({ label: 'Pick apples', action: { type: 'gatherApples' } });
  if (!state.chickens.rescued && within(state, CHICKEN_SITE)) {
    if (!state.chickens.discovered) choices.push({ label: 'Look at the chickens', action: { type: 'meetChickens' } });
    else if (!state.structures.chickenCoop) choices.push({ label: 'Chickens · build a coop at camp first' });
    else if (state.chickens.following) choices.push({ label: 'The chickens are following you' });
    else choices.push({ label: 'Lead the chickens home', action: { type: 'leadChickens' } });
  }
  return choices;
}

/** E gets the first choice it would act on; the rest are named plainly, to click. */
function choiceLabels(choices: Choice[]): string[] {
  const used = choices.findIndex(choice => choice.action);
  return choices.map((choice, index) => (index === used ? `E  ${choice.label}` : choice.label));
}

/** What E does: the first thing in reach it can use, as a tap on it would, or a rest at home with nothing to use. */
export function useKeyAction(state: GameState): GameAction | undefined {
  let choices: Choice[];
  if (state.area === 'quarry') choices = quarryChoices(state);
  else if (state.area === 'homestead') choices = homesteadChoices(state);
  else if (state.area === 'hills') choices = hillsChoices(state);
  else choices = campChoices(state);
  return choices.find(choice => choice.action)?.action ?? (isAtHome(state) ? { type: 'rest' } : undefined);
}

/** The scene effect an action that changed the game plays, and where: dust off the quarry face, or steam or a star by the survivor. */
export function actionEffect(action: GameAction, after: GameState): { kind: 'dust' | 'cook' | 'stargaze' | 'portcullis'; x: number; y: number } | undefined {
  if (action.type === 'digQuarry') return { kind: 'dust', ...QUARRY_SITE };
  if (action.type === 'digOre') return { kind: 'dust', ...OUTCROP_SITE };
  if (action.type === 'layStone' || action.type === 'hangDoor') return { kind: 'dust', ...KEEP_SITE };
  if (action.type === 'castleWork' && action.site === 'gatehouse' && after.castle.gatehouse === NEEDS.gatehouse) return { kind: 'portcullis', x: GATE_SPOT.x, y: GATE_SPOT.y };
  if (action.type === 'castleWork') return { kind: 'dust', x: after.player.x, y: after.player.y };
  if (action.type === 'cook' || action.type === 'stargaze') return { kind: action.type, x: after.player.x, y: after.player.y };
  return undefined;
}

/** Where a gathering action happened, read from the state before it, for the pick-up sparkle. */
export function gatherSpot(action: GameAction, before: GameState): { x: number; y: number; kind: ResourceKind } | undefined {
  switch (action.type) {
    case 'gather': return before.nodes.find(item => item.id === action.nodeId);
    case 'chopTree': {
      const tree = choppableTrees(before).find(item => item.id === action.treeId);
      return tree && { x: tree.x, y: tree.y, kind: 'branch' };
    }
    case 'pickUpStone': {
      const pile = before.stonePiles.find(item => item.id === action.pileId);
      return pile && { x: pile.x, y: pile.y, kind: 'stone' };
    }
    case 'gatherRubble': return { ...RUBBLE_SITE, kind: 'stone' };
    case 'digQuarry': return { ...QUARRY_SITE, kind: 'stone' };
    default: return undefined;
  }
}

const away = (state: GameState, point: { x: number; y: number }): number => Math.hypot(point.x - state.player.x, point.y - state.player.y);
const within = (state: GameState, point: { x: number; y: number }): boolean => away(state, point) <= BALANCE.interactionRadius;

/** The nearest camp tree in reach, mature or stump. */
export function closestTree(state: GameState): TreeNode | undefined {
  if (state.area !== 'camp') return undefined;
  return choppableTrees(state).filter(tree => within(state, tree)).sort((a, b) => away(state, a) - away(state, b))[0];
}

/** The nearest place along the camp paths in reach. */
export function closestSite(state: GameState): { id: SiteId; name: string; x: number; y: number } | undefined {
  if (state.area !== 'camp') return undefined;
  return (Object.keys(SITES) as SiteId[])
    .map(id => ({ id, ...SITES[id] }))
    .filter(site => within(state, site))
    .sort((a, b) => away(state, a) - away(state, b))[0];
}

/** The hint line under the game: what the keys would do here, now. */
export function promptFor(state: GameState): string {
  if (state.area === 'quarry') return quarryPrompt(state);
  if (state.area === 'hills') return hillsPrompt(state);
  if (state.area === 'homestead') {
    const labels = choiceLabels(homesteadChoices(state));
    if (labels.length) return labels.join(' · ');
    if (within(state, HOMESTEAD_EXIT)) return 'Walk west to return to camp';
    return 'WASD / arrows  Move';
  }
  const choices = campChoices(state);
  const labels = choiceLabels(choices);
  const only = choices.length === 1 ? choices[0] : null;
  if (only && only.action?.type === 'gather' && !sleepBlocker(state)) return `${labels[0]} · Z Sleep until morning`;
  // An offering alone keeps the camp's own hints beside it.
  if (only?.action?.type === 'befriend') return `${labels[0]} · ${campPrompt(state)}`;
  return labels.length ? labels.join(' · ') : campPrompt(state);
}

function lookoutChoice(state: GameState): Choice | null {
  if (!within(state, LOOKOUT)) return null;
  if (state.progress.lookoutRepaired) return { label: 'The lookout stands again' };
  if (state.progress.hearthUnlocked) return { label: 'Repair lookout', action: { type: 'repairLookout' } };
  return { label: 'Lookout · weather the cold night first' };
}

function treeChoice(state: GameState): Choice | null {
  const tree = closestTree(state);
  if (!tree) return null;
  if (isClearingStump(tree)) return { label: 'Stump · this ground is being cleared' };
  if (tree.readyDay > state.day) return { label: `Stump · regrows day ${tree.readyDay}` };
  if (state.progress.axeCrafted) return { label: 'Chop mature tree', action: { type: 'chopTree', treeId: tree.id } };
  return { label: 'Mature tree · craft an axe at camp' };
}

function campPrompt(state: GameState): string {
  if (pathOpen(state) && within(state, CAMP_EXIT)) return 'Walk west to leave camp';
  if (pathOpen(state) && within(state, CAMP_HOMESTEAD_EXIT)) return 'Walk east to the old homestead';
  if (!isInClearing(state)) return 'WASD / arrows  Move';
  if (livesInHouse(state)) return housePrompt(state);
  if (!isAtCamp(state)) return 'In the clearing · Watch the stars · Click an upgrade to build';
  if (state.timeOfDay < nightStart(state.day)) {
    const dish = defaultDish(state);
    return dish
      ? `Cook ${DISHES[dish].name} · Feed the fire · R Rest · Click an upgrade to build`
      : 'At camp · Cook · Feed the fire · R Rest · Click an upgrade to build';
  }
  const evening = sleepBlocker(state) ? 'Watch the stars · Feed the fire · R Rest' : 'Watch the stars · Z Sleep · Feed the fire';
  // Once there is something to cook, the prompt names it.
  const dish = defaultDish(state);
  return dish ? `Cook ${DISHES[dish].name} · ${evening}` : `At camp · Cook · ${evening}`;
}

/** Living in the house: home is for resting, sleeping and cooking, and the campfire is there to feed if wanted. */
function housePrompt(state: GameState): string {
  const night = state.timeOfDay >= nightStart(state.day);
  if (isAtHome(state)) {
    const dish = defaultDish(state);
    if (!night) return dish
      ? `Cook ${DISHES[dish].name} · R Rest · Click an upgrade to build`
      : 'At home · Cook · R Rest · Click an upgrade to build';
    return dish ? `Cook ${DISHES[dish].name} · Watch the stars · Z Sleep` : 'At home · Cook · Watch the stars · Z Sleep';
  }
  if (!isAtCamp(state)) return 'In the clearing · Watch the stars · Click an upgrade to build';
  return night ? 'At the campfire · Watch the stars · Feed the fire' : 'At the campfire · Feed the fire · Click an upgrade to build';
}

/** A pressed action says its line. A step says nothing, unless it crossed into another area: that's a line the player has to hear. */
export function lineToSay(before: GameState, after: GameState, message: string, announce: boolean): string {
  return announce || before.area !== after.area ? message : '';
}

/** Going in at the finished keep's door, or the finished hall's: to bed at night, otherwise up to the top. */
const doorChoice = (state: GameState, building: 'keep' | 'hall'): Choice =>
  ({ label: withKeepDoor(state, { type: 'enterKeep' }).type === 'sleep' ? `Sleep in the ${building} until morning` : 'Climb to the top', action: { type: 'enterKeep' } });

/** The keep, when the survivor is at it: what it wants next, or what they can do with it once it is finished. */
function keepChoice(state: GameState): Choice | null {
  if (!keepOpen(state) || !within(state, KEEP_SITE)) return null;
  if (keepFinished(state)) return doorChoice(state, 'keep');
  if (!keepNeedsDoor(state)) {
    return state.inventory.stone > 0
      ? { label: `Lay a stone (${state.keep.stones}/${KEEP_STONES})`, action: { type: 'layStone' } }
      : { label: 'Keep · bring stone up from the quarry' };
  }
  if (!state.progress.workshop.hinges) return { label: 'Keep · make iron hinges at the forge' };
  return availableWood(state) < KEEP_DOOR_WOOD ? { label: `Keep · needs ${KEEP_DOOR_WOOD} wood for the door` } : { label: 'Hang the door', action: { type: 'hangDoor' } };
}

/** EASTER EGG: the castle's work nearest the survivor, when it is within reach. */
function castleChoice(state: GameState): Choice | null {
  const spot = nearestCastleSpot(state);
  if (!spot || !within(state, spot)) return null;
  const label = castlePrompt(state, spot);
  return castleWorkBlocker(state, spot.site) === null ? { label, action: { type: 'castleWork', site: spot.site } } : { label };
}

/** EASTER EGG: the stone cart, when the survivor is at it: what it holds, and a load to take from it. */
export function cartChoice(state: GameState): Choice | null {
  if (!cartWithin(state)) return null;
  const { stone } = state.castle.cart;
  const load = `${stone}/${NEEDS.cartStone}`;
  if (stone < 1) return { label: `Cart · empty (${load})` };
  if (freeSpaces(state) < spaceFor('stone')) return { label: `Cart · your bag is full (${load})` };
  return { label: `Take stone from the cart (${load})`, action: { type: 'takeCartStone' } };
}

/** EASTER EGG: the cart's load as a plain label, when it is made and stands in the survivor's area, so work near it shows it filling. */
export function cartLoadNote(state: GameState): string | null {
  const { stone, at } = state.castle.cart;
  return state.progress.workshop.stoneCart && at === state.area ? `Cart ${stone}/${NEEDS.cartStone}` : null;
}

/** Whether the castle work in reach takes stone, so the cart's load is worth showing beside it. */
function stoneWork(state: GameState): boolean {
  return castleChoice(state) !== null && castleNeedsStone(state, nearestCastleSpot(state));
}

/** The load beside the work it follows: the quarry face, the rubble or an open castle site, but not at the cart, which names its own load. */
function withCartLoad(state: GameState, prompt: string, nearWork: boolean): string {
  const note = cartLoadNote(state);
  return note && nearWork && !cartWithin(state) ? `${prompt} · ${note}` : prompt;
}

function hillsChoices(state: GameState): Choice[] {
  const found = closestGatherable(state);
  const keep = keepChoice(state) ?? (atHallDoor(state) ? doorChoice(state, 'hall') : null);
  const castle = castleChoice(state);
  const cart = cartChoice(state);
  // EASTER EGG: the castle's line of old stones, named only once it has been seen.
  const stones = isRevealed(state) && state.castle.frames === 0 && !castle && lineDistance(state.player) <= BALANCE.interactionRadius;
  const offer = ponyOfferLabel(state);
  const note = ponyNote(state);
  const outcrop = !found && within(state, OUTCROP_SITE) ? outcropNote(state) : null;
  return [
    ...(found ? [gatherChoice(state, found)] : []),
    ...(outcrop ? [{ label: outcrop }] : []),
    ...(keep ? [keep] : []),
    ...(castle ? [castle] : []),
    ...(cart ? [cart] : []),
    ...(stones ? [{ label: 'Old stones · a wall could run here' }] : []),
    ...(offer ? [{ label: offer, action: { type: 'offerPony' as const } }] : []),
    ...(note ? [{ label: note }] : [])
  ];
}

function hillsPrompt(state: GameState): string {
  const labels = choiceLabels(hillsChoices(state));
  if (labels.length) return withCartLoad(state, labels.join(' · '), stoneWork(state));
  if (within(state, HILLS_EXIT)) return 'Walk east to go back down';
  return 'WASD / arrows  Move';
}

/** Everything in reach in the quarry area: a loose pile first, then the rubble or the quarry face. */
function quarryChoices(state: GameState): Choice[] {
  const found = closestGatherable(state);
  const castle = castleChoice(state);
  const cart = cartChoice(state);
  if (!found && within(state, QUARRY_SITE) && !mineBlocker(state)) return [{ label: 'Build timber mine', action: { type: 'buildMine' } }];
  return [...(found ? [gatherChoice(state, found)] : []), ...(castle ? [castle] : []), ...(cart ? [cart] : [])];
}

/** The quarry's prompt, with the road's beside it when the survivor is at the road. */
function quarryPrompt(state: GameState): string {
  const nearWork = within(state, QUARRY_SITE) || within(state, RUBBLE_SITE);
  return withCartLoad(state, quarryRoadPrompt(state), nearWork || stoneWork(state));
}

function quarryRoadPrompt(state: GameState): string {
  const base = quarryBasePrompt(state);
  const castle = castleChoice(state) ?? cartChoice(state);
  if (!castle) return base;
  const label = castle.action && useKeyAction(state)?.type === castle.action.type ? `E  ${castle.label}` : castle.label;
  return base === 'WASD / arrows  Move' ? label : `${base} · ${label}`;
}

function quarryBasePrompt(state: GameState): string {
  const found = closestGatherable(state);
  if (found) {
    const [label] = choiceLabels([gatherChoice(state, found)]);
    if (!within(state, QUARRY_SITE)) return label;
    if (found.kind === 'pile') return `${label} · ${quarryFaceNote(state)}`;
    if (found.kind === 'quarry') return `${label}${mineStatus(state)}`;
    return label;
  }
  if (within(state, QUARRY_SITE)) {
    if (!mineBlocker(state)) return 'E  Build timber mine · 16 wood · 4 fiber';
    return `Quarry · worked out until morning${mineStatus(state)}`;
  }
  if (within(state, QUARRY_EXIT)) return 'Walk east to return to camp';
  if (hillsPathOpen(state) && within(state, QUARRY_HILLS_EXIT)) return 'Walk west to the hills';
  return 'WASD / arrows  Move';
}

/** What the quarry face is doing, for when E is busy with a loose pile beside it. */
function quarryFaceNote(state: GameState): string {
  if (state.quarryReadyDay > state.day && (!state.progress.mineBuilt || state.mineReadyDay > state.day)) return `Quarry · worked out until morning${mineStatus(state)}`;
  return state.progress.pickaxeCrafted ? `Quarry · tap the face to dig${mineStatus(state)}` : 'Quarry · craft a pickaxe at the toolshed';
}

function mineStatus(state: GameState): string {
  if (!state.progress.pickaxeCrafted) return '';
  if (!state.progress.mineBuilt) return ' · Build tab: timber mine (16 wood · 4 fiber)';
  const digs = Number(state.quarryReadyDay <= state.day) + Number(state.mineReadyDay <= state.day);
  return ` · Mine: ${digs} ${digs === 1 ? 'dig' : 'digs'} left`;
}

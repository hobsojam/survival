import { isWinter, nightStart } from '../game/calendar';
import { BALANCE, LOOKOUT, SITES, type GameState, type ResourceKind, type SiteId, type TreeNode } from '../game/state';
import { isAtCamp, isInClearing, mineBlocker, sleepBlocker, type GameAction } from '../game/rules';
import { CAMP_EXIT, QUARRY_EXIT, QUARRY_SITE, RUBBLE_SITE, pathOpen } from '../game/areas';
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
  chopTree: 'gather', pickUpStone: 'gather', gatherRubble: 'gather', digQuarry: 'gather', fish: 'gather'
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

/** Gathering what is in reach; at the quarry face, digging it. */
function gatherChoice(state: GameState, found: Gatherable): Choice {
  switch (found.kind) {
    case 'node': {
      // E still tries a bare winter bush, so the survivor hears why it is empty.
      const bare = found.node.kind === 'berry' && isWinter(state.day);
      return { label: bare ? 'Search the bare bush' : GATHER_PROMPTS[found.node.kind], action: { type: 'gather', nodeId: found.node.id } };
    }
    case 'pile': return { label: `Pick up stone (×${found.pile.count})`, action: { type: 'pickUpStone', pileId: found.pile.id } };
    case 'rubble': return { label: 'Gather rubble', action: { type: 'gatherRubble' } };
    default: return state.progress.pickaxeCrafted
      ? { label: 'Dig the quarry', action: { type: 'digQuarry' } }
      : { label: 'Quarry · craft a pickaxe at the toolshed' };
  }
}

/** Everything in reach at camp, in the order E would use it: gathering, then the lookout, a place or a tree, then an offering. */
function campChoices(state: GameState): Choice[] {
  const found = closestGatherable(state);
  const site = closestSite(state);
  const nearby = lookoutChoice(state) ?? (site ? { label: sitePrompt(state, site.id), action: { type: 'visitSite', siteId: site.id } as GameAction } : null) ?? treeChoice(state);
  const animal = offerFor(state);
  const offer: Choice | null = animal ? { label: offerPrompt(state, animal), action: { type: 'befriend' } } : null;
  return [found ? gatherChoice(state, found) : null, nearby, offer].filter((choice): choice is Choice => choice !== null);
}

/** E gets the first choice it would act on; the rest are named plainly, to click. */
function choiceLabels(choices: Choice[]): string[] {
  const used = choices.findIndex(choice => choice.action);
  return choices.map((choice, index) => (index === used ? `E  ${choice.label}` : choice.label));
}

/** What E does: the first thing in reach it can use, as a tap on it would, or a rest at home with nothing to use. */
export function useKeyAction(state: GameState): GameAction | undefined {
  const choices = state.area === 'quarry' ? quarryChoices(state) : campChoices(state);
  return choices.find(choice => choice.action)?.action ?? (isAtHome(state) ? { type: 'rest' } : undefined);
}

/** The scene effect an action that changed the game plays, and where: dust off the quarry face, or steam or a star by the survivor. */
export function actionEffect(action: GameAction, after: GameState): { kind: 'dust' | 'cook' | 'stargaze'; x: number; y: number } | undefined {
  if (action.type === 'digQuarry') return { kind: 'dust', ...QUARRY_SITE };
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

/** Everything in reach in the quarry area: a loose pile first, then the rubble or the quarry face. */
function quarryChoices(state: GameState): Choice[] {
  const found = closestGatherable(state);
  if (!found && within(state, QUARRY_SITE) && !mineBlocker(state)) return [{ label: 'Build timber mine', action: { type: 'buildMine' } }];
  return found ? [gatherChoice(state, found)] : [];
}

function quarryPrompt(state: GameState): string {
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

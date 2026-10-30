import { isWinter, nightStart } from '../game/calendar';
import { BALANCE, LOOKOUT, SITES, type GameState, type ResourceKind, type SiteId, type TreeNode } from '../game/state';
import { isAtCamp, isInClearing, sleepBlocker, type GameAction } from '../game/rules';
import { CAMP_EXIT, QUARRY_EXIT, QUARRY_SITE, RUBBLE_SITE, pathOpen } from '../game/areas';
import { choppableTrees } from '../game/clearing';
import { sitePrompt } from '../game/sitePrompt';
import { OFFER_PROMPT, offerFor } from '../game/companion';
import { closestGatherable, type Gatherable } from './tapTarget';
import type { SurvivorAction } from './survivorVisual';

/** Single-press keys that map straight to an action; E, X and V need a target and are handled apart. */
export const KEY_ACTIONS: readonly [string, GameAction][] = [
  ['F', { type: 'stokeFire' }], ['R', { type: 'rest' }], ['Q', { type: 'eat' }], ['T', { type: 'eatTrailFood' }],
  ['P', { type: 'prepareTrailFood' }], ['C', { type: 'cook' }], ['G', { type: 'stargaze' }], ['Z', { type: 'sleep' }],
  ['L', { type: 'repairLookout' }], ['O', { type: 'befriend' }]
];

const ACTION_POSES: Partial<Record<GameAction['type'], SurvivorAction>> = {
  gather: 'gather', rest: 'rest', cook: 'cook', stargaze: 'stargaze',
  chopTree: 'gather', pickUpStone: 'gather', gatherRubble: 'gather', digQuarry: 'gather'
};

/** The survivor's pose for an action that changed the game, if it has one. */
export function actionPose(type: GameAction['type']): SurvivorAction | undefined {
  return ACTION_POSES[type];
}

const GATHER_PROMPTS: Record<ResourceKind, string> = {
  branch: 'E  Pick up fallen branches', berry: 'E  Pick berries', fiber: 'E  Gather fiber', stone: 'E  Collect stone'
};

function gatherPrompt(found: Gatherable, winter: boolean): string {
  // E still tries a bare winter bush, so the survivor hears why it is empty.
  if (found.kind === 'node' && found.node.kind === 'berry' && winter) return 'E  Search the bare bush';
  if (found.kind === 'pile') return `E  Pick up stone (×${found.pile.count})`;
  return found.kind === 'node' ? GATHER_PROMPTS[found.node.kind] : GATHER_PROMPTS.branch;
}

/** What E does: gather the nearest thing in reach, or rest when there is nothing to gather at camp. */
export function gatherKeyAction(state: GameState): GameAction | undefined {
  const found = closestGatherable(state);
  switch (found?.kind) {
    case 'node': return { type: 'gather', nodeId: found.node.id };
    case 'pile': return { type: 'pickUpStone', pileId: found.pile.id };
    case 'rubble': return { type: 'gatherRubble' };
    case 'quarry': return { type: 'digQuarry' };
    default: return isAtCamp(state) ? { type: 'rest' } : undefined;
  }
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
  const found = closestGatherable(state);
  if (state.area === 'quarry') return quarryPrompt(state, found);
  const site = closestSite(state);
  const nearby = lookoutPrompt(state) || (site ? sitePrompt(state, site.id) : '') || treePrompt(state);
  const animal = offerFor(state);
  const offer = animal ? `O  ${OFFER_PROMPT[animal]}` : '';
  const gather = found ? gatherPrompt(found, isWinter(state.day)) : '';
  const parts = [gather, nearby, offer].filter(Boolean);
  if (gather && parts.length === 1 && !sleepBlocker(state)) return `${gather} · Z Sleep until morning`;
  // An offering alone keeps the camp's own hints beside it.
  if (parts.length === 1 && offer) return `${offer} · ${campPrompt(state)}`;
  return parts.length ? parts.join(' · ') : campPrompt(state);
}

function lookoutPrompt(state: GameState): string {
  if (!within(state, LOOKOUT)) return '';
  if (state.progress.lookoutRepaired) return 'The lookout stands again';
  if (state.progress.hearthUnlocked) return 'L  Repair lookout';
  return 'Lookout · weather the cold night first';
}

function treePrompt(state: GameState): string {
  const tree = closestTree(state);
  if (!tree) return '';
  if (tree.readyDay === Number.MAX_SAFE_INTEGER) return 'Stump · this ground is being cleared';
  if (tree.readyDay > state.day) return `Stump · regrows day ${tree.readyDay}`;
  if (state.progress.axeCrafted) return 'X  Chop mature tree';
  return 'Mature tree · craft an axe at camp';
}

function campPrompt(state: GameState): string {
  if (pathOpen(state) && within(state, CAMP_EXIT)) return 'Walk west to leave camp';
  if (!isInClearing(state)) return 'WASD / arrows  Move';
  if (!sleepBlocker(state)) return 'At camp · C Cook · G Stargaze · Z Sleep · F Fire';
  if (state.timeOfDay >= nightStart(state.day)) return 'At camp · C Cook · G Stargaze · F Fire · R Rest';
  return 'At camp · F Fire · R Rest · Click an upgrade to build';
}

function quarryPrompt(state: GameState, found: Gatherable | undefined): string {
  if (found?.kind === 'pile') {
    const pile = `E  Pick up stone (×${found.pile.count})`;
    return within(state, QUARRY_SITE) ? `${pile} · ${quarryFaceNote(state)}` : pile;
  }
  if (found?.kind === 'rubble') return 'E  Gather rubble';
  if (found?.kind === 'quarry') return state.progress.pickaxeCrafted ? 'E  Dig the quarry' : 'Quarry · craft a pickaxe at the toolshed';
  if (within(state, QUARRY_SITE) && state.quarryReadyDay > state.day) return 'Quarry · worked out until morning';
  if (within(state, QUARRY_EXIT)) return 'Walk east to return to camp';
  return 'WASD / arrows  Move';
}

/** What the quarry face is doing, for when E is busy with a loose pile beside it. */
function quarryFaceNote(state: GameState): string {
  if (state.quarryReadyDay > state.day) return 'Quarry · worked out until morning';
  return state.progress.pickaxeCrafted ? 'Quarry · tap the face to dig' : 'Quarry · craft a pickaxe at the toolshed';
}

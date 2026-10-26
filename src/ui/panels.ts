import { nightStart } from '../game/calendar';
import { BALANCE, BUILDINGS, SITES, type GameState, type SiteId, type StructureId } from '../game/state';
import { workSeconds } from '../game/needs';
import { axeBlocker, bagCapacity, buildStatus, carriedCount, isAtCamp, isColdNight, lookoutRepairBlocker, pickaxeBlocker, trailFoodBlocker } from '../game/rules';
import { forecastFireCheck, logsForColdNight } from '../game/forecast';
import type { LoadResult } from '../game/save';

/** What a panel with one action button shows: its heading, its copy, its price line and its button state. */
export interface ActionPanelView { title: string; copy: string; cost: string; disabled: boolean; ready: boolean }

export function lookoutView(state: GameState): ActionPanelView {
  const { hearthUnlocked, lookoutRepaired } = state.progress;
  const button = { disabled: !hearthUnlocked || lookoutRepaired, ready: !lookoutRepairBlocker(state) };
  if (lookoutRepaired) {
    return { ...button, title: 'A place to call home', copy: 'The old lookout stands again. The paths are still yours to explore.', cost: 'Restored' };
  }
  if (hearthUnlocked) {
    return { ...button, title: 'Restore the old lookout', copy: 'Follow the northeast path to the lookout. Bring the repair materials and stand beside it.', cost: '4 wood · 2 fiber · 2 stone' };
  }
  return { ...button, title: 'The old lookout', copy: 'A damaged lookout waits along the northeast path. Weather the cold front before repairing it.', cost: 'Unlocks after the cold front' };
}

export function axeView(state: GameState): ActionPanelView {
  const { hearthUnlocked, axeCrafted } = state.progress;
  const button = { disabled: !hearthUnlocked || axeCrafted, ready: !axeBlocker(state) };
  if (axeCrafted) {
    return { ...button, title: 'Stone axe ready', copy: 'Tap a mature tree, or stand by one and press X, to gather two wood. Stumps regrow after three dawns.', cost: 'Crafted' };
  }
  if (hearthUnlocked) {
    const copy = state.structures.toolshed
      ? 'Use stone, fiber, and wood at camp to work with the mature trees. Fallen branches remain easy to gather.'
      : 'Build a toolshed first.';
    return { ...button, title: 'Craft a stone axe', copy, cost: '1 wood · 1 fiber · 1 stone' };
  }
  return { ...button, title: 'Stone axe', copy: 'Weather the cold front to learn how to make a useful forest tool.', cost: 'Unlocks after the cold front' };
}

/** The pickaxe row only shows once the quarry is found. */
export function pickaxeView(state: GameState): ActionPanelView & { shown: boolean } {
  const { quarryFound, pickaxeCrafted } = state.progress;
  const blocker = pickaxeBlocker(state);
  const button = { shown: quarryFound, disabled: !quarryFound || pickaxeCrafted, ready: quarryFound && !blocker };
  if (pickaxeCrafted) {
    return { ...button, title: 'Pickaxe ready', copy: 'Tap the quarry face, or stand at it and press E, to dig a stone. It is ready again each dawn.', cost: 'Crafted' };
  }
  return { ...button, title: 'Craft a pickaxe', copy: blocker ?? 'Your toolshed is ready. Craft a pickaxe to work the quarry face.', cost: '2 wood · 1 fiber · 2 stone' };
}

/** The places along the paths found so far, for the Follow the paths panel. */
export function sitesFound(state: GameState): string {
  const found = (Object.keys(SITES) as SiteId[]).filter(id => state.progress.discoveries[id]).map(id => SITES[id].name);
  return `Places found: ${found.length ? found.join(', ') : 'none yet'}`;
}

export function nightHint(state: GameState): string {
  if (state.timeOfDay < nightStart(state.day)) return 'These small moments are waiting for nightfall.';
  if (!isAtCamp(state)) return 'Return to the camp circle for a quiet evening.';
  return 'Optional comforts while the night passes.';
}

export interface ForecastView { active: boolean; weathered: boolean; title: string; copy: string; shelter: string; fire: string }

// A cold night always needs two to three logs: 132 s to 220 s of fuel at 90 s a log.
const LOG_WORDS: Record<number, string> = { 2: 'two', 3: 'three' };

export function forecastView(state: GameState): ForecastView {
  const storm = isColdNight(state);
  const weathered = state.progress.hearthUnlocked;
  if (weathered) {
    return { active: storm, weathered, title: 'The cold night is behind you', copy: 'You kept your camp warm through dawn. The stone hearth is ready to build.',
      shelter: '✓ Shelter held firm', fire: '✓ Hearth unlocked' };
  }
  const day = state.progress.nextStormDay!;
  const sheltered = state.structures.shelter;
  return {
    active: storm, weathered,
    title: storm ? 'The cold front is here' : `Cold front · day ${day} night`,
    copy: storm ? 'Stay at camp and keep the fire alive until dawn.' : `Build a shelter and bring ${LOG_WORDS[logsForColdNight(day)]} logs to camp before nightfall on day ${day}.`,
    shelter: sheltered ? '✓ Shelter ready' : '○ Shelter needed',
    fire: forecastFireCheck(state)
  };
}

/** The line under the start screen's buttons, about the save waiting in this browser. */
export function startNote(save: LoadResult, storageAvailable: boolean): string {
  if (!storageAvailable) return 'Browser storage is unavailable, so this camp will not be saved.';
  if (save.kind === 'loaded') return `Your camp is waiting on day ${save.state.day}.`;
  if (save.kind === 'invalid') return `Your existing save could not be loaded: ${save.reason}`;
  return 'A fresh camp is ready whenever you are.';
}

export interface BagView { spaces: string; prepareReady: boolean; prepareHint: string; pileShown: boolean; storedAtCamp: string; pileStored: string; fire: string }

export function bagView(state: GameState): BagView {
  const prepareBlocker = trailFoodBlocker(state);
  const pile = state.structures.stonePile;
  return {
    spaces: `${carriedCount(state)}/${bagCapacity(state)}`,
    prepareReady: !prepareBlocker,
    prepareHint: prepareBlocker ?? `1 berry · ${workSeconds(state, BALANCE.trailFoodSeconds)} seconds · 1 ration`,
    pileShown: pile,
    storedAtCamp: pile ? `+${state.storedStone} at camp` : '',
    pileStored: `Stored stone ${state.storedStone}/${BALANCE.stonePileCapacity}`,
    fire: state.fireFuel > 0 ? `Fire burning · ${Math.ceil(state.fireFuel)}s of warmth` : 'The fire is unlit'
  };
}

export interface BuildButtonView { disabled: boolean; built: boolean; locked: boolean; ready: boolean; description: string; verb: string; price: string }

const BLOCKED_LABELS = { built: ['Built', 'Complete'], locked: ['Locked', 'Weather cold night'] } as const;

export function buildButtonView(state: GameState, id: StructureId): BuildButtonView {
  const status = buildStatus(state, id);
  const definition = BUILDINGS[id];
  const cost = definition.cost;
  const stone = 'stone' in cost ? cost.stone : 0;
  const price = [`${cost.wood} wood`, cost.fiber ? `${cost.fiber} fiber` : '', stone ? `${stone} stone` : ''].filter(Boolean).join(' · ');
  const needsShelter = status === 'needsShelter';
  const view = {
    disabled: status === 'built' || status === 'locked' || needsShelter,
    built: status === 'built',
    locked: status === 'locked' || needsShelter,
    ready: status === 'ready',
    description: needsShelter ? 'Requires shelter' : definition.description,
    verb: needsShelter ? 'Blocked' : 'Build',
    price
  };
  if (status === 'built' || status === 'locked') {
    const [verb, label] = BLOCKED_LABELS[status];
    return { ...view, verb, price: label };
  }
  return view;
}

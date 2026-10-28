import { isWinter, nightStart } from '../game/calendar';
import { BALANCE, BUILDINGS, type GameState, type StructureId } from '../game/state';
import { workSeconds } from '../game/needs';
import { axeBlocker, treeRegrowDays, bagCapacity, buildStatus, carriedCount, isAtCamp, isColdNight, isFreezingNight, lookoutRepairBlocker, pickaxeBlocker, trailFoodBlocker } from '../game/rules';
import { forecastFireCheck, logsForColdNight } from '../game/forecast';
import type { LoadResult } from '../game/save';
import { KEEPSAKES_NEEDED, cloakBlocker, keepsakeKind, pillowBlocker } from '../game/companion';

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
    return { ...button, title: 'Stone axe ready', copy: `Tap a mature tree, or stand by one and press X, to gather two wood. Stumps regrow after ${treeRegrowDays(state.day) === 2 ? 'two' : 'three'} dawns.`, cost: 'Crafted' };
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

/** The fur or feathers gathered toward the friend's one item; gone once it is made. */
export function keepsakeView(state: GameState): { shown: boolean; text: string } {
  const { friend, keepsakes, pillow, cloak } = state.companion;
  if (!friend || pillow || cloak) return { shown: false, text: '' };
  return { shown: true, text: `${keepsakeKind(friend) === 'feather' ? 'Feathers' : 'Fur'} ${keepsakes}/${KEEPSAKES_NEEDED}` };
}

function keepsakeItemView(made: boolean, shown: boolean, blocker: string | null,
  words: { title: string; ready: string; done: string; cost: string }): ActionPanelView & { shown: boolean } {
  if (made) return { shown, title: words.title, copy: words.done, cost: 'Made', disabled: true, ready: false };
  return { shown, title: words.title, copy: blocker ?? words.ready, cost: words.cost, disabled: false, ready: !blocker };
}

export function pillowView(state: GameState): ActionPanelView & { shown: boolean } {
  return keepsakeItemView(state.companion.pillow, state.companion.friend === 'bird', pillowBlocker(state), {
    title: 'Feather pillow', ready: 'Your bird\'s feathers would make the bed softer.', done: 'Resting in the bed goes a little deeper.',
    cost: `${KEEPSAKES_NEEDED} feathers`
  });
}

export function cloakView(state: GameState): ActionPanelView & { shown: boolean } {
  const friend = state.companion.friend;
  return keepsakeItemView(state.companion.cloak, friend === 'fox' || friend === 'wolf', cloakBlocker(state), {
    title: 'Fur cloak', ready: 'Enough fur for a warm cloak against the night.', done: 'The nights bite a little less.',
    cost: `${KEEPSAKES_NEEDED} fur`
  });
}

/** The places along the paths found so far, for the Follow the paths panel. */
export function nightHint(state: GameState): string {
  if (state.timeOfDay < nightStart(state.day)) return 'These small moments are waiting for nightfall.';
  if (!isAtCamp(state)) return 'Return to the camp circle for a quiet evening.';
  return 'Optional comforts while the night passes.';
}

export interface ForecastView { active: boolean; title: string; copy: string; shelter: string; fire: string;
  /** Shown only while a front is due or under way, or in winter: otherwise there is nothing to forecast. */
  shown: boolean }

// A cold night always needs two to three logs: 132 s to 220 s of fuel at 90 s a log.
const LOG_WORDS: Record<number, string> = { 2: 'two', 3: 'three' };

/** Once the cold front is behind the survivor, winter's nights take over the forecast. */
function winterForecast(state: GameState): ForecastView {
  const active = isFreezingNight(state);
  return {
    active, shown: true,
    title: active ? 'A bitter night' : 'Winter nights',
    copy: 'Winter nights are bitter. Keep the fire alive until dawn, or the wolves will come close.',
    shelter: state.structures.shelter ? '✓ Shelter ready' : '○ Shelter needed',
    fire: forecastFireCheck(state)
  };
}

export function forecastView(state: GameState): ForecastView {
  const storm = isColdNight(state);
  if (state.progress.hearthUnlocked) {
    // With the front weathered, only winter's nights are left to forecast.
    return isWinter(state.day) ? winterForecast(state) : { active: false, shown: false, title: '', copy: '', shelter: '', fire: '' };
  }
  const day = state.progress.nextStormDay!;
  const sheltered = state.structures.shelter;
  return {
    active: storm, shown: true,
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
  const price = [cost.wood ? `${cost.wood} wood` : '', cost.fiber ? `${cost.fiber} fiber` : '', stone ? `${stone} stone` : ''].filter(Boolean).join(' · ');
  const needsPrerequisite = status === 'needsPrerequisite' || status === 'needsShelter';
  const prerequisite = definition.prerequisite;
  const prerequisiteNames: string[] = [];
  if (prerequisite && prerequisite !== 'coldNight') prerequisiteNames.push(BUILDINGS[prerequisite].name.toLowerCase());
  if ('alsoRequires' in definition) prerequisiteNames.push(BUILDINGS[definition.alsoRequires].name.toLowerCase());
  const prerequisiteDescription = prerequisiteNames.length ? `Requires ${prerequisiteNames.join(' and ')}` : 'Requires its previous shelter upgrade';
  const view = {
    disabled: status === 'built' || status === 'locked' || needsPrerequisite,
    built: status === 'built',
    locked: status === 'locked' || needsPrerequisite,
    ready: status === 'ready',
    description: needsPrerequisite ? prerequisiteDescription : definition.description,
    verb: needsPrerequisite ? 'Blocked' : 'Build',
    price
  };
  if (status === 'built' || status === 'locked') {
    const [verb, label] = BLOCKED_LABELS[status];
    return { ...view, verb, price: label };
  }
  return view;
}

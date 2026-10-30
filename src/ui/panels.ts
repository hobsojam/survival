import { isWinter, nightStart } from '../game/calendar';
import { foodCount, goingSoft } from '../game/food';
import { foodIconUrl } from '../art/foodIcons';
import { BALANCE, BUILDINGS, type GameState, type StructureId } from '../game/state';
import { gardenPlotLabel, gardenPlotStage } from '../game/garden';
import { workSeconds } from '../game/needs';
import { axeBlocker, treeRegrowDays, bagCapacity, buildStatus, carriedCount, harvestGardenBlocker, isInClearing, isColdNight, isFreezingNight, lookoutRepairBlocker, plantGardenBlocker, pickaxeBlocker, trailFoodBlocker } from '../game/rules';
import { forecastFireCheck, logsForColdNight } from '../game/forecast';
import type { LoadResult } from '../game/save';
import { CLEARING_STEPS, clearGroundBlocker, markBlocker, nextStep, roomLine, type Side } from '../game/clearing';
import { KEEPSAKES_NEEDED, cloakBlocker, keepsakeKind, pillowBlocker } from '../game/companion';

export interface GardenPlotPanelView {
  label: string;
  plantDisabled: boolean;
  plantTitle: string;
  harvestDisabled: boolean;
  harvestTitle: string;
}

export interface GardenPanelView { shown: boolean; hint: string; plots: GardenPlotPanelView[] }

export function gardenPanelView(state: GameState): GardenPanelView {
  const shown = state.structures.garden;
  const plots = state.gardenPlots.map((plot, index) => {
    const plantBlocker = plantGardenBlocker(state, index);
    const harvestBlocker = harvestGardenBlocker(state, index);
    return {
      label: gardenPlotLabel(gardenPlotStage(state, plot), plot.harvestReady),
      plantDisabled: Boolean(plantBlocker),
      plantTitle: plantBlocker ?? 'Plant a berry bush.',
      harvestDisabled: Boolean(harvestBlocker),
      harvestTitle: harvestBlocker ?? 'Pick 2 berries.'
    };
  });
  const hint = shown
    ? 'Plant one berry in spring. Each bush bears berries every autumn and will wait safely until picked.'
    : 'Build a garden from the Build tab to plant berry bushes.';
  return { shown, hint, plots };
}

export function gardenPlotMarkup(plot: GardenPlotPanelView, index: number): string {
  const plantDisabled = plot.plantDisabled ? ` disabled title="${plot.plantTitle}"` : '';
  const harvestDisabled = plot.harvestDisabled ? ` disabled title="${plot.harvestTitle}"` : '';
  return `<div class="garden-plot"><span><strong>Plot ${index + 1}</strong><small>${plot.label}</small></span><button type="button" data-action="plantGarden" data-plot-index="${index}"${plantDisabled}>Plant</button><button type="button" data-action="harvestGarden" data-plot-index="${index}"${harvestDisabled}>Pick</button></div>`;
}

/** What a panel with one action button shows: its heading, its copy, its price line and its button state. */
export interface ActionPanelView { title: string; copy: string; cost: string; disabled: boolean; ready: boolean }

export function lookoutView(state: GameState): ActionPanelView {
  const { hearthUnlocked, lookoutRepaired } = state.progress;
  const button = { disabled: !hearthUnlocked || lookoutRepaired, ready: !lookoutRepairBlocker(state) };
  if (lookoutRepaired) {
    return { ...button, title: 'A place to call home', copy: 'The old lookout stands again. Your journal surveys the areas beyond camp.', cost: 'Restored' };
  }
  if (hearthUnlocked) {
    return { ...button, title: 'Restore the old lookout', copy: 'Repair it to survey the areas beyond camp. Follow the northeast path and stand beside it.', cost: '4 wood · 2 fiber · 2 stone' };
  }
  return { ...button, title: 'The old lookout', copy: 'A damaged lookout waits along the northeast path. Weather the cold night before repairing it.', cost: 'Unlocks after the cold night' };
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
  return { ...button, title: 'Stone axe', copy: 'Weather the cold night to learn how to make a useful forest tool.', cost: 'Unlocks after the cold night' };
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
  if (!isInClearing(state)) return 'Return to the clearing for a quiet evening.';
  return 'Optional comforts while the night passes.';
}

export interface ForecastView { active: boolean; title: string; copy: string; shelter: string; fire: string;
  /** Shown only while a cold night is due or under way, or in winter: otherwise there is nothing to forecast. */
  shown: boolean }

// A cold night always needs two to three logs: 132 s to 220 s of fuel at 90 s a log.
const LOG_WORDS: Record<number, string> = { 2: 'two', 3: 'three' };

/** Once the cold night is behind the survivor, winter's nights take over the forecast. */
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
    // With the cold night weathered, only winter's nights are left to forecast.
    return isWinter(state.day) ? winterForecast(state) : { active: false, shown: false, title: '', copy: '', shelter: '', fire: '' };
  }
  const day = state.progress.nextStormDay!;
  const sheltered = state.structures.shelter;
  return {
    active: storm, shown: true,
    title: storm ? 'The cold night is here' : `Cold night · day ${day}`,
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

/** The Bag panel's forage cells, shown only while the bag holds some; all but pine needles can be eaten from here. */
export const BAG_FOODS = [
  { item: 'greens', label: 'Greens', eat: 'Eat a handful of greens' },
  { item: 'hazelnut', label: 'Hazelnuts', eat: 'Eat a hazelnut' },
  { item: 'honey', label: 'Honey', eat: 'Eat some honey' },
  { item: 'pineNeedles', label: 'Pine needles', eat: null },
  { item: 'roastedHazelnuts', label: 'Roasted hazelnuts', eat: 'Eat the roasted hazelnuts' }
] as const;
export type BagFood = (typeof BAG_FOODS)[number]['item'];

/** Every forage cell, hidden until the bag panel shows it. */
export function bagFoodMarkup(): string {
  return BAG_FOODS.map(({ item, label, eat }) => {
    const button = eat ? `<button type="button" class="supply-action" data-action="eat" data-item="${item}" data-supply="${item}" aria-label="${eat}">Eat</button>` : '';
    return `<div data-food="${item}" hidden><img class="food-icon" src="${foodIconUrl(item)}" alt=""><strong id="${item}-count">0</strong><small>${label}</small>${button}</div>`;
  }).join('');
}

export interface BagView { foods: Record<BagFood, { count: number; shown: boolean }>; berries: string; spaces: string; prepareReady: boolean; prepareHint: string; pileShown: boolean; storedAtCamp: string; pileStored: string; fire: string }

export function bagView(state: GameState): BagView {
  const prepareBlocker = trailFoodBlocker(state);
  const pile = state.structures.stonePile;
  const soft = goingSoft(state.inventory.food, 'berry', state.day, BALANCE.bagFreshDays);
  const foods = Object.fromEntries(BAG_FOODS.map(({ item }) => {
    const count = foodCount(state.inventory.food, item);
    return [item, { count, shown: count > 0 }];
  })) as BagView['foods'];
  return {
    foods,
    berries: `Berries ${foodCount(state.inventory.food, 'berry')}${soft ? ` (${soft} going soft)` : ''}`,
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

export interface ClearingSideView { side: Side; label: string; detail: string; disabled: boolean; done: boolean; chosen: boolean }

const CLEARING_SIDES: readonly Side[] = ['north', 'east', 'south', 'west'];

const capitalised = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

function clearingSideView(state: GameState, side: Side): ClearingSideView {
  const step = nextStep(state, side);
  const name = capitalised(side);
  if (!step) return { side, label: `${name} · cleared`, detail: '', disabled: true, done: true, chosen: false };
  const { trees, cost } = CLEARING_STEPS[step];
  const room = roomLine(step, state.structures, id => Object.hasOwn(BUILDINGS, id));
  const price = `${trees.length} trees, then ${cost.wood} wood and ${cost.fiber} fiber`;
  return {
    side,
    label: `${name} · ${step.endsWith('-far') ? 'far' : 'near'}`,
    detail: room ? `${price}.${room}` : price,
    disabled: Boolean(markBlocker(state, step)),
    done: false,
    chosen: state.clearing.marked === step
  };
}

/** The Build tab's "Clear the land" group: one choice per side, then the button that clears the marked ground. */
export function clearingView(state: GameState): { shown: boolean; sides: ClearingSideView[]; clear: ActionPanelView } {
  const { marked, felled } = state.clearing;
  const blocker = clearGroundBlocker(state);
  const clear = { title: 'Clear the ground', disabled: Boolean(blocker), ready: !blocker };
  const sides = CLEARING_SIDES.map(side => clearingSideView(state, side));
  const shown = state.progress.axeCrafted;
  if (!marked) return { shown, sides, clear: { ...clear, copy: 'Choose a side to mark its trees for felling.', cost: 'Choose a side first' } };
  const { side, trees, cost } = CLEARING_STEPS[marked];
  const left = trees.length - felled.length;
  const copy = left > 0 ? `Fell the ${left} marked ${left === 1 ? 'tree' : 'trees'} left on the ${side} side.` : `Ready to clear the ${side} side.`;
  return { shown, sides, clear: { ...clear, copy, cost: `${cost.wood} wood · ${cost.fiber} fiber` } };
}

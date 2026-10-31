import { daysLeftInSeason, isWinter, nightStart, season } from '../game/calendar';
import { FOOD_ITEMS, availableFood, foodCount, goingSoft, isFresh, keptFoodTotal, storeTotal, type FoodItem } from '../game/food';
import { foodIconUrl } from '../art/foodIcons';
import { BALANCE, BUILDINGS, type GameState, type StructureId } from '../game/state';
import { gardenPlotLabel, gardenPlotStage } from '../game/garden';
import { workSeconds } from '../game/needs';
import { hasWoodStore, livesInHouse, woodStoreCapacity } from '../game/home';
import { axeBlocker, treeRegrowDays, bagCapacity, buildStatus, carriedCount, groundBlocker, harvestGardenBlocker, isInClearing, isColdNight, isFreezingNight, lookoutRepairBlocker, packBlocker, plantGardenBlocker, pickaxeBlocker, storeFoodBlocker, takeFoodBlocker, trailFoodBlocker } from '../game/rules';
import { forecastFireCheck, logsForColdNight } from '../game/forecast';
import type { LoadResult } from '../game/save';
import { CLEARING_STEPS, clearGroundBlocker, markBlocker, nextStep, roomLine, type Side } from '../game/clearing';
import { KEEPSAKES_NEEDED, cloakBlocker, keepsakeKind, pillowBlocker } from '../game/companion';
import { DISHES, DISH_ORDER, dishBlocker, foodWord, ingredientList, potBlocker, type DishId } from '../game/cooking';

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

export function potView(state: GameState): ActionPanelView {
  if (state.progress.potCrafted) {
    return { title: 'Cooking pot', copy: 'It hangs over the fire. Cook tea, salad, roasted nuts and honey cake after dark.', cost: 'Made', disabled: true, ready: false };
  }
  const blocker = potBlocker(state);
  return { title: 'Cooking pot', copy: blocker ?? 'A pot on a little tripod, for tea, salad, roasted nuts and honey cake.', cost: '1 wood · 2 stone', disabled: false, ready: !blocker };
}

export function packView(state: GameState): ActionPanelView {
  if (state.progress.packWoven) {
    return { title: 'Woven pack', copy: `You wear it on your back. It carries ${BALANCE.packCapacity}.`, cost: 'Made', disabled: true, ready: false };
  }
  const blocker = packBlocker(state);
  return { title: 'Woven pack', copy: blocker ?? `A pack of woven fiber on a wooden frame, to carry ${BALANCE.packCapacity}.`, cost: '2 wood · 4 fiber', disabled: false, ready: !blocker };
}

export interface DishView { dish: Exclude<DishId, 'berries'>; name: string; icon: string; cost: string; disabled: boolean; title: string }

/** The After dark panel's pot dishes, once the pot is made: each says why it can't be cooked yet. */
export function nightDishesView(state: GameState): DishView[] {
  if (!state.progress.potCrafted) return [];
  return DISH_ORDER.filter((dish): dish is DishView['dish'] => DISHES[dish].potOnly).map(dish => {
    const blocker = dishBlocker(state, dish);
    const name = capitalised(DISHES[dish].name);
    return { dish, name, icon: foodIconUrl(dish), cost: `${ingredientList(dish)} · ${BALANCE.cookSeconds} seconds`, disabled: Boolean(blocker), title: blocker ?? `Cook ${DISHES[dish].name}.` };
  });
}

/** A hidden button for each pot dish in the After dark panel, shown once the pot is made. */
export function nightDishMarkup(): string {
  return DISH_ORDER.filter(dish => DISHES[dish].potOnly).map(dish =>
    `<button type="button" data-action="cook" data-dish="${dish}" id="dish-${dish}" hidden><img class="food-icon" src="${foodIconUrl(dish as DishView['dish'])}" alt=""><strong>${capitalised(DISHES[dish].name)}</strong><small>${ingredientList(dish)} · ${BALANCE.cookSeconds} seconds</small></button>`
  ).join('');
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
    copy: `Winter nights are bitter. Keep the ${livesInHouse(state) ? 'fireplace' : 'fire'} alive until dawn, or the wolves will come close.`,
    shelter: state.structures.shelter ? '✓ Shelter ready' : '○ Shelter needed',
    fire: forecastFireCheck(state)
  };
}

/** Autumn's last three days, with no cold night to warn of instead: the bushes are about to go bare. */
function lateAutumnForecast(state: GameState): ForecastView | null {
  const coldNightDue = !state.progress.hearthUnlocked && state.progress.nextStormDay !== null;
  if (coldNightDue || season(state.day) !== 'autumn' || daysLeftInSeason(state.day) > 3) return null;
  return {
    active: false, shown: true,
    title: 'The bushes will soon be bare',
    copy: 'Berries go soft in a few days, and the bushes stay bare all winter. Dry rations and gather hazelnuts before the snow comes.',
    shelter: `Food that keeps: ${keptFoodTotal(state)}`,
    fire: ''
  };
}

export function forecastView(state: GameState): ForecastView {
  const lateAutumn = lateAutumnForecast(state);
  if (lateAutumn) return lateAutumn;
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

/** Every forage cell, hidden until the bag panel shows it; fresh food has a line for what is going soft. */
export function bagFoodMarkup(): string {
  return BAG_FOODS.map(({ item, label, eat }) => {
    const button = eat ? `<button type="button" class="supply-action" data-action="eat" data-item="${item}" data-supply="${item}" aria-label="${eat}">Eat</button>` : '';
    const note = isFresh(item) ? `<small id="${item}-note" class="supply-note"></small>` : '';
    return `<div data-food="${item}" hidden><img class="food-icon" src="${foodIconUrl(item)}" alt=""><strong id="${item}-count">0</strong><small>${label}</small>${note}${button}</div>`;
  }).join('');
}

/** The foods the Bag panel has an Eat button for. */
export const EATABLE_FOODS = ['berry', 'trailFood', ...BAG_FOODS.filter(cell => cell.eat).map(cell => cell.item)] as const satisfies readonly FoodItem[];
export type EatableFood = (typeof EATABLE_FOODS)[number];

export interface BagView { foods: Record<BagFood, { count: number; shown: boolean; note: string }>; eatable: Record<EatableFood, boolean>; berries: string; spaces: string; spacesLabel: string; packHint: string; prepareReady: boolean; prepareHint: string; pileShown: boolean; storedAtCamp: string; pileStored: string; woodShown: boolean; woodAtCamp: string; woodStored: string; fiberShown: boolean; fiberAtCamp: string; fiberStored: string; fire: string }

export function bagView(state: GameState): BagView {
  const prepareBlocker = trailFoodBlocker(state);
  const pile = state.structures.stonePile;
  // The woodpile and, once the house stands, the woodshed keep one wood store between them.
  const woodStore = hasWoodStore(state);
  /** "(2 going soft)" for the bag's fresh pieces gone at the next dawn, or nothing. */
  const softNote = (item: FoodItem): string => {
    const soft = isFresh(item) ? goingSoft(state.inventory.food, item, state.day, BALANCE.bagFreshDays) : 0;
    return soft ? ` (${soft} going soft)` : '';
  };
  // Eat reaches the larder in the clearing, so a cell shows with its button while there is any to eat, even with none in the bag.
  const eatable = Object.fromEntries(EATABLE_FOODS.map(item => [item, availableFood(state, item) > 0])) as BagView['eatable'];
  const foods = Object.fromEntries(BAG_FOODS.map(({ item, eat }) => {
    const count = foodCount(state.inventory.food, item);
    return [item, { count, shown: count > 0 || (eat !== null && availableFood(state, item) > 0), note: softNote(item).trim() }];
  })) as BagView['foods'];
  return {
    foods,
    eatable,
    berries: `Berries ${foodCount(state.inventory.food, 'berry')}${softNote('berry')}`,
    spaces: `${carriedCount(state)}/${bagCapacity(state)}`,
    spacesLabel: state.progress.packWoven ? 'Carried · woven pack' : 'Carried',
    packHint: state.progress.packWoven ? '' : `Weave a pack at the toolshed to carry ${BALANCE.packCapacity}.`,
    prepareReady: !prepareBlocker,
    prepareHint: prepareBlocker ?? `1 berry · ${workSeconds(state, BALANCE.trailFoodSeconds)} seconds · 1 ration`,
    pileShown: pile,
    storedAtCamp: pile ? `+${state.storedStone} at camp` : '',
    pileStored: `Stored stone ${state.storedStone}/${BALANCE.stonePileCapacity}`,
    woodShown: woodStore,
    woodAtCamp: woodStore ? `+${state.storedWood} at camp` : '',
    woodStored: `Stored wood ${state.storedWood}/${woodStoreCapacity(state)}`,
    fiberShown: state.structures.fibreStack,
    fiberAtCamp: state.structures.fibreStack ? `+${state.storedFiber} at camp` : '',
    fiberStored: `Stored fiber ${state.storedFiber}/${BALANCE.fibreStackCapacity}`,
    fire: fireLine(state)
  };
}

/** The fire that keeps the survivor warm: the campfire's fuel, or once they live in the house, the fireplace and the logs it has to draw on. */
function fireLine(state: GameState): string {
  if (!livesInHouse(state)) return state.fireFuel > 0 ? `Fire burning · ${Math.ceil(state.fireFuel)}s of warmth` : 'The fire is unlit';
  const night = state.timeOfDay >= nightStart(state.day);
  if (night && state.fireplaceFuel <= 0 && state.storedWood === 0) return 'The fireplace is out. Stock the wood store.';
  const logs = `${state.storedWood} log${state.storedWood === 1 ? '' : 's'} in store`;
  if (state.storedWood <= 2) return `Wood is running low · ${logs}`;
  return `${night ? 'The fireplace is burning' : 'The fireplace is banked'} · ${logs}`;
}

const LARDER_LABELS: Record<FoodItem, string> = {
  berry: 'Berries', greens: 'Greens', hazelnut: 'Hazelnuts', honey: 'Honey', pineNeedles: 'Pine needles', roastedHazelnuts: 'Roasted hazelnuts', trailFood: 'Rations'
};

export interface LarderRowView { item: FoodItem; label: string; kept: number; storeDisabled: boolean; storeTitle: string; takeDisabled: boolean; takeTitle: string }

/** The larder's controls under its build button, once built: how full it is, and a row for each food in the bag or the larder. */
export function larderView(state: GameState): { shown: boolean; stored: string; rows: LarderRowView[] } {
  const rows = FOOD_ITEMS.filter(item => foodCount(state.inventory.food, item) + foodCount(state.larder, item) > 0).map(item => {
    const storeBlocker = storeFoodBlocker(state, item), takeBlocker = takeFoodBlocker(state, item);
    return {
      item, label: LARDER_LABELS[item], kept: foodCount(state.larder, item),
      storeDisabled: Boolean(storeBlocker), storeTitle: storeBlocker ?? `Store 1 ${foodWord(item, 1)}.`,
      takeDisabled: Boolean(takeBlocker), takeTitle: takeBlocker ?? `Take 1 ${foodWord(item, 1)}.`
    };
  });
  return { shown: state.structures.larder, stored: `Stored food ${storeTotal(state.larder)}/${BALANCE.larderCapacity}`, rows };
}

/** The larder's controls, hidden until built, with a hidden row for every food. */
export function larderMarkup(): string {
  const rows = FOOD_ITEMS.map(item => `<div class="larder-row" data-larder-item="${item}" hidden><span>${LARDER_LABELS[item]} <b id="larder-${item}-count">0</b></span><button type="button" data-action="storeFood" data-item="${item}">Store 1</button><button type="button" data-action="takeFood" data-item="${item}">Take 1</button></div>`).join('');
  return `<div id="larder-controls" class="stone-pile-controls larder-controls" hidden><span id="larder-stored">Stored food 0/${BALANCE.larderCapacity}</span>${rows}</div>`;
}

export interface BuildButtonView { disabled: boolean; built: boolean; locked: boolean; ready: boolean; description: string; verb: string; price: string }

const BLOCKED_LABELS = { built: ['Built', 'Complete'], locked: ['Locked', 'Weather cold night'] } as const;

function buildPrice(id: StructureId): string {
  const cost = BUILDINGS[id].cost;
  const stone = 'stone' in cost ? cost.stone : 0;
  return [cost.wood ? `${cost.wood} wood` : '', cost.fiber ? `${cost.fiber} fiber` : '', stone ? `${stone} stone` : '']
    .filter(Boolean).join(' · ');
}

function prerequisiteDescription(id: StructureId): string {
  const definition = BUILDINGS[id];
  const prerequisite = definition.prerequisite;
  const prerequisiteNames: string[] = [];
  if (prerequisite && prerequisite !== 'coldNight') prerequisiteNames.push(BUILDINGS[prerequisite].name.toLowerCase());
  if ('alsoRequires' in definition) prerequisiteNames.push(BUILDINGS[definition.alsoRequires].name.toLowerCase());
  return prerequisiteNames.length ? `Requires ${prerequisiteNames.join(' and ')}` : 'Requires its previous shelter upgrade';
}

function buildDescription(state: GameState, id: StructureId, status: ReturnType<typeof buildStatus>): string {
  if (status === 'needsGround') return (groundBlocker(state, id) ?? '').replace(/\.$/, '');
  if (status === 'needsPrerequisite' || status === 'needsShelter') return prerequisiteDescription(id);
  return BUILDINGS[id].description;
}

export function buildButtonView(state: GameState, id: StructureId): BuildButtonView {
  const status = buildStatus(state, id);
  const blocked = status === 'needsPrerequisite' || status === 'needsShelter' || status === 'needsGround';
  const view = {
    disabled: status === 'built' || status === 'locked' || blocked,
    built: status === 'built',
    locked: status === 'locked' || blocked,
    ready: status === 'ready',
    description: buildDescription(state, id, status),
    verb: blocked ? 'Blocked' : 'Build',
    price: buildPrice(id)
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

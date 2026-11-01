import { SEASON_LENGTH, daysLeftInSeason, isSpring, isSummer, isWinter, nightStart, yearOf } from './calendar';
import { CAMP_EXIT, QUARRY_EXIT, QUARRY_SITE, RUBBLE_SITE, crossing, pathOpen } from './areas';
import { TOO_TIRED_MESSAGE, isExhausted, isHungry, isLowMeter, recovery, workSeconds } from './needs';
import { isRaining } from './rain';
import { wolfVisit } from './wolves';
import { availableFiber, availableStone, availableWood, spendFiber, spendWood, bagCapacity, carriedCount, freeSpaces, isAtCamp, isInClearing, spaceFor } from './camp';
import { POT_COST, cookBlocker, defaultDish, dishBlocker, foodWord, packDish, potBlocker, serveDish, spendIngredients, type DishId } from './cooking';
import { alarmAfter, cloakBlocker, companionDawn, startleFox, makeOffering, offerBlocker, pickUpKeepsake, pillowBlocker } from './companion';
import { CLEARING_STEPS, choppableTrees, clearGroundBlocker, isClearingStump, markBlocker, placeBranches, roomLine, type StepId } from './clearing';
import { addFood, availableFood, eatEffect, foodCount, isFresh, quickEatItem, spendFood, spoil, storeTotal, type FoodItem, type FoodStore } from './food';
import { FORAGE, isForage, nodeShown } from './forage';
import { GARDEN_PLOT_COUNT, gardenDawn } from './garden';
import { BED_CROPS, bedsDawn, drawWaterBlocker, emptyBed, harvestBedBlocker, needsWater, sowBedBlocker } from './beds';
import { fuelLeft, isAtHome, livesInHouse, tendFireplace } from './home';
import { logsInStore } from './wood';
import { settleStores } from './stores';
import { UPGRADE_MESSAGES, WORKSHOP_UPGRADES, cartSpace, countWord, fellingWood, upgradeBlocker, type UpgradeId } from './workshop';
import { FISHING_LINE_COST, catches, fishingBlocker, fishingLineBlocker, fishingSecondsFor, validRoll } from './fishing';
import { ENDED_MESSAGE, GAVE_OUT_MESSAGE, judgeSickDay, markWarmMeal, markWarmRest, sicknessTick } from './sickness';
import { BALANCE, BUILDINGS, LOOKOUT, PACK, PICKAXE, SITES, createGame, type GameState, type SiteId, type StructureId } from './state';

export type GameAction =
  | { type: 'gather'; nodeId: string }
  | { type: 'chopTree'; treeId: string }
  | { type: 'markClearing'; step: StepId }
  | { type: 'clearGround' }
  | { type: 'visitSite'; siteId: SiteId }
  | { type: 'build'; structureId: StructureId }
  | { type: 'move'; dx: number; dy: number }
  | { type: 'plantGarden'; plotIndex: number }
  | { type: 'harvestGarden'; plotIndex: number }
  | { type: 'sowBed'; index: number }
  | { type: 'harvestBed'; index: number }
  | { type: 'drawWater' }
  | { type: 'makeUpgrade'; upgrade: UpgradeId }
  | { type: 'eat'; item?: FoodItem }
  | { type: 'storeFood'; item: FoodItem }
  | { type: 'takeFood'; item: FoodItem }
  | { type: 'cook'; dish?: DishId }
  | { type: 'eatTrailFood' | 'prepareTrailFood' | 'stokeFire' | 'rest' | 'sleep' | 'stargaze' | 'repairLookout' | 'cross' | 'craftAxe' | 'craftPickaxe' | 'craftPot' | 'craftPack' | 'gatherRubble' | 'digQuarry' | 'burnFiber' | 'dropStone' | 'befriend' | 'craftPillow' | 'craftCloak' }
  | { type: 'pickUpStone'; pileId: string }
  | { type: 'makeFishingLine' }
  | { type: 'fish'; roll: number };

/** Awake time tires the survivor; work already costs energy, and resting doesn't. */
export type Activity = 'awake' | 'working' | 'resting';

export interface ActionResult {
  state: GameState;
  message: string;
}

function near(x1: number, y1: number, x2: number, y2: number, radius: number = BALANCE.interactionRadius): boolean {
  return Math.hypot(x1 - x2, y1 - y2) <= radius;
}

export const FULL_BAG_MESSAGE = 'Your bag is full. Eat, burn, or set something down at camp to make room.';

export { availableFiber, availableStone, availableWood, spendFiber, spendWood, bagCapacity, carriedCount, cookBlocker, freeSpaces, isAtCamp, isInClearing, spaceFor };

/** Pays stone from the bag first, then from the camp pile. */
export function spendStone(state: GameState, amount: number): GameState {
  const fromBag = Math.min(amount, state.inventory.stone);
  return { ...state, inventory: { ...state.inventory, stone: state.inventory.stone - fromBag }, storedStone: state.storedStone - (amount - fromBag) };
}

export function trailFoodBlocker(state: GameState): string | null {
  if (!state.structures.dryingRack) return 'Build a drying rack to prepare trail food.';
  if (!isAtCamp(state)) return 'Return to camp to use the drying rack.';
  if (availableFood(state, 'berry') <= 0) return 'Gather a berry to prepare trail food.';
  // The berry may come from the larder, oldest first, so only a bag berry makes room for the ration.
  const spent = spendFood(state, 'berry', 1);
  if (spent && freeSpaces(spent) < spaceFor('food')) return 'Make room in your bag for the ration.';
  return null;
}

export function lookoutRepairBlocker(state: GameState): string | null {
  if (state.area !== 'camp') return 'There is nothing like that here.';
  if (state.progress.lookoutRepaired) return 'The lookout is already restored.';
  if (!state.progress.hearthUnlocked) return 'Weather the cold night before repairing the lookout.';
  if (!near(state.player.x, state.player.y, LOOKOUT.x, LOOKOUT.y)) return 'Stand beside the lookout to repair it.';
  if (isExhausted(state)) return TOO_TIRED_MESSAGE;
  const { wood, fiber, stone } = LOOKOUT.cost;
  if (availableWood(state) < wood || availableFiber(state) < fiber || availableStone(state) < stone) {
    const needed = [availableWood(state) < wood ? `${wood} wood` : null,
      availableFiber(state) < fiber ? `${fiber} fiber` : null,
      availableStone(state) < stone ? `${stone} stone` : null].filter(Boolean).join(' and ');
    return `Need ${needed} to repair the lookout.`;
  }
  return null;
}

export function isColdNight(state: GameState): boolean {
  return state.progress.nextStormDay === state.day && state.timeOfDay >= nightStart(state.day);
}

/** The forecast cold night, or any winter night: the fire burns fast and the cold bites. */
export function isFreezingNight(state: GameState): boolean {
  return isColdNight(state) || (isWinter(state.day) && state.timeOfDay >= nightStart(state.day));
}

export function movementFactor(state: GameState): number {
  const { energy, hunger, warmth } = state.player;
  return isLowMeter(energy) || isLowMeter(hunger) || isLowMeter(warmth) ? 0.65 : 1;
}

/** Why the survivor can't sleep right now, or null if they can. */
export function sleepBlocker(state: GameState): string | null {
  if (state.timeOfDay < nightStart(state.day)) return 'You can sleep once night falls. Rest (R) for a short break.';
  // In the house the bed is indoors, so home is the only thing asked for.
  if (livesInHouse(state)) return isAtHome(state) ? null : 'Go home to sleep.';
  if (!isAtCamp(state)) return 'Move closer to the fire to sleep.';
  if (!state.structures.shelter) return 'Build a shelter to sleep through the night.';
  return null;
}

/** Why the survivor can't watch the stars right now, or null if they can. */
export function stargazeBlocker(state: GameState): string | null {
  if (state.timeOfDay < nightStart(state.day)) return 'Wait until nightfall to watch the stars.';
  if (!isInClearing(state)) return 'Return to camp to watch the stars.';
  return null;
}

/** Why the pickaxe can't be crafted right now, or null if it can. */
export function pickaxeBlocker(state: GameState): string | null {
  if (state.progress.pickaxeCrafted) return 'You already have a pickaxe.';
  if (!state.progress.quarryFound) return 'Find the quarry first.';
  if (!state.structures.toolshed) return 'Build a toolshed first.';
  if (!isInClearing(state)) return 'Return to camp to craft the pickaxe.';
  if (isExhausted(state)) return TOO_TIRED_MESSAGE;
  const { wood, fiber, stone } = PICKAXE.cost;
  if (availableWood(state) < wood || availableFiber(state) < fiber || availableStone(state) < stone)
    return `Need ${wood} wood, ${fiber} fiber, and ${stone} stone for the pickaxe.`;
  return null;
}

/** Why the woven pack can't be made right now, or null if it can. Wood and fiber can come from their camp stores. */
export function packBlocker(state: GameState): string | null {
  if (state.progress.packWoven) return 'You already have a woven pack.';
  if (!state.structures.toolshed) return 'Build a toolshed first.';
  if (!isInClearing(state)) return 'Return to camp to weave the pack.';
  if (isExhausted(state)) return TOO_TIRED_MESSAGE;
  const { wood, fiber } = PACK.cost;
  if (availableWood(state) < wood || availableFiber(state) < fiber) return `Need ${wood} wood and ${fiber} fiber for the pack.`;
  return null;
}

export type BuildStatus = 'built' | 'locked' | 'needsShelter' | 'needsPrerequisite' | 'needsGround' | 'ready' | 'unavailable';

/** Why a building can't go up until its ground is cleared, naming the side and step, or null if it needs none or it is clear. */
export function groundBlocker(state: GameState, id: StructureId): string | null {
  const definition = BUILDINGS[id];
  if (!('ground' in definition) || state.clearing.cleared.includes(definition.ground)) return null;
  const step = definition.ground;
  return `Clear the ${CLEARING_STEPS[step].side} side's ${step.endsWith('-far') ? 'far' : 'near'} ground first.`;
}

/** How a structure's build button should look: built, locked, blocked by a missing shelter or uncleared ground, ready to build here, or not yet. */
export function buildStatus(state: GameState, id: StructureId): BuildStatus {
  const definition = BUILDINGS[id];
  if (state.structures[id]) return 'built';
  if (definition.prerequisite === 'coldNight' && !state.progress.hearthUnlocked) return 'locked';
  const missingPrerequisite = missingStructurePrerequisite(state, definition);
  if (missingPrerequisite === 'shelter') return 'needsShelter';
  if (missingPrerequisite) return 'needsPrerequisite';
  if (groundBlocker(state, id)) return 'needsGround';
  const cost = definition.cost;
  const stoneCost = 'stone' in cost ? cost.stone : 0;
  const affordable = availableWood(state) >= cost.wood && availableFiber(state) >= cost.fiber && availableStone(state) >= stoneCost;
  return affordable && isInClearing(state) && !isExhausted(state) ? 'ready' : 'unavailable';
}

function isStructurePrerequisite(prerequisite: string | null): prerequisite is StructureId {
  return prerequisite !== null && prerequisite !== 'coldNight' && Object.hasOwn(BUILDINGS, prerequisite);
}

function missingStructurePrerequisite(state: GameState, definition: (typeof BUILDINGS)[StructureId]): StructureId | null {
  if (isStructurePrerequisite(definition.prerequisite) && !state.structures[definition.prerequisite]) return definition.prerequisite;
  if ('alsoRequires' in definition && !state.structures[definition.alsoRequires]) return definition.alsoRequires;
  return null;
}

export function advanceTime(state: GameState, seconds: number, activity: Activity = 'awake'): GameState {
  if (!Number.isFinite(seconds) || seconds <= 0 || state.ending) return state;
  const next: GameState = {
    ...state,
    player: { ...state.player },
    progress: { ...state.progress },
    trees: state.trees.map(tree => ({ ...tree }))
  };
  let remaining = seconds;
  while (remaining > 0.000001 && !next.ending) {
    const step = Math.min(remaining, 1, BALANCE.daySeconds - next.timeOfDay);
    const camp = isAtCamp(next);
    const home = isAtHome(next);
    const coldNight = isFreezingNight(next);
    const drain = (activity === 'awake' ? BALANCE.energyDrainPerSecond : 0) + (next.player.hunger <= 0 ? BALANCE.starvingEnergyDrainPerSecond : 0);
    next.player.hunger = Math.max(0, next.player.hunger - hungerLoss(next, step));
    next.player.energy = Math.max(0, next.player.energy - step * drain);
    sicknessTick(next, step);
    next.player.warmth = Math.max(0, Math.min(100, next.player.warmth + warmthChange(next, step, camp, home, coldNight)));
    next.fireFuel = Math.max(0, next.fireFuel - step * fireBurn(next, coldNight));
    tendFireplace(next, step, coldNight);
    next.timeOfDay += step;
    remaining -= step;
    wolfVisit(next);
    startleFox(next);
    if (next.timeOfDay >= BALANCE.daySeconds - 0.000001) dawn(next, home);
  }
  return next;
}

/** Advance the live world clock; actions and sleep continue to spend game seconds. */
export function advanceLiveTime(state: GameState, realSeconds: number): GameState {
  return advanceTime(state, realSeconds * BALANCE.clockRate);
}

/** Hunger lost over one step: an eighth a second, faster for the part of the step in summer's midday heat. */
function hungerLoss(state: GameState, step: number): number {
  if (!isSummer(state.day)) return step / 8;
  const hot = Math.max(0, Math.min(state.timeOfDay + step, BALANCE.summerHeatEnd) - Math.max(state.timeOfDay, BALANCE.summerHeatStart));
  return (step + hot * (BALANCE.summerHeatHunger - 1)) / 8;
}

/** The note when summer's midday heat begins, on the first day of each summer only, or null. */
export function heatMessage(before: GameState, after: GameState): string | null {
  const began = before.day === after.day && isSummer(after.day) && daysLeftInSeason(after.day) === SEASON_LENGTH
    && before.timeOfDay < BALANCE.summerHeatStart && after.timeOfDay >= BALANCE.summerHeatStart;
  return began ? 'The midday sun is hot. You will get hungry a little faster.' : null;
}

/** How fast the fire burns: twice as fast on a freezing night, half as fast again in a spring shower. */
function fireBurn(state: GameState, coldNight: boolean): number {
  if (coldNight) return BALANCE.coldNightFireBurn;
  return isRaining(state) ? BALANCE.rainFireBurn : 1;
}

/**
 * How much warmth one step of time adds or takes, read before the step's fire burn. Rain chills like an ordinary night, except in the shelter.
 * Home is the shelter or the house with its fire, and the fireplace counts as lit while it has a log in store to draw this step;
 * a lit campfire still warms whoever stands at it.
 */
function warmthChange(state: GameState, step: number, camp: boolean, home: boolean, coldNight: boolean): number {
  // The shelter keeps its roof as a woodshed, so rain at camp still finds cover under it.
  const sheltered = (home && (state.structures.shelter || state.structures.house)) || (camp && state.structures.shelter);
  if (state.timeOfDay < nightStart(state.day) && !(isRaining(state) && !sheltered)) return step / 10;
  const lit = (home && fuelLeft(state) > 0) || (camp && state.fireFuel > 0);
  if (lit) return step / 2;
  let change = -step * warmthLossPerSecond(state, sheltered, coldNight);
  // The windbreak shelters the house too, so moving in never leaves the survivor colder.
  if ((camp || home) && !lit && state.structures.windbreak) change *= 0.5;
  // A fur cloak keeps a quarter of the night's chill off, wherever the survivor is.
  if (state.companion.cloak && state.timeOfDay >= nightStart(state.day)) change *= BALANCE.cloakWarmthLoss;
  // Summer nights are warm, except the forecast cold night.
  return isSummer(state.day) && !coldNight ? Math.max(0, change) : change;
}

/** Shelter and cold weather set the chill before windbreak and cloak protection. */
function warmthLossPerSecond(state: GameState, sheltered: boolean, coldNight: boolean): number {
  if (coldNight) return sheltered
    ? BALANCE.coldNightShelteredWarmthLossPerSecond
    : BALANCE.coldNightOutdoorWarmthLossPerSecond;
  if (sheltered) return state.structures.shelterThatched ? BALANCE.thatchedShelteredWarmthLossPerSecond : 0.25;
  return 0.5;
}

/** Starts the next day in place: grows or dries the beds from the day that ended, regrows nodes and settles the cold night if it just ended. */
function dawn(next: GameState, home: boolean): void {
  judgeSickDay(next, next.day);
  const stormEnded = next.progress.nextStormDay === next.day;
  const weathered = stormEnded && home && (next.structures.shelter || next.structures.house) && fuelLeft(next) > 0 && next.player.warmth > 20;
  bedsDawn(next, next.day);
  next.day += 1;
  next.timeOfDay = 0;
  next.gardenPlots = gardenDawn(next);
  // Rocks give their stone once; everything else grows back at dawn.
  next.nodes = next.nodes.map(node => node.kind !== 'stone' && node.readyDay <= next.day ? { ...node, amount: 1 } : node);
  companionDawn(next);
  // The bag and the larder both throw out what has gone soft, wherever the survivor is; one note covers both.
  const bag = spoil(next.inventory.food, next.day, BALANCE.bagFreshDays);
  const larder = spoil(next.larder, next.day, BALANCE.larderFreshDays);
  next.inventory = { ...next.inventory, food: bag.store };
  next.larder = larder.store;
  const lost = { berry: bag.lost.berry + larder.lost.berry, greens: bag.lost.greens + larder.lost.greens };
  if (lost.berry + lost.greens > 0) next.lastSpoiled = { day: next.day, ...lost };
  if (!stormEnded) return;
  if (weathered) {
    next.progress = { ...next.progress, nextStormDay: null, hearthUnlocked: true };
    return;
  }
  next.progress = { ...next.progress, nextStormDay: next.day + BALANCE.coldNightRetryDays - 1, hearthUnlocked: false };
  next.player.energy = Math.min(next.player.energy, BALANCE.coldNightFailureEnergy);
  next.timeOfDay = BALANCE.coldNightFailureMorningLoss;
}

type ActionOf<T extends GameAction['type']> = Extract<GameAction, { type: T }>;
type ActionHandler<T extends GameAction['type']> = (state: GameState, action: ActionOf<T>) => ActionResult;

function refuse(state: GameState, message: string): ActionResult {
  return { state, message };
}

function tire(state: GameState, cost: number): GameState['player'] {
  return { ...state.player, energy: Math.max(0, state.player.energy - cost) };
}

/** Pays wood, fiber and stone from the bag first, then from their stores, then spends build time (the standard time unless given). */
function payAndBuild(state: GameState, cost: { wood: number; fiber: number; stone: number }, changes: Partial<GameState>, seconds: number = BALANCE.buildSeconds): GameState {
  const paid = spendFiber(spendWood(spendStone(state, cost.stone), cost.wood), cost.fiber);
  return advanceTime({
    ...paid,
    player: tire(state, BALANCE.buildEnergyCost),
    ...changes
  }, workSeconds(state, seconds), 'working');
}

function quarryFoundOnArrival(moved: GameState): ActionResult {
  if (moved.area === 'quarry' && !moved.progress.quarryFound && near(moved.player.x, moved.player.y, QUARRY_SITE.x, QUARRY_SITE.y, 2)) {
    return { state: { ...moved, progress: { ...moved.progress, quarryFound: true } }, message: 'You found an old quarry. A pickaxe could work this stone.' };
  }
  return { state: moved, message: '' };
}

const move: ActionHandler<'move'> = (state, action) => {
  const factor = movementFactor(state);
  const rawX = state.player.x + action.dx * factor;
  const rawY = state.player.y + action.dy * factor;
  const crossed = crossing(state, rawX, rawY);
  const player = crossed
    ? { ...state.player, x: crossed.x, y: crossed.y }
    : { ...state.player, x: Math.max(0, Math.min(BALANCE.mapWidth - 1, rawX)), y: Math.max(0, Math.min(BALANCE.mapHeight - 1, rawY)) };
  return quarryFoundOnArrival(pickUpKeepsake({ ...state, ...(crossed ? { area: crossed.area } : {}), player }));
};

const cross: ActionHandler<'cross'> = state => {
  const toQuarry = state.area === 'camp';
  const exit = toQuarry ? CAMP_EXIT : QUARRY_EXIT;
  if (!near(state.player.x, state.player.y, exit.x, exit.y, 0.5)) return refuse(state, 'Walk to the end of the west path to cross.');
  if (!pathOpen(state)) return refuse(state, 'Build a shelter to open the west path.');
  return {
    state: { ...state, area: toQuarry ? 'quarry' : 'camp', player: { ...state.player, x: toQuarry ? BALANCE.mapWidth - 1.5 : 0.5, y: exit.y } },
    message: ''
  };
};

type Supply = keyof GameState['inventory'];
// Berries and forage go into the food store.
const NODE_RESOURCE: Record<GameState['nodes'][number]['kind'], Supply> = {
  branch: 'wood', berry: 'food', fiber: 'fiber', stone: 'stone', hazel: 'food', pine: 'food', greens: 'food', honey: 'food'
};
const GATHER_MESSAGE: Record<GameState['nodes'][number]['kind'], string> = {
  branch: 'Picked up fallen branches.', berry: 'Picked berries.', fiber: 'Gathered fiber.', stone: 'Collected stone.',
  hazel: 'Gathered a hazelnut.', pine: 'Gathered a bunch of pine needles.', greens: 'Picked wild greens.', honey: 'Took a little honey from the hollow tree.'
};

/** The bag with n more of a supply; food comes in as the item given (berries unless said), picked today. */
function withSupply(state: GameState, resource: Supply, n: number, item: FoodItem = 'berry'): GameState['inventory'] {
  const { inventory } = state;
  if (resource === 'food') return { ...inventory, food: addFood(inventory.food, item, n, state.day) };
  return { ...inventory, [resource]: inventory[resource] + n };
}

const gather: ActionHandler<'gather'> = (state, action) => {
  const node = state.nodes.find(item => item.id === action.nodeId);
  if (!node || state.area !== 'camp' || !nodeShown(state, node) || !near(state.player.x, state.player.y, node.x, node.y)) return refuse(state, 'Move closer to gather.');
  if (node.kind === 'berry' && isWinter(state.day)) return refuse(state, 'The bushes are bare until spring.');
  if (node.amount <= 0) return refuse(state, 'Nothing to gather yet.');
  const resource = NODE_RESOURCE[node.kind];
  if (freeSpaces(state) < spaceFor(resource)) return refuse(state, FULL_BAG_MESSAGE);
  const forage = isForage(node.kind) ? FORAGE[node.kind] : null;
  const readyDay = state.day + (forage?.regrowDays ?? 1);
  const nodes = state.nodes.map(item => item === node ? { ...item, amount: item.amount - 1, readyDay } : item);
  // Summer bushes are heavy: two berries a pick, if the bag has room.
  const picked = node.kind === 'berry' && isSummer(state.day) ? Math.min(BALANCE.summerBerries, freeSpaces(state)) : 1;
  return {
    state: advanceTime({
      ...state,
      player: tire(state, BALANCE.gatherEnergyCost),
      inventory: withSupply(state, resource, picked, forage?.item),
      nodes
    }, workSeconds(state, BALANCE.gatherSeconds), 'working'),
    message: picked > 1 ? 'Picked two handfuls of berries.' : GATHER_MESSAGE[node.kind]
  };
};

export function axeBlocker(state: GameState): string | null {
  if (state.progress.axeCrafted) return 'You already have a stone axe.';
  if (!state.progress.hearthUnlocked) return 'Weather the cold night before crafting an axe.';
  if (!state.structures.toolshed) return 'Build a toolshed first.';
  if (!isInClearing(state)) return 'Return to camp to craft the axe.';
  if (isExhausted(state)) return TOO_TIRED_MESSAGE;
  if (availableWood(state) < 1 || availableFiber(state) < 1 || availableStone(state) < 1) return 'Need 1 wood, 1 fiber, and 1 stone for the axe.';
  return null;
}

const craftAxe: ActionHandler<'craftAxe'> = state => {
  const blocker = axeBlocker(state);
  if (blocker) return refuse(state, blocker);
  return {
    state: payAndBuild(state, { wood: 1, fiber: 1, stone: 1 }, { progress: { ...state.progress, axeCrafted: true } }),
    message: 'Crafted a stone axe. Mature trees can now provide wood.'
  };
};

const craftPickaxe: ActionHandler<'craftPickaxe'> = state => {
  const blocker = pickaxeBlocker(state);
  if (blocker) return refuse(state, blocker);
  return {
    state: payAndBuild(state, PICKAXE.cost, { progress: { ...state.progress, pickaxeCrafted: true } }),
    message: 'Crafted a pickaxe. The quarry face can be worked now.'
  };
};

const craftPot: ActionHandler<'craftPot'> = state => {
  const blocker = potBlocker(state);
  if (blocker) return refuse(state, blocker);
  return {
    state: payAndBuild(state, POT_COST, { progress: { ...state.progress, potCrafted: true } }),
    message: 'Made a cooking pot. It hangs over the fire on a little tripod.'
  };
};

const makeFishingLine: ActionHandler<'makeFishingLine'> = state => {
  const blocker = fishingLineBlocker(state);
  if (blocker) return refuse(state, blocker);
  return {
    state: payAndBuild(state, { ...FISHING_LINE_COST, stone: 0 }, { progress: { ...state.progress, fishingLine: true } }),
    message: 'You twist fiber into a line and tie it to a stick.'
  };
};

const fish: ActionHandler<'fish'> = (state, action) => {
  if (!validRoll(action.roll)) return refuse(state, 'That action is not available yet.');
  const blocker = fishingBlocker(state);
  if (blocker) return refuse(state, blocker);
  const caught = catches(state, action.roll);
  const waited = advanceTime(state, fishingSecondsFor(state), 'working');
  if (!caught) return { state: { ...waited, fishingMisses: state.fishingMisses + 1 }, message: 'You wait by the hole in the ice, but nothing bites.' };
  const food = addFood(waited.inventory.food, 'fish', 1, waited.day);
  return { state: { ...waited, fishingMisses: 0, inventory: { ...waited.inventory, food } }, message: 'You break the ice and wait. A fish takes the line.' };
};

const craftPack: ActionHandler<'craftPack'> = state => {
  const blocker = packBlocker(state);
  if (blocker) return refuse(state, blocker);
  return {
    state: payAndBuild(state, PACK.cost, { progress: { ...state.progress, packWoven: true } }),
    message: 'You wove a pack. There\'s room for twice as much now.'
  };
};

const gatherRubble: ActionHandler<'gatherRubble'> = state => {
  if (state.area !== 'quarry' || !near(state.player.x, state.player.y, RUBBLE_SITE.x, RUBBLE_SITE.y)) return refuse(state, 'Move closer to the rubble.');
  if (state.rubbleReadyDay > state.day) return refuse(state, 'The rubble is picked over. More will loosen in a few days.');
  if (freeSpaces(state) < spaceFor('stone')) return refuse(state, FULL_BAG_MESSAGE);
  return {
    state: advanceTime({
      ...state,
      player: tire(state, BALANCE.gatherEnergyCost),
      inventory: { ...state.inventory, stone: state.inventory.stone + 1 },
      rubbleReadyDay: state.day + BALANCE.rubbleRegrowDays
    }, workSeconds(state, BALANCE.gatherSeconds), 'working'),
    message: 'Pried a stone from the rubble.'
  };
};

const digQuarry: ActionHandler<'digQuarry'> = state => {
  if (!state.progress.pickaxeCrafted) return refuse(state, 'You need a pickaxe to work the quarry.');
  if (state.area !== 'quarry' || !near(state.player.x, state.player.y, QUARRY_SITE.x, QUARRY_SITE.y)) return refuse(state, 'Move closer to the quarry face.');
  if (state.quarryReadyDay > state.day) return refuse(state, 'The quarry face is worked out until morning.');
  if (isExhausted(state)) return refuse(state, TOO_TIRED_MESSAGE);
  if (freeSpaces(state) < spaceFor('stone')) return refuse(state, FULL_BAG_MESSAGE);
  return {
    state: advanceTime({
      ...state,
      player: tire(state, BALANCE.digEnergyCost),
      inventory: { ...state.inventory, stone: state.inventory.stone + 1 },
      quarryReadyDay: state.day + 1
    }, workSeconds(state, BALANCE.digSeconds), 'working'),
    message: 'Broke a good stone from the quarry face.'
  };
};

/** Days a chopped tree takes to regrow: quicker in spring. */
export function treeRegrowDays(day: number): number {
  return isSpring(day) ? BALANCE.springTreeRegrowDays : BALANCE.treeRegrowDays;
}

const capitalised = (word: string): string => word[0].toUpperCase() + word.slice(1);

/** What a felling says: where its wood went, the cart and then the bag. */
function choppedMessage(toCart: number, toBag: number): string {
  if (toCart === 0) return `Chopped the tree and collected ${countWord(toBag)} wood. A stump remains.`;
  const cart = `${capitalised(countWord(toCart))} wood went into the cart`;
  return `Chopped the tree. ${toBag > 0 ? `${cart} and ${countWord(toBag)} into your bag` : cart}. A stump remains.`;
}

const chopTree: ActionHandler<'chopTree'> = (state, action) => {
  if (!state.progress.axeCrafted) return refuse(state, 'Craft a stone axe before chopping trees.');
  const tree = choppableTrees(state).find(item => item.id === action.treeId);
  if (!tree || state.area !== 'camp' || !near(state.player.x, state.player.y, tree.x, tree.y)) return refuse(state, 'Move closer to a mature tree.');
  if (isClearingStump(tree)) return refuse(state, 'This stump stays until the ground is cleared.');
  if (tree.readyDay > state.day) return refuse(state, 'This stump needs more time to regrow.');
  if (isExhausted(state)) return refuse(state, TOO_TIRED_MESSAGE);
  const wood = fellingWood(state);
  // Felled wood fills the handcart first, and the bag takes the rest.
  const toCart = Math.min(wood, cartSpace(state));
  const toBag = wood - toCart;
  if (freeSpaces(state) + cartSpace(state) < wood * spaceFor('wood')) {
    return refuse(state, `Your ${state.progress.workshop.handcart ? 'bag and cart need' : 'bag needs'} ${countWord(wood)} free spaces for wood.`);
  }
  const chopped = {
    ...state,
    player: tire(state, BALANCE.chopEnergyCost),
    inventory: { ...state.inventory, wood: state.inventory.wood + toBag },
    cartWood: state.cartWood + toCart
  };
  const marked = tree.id.startsWith('mark-');
  const felledIndex = Number(tree.id.slice(tree.id.lastIndexOf('-') + 1));
  const afterChop = marked
    ? { ...chopped, clearing: { ...state.clearing, felled: [...state.clearing.felled, felledIndex] } }
    : { ...chopped, trees: state.trees.map(item => item.id === tree.id ? { ...item, readyDay: state.day + treeRegrowDays(state.day) } : item) };
  return {
    state: advanceTime(afterChop, workSeconds(state, BALANCE.chopSeconds), 'working'),
    message: choppedMessage(toCart, toBag)
  };
};

const markClearing: ActionHandler<'markClearing'> = (state, action) => {
  const blocker = markBlocker(state, action.step);
  if (blocker) return refuse(state, blocker);
  const { side, trees } = CLEARING_STEPS[action.step];
  const felled = state.clearing.marked === action.step ? state.clearing.felled : [];
  return {
    state: { ...state, clearing: { ...state.clearing, marked: action.step, felled } },
    message: `Tied pale fibre round ${trees.length} trees on the ${side} side.`
  };
};

const clearGround: ActionHandler<'clearGround'> = state => {
  const blocker = clearGroundBlocker(state);
  if (blocker) return refuse(state, blocker);
  const step = state.clearing.marked as StepId;
  const cleared = [...state.clearing.cleared, step];
  const placed = placeBranches(createGame().nodes, cleared);
  const nodes = state.nodes.map((node, index) => ({ ...node, x: placed[index].x, y: placed[index].y }));
  return {
    state: payAndBuild(state, CLEARING_STEPS[step].cost, { nodes, clearing: { cleared, marked: null, felled: [] } }),
    message: `The ${CLEARING_STEPS[step].side} side is open now.${roomLine(step, state.structures, id => Object.hasOwn(BUILDINGS, id))}`
  };
};

function restAtSpring(state: GameState): ActionResult {
  if (isWinter(state.day)) return {
    state: { ...state, progress: { ...state.progress, discoveries: { ...state.progress.discoveries, spring: true } } },
    message: state.progress.fishingLine ? 'The spring is frozen over.' : 'The spring is frozen over. With a fishing line, you could fish through the ice.'
  };
  const rested = advanceTime({ ...state, progress: { ...state.progress,
    discoveries: { ...state.progress.discoveries, spring: true } } }, BALANCE.restSeconds, 'resting');
  return {
    state: { ...rested, player: { ...rested.player, energy: Math.min(100, rested.player.energy + recovery(state, 20)) } },
    message: 'You pause beside the quiet spring and feel rested.'
  };
}

const visitSite: ActionHandler<'visitSite'> = (state, action) => {
  if (state.area !== 'camp') return refuse(state, 'There is nothing like that here.');
  const site = SITES[action.siteId];
  if (!site || !near(state.player.x, state.player.y, site.x, site.y)) return refuse(state, 'Move closer to a place along the path.');
  if (action.siteId === 'spring') return restAtSpring(state);
  if (state.progress.discoveries[action.siteId]) return refuse(state, `You have already searched the ${site.name.toLowerCase()}.`);
  const resource = action.siteId === 'basket' ? 'food' : 'stone';
  const needed = 2 * spaceFor(resource);
  if (freeSpaces(state) < needed) return refuse(state, `Your bag needs ${needed} free spaces for this find.`);
  const found = advanceTime({
    ...state,
    player: tire(state, BALANCE.gatherEnergyCost),
    inventory: withSupply(state, resource, 2),
    progress: { ...state.progress, discoveries: { ...state.progress.discoveries, [action.siteId]: true } }
  }, workSeconds(state, BALANCE.gatherSeconds), 'working');
  return { state: found, message: action.siteId === 'basket' ? 'An old basket holds two berries.' : 'You find two useful stones tucked in the cairn.' };
};

function larderBlocker(state: GameState): string | null {
  if (!state.structures.larder) return 'Build a larder first.';
  if (!isInClearing(state)) return 'Return to camp to use the larder.';
  return null;
}

/** Moves one of an item between stores: fresh food keeps the day it was picked; `pick` chooses which piece. */
function moveOne(from: FoodStore, to: FoodStore, item: FoodItem, pick: (days: number[]) => number): { from: FoodStore; to: FoodStore } {
  if (!isFresh(item)) return { from: { ...from, [item]: from[item] - 1 }, to: { ...to, [item]: to[item] + 1 } };
  const day = pick(from[item]);
  const index = from[item].indexOf(day);
  return { from: { ...from, [item]: from[item].filter((_, i) => i !== index) }, to: addFood(to, item, 1, day) };
}

/** Why one of an item can't go into the larder now, or null. */
export function storeFoodBlocker(state: GameState, item: FoodItem): string | null {
  const blocker = larderBlocker(state);
  if (blocker) return blocker;
  if (foodCount(state.inventory.food, item) < 1) return `You have no ${foodWord(item, 2)} to store.`;
  if (storeTotal(state.larder) >= BALANCE.larderCapacity) return 'The larder is full.';
  return null;
}

/** Why one of an item can't come out of the larder now, or null. */
export function takeFoodBlocker(state: GameState, item: FoodItem): string | null {
  const blocker = larderBlocker(state);
  if (blocker) return blocker;
  if (foodCount(state.larder, item) < 1) return `The larder has no ${foodWord(item, 2)}.`;
  if (freeSpaces(state) < 1) return FULL_BAG_MESSAGE;
  return null;
}

/** Puts the bag's oldest piece of an item in the larder, where it keeps longer. */
const storeFood: ActionHandler<'storeFood'> = (state, action) => {
  const blocker = storeFoodBlocker(state, action.item);
  if (blocker) return refuse(state, blocker);
  const moved = moveOne(state.inventory.food, state.larder, action.item, days => Math.min(...days));
  return { state: { ...state, inventory: { ...state.inventory, food: moved.from }, larder: moved.to }, message: `Stored 1 ${foodWord(action.item, 1)} in the larder.` };
};

/** Takes the larder's freshest piece of an item into the bag. */
const takeFood: ActionHandler<'takeFood'> = (state, action) => {
  const blocker = takeFoodBlocker(state, action.item);
  if (blocker) return refuse(state, blocker);
  const moved = moveOne(state.larder, state.inventory.food, action.item, days => Math.max(...days));
  return { state: { ...state, inventory: { ...state.inventory, food: moved.to }, larder: moved.from }, message: `Took 1 ${foodWord(action.item, 1)} from the larder.` };
};

const dropStone: ActionHandler<'dropStone'> = state => {
  if (state.inventory.stone < 1) return refuse(state, 'You have no stone to set down.');
  const { x, y } = state.player;
  const nearby = state.stonePiles.find(pile => pile.area === state.area && Math.hypot(pile.x - x, pile.y - y) <= BALANCE.pileMergeRadius);
  const stonePiles = nearby
    ? state.stonePiles.map(pile => pile === nearby ? { ...pile, count: pile.count + 1 } : pile)
    : [...state.stonePiles, { id: `pile-${state.area}-${state.day}-${Math.round(x * 10)}-${Math.round(y * 10)}`, x, y, count: 1, area: state.area }];
  return { state: { ...state, inventory: { ...state.inventory, stone: state.inventory.stone - 1 }, stonePiles }, message: 'Set down one stone.' };
};

const pickUpStone: ActionHandler<'pickUpStone'> = (state, action) => {
  const pile = state.stonePiles.find(item => item.id === action.pileId && item.area === state.area);
  if (!pile) return refuse(state, 'There is no stone pile within reach.');
  if (!near(state.player.x, state.player.y, pile.x, pile.y)) return refuse(state, 'Move closer to the stones.');
  if (freeSpaces(state) < spaceFor('stone')) return refuse(state, FULL_BAG_MESSAGE);
  const stonePiles = state.stonePiles
    .map(item => item === pile ? { ...item, count: item.count - 1 } : item)
    .filter(item => item.count > 0);
  return {
    state: advanceTime({ ...state, inventory: { ...state.inventory, stone: state.inventory.stone + 1 }, stonePiles }, BALANCE.pickUpSeconds, 'resting'),
    message: 'Picked up a stone.'
  };
};

const burnFiber: ActionHandler<'burnFiber'> = state => {
  if (!isAtCamp(state)) return refuse(state, 'Move closer to the fire to tend it.');
  if (availableFiber(state) < 1) return refuse(state, 'You have no fiber to burn.');
  return {
    state: { ...spendFiber(state, 1), fireFuel: state.fireFuel + BALANCE.fiberFireSeconds },
    message: 'The kindling flares up.'
  };
};

function eatRation(state: GameState): ActionResult {
  const fed = spendFood(state, 'trailFood', 1);
  if (!fed) return refuse(state, 'No trail rations in your bag.');
  return {
    state: { ...fed, player: { ...fed.player, hunger: Math.min(100, fed.player.hunger + BALANCE.trailFoodHungerGain) } },
    message: 'Ate a trail ration.'
  };
}
const eatTrailFood: ActionHandler<'eatTrailFood'> = eatRation;

/** Eats one of the item named, or what Q would pick; pine needles wait for tea, and a ration is eaten as one. */
const eat: ActionHandler<'eat'> = (state, action) => {
  const item = action.item ?? quickEatItem(state);
  if (item === 'pineNeedles') return refuse(state, 'Pine needles are for tea.');
  if (item === 'trailFood') return eatRation(state);
  const fed = item && spendFood(state, item, 1);
  if (!item || !fed) return refuse(state, 'No food in your bag.');
  const { hunger, energy, message } = eatEffect(item);
  const { player } = fed;
  return {
    state: { ...fed, player: { ...player, hunger: Math.min(100, player.hunger + hunger), energy: Math.min(100, player.energy + energy) } },
    message
  };
};

const prepareTrailFood: ActionHandler<'prepareTrailFood'> = state => {
  const blocker = trailFoodBlocker(state);
  const spent = spendFood(state, 'berry', 1);
  if (blocker || !spent) return refuse(state, blocker ?? 'No food in your bag.');
  return {
    state: advanceTime({ ...spent,
      inventory: { ...spent.inventory, food: addFood(spent.inventory.food, 'trailFood', 1, state.day) },
      player: tire(state, BALANCE.gatherEnergyCost)
    }, workSeconds(state, BALANCE.trailFoodSeconds), 'working'),
    message: 'Dried a berry into one trail ration.'
  };
};

/** Cooks the dish named, or what C would pick; with nothing to cook, the berry's refusal explains why. */
const cook: ActionHandler<'cook'> = (state, action) => {
  const dish = action.dish ?? defaultDish(state) ?? 'berries';
  const blocker = dishBlocker(state, dish);
  const spent = spendIngredients(state, dish);
  if (blocker || !spent) return refuse(state, blocker ?? 'No food in your bag.');
  // Roasted nuts are packed for later, not eaten, so only the other dishes are a warm meal. It counts toward the day
  // the cooking began, as a rest does, even if the cooking runs on past dawn.
  const packed = dish === 'roastedHazelnuts' ? packDish(spent, dish) : markWarmMeal(packDish(spent, dish));
  return serveDish(advanceTime(packed, BALANCE.cookSeconds, 'resting'), dish, state.structures.dryingRack);
};

/** A honey cake's extra energy for this rest or sleep, if one was eaten. */
const cakeEnergy = (state: GameState): number => state.cakeBonus ? BALANCE.honeyCakeRestBonus : 0;

const STARGAZE_THOUGHTS = [
  'The stars shine between the trees.',
  'A quiet patch of sky opens above camp.',
  'The moon makes the clearing look silver.'
];

const stargaze: ActionHandler<'stargaze'> = state => {
  const blocker = stargazeBlocker(state);
  if (blocker) return refuse(state, blocker);
  const restored = { ...state, player: { ...state.player, energy: Math.min(100, state.player.energy + recovery(state, BALANCE.stargazeEnergyGain)) } };
  return {
    state: advanceTime(restored, BALANCE.stargazeSeconds, 'resting'),
    message: `${STARGAZE_THOUGHTS[(state.day - 1) % STARGAZE_THOUGHTS.length]} You feel a little rested.`
  };
};

const stokeFire: ActionHandler<'stokeFire'> = state => {
  if (!isAtCamp(state)) return refuse(state, 'Move closer to the fire to tend it.');
  if (availableWood(state) < 1) return refuse(state, 'You need wood for the fire.');
  return {
    state: { ...spendWood(state, 1), fireFuel: state.fireFuel + (state.structures.hearth ? BALANCE.hearthFireSecondsPerWood : BALANCE.fireSecondsPerWood) },
    message: 'The fire burns brighter.'
  };
};

const repairLookout: ActionHandler<'repairLookout'> = state => {
  if (state.area !== 'camp') return refuse(state, 'There is nothing like that here.');
  const blocker = lookoutRepairBlocker(state);
  if (blocker) return refuse(state, blocker);
  return {
    state: payAndBuild(state, LOOKOUT.cost, { progress: { ...state.progress, lookoutRepaired: true } }),
    message: 'The lookout stands again. From here, the camp feels like home.'
  };
};

function gardenPlotIndexValid(plotIndex: number): boolean {
  return Number.isInteger(plotIndex) && plotIndex >= 0 && plotIndex < GARDEN_PLOT_COUNT;
}

export function plantGardenBlocker(state: GameState, plotIndex: number): string | null {
  if (!gardenPlotIndexValid(plotIndex)) return 'That garden plot is unavailable.';
  if (!state.structures.garden) return 'Build a garden first.';
  if (!isInClearing(state)) return 'Return to camp to tend the garden.';
  if (!isSpring(state.day)) return 'Plant berry bushes in spring.';
  if (state.gardenPlots[plotIndex].plantedYear !== null) return 'That plot already has a berry bush.';
  if (availableFood(state, 'berry') < 1) return 'You need a berry to plant.';
  if (isExhausted(state)) return TOO_TIRED_MESSAGE;
  return null;
}

export function harvestGardenBlocker(state: GameState, plotIndex: number): string | null {
  if (!gardenPlotIndexValid(plotIndex)) return 'That garden plot is unavailable.';
  if (!state.structures.garden) return 'Build a garden first.';
  if (!isInClearing(state)) return 'Return to camp to tend the garden.';
  if (!state.gardenPlots[plotIndex].harvestReady) return 'Those berries are not ready yet.';
  if (freeSpaces(state) < 2) return 'Make room for 2 berries before harvesting.';
  if (isExhausted(state)) return TOO_TIRED_MESSAGE;
  return null;
}

const plantGarden: ActionHandler<'plantGarden'> = (state, action) => {
  const blocker = plantGardenBlocker(state, action.plotIndex);
  const spent = spendFood(state, 'berry', 1);
  if (blocker || !spent) return refuse(state, blocker ?? 'No food in your bag.');
  const gardenPlots = state.gardenPlots.map((plot, index) => index === action.plotIndex
    ? { plantedYear: yearOf(state.day), harvestedYear: null, harvestReady: false }
    : plot);
  const planted = {
    ...spent,
    gardenPlots,
    player: tire(state, BALANCE.gatherEnergyCost)
  };
  return { state: advanceTime(planted, workSeconds(state, BALANCE.gatherSeconds), 'working'), message: 'Planted a berry bush.' };
};

const harvestGarden: ActionHandler<'harvestGarden'> = (state, action) => {
  const blocker = harvestGardenBlocker(state, action.plotIndex);
  if (blocker) return refuse(state, blocker);
  const gardenPlots = state.gardenPlots.map((plot, index) => index === action.plotIndex
    ? { ...plot, harvestedYear: yearOf(state.day), harvestReady: false }
    : plot);
  const harvested = {
    ...state,
    inventory: { ...state.inventory, food: addFood(state.inventory.food, 'berry', 2, state.day) },
    gardenPlots,
    player: tire(state, BALANCE.gatherEnergyCost)
  };
  return { state: advanceTime(harvested, workSeconds(state, BALANCE.gatherSeconds), 'working'), message: 'Picked 2 berries from the garden.' };
};

/** Sowing costs nothing: each bed keeps its own seed. It takes the time and energy of planting a bush. */
const sowBed: ActionHandler<'sowBed'> = (state, action) => {
  const blocker = sowBedBlocker(state, action.index);
  if (blocker) return refuse(state, blocker);
  const beds = state.beds.map((bed, index) => index === action.index ? { ...emptyBed(), sown: true } : bed);
  return {
    state: advanceTime({ ...state, beds, player: tire(state, BALANCE.gatherEnergyCost) }, workSeconds(state, BALANCE.gatherSeconds), 'working'),
    message: `Sowed the ${BED_CROPS[action.index]}.`
  };
};

const harvestBed: ActionHandler<'harvestBed'> = (state, action) => {
  const blocker = harvestBedBlocker(state, action.index);
  if (blocker) return refuse(state, blocker);
  const beds = state.beds.map((bed, index) => index === action.index ? emptyBed() : bed);
  const harvested = {
    ...state,
    inventory: { ...state.inventory, food: addFood(state.inventory.food, 'vegetables', BALANCE.cropYield, state.day) },
    beds,
    player: tire(state, BALANCE.gatherEnergyCost)
  };
  return { state: advanceTime(harvested, workSeconds(state, BALANCE.gatherSeconds), 'working'), message: `Harvested the ${BED_CROPS[action.index]}.` };
};

/** One bucket from the well waters every bed still growing, for today. It takes the time and energy of gathering. */
const drawWater: ActionHandler<'drawWater'> = state => {
  const blocker = drawWaterBlocker(state);
  if (blocker) return refuse(state, blocker);
  const beds = state.beds.map(bed => needsWater(bed) ? { ...bed, wateredDay: state.day } : bed);
  return {
    state: advanceTime({ ...state, beds, player: tire(state, BALANCE.gatherEnergyCost) }, workSeconds(state, BALANCE.gatherSeconds), 'working'),
    message: 'You draw a bucket and water the beds.'
  };
};

function missingCost(state: GameState, cost: { wood: number; fiber: number; stone: number }): string | null {
  const needed = [
    availableWood(state) < cost.wood ? `${cost.wood} wood` : null,
    availableFiber(state) < cost.fiber ? `${cost.fiber} fiber` : null,
    availableStone(state) < cost.stone ? `${cost.stone} stone` : null
  ].filter(Boolean);
  return needed.length ? `Need ${needed.join(' and ')} to build this.` : null;
}

function buildBlocker(state: GameState, structureId: StructureId): string | null {
  if (!isInClearing(state)) return 'Return to the marked camp area to build.';
  const definition = BUILDINGS[structureId];
  if (!definition) return 'That structure is unavailable.';
  if (definition.prerequisite === 'coldNight' && !state.progress.hearthUnlocked) return 'Weather the cold night to unlock the hearth.';
  if (state.structures[structureId]) return 'Already built.';
  const ground = groundBlocker(state, structureId);
  if (ground) return ground;
  const missingStructure = missingStructurePrerequisite(state, definition);
  if (missingStructure) return `Build the ${BUILDINGS[missingStructure].name.toLowerCase()} first.`;
  if (isExhausted(state)) return TOO_TIRED_MESSAGE;
  return missingCost(state, buildingCost(structureId));
}

function buildingCost(structureId: StructureId): { wood: number; fiber: number; stone: number } {
  const cost = BUILDINGS[structureId].cost;
  return { wood: cost.wood, fiber: cost.fiber, stone: 'stone' in cost ? cost.stone : 0 };
}

const MOVING_IN_MESSAGE = 'You carry your bed into the house. The fireplace inside will keep you warm now, and the campfire is yours to light whenever you like.';

const build: ActionHandler<'build'> = (state, action) => {
  const blocker = buildBlocker(state, action.structureId);
  if (blocker) return refuse(state, blocker);
  const house = action.structureId === 'house';
  return {
    state: payAndBuild(state, buildingCost(action.structureId), { structures: { ...state.structures, [action.structureId]: true } },
      house ? BALANCE.houseBuildSeconds : undefined),
    message: house ? MOVING_IN_MESSAGE : `Built the ${BUILDINGS[action.structureId].name.toLowerCase()}.`
  };
};

const rest: ActionHandler<'rest'> = state => {
  if (!isAtHome(state)) return refuse(state, livesInHouse(state) ? 'Go home to rest.' : 'Move closer to the fire to rest.');
  const rested = advanceTime(markWarmRest(state), BALANCE.restSeconds, 'resting');
  const bedGain = BALANCE.bedRestEnergyGain + (state.companion.pillow ? BALANCE.pillowEnergyGain : 0);
  const gain = recovery(state, rested.structures.bed ? bedGain : BALANCE.restEnergyGain) + cakeEnergy(state);
  return {
    state: { ...rested, player: { ...rested.player, energy: Math.min(100, rested.player.energy + gain) }, cakeBonus: false },
    message: 'You take a short rest.'
  };
};

/** Energy after a night's sleep: full in a bed, otherwise a good boost; hungry, half the boost and no more than the cap, which a pillow raises. */
function sleptEnergy(state: GameState): number {
  const { energy } = state.player;
  const rested = state.structures.bed ? 100 : Math.min(100, energy + BALANCE.sleepEnergyGain);
  if (!isHungry(state)) return rested;
  const cap = BALANCE.hungrySleepCap + (state.companion.pillow ? BALANCE.pillowEnergyGain : 0);
  return Math.max(energy, Math.min(cap, energy + (rested - energy) * BALANCE.hungryRecoveryFactor));
}

/** The bird's alarm names the fire that keeps the survivor warm: the fireplace once they live in the house. */
const alarmMessage = (state: GameState): string => `Your bird woke you. The ${livesInHouse(state) ? 'fireplace' : 'fire'} is nearly out.`;

/** What the night did to the fire that keeps the survivor warm: in the house, the fireplace, which went out only if it burned and the store ran dry. */
function fireDiedNote(before: GameState, after: GameState): string {
  if (livesInHouse(before)) {
    const burned = before.fireplaceFuel > 0 || logsInStore(after) < logsInStore(before);
    return burned && after.fireplaceFuel <= 0 && logsInStore(after) === 0 ? ' The fireplace went out in the night.' : '';
  }
  return before.fireFuel > 0 && after.fireFuel <= 0 ? ' The fire burned out in the night.' : '';
}

const sleep: ActionHandler<'sleep'> = unmarked => {
  const blocked = sleepBlocker(unmarked);
  if (blocked) return refuse(unmarked, blocked);
  const state = markWarmRest(unmarked);
  const night = BALANCE.daySeconds - state.timeOfDay;
  const alarm = alarmAfter(state);
  if (alarm !== null && alarm < night) {
    // Woken early, the survivor gets the share of the night's rest they slept.
    const energy = Math.min(100, state.player.energy + (sleptEnergy(state) - state.player.energy) * alarm / night + cakeEnergy(state));
    const woken = advanceTime({ ...state, player: { ...state.player, energy }, cakeBonus: false }, alarm, 'resting');
    return { state: { ...woken, companion: { ...woken.companion, alarmDay: state.day } }, message: alarmMessage(state) };
  }
  const slept = advanceTime({ ...state, player: { ...state.player, energy: Math.min(100, sleptEnergy(state) + cakeEnergy(state)) }, cakeBonus: false }, night, 'resting');
  return { state: slept, message: `You sleep until morning.${fireDiedNote(state, slept)}` };
};

const befriend: ActionHandler<'befriend'> = state => {
  const offered = makeOffering(state);
  if (!offered) return refuse(state, offerBlocker(state) ?? '');
  return { state: advanceTime(offered.state, BALANCE.offerSeconds, 'resting'), message: offered.message };
};

function craftKeepsake(state: GameState, item: 'pillow' | 'cloak', blocker: string | null, message: string): ActionResult {
  if (blocker) return refuse(state, blocker);
  return {
    state: advanceTime({ ...state, player: tire(state, BALANCE.buildEnergyCost), companion: { ...state.companion, [item]: true, keepsakes: 0 } },
      workSeconds(state, BALANCE.buildSeconds), 'working'),
    message
  };
}

const craftPillow: ActionHandler<'craftPillow'> = state =>
  craftKeepsake(state, 'pillow', pillowBlocker(state), 'You stitched a feather pillow. The bed is softer for it.');
const craftCloak: ActionHandler<'craftCloak'> = state =>
  craftKeepsake(state, 'cloak', cloakBlocker(state), 'You made a fur cloak. The nights will bite a little less.');

const makeUpgrade: ActionHandler<'makeUpgrade'> = (state, action) => {
  const blocker = upgradeBlocker(state, action.upgrade);
  if (blocker) return refuse(state, blocker);
  const workshop = { ...state.progress.workshop, [action.upgrade]: true };
  return {
    state: payAndBuild(state, WORKSHOP_UPGRADES[action.upgrade].cost, { progress: { ...state.progress, workshop } }),
    message: UPGRADE_MESSAGES[action.upgrade]
  };
};

const HANDLERS: { [T in GameAction['type']]: ActionHandler<T> } = {
  move, cross, gather, craftAxe, craftPickaxe, craftPot, craftPack, gatherRubble, digQuarry, chopTree, markClearing, clearGround, visitSite,
  storeFood, takeFood, dropStone, pickUpStone, burnFiber, eat, eatTrailFood, prepareTrailFood,
  cook, stargaze, stokeFire, repairLookout, build, plantGarden, harvestGarden, sowBed, harvestBed, drawWater, makeUpgrade, rest, sleep, befriend, craftPillow, craftCloak,
  makeFishingLine, fish
};

/** An action that carried the survivor into the end of their story says so, in place of its own message. */
function endingNote(before: GameState, result: ActionResult): ActionResult {
  if (before.ending || !result.state.ending) return result;
  const night = result.state.ending.day === before.day && before.timeOfDay >= nightStart(before.day);
  return { ...result, message: night ? GAVE_OUT_MESSAGE : 'Your strength has given out.' };
}

export function applyAction(state: GameState, action: GameAction): ActionResult {
  if (state.ending) return refuse(state, ENDED_MESSAGE);
  const handler = HANDLERS[action.type] as ActionHandler<GameAction['type']> | undefined;
  if (!handler) return refuse(state, 'That action is not available yet.');
  const result = endingNote(state, handler(state, action as never));
  // Anything that moved the survivor or the bag gives the camp stores a chance to take in their materials.
  return result.state === state ? result : { ...result, state: settleStores(result.state) };
}

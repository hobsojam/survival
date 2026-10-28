import { isSpring, isSummer, isWinter, nightStart } from './calendar';
import { CAMP_EXIT, QUARRY_EXIT, QUARRY_SITE, RUBBLE_SITE, crossing, pathOpen } from './areas';
import { TOO_TIRED_MESSAGE, isExhausted, isHungry, isLowMeter, recovery, workSeconds } from './needs';
import { isRaining } from './rain';
import { wolfVisit } from './wolves';
import { alarmAfter, cloakBlocker, companionDawn, startleFox, makeOffering, offerBlocker, pickUpKeepsake, pillowBlocker } from './companion';
import { BALANCE, BUILDINGS, LOOKOUT, PICKAXE, SITES, type GameState, type SiteId, type StructureId } from './state';

export type GameAction =
  | { type: 'gather'; nodeId: string }
  | { type: 'chopTree'; treeId: string }
  | { type: 'visitSite'; siteId: SiteId }
  | { type: 'build'; structureId: StructureId }
  | { type: 'move'; dx: number; dy: number }
  | { type: 'eat' | 'eatTrailFood' | 'prepareTrailFood' | 'stokeFire' | 'rest' | 'sleep' | 'cook' | 'stargaze' | 'repairLookout' | 'cross' | 'craftAxe' | 'craftPickaxe' | 'gatherRubble' | 'digQuarry' | 'burnFiber' | 'dropStone' | 'storeStone' | 'takeStone' | 'befriend' | 'craftPillow' | 'craftCloak' }
  | { type: 'pickUpStone'; pileId: string };

/** Awake time tires the survivor; work already costs energy, and resting doesn't. */
export type Activity = 'awake' | 'working' | 'resting';

export interface ActionResult {
  state: GameState;
  message: string;
}

function near(x1: number, y1: number, x2: number, y2: number, radius: number = BALANCE.interactionRadius): boolean {
  return Math.hypot(x1 - x2, y1 - y2) <= radius;
}

export function isAtCamp(state: GameState): boolean {
  return state.area === 'camp' && Math.hypot(state.player.x - BALANCE.campX, state.player.y - BALANCE.campY) <= BALANCE.campRadius;
}

export const FULL_BAG_MESSAGE = 'Your bag is full. Eat, burn, or set something down at camp to make room.';

/** Bag spaces one of this supply takes; stone is heavy. */
export function spaceFor(resource: keyof GameState['inventory']): number {
  return resource === 'stone' ? BALANCE.stoneSpaces : 1;
}

/** Bag spaces in use, counting stone at its weight. */
export function carriedCount(state: GameState): number {
  return (Object.keys(state.inventory) as (keyof GameState['inventory'])[])
    .reduce((total, resource) => total + state.inventory[resource] * spaceFor(resource), 0);
}

export function bagCapacity(state: GameState): number {
  return state.structures.crate ? BALANCE.crateCapacity : BALANCE.baseCapacity;
}

export function freeSpaces(state: GameState): number {
  return bagCapacity(state) - carriedCount(state);
}

/** Stone a build can use: the bag plus the camp stone pile, which counts from anywhere. */
export function availableStone(state: GameState): number {
  return state.inventory.stone + state.storedStone;
}

/** Pays stone from the bag first, then from the camp pile. */
export function spendStone(state: GameState, amount: number): GameState {
  const fromBag = Math.min(amount, state.inventory.stone);
  return { ...state, inventory: { ...state.inventory, stone: state.inventory.stone - fromBag }, storedStone: state.storedStone - (amount - fromBag) };
}

export function trailFoodBlocker(state: GameState): string | null {
  if (!state.structures.dryingRack) return 'Build a drying rack to prepare trail food.';
  if (!isAtCamp(state)) return 'Return to camp to use the drying rack.';
  if (state.inventory.food <= 0) return 'Gather a berry to prepare trail food.';
  return null;
}

export function lookoutRepairBlocker(state: GameState): string | null {
  if (state.area !== 'camp') return 'There is nothing like that here.';
  if (state.progress.lookoutRepaired) return 'The lookout is already restored.';
  if (!state.progress.hearthUnlocked) return 'Weather the cold front before repairing the lookout.';
  if (!near(state.player.x, state.player.y, LOOKOUT.x, LOOKOUT.y)) return 'Stand beside the lookout to repair it.';
  if (isExhausted(state)) return TOO_TIRED_MESSAGE;
  const { wood, fiber, stone } = LOOKOUT.cost;
  if (state.inventory.wood < wood || state.inventory.fiber < fiber || availableStone(state) < stone) {
    const needed = [state.inventory.wood < wood ? `${wood} wood` : null,
      state.inventory.fiber < fiber ? `${fiber} fiber` : null,
      availableStone(state) < stone ? `${stone} stone` : null].filter(Boolean).join(' and ');
    return `Need ${needed} to repair the lookout.`;
  }
  return null;
}

export function isColdNight(state: GameState): boolean {
  return state.progress.nextStormDay === state.day && state.timeOfDay >= nightStart(state.day);
}

/** The forecast front's night, or any winter night: the fire burns fast and the cold bites. */
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
  if (!isAtCamp(state)) return 'Return to the marked camp area to sleep.';
  if (!state.structures.shelter) return 'Build a shelter to sleep through the night.';
  return null;
}

/** Why the survivor can't cook right now, or null if they can. */
export function cookBlocker(state: GameState): string | null {
  if (state.timeOfDay < nightStart(state.day)) return 'Cook berries after nightfall.';
  if (!isAtCamp(state)) return 'Return to camp to cook.';
  if (state.fireFuel <= 0) return 'Light the campfire before cooking.';
  if (state.inventory.food <= 0) return 'Gather a berry to cook.';
  return null;
}

/** Why the survivor can't watch the stars right now, or null if they can. */
export function stargazeBlocker(state: GameState): string | null {
  if (state.timeOfDay < nightStart(state.day)) return 'Wait until nightfall to watch the stars.';
  if (!isAtCamp(state)) return 'Return to camp to watch the stars.';
  return null;
}

/** Why the pickaxe can't be crafted right now, or null if it can. */
export function pickaxeBlocker(state: GameState): string | null {
  if (state.progress.pickaxeCrafted) return 'You already have a pickaxe.';
  if (!state.progress.quarryFound) return 'Find the quarry first.';
  if (!state.structures.toolshed) return 'Build a toolshed first.';
  if (!isAtCamp(state)) return 'Return to camp to craft the pickaxe.';
  if (isExhausted(state)) return TOO_TIRED_MESSAGE;
  const { wood, fiber, stone } = PICKAXE.cost;
  if (state.inventory.wood < wood || state.inventory.fiber < fiber || availableStone(state) < stone)
    return `Need ${wood} wood, ${fiber} fiber, and ${stone} stone for the pickaxe.`;
  return null;
}

export type BuildStatus = 'built' | 'locked' | 'needsShelter' | 'needsPrerequisite' | 'ready' | 'unavailable';

/** How a structure's build button should look: built, locked, blocked by a missing shelter, ready to build here, or not yet. */
export function buildStatus(state: GameState, id: StructureId): BuildStatus {
  const definition = BUILDINGS[id];
  if (state.structures[id]) return 'built';
  if (definition.prerequisite === 'coldNight' && !state.progress.hearthUnlocked) return 'locked';
  const missingPrerequisite = missingStructurePrerequisite(state, definition);
  if (missingPrerequisite === 'shelter') return 'needsShelter';
  if (missingPrerequisite) return 'needsPrerequisite';
  const cost = definition.cost;
  const stoneCost = 'stone' in cost ? cost.stone : 0;
  const affordable = state.inventory.wood >= cost.wood && state.inventory.fiber >= cost.fiber && availableStone(state) >= stoneCost;
  return affordable && isAtCamp(state) && !isExhausted(state) ? 'ready' : 'unavailable';
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
  if (!Number.isFinite(seconds) || seconds <= 0) return state;
  const next: GameState = {
    ...state,
    player: { ...state.player },
    progress: { ...state.progress },
    trees: state.trees.map(tree => ({ ...tree }))
  };
  let remaining = seconds;
  while (remaining > 0.000001) {
    const step = Math.min(remaining, 1, BALANCE.daySeconds - next.timeOfDay);
    const camp = isAtCamp(next);
    const coldNight = isFreezingNight(next);
    const drain = (activity === 'awake' ? BALANCE.energyDrainPerSecond : 0) + (next.player.hunger <= 0 ? BALANCE.starvingEnergyDrainPerSecond : 0);
    next.player.hunger = Math.max(0, next.player.hunger - hungerLoss(next, step));
    next.player.energy = Math.max(0, next.player.energy - step * drain);
    next.player.warmth = Math.max(0, Math.min(100, next.player.warmth + warmthChange(next, step, camp, coldNight)));
    next.fireFuel = Math.max(0, next.fireFuel - step * fireBurn(next, coldNight));
    next.timeOfDay += step;
    remaining -= step;
    wolfVisit(next);
    startleFox(next);
    if (next.timeOfDay >= BALANCE.daySeconds - 0.000001) dawn(next, camp);
  }
  return next;
}

/** Hunger lost over one step: an eighth a second, faster for the part of the step in summer's midday heat. */
function hungerLoss(state: GameState, step: number): number {
  if (!isSummer(state.day)) return step / 8;
  const hot = Math.max(0, Math.min(state.timeOfDay + step, BALANCE.summerHeatEnd) - Math.max(state.timeOfDay, BALANCE.summerHeatStart));
  return (step + hot * (BALANCE.summerHeatHunger - 1)) / 8;
}

/** The note when summer's midday heat begins, or null. */
export function heatMessage(before: GameState, after: GameState): string | null {
  const began = before.day === after.day && isSummer(after.day)
    && before.timeOfDay < BALANCE.summerHeatStart && after.timeOfDay >= BALANCE.summerHeatStart;
  return began ? 'The midday sun is hot. You will get hungry a little faster.' : null;
}

/** How fast the fire burns: twice as fast on a freezing night, half as fast again in a spring shower. */
function fireBurn(state: GameState, coldNight: boolean): number {
  if (coldNight) return BALANCE.coldNightFireBurn;
  return isRaining(state) ? BALANCE.rainFireBurn : 1;
}

/** How much warmth one step of time adds or takes, read before the step's fire burn. Rain chills like an ordinary night, except in the shelter. */
function warmthChange(state: GameState, step: number, camp: boolean, coldNight: boolean): number {
  const sheltered = camp && state.structures.shelter;
  if (state.timeOfDay < nightStart(state.day) && !(isRaining(state) && !sheltered)) return step / 10;
  const lit = state.fireFuel > 0;
  if (camp && lit) return step / 2;
  let change = -step / 2;
  if (coldNight) {
    change = -step * (sheltered
      ? BALANCE.coldNightShelteredWarmthLossPerSecond
      : BALANCE.coldNightOutdoorWarmthLossPerSecond);
  } else if (sheltered) {
    change = -step * (state.structures.shelterThatched ? BALANCE.thatchedShelteredWarmthLossPerSecond : 0.25);
  }
  if (camp && !lit && state.structures.windbreak) change *= 0.5;
  // A fur cloak keeps a quarter of the night's chill off, wherever the survivor is.
  if (state.companion.cloak && state.timeOfDay >= nightStart(state.day)) change *= BALANCE.cloakWarmthLoss;
  // Summer nights are warm, except the forecast front's.
  return isSummer(state.day) && !coldNight ? Math.max(0, change) : change;
}

/** Starts the next day in place: regrows nodes and settles the cold night if it just ended. */
function dawn(next: GameState, camp: boolean): void {
  const stormEnded = next.progress.nextStormDay === next.day;
  const weathered = stormEnded && camp && next.structures.shelter && next.fireFuel > 0 && next.player.warmth > 20;
  next.day += 1;
  next.timeOfDay = 0;
  // Rocks give their stone once; everything else grows back at dawn.
  next.nodes = next.nodes.map(node => node.kind !== 'stone' && node.readyDay <= next.day ? { ...node, amount: 1 } : node);
  companionDawn(next);
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

/** Pays wood and fiber from the bag and stone from the bag or pile, then spends build time. */
function payAndBuild(state: GameState, cost: { wood: number; fiber: number; stone: number }, changes: Partial<GameState>): GameState {
  const paid = spendStone(state, cost.stone);
  return advanceTime({
    ...paid,
    inventory: { ...paid.inventory, wood: state.inventory.wood - cost.wood, fiber: state.inventory.fiber - cost.fiber },
    player: tire(state, BALANCE.buildEnergyCost),
    ...changes
  }, workSeconds(state, BALANCE.buildSeconds), 'working');
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

const NODE_RESOURCE: Record<GameState['nodes'][number]['kind'], keyof GameState['inventory']> = { branch: 'wood', berry: 'food', fiber: 'fiber', stone: 'stone' };
const GATHER_MESSAGE: Partial<Record<keyof GameState['inventory'], string>> = {
  wood: 'Picked up fallen branches.', food: 'Picked berries.', fiber: 'Gathered fiber.', stone: 'Collected stone.'
};

const gather: ActionHandler<'gather'> = (state, action) => {
  const node = state.nodes.find(item => item.id === action.nodeId);
  if (!node || state.area !== 'camp' || !near(state.player.x, state.player.y, node.x, node.y)) return refuse(state, 'Move closer to gather.');
  if (node.kind === 'berry' && isWinter(state.day)) return refuse(state, 'The bushes are bare until spring.');
  if (node.amount <= 0) return refuse(state, 'Nothing to gather yet.');
  const resource = NODE_RESOURCE[node.kind];
  if (freeSpaces(state) < spaceFor(resource)) return refuse(state, FULL_BAG_MESSAGE);
  const nodes = state.nodes.map(item => item === node ? { ...item, amount: item.amount - 1, readyDay: state.day + 1 } : item);
  // Summer bushes are heavy: two berries a pick, if the bag has room.
  const picked = node.kind === 'berry' && isSummer(state.day) ? Math.min(BALANCE.summerBerries, freeSpaces(state)) : 1;
  return {
    state: advanceTime({
      ...state,
      player: tire(state, BALANCE.gatherEnergyCost),
      inventory: { ...state.inventory, [resource]: state.inventory[resource] + picked },
      nodes
    }, workSeconds(state, BALANCE.gatherSeconds), 'working'),
    message: picked > 1 ? 'Picked two handfuls of berries.' : GATHER_MESSAGE[resource] ?? ''
  };
};

export function axeBlocker(state: GameState): string | null {
  if (state.progress.axeCrafted) return 'You already have a stone axe.';
  if (!state.progress.hearthUnlocked) return 'Weather the cold front before crafting an axe.';
  if (!state.structures.toolshed) return 'Build a toolshed first.';
  if (!isAtCamp(state)) return 'Return to camp to craft the axe.';
  if (isExhausted(state)) return TOO_TIRED_MESSAGE;
  if (state.inventory.wood < 1 || state.inventory.fiber < 1 || availableStone(state) < 1) return 'Need 1 wood, 1 fiber, and 1 stone for the axe.';
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

const chopTree: ActionHandler<'chopTree'> = (state, action) => {
  if (!state.progress.axeCrafted) return refuse(state, 'Craft a stone axe before chopping trees.');
  const tree = state.trees.find(item => item.id === action.treeId);
  if (!tree || state.area !== 'camp' || !near(state.player.x, state.player.y, tree.x, tree.y)) return refuse(state, 'Move closer to a mature tree.');
  if (tree.readyDay > state.day) return refuse(state, 'This stump needs more time to regrow.');
  if (isExhausted(state)) return refuse(state, TOO_TIRED_MESSAGE);
  if (freeSpaces(state) < 2 * spaceFor('wood')) return refuse(state, 'Your bag needs two free spaces for wood.');
  return {
    state: advanceTime({
      ...state,
      player: tire(state, BALANCE.chopEnergyCost),
      inventory: { ...state.inventory, wood: state.inventory.wood + 2 },
      trees: state.trees.map(item => item.id === tree.id ? { ...item, readyDay: state.day + treeRegrowDays(state.day) } : item)
    }, workSeconds(state, BALANCE.chopSeconds), 'working'),
    message: 'Chopped the tree and collected two wood. A stump remains.'
  };
};

function restAtSpring(state: GameState): ActionResult {
  if (isWinter(state.day)) return {
    state: { ...state, progress: { ...state.progress, discoveries: { ...state.progress.discoveries, spring: true } } },
    message: 'The spring is frozen over.'
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
    inventory: { ...state.inventory, [resource]: state.inventory[resource] + 2 },
    progress: { ...state.progress, discoveries: { ...state.progress.discoveries, [action.siteId]: true } }
  }, workSeconds(state, BALANCE.gatherSeconds), 'working');
  return { state: found, message: action.siteId === 'basket' ? 'An old basket holds two berries.' : 'You find two useful stones tucked in the cairn.' };
};

function stonePileBlocker(state: GameState): string | null {
  if (!state.structures.stonePile) return 'Build a stone pile first.';
  if (!isAtCamp(state)) return 'Return to camp to use the stone pile.';
  return null;
}

const storeStone: ActionHandler<'storeStone'> = state => {
  const blocker = stonePileBlocker(state);
  if (blocker) return refuse(state, blocker);
  if (state.inventory.stone < 1) return refuse(state, 'You have no stone to store.');
  if (state.storedStone >= BALANCE.stonePileCapacity) return refuse(state, 'The stone pile is full.');
  return { state: { ...state, inventory: { ...state.inventory, stone: state.inventory.stone - 1 }, storedStone: state.storedStone + 1 }, message: 'Stored a stone.' };
};

const takeStone: ActionHandler<'takeStone'> = state => {
  const blocker = stonePileBlocker(state);
  if (blocker) return refuse(state, blocker);
  if (state.storedStone < 1) return refuse(state, 'The stone pile is empty.');
  if (freeSpaces(state) < spaceFor('stone')) return refuse(state, FULL_BAG_MESSAGE);
  return { state: { ...state, inventory: { ...state.inventory, stone: state.inventory.stone + 1 }, storedStone: state.storedStone - 1 }, message: 'Took a stone from the pile.' };
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
  if (!isAtCamp(state)) return refuse(state, 'Return to the marked camp area to tend the fire.');
  if (state.inventory.fiber < 1) return refuse(state, 'You have no fiber to burn.');
  return {
    state: { ...state, inventory: { ...state.inventory, fiber: state.inventory.fiber - 1 }, fireFuel: state.fireFuel + BALANCE.fiberFireSeconds },
    message: 'The kindling flares up.'
  };
};

const eat: ActionHandler<'eat'> = state => {
  if (state.inventory.food <= 0) return refuse(state, 'No food in your bag.');
  return {
    state: {
      ...state,
      inventory: { ...state.inventory, food: state.inventory.food - 1 },
      player: { ...state.player, hunger: Math.min(100, state.player.hunger + BALANCE.eatHungerGain) }
    },
    message: 'Ate some berries.'
  };
};

const eatTrailFood: ActionHandler<'eatTrailFood'> = state => {
  if (state.inventory.trailFood <= 0) return refuse(state, 'No trail rations in your bag.');
  return {
    state: { ...state,
      inventory: { ...state.inventory, trailFood: state.inventory.trailFood - 1 },
      player: { ...state.player, hunger: Math.min(100, state.player.hunger + BALANCE.trailFoodHungerGain) }
    },
    message: 'Ate a trail ration.'
  };
};

const prepareTrailFood: ActionHandler<'prepareTrailFood'> = state => {
  const blocker = trailFoodBlocker(state);
  if (blocker) return refuse(state, blocker);
  return {
    state: advanceTime({ ...state,
      inventory: { ...state.inventory, food: state.inventory.food - 1, trailFood: state.inventory.trailFood + 1 },
      player: tire(state, BALANCE.gatherEnergyCost)
    }, workSeconds(state, BALANCE.trailFoodSeconds), 'working'),
    message: 'Dried a berry into one trail ration.'
  };
};

const cook: ActionHandler<'cook'> = state => {
  const blocker = cookBlocker(state);
  if (blocker) return refuse(state, blocker);
  const cooked = advanceTime({ ...state, inventory: { ...state.inventory, food: state.inventory.food - 1 } }, BALANCE.cookSeconds, 'resting');
  return {
    state: { ...cooked, player: { ...cooked.player,
      hunger: Math.min(100, cooked.player.hunger + (state.structures.dryingRack ? BALANCE.rackCookHungerGain : BALANCE.cookHungerGain)),
      warmth: Math.min(100, cooked.player.warmth + BALANCE.cookWarmthGain)
    } },
    message: 'You toast a berry by the fire. A warm little meal.'
  };
};

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
  if (!isAtCamp(state)) return refuse(state, 'Return to the marked camp area to tend the fire.');
  if (state.inventory.wood < 1) return refuse(state, 'You need wood for the fire.');
  return {
    state: { ...state, inventory: { ...state.inventory, wood: state.inventory.wood - 1 }, fireFuel: state.fireFuel + (state.structures.hearth ? BALANCE.hearthFireSecondsPerWood : BALANCE.fireSecondsPerWood) },
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

function missingCost(state: GameState, cost: { wood: number; fiber: number; stone: number }): string | null {
  const needed = [
    state.inventory.wood < cost.wood ? `${cost.wood} wood` : null,
    state.inventory.fiber < cost.fiber ? `${cost.fiber} fiber` : null,
    availableStone(state) < cost.stone ? `${cost.stone} stone` : null
  ].filter(Boolean);
  return needed.length ? `Need ${needed.join(' and ')} to build this.` : null;
}

function buildBlocker(state: GameState, structureId: StructureId): string | null {
  if (!isAtCamp(state)) return 'Return to the marked camp area to build.';
  const definition = BUILDINGS[structureId];
  if (!definition) return 'That structure is unavailable.';
  if (definition.prerequisite === 'coldNight' && !state.progress.hearthUnlocked) return 'Weather the cold night to unlock the hearth.';
  if (state.structures[structureId]) return 'Already built.';
  const missingStructure = missingStructurePrerequisite(state, definition);
  if (missingStructure) return `Build the ${BUILDINGS[missingStructure].name.toLowerCase()} first.`;
  if (isExhausted(state)) return TOO_TIRED_MESSAGE;
  return missingCost(state, buildingCost(structureId));
}

function buildingCost(structureId: StructureId): { wood: number; fiber: number; stone: number } {
  const cost = BUILDINGS[structureId].cost;
  return { wood: cost.wood, fiber: cost.fiber, stone: 'stone' in cost ? cost.stone : 0 };
}

const build: ActionHandler<'build'> = (state, action) => {
  const blocker = buildBlocker(state, action.structureId);
  if (blocker) return refuse(state, blocker);
  return {
    state: payAndBuild(state, buildingCost(action.structureId), { structures: { ...state.structures, [action.structureId]: true } }),
    message: `Built the ${BUILDINGS[action.structureId].name.toLowerCase()}.`
  };
};

const rest: ActionHandler<'rest'> = state => {
  if (!isAtCamp(state)) return refuse(state, 'Return to the marked camp area to rest.');
  const rested = advanceTime(state, BALANCE.restSeconds, 'resting');
  const bedGain = BALANCE.bedRestEnergyGain + (state.companion.pillow ? BALANCE.pillowEnergyGain : 0);
  const gain = recovery(state, rested.structures.bed ? bedGain : BALANCE.restEnergyGain);
  return {
    state: { ...rested, player: { ...rested.player, energy: Math.min(100, rested.player.energy + gain) } },
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

const ALARM_MESSAGE = 'Your bird woke you. The fire is nearly out.';

const sleep: ActionHandler<'sleep'> = state => {
  const blocked = sleepBlocker(state);
  if (blocked) return refuse(state, blocked);
  const night = BALANCE.daySeconds - state.timeOfDay;
  const alarm = alarmAfter(state);
  if (alarm !== null && alarm < night) {
    // Woken early, the survivor gets the share of the night's rest they slept.
    const energy = state.player.energy + (sleptEnergy(state) - state.player.energy) * alarm / night;
    const woken = advanceTime({ ...state, player: { ...state.player, energy } }, alarm, 'resting');
    return { state: { ...woken, companion: { ...woken.companion, alarmDay: state.day } }, message: ALARM_MESSAGE };
  }
  const slept = advanceTime({ ...state, player: { ...state.player, energy: sleptEnergy(state) } }, night, 'resting');
  const fireDied = state.fireFuel > 0 && slept.fireFuel <= 0;
  return {
    state: slept,
    message: fireDied ? 'You sleep until morning. The fire burned out in the night.' : 'You sleep until morning.'
  };
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

const HANDLERS: { [T in GameAction['type']]: ActionHandler<T> } = {
  move, cross, gather, craftAxe, craftPickaxe, gatherRubble, digQuarry, chopTree, visitSite,
  storeStone, takeStone, dropStone, pickUpStone, burnFiber, eat, eatTrailFood, prepareTrailFood,
  cook, stargaze, stokeFire, repairLookout, build, rest, sleep, befriend, craftPillow, craftCloak
};

export function applyAction(state: GameState, action: GameAction): ActionResult {
  const handler = HANDLERS[action.type] as ActionHandler<GameAction['type']> | undefined;
  if (!handler) return refuse(state, 'That action is not available yet.');
  return handler(state, action as never);
}

import { BALANCE, BUILDINGS, LOOKOUT, SITES, type GameState, type SiteId, type StructureId } from './state';

export type GameAction =
  | { type: 'gather'; nodeId: string }
  | { type: 'chopTree'; treeId: string }
  | { type: 'visitSite'; siteId: SiteId }
  | { type: 'build'; structureId: StructureId }
  | { type: 'move'; dx: number; dy: number }
  | { type: 'eat' | 'eatTrailFood' | 'prepareTrailFood' | 'stokeFire' | 'rest' | 'sleep' | 'cook' | 'stargaze' | 'repairLookout' | 'craftAxe' | 'burnFiber' | 'dropStone' | 'storeStone' | 'takeStone' }
  | { type: 'pickUpStone'; pileId: string };

/** Awake time tires the survivor; work already costs energy, and resting doesn't. */
export type Activity = 'awake' | 'working' | 'resting';

export interface ActionResult {
  state: GameState;
  message: string;
}

function near(x1: number, y1: number, x2: number, y2: number): boolean {
  return Math.hypot(x1 - x2, y1 - y2) <= BALANCE.interactionRadius;
}

export function isAtCamp(state: GameState): boolean {
  return Math.hypot(state.player.x - BALANCE.campX, state.player.y - BALANCE.campY) <= BALANCE.campRadius;
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
  if (state.progress.lookoutRepaired) return 'The lookout is already restored.';
  if (!state.progress.hearthUnlocked) return 'Weather the cold front before repairing the lookout.';
  if (!near(state.player.x, state.player.y, LOOKOUT.x, LOOKOUT.y)) return 'Stand beside the lookout to repair it.';
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
  return state.progress.nextStormDay === state.day && state.timeOfDay >= BALANCE.nightStart;
}

export function movementFactor(state: GameState): number {
  return state.player.energy <= 20 || state.player.hunger <= 20 || state.player.warmth <= 20 ? 0.65 : 1;
}

/** Why the survivor can't sleep right now, or null if they can. */
export function sleepBlocker(state: GameState): string | null {
  if (state.timeOfDay < BALANCE.nightStart) return 'You can sleep once night falls. Rest (R) for a short break.';
  if (!isAtCamp(state)) return 'Return to the marked camp area to sleep.';
  if (!state.structures.shelter) return 'Build a shelter to sleep through the night.';
  return null;
}

/** Why the survivor can't cook right now, or null if they can. */
export function cookBlocker(state: GameState): string | null {
  if (state.timeOfDay < BALANCE.nightStart) return 'Cook berries after nightfall.';
  if (!isAtCamp(state)) return 'Return to camp to cook.';
  if (state.fireFuel <= 0) return 'Light the campfire before cooking.';
  if (state.inventory.food <= 0) return 'Gather a berry to cook.';
  return null;
}

/** Why the survivor can't watch the stars right now, or null if they can. */
export function stargazeBlocker(state: GameState): string | null {
  if (state.timeOfDay < BALANCE.nightStart) return 'Wait until nightfall to watch the stars.';
  if (!isAtCamp(state)) return 'Return to camp to watch the stars.';
  return null;
}

export type BuildStatus = 'built' | 'locked' | 'needsShelter' | 'ready' | 'unavailable';

/** How a structure's build button should look: built, locked, blocked by a missing shelter, ready to build here, or not yet. */
export function buildStatus(state: GameState, id: StructureId): BuildStatus {
  const definition = BUILDINGS[id];
  if (state.structures[id]) return 'built';
  if (definition.prerequisite === 'coldNight' && !state.progress.hearthUnlocked) return 'locked';
  if (definition.prerequisite === 'shelter' && !state.structures.shelter) return 'needsShelter';
  const cost = definition.cost;
  const stoneCost = 'stone' in cost ? cost.stone : 0;
  const affordable = state.inventory.wood >= cost.wood && state.inventory.fiber >= cost.fiber && availableStone(state) >= stoneCost;
  return affordable && isAtCamp(state) ? 'ready' : 'unavailable';
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
    const coldNight = isColdNight(next);
    next.player.hunger = Math.max(0, next.player.hunger - step / 8);
    if (activity === 'awake') next.player.energy = Math.max(0, next.player.energy - step * BALANCE.energyDrainPerSecond);
    next.player.warmth = Math.max(0, Math.min(100, next.player.warmth + warmthChange(next, step, camp, coldNight)));
    next.fireFuel = Math.max(0, next.fireFuel - step * (coldNight ? BALANCE.coldNightFireBurn : 1));
    next.timeOfDay += step;
    remaining -= step;
    if (next.timeOfDay >= BALANCE.daySeconds - 0.000001) dawn(next, camp);
  }
  return next;
}

/** How much warmth one step of time adds or takes, read before the step's fire burn. */
function warmthChange(state: GameState, step: number, camp: boolean, coldNight: boolean): number {
  if (state.timeOfDay < BALANCE.nightStart) return step / 10;
  const lit = state.fireFuel > 0;
  if (camp && lit) return step / 2;
  let change = -step / 2;
  if (coldNight) {
    change = -step * (camp && state.structures.shelter
      ? BALANCE.coldNightShelteredWarmthLossPerSecond
      : BALANCE.coldNightOutdoorWarmthLossPerSecond);
  } else if (camp && state.structures.shelter) {
    change = -step / 4;
  }
  return camp && !lit && state.structures.windbreak ? change * 0.5 : change;
}

/** Starts the next day in place: regrows nodes and settles the cold night if it just ended. */
function dawn(next: GameState, camp: boolean): void {
  const stormEnded = next.progress.nextStormDay === next.day;
  const weathered = stormEnded && camp && next.structures.shelter && next.fireFuel > 0 && next.player.warmth > 20;
  next.day += 1;
  next.timeOfDay = 0;
  // Rocks give their stone once; everything else grows back at dawn.
  next.nodes = next.nodes.map(node => node.kind !== 'stone' && node.readyDay <= next.day ? { ...node, amount: 1 } : node);
  if (!stormEnded) return;
  if (weathered) {
    next.progress = { ...next.progress, nextStormDay: null, hearthUnlocked: true };
    return;
  }
  next.progress = { ...next.progress, nextStormDay: next.day + BALANCE.coldNightRetryDays - 1, hearthUnlocked: false };
  next.player.energy = Math.min(next.player.energy, BALANCE.coldNightFailureEnergy);
  next.timeOfDay = BALANCE.coldNightFailureMorningLoss;
}

export function applyAction(state: GameState, action: GameAction): ActionResult {
  if (action.type === 'move') {
    const factor = movementFactor(state);
    return {
      state: {
        ...state,
        player: {
          ...state.player,
          x: Math.max(0, Math.min(BALANCE.mapWidth - 1, state.player.x + action.dx * factor)),
          y: Math.max(0, Math.min(BALANCE.mapHeight - 1, state.player.y + action.dy * factor))
        }
      },
      message: ''
    };
  }
  if (action.type === 'gather') {
    const index = state.nodes.findIndex(node => node.id === action.nodeId);
    const node = state.nodes[index];
    if (!node || !near(state.player.x, state.player.y, node.x, node.y)) {
      return { state, message: 'Move closer to gather.' };
    }
    if (node.amount <= 0) return { state, message: 'Nothing to gather yet.' };
    let resource: keyof GameState['inventory'] = 'wood';
    if (node.kind === 'berry') resource = 'food';
    else if (node.kind === 'fiber') resource = 'fiber';
    else if (node.kind === 'stone') resource = 'stone';
    if (freeSpaces(state) < spaceFor(resource)) return { state, message: FULL_BAG_MESSAGE };
    const nodes = state.nodes.map((item, itemIndex) => itemIndex === index
      ? { ...item, amount: item.amount - 1, readyDay: state.day + 1 }
      : item);
    return {
      state: advanceTime({
        ...state,
        player: { ...state.player, energy: Math.max(0, state.player.energy - BALANCE.gatherEnergyCost) },
        inventory: { ...state.inventory, [resource]: state.inventory[resource] + 1 },
        nodes
      }, BALANCE.gatherSeconds, 'working'),
      message: { wood: 'Picked up fallen branches.', food: 'Picked berries.', fiber: 'Gathered fiber.', stone: 'Collected stone.' }[resource]
    };
  }
  if (action.type === 'craftAxe') {
    if (state.progress.axeCrafted) return { state, message: 'You already have a stone axe.' };
    if (!state.progress.hearthUnlocked) return { state, message: 'Weather the cold front before crafting an axe.' };
    if (!isAtCamp(state)) return { state, message: 'Return to camp to craft the axe.' };
    if (state.inventory.wood < 1 || state.inventory.fiber < 1 || availableStone(state) < 1)
      return { state, message: 'Need 1 wood, 1 fiber, and 1 stone for the axe.' };
    const paid = spendStone(state, 1);
    return {
      state: advanceTime({
        ...paid,
        inventory: { ...paid.inventory, wood: state.inventory.wood - 1, fiber: state.inventory.fiber - 1 },
        player: { ...state.player, energy: Math.max(0, state.player.energy - BALANCE.buildEnergyCost) },
        progress: { ...state.progress, axeCrafted: true }
      }, BALANCE.buildSeconds, 'working'),
      message: 'Crafted a stone axe. Mature trees can now provide wood.'
    };
  }
  if (action.type === 'chopTree') {
    if (!state.progress.axeCrafted) return { state, message: 'Craft a stone axe before chopping trees.' };
    const tree = state.trees.find(item => item.id === action.treeId);
    if (!tree || !near(state.player.x, state.player.y, tree.x, tree.y)) return { state, message: 'Move closer to a mature tree.' };
    if (tree.readyDay > state.day) return { state, message: 'This stump needs more time to regrow.' };
    if (freeSpaces(state) < 2 * spaceFor('wood')) return { state, message: 'Your bag needs two free spaces for wood.' };
    return {
      state: advanceTime({
        ...state,
        player: { ...state.player, energy: Math.max(0, state.player.energy - BALANCE.chopEnergyCost) },
        inventory: { ...state.inventory, wood: state.inventory.wood + 2 },
        trees: state.trees.map(item => item.id === tree.id ? { ...item, readyDay: state.day + BALANCE.treeRegrowDays } : item)
      }, BALANCE.chopSeconds, 'working'),
      message: 'Chopped the tree and collected two wood. A stump remains.'
    };
  }
  if (action.type === 'visitSite') {
    const site = SITES[action.siteId];
    if (!site || !near(state.player.x, state.player.y, site.x, site.y)) return { state, message: 'Move closer to a place along the path.' };
    if (action.siteId === 'spring') {
      const rested = advanceTime({ ...state, progress: { ...state.progress,
        discoveries: { ...state.progress.discoveries, spring: true } } }, BALANCE.restSeconds, 'resting');
      return {
        state: { ...rested, player: { ...rested.player, energy: Math.min(100, rested.player.energy + 20) } },
        message: 'You pause beside the quiet spring and feel rested.'
      };
    }
    if (state.progress.discoveries[action.siteId]) return { state, message: `You have already searched the ${site.name.toLowerCase()}.` };
    const resource = action.siteId === 'basket' ? 'food' : 'stone';
    const needed = 2 * spaceFor(resource);
    if (freeSpaces(state) < needed) return { state, message: `Your bag needs ${needed} free spaces for this find.` };
    const found = advanceTime({
      ...state,
      player: { ...state.player, energy: Math.max(0, state.player.energy - BALANCE.gatherEnergyCost) },
      inventory: { ...state.inventory, [resource]: state.inventory[resource] + 2 },
      progress: { ...state.progress, discoveries: { ...state.progress.discoveries, [action.siteId]: true } }
    }, BALANCE.gatherSeconds, 'working');
    return { state: found, message: action.siteId === 'basket' ? 'An old basket holds two berries.' : 'You find two useful stones tucked in the cairn.' };
  }
  if (action.type === 'storeStone' || action.type === 'takeStone') {
    if (!state.structures.stonePile) return { state, message: 'Build a stone pile first.' };
    if (!isAtCamp(state)) return { state, message: 'Return to camp to use the stone pile.' };
    if (action.type === 'storeStone') {
      if (state.inventory.stone < 1) return { state, message: 'You have no stone to store.' };
      if (state.storedStone >= BALANCE.stonePileCapacity) return { state, message: 'The stone pile is full.' };
      return { state: { ...state, inventory: { ...state.inventory, stone: state.inventory.stone - 1 }, storedStone: state.storedStone + 1 }, message: 'Stored a stone.' };
    }
    if (state.storedStone < 1) return { state, message: 'The stone pile is empty.' };
    if (freeSpaces(state) < spaceFor('stone')) return { state, message: FULL_BAG_MESSAGE };
    return { state: { ...state, inventory: { ...state.inventory, stone: state.inventory.stone + 1 }, storedStone: state.storedStone - 1 }, message: 'Took a stone from the pile.' };
  }
  if (action.type === 'dropStone') {
    if (state.inventory.stone < 1) return { state, message: 'You have no stone to set down.' };
    const { x, y } = state.player;
    const nearby = state.stonePiles.find(pile => Math.hypot(pile.x - x, pile.y - y) <= BALANCE.pileMergeRadius);
    const stonePiles = nearby
      ? state.stonePiles.map(pile => pile === nearby ? { ...pile, count: pile.count + 1 } : pile)
      : [...state.stonePiles, { id: `pile-${state.day}-${Math.round(x * 10)}-${Math.round(y * 10)}`, x, y, count: 1 }];
    return { state: { ...state, inventory: { ...state.inventory, stone: state.inventory.stone - 1 }, stonePiles }, message: 'Set down one stone.' };
  }
  if (action.type === 'pickUpStone') {
    const pile = state.stonePiles.find(item => item.id === action.pileId);
    if (!pile || !near(state.player.x, state.player.y, pile.x, pile.y)) return { state, message: 'Move closer to the stones.' };
    if (freeSpaces(state) < spaceFor('stone')) return { state, message: FULL_BAG_MESSAGE };
    const stonePiles = state.stonePiles
      .map(item => item === pile ? { ...item, count: item.count - 1 } : item)
      .filter(item => item.count > 0);
    return {
      state: advanceTime({ ...state, inventory: { ...state.inventory, stone: state.inventory.stone + 1 }, stonePiles }, BALANCE.pickUpSeconds, 'resting'),
      message: 'Picked up a stone.'
    };
  }
  if (action.type === 'burnFiber') {
    if (!isAtCamp(state)) return { state, message: 'Return to the marked camp area to tend the fire.' };
    if (state.inventory.fiber < 1) return { state, message: 'You have no fiber to burn.' };
    return {
      state: { ...state, inventory: { ...state.inventory, fiber: state.inventory.fiber - 1 }, fireFuel: state.fireFuel + BALANCE.fiberFireSeconds },
      message: 'The kindling flares up.'
    };
  }
  if (action.type === 'eat') {
    if (state.inventory.food <= 0) return { state, message: 'No food in your bag.' };
    return {
      state: {
        ...state,
        inventory: { ...state.inventory, food: state.inventory.food - 1 },
        player: { ...state.player, hunger: Math.min(100, state.player.hunger + BALANCE.eatHungerGain) }
      },
      message: 'Ate some berries.'
    };
  }
  if (action.type === 'eatTrailFood') {
    if (state.inventory.trailFood <= 0) return { state, message: 'No trail rations in your bag.' };
    return {
      state: { ...state,
        inventory: { ...state.inventory, trailFood: state.inventory.trailFood - 1 },
        player: { ...state.player, hunger: Math.min(100, state.player.hunger + BALANCE.trailFoodHungerGain) }
      },
      message: 'Ate a trail ration.'
    };
  }
  if (action.type === 'prepareTrailFood') {
    const blocker = trailFoodBlocker(state);
    if (blocker) return { state, message: blocker };
    return {
      state: advanceTime({ ...state,
        inventory: { ...state.inventory, food: state.inventory.food - 1, trailFood: state.inventory.trailFood + 1 },
        player: { ...state.player, energy: Math.max(0, state.player.energy - BALANCE.gatherEnergyCost) }
      }, BALANCE.trailFoodSeconds, 'working'),
      message: 'Dried a berry into one trail ration.'
    };
  }
  if (action.type === 'cook') {
    const blocker = cookBlocker(state);
    if (blocker) return { state, message: blocker };
    const cooked = advanceTime({ ...state, inventory: { ...state.inventory, food: state.inventory.food - 1 } }, BALANCE.cookSeconds, 'resting');
    return {
      state: { ...cooked, player: { ...cooked.player,
        hunger: Math.min(100, cooked.player.hunger + (state.structures.dryingRack ? BALANCE.rackCookHungerGain : BALANCE.cookHungerGain)),
        warmth: Math.min(100, cooked.player.warmth + BALANCE.cookWarmthGain)
      } },
      message: 'You toast a berry by the fire. A warm little meal.'
    };
  }
  if (action.type === 'stargaze') {
    const blocker = stargazeBlocker(state);
    if (blocker) return { state, message: blocker };
    const restored = { ...state, player: { ...state.player, energy: Math.min(100, state.player.energy + BALANCE.stargazeEnergyGain) } };
    const watched = advanceTime(restored, BALANCE.stargazeSeconds, 'resting');
    const thoughts = [
      'The stars shine between the trees.',
      'A quiet patch of sky opens above camp.',
      'The moon makes the clearing look silver.'
    ];
    return {
      state: watched,
      message: `${thoughts[(state.day - 1) % thoughts.length]} You feel a little rested.`
    };
  }
  if (action.type === 'stokeFire') {
    if (!isAtCamp(state)) return { state, message: 'Return to the marked camp area to tend the fire.' };
    if (state.inventory.wood < 1) return { state, message: 'You need wood for the fire.' };
    return {
      state: { ...state, inventory: { ...state.inventory, wood: state.inventory.wood - 1 }, fireFuel: state.fireFuel + (state.structures.hearth ? BALANCE.hearthFireSecondsPerWood : BALANCE.fireSecondsPerWood) },
      message: 'The fire burns brighter.'
    };
  }
  if (action.type === 'repairLookout') {
    const blocker = lookoutRepairBlocker(state);
    if (blocker) return { state, message: blocker };
    const { wood, fiber, stone } = LOOKOUT.cost;
    const paid = spendStone(state, stone);
    return {
      state: advanceTime({
        ...paid,
        inventory: { ...paid.inventory, wood: state.inventory.wood - wood, fiber: state.inventory.fiber - fiber },
        player: { ...state.player, energy: Math.max(0, state.player.energy - BALANCE.buildEnergyCost) },
        progress: { ...state.progress, lookoutRepaired: true }
      }, BALANCE.buildSeconds, 'working'),
      message: 'The lookout stands again. From here, the camp feels like home.'
    };
  }
  if (action.type === 'build') {
    if (!isAtCamp(state)) return { state, message: 'Return to the marked camp area to build.' };
    const definition = BUILDINGS[action.structureId];
    if (!definition) return { state, message: 'That structure is unavailable.' };
    if (definition.prerequisite === 'coldNight' && !state.progress.hearthUnlocked) return { state, message: 'Weather the cold night to unlock the hearth.' };
    if (state.structures[action.structureId]) return { state, message: 'Already built.' };
    if (definition.prerequisite === 'shelter' && !state.structures.shelter) return { state, message: 'Build a shelter first.' };
    const cost = definition.cost;
    const stoneCost = 'stone' in cost ? cost.stone : 0;
    if (state.inventory.wood < cost.wood || state.inventory.fiber < cost.fiber || availableStone(state) < stoneCost) {
      const needed = [state.inventory.wood < cost.wood ? `${cost.wood} wood` : null,
        state.inventory.fiber < cost.fiber ? `${cost.fiber} fiber` : null,
        availableStone(state) < stoneCost ? `${stoneCost} stone` : null].filter(Boolean).join(' and ');
      return { state, message: `Need ${needed} to build this.` };
    }
    const paid = spendStone(state, stoneCost);
    return {
      state: advanceTime({
        ...paid,
        inventory: { ...paid.inventory, wood: state.inventory.wood - cost.wood, fiber: state.inventory.fiber - cost.fiber },
        player: { ...state.player, energy: Math.max(0, state.player.energy - BALANCE.buildEnergyCost) },
        structures: { ...state.structures, [action.structureId]: true }
      }, BALANCE.buildSeconds, 'working'),
      message: `Built the ${definition.name.toLowerCase()}.`
    };
  }
  if (action.type === 'rest') {
    if (!isAtCamp(state)) return { state, message: 'Return to the marked camp area to rest.' };
    const rested = advanceTime(state, BALANCE.restSeconds, 'resting');
    return {
      state: { ...rested, player: { ...rested.player, energy: Math.min(100, rested.player.energy + (rested.structures.bed ? BALANCE.bedRestEnergyGain : BALANCE.restEnergyGain)) } },
      message: 'You take a short rest.'
    };
  }
  if (action.type === 'sleep') {
    const blocked = sleepBlocker(state);
    if (blocked) return { state, message: blocked };
    const energy = state.structures.bed ? 100 : Math.min(100, state.player.energy + BALANCE.sleepEnergyGain);
    const slept = advanceTime({ ...state, player: { ...state.player, energy } }, BALANCE.daySeconds - state.timeOfDay, 'resting');
    const fireDied = state.fireFuel > 0 && slept.fireFuel <= 0;
    return {
      state: slept,
      message: fireDied ? 'You sleep until morning. The fire burned out in the night.' : 'You sleep until morning.'
    };
  }
  return { state, message: 'That action is not available yet.' };
}

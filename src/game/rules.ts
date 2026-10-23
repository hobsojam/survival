import { BALANCE, BUILDINGS, LOOKOUT, SITES, type GameState, type SiteId, type StructureId } from './state';

export type GameAction =
  | { type: 'gather'; nodeId: string }
  | { type: 'chopTree'; treeId: string }
  | { type: 'visitSite'; siteId: SiteId }
  | { type: 'drop'; resource: keyof GameState['inventory'] }
  | { type: 'build'; structureId: StructureId }
  | { type: 'move'; dx: number; dy: number }
  | { type: 'eat' | 'stokeFire' | 'rest' | 'sleep' | 'cook' | 'stargaze' | 'repairLookout' | 'craftAxe' };

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

export function lookoutRepairBlocker(state: GameState): string | null {
  if (state.progress.lookoutRepaired) return 'The lookout is already restored.';
  if (!state.progress.hearthUnlocked) return 'Weather the cold front before repairing the lookout.';
  if (!near(state.player.x, state.player.y, LOOKOUT.x, LOOKOUT.y)) return 'Stand beside the lookout to repair it.';
  const { wood, fiber, stone } = LOOKOUT.cost;
  if (state.inventory.wood < wood || state.inventory.fiber < fiber || state.inventory.stone < stone) {
    const needed = [state.inventory.wood < wood ? `${wood} wood` : null,
      state.inventory.fiber < fiber ? `${fiber} fiber` : null,
      state.inventory.stone < stone ? `${stone} stone` : null].filter(Boolean).join(' and ');
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
  const affordable = state.inventory.wood >= cost.wood && state.inventory.fiber >= cost.fiber && state.inventory.stone >= stoneCost;
  return affordable && isAtCamp(state) ? 'ready' : 'unavailable';
}

export function advanceTime(state: GameState, seconds: number, activity: Activity = 'awake'): GameState {
  if (!Number.isFinite(seconds) || seconds <= 0) return state;
  let next: GameState = {
    ...state,
    player: { ...state.player },
    progress: { ...state.progress },
    trees: state.trees.map(tree => ({ ...tree }))
  };
  let remaining = seconds;
  while (remaining > 0.000001) {
    const step = Math.min(remaining, 1, BALANCE.daySeconds - next.timeOfDay);
    const night = next.timeOfDay >= BALANCE.nightStart;
    const camp = isAtCamp(next);
    const lit = next.fireFuel > 0;
    const coldNight = isColdNight(next);
    next.player.hunger = Math.max(0, next.player.hunger - step / 8);
    if (activity === 'awake') next.player.energy = Math.max(0, next.player.energy - step * BALANCE.energyDrainPerSecond);
    let warmthChange = step / 10;
    if (night && camp && lit) {
      warmthChange = step / 2;
    } else if (night && coldNight) {
      const lossPerSecond = camp && next.structures.shelter
        ? BALANCE.coldNightShelteredWarmthLossPerSecond
        : BALANCE.coldNightOutdoorWarmthLossPerSecond;
      warmthChange = -step * lossPerSecond;
    } else if (night && camp && next.structures.shelter) {
      warmthChange = -step / 4;
    } else if (night) {
      warmthChange = -step / 2;
    }
    if (night && camp && !lit && next.structures.windbreak && warmthChange < 0) warmthChange *= 0.5;
    next.player.warmth = Math.max(0, Math.min(100, next.player.warmth + warmthChange));
    next.fireFuel = Math.max(0, next.fireFuel - step * (coldNight ? BALANCE.coldNightFireBurn : 1));
    next.timeOfDay += step;
    remaining -= step;
    if (next.timeOfDay >= BALANCE.daySeconds - 0.000001) {
      const stormEnded = next.progress.nextStormDay === next.day;
      const weathered = stormEnded && camp && next.structures.shelter && next.fireFuel > 0 && next.player.warmth > 20;
      next.day += 1;
      next.timeOfDay = 0;
      next.nodes = next.nodes.map(node => node.readyDay <= next.day ? { ...node, amount: 1 } : node);
      if (stormEnded) {
        next.progress = weathered
          ? { ...next.progress, nextStormDay: null, hearthUnlocked: true }
          : { ...next.progress, nextStormDay: next.day + BALANCE.coldNightRetryDays - 1, hearthUnlocked: false };
        if (!weathered) {
          next.player.energy = Math.min(next.player.energy, BALANCE.coldNightFailureEnergy);
          next.timeOfDay = BALANCE.coldNightFailureMorningLoss;
        }
      }
    }
  }
  return next;
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
    const capacity = state.structures.crate ? BALANCE.crateCapacity : BALANCE.baseCapacity;
    if (state.inventory.wood + state.inventory.food + state.inventory.fiber + state.inventory.stone >= capacity) {
      return { state, message: 'Your bag is full. Drop an item to make room.' };
    }
    let resource: keyof GameState['inventory'] = 'wood';
    if (node.kind === 'berry') resource = 'food';
    else if (node.kind === 'fiber') resource = 'fiber';
    else if (node.kind === 'stone') resource = 'stone';
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
    if (state.inventory.wood < 1 || state.inventory.fiber < 1 || state.inventory.stone < 1)
      return { state, message: 'Need 1 wood, 1 fiber, and 1 stone for the axe.' };
    return {
      state: advanceTime({
        ...state,
        inventory: { ...state.inventory, wood: state.inventory.wood - 1, fiber: state.inventory.fiber - 1, stone: state.inventory.stone - 1 },
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
    const capacity = state.structures.crate ? BALANCE.crateCapacity : BALANCE.baseCapacity;
    const carried = state.inventory.wood + state.inventory.food + state.inventory.fiber + state.inventory.stone;
    if (carried + 2 > capacity) return { state, message: 'Your bag needs two free spaces for wood.' };
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
    const capacity = state.structures.crate ? BALANCE.crateCapacity : BALANCE.baseCapacity;
    const carried = state.inventory.wood + state.inventory.food + state.inventory.fiber + state.inventory.stone;
    if (carried + 2 > capacity) return { state, message: 'Your bag needs two free spaces for this find.' };
    const resource = action.siteId === 'basket' ? 'food' : 'stone';
    const found = advanceTime({
      ...state,
      player: { ...state.player, energy: Math.max(0, state.player.energy - BALANCE.gatherEnergyCost) },
      inventory: { ...state.inventory, [resource]: state.inventory[resource] + 2 },
      progress: { ...state.progress, discoveries: { ...state.progress.discoveries, [action.siteId]: true } }
    }, BALANCE.gatherSeconds, 'working');
    return { state: found, message: action.siteId === 'basket' ? 'An old basket holds two berries.' : 'You find two useful stones tucked in the cairn.' };
  }
  if (action.type === 'drop') {
    const amount = state.inventory[action.resource];
    if (!amount) return { state, message: `No ${action.resource} to drop.` };
    const item = action.resource === 'food' ? 'berry' : action.resource;
    return {
      state: { ...state, inventory: { ...state.inventory, [action.resource]: amount - 1 } },
      message: `Dropped one ${item}.`
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
    return {
      state: advanceTime({
        ...state,
        inventory: { ...state.inventory, wood: state.inventory.wood - wood, fiber: state.inventory.fiber - fiber, stone: state.inventory.stone - stone },
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
    if (state.inventory.wood < cost.wood || state.inventory.fiber < cost.fiber || state.inventory.stone < stoneCost) {
      const needed = [state.inventory.wood < cost.wood ? `${cost.wood} wood` : null,
        state.inventory.fiber < cost.fiber ? `${cost.fiber} fiber` : null,
        state.inventory.stone < stoneCost ? `${stoneCost} stone` : null].filter(Boolean).join(' and ');
      return { state, message: `Need ${needed} to build this.` };
    }
    return {
      state: advanceTime({
        ...state,
        inventory: { ...state.inventory, wood: state.inventory.wood - cost.wood, fiber: state.inventory.fiber - cost.fiber, stone: state.inventory.stone - stoneCost },
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

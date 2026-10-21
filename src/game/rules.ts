import { BALANCE, type GameState, type StructureId } from './state';

export type GameAction =
  | { type: 'gather'; nodeId: string }
  | { type: 'build'; structureId: StructureId }
  | { type: 'move'; dx: number; dy: number }
  | { type: 'eat' | 'stokeFire' | 'rest' | 'sleep' };

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

export function advanceTime(state: GameState, seconds: number, activity: Activity = 'awake'): GameState {
  if (!Number.isFinite(seconds) || seconds <= 0) return state;
  let next: GameState = {
    ...state,
    player: { ...state.player },
    progress: { ...state.progress },
    nodes: state.nodes.map(node => ({ ...node }))
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
    const warmthChange = night
      ? camp && lit ? step / 2
        : coldNight ? -step * (camp && next.structures.shelter
          ? BALANCE.coldNightShelteredWarmthLossPerSecond
          : BALANCE.coldNightOutdoorWarmthLossPerSecond)
          : camp && next.structures.shelter ? -step / 4 : -step / 2
      : step / 10;
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
          ? { nextStormDay: null, hearthUnlocked: true }
          : { nextStormDay: next.day + BALANCE.coldNightRetryDays - 1, hearthUnlocked: false };
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
    if (state.inventory.wood + state.inventory.food >= capacity) {
      return { state, message: 'Your bag is full. Return to camp.' };
    }
    const resource = node.kind === 'branch' ? 'wood' : 'food';
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
      message: resource === 'wood' ? 'Collected wood.' : 'Picked berries.'
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
  if (action.type === 'stokeFire') {
    if (!isAtCamp(state)) return { state, message: 'Return to the marked camp area to tend the fire.' };
    if (state.inventory.wood < 1) return { state, message: 'You need wood for the fire.' };
    return {
      state: { ...state, inventory: { ...state.inventory, wood: state.inventory.wood - 1 }, fireFuel: state.fireFuel + (state.structures.hearth ? BALANCE.hearthFireSecondsPerWood : BALANCE.fireSecondsPerWood) },
      message: 'The fire burns brighter.'
    };
  }
  if (action.type === 'build') {
    if (!isAtCamp(state)) return { state, message: 'Return to the marked camp area to build.' };
    if (action.structureId === 'hearth' && !state.progress.hearthUnlocked) return { state, message: 'Weather the cold night to unlock the hearth.' };
    if (state.structures[action.structureId]) return { state, message: 'Already built.' };
    if (action.structureId === 'bed' && !state.structures.shelter) return { state, message: 'Build a shelter first.' };
    const cost = BALANCE.buildCosts[action.structureId];
    if (state.inventory.wood < cost) return { state, message: `Need ${cost} wood to build this.` };
    return {
      state: advanceTime({
        ...state,
        inventory: { ...state.inventory, wood: state.inventory.wood - cost },
        player: { ...state.player, energy: Math.max(0, state.player.energy - BALANCE.buildEnergyCost) },
        structures: { ...state.structures, [action.structureId]: true }
      }, BALANCE.buildSeconds, 'working'),
      message: `Built the ${action.structureId}.`
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

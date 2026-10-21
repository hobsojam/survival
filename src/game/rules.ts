import { BALANCE, type GameState, type StructureId } from './state';

export type GameAction =
  | { type: 'gather'; nodeId: string }
  | { type: 'build'; structureId: StructureId }
  | { type: 'move'; dx: number; dy: number }
  | { type: 'eat' | 'stokeFire' | 'rest' };

export interface ActionResult {
  state: GameState;
  message: string;
}

function near(x1: number, y1: number, x2: number, y2: number): boolean {
  return Math.hypot(x1 - x2, y1 - y2) <= BALANCE.interactionRadius;
}

export function applyAction(state: GameState, action: GameAction): ActionResult {
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
      state: {
        ...state,
        player: { ...state.player, energy: Math.max(0, state.player.energy - BALANCE.gatherEnergyCost) },
        inventory: { ...state.inventory, [resource]: state.inventory[resource] + 1 },
        nodes
      },
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
  return { state, message: 'That action is not available yet.' };
}

import { isInClearing } from './camp';
import { TOO_TIRED_MESSAGE, isExhausted } from './needs';
import { BALANCE, BUILDINGS, type GameState, type ResourceNode, type TreeNode } from './state';

// The camp clearing starts as the ring round the fire and widens one side at a time. Each side has a near and a far step;
// every step names the trees that stand in its way and the building the cleared ground makes room for.

export type Side = 'north' | 'east' | 'south' | 'west';
export type StepId = `${Side}-${'near' | 'far'}`;

export const STEP_IDS: readonly StepId[] = [
  'north-near', 'north-far', 'east-near', 'east-far', 'south-near', 'south-far', 'west-near', 'west-far'
];

export interface ClearingStep {
  side: Side;
  /** How far the clearing reaches from the fire, due along this side, once the step is done. */
  reach: number;
  cost: { wood: number; fiber: number; stone: number };
  /** The trees to fell, in tile coordinates. */
  trees: readonly { x: number; y: number; sprite: 'treeBroadleaf' | 'treePine' }[];
  /** The buildings this step makes room for. */
  room: readonly string[];
}

export interface ClearingState {
  cleared: StepId[];
  /** The step whose trees are marked for felling, if any. */
  marked: StepId | null;
  /** Indexes into the marked step's trees that are already down. */
  felled: number[];
}

const NEAR_COST = { wood: 4, fiber: 2, stone: 0 };
const FAR_COST = { wood: 6, fiber: 3, stone: 0 };
const NEAR_REACH = 6.5;

export const CLEARING_STEPS: Record<StepId, ClearingStep> = {
  'north-near': {
    side: 'north', reach: NEAR_REACH, cost: NEAR_COST, room: ['larder'],
    trees: [
      { x: 22, y: 10.25, sprite: 'treeBroadleaf' }, { x: 16, y: 9.75, sprite: 'treePine' },
      { x: 19.25, y: 10, sprite: 'treeBroadleaf' }, { x: 18.5, y: 8.75, sprite: 'treePine' }
    ]
  },
  'north-far': {
    side: 'north', reach: 8, cost: FAR_COST, room: ['house'],
    trees: [
      { x: 22.75, y: 8.25, sprite: 'treeBroadleaf' }, { x: 18.75, y: 7.5, sprite: 'treePine' },
      { x: 13.75, y: 9.75, sprite: 'treeBroadleaf' }, { x: 15, y: 8.75, sprite: 'treePine' },
      { x: 17.5, y: 7.25, sprite: 'treeBroadleaf' }, { x: 21.25, y: 6.75, sprite: 'treePine' }
    ]
  },
  'east-near': {
    side: 'east', reach: NEAR_REACH, cost: NEAR_COST, room: ['woodpile', 'fibreStack'],
    trees: [
      { x: 26, y: 13.75, sprite: 'treeBroadleaf' }, { x: 25, y: 15.75, sprite: 'treePine' },
      { x: 24.25, y: 13.25, sprite: 'treeBroadleaf' }, { x: 26.5, y: 15.25, sprite: 'treePine' }
    ]
  },
  'east-far': {
    side: 'east', reach: 9, cost: FAR_COST, room: ['workshop'],
    trees: [
      { x: 29.25, y: 15, sprite: 'treeBroadleaf' }, { x: 27.25, y: 17.25, sprite: 'treePine' },
      { x: 28.5, y: 16.5, sprite: 'treeBroadleaf' }, { x: 28.5, y: 11.75, sprite: 'treePine' },
      { x: 27.5, y: 13.5, sprite: 'treeBroadleaf' }, { x: 29, y: 13, sprite: 'treePine' }
    ]
  },
  'south-near': {
    side: 'south', reach: NEAR_REACH, cost: NEAR_COST, room: [],
    trees: [
      { x: 22, y: 19.25, sprite: 'treeBroadleaf' }, { x: 20.5, y: 19.5, sprite: 'treePine' },
      { x: 15.25, y: 19.75, sprite: 'treeBroadleaf' }, { x: 19.5, y: 20.5, sprite: 'treePine' }
    ]
  },
  'south-far': {
    side: 'south', reach: 8, cost: FAR_COST, room: [],
    trees: [
      { x: 24.75, y: 20.5, sprite: 'treeBroadleaf' }, { x: 24.25, y: 22.25, sprite: 'treePine' },
      { x: 18.25, y: 22.5, sprite: 'treeBroadleaf' }, { x: 16.5, y: 22.5, sprite: 'treePine' },
      { x: 13.75, y: 20.25, sprite: 'treeBroadleaf' }, { x: 20, y: 22.75, sprite: 'treePine' }
    ]
  },
  'west-near': {
    side: 'west', reach: NEAR_REACH, cost: NEAR_COST, room: ['vegetableBeds'],
    trees: [
      // Only two fit: the west path and the diagonals leave this wedge narrow.
      { x: 14.75, y: 13.5, sprite: 'treeBroadleaf' }, { x: 13.5, y: 13, sprite: 'treePine' }
    ]
  },
  'west-far': {
    side: 'west', reach: 9, cost: FAR_COST, room: ['well'],
    trees: [
      { x: 12.5, y: 12.25, sprite: 'treeBroadleaf' }, { x: 12.5, y: 16.5, sprite: 'treePine' },
      { x: 10.75, y: 16.5, sprite: 'treeBroadleaf' }, { x: 11.75, y: 13.5, sprite: 'treePine' },
      { x: 11.25, y: 12.25, sprite: 'treeBroadleaf' }, { x: 11.25, y: 17.75, sprite: 'treePine' }
    ]
  }
};

/** Degrees either side of a side boundary where the clearing's edge blends between the two sides. */
const BLEND_DEGREES = 20;
/** Side boundaries, in degrees from the fire with y pointing down: east spans the middle 60 degrees, west the opposite 60. */
const BOUNDARIES = [-150, -30, 30, 150] as const;

function degreesFromFire(x: number, y: number): number {
  return Math.atan2(y - BALANCE.campY, x - BALANCE.campX) * 180 / Math.PI;
}

function sideAtDegrees(angle: number): Side {
  if (Math.abs(angle) < 30) return 'east';
  if (Math.abs(angle) >= 150) return 'west';
  return angle < 0 ? 'north' : 'south';
}

export function sideAt(x: number, y: number): Side {
  return sideAtDegrees(degreesFromFire(x, y));
}

function sideReach(side: Side, cleared: readonly StepId[]): number {
  if (cleared.includes(`${side}-far`)) return CLEARING_STEPS[`${side}-far`].reach;
  if (cleared.includes(`${side}-near`)) return CLEARING_STEPS[`${side}-near`].reach;
  return BALANCE.campRadius;
}

/** The clearing's radius in the direction of (x, y) from the fire. */
export function clearingReach(x: number, y: number, cleared: readonly StepId[]): number {
  const angle = degreesFromFire(x, y);
  const boundary = BOUNDARIES.reduce((nearest, b) => (Math.abs(angle - b) < Math.abs(angle - nearest) ? b : nearest));
  const away = Math.abs(angle - boundary);
  const own = sideReach(sideAtDegrees(angle), cleared);
  if (away >= BLEND_DEGREES) return own;
  // Just across the boundary lies the other side; step off it by a hair to find which that is.
  const otherAngle = angle + (angle >= boundary ? -1 : 1) * (away + 0.001);
  const other = sideReach(sideAtDegrees(otherAngle), cleared);
  return own + (other - own) * 0.5 * (1 - away / BLEND_DEGREES);
}

export function inClearing(x: number, y: number, cleared: readonly StepId[]): boolean {
  return Math.hypot(x - BALANCE.campX, y - BALANCE.campY) <= clearingReach(x, y, cleared);
}

/** A stable label for a set of cleared steps, for caching the ground drawn from it. */
export function clearingKey(cleared: readonly StepId[]): string {
  const done = STEP_IDS.filter(id => cleared.includes(id));
  return done.length === 0 ? 'none' : done.join('+');
}

/** The trees of the marked step, as choppable trees; felled ones never regrow. */
export function markedTrees(state: GameState): TreeNode[] {
  const { marked, felled } = state.clearing;
  if (!marked) return [];
  return CLEARING_STEPS[marked].trees.map((tree, index) => ({
    id: `mark-${marked}-${index}`,
    x: tree.x,
    y: tree.y,
    sprite: tree.sprite,
    readyDay: felled.includes(index) ? Number.MAX_SAFE_INTEGER : 1
  }));
}

/** Whether a tree is the stump of a marked tree already felled, which stays until its ground is cleared. */
export function isClearingStump(tree: TreeNode): boolean {
  return tree.readyDay === Number.MAX_SAFE_INTEGER;
}

/** Every tree the axe can fell: the wild ones and those marked for clearing. */
export function choppableTrees(state: GameState): TreeNode[] {
  return [...state.trees, ...markedTrees(state)];
}

/** Why a step cannot be marked for felling right now, or null when it can. */
export function markBlocker(state: GameState, step: StepId): string | null {
  if (!state.progress.axeCrafted) return 'Craft a stone axe to clear land.';
  if (!isInClearing(state)) return 'Return to camp to clear land.';
  const { side } = CLEARING_STEPS[step];
  if (step.endsWith('-far') && !state.clearing.cleared.includes(`${side}-near`)) return 'Clear the near ground on that side first.';
  if (state.clearing.cleared.includes(step)) return 'That ground is already clear.';
  const { marked, felled } = state.clearing;
  if (marked && marked !== step && felled.length > 0) return `Finish clearing the ${CLEARING_STEPS[marked].side} side first.`;
  return null;
}

/** The side's next step to clear, or null once the whole side is clear. */
export function nextStep(state: GameState, side: Side): StepId | null {
  return STEP_IDS.find(id => CLEARING_STEPS[id].side === side && !state.clearing.cleared.includes(id)) ?? null;
}

/** Why the marked ground cannot be cleared yet, or null when it can. */
export function clearGroundBlocker(state: GameState): string | null {
  const { marked, felled } = state.clearing;
  if (!marked) return 'Choose a side to clear first.';
  const left = CLEARING_STEPS[marked].trees.length - felled.length;
  if (left > 0) return `Fell the ${left} marked ${left === 1 ? 'tree' : 'trees'} left first.`;
  if (!isInClearing(state)) return 'Return to camp to clear land.';
  if (isExhausted(state)) return TOO_TIRED_MESSAGE;
  const { wood, fiber } = CLEARING_STEPS[marked].cost;
  if (state.inventory.wood < wood || state.inventory.fiber < fiber) return `Need ${wood} wood and ${fiber} fiber to clear this.`;
  return null;
}

/** How far past the clearing's edge a branch pile is set down. */
const BRANCH_MARGIN = 1.5;

/**
 * Takes the starting nodes and sets every branch pile that now lies inside the clearing just beyond its edge,
 * along the line from the fire, on an outside tile that no other node holds. If eight tries find no free tile it takes
 * the last outside tile, and if none was outside it stays put; neither happens for any valid set of cleared steps.
 */
export function placeBranches(nodes: readonly ResourceNode[], cleared: readonly StepId[]): ResourceNode[] {
  const taken = new Set(nodes.filter(node => node.kind !== 'branch' || !inClearing(node.x, node.y, cleared)).map(node => `${node.x},${node.y}`));
  return nodes.map(node => {
    if (node.kind !== 'branch' || !inClearing(node.x, node.y, cleared)) return node;
    const angle = Math.atan2(node.y - BALANCE.campY, node.x - BALANCE.campX);
    let distance = clearingReach(node.x, node.y, cleared) + BRANCH_MARGIN;
    let outside: { x: number; y: number } | null = null;
    for (let attempt = 0; attempt < 8; attempt++, distance += 1) {
      const x = Math.max(0, Math.min(BALANCE.mapWidth - 1, Math.round(BALANCE.campX + Math.cos(angle) * distance)));
      const y = Math.max(0, Math.min(BALANCE.mapHeight - 1, Math.round(BALANCE.campY + Math.sin(angle) * distance)));
      if (inClearing(x, y, cleared)) continue;
      outside = { x, y };
      if (taken.has(`${x},${y}`)) continue;
      taken.add(`${x},${y}`);
      return { ...node, x, y };
    }
    if (!outside) return node; // only if every try fell inside the clearing; no valid set of steps does
    taken.add(`${outside.x},${outside.y}`);
    return { ...node, ...outside };
  });
}

/** A building's name as it reads in a sentence: its own name, or the id split into lower-case words. */
function buildingName(id: string): string {
  if (Object.hasOwn(BUILDINGS, id)) return BUILDINGS[id as keyof typeof BUILDINGS].name.toLowerCase();
  return id.replace(/([A-Z])/g, ' $1').toLowerCase();
}

/** The sentence about what a cleared step makes room for, leading space included, or nothing if it is built or has none. */
export function roomLine(step: StepId, structures: Partial<Record<string, boolean>>, known: (id: string) => boolean): string {
  const open = CLEARING_STEPS[step].room.filter(id => known(id) && !structures[id]);
  if (open.length === 0) return '';
  return ` There's room for ${open.map(id => `a ${buildingName(id)}`).join(' and ')} now.`;
}

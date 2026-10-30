import { BALANCE } from './state';

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
      { x: 22, y: 10.25, sprite: 'treeBroadleaf' }, { x: 16.5, y: 9.25, sprite: 'treePine' },
      { x: 19.25, y: 10, sprite: 'treeBroadleaf' }, { x: 18.5, y: 8.75, sprite: 'treePine' }
    ]
  },
  'north-far': {
    side: 'north', reach: 8, cost: FAR_COST, room: ['house'],
    trees: [
      { x: 22.75, y: 8.25, sprite: 'treeBroadleaf' }, { x: 19.5, y: 7.5, sprite: 'treePine' },
      { x: 13.75, y: 9.75, sprite: 'treeBroadleaf' }, { x: 15, y: 8.75, sprite: 'treePine' },
      { x: 17.5, y: 7.25, sprite: 'treeBroadleaf' }, { x: 21, y: 6.75, sprite: 'treePine' }
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
      { x: 14.5, y: 13.75, sprite: 'treeBroadleaf' }, { x: 13.5, y: 14.5, sprite: 'treePine' },
      { x: 15.5, y: 15.25, sprite: 'treeBroadleaf' }, { x: 13.5, y: 13, sprite: 'treePine' }
    ]
  },
  'west-far': {
    side: 'west', reach: 9, cost: FAR_COST, room: ['well'],
    trees: [
      { x: 12.5, y: 12.25, sprite: 'treeBroadleaf' }, { x: 12.5, y: 16.5, sprite: 'treePine' },
      { x: 10.75, y: 16, sprite: 'treeBroadleaf' }, { x: 11.75, y: 13.5, sprite: 'treePine' },
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

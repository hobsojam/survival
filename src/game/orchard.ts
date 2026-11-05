import type { GameState } from './state';

// Apple trees the survivor grows from saved pips, on a plot of their own north of the west path.

export interface OrchardTree {
  plantedDay: number;
  /** The first day this tree has apples to pick, once it bears at all. */
  ripeDay: number;
}

export interface OrchardState {
  pips: number;
  /** One slot for each of the orchard's spots. */
  trees: (OrchardTree | null)[];
}

/** Two rows of three, in tiles. */
export const ORCHARD_SPOTS: readonly { x: number; y: number }[] = [
  { x: 3, y: 10 }, { x: 5, y: 10 }, { x: 7, y: 10 },
  { x: 3, y: 13 }, { x: 5, y: 13 }, { x: 7, y: 13 }
];

export const emptyOrchard = (): OrchardState => ({ pips: 0, trees: ORCHARD_SPOTS.map(() => null) });

export const treesPlanted = (state: GameState): number => state.orchard.trees.filter(tree => tree !== null).length;

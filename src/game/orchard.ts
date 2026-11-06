import { season, yearOf, type Season } from './calendar';
import { freeSpaces } from './camp';
import type { GameAction } from './rules';
import { BALANCE, type GameState } from './state';

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

export const autumnsPassed = (plantedDay: number, day: number): number => yearOf(day) - yearOf(plantedDay);

export type TreeStage = 'sprout' | 'sapling' | 'young' | 'grown';
const STAGES: readonly TreeStage[] = ['sprout', 'sapling', 'young', 'grown'];

export const treeStage = (tree: OrchardTree, day: number): TreeStage => STAGES[Math.min(autumnsPassed(tree.plantedDay, day), STAGES.length - 1)];

export const treeBears = (tree: OrchardTree, day: number): boolean => treeStage(tree, day) === 'grown' && season(day) === 'autumn';

export const treeRipe = (tree: OrchardTree, day: number): boolean => treeBears(tree, day) && tree.ripeDay <= day;

const reachable = (state: GameState, spot: number): boolean => state.area === 'camp'
  && Math.hypot(state.player.x - ORCHARD_SPOTS[spot].x, state.player.y - ORCHARD_SPOTS[spot].y) <= BALANCE.interactionRadius;

/** The closest spot within reach, once the orchard stands. */
export function nearestSpot(state: GameState): number | null {
  if (!state.structures.orchard) return null;
  const inReach = ORCHARD_SPOTS.map((_, spot) => spot).filter(spot => reachable(state, spot));
  const away = (spot: number): number => Math.hypot(state.player.x - ORCHARD_SPOTS[spot].x, state.player.y - ORCHARD_SPOTS[spot].y);
  return inReach.sort((a, b) => away(a) - away(b))[0] ?? null;
}

const realSpot = (spot: number): boolean => Number.isInteger(spot) && spot >= 0 && spot < ORCHARD_SPOTS.length;

export function plantBlocker(state: GameState, spot: number): string | null {
  if (!realSpot(spot)) return "That spot isn't there.";
  if (!state.structures.orchard) return 'Build the orchard first.';
  if (!reachable(state, spot)) return 'Stand beside the spot.';
  if (state.orchard.trees[spot]) return 'Something is already growing here.';
  if (season(state.day) === 'winter') return 'The ground is frozen hard.';
  return state.orchard.pips > 0 ? null : 'You have no pips to plant.';
}

export function pickTreeBlocker(state: GameState, spot: number): string | null {
  if (!realSpot(spot)) return "That spot isn't there.";
  const tree = state.orchard.trees[spot];
  if (!tree || !reachable(state, spot)) return 'Stand beside the tree.';
  if (treeStage(tree, state.day) !== 'grown') return 'This tree is too young for apples.';
  if (!treeBears(tree, state.day)) return 'The tree bears apples in autumn.';
  if (!treeRipe(tree, state.day)) return 'The tree has no ripe apples yet.';
  return freeSpaces(state) < 1 ? 'Make room in your bag for an apple.' : null;
}

/** What a tap or E does at a spot that has something to offer: plant it or pick it. */
export function spotAction(state: GameState, spot: number): GameAction | null {
  const tree = state.orchard.trees[spot];
  if (tree) return treeRipe(tree, state.day) ? { type: 'pickOrchardApple', spot } : null;
  return plantBlocker({ ...state, player: { ...state.player, x: ORCHARD_SPOTS[spot].x, y: ORCHARD_SPOTS[spot].y }, area: 'camp' }, spot) ? null : { type: 'plantPip', spot };
}

/** An apple eaten or cooked leaves its pips, as many as there are spots still to fill. The first ever says so. */
export function savePips(state: GameState, apples: number): { state: GameState; note: string } {
  const planted = treesPlanted(state);
  const kept = Math.min(apples, ORCHARD_SPOTS.length - state.orchard.pips - planted);
  if (kept <= 0) return { state, note: '' };
  const first = state.orchard.pips + planted === 0;
  return { state: { ...state, orchard: { ...state.orchard, pips: state.orchard.pips + kept } }, note: first ? ' You keep the pips.' : '' };
}

/** The dawn the oldest tree comes to bear, the first apples of the survivor's own. */
export function orchardNews(before: GameState, after: GameState): string[] {
  const days = after.orchard.trees.flatMap(tree => (tree ? [tree.plantedDay] : []));
  if (days.length === 0) return [];
  const oldest = Math.min(...days);
  return autumnsPassed(oldest, before.day) < 3 && autumnsPassed(oldest, after.day) >= 3 ? ['There are apples on your own tree this morning.'] : [];
}

const FRAMES: Record<Exclude<TreeStage, 'sprout'>, Record<Season, string>> = {
  sapling: { autumn: 'sapling', winter: 'saplingBare', spring: 'sapling', summer: 'sapling' },
  young: { autumn: 'youngAutumn', winter: 'youngBare', spring: 'youngBlossom', summer: 'youngGreen' },
  grown: { autumn: 'grownAutumn', winter: 'grownBare', spring: 'grownBlossom', summer: 'grownGreen' }
};

/** The picture for a tree today: its age and the season, with apples on it once ripe. */
export function treeFrame(tree: OrchardTree, day: number): string {
  const stage = treeStage(tree, day);
  if (stage === 'sprout') return 'sprout';
  return treeRipe(tree, day) ? 'grownFruit' : FRAMES[stage][season(day)];
}

import { bridgeDone } from './bridge';
import { MILESTONE_STONE, ROAD_SECTIONS, ROAD_WORK, milestoneDone, roadDone, type RoadState } from './meadow';
import { TOO_TIRED_MESSAGE, isExhausted } from './needs';
import { BALANCE, type GameState } from './state';

// EASTER EGG: the town, see src/game/town.ts. Where the old road's sections lie across the meadow, and its milestone,
// and how each is worked: a section cleared of bracken a little at a time, and the milestone set stone by stone.

/** The middle of each section of the road, west to east along the meadow. */
export const ROAD_SPOTS: readonly { x: number; y: number }[] = Array.from({ length: ROAD_SECTIONS }, (_, i) => ({ x: 3.5 + i * 6.5, y: 18 }));
/** The sections in the order they are cleared: outwards from where the lane comes down to the road. */
export const ROAD_ORDER: readonly number[] = [3, 4, 2, 5, 1, 0];
/** The milestone, beside the road near its east end, where traders would come in. */
export const MILESTONE_SITE = { x: 37, y: 16.5 } as const;

/** Where the road can be worked on now: the next section to clear, then the milestone, or null when there is nothing to do. */
export function roadSpot(state: GameState): { area: 'meadow'; x: number; y: number } | null {
  const { road, bridge } = state.town;
  if (!bridgeDone(bridge) || milestoneDone(road)) return null;
  return { area: 'meadow', ...(roadDone(road) ? MILESTONE_SITE : ROAD_SPOTS[ROAD_ORDER[road.cleared]]) };
}

/** Why the road can't be worked on now, or null if it can. */
export function roadWorkBlocker(state: GameState): string | null {
  const spot = roadSpot(state);
  if (!spot) return 'There is nothing to do here yet.';
  if (state.area !== 'meadow' || Math.hypot(state.player.x - spot.x, state.player.y - spot.y) > BALANCE.interactionRadius) return 'Move closer to the road.';
  if (roadDone(state.town.road) && state.inventory.stone < 1) return 'Bring stone from the quarry in your bag.';
  return isExhausted(state) ? TOO_TIRED_MESSAGE : null;
}

/** What the prompt says at the road: the work on offer, or what is missing for the milestone. */
export function roadPrompt(state: GameState): string {
  const { road } = state.town;
  if (!roadDone(road)) return `Clear the old road (${road.work}/${ROAD_WORK})`;
  return state.inventory.stone < 1 ? 'Milestone · bring stone from the quarry in your bag' : `Set a milestone stone (${road.milestone}/${MILESTONE_STONE})`;
}

/** The state with one more go at the road: a little more of a section cleared, or a stone from the bag set in the milestone. */
export function doRoadWork(state: GameState): GameState {
  const { road } = state.town;
  if (roadDone(road)) {
    const milestone = road.milestone + 1;
    const doneDays = milestone >= MILESTONE_STONE ? { ...road.doneDays, milestone: state.day } : road.doneDays;
    return { ...state, inventory: { ...state.inventory, stone: state.inventory.stone - 1 }, town: { ...state.town, road: { ...road, milestone, doneDays } } };
  }
  const opened = road.work + 1 >= ROAD_WORK;
  const cleared = road.cleared + (opened ? 1 : 0);
  const doneDays = cleared >= ROAD_SECTIONS ? { ...road.doneDays, road: state.day } : road.doneDays;
  return { ...state, town: { ...state.town, road: { ...road, cleared, work: opened ? 0 : road.work + 1, doneDays } } };
}

/** What a go at the road says, read from the road after it. */
export function roadWorkLine(after: RoadState): string {
  if (after.milestone > 0) return milestoneDone(after) ? 'The milestone stands by the road. Someone coming this way would see it.' : 'You set another stone on the milestone.';
  if (roadDone(after)) return 'The old road runs clear from one side of the meadow to the other.';
  return after.work === 0 ? 'Another stretch of the old road is open.' : 'You pull back the bracken and find the old stones underneath.';
}

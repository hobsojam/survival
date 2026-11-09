// EASTER EGG: the town, see src/game/town.ts. The meadow over the bridge, and the old traders' road through it: cleared
// a section at a time, then marked with a milestone, for whoever comes this way.

/** How many sections of the old road there are to clear, and how much work each takes. */
export const ROAD_SECTIONS = 6;
export const ROAD_WORK = 4;
/** How much stone the milestone takes. */
export const MILESTONE_STONE = 6;

/** How much of the road is cleared, how far along the next section is, the milestone's stone, and the day each was finished. */
export interface RoadState { cleared: number; work: number; milestone: number; doneDays: { road?: number; milestone?: number } }

export const emptyRoad = (): RoadState => ({ cleared: 0, work: 0, milestone: 0, doneDays: {} });
export const roadDone = (road: RoadState): boolean => road.cleared >= ROAD_SECTIONS;
export const milestoneDone = (road: RoadState): boolean => road.milestone >= MILESTONE_STONE;

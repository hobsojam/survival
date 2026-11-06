import { season } from '../game/calendar';
import { STEP_IDS } from '../game/clearing';
import { treeStage, type TreeStage } from '../game/orchard';
import type { GameState } from '../game/state';

// What the camp looks like from the top of the keep, read one landmark at a time from what the player has really built.

export interface CampView {
  clearingRadius: number;
  shelter: 'none' | 'shelter' | 'woodshed';
  campfire: boolean;
  house: boolean;
  beds: boolean;
  well: boolean;
  workshop: boolean;
  field: boolean;
  windmill: boolean;
  bakery: boolean;
  sheep: number;
  orchard: { stage: TreeStage; apples: boolean }[] | null;
}

const SMALLEST_CLEARING = 15;
const SHEEP_IN_THE_FLOCK = 3;

export function campView(state: GameState): CampView {
  const built = state.structures;
  const autumn = season(state.day) === 'autumn';
  return {
    clearingRadius: SMALLEST_CLEARING + SMALLEST_CLEARING * state.clearing.cleared.length / STEP_IDS.length,
    shelter: !built.shelter ? 'none' : built.house ? 'woodshed' : 'shelter',
    campfire: !built.house,
    house: built.house,
    beds: built.vegetableBeds,
    well: built.well,
    workshop: built.workshop,
    field: built.field,
    windmill: built.windmill,
    bakery: built.bakery,
    sheep: state.sheep.arrived ? SHEEP_IN_THE_FLOCK : 0,
    orchard: built.orchard
      ? state.orchard.trees.flatMap(tree => {
        if (!tree) return [];
        const stage = treeStage(tree, state.day);
        return [{ stage, apples: autumn && stage === 'grown' }];
      })
      : null
  };
}

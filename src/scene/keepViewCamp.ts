import { season } from '../game/calendar';
import { STEP_IDS } from '../game/clearing';
import { treeStage, type TreeStage } from '../game/orchard';
import { NEEDS, SIDES, TOWERS, hallFinished, isRevealed, towerFinished } from '../game/castle';
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
  castle: CastleView;
}

/** What the castle adds to the view. EASTER EGG: nothing of it shows before the line of stones has been seen. */
export interface CastleView {
  line: boolean;
  /** How many sides of the wall are finished, and how many towers. */
  walls: number;
  towers: number;
  /** Whether the gatehouse is finished. */
  gatehouse: boolean;
  /** Whether the moat is dug all the way round. */
  moat: boolean;
  /** Whether the great hall has its stones, roof, iron and hangings. */
  hall: boolean;
}

const SMALLEST_CLEARING = 15;
const SHEEP_IN_THE_FLOCK = 3;

export const castleView = (state: GameState): CastleView => {
  const { wall, towers } = state.castle;
  return {
    line: isRevealed(state),
    walls: SIDES.filter(side => wall[side] === NEEDS.wallSide).length,
    towers: TOWERS.filter(id => towerFinished(towers[id])).length,
    gatehouse: state.castle.gatehouse === NEEDS.gatehouse,
    moat: state.castle.moat.stretches === NEEDS.moat,
    hall: hallFinished(state.castle.hall)
  };
};

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
      : null,
    castle: castleView(state)
  };
}

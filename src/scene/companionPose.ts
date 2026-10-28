import { isWinter, nightStart } from '../game/calendar';
import { BALANCE, type Friend, type GameState } from '../game/state';
import { foxFrame } from './ambient';

// The friend is decoration worked out from the state, the clock and how long the survivor has stood still.

/** Where the friend is, in tiles; `height` lifts it off the ground, as for a bird on a roof or a shoulder. */
export interface CompanionPose { x: number; y: number; height: number; frame: string; facing: 1 | -1 }

const { campX, campY } = BALANCE;
/** By the fire: the fox curls up on one side, the wolf stretches out on the other. */
const FIRESIDE: Record<Friend, { x: number; y: number; facing: 1 | -1 }> = {
  fox: { x: campX + 1.4, y: campY - 0.4, facing: -1 },
  wolf: { x: campX - 1.6, y: campY - 0.2, facing: 1 },
  bird: { x: campX - 1, y: campY + 1, facing: 1 }
};
/** Under the shelter's eaves, when there is a shelter. */
const EAVES = { x: campX - 3, y: campY - 1.6 };
const SHOULDER_SECONDS = 3;

function fireside(state: GameState, friend: Friend, timeMs: number): CompanionPose {
  const spot = FIRESIDE[friend];
  if (friend === 'fox') return { ...spot, height: 0, frame: foxFrame('sit', timeMs / 1000) };
  if (friend === 'wolf') return { ...spot, height: 0, frame: 'wolf:lie' };
  // The bird tucks in under the eaves, or perches on the log seat before there is a roof.
  return state.structures.shelter ? { ...EAVES, height: 1.4, frame: 'bird:idle', facing: 1 } : { ...spot, height: 0.4, frame: 'bird:idle' };
}

/**
 * The friend's pose: by the fire at night or while the survivor is away from camp,
 * and by day close by, each in its own way.
 */
export function companionPose(state: GameState, timeMs: number, stillSeconds: number, facing: 1 | -1): CompanionPose | null {
  const friend = state.companion.friend;
  if (!friend) return null;
  const { x, y } = state.player;
  const away = state.area !== 'camp' || Math.hypot(x - campX, y - campY) > BALANCE.campRadius + 4;
  if (away || state.timeOfDay >= nightStart(state.day)) return fireside(state, friend, timeMs);
  const still = stillSeconds > 0.5;
  const seconds = timeMs / 1000;
  if (friend === 'wolf') {
    return { x: x - facing * 0.6, y: y + 0.5, height: 0, frame: still ? 'wolf:sit' : `wolf:walk${Math.floor(seconds * 6) % 2}`, facing };
  }
  if (friend === 'fox') {
    // Now and then a fox pounces in the snow.
    const pounce = isWinter(state.day) && still && seconds % 8 < 0.6;
    const frame = still ? foxFrame('sit', seconds) : foxFrame('trot', seconds);
    return { x: x - facing * 1.5, y: y + 0.1, height: pounce ? 0.4 : 0, frame: pounce ? 'fox:run1' : frame, facing };
  }
  // A little in front of the survivor, so it is drawn over them.
  if (stillSeconds >= SHOULDER_SECONDS) return { x: x + facing * 0.3, y: y + 0.2, height: 0.75, frame: 'bird:idle', facing };
  // Walking, the bird hops a little ahead.
  return { x: x + facing * 0.9, y: y - 0.3, height: 0.6 + Math.abs(Math.sin(seconds * 3)) * 0.3, frame: 'bird:hop', facing };
}

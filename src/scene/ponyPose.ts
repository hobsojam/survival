import { isWinter, nightStart } from '../game/calendar';
import { wildPonyAt, ponyWith } from '../game/pony';
import type { GameState } from '../game/state';

// Where the pony is drawn, worked out from the state and the clock. The scene eases the picture along to it.

/** Where the pony grazes at camp: open grass south-east of the fire, in nobody's way. */
export const PONY_HOME = { x: 33, y: 21 } as const;

/** Where the shod pony stands overnight by the finished keep: beside its wall, off the path. */
export const KEEP_PONY = { x: 21, y: 10 } as const;

export interface PonyPose { x: number; y: number; frame: string; facing: 1 | -1 }

const GRAZE_MS = 900;
const WALK_MS = 180;
const beat = (timeMs: number, every: number): 0 | 1 => (Math.floor(timeMs / every) % 2 === 0 ? 0 : 1);

/** Close beside the survivor, a little behind. */
function beside(state: GameState, timeMs: number, facing: 1 | -1, moving: boolean, loaded: boolean): PonyPose {
  const frame = moving ? `${loaded ? 'loadWalk' : 'walk'}${beat(timeMs, WALK_MS)}` : loaded ? 'loadStand' : 'stand';
  return { x: state.player.x - facing * 1.1, y: state.player.y + 0.5, frame: `pony:${frame}`, facing };
}

/** The pony's pose, or null when it isn't here. */
export function ponyPoseFor(state: GameState, timeMs: number, facing: 1 | -1, moving: boolean): PonyPose | null {
  const { pony, area, day, timeOfDay } = state;
  if (pony.won === null) {
    const wild = area === 'hills' ? wildPonyAt(state) : null;
    return wild ? { ...wild, frame: `pony:graze${beat(timeMs, GRAZE_MS)}`, facing: pony.spot % 2 === 0 ? 1 : -1 } : null;
  }
  if (!pony.home) return beside(state, timeMs, facing, moving, false);
  const homeNow = { ...PONY_HOME, frame: `pony:graze${beat(timeMs, GRAZE_MS)}`, facing: -1 as const };
  if (pony.shod === null) return area === 'camp' ? homeNow : null;
  if (area === 'camp' && timeOfDay >= nightStart(day)) return { ...PONY_HOME, frame: 'pony:loadStand', facing: -1 };
  if (area === 'hills' && isWinter(day)) return null;
  if (area === 'hills' && timeOfDay >= nightStart(day) && state.keep.ponyNight === day) return { ...KEEP_PONY, frame: 'pony:loadStand', facing: -1 };
  return ponyWith(state) ? beside(state, timeMs, facing, moving, true) : null;
}

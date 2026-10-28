import { isWinter, nightStart } from '../game/calendar';
import { BALANCE, type Friend, type GameState } from '../game/state';
import type { Point } from '../game/wildlife';
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

/** On winter nights the wild wolves howl once every this many seconds, and a friendly wolf answers. */
export const CHORUS_SECONDS = 24;
const ANSWER_FROM = 1.4;
const ANSWER_TO = 3.8;

/** A winter night at camp with a wolf for a friend: the nights the wolves sing to each other. */
export function chorusNight(state: GameState): boolean {
  return state.companion.friend === 'wolf' && state.area === 'camp' && isWinter(state.day) && state.timeOfDay >= nightStart(state.day);
}

/** Whether the friendly wolf has its head up, answering the howl that began this cycle. */
export function wolfAnswering(state: GameState, timeMs: number): boolean {
  const phase = (timeMs / 1000) % CHORUS_SECONDS;
  return chorusNight(state) && phase >= ANSWER_FROM && phase < ANSWER_TO;
}

const BIRD_PERCH_RANGE = 4.5;
/** Where a bird can sit: grown tree crowns, and the roofs and rails of what has been built. */
function perches(state: GameState): (Point & { height: number })[] {
  const built = state.structures;
  return [
    ...state.trees.filter(tree => tree.readyDay <= state.day).map(tree => ({ x: tree.x, y: tree.y + 0.1, height: 2.1 })),
    ...(built.shelter ? [{ x: campX - 3, y: campY - 1.9, height: 1.5 }] : []),
    ...(built.dryingRack ? [{ x: campX + 2, y: campY - 1.9, height: 1.5 }] : []),
    ...(built.toolshed ? [{ x: campX + 4, y: campY + 0.1, height: 1.3 }] : [])
  ];
}

/** The perch nearest the spot a little ahead of the survivor, if one is in reach. */
function perchAhead(state: GameState, facing: 1 | -1): (Point & { height: number }) | null {
  const { x, y } = state.player;
  const ahead = { x: x + facing * 1.5, y };
  const near = perches(state).filter(perch => Math.hypot(perch.x - x, perch.y - y) <= BIRD_PERCH_RANGE);
  near.sort((a, b) => Math.hypot(a.x - ahead.x, a.y - ahead.y) - Math.hypot(b.x - ahead.x, b.y - ahead.y));
  return near[0] ?? null;
}

function fireside(state: GameState, friend: Friend, timeMs: number): CompanionPose {
  const spot = FIRESIDE[friend];
  if (friend === 'fox') return { ...spot, height: 0, frame: foxFrame('sit', timeMs / 1000) };
  if (friend === 'wolf') return { ...spot, height: 0, frame: wolfAnswering(state, timeMs) ? 'wolf:howl' : 'wolf:lie' };
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
  // Working or walking, it sits on the nearest perch ahead, or hops along beside the survivor where there is none.
  const perch = perchAhead(state, facing);
  if (perch) return { ...perch, frame: 'bird:idle', facing: x < perch.x ? -1 : 1 };
  return { x: x + facing * 0.9, y: y - 0.3, height: 0.6 + Math.abs(Math.sin(seconds * 3)) * 0.3, frame: 'bird:hop', facing };
}

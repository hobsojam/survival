import { nightStart } from './calendar';
import type { GameAction } from './rules';
import { availableWood } from './wood';
import { TOO_TIRED_MESSAGE, isExhausted } from './needs';
import { BALANCE, type GameState } from './state';

// The keep: one stone tower at the top of the hills path, raised a stone at a time once the forge stands. Nothing changes
// until the last stone is laid; after that its door is a place to sleep at night and a way up to the top by day.

/** Where the keep's door stands on the hills. */
export const KEEP_SITE = { x: 18, y: 10 };
export const KEEP_STONES = 60;
export const KEEP_DOOR_AT = 24;
export const KEEP_DOOR_WOOD = 4;

export interface KeepState {
  stones: number;
  door: boolean;
  /** The day the first stone went on. */
  startedDay: number | null;
  /** The day the last stone went on. */
  finishedDay: number | null;
  /** The last night the shod pony stayed up here, having been with the survivor as it fell. */
  ponyNight: number | null;
}

export function emptyKeep(): KeepState {
  return { stones: 0, door: false, startedDay: null, finishedDay: null, ponyNight: null };
}

/** Whether the site is there to build on: it appears once the forge stands. */
export const keepOpen = (state: GameState): boolean => state.progress.workshop.forge;
export const keepFinished = (state: GameState): boolean => state.keep.stones >= KEEP_STONES;
/** The walls are at head height and wait for their door. */
export const keepNeedsDoor = (state: GameState): boolean => state.keep.stones === KEEP_DOOR_AT && !state.keep.door;

const byKeep = (state: GameState): boolean =>
  state.area === 'hills' && Math.hypot(state.player.x - KEEP_SITE.x, state.player.y - KEEP_SITE.y) <= BALANCE.interactionRadius;

/** Why a stone can't be laid right now, or null if it can. Only stone in the bag counts: the camp's pile is a long way off. */
export function layStoneBlocker(state: GameState): string | null {
  if (!keepOpen(state)) return 'There is nothing to build here yet.';
  if (keepFinished(state)) return 'The keep is finished.';
  if (!byKeep(state)) return 'Move closer to the keep.';
  if (keepNeedsDoor(state)) return 'The walls need a door first.';
  if (state.inventory.stone < 1) return 'Bring stone up from the quarry.';
  return isExhausted(state) ? TOO_TIRED_MESSAGE : null;
}

/** Why the door can't be hung right now, or null if it can. Its wood can come from the camp's stores. */
export function hangDoorBlocker(state: GameState): string | null {
  if (!keepOpen(state)) return 'There is nothing to build here yet.';
  if (!byKeep(state)) return 'Move closer to the keep.';
  if (state.keep.door) return 'The door is already hung.';
  if (state.keep.stones < KEEP_DOOR_AT) return 'The door can wait until the walls are up.';
  if (!state.progress.workshop.hinges) return 'Make iron hinges at the forge first.';
  if (availableWood(state) < KEEP_DOOR_WOOD) return `You need ${KEEP_DOOR_WOOD} wood for the door.`;
  return isExhausted(state) ? TOO_TIRED_MESSAGE : null;
}

const STONE_LINES: Record<number, string> = {
  1: 'You lay the first stone of the keep.',
  8: 'The footings are in.',
  [KEEP_DOOR_AT]: 'The walls are at head height. They need a door now.',
  48: 'The walls are up. Only the top is left.',
  [KEEP_STONES]: 'You lay the last stone. The keep is finished.'
};

/** What laying the keep's nth stone says. */
export const stoneLine = (stones: number): string => STONE_LINES[stones] ?? 'You lay another stone on the keep.';

/** The keep with one more stone on it, marking the days of the first and the last. */
export function withStoneLaid(keep: KeepState, day: number): KeepState {
  const stones = keep.stones + 1;
  return { ...keep, stones, startedDay: keep.startedDay ?? day, finishedDay: stones === KEEP_STONES ? day : null };
}

/** At the door of the finished keep. Worked out from where the survivor stands, so nothing about a night here is saved. */
export const inKeep = (state: GameState): boolean => keepFinished(state) && byKeep(state);

/** What going in at the door means now: to bed from nightfall on, otherwise up to the top. Read as the survivor arrives, not when they set off. */
export function withKeepDoor(state: GameState, action: GameAction): GameAction {
  if (action.type !== 'enterKeep') return action;
  return { type: state.timeOfDay >= nightStart(state.day) ? 'sleep' : 'climbKeep' };
}

/** Why the survivor can't climb to the top right now, or null if they can. It costs nothing, so being tired doesn't stop them. */
export function climbKeepBlocker(state: GameState): string | null {
  if (!inKeep(state)) return 'Move closer to the keep door.';
  return state.timeOfDay >= nightStart(state.day) ? 'It is too dark to see anything from the top.' : null;
}

/** The mornings after the keep's first stone and its last. Each is worked out from the saved day, so it comes once. */
export function keepNews(before: GameState, after: GameState): string[] {
  if (after.day <= before.day) return [];
  const notes: string[] = [];
  if (after.keep.startedDay === before.day) notes.push('The keep has its first stone now.');
  if (after.keep.finishedDay === before.day) notes.push('The keep stands finished on the hills this morning.');
  return notes;
}

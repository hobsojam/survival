import { isInClearing } from './clearing';
import { BALANCE, type GameState } from './state';

// Three stray sheep that come to a pen with feed out, and never leave. Fluff grows every dawn, faster when fed, and
// missing a feed costs nothing else; left alone for years, the flock becomes a set of giant clouds.

export type SheepStage = 'shorn' | 'woolly' | 'round' | 'cloud';

export function sheepStage(fluff: number): SheepStage {
  if (fluff >= BALANCE.fluffCap) return 'cloud';
  if (fluff >= BALANCE.fluffRound) return 'round';
  return fluff >= BALANCE.fluffOnArrival ? 'woolly' : 'shorn';
}

/** Why feed can't go out now, or null. Being tired doesn't stop it: it's no heavier than gathering by hand. */
export function feedBlocker(state: GameState): string | null {
  if (!state.structures.sheepPen) return 'Build the sheep pen first.';
  if (!isInClearing(state)) return 'Return to camp to feed the sheep.';
  if (state.sheep.fedUntil !== null && state.day < state.sheep.fedUntil) return 'The sheep still have plenty.';
  return state.field.straw <= 0 ? 'There is no straw. Thresh a strip of the field.' : null;
}

/** The state with a straw spent and feed in the rack for the next three dawns. */
export function fedSheep(state: GameState): GameState {
  return { ...state, field: { ...state.field, straw: state.field.straw - 1 }, sheep: { ...state.sheep, fedUntil: state.day + BALANCE.feedDays } };
}

/** The flock's dawn: the strays come to a pen with feed out, and fluff grows. Mutates advanceTime's working copy. */
export function sheepDawn(next: GameState): void {
  const { sheep } = next;
  if (!sheep.arrived) {
    if (next.structures.sheepPen && sheep.fedUntil !== null) next.sheep = { ...sheep, arrived: true, fluff: BALANCE.fluffOnArrival };
    return;
  }
  const growth = sheep.fedUntil !== null && next.day <= sheep.fedUntil ? BALANCE.fluffFed : BALANCE.fluffUnfed;
  next.sheep = { ...sheep, fluff: Math.min(BALANCE.fluffCap, sheep.fluff + growth) };
}

/** What the survivor notices of the flock between two states. */
export function sheepNews(before: GameState, after: GameState): string[] {
  return !before.sheep.arrived && after.sheep.arrived ? ['Three sheep were in the pen this morning. They seem to have decided something.'] : [];
}

import { BALANCE, type GameState } from './state';
import { isWinter } from './calendar';
import { freeSpaces } from './camp';
import { addFood } from './food';

/** The flock waits in the old yard until there is a coop to come home to. */
export const CHICKEN_SITE = { x: 20, y: 16 } as const;
export const COOP_SITE = { x: BALANCE.campX + 2, y: BALANCE.campY - 2 } as const;

/** Walking up to the new coop finishes the playable journey home. */
export function settleChickens(state: GameState): GameState {
  if (state.area !== 'camp' || !state.chickens.following || !state.structures.chickenCoop) return state;
  if (Math.hypot(state.player.x - COOP_SITE.x, state.player.y - COOP_SITE.y) > 1.5) return state;
  return { ...state, chickens: { ...state.chickens, following: false, rescued: true, nextEggDay: state.day + 2 } };
}

/** A fed flock lays every two dawns; foraging alone is slower and stops in winter. */
export function chickensDawn(next: GameState): void {
  const flock = next.chickens;
  if (!flock.rescued || !next.structures.chickenCoop || flock.eggs >= 3 || next.day < flock.nextEggDay) return;
  const grain = next.structures.granary && next.field.grain > 0;
  if (!grain && isWinter(next.day)) return;
  if (grain) next.field = { ...next.field, grain: next.field.grain - 1 };
  next.chickens = { ...flock, eggs: flock.eggs + 1, nextEggDay: next.day + (grain ? 2 : 4) };
}

export function takeEggBlocker(state: GameState): string | null {
  if (!state.chickens.rescued || !state.structures.chickenCoop) return 'Bring the chickens home first.';
  if (state.area !== 'camp' || Math.hypot(state.player.x - COOP_SITE.x, state.player.y - COOP_SITE.y) > BALANCE.interactionRadius) {
    return 'Stand beside the coop to collect eggs.';
  }
  if (state.chickens.eggs < 1) return 'There are no eggs to collect yet.';
  if (freeSpaces(state) < 1) return 'Make room in your bag for an egg.';
  return null;
}

export function takenEgg(state: GameState): GameState {
  return { ...state,
    chickens: { ...state.chickens, eggs: state.chickens.eggs - 1 },
    inventory: { ...state.inventory, food: addFood(state.inventory.food, 'egg', 1, state.day) }
  };
}

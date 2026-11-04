import { season } from './calendar';
import { freeSpaces } from './camp';
import { BALANCE, type GameState } from './state';

export const HOMESTEAD_SHED = { x: 22, y: 12 } as const;
export const APPLE_TREE = { x: 29, y: 19 } as const;

const by = (state: GameState, site: { x: number; y: number }): boolean =>
  state.area === 'homestead' && Math.hypot(state.player.x - site.x, state.player.y - site.y) <= BALANCE.interactionRadius;

export function appleBlocker(state: GameState): string | null {
  if (!by(state, APPLE_TREE)) return 'Stand beside the old apple tree.';
  if (season(state.day) !== 'autumn') return 'The tree bears apples in autumn.';
  if (state.homestead.applesReadyDay > state.day) return 'The tree has no ripe apples yet.';
  if (freeSpaces(state) < 1) return 'Make room in your bag for an apple.';
  return null;
}

export function shedBlocker(state: GameState): string | null {
  if (!by(state, HOMESTEAD_SHED)) return 'Stand beside the old shed.';
  if (state.homestead.shedSearched) return 'You have already searched the shed.';
  if (freeSpaces(state) < 3) return 'Make three spaces in your bag for what is left in the shed.';
  return null;
}

import { BALANCE, type GameState } from './state';

// The hills, past the quarry: ore in the rock near the top, and a wild pony. The plants up there are only to look at.

/** The hills' way down, on their east edge, which comes out on the quarry's west edge. */
export const HILLS_EXIT = { x: 39, y: 15 };
export const QUARRY_HILLS_EXIT = { x: 0, y: 15 };
/** The rocky outcrop near the top, with rust-red streaks of ore. */
export const OUTCROP_SITE = { x: 10, y: 7 };

export const HILLS_FOUND_MESSAGE = 'You came out on the hills. There is rust-red in the rock near the top.';

export const OUTCROP_MESSAGES = {
  first: 'You chip out a heavy lump of ore. There is nothing to do with it yet.',
  more: 'You chip out a lump of ore.'
};

/** How much ore the outcrop still gives today. */
export function outcropLeft(state: GameState): number {
  return BALANCE.outcropPerDay - (state.outcrop.day === state.day ? state.outcrop.dug : 0);
}

/** Ore to make things with: what is in the bag and what the forge keeps. */
export function availableOre(state: GameState): number {
  return state.inventory.ore + state.storedOre;
}

/** Spends ore from the bag first, then the forge. */
export function spendOre(state: GameState, amount: number): GameState {
  const fromBag = Math.min(state.inventory.ore, amount);
  return { ...state, inventory: { ...state.inventory, ore: state.inventory.ore - fromBag }, storedOre: state.storedOre - (amount - fromBag) };
}

/** Why the outcrop can't be dug, or null. The bag and tiredness are checked with the other digging in the rules. */
export function digOreBlocker(state: GameState): string | null {
  if (!state.progress.pickaxeCrafted) return 'You need a pickaxe to work the outcrop.';
  if (state.area !== 'hills' || Math.hypot(state.player.x - OUTCROP_SITE.x, state.player.y - OUTCROP_SITE.y) > BALANCE.interactionRadius) return 'Move closer to the outcrop.';
  return outcropLeft(state) > 0 ? null : 'The outcrop is worked out until morning.';
}

import { isWinter } from './calendar';
import { availableFiber, availableWood, freeSpaces, isInClearing, spaceFor } from './camp';
import { isHungry, isTired } from './needs';
import type { GameAction } from './rules';
import { isSick } from './sickness';
import { BALANCE, SITES, type GameState } from './state';

// Ice fishing at the quiet spring, the winter's hard-won food. Nothing about the survivor's weakness ever refuses it:
// a hungry, sick or exhausted survivor fishes more slowly, but always can.

export const FISHING_LINE_COST = { wood: 1, fiber: 1 } as const;

/** Why the fishing line can't be made now, or null. It never asks for strength. */
export function fishingLineBlocker(state: GameState): string | null {
  if (state.progress.fishingLine) return 'You already have a fishing line.';
  if (!isInClearing(state)) return 'Return to camp to make the fishing line.';
  if (availableWood(state) < FISHING_LINE_COST.wood || availableFiber(state) < FISHING_LINE_COST.fiber) return 'Need 1 wood and 1 fiber for a fishing line.';
  return null;
}

export const isAtSpring = (state: GameState): boolean =>
  Math.hypot(state.player.x - SITES.spring.x, state.player.y - SITES.spring.y) <= BALANCE.interactionRadius;

/** Why the survivor can't fish here now, or null. It never asks for strength. */
export function fishingBlocker(state: GameState): string | null {
  if (state.area !== 'camp') return 'There is nothing like that here.';
  if (!isAtSpring(state)) return 'Walk to the quiet spring to fish.';
  if (!isWinter(state.day)) return 'The spring only freezes in winter.';
  if (!state.progress.fishingLine) return 'Make a fishing line first.';
  if (freeSpaces(state) < spaceFor('food')) return 'Make room in your bag for a fish.';
  return null;
}

/** Seconds one go at the ice takes: longer for a tired, hungry or sick survivor. */
export function fishingSecondsFor(state: GameState): number {
  const weak = isTired(state) || isHungry(state) || isSick(state);
  return weak ? BALANCE.fishingSeconds * BALANCE.fishingWeakFactor : BALANCE.fishingSeconds;
}

/** Whether a go catches: by the roll, but never a third empty go in a row. */
export function catches(state: GameState, roll: number): boolean {
  return state.fishingMisses >= BALANCE.fishingMaxMisses || roll >= BALANCE.fishingMissChance;
}

/** A chance roll the rules accept: a number in [0, 1). */
export const validRoll = (roll: unknown): roll is number => typeof roll === 'number' && roll >= 0 && roll < 1;

/** What visiting the spring means now: fishing through the ice in winter with a line, otherwise the usual visit. */
export function springAction(state: GameState, roll: number): GameAction {
  return isWinter(state.day) && state.progress.fishingLine ? { type: 'fish', roll } : { type: 'visitSite', siteId: 'spring' };
}

/** The action the scene performs: a visit to the spring becomes fishing when that's what it means; anything else is unchanged. */
export function withFishing(state: GameState, action: GameAction, roll: number): GameAction {
  return action.type === 'visitSite' && action.siteId === 'spring' ? springAction(state, roll) : action;
}

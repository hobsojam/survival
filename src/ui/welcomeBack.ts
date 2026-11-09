import type { AreaId } from '../game/state';

const WELCOME: Record<AreaId, string> = {
  camp: 'Welcome back to your camp.',
  quarry: 'Welcome back. You are out by the old quarry.',
  homestead: 'Welcome back. You are at the old homestead.',
  hills: 'Welcome back. You are up on the hills.',
  // EASTER EGG: the town, see src/game/town.ts.
  meadow: 'Welcome back. You are down in the meadow.'
};

/** What the game says on loading a save, by where the survivor is. */
export const welcomeBack = (area: AreaId): string => WELCOME[area];

import { seasonMessage } from './calendar';
import { rainMessage } from './rain';
import type { GameState } from './state';
import { wolfMessage } from './wolves';

/** What happened while time passed, whether a frame ticked by or an action took its seconds: a shower, a wolf, a new season. */
export function newsBetween(before: GameState, after: GameState): string[] {
  return [rainMessage(before, after), wolfMessage(before, after), seasonMessage(before.day, after.day)].filter((text): text is string => text !== null);
}

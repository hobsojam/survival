import { seasonMessage } from './calendar';
import { rainMessage } from './rain';
import { heatMessage } from './rules';
import type { GameState } from './state';
import { wolfMessage } from './wolves';
import { companionNews } from './companion';

/** What happened while time passed, whether a frame ticked by or an action took its seconds: a shower, the midday heat, a wolf, a new season, a friend's doings. */
export function newsBetween(before: GameState, after: GameState): string[] {
  return [rainMessage(before, after), heatMessage(before, after), wolfMessage(before, after), seasonMessage(before.day, after.day)]
    .filter((text): text is string => text !== null).concat(companionNews(before, after));
}

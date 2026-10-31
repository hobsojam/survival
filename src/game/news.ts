import { daysLeftInSeason, season, seasonMessage } from './calendar';
import { rainMessage } from './rain';
import { heatMessage } from './rules';
import type { GameState } from './state';
import { wolfMessage } from './wolves';
import { companionNews } from './companion';
import { coldNightWarning } from './coldNight';
import { spoilMessage } from './food';
import { witheredMessage } from './beds';

/** The dawn into autumn's eighth day, when the bushes begin to thin: once, with three days of autumn left. */
export function lateAutumnMessage(before: GameState, after: GameState): string | null {
  const dawn = after.day > before.day && season(after.day) === 'autumn' && daysLeftInSeason(after.day) === 3;
  return dawn ? "The bushes are thinning. Berries won't keep through the winter; dry some, and gather nuts." : null;
}

/** What happened while time passed, whether a frame ticked by or an action took its seconds: a shower, the midday heat, a wolf, food gone soft, beds withered, a new season, a friend's doings. */
export function newsBetween(before: GameState, after: GameState): string[] {
  return [coldNightWarning(before, after), rainMessage(before, after), heatMessage(before, after), wolfMessage(before, after), spoilMessage(before, after), witheredMessage(before, after), seasonMessage(before.day, after.day), lateAutumnMessage(before, after)]
    .filter((text): text is string => text !== null).concat(companionNews(before, after));
}

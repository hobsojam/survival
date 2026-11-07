import { orchardNews } from './orchard';
import { keepNews } from './keep';
import { castleNews } from './castleSites';
import { hillsNews } from './pony';
import { daysLeftInSeason, season, seasonMessage } from './calendar';
import { rainMessage } from './rain';
import { heatMessage } from './rules';
import type { GameState } from './state';
import { wolfMessage } from './wolves';
import { companionNews } from './companion';
import { namedNote } from './names';
import { sheepNews } from './sheep';
import { coldNightWarning } from './coldNight';
import { spoilMessage } from './food';
import { witheredMessage } from './beds';
import { fieldNews } from './field';
import { bakeryNews } from './bakehouse';
import { fallingIllMessage, sickDayMessage } from './sickness';

/** The dawn into autumn's eighth day, when the bushes begin to thin: once, with three days of autumn left. */
export function lateAutumnMessage(before: GameState, after: GameState): string | null {
  const dawn = after.day > before.day && season(after.day) === 'autumn' && daysLeftInSeason(after.day) === 3;
  return dawn ? "The bushes are thinning. Berries won't keep through the winter; dry some, and gather nuts." : null;
}

/** What happened while time passed, whether a frame ticked by or an action took its seconds: a shower, the midday heat, a wolf, food gone soft, beds withered, a new season, the field's turn, a friend's doings. */
const morningNote = (before: GameState, after: GameState): string[] => {
  const note = after.day > before.day ? namedNote(after, after.day) : null;
  return note ? [note] : [];
};

export function newsBetween(before: GameState, after: GameState): string[] {
  return [coldNightWarning(before, after), rainMessage(before, after), heatMessage(before, after), wolfMessage(before, after), spoilMessage(before, after), witheredMessage(before, after), seasonMessage(before.day, after.day), fieldNews(before, after), bakeryNews(before, after), lateAutumnMessage(before, after), fallingIllMessage(before, after), sickDayMessage(before, after)]
    .filter((text): text is string => text !== null).concat(companionNews(before, after), sheepNews(before, after), orchardNews(before, after), hillsNews(before, after), keepNews(before, after), castleNews(before, after), morningNote(before, after));
}

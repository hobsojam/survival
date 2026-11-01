import { SEASON_LENGTH, YEAR_LENGTH, season, seasonName } from '../game/calendar';
import type { GameState } from '../game/state';

// The run's end, when sickness wins: told gently, with the journal to keep. Death is the end; there is no carrying on.

/** How long the view fades before the ending card shows. */
export const ENDING_FADE_MS = 2500;

export interface EndingView { title: string; summary: string }

const SHELTER_WORK: ReadonlySet<string> = new Set(['shelterThatched', 'shelterStonework', 'shelterPorch', 'shelterFinished']);

const YEAR_ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth'];

function dayOrdinal(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

const yearPhrase = (year: number): string => (YEAR_ORDINALS[year - 1] ? `their ${YEAR_ORDINALS[year - 1]} year` : `year ${year}`);

const counted = (n: number, word: string, verb: string): string => `${n} ${word}${n === 1 ? '' : 's'} ${verb}`;

export function endingView(state: GameState): EndingView {
  const day = state.ending?.day ?? state.day;
  const year = Math.floor((day - 1) / YEAR_LENGTH) + 1;
  const ofSeason = (day - 1) % SEASON_LENGTH + 1;
  const where = yearPhrase(year);
  const title = `Your survivor's story ended on the ${dayOrdinal(ofSeason)} day of ${seasonName(season(day)).toLowerCase()}, in ${where}.`;
  // The shelter's roof, footing, porch and door finish the one shelter; they aren't buildings of their own.
  const buildings = Object.entries(state.structures).filter(([id, built]) => built && !SHELTER_WORK.has(id)).length;
  const parts = [counted(day, 'day', 'lived'), counted(buildings, 'building', 'raised')];
  if (state.companion.friend) parts.push(`a friend in the ${state.companion.friend}`);
  return { title, summary: parts.join(' · ') };
}

export function endingMarkup(): string {
  return '<div id="story-ending" class="lookout-ending story-ending hidden" role="dialog" aria-modal="true" aria-labelledby="story-ending-title">'
    + '<div class="start-card"><div class="start-mark">✦</div><p class="eyebrow">THE END OF THE STORY</p>'
    + '<h1 id="story-ending-title" class="story-ending-title"></h1><p id="story-ending-summary" class="start-copy"></p>'
    + '<div class="start-buttons"><button id="download-journal" class="primary-button">Download your journal</button>'
    + '<button id="begin-again" class="secondary-button">Begin again</button></div></div></div>';
}

export interface EndingElement { textContent: string | null; classList: { remove(name: string): void } }

/** Fills the ending card and shows it. */
export function showEnding(find: (selector: string) => Partial<EndingElement> | null, view: EndingView): void {
  const title = find('#story-ending-title');
  if (title) title.textContent = view.title;
  const summary = find('#story-ending-summary');
  if (summary) summary.textContent = view.summary;
  find('#story-ending')?.classList?.remove('hidden');
}

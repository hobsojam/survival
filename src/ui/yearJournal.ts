import { SEASON_LENGTH, YEAR_LENGTH, seasonName, type Season } from '../game/calendar';
import { JOURNAL_PAGES, journalEntry, journalSeason } from '../game/journalEntries';
import type { GameState } from '../game/state';

const YEAR: readonly Season[] = ['autumn', 'winter', 'spring', 'summer'];
const WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

/** Pages run one per season from autumn of year one, so day 1 is page 0 and day 41 is page 4. */
export const currentPage = (day: number): number => Math.floor((day - 1) / SEASON_LENGTH);

export const yearWords = (year: number): string => WORDS[year - 1] ?? String(year);

export interface JournalPageView {
  title: string;
  days: string;
  entries: { icon: string; day: string; line: string }[];
  blanks: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

/** One season's page of the year journal; pages before the first or after today show the nearest real one. */
export function journalPageView(state: GameState, page: number): JournalPageView {
  const last = currentPage(state.day);
  const index = Math.max(0, Math.min(last, Math.round(page)));
  const year = Math.floor(index / 4) + 1;
  const s = YEAR[index % 4];
  const first = (year - 1) * YEAR_LENGTH + (index % 4) * SEASON_LENGTH + 1;
  const order = JOURNAL_PAGES[s].map(entry => entry.id);
  const written = state.journal
    .filter(entry => entry.year === year && journalSeason(entry.id) === s)
    .sort((a, b) => a.day - b.day || order.indexOf(a.id) - order.indexOf(b.id));
  return {
    title: `${seasonName(s)}, year ${yearWords(year)}`,
    days: `Days ${first}–${first + SEASON_LENGTH - 1}`,
    entries: written.map(entry => {
      const known = journalEntry(entry.id)!;
      return { icon: known.icon, day: `Day ${entry.day}`, line: known.lines[entry.variant] ?? known.lines[0] };
    }),
    blanks: JOURNAL_PAGES[s].length - written.length,
    hasPrevious: index > 0,
    hasNext: index < last
  };
}

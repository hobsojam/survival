import { SEASON_LENGTH, YEAR_LENGTH, seasonName, type Season } from '../game/calendar';
import { journalIconUrl } from '../art/journalIcons';
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
  /** Each written line, with its pixel picture as an image URL. */
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
      return { icon: journalIconUrl(entry.id), day: `Day ${entry.day}`, line: known.lines[entry.variant] ?? known.lines[0] };
    }),
    blanks: JOURNAL_PAGES[s].length - written.length,
    hasPrevious: index > 0,
    hasNext: index < last
  };
}

/** Leafs one page back or forward from the page being read (null follows today); reaching today's page follows the season again. */
export function turnPage(page: number | null, step: number, day: number): number | null {
  const today = currentPage(day);
  const next = Math.max(0, (page ?? today) + step);
  return next >= today ? null : next;
}

/** The small slice of the DOM the journal page writes to, so it can be drawn in tests without a browser. */
export interface JournalNode {
  className: string;
  textContent: string | null;
  disabled?: boolean;
  classList: { toggle(name: string, force?: boolean): unknown };
  setAttribute(name: string, value: string): void;
  append(...nodes: (JournalNode | string)[]): void;
  replaceChildren(...nodes: JournalNode[]): void;
}
export interface JournalRoot { querySelector(selector: string): unknown }
export interface JournalDocument { createElement(tag: string): unknown }

function row(make: JournalDocument, entry: JournalPageView['entries'][number] | null): JournalNode {
  const element = (tag: string) => make.createElement(tag) as JournalNode;
  const item = element('li');
  item.classList.toggle('blank', entry === null);
  const picture = element('span');
  picture.className = 'year-journal-icon';
  // A written moment shows its pixel picture; a blank keeps its question mark.
  picture.textContent = entry ? '' : '?';
  if (entry) picture.setAttribute('style', `background-image: url("${entry.icon}")`);
  picture.setAttribute('aria-hidden', 'true');
  const text = element('span');
  text.className = 'year-journal-line';
  if (entry) {
    const when = element('small');
    when.textContent = entry.day;
    text.append(when, entry.line);
  } else {
    text.setAttribute('aria-label', 'Not yet written');
  }
  item.append(picture, text);
  return item;
}

/** Draws a journal page: its heading, the page-turn buttons, and each written line followed by a blank for each still to come. */
export function renderJournalPage(root: JournalRoot, view: JournalPageView, make: JournalDocument): void {
  const find = (selector: string) => root.querySelector(selector) as JournalNode | null;
  const title = find('#year-journal-title');
  if (title) title.textContent = view.title;
  const days = find('#year-journal-days');
  if (days) days.textContent = view.days;
  const previous = find('#year-journal-previous');
  if (previous) previous.disabled = !view.hasPrevious;
  const next = find('#year-journal-next');
  if (next) next.disabled = !view.hasNext;
  find('#year-journal-entries')?.replaceChildren(...view.entries.map(entry => row(make, entry)),
    ...Array.from({ length: view.blanks }, () => row(make, null)));
}

import { describe, expect, it } from 'vitest';
import { createGame, type GameState } from '../src/game/state';
import { endingMarkup, endingView, showEnding } from '../src/ui/ending';
import { downloadText } from '../src/ui/download';
import { journalText } from '../src/ui/yearJournal';

const endedOn = (day: number, changes: Partial<GameState> = {}): GameState => ({ ...createGame(), day, ...changes, ending: { day } });

describe('the ending card', () => {
  it('says gently when the story ended, by the day of the season and the year', () => {
    expect(endingView(endedOn(16)).title).toBe("Your survivor's story ended on the 6th day of winter, in their first year.");
    expect(endingView(endedOn(56)).title).toBe("Your survivor's story ended on the 6th day of winter, in their second year.");
    expect(endingView(endedOn(21)).title).toBe("Your survivor's story ended on the 1st day of spring, in their first year.");
  });

  it('counts the days of the season 1st to 10th, and the years first to fifth, then by number', () => {
    const ordinals = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(day => endingView(endedOn(day)).title.match(/on the (\w+) day/)![1]);
    expect(ordinals).toEqual(['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th']);
    const years = [1, 2, 3, 4, 5, 6].map(year => endingView(endedOn((year - 1) * 40 + 1)).title.match(/, in (?:their )?(.+)\.$/)![1]);
    expect(years).toEqual(['first year', 'second year', 'third year', 'fourth year', 'fifth year', 'year 6']);
  });

  it('sums up the days lived, the buildings raised and the friend made', () => {
    const base = createGame();
    const built = Object.fromEntries(Object.keys(base.structures).map((id, index) => [id, index < 12])) as GameState['structures'];
    const withFox = endedOn(46, { structures: built, companion: { ...base.companion, friend: 'fox' } });
    expect(endingView(withFox).summary).toBe('46 days lived · 12 buildings raised · a friend in the fox');
    expect(endingView(endedOn(16)).summary).toBe('16 days lived · 0 buildings raised');
    const one = endedOn(1, { structures: { ...base.structures, shelter: true } });
    expect(endingView(one).summary).toBe('1 day lived · 1 building raised');
  });

  it('is a quiet dialog with the journal to keep and a way to begin again', () => {
    const markup = endingMarkup();
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('id="download-journal"');
    expect(markup).toContain('id="begin-again"');
    expect(markup.toLowerCase()).not.toContain('game over');
  });

  it('fills the card and shows it', () => {
    const elements = new Map<string, { textContent: string | null; hidden: Set<string> }>();
    const find = (selector: string) => {
      if (!elements.has(selector)) elements.set(selector, { textContent: null, hidden: new Set(['hidden']) });
      const element = elements.get(selector)!;
      return { set textContent(text: string) { element.textContent = text; }, classList: { remove: (name: string) => { element.hidden.delete(name); } } };
    };
    showEnding(find, endingView(endedOn(16)));
    expect(elements.get('#story-ending-title')!.textContent).toBe("Your survivor's story ended on the 6th day of winter, in their first year.");
    expect(elements.get('#story-ending-summary')!.textContent).toBe('16 days lived · 0 buildings raised');
    expect(elements.get('#story-ending')!.hidden.has('hidden')).toBe(false);
  });
});

describe('the journal as text', () => {
  it('writes a heading per written page and a line per entry, skipping blank pages', () => {
    const state: GameState = { ...createGame(), day: 52, journal: [
      { year: 1, id: 'leaves', day: 2, variant: 0 },
      { year: 1, id: 'firstSnow', day: 12, variant: 0 },
      { year: 2, id: 'leaves', day: 43, variant: 0 }
    ] };
    expect(journalText(state)).toBe([
      'Autumn, year one', 'Day 2 · The first leaves came down over camp.', '',
      'Winter, year one', 'Day 12 · Snow fell in the night.', '',
      'Autumn, year two', 'Day 43 · The first leaves came down over camp.', ''
    ].join('\n'));
  });

  it('is empty before anything is written', () => {
    expect(journalText(createGame())).toBe('');
  });
});

describe('downloading the journal', () => {
  it('makes one named link from the text, clicks it, and lets the address go only afterwards', () => {
    const calls: string[] = [];
    let later: (() => void) | undefined;
    downloadText({
      urlFor: text => { calls.push(`url:${text}`); return 'blob:1'; },
      createLink: (href, name) => { calls.push(`link:${href}:${name}`); return { click: () => calls.push('click'), remove: () => calls.push('remove') }; },
      release: url => calls.push(`release:${url}`),
      later: run => { later = run; }
    }, 'hearthwild-journal.txt', 'Day 2 · Leaves.');
    // Some phone browsers cancel a download whose address is let go at once, so that waits a moment.
    expect(calls).toEqual(['url:Day 2 · Leaves.', 'link:blob:1:hearthwild-journal.txt', 'click']);
    later!();
    expect(calls).toEqual(['url:Day 2 · Leaves.', 'link:blob:1:hearthwild-journal.txt', 'click', 'remove', 'release:blob:1']);
  });
});

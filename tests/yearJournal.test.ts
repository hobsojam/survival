import { describe, expect, it } from 'vitest';
import { createGame, type GameState } from '../src/game/state';
import type { JournalEntry } from '../src/game/journalEntries';
import { currentPage, journalPageView, yearWords } from '../src/ui/yearJournal';

const on = (day: number, journal: JournalEntry[] = []): GameState => ({ ...createGame(), day, journal });

describe('the year journal pages', () => {
  it('titles pages by season and year', () => {
    const view = journalPageView(on(45), currentPage(45));
    expect(view.title).toBe('Autumn, year two');
    expect(view.days).toBe('Days 41–50');
    expect(yearWords(21)).toBe('21');
  });

  it('lists what was written, then a blank for each moment still to come', () => {
    const view = journalPageView(on(6, [
      { year: 1, id: 'fox', day: 4, variant: 0 },
      { year: 1, id: 'leaves', day: 2, variant: 0 }
    ]), currentPage(6));
    expect(view.entries.map(entry => entry.day)).toEqual(['Day 2', 'Day 4']);
    expect(view.entries[0]).toEqual({ icon: '🍂', day: 'Day 2', line: 'The first leaves came down over camp.' });
    expect(view.blanks).toBe(3);
  });

  it('leafs back no further than the first page and no further forward than today', () => {
    const state = on(45);
    expect(journalPageView(state, 0).hasPrevious).toBe(false);
    expect(journalPageView(state, 0).title).toBe('Autumn, year one');
    expect(journalPageView(state, currentPage(45)).hasNext).toBe(false);
    expect(journalPageView(state, 99).title).toBe('Autumn, year two');
    expect(journalPageView(state, -3).title).toBe('Autumn, year one');
  });

  it('shows a quiet past season honestly', () => {
    const view = journalPageView(on(45, [{ year: 1, id: 'leaves', day: 2, variant: 0 }]), 1);
    expect(view.title).toBe('Winter, year one');
    expect(view.days).toBe('Days 11–20');
    expect(view.entries).toEqual([]);
    expect(view.blanks).toBe(5);
    expect(view.hasPrevious && view.hasNext).toBe(true);
  });

  it('shows the cold front line that matched the night', () => {
    const view = journalPageView(on(5, [{ year: 1, id: 'coldFront', day: 3, variant: 1 }]), 0);
    expect(view.entries[0].line).toBe('The cold front came, and the fire didn\'t last.');
  });
});

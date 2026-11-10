// EASTER EGG: the town, see src/game/town.ts. What market day leaves in the journal.
import { describe, expect, it } from 'vitest';
import { journalEntry, recordJournal } from '../src/game/journalEntries';
import { applyAction } from '../src/game/rules';
import type { GameState } from '../src/game/state';
import { fullTown, opened } from './marketTown';

const OPEN_LINE = 'Every house is full. The square is ready for market day.';
const MARKET_LINE = 'The first market day. Traders came over the bridge.';
const LENS_LINE = 'Kept a glass lens a trader gave me.';

/** The journal's lines with the day each was written. */
const written = (state: GameState) => state.journal.map(entry => ({ line: journalEntry(entry.id)?.lines[entry.variant], day: entry.day }));
const sleep = (state: GameState) => {
  const night = { ...state, timeOfDay: 230 };
  const after = applyAction(night, { type: 'sleep' }).state;
  return recordJournal(night, after, { type: 'sleep' }).state;
};

describe('market day in the journal', () => {
  it('notes the square opening on the dawn it opens, and the first market on its day, and nothing before', () => {
    const before = fullTown(state => { state.day = 99; });
    expect(written(before).map(each => each.line)).not.toContain(OPEN_LINE);
    const openDay = sleep(before);
    expect(openDay.town.market.openDay).toBe(100);
    expect(written(openDay)).toContainEqual({ line: OPEN_LINE, day: 100 });
    expect(written(openDay).map(each => each.line)).not.toContain(MARKET_LINE);
    const eve = sleep(openDay);
    expect(written(eve).map(each => each.line)).not.toContain(MARKET_LINE);
    const market = sleep(eve);
    expect(written(market)).toContainEqual({ line: MARKET_LINE, day: 102 });
  });

  it('notes the lens on the day it was given, once, and later markets not at all', () => {
    const before = opened(100, state => { state.day = 104; });
    const given = { ...before, town: { ...before.town, market: { ...before.town.market, lensDay: 104 } } };
    const withLens = recordJournal(before, given).state;
    expect(written(withLens)).toContainEqual({ line: LENS_LINE, day: 104 });
    expect(recordJournal(given, withLens).state.journal.filter(entry => journalEntry(entry.id)?.lines[entry.variant] === LENS_LINE)).toHaveLength(1);
    const later = sleep(sleep(sleep(withLens)));
    expect(later.day).toBe(107);
    expect(later.journal.filter(entry => journalEntry(entry.id)?.lines[entry.variant] === MARKET_LINE)).toHaveLength(0);
  });
});

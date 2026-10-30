import { describe, expect, it } from 'vitest';
import { createGame, type GameState } from '../src/game/state';
import type { JournalEntry } from '../src/game/journalEntries';
import { journalIconUrl } from '../src/art/journalIcons';
import { currentPage, journalPageView, renderJournalPage, turnPage, yearWords, type JournalNode } from '../src/ui/yearJournal';

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
    expect(view.entries[0]).toEqual({ icon: journalIconUrl('leaves'), day: 'Day 2', line: 'The first leaves came down over camp.' });
    expect(view.blanks).toBe(4);
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
    expect(view.blanks).toBe(6);
    expect(view.hasPrevious && view.hasNext).toBe(true);
  });

  it('shows the cold night line that matched the night', () => {
    const view = journalPageView(on(5, [{ year: 1, id: 'coldFront', day: 3, variant: 1 }]), 0);
    expect(view.entries[0].line).toBe('The cold night came, and it got the better of me.');
  });
});

/** A stand-in element that keeps what the journal writes to it. */
interface FakeNode extends JournalNode { tag: string; children: (FakeNode | string)[]; classes: Set<string>; attributes: Record<string, string> }
function fakeNode(tag: string): FakeNode {
  const node: FakeNode = {
    tag, className: '', textContent: null, children: [], classes: new Set(), attributes: {},
    classList: { toggle: (name: string, force?: boolean) => (force ?? !node.classes.has(name)) ? node.classes.add(name) : node.classes.delete(name) },
    setAttribute: (name, value) => { node.attributes[name] = value; },
    append: (...nodes) => { node.children.push(...(nodes as (FakeNode | string)[])); },
    replaceChildren: (...nodes) => { node.children = nodes as FakeNode[]; }
  };
  return node;
}

describe('turning and drawing journal pages', () => {
  it('turns back from today, and returns to following today on reaching it', () => {
    expect(turnPage(null, -1, 45)).toBe(3);
    expect(turnPage(3, -1, 45)).toBe(2);
    expect(turnPage(0, -1, 45)).toBe(0);
    expect(turnPage(3, 1, 45)).toBeNull();
    expect(turnPage(null, 1, 45)).toBeNull();
  });

  it('draws the heading, the buttons, the written lines and the blanks', () => {
    const elements: Record<string, FakeNode> = Object.fromEntries(
      ['#year-journal-title', '#year-journal-days', '#year-journal-previous', '#year-journal-next', '#year-journal-entries'].map(id => [id, fakeNode('el')]));
    const root = { querySelector: (selector: string) => elements[selector] ?? null };
    const view = journalPageView(on(6, [{ year: 1, id: 'leaves', day: 2, variant: 0 }]), currentPage(6));
    renderJournalPage(root, view, { createElement: fakeNode });
    expect(elements['#year-journal-title'].textContent).toBe('Autumn, year one');
    expect(elements['#year-journal-days'].textContent).toBe('Days 1–10');
    expect([elements['#year-journal-previous'].disabled, elements['#year-journal-next'].disabled]).toEqual([true, true]);
    const rows = elements['#year-journal-entries'].children as FakeNode[];
    expect(rows).toHaveLength(6);
    const [icon, text] = rows[0].children as FakeNode[];
    expect(icon.textContent).toBe('');
    expect(icon.attributes.style).toBe(`background-image: url("${journalIconUrl('leaves')}")`);
    expect((text.children[0] as FakeNode).textContent).toBe('Day 2');
    expect(text.children[1]).toBe('The first leaves came down over camp.');
    expect(rows[0].classes.has('blank')).toBe(false);
    expect(rows.slice(1).every(item => item.classes.has('blank'))).toBe(true);
    expect((rows[1].children[0] as FakeNode).textContent).toBe('?');
    expect((rows[1].children[1] as FakeNode).attributes['aria-label']).toBe('Not yet written');
  });

  it('draws nothing and does not throw when the panel is missing', () => {
    expect(() => renderJournalPage({ querySelector: () => null }, journalPageView(on(6), 0), { createElement: fakeNode })).not.toThrow();
  });
});


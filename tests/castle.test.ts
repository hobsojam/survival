import { describe, expect, it } from 'vitest';
import type { Season } from '../src/game/calendar';
import { WALLS, emptyCastle, isRevealed, treeUnderWall } from '../src/game/castle';
import { recordJournal } from '../src/game/journalEntries';
import { KEEP_SITE, KEEP_STONES } from '../src/game/keep';
import { applyAction } from '../src/game/rules';
import { createGame, type GameState } from '../src/game/state';
import { promptFor } from '../src/scene/prompts';
import { HILL_TREES, sceneVisuals } from '../src/scene/visuals';
import { journalPageView } from '../src/ui/yearJournal';

const game = createGame();
const finishedKeep = (day = 5): GameState => ({
  ...game, day, timeOfDay: 40, area: 'hills', player: { ...game.player, ...KEEP_SITE },
  progress: { ...game.progress, hillsFound: true, workshop: { ...game.progress.workshop, forge: true } },
  keep: { ...game.keep, stones: KEEP_STONES }
});
const climb = (state: GameState): GameState => applyAction(state, { type: 'climbKeep' }).state;
const later = (state: GameState): GameState => ({ ...state, day: state.day + 1, timeOfDay: 40 });
const revealed = (day = 5): GameState => ({ ...finishedKeep(day), castle: { ...emptyCastle(), firstClimbDay: day - 1, revealedDay: day } });
const BY_THE_LINE = { x: 18, y: 13 };

describe('seeing the line of stones', () => {
  it('the first climb only records the day', () => {
    const after = climb(finishedKeep());
    expect(after.castle.firstClimbDay).toBe(after.day);
    expect(isRevealed(after)).toBe(false);
  });

  it('a second climb the same day reveals nothing', () => {
    const after = climb(climb(finishedKeep()));
    expect(after.castle.firstClimbDay).toBe(5);
    expect(after.castle.revealedDay).toBeNull();
  });

  it.each([[2, 'autumn'], [12, 'winter'], [22, 'spring'], [32, 'summer']] as [number, Season][])('a climb on a later day reveals the line, in %s', (day) => {
    const first = climb(finishedKeep(day));
    const result = applyAction(later(first), { type: 'climbKeep' });
    expect(result.state.castle.revealedDay).toBe(day + 1);
    expect(result.state.castle.firstClimbDay).toBe(day);
    expect(result.message).toBe('');
  });

  it('a refused climb records nothing', () => {
    const night = { ...finishedKeep(), timeOfDay: 190 };
    expect(applyAction(night, { type: 'climbKeep' }).state.castle).toEqual(emptyCastle());
  });

  it('pins the walls around the keep', () => {
    expect(WALLS).toEqual({ left: 13, right: 24, top: 5, bottom: 15 });
    expect(KEEP_SITE.x).toBeGreaterThan(WALLS.left);
    expect(KEEP_SITE.x).toBeLessThan(WALLS.right);
    expect(KEEP_SITE.y).toBeGreaterThan(WALLS.top);
    expect(KEEP_SITE.y).toBeLessThan(WALLS.bottom);
  });

  it('shows no castle visual before the reveal, and the line after it', () => {
    const ids = (state: GameState): string[] => sceneVisuals(state, 0).map(visual => visual.id);
    expect(ids(finishedKeep()).filter(id => id.startsWith('castle'))).toEqual([]);
    expect(ids(climb(finishedKeep())).filter(id => id.startsWith('castle'))).toEqual([]);
    expect(ids(revealed())).toContain('castle-line');
  });

  it('shows the line on the hills only', () => {
    expect(sceneVisuals({ ...revealed(), area: 'camp' }, 0).some(visual => visual.id === 'castle-line')).toBe(false);
  });

  it('keeps every hill tree today, since none stand inside the walls', () => {
    const count = (state: GameState): number => sceneVisuals(state, 0).filter(visual => visual.id.startsWith('hill-tree-')).length;
    expect(count(revealed())).toBe(HILL_TREES.length);
  });

  it('clears a tree inside the walls once the wall side nearest it starts, not before', () => {
    const tree = { x: 15, y: 10 };
    const castle = emptyCastle();
    expect(treeUnderWall(castle, tree)).toBe(false);
    expect(treeUnderWall({ ...castle, wall: { ...castle.wall, east: 5, north: 5, south: 5 } }, tree)).toBe(false);
    expect(treeUnderWall({ ...castle, wall: { ...castle.wall, west: 1 } }, tree)).toBe(true);
    expect(treeUnderWall({ ...castle, wall: { ...castle.wall, west: 1 } }, { x: 22, y: 10 })).toBe(false);
    expect(treeUnderWall({ ...castle, wall: { ...castle.wall, west: 1 } }, { x: 30, y: 10 })).toBe(false);
  });
});

describe('the line of stones in the journal', () => {
  const page = (day: number): number => Math.floor((day - 1) / 10);
  const lineIds = (state: GameState): string[] => state.journal.filter(entry => entry.id.startsWith('castleLine')).map(entry => entry.id);
  const reveal = (day: number): { before: GameState; after: GameState } => {
    const before = { ...finishedKeep(day), castle: { ...emptyCastle(), firstClimbDay: day - 1 } };
    return { before, after: climb(before) };
  };

  it.each([[2, 'castleLineAutumn'], [12, 'castleLineWinter'], [22, 'castleLineSpring'], [32, 'castleLineSummer']])('revealing on day %i writes %s once', (day, id) => {
    const { before, after } = reveal(day);
    const written = recordJournal(before, after, { type: 'climbKeep' });
    expect(lineIds(written.state)).toEqual([id]);
    const next = later(written.state);
    expect(lineIds(recordJournal(written.state, climb(next), { type: 'climbKeep' }).state)).toEqual([id]);
  });

  it('writes nothing for the first climb', () => {
    const before = finishedKeep(2);
    expect(lineIds(recordJournal(before, climb(before), { type: 'climbKeep' }).state)).toEqual([]);
  });

  it('is never a blank, and only shows on its page once written', () => {
    const { before, after } = reveal(2);
    const { state } = recordJournal(before, after, { type: 'climbKeep' });
    const without = { ...state, journal: state.journal.filter(entry => !entry.id.startsWith('castleLine')) };
    expect(journalPageView(without, page(2)).blanks).toBe(journalPageView(state, page(2)).blanks);
    expect(journalPageView(state, page(2)).entries).toHaveLength(journalPageView(without, page(2)).entries.length + 1);
    expect(journalPageView(state, page(2)).entries.map(entry => entry.line)).toContain('A line of old stones showed in the grass below the keep.');
  });
});

describe('standing near the line', () => {
  it('names the old stones once the line has shown', () => {
    const near = { ...revealed(), player: { ...revealed().player, ...BY_THE_LINE } };
    expect(promptFor(near)).toBe('Old stones · a wall could run here');
  });

  it('says nothing about them before the reveal, or far from the line', () => {
    const unseen = { ...finishedKeep(), player: { ...finishedKeep().player, ...BY_THE_LINE } };
    expect(promptFor(unseen)).not.toContain('Old stones');
    const far = { ...revealed(), player: { ...revealed().player, x: 30, y: 25 } };
    expect(promptFor(far)).not.toContain('Old stones');
  });
});

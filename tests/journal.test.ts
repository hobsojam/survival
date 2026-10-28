import { describe, expect, it } from 'vitest';
import { createGame } from '../src/game/state';
import { journalView } from '../src/ui/journal';

describe('field journal', () => {
  it('keeps unvisited destinations unnamed while showing their direction', () => {
    const view = journalView(createGame());
    expect(view.locations.map(place => [place.id, place.label, place.visited])).toEqual([
      ['basket', 'Unexplored northwest path', false],
      ['spring', 'Unexplored southwest path', false],
      ['cairn', 'Unexplored southeast path', false],
      ['lookout', 'Old lookout', false]
    ]);
    expect(view.nextHint).toMatch(/shelter/i);
  });

  it('reveals visits and advances the next hint through the main milestones', () => {
    const state = createGame();
    state.structures.shelter = true;
    expect(journalView(state).nextHint).toMatch(/cold front/i);
    state.progress.hearthUnlocked = true;
    state.structures.toolshed = true;
    state.progress.discoveries.basket = true;
    const view = journalView(state);
    expect(view.locations.find(place => place.id === 'basket')).toMatchObject({ label: 'Old basket', visited: true });
    expect(view.nextHint).toMatch(/lookout/i);
    state.progress.lookoutRepaired = true;
    expect(journalView(state).nextHint).toMatch(/unexplored/i);
    state.progress.discoveries.spring = true;
    state.progress.discoveries.cairn = true;
    expect(journalView(state).nextHint).toMatch(/west path/i);
    state.progress.quarryFound = true;
    expect(journalView(state).nextHint).toMatch(/all five paths/i);
    expect(journalView({ ...state, progress: { ...state.progress, lookoutRepaired: false } }).milestones).toHaveLength(4);
    // Once the lookout stands, the year journal takes over and the milestones step aside.
    expect(journalView(state).milestones).toEqual([]);
  });

  it('uses the rescheduled cold front day after a missed storm', () => {
    const state = createGame();
    state.day = 4;
    state.structures.shelter = true;
    state.progress.nextStormDay = 6;
    expect(journalView(state).nextHint).toContain('day 6');
  });

  it('the journal lists the quarry once the path opens', () => {
    const state = createGame();
    expect(journalView(state).locations.find(place => place.id === 'quarry')).toBeUndefined();
    state.structures.shelter = true;
    expect(journalView(state).locations.find(place => place.id === 'quarry'))
      .toEqual({ id: 'quarry', label: 'Unexplored west path', visited: false, x: 1, y: 15 });
    state.progress.quarryFound = true;
    expect(journalView(state).locations.find(place => place.id === 'quarry')).toMatchObject({ label: 'Old quarry', visited: true });
    expect(journalView(state).milestones.find(item => item.label === 'Find the old quarry')?.done).toBe(true);
  });

  it('the hint suggests the toolshed after the cold front', () => {
    const state = createGame();
    state.structures.shelter = true;
    state.progress.hearthUnlocked = true;
    expect(journalView(state).nextHint).toBe('Build a toolshed at camp to make tools.');
    state.structures.toolshed = true;
    expect(journalView(state).nextHint).toMatch(/lookout/i);
  });

  it('five paths in the closing line', () => {
    const state = createGame();
    state.structures.shelter = true;
    state.structures.toolshed = true;
    state.progress.hearthUnlocked = true;
    state.progress.lookoutRepaired = true;
    state.progress.discoveries = { basket: true, spring: true, cairn: true };
    state.progress.quarryFound = true;
    expect(journalView(state).nextHint)
      .toBe('You have followed all five paths. Your camp is home, and the woods are yours to wander.');
  });

  it('asks for no stone before the cold night', () => {
    const state = createGame();
    expect(journalView(state).nextHint).not.toMatch(/stone/i);
    state.structures.shelter = true;
    expect(journalView(state).nextHint).not.toMatch(/stone/i);
  });
});

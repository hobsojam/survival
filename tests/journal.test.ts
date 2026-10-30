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
    expect(journalView(state).nextHint).toMatch(/cold night/i);
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

  it('uses the rescheduled cold night day after a missed storm', () => {
    const state = createGame();
    state.day = 4;
    state.structures.shelter = true;
    state.progress.nextStormDay = 6;
    expect(journalView(state).nextHint).toContain('day 6');
  });

  it('shows an abstract area route and reveals what the lookout can see', () => {
    const state = createGame();
    expect(journalView(state).regions).toEqual([]);
    state.structures.shelter = true;
    expect(journalView(state).regions).toEqual([{
      id: 'quarry', direction: 'West', label: 'Unexplored area', status: 'unknown',
      resources: [], features: [], current: false
    }]);
    state.area = 'quarry';
    expect(journalView(state).regions[0]).toMatchObject({
      label: 'Old quarry', status: 'visited', resources: ['Stone'], current: true
    });
    state.area = 'camp';
    state.progress.lookoutRepaired = true;
    expect(journalView(state).regions).toEqual([{
      id: 'quarry', direction: 'West', label: 'Old quarry', status: 'scouted',
      resources: ['Stone'], features: ['Loose rubble', 'Quarry face'], current: false
    }]);
    state.progress.lookoutRepaired = false;
    state.progress.quarryFound = true;
    state.area = 'quarry';
    expect(journalView(state).regions[0]).toMatchObject({ label: 'Old quarry', status: 'visited', current: true });
    expect(journalView(state).locations.map(place => place.id)).not.toContain('quarry');
    expect(journalView(state).milestones.find(item => item.label === 'Find the old quarry')?.done).toBe(true);
  });

  it('the hint suggests the toolshed after the cold night', () => {
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

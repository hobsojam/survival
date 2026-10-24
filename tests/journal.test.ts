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
    state.progress.discoveries.basket = true;
    const view = journalView(state);
    expect(view.locations.find(place => place.id === 'basket')).toMatchObject({ label: 'Old basket', visited: true });
    expect(view.nextHint).toMatch(/lookout/i);
    state.progress.lookoutRepaired = true;
    expect(journalView(state).nextHint).toMatch(/unexplored/i);
    state.progress.discoveries.spring = true;
    state.progress.discoveries.cairn = true;
    expect(journalView(state).nextHint).toMatch(/all four paths/i);
    expect(journalView(state).milestones.filter(item => item.done)).toHaveLength(3);
  });

  it('uses the rescheduled cold front day after a missed storm', () => {
    const state = createGame();
    state.day = 4;
    state.structures.shelter = true;
    state.progress.nextStormDay = 6;
    expect(journalView(state).nextHint).toContain('day 6');
  });
});

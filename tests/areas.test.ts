import { describe, expect, it } from 'vitest';
import { crossing, pathOpen } from '../src/game/areas';
import { BALANCE, createGame } from '../src/game/state';

describe('areas', () => {
  it('the west path is closed until the shelter is built', () => {
    const state = createGame();
    expect(pathOpen(state)).toBe(false);
    state.structures.shelter = true;
    expect(pathOpen(state)).toBe(true);
  });

  it('crossing leaves camp only at the path end', () => {
    const state = createGame();
    state.player.x = 0.1;
    state.player.y = 15;
    expect(crossing(state, -0.2, 15)).toBeNull();
    state.structures.shelter = true;
    expect(crossing(state, -0.2, 15)).toEqual({ area: 'quarry', x: BALANCE.mapWidth - 1.5, y: 15 });
    expect(crossing(state, -0.2, 10)).toBeNull();
  });

  it('crossing returns from the quarry at its east edge', () => {
    const state = createGame();
    state.area = 'quarry';
    expect(crossing(state, BALANCE.mapWidth - 0.8, 15.6)).toEqual({ area: 'camp', x: 0.5, y: 15.6 });
  });
});

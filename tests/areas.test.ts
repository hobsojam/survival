import { describe, expect, it } from 'vitest';
import { crossing, pathOpen } from '../src/game/areas';
import { BALANCE, createGame } from '../src/game/state';
import { applyAction } from '../src/game/rules';

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

  it('walks the east path to the homestead and returns by its west edge', () => {
    const state = createGame();
    expect(crossing(state, BALANCE.mapWidth, 15)).toBeNull();
    state.structures.shelter = true;
    expect(crossing(state, BALANCE.mapWidth, 15)).toEqual({ area: 'homestead', x: 0.5, y: 15 });
    state.area = 'homestead';
    expect(crossing(state, -0.2, 15)).toEqual({ area: 'camp', x: BALANCE.mapWidth - 1.5, y: 15 });
  });

  it('crosses the homestead route from the path-end tap action', () => {
    const state = createGame();
    state.structures.shelter = true;
    state.player.x = BALANCE.mapWidth - 1;
    state.player.y = 15;
    const arrived = applyAction(state, { type: 'cross' }).state;
    expect(arrived.area).toBe('homestead');
    expect(arrived.progress.homesteadFound).toBe(true);
    const returned = applyAction({ ...arrived, player: { ...arrived.player, x: 0, y: 15 } }, { type: 'cross' }).state;
    expect(returned.area).toBe('camp');
  });
});

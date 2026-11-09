import { describe, expect, it } from 'vitest';
import { HOUSE_NEEDS, TOWN_NAMES, emptyTown, townStarted } from '../src/game/town';
import { createGame } from '../src/game/state';

// EASTER EGG: the town, see src/game/town.ts.

describe('the town before anyone comes', () => {
  it('starts empty, with one unbuilt house', () => {
    expect(emptyTown()).toEqual({ traveller: null, goneDay: null, namesUsed: 0, people: [], houses: [{ stone: 0, beams: 0, fittings: 0, doneDay: null }] });
    expect(createGame().town).toEqual(emptyTown());
  });

  it('has started once a traveller or a person has come', () => {
    const game = createGame();
    expect(townStarted(game)).toBe(false);
    expect(townStarted({ ...game, town: { ...emptyTown(), traveller: { name: 'Ada', arrivedDay: 3, refusals: 0, askedDay: null } } })).toBe(true);
    expect(townStarted({ ...game, town: { ...emptyTown(), people: [{ name: 'Ada', job: 'hens', house: null, arrivedDay: 3 }] } })).toBe(true);
  });

  it('has names enough, all different, and asks the house for stone, then beams, then a fitting', () => {
    expect(TOWN_NAMES.slice(0, 3)).toEqual(['Ada', 'Tomas', 'Elin']);
    expect(TOWN_NAMES.length).toBeGreaterThanOrEqual(12);
    expect(new Set(TOWN_NAMES).size).toBe(TOWN_NAMES.length);
    expect(HOUSE_NEEDS).toEqual({ stone: 30, beams: 4, fittings: 1 });
  });
});

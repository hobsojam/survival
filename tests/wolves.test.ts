import { describe, expect, it } from 'vitest';
import { nightStart } from '../src/game/calendar';
import { createGame, type GameState } from '../src/game/state';
import { advanceTime, applyAction } from '../src/game/rules';
import { wolfMessage, wolfTracksShown, wolvesClose } from '../src/game/wolves';

const base = createGame();
/** A winter night at camp with the fire out, the cold night long behind. */
const dark: GameState = {
  ...base, day: 12, timeOfDay: nightStart(12) + 5, fireFuel: 0,
  structures: { ...base.structures, shelter: true },
  progress: { ...base.progress, hearthUnlocked: true, nextStormDay: null }
};

describe('wolves in the dark camp', () => {
  it('takes a ration first, then a berry, then nothing', () => {
    expect(advanceTime({ ...dark, inventory: { ...dark.inventory, trailFood: 2, food: 1 } }, 1))
      .toMatchObject({ inventory: { trailFood: 1, food: 1 }, lastWolf: { day: 12, took: 'ration' } });
    expect(advanceTime({ ...dark, inventory: { ...dark.inventory, food: 1 } }, 1))
      .toMatchObject({ inventory: { food: 0 }, lastWolf: { day: 12, took: 'berry' } });
    expect(advanceTime(dark, 1).lastWolf).toEqual({ day: 12, took: 'nothing' });
  });

  it('visits once per night', () => {
    let state: GameState = { ...dark, inventory: { ...dark.inventory, trailFood: 3 } };
    for (let i = 0; i < 20; i++) state = advanceTime(state, 0.5);
    expect(state.inventory.trailFood).toBe(2);
  });

  it('comes when the fire goes out, not before, and only in winter', () => {
    // Ten seconds of fuel burns at double rate: 4 s are left after 3 s, and it is out by 5 s.
    expect(advanceTime({ ...dark, fireFuel: 10 }, 3).lastWolf).toBeNull();
    expect(advanceTime({ ...dark, fireFuel: 10 }, 6).lastWolf?.day).toBe(12);
    expect(advanceTime({ ...dark, day: 8, timeOfDay: nightStart(8) + 5 }, 1).lastWolf).toBeNull();
    expect(advanceTime({ ...dark, timeOfDay: nightStart(12) - 5 }, 4).lastWolf).toBeNull();
  });

  it('comes again on a later night', () => {
    const visited: GameState = { ...dark, lastWolf: { day: 11, took: 'nothing' } };
    expect(advanceTime(visited, 1).lastWolf?.day).toBe(12);
  });

  it('gathers close while the fire is low on a winter night', () => {
    expect(wolvesClose({ ...dark, fireFuel: 19 })).toBe(true);
    expect(wolvesClose({ ...dark, fireFuel: 20 })).toBe(false);
    expect(wolvesClose({ ...dark, timeOfDay: 10 })).toBe(false);
    expect(wolvesClose({ ...dark, day: 8, timeOfDay: nightStart(8) + 5 })).toBe(false);
  });

  it('says what the wolf took, once', () => {
    const after = advanceTime({ ...dark, inventory: { ...dark.inventory, trailFood: 1 } }, 1);
    expect(wolfMessage(dark, after)).toBe('A wolf slipped into the dark camp and took a ration.');
    expect(wolfMessage(after, advanceTime(after, 1))).toBeNull();
    expect(wolfMessage(dark, advanceTime({ ...dark, inventory: { ...dark.inventory, food: 1 } }, 1)))
      .toBe('A wolf slipped into the dark camp and took a berry.');
    expect(wolfMessage(dark, advanceTime(dark, 1))).toBe('A wolf circled the dark camp but found nothing to take.');
  });

  it('tells of the wolf after sleeping', () => {
    const evening: GameState = { ...dark, fireFuel: 30, inventory: { ...dark.inventory, trailFood: 1 } };
    const slept = applyAction(evening, { type: 'sleep' }).state;
    expect(slept.day).toBe(13);
    expect(slept.inventory.trailFood).toBe(0);
    expect(wolfMessage(evening, slept)).toBe('A wolf slipped into the dark camp and took a ration.');
  });

  it('shows tracks until the next nightfall', () => {
    const visit = { day: 20, took: 'nothing' as const };
    expect(wolfTracksShown({ ...dark, day: 20, timeOfDay: 230, lastWolf: visit })).toBe(true);
    expect(wolfTracksShown({ ...dark, day: 21, timeOfDay: 10, lastWolf: visit })).toBe(true);
    expect(wolfTracksShown({ ...dark, day: 21, timeOfDay: nightStart(21), lastWolf: visit })).toBe(false);
    expect(wolfTracksShown({ ...dark, day: 22, timeOfDay: 10, lastWolf: visit })).toBe(false);
    expect(wolfTracksShown({ ...dark, lastWolf: null })).toBe(false);
  });
});

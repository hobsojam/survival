import { describe, expect, it } from 'vitest';
import { nightStart } from '../src/game/calendar';
import { createGame, type GameState } from '../src/game/state';
import { advanceTime, applyAction } from '../src/game/rules';
import { findDue, offerBlocker, offerFor } from '../src/game/companion';
import { foxAt } from '../src/game/wildlife';
import { wolfMessage } from '../src/game/wolves';

const base = createGame();
/** Beside the berry bush at (19, 13), inside the camp ring, with the cold front long behind. */
const camp = (day: number, timeOfDay: number, inventory: Partial<GameState['inventory']> = {}): GameState => ({
  ...base, day, timeOfDay,
  player: { ...base.player, x: 19, y: 14 },
  inventory: { ...base.inventory, ...inventory },
  structures: { ...base.structures, shelter: true },
  progress: { ...base.progress, hearthUnlocked: true, nextStormDay: null }
});
const offer = (state: GameState) => applyAction(state, { type: 'befriend' });
/** The same state on another day at the same time, keeping its companion. */
const later = (state: GameState, day: number): GameState => ({ ...state, day });

describe('befriending', () => {
  it('offers a berry to the birds by a bush on a spring day', () => {
    const spring = camp(22, 60, { food: 1 });
    expect(offerFor(spring)).toBe('bird');
    expect(offerBlocker(spring)).toBeNull();
    const result = offer(spring);
    expect(result.state.inventory.food).toBe(0);
    expect(result.state.companion.trust.bird).toBe(1);
    expect(result.message).toBe('The birds peck at the berry. One lingers a moment longer.');
    const again = { ...result.state, inventory: { ...result.state.inventory, food: 1 } };
    expect(offerFor(again)).toBeNull();
    expect(offerBlocker(again)).toBe('You have already left something out today.');
    expect(offerFor(camp(12, 60, { food: 1 }))).toBeNull();
  });

  it('befriends the bird on the fifth day', () => {
    let state = camp(22, 60, { food: 5 });
    let message = '';
    for (const day of [22, 23, 24, 25, 26]) ({ state, message } = offer(later(state, day)));
    expect(state.companion).toMatchObject({ friend: 'bird', since: 26 });
    expect(message).toBe('A little bird has decided to stay.');
    const stocked = { ...state, inventory: { ...state.inventory, food: 2, trailFood: 1 } };
    expect(offerFor(later(stocked, 27))).toBeNull();
    expect(offerFor({ ...later(stocked, 1), timeOfDay: nightStart(1) - 5 })).toBeNull();
    expect(offerFor({ ...later(stocked, 12), timeOfDay: nightStart(12) + 5 })).toBeNull();
  });

  it('lets the fox take precedence when both could be offered', () => {
    const dusk = camp(1, nightStart(1) - 5, { food: 1 });
    expect(foxAt(1, dusk.timeOfDay)?.sitting).toBe(true);
    expect(offerFor(dusk)).toBe('fox');
    const result = offer(dusk);
    expect(result.state.companion.trust).toEqual({ bird: 0, fox: 1, wolf: 0 });
    expect(result.message).toBe('The fox takes the berry, and watches you a while.');
  });

  it('leaves a ration for the wolves on any winter night, fire lit or not', () => {
    const night = { ...camp(12, nightStart(12) + 5, { trailFood: 1 }), player: { ...base.player, x: 20, y: 16 }, fireFuel: 100 };
    expect(offerFor(night)).toBe('wolf');
    const result = offer(night);
    expect(result.state.inventory.trailFood).toBe(0);
    expect(result.state.lastWolf).toEqual({ day: 12, took: 'offered' });
    expect(result.message).toBe('Something takes the ration from the edge of the firelight.');
    expect(wolfMessage(night, result.state)).toBeNull();
    const dark = advanceTime({ ...result.state, fireFuel: 0, inventory: { ...result.state.inventory, food: 2 } }, 2);
    expect(dark.inventory.food).toBe(2);
    expect(dark.lastWolf).toEqual({ day: 12, took: 'offered' });
  });

  it('never offers from the quarry or with nothing to give', () => {
    const spring = camp(22, 60, { food: 1 });
    expect(offerFor({ ...spring, area: 'quarry' })).toBeNull();
    expect(offerFor({ ...spring, inventory: base.inventory })).toBeNull();
    expect(offerFor({ ...spring, player: { ...spring.player, x: 5, y: 25 } })).toBeNull();
    expect(offerBlocker({ ...spring, inventory: base.inventory })).toBe('Nothing here wants an offering right now.');
    const refused = offer({ ...spring, inventory: base.inventory });
    expect(refused.state.companion.trust.bird).toBe(0);
  });

  it('decides finds by the day, at most every third dawn', () => {
    expect(findDue(5, 4, 0)).toBe(false);
    expect(findDue(6, 4, 0)).toBe(false);
    const due = Array.from({ length: 400 }, (_, i) => findDue(i + 4, i + 1, 0)).filter(Boolean).length;
    expect(due / 400).toBeGreaterThan(0.4);
    expect(due / 400).toBeLessThan(0.6);
    expect(Array.from({ length: 50 }, (_, i) => findDue(i + 9, i, 50))).toEqual(Array.from({ length: 50 }, (_, i) => findDue(i + 9, i, 50)));
  });
});

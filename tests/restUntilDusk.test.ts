import { describe, expect, it } from 'vitest';
import { createGame, type GameState } from '../src/game/state';
import { nightStart } from '../src/game/calendar';
import { foxAt } from '../src/game/wildlife';
import { traderSpot } from '../src/game/market';
import { isRaining } from '../src/game/rain';
import { applyAction } from '../src/game/rules';
import { restUntilDusk, restUntilDuskBlocker, restUntilDuskPreview } from '../src/game/restUntilDusk';

const home = (day = 11, timeOfDay = 0): GameState => {
  const state = createGame();
  state.day = day;
  state.timeOfDay = timeOfDay;
  state.structures.shelter = true;
  state.fireFuel = 220;
  return state;
};

describe('rest until dusk', () => {
  it('stops exactly at nightfall and grants only proportional recovery for a short final rest', () => {
    const state = home(12, nightStart(12) - 5);
    state.player.energy = 0;
    const result = restUntilDusk(state);
    expect(result.stop).toBe('nightfall');
    expect(result.state.day).toBe(12);
    expect(result.state.timeOfDay).toBe(nightStart(12));
    expect(result.state.player.energy).toBeCloseTo(6.25);
    expect(result.state.player.hunger).toBeCloseTo(99.375);
    expect(result.state.fireFuel).toBeCloseTo(215);
    expect(applyAction(result.state, { type: 'sleep' }).state.day).toBe(13);
    expect(state.timeOfDay).toBe(nightStart(12) - 5);
  });

  it('preserves normal Rest costs and recovery over full portions', () => {
    const state = home(11, nightStart(11) - 40);
    state.player.energy = 30;
    const once = applyAction(state, { type: 'rest' }).state;
    const twice = applyAction(once, { type: 'rest' }).state;
    const result = restUntilDusk(state);
    expect(result.stop).toBe('nightfall');
    expect(result.state.timeOfDay).toBe(nightStart(11));
    expect(result.state.player.hunger).toBeCloseTo(twice.player.hunger);
    expect(result.state.player.warmth).toBeCloseTo(twice.player.warmth);
    expect(result.state.fireFuel).toBeCloseTo(twice.fireFuel);
    expect(result.state.player.energy).toBeCloseTo(twice.player.energy);
  });

  it('blocks night, away, and unsheltered starts without advancing time', () => {
    const night = home(11, nightStart(11));
    expect(restUntilDuskBlocker(night)).toMatch(/night/i);
    expect(restUntilDusk(night)).toMatchObject({ state: night, stop: 'blocked' });
    const away = home();
    away.player.x = 0;
    expect(restUntilDuskBlocker(away)).toMatch(/fire/i);
    expect(restUntilDusk(away)).toMatchObject({ state: away, stop: 'blocked' });
    const unsheltered = home();
    unsheltered.structures.shelter = false;
    expect(restUntilDuskBlocker(unsheltered)).toMatch(/shelter/i);
    expect(restUntilDusk(unsheltered)).toMatchObject({ state: unsheltered, stop: 'blocked' });
  });

  it('does not pass a quiet day when hunger is already low', () => {
    const state = home();
    state.player.hunger = 20;
    const result = restUntilDusk(state);
    expect(result.stop).toBe('need');
    expect(result.state).toBe(state);
    expect(result.message).toMatch(/hungry|hunger/i);
  });

  it('stops when hunger first reaches the low band', () => {
    const state = home();
    state.player.hunger = 21;
    const result = restUntilDusk(state);
    expect(result.stop).toBe('need');
    expect(result.state.timeOfDay).toBe(8);
    expect(result.state.player.hunger).toBeCloseTo(20);
    expect(result.message).toMatch(/hunger|hungry/i);
  });

  it('stops when the warming fire goes out', () => {
    const state = home();
    state.fireFuel = 5;
    const result = restUntilDusk(state);
    expect(result.stop).toBe('need');
    expect(result.state.timeOfDay).toBe(5);
    expect(result.state.fireFuel).toBe(0);
    expect(result.message).toMatch(/fire/i);
  });

  it('interrupts as a spring shower begins and preserves its notice', () => {
    const state = home(22, 25);
    const result = restUntilDusk(state);
    expect(result.stop).toBe('event');
    expect(result.state.timeOfDay).toBe(30);
    expect(isRaining(result.state)).toBe(true);
    expect(result.notices).toContain('Rain is coming in.');
  });

  it('interrupts while an arriving fox can still be seen', () => {
    const state = home(12, nightStart(12) - 21);
    const result = restUntilDusk(state);
    expect(result.stop).toBe('event');
    expect(result.state.timeOfDay).toBe(nightStart(12) - 20);
    expect(foxAt(12, result.state.timeOfDay)).not.toBeNull();
  });

  it('interrupts as a market trader arrives', () => {
    const state = home(13, 7);
    state.town.market.openDay = 11;
    const result = restUntilDusk(state);
    expect(result.stop).toBe('event');
    expect(result.state.timeOfDay).toBe(8);
    expect(traderSpot(result.state, 'spice')).not.toBeNull();
  });

  it('counts a warm rest toward sickness care and keeps the input untouched', () => {
    const state = home(11, nightStart(11) - 5);
    state.sickness = { starvedSeconds: 0, sick: true, sickFromDay: 10, cared: 0, uncared: 0, ateWarm: false, restedWarm: false };
    const before = structuredClone(state);
    const result = restUntilDusk(state);
    expect(result.state.sickness.restedWarm).toBe(true);
    expect(state).toEqual(before);
  });
});


describe('rest until dusk preview', () => {
  it('projects the same uneventful endpoint without changing the live state', () => {
    const state = home(11, nightStart(11) - 5);
    const before = structuredClone(state);
    const preview = restUntilDuskPreview(state);
    const actual = restUntilDusk(state).state;
    expect(preview.seconds).toBe(5);
    expect(preview.hunger).toBeCloseTo(actual.player.hunger);
    expect(preview.warmth).toBeCloseTo(actual.player.warmth);
    expect(preview.fuel).toBeCloseTo(actual.fireFuel);
    expect(state).toEqual(before);
  });

  it('warns when a long rest would exhaust hunger or the campfire', () => {
    const hungry = home();
    hungry.player.hunger = 21;
    expect(restUntilDuskPreview(hungry).warning).toMatch(/hunger|hungry/i);
    const unlit = home();
    unlit.fireFuel = 5;
    expect(restUntilDuskPreview(unlit).warning).toMatch(/fire/i);
  });

  it('warns that a visitor already present may leave', () => {
    const state = home(12, nightStart(12) - 19);
    expect(foxAt(12, state.timeOfDay)).not.toBeNull();
    expect(restUntilDuskPreview(state).visitorWarning).toBe(true);
  });
});

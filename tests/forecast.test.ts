import { describe, expect, it } from 'vitest';
import { nightStart } from '../src/game/calendar';
import { BALANCE, createGame, type GameState } from '../src/game/state';
import { forecastFireCheck, logsForColdNight, stormReadiness } from '../src/game/forecast';

const NIGHT_NEED = (BALANCE.daySeconds - nightStart(3)) * BALANCE.coldNightFireBurn;

function stormDay(timeOfDay: number): GameState {
  const state = createGame();
  state.day = state.progress.nextStormDay!;
  state.timeOfDay = timeOfDay;
  return state;
}

describe('stormReadiness', () => {
  it('does not count a noon stoke that will burn away before nightfall', () => {
    const state = stormDay(100);
    state.fireFuel = 170;
    const readiness = stormReadiness(state);
    expect(readiness.fuel).toBe(170 - (nightStart(3) - 100));
    expect(readiness.needed).toBe(NIGHT_NEED);
    expect(readiness.ready).toBe(false);
    expect(forecastFireCheck(state)).toMatch(/^○/);
  });

  it('does not count carried logs as firepit fuel when the fire is unlit', () => {
    const state = stormDay(100);
    state.fireFuel = 0;
    state.inventory.wood = 2;
    expect(stormReadiness(state)).toMatchObject({ fuel: 0, ready: false, logsShort: 0 });
    expect(forecastFireCheck(state)).toBe(`○ Fire: 0 / ${NIGHT_NEED}s for the night · add carried wood at nightfall`);
  });

  it('counts only firepit fuel on days before the storm', () => {
    const state = createGame();
    state.day = state.progress.nextStormDay! - 1;
    state.fireFuel = 500;
    state.inventory.wood = 1;
    expect(stormReadiness(state)).toMatchObject({ fuel: 0, ready: false, logsShort: 1 });
    expect(forecastFireCheck(state)).toBe(`○ Fire: 0 / ${NIGHT_NEED}s for the night · 1 more log`);
  });

  it('during the storm, compares the fire with what is left until dawn and suggests a log', () => {
    const state = stormDay(200);
    state.fireFuel = 60;
    expect(stormReadiness(state)).toMatchObject({ fuel: 60, needed: 80, ready: false, logsShort: 1 });
    expect(forecastFireCheck(state)).toBe('○ Fire: 60 / 80s to dawn · 1 more log');
    state.inventory.wood = 1;
    expect(forecastFireCheck(state)).toBe('○ Fire: 60 / 80s to dawn · add carried wood to the fire');
    state.fireFuel = 81;
    expect(forecastFireCheck(state)).toBe('✓ Fire: 81 / 80s to dawn');
  });

  it('values each log at the hearth rate once a hearth is built', () => {
    const state = stormDay(100);
    state.structures.hearth = true;
    state.inventory.wood = 1;
    expect(stormReadiness(state).fuel).toBe(0);
    // One hearth log (150 s) covers day three's 132 s of double burn; a plain log does not.
    expect(stormReadiness(state).logsShort).toBe(0);
    state.structures.hearth = false;
    expect(stormReadiness(state).logsShort).toBeGreaterThan(0);
  });
});

describe('the forecast with the autumn day length', () => {
  it('needs enough fire for day three’s night, which starts at 174', () => {
    expect(stormReadiness(stormDay(100)).needed).toBe((240 - 174) * 2);
  });
});

describe('logs for a cold night', () => {
  it('asks for two logs on day three and three once nights lengthen', () => {
    expect(logsForColdNight(3)).toBe(2);
    expect(logsForColdNight(9)).toBe(3);
    for (let day = 1; day <= 40; day++) expect([2, 3]).toContain(logsForColdNight(day));
  });
});

import { describe, expect, it } from 'vitest';
import { RABBIT_HOMES, createGame, type GameState } from '../src/game/state';
import { advanceTime, applyAction, type GameAction } from '../src/game/rules';
import { nightStart } from '../src/game/calendar';
import { recordJournal, type JournalId } from '../src/game/journalEntries';

const base = createGame();
const at = (day: number, timeOfDay: number, extra: Partial<GameState> = {}): GameState => ({ ...base, day, timeOfDay, ...extra });
const tick = (state: GameState, seconds = 1) => recordJournal(state, advanceTime(state, seconds));
const act = (state: GameState, action: GameAction) => recordJournal(state, applyAction(state, action).state, action);
const ids = (state: GameState): JournalId[] => state.journal.map(entry => entry.id);
const sheltered = (day: number, timeOfDay: number, fireFuel: number): GameState =>
  at(day, timeOfDay, { fireFuel, structures: { ...base.structures, shelter: true } });

describe('the year journal', () => {
  it('writes the first leaves of autumn once, with the day', () => {
    const first = tick(at(1, 10));
    expect(first.state.journal).toEqual([{ year: 1, id: 'leaves', day: 1, variant: 0 }]);
    expect(first.messages).toEqual(['Written in your journal: The first leaves came down over camp.']);
    const again = recordJournal(first.state, first.state);
    expect(again.state).toBe(first.state);
    expect(again.messages).toEqual([]);
  });

  it('keeps each season to its own page', () => {
    const night = at(12, nightStart(12) + 5, { fireFuel: 100, progress: { ...base.progress, nextStormDay: null, hearthUnlocked: true } });
    expect(act(night, { type: 'stargaze' }).state.journal).toEqual([]);
  });

  it('records how the cold front went, even asleep', () => {
    const kept = act(sheltered(3, nightStart(3) + 1, 300), { type: 'sleep' }).state;
    expect(kept.journal.find(entry => entry.id === 'coldFront')).toEqual({ year: 1, id: 'coldFront', day: 3, variant: 0 });
    const lost = act(sheltered(3, nightStart(3) + 1, 0), { type: 'sleep' }).state;
    expect(lost.journal.find(entry => entry.id === 'coldFront')?.variant).toBe(1);
  });

  it('stays silent for moments already announced', () => {
    const snow = act({ ...sheltered(10, nightStart(10) + 1, 0), progress: { ...base.progress, nextStormDay: null, hearthUnlocked: true } }, { type: 'sleep' });
    expect(ids(snow.state)).toContain('firstSnow');
    expect(snow.messages.some(text => text.includes('Snow'))).toBe(false);
    const rain = tick(at(22, 29.5), 1);
    expect(ids(rain.state)).toContain('firstRain');
    expect(rain.messages.some(text => text.includes('rain'))).toBe(false);
  });

  it('notices a whole winter night by the fire', () => {
    const night = at(12, 239.5, { fireFuel: 50 });
    expect(ids(tick(night).state)).toContain('winterFire');
    expect(ids(tick({ ...night, lastWolf: { day: 12, took: 'nothing' } }).state)).not.toContain('winterFire');
  });

  it('writes summer evenings during a timed action', () => {
    const rested = act(at(34, nightStart(34) - 2), { type: 'rest' });
    expect(ids(rested.state)).toContain('goldEvening');
  });

  it('writes a warm summer sleep on the last night of the year', () => {
    const woke = act(sheltered(40, nightStart(40) + 1, 0), { type: 'sleep' }).state;
    expect(woke.day).toBe(41);
    expect(woke.journal).toContainEqual({ year: 1, id: 'warmSleep', day: 40, variant: 0 });
    expect(ids(woke)).not.toContain('fireflies');
    expect(tick(woke).state.journal).toContainEqual({ year: 2, id: 'leaves', day: 41, variant: 0 });
  });

  it('finds the rabbits near their homes in spring daylight', () => {
    const home = RABBIT_HOMES[0];
    expect(ids(tick(at(21, 60, { player: { ...base.player, x: home.x, y: home.y } })).state)).toContain('rabbits');
    expect(ids(tick(at(21, 60, { player: { ...base.player, x: 2, y: 2 } })).state)).not.toContain('rabbits');
  });

  it('never changes the game', () => {
    const before = at(1, 10);
    const after = advanceTime(before, 1);
    const written = recordJournal(before, after).state;
    expect({ ...written, journal: after.journal }).toEqual(after);
  });
});

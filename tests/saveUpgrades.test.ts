import { describe, expect, it } from 'vitest';
import { createGame } from '../src/game/state';
import { loadGame, saveGame, SAVE_KEY, SAVE_VERSION } from '../src/game/save';
import { OLDEST_UPGRADABLE_VERSION, SAVE_UPGRADES, upgradeSave, type SaveUpgrade } from '../src/game/saveUpgrades';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
}

type Shape = Record<string, number>;
const STEPS: Record<number, SaveUpgrade> = {
  23: state => ({ ...(state as Shape), a: 1 }),
  24: state => ({ ...(state as Shape), b: (state as Shape).a + 1 })
};

describe('upgrading a save', () => {
  it('keeps a save already in the current version as it is', () => {
    const state = { day: 4 };
    expect(upgradeSave(23, state, 23, {})).toEqual({ ok: true, state });
  });

  it('runs every step from the save\'s version up to the current one, in order', () => {
    expect(upgradeSave(23, {}, 25, STEPS)).toEqual({ ok: true, state: { a: 1, b: 2 } });
    expect(upgradeSave(24, { a: 5 }, 25, STEPS)).toEqual({ ok: true, state: { a: 5, b: 6 } });
  });

  it('refuses older and newer saves, and versions that are not whole numbers', () => {
    expect(upgradeSave(22, {}, 25, STEPS)).toEqual({ ok: false, reason: 'This save is from an older version of the game.' });
    expect(upgradeSave(26, {}, 25, STEPS)).toEqual({ ok: false, reason: 'This save is from a newer version of the game.' });
    for (const version of ['23', 23.5, null, undefined]) {
      expect(upgradeSave(version, {}, 25, STEPS), String(version)).toEqual({ ok: false, reason: 'This save uses an unsupported version.' });
    }
  });

  it('refuses a save it has no step for, or whose step fails', () => {
    expect(upgradeSave(23, {}, 25, { 23: STEPS[23] })).toEqual({ ok: false, reason: 'This save could not be brought up to date.' });
    const broken = { 23: () => { throw new Error('odd data'); } };
    expect(upgradeSave(23, {}, 24, broken)).toEqual({ ok: false, reason: 'This save could not be brought up to date.' });
  });

  it('never changes the save it was given, even when a step fails halfway', () => {
    const original = { day: 4 };
    const meddling = { 23: (state: unknown) => { (state as Shape).x = 1; throw new Error('halfway'); } };
    upgradeSave(23, original, 24, meddling);
    expect(original).toEqual({ day: 4 });
    upgradeSave(23, original, 25, STEPS);
    expect(original).toEqual({ day: 4 });
  });

  it('has exactly one step for every version from 23 up to the current one', () => {
    expect(OLDEST_UPGRADABLE_VERSION).toBe(23);
    const expected = Array.from({ length: SAVE_VERSION - OLDEST_UPGRADABLE_VERSION }, (_, index) => String(OLDEST_UPGRADABLE_VERSION + index));
    expect(Object.keys(SAVE_UPGRADES).sort((a, b) => Number(a) - Number(b))).toEqual(expected);
  });
});

describe('loading through the upgrades', () => {
  const stored = (version: unknown, state: unknown = createGame()) => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ version, state }));
    return loadGame(storage);
  };

  it('refuses an older save and a newer one with their own reasons', () => {
    expect(stored(22)).toEqual({ kind: 'invalid', reason: 'This save is from an older version of the game.' });
    expect(stored(SAVE_VERSION + 1)).toEqual({ kind: 'invalid', reason: 'This save is from a newer version of the game.' });
    expect(stored('23')).toEqual({ kind: 'invalid', reason: 'This save uses an unsupported version.' });
  });

  it('still loads a current save', () => {
    const storage = new MemoryStorage();
    expect(saveGame(storage, createGame()).ok).toBe(true);
    expect(loadGame(storage).kind).toBe('loaded');
  });
});

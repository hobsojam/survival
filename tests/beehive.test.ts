import { describe, expect, it } from 'vitest';
import { BALANCE, BUILDINGS, createGame, type GameState } from '../src/game/state';
import { loadGame, SAVE_KEY, SAVE_VERSION } from '../src/game/save';
import { beehiveCamp } from './beehiveCamp';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
}

/** Saves a state and loads it back, as the game would. */
function roundTrip(state: GameState) {
  const storage = new MemoryStorage();
  storage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state }));
  return loadGame(storage);
}

describe('the beehive to begin with', () => {
  it('starts unbuilt and empty, on the north far ground, for 4 wood and 6 fiber', () => {
    const game = createGame();
    expect(game.structures.beehive).toBe(false);
    expect(game.beehive).toEqual({ honey: 0, nextHoney: null });
    expect(BUILDINGS.beehive).toEqual({ name: 'Beehive', description: 'Keep bees for honey all year', symbol: '❀', cost: { wood: 4, fiber: 6 }, prerequisite: null, ground: 'north-far' });
    expect([BALANCE.hiveHoneyCapacity, BALANCE.hiveHoneyDays]).toEqual([2, 3]);
  });
});

describe('saving the beehive', () => {
  it('saves and loads the honey waiting and the next honey day', () => {
    const loaded = roundTrip(beehiveCamp({ honey: 2, nextHoney: 25 }));
    expect(loaded.kind === 'loaded' && loaded.state.beehive).toEqual({ honey: 2, nextHoney: 25 });
  });

  it('refuses too much or part honey, honey or a honey day without a hive, a hive with no honey day, and a hive on uncleared ground', () => {
    const uncleared = beehiveCamp();
    const bad: GameState[] = [
      beehiveCamp({ honey: 3 }),
      beehiveCamp({ honey: 1.5 }),
      beehiveCamp({ honey: -1 }),
      beehiveCamp({ built: false, honey: 1 }),
      beehiveCamp({ built: false, nextHoney: 25 }),
      beehiveCamp({ nextHoney: null }),
      beehiveCamp({ nextHoney: 2.5 }),
      { ...uncleared, clearing: { ...uncleared.clearing, cleared: ['north-near'] } }
    ];
    for (const state of bad) expect(roundTrip(state).kind, JSON.stringify(state.beehive)).toBe('invalid');
  });
});

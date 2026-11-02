import { describe, expect, it } from 'vitest';
import { BALANCE, BUILDINGS, createGame, type GameState } from '../src/game/state';
import { loadGame, SAVE_KEY, SAVE_VERSION } from '../src/game/save';
import { groundBlocker } from '../src/game/rules';
import { bakehouseCamp } from './bakehouseCamp';

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

describe('the windmill and bakery to begin with', () => {
  it('starts with neither built, an empty flour bin and a bare shelf', () => {
    const game = createGame();
    expect(game.structures).toMatchObject({ windmill: false, bakery: false });
    expect(game.millFlour).toBe(0);
    expect(game.bakery).toEqual({ shelf: [], lastBaked: null });
    expect(BALANCE).toMatchObject({ millFlourCapacity: 8, bakeryShelfCapacity: 2 });
  });

  it('builds the windmill after the granary on the south nook, and the bakery after the windmill on the north nook', () => {
    expect(BUILDINGS.windmill).toMatchObject({ name: 'Windmill', cost: { wood: 12, fiber: 4, stone: 10 }, prerequisite: 'granary', ground: 'south-outer' });
    expect(BUILDINGS.bakery).toMatchObject({ name: 'Bakery', cost: { wood: 10, fiber: 2, stone: 10 }, prerequisite: 'windmill', ground: 'north-outer' });
    expect(groundBlocker(createGame(), 'windmill')).toBe('Clear the south side\'s outer ground first.');
  });
});

describe('saving the windmill and bakery', () => {
  it('saves and loads flour in the bin and loaves on the shelf', () => {
    const state = bakehouseCamp({ millFlour: 8, shelf: [21, 22], lastBaked: 22 });
    const loaded = roundTrip(state);
    expect(loaded.kind).toBe('loaded');
    expect(loaded.kind === 'loaded' && [loaded.state.millFlour, loaded.state.bakery]).toEqual([8, { shelf: [21, 22], lastBaked: 22 }]);
  });

  it('refuses mill flour without a windmill or beyond the bin, and a windmill on uncleared ground', () => {
    const noMill = bakehouseCamp({ windmill: false, millFlour: 1 });
    const unground = bakehouseCamp();
    const bad: GameState[] = [
      noMill,
      bakehouseCamp({ millFlour: 9 }),
      bakehouseCamp({ millFlour: -1 }),
      { ...unground, clearing: { ...unground.clearing, cleared: unground.clearing.cleared.filter(id => id !== 'south-outer') }, structures: { ...unground.structures, bakery: false } }
    ];
    for (const state of bad) expect(roundTrip(state).kind).toBe('invalid');
  });

  it('refuses a shelf without a bakery, more than two loaves, a loaf from tomorrow, or a bake after today', () => {
    const bad: GameState[] = [
      bakehouseCamp({ bakery: false, shelf: [22] }),
      bakehouseCamp({ bakery: false, lastBaked: 22 }),
      bakehouseCamp({ shelf: [20, 21, 22] }),
      bakehouseCamp({ shelf: [23] }),
      bakehouseCamp({ lastBaked: 23 }),
      bakehouseCamp({ shelf: [1.5] })
    ];
    for (const state of bad) expect(roundTrip(state).kind).toBe('invalid');
  });
});

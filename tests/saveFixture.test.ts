// save-v23.json is a frozen save from version 23. Never edit or regenerate it: it proves old camps keep loading.
// When the save format changes, add an upgrade step in src/game/saveUpgrades.ts until this file loads again.
import { describe, expect, it } from 'vitest';
import type { GameState } from '../src/game/state';
import { loadGame, saveGame, SAVE_KEY, SAVE_VERSION } from '../src/game/save';
import { OLDEST_UPGRADABLE_VERSION } from '../src/game/saveUpgrades';
// Read as the exact text that was saved, the way a browser would hand it back from local storage.
import FIXTURE from './fixtures/save-v23.json?raw';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
}

const frozen = JSON.parse(FIXTURE) as { version: number; state: GameState };

function load(raw: string = FIXTURE) {
  const storage = new MemoryStorage();
  storage.setItem(SAVE_KEY, raw);
  return loadGame(storage);
}

function loaded(): GameState {
  const result = load();
  if (result.kind !== 'loaded') throw new Error(`The frozen save did not load: ${result.kind === 'invalid' ? result.reason : result.kind}`);
  return result.state;
}

describe('the frozen version 23 save', () => {
  it('is still the version 23 save it was frozen as, from a well-grown camp', () => {
    expect(frozen.version).toBe(OLDEST_UPGRADABLE_VERSION);
    expect(frozen.state.day).toBeGreaterThanOrEqual(45);
    expect(frozen.state.structures).toMatchObject({ house: true, vegetableBeds: true, well: true, workshop: true });
    expect(frozen.state.companion.friend).toBe('fox');
  });

  it('loads', () => {
    expect(load().kind).toBe('loaded');
  });

  it('keeps the camp as it was, field by field', () => {
    const state = loaded();
    const was = frozen.state;
    expect(state.day).toBe(was.day);
    expect(state.player).toEqual(was.player);
    expect(state.inventory).toEqual(was.inventory);
    const built = (structures: GameState['structures']) => Object.entries(structures).filter(([, up]) => up).map(([id]) => id);
    expect(built(state.structures)).toEqual(expect.arrayContaining(built(was.structures)));
    expect(state.progress.workshop).toEqual(was.progress.workshop);
    expect({ cartWood: state.cartWood, storedWood: state.storedWood, storedStone: state.storedStone, storedFiber: state.storedFiber })
      .toEqual({ cartWood: was.cartWood, storedWood: was.storedWood, storedStone: was.storedStone, storedFiber: was.storedFiber });
    expect(state.larder).toEqual(was.larder);
    expect(state.beds).toEqual(was.beds);
    expect({ friend: state.companion.friend, cloak: state.companion.cloak }).toEqual({ friend: was.companion.friend, cloak: was.companion.cloak });
    expect(state.journal.map(entry => `${entry.year}:${entry.id}`)).toEqual(was.journal.map(entry => `${entry.year}:${entry.id}`));
  });

  it('saves again in the current format', () => {
    const storage = new MemoryStorage();
    expect(saveGame(storage, loaded()).ok).toBe(true);
    expect(JSON.parse(storage.getItem(SAVE_KEY)!).version).toBe(SAVE_VERSION);
  });

  it('would notice a camp that no longer loads', () => {
    const tampered = { ...frozen, state: { ...frozen.state, cartWood: 13 } };
    expect(load(JSON.stringify(tampered)).kind).toBe('invalid');
  });
});

import { describe, expect, it } from 'vitest';
import { createGame } from '../src/game/state';
import { loadGame, saveGame, SAVE_KEY } from '../src/game/save';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
}

describe('local save', () => {
  it('round-trips progression across a page reload', () => {
    const storage = new MemoryStorage();
    const state = createGame();
    state.day = 3;
    state.timeOfDay = 92;
    state.player.x = 7.5;
    state.player.y = 11.25;
    state.inventory.wood = 5;
    state.inventory.food = 2;
    state.inventory.fiber = 1;
    state.fireFuel = 43;
    state.structures.shelter = true;
    state.structures.crate = true;
    state.nodes[0].amount = 0;
    state.nodes[0].readyDay = 4;
    state.nodes.find(node => node.kind === 'fiber')!.amount = 0;
    state.nodes.find(node => node.kind === 'fiber')!.readyDay = 4;
    expect(saveGame(storage, state).ok).toBe(true);
    expect(JSON.parse(storage.getItem(SAVE_KEY)!).version).toBe(3);
    const loaded = loadGame(storage);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind === 'loaded') expect(loaded.state).toEqual(state);
  });

  it('reports no save when storage is empty', () => {
    expect(loadGame(new MemoryStorage()).kind).toBe('empty');
  });

  it('rejects malformed JSON without overwriting it', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, '{broken');
    expect(loadGame(storage).kind).toBe('invalid');
    expect(storage.getItem(SAVE_KEY)).toBe('{broken');
  });

  it('migrates a valid version one save on a later day without overwriting it', () => {
    const storage = new MemoryStorage();
    const legacy = JSON.parse(JSON.stringify(createGame()));
    legacy.day = 8;
    legacy.timeOfDay = 105;
    legacy.inventory.wood = 3;
    legacy.structures.shelter = true;
    delete legacy.inventory.fiber;
    legacy.nodes = legacy.nodes.filter((node: { kind: string }) => node.kind !== 'fiber');
    delete legacy.progress;
    delete legacy.structures.hearth;
    const raw = JSON.stringify({ version: 1, state: legacy });
    storage.setItem(SAVE_KEY, raw);
    const loaded = loadGame(storage);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind === 'loaded') {
      expect(loaded.state.day).toBe(8);
      expect(loaded.state.timeOfDay).toBe(105);
      expect(loaded.state.inventory.wood).toBe(3);
      expect(loaded.state.structures).toEqual({ shelter: true, bed: false, crate: false, hearth: false });
      expect(loaded.state.progress).toEqual({ nextStormDay: 10, hearthUnlocked: false });
    }
    expect(storage.getItem(SAVE_KEY)).toBe(raw);
  });

  it('migrates a version two camp with its gathered nodes intact', () => {
    const storage = new MemoryStorage();
    const old = JSON.parse(JSON.stringify(createGame()));
    delete old.inventory.fiber;
    old.nodes = old.nodes.filter((node: { kind: string }) => node.kind !== 'fiber');
    old.inventory.wood = 4;
    old.nodes[0].amount = 0;
    old.nodes[0].readyDay = 2;
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 2, state: old }));
    const loaded = loadGame(storage);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind === 'loaded') {
      expect(loaded.state.inventory).toEqual({ wood: 4, food: 0, fiber: 0 });
      expect(loaded.state.nodes[0]).toEqual(old.nodes[0]);
      expect(loaded.state.nodes.filter(node => node.kind === 'fiber')).toHaveLength(8);
    }
  });

  it('rejects malformed version one data without rewriting it', () => {
    const storage = new MemoryStorage();
    const legacy = JSON.parse(JSON.stringify(createGame()));
    delete legacy.inventory.fiber;
    legacy.nodes = legacy.nodes.filter((node: { kind: string }) => node.kind !== 'fiber');
    delete legacy.progress;
    delete legacy.structures.hearth;
    legacy.inventory.wood = -1;
    const raw = JSON.stringify({ version: 1, state: legacy });
    storage.setItem(SAVE_KEY, raw);
    expect(loadGame(storage).kind).toBe('invalid');
    expect(storage.getItem(SAVE_KEY)).toBe(raw);
  });

  it('rejects impossible version two progression', () => {
    const storage = new MemoryStorage();
    const state = createGame();
    state.day = 4;
    state.progress.nextStormDay = 3;
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 2, state }));
    expect(loadGame(storage).kind).toBe('invalid');
  });

  it('rejects a version three save whose fiber exceeds the bag capacity', () => {
    const storage = new MemoryStorage();
    const state = createGame();
    state.inventory.wood = 7;
    state.inventory.fiber = 2;
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 3, state }));
    expect(loadGame(storage).kind).toBe('invalid');
  });

  it('rejects an unsupported schema version without overwriting it', () => {
    const storage = new MemoryStorage();
    const raw = JSON.stringify({ version: 99, state: createGame() });
    storage.setItem(SAVE_KEY, raw);
    expect(loadGame(storage).kind).toBe('invalid');
    expect(storage.getItem(SAVE_KEY)).toBe(raw);
  });

  it('rejects invalid state shape before the simulation reads it', () => {
    const storage = new MemoryStorage();
    const state = createGame();
    state.timeOfDay = 240;
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 1, state }));
    expect(loadGame(storage).kind).toBe('invalid');
  });

  it('reports storage write failure without throwing', () => {
    const storage = new MemoryStorage();
    storage.setItem = () => { throw new Error('Quota exceeded'); };
    const result = saveGame(storage, createGame());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Quota exceeded');
  });

  it('reports storage read failure without throwing', () => {
    const storage = new MemoryStorage();
    storage.getItem = () => { throw new Error('Storage blocked'); };
    const result = loadGame(storage);
    expect(result.kind).toBe('invalid');
  });
});

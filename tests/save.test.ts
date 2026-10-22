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

function legacySnapshot(): any {
  const state = JSON.parse(JSON.stringify(createGame()));
  delete state.inventory.stone;
  state.nodes = state.nodes.filter((node: { kind: string }) => node.kind !== 'stone');
  return state;
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
    state.structures.dryingRack = true;
    state.structures.windbreak = true;
    state.nodes[0].amount = 0;
    state.nodes[0].readyDay = 4;
    state.nodes.find(node => node.kind === 'fiber')!.amount = 0;
    state.nodes.find(node => node.kind === 'fiber')!.readyDay = 4;
    expect(saveGame(storage, state).ok).toBe(true);
    expect(JSON.parse(storage.getItem(SAVE_KEY)!).version).toBe(5);
    const loaded = loadGame(storage);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind === 'loaded') expect(loaded.state).toEqual(state);
  });

  it('reports no save when storage is empty', () => {
    expect(loadGame(new MemoryStorage()).kind).toBe('empty');
  });

  it('migrates an existing version four camp with stone nodes available', () => {
    const storage = new MemoryStorage();
    const legacy = legacySnapshot();
    delete legacy.inventory.stone;
    legacy.nodes = legacy.nodes.filter((node: { kind: string }) => node.kind !== 'stone');
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 4, state: legacy }));
    const loaded = loadGame(storage);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind === 'loaded') {
      expect(loaded.state.inventory.stone).toBe(0);
      expect(loaded.state.nodes.filter(node => node.kind === 'stone')).toHaveLength(6);
    }
  });

  it('rejects a version five save with missing or excess stone', () => {
    const storage = new MemoryStorage();
    const state = createGame();
    state.inventory.stone = 9;
    expect(saveGame(storage, state).ok).toBe(false);
    const malformed = JSON.parse(JSON.stringify(createGame()));
    delete malformed.inventory.stone;
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 5, state: malformed }));
    expect(loadGame(storage).kind).toBe('invalid');
  });

  it('rejects malformed JSON without overwriting it', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, '{broken');
    expect(loadGame(storage).kind).toBe('invalid');
    expect(storage.getItem(SAVE_KEY)).toBe('{broken');
  });

  it('migrates a valid version one save on a later day without overwriting it', () => {
    const storage = new MemoryStorage();
    const legacy = legacySnapshot();
    legacy.day = 8;
    legacy.timeOfDay = 105;
    legacy.inventory.wood = 3;
    legacy.structures.shelter = true;
    delete legacy.inventory.fiber;
    legacy.nodes = legacy.nodes.filter((node: { kind: string }) => node.kind !== 'fiber');
    delete legacy.progress;
    delete legacy.structures.hearth;
    delete legacy.structures.dryingRack;
    delete legacy.structures.windbreak;
    const raw = JSON.stringify({ version: 1, state: legacy });
    storage.setItem(SAVE_KEY, raw);
    const loaded = loadGame(storage);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind === 'loaded') {
      expect(loaded.state.day).toBe(8);
      expect(loaded.state.timeOfDay).toBe(105);
      expect(loaded.state.inventory.wood).toBe(3);
      expect(loaded.state.structures).toEqual({ shelter: true, bed: false, crate: false, hearth: false, dryingRack: false, windbreak: false });
      expect(loaded.state.progress).toEqual({ nextStormDay: 10, hearthUnlocked: false });
    }
    expect(storage.getItem(SAVE_KEY)).toBe(raw);
  });

  it('migrates a version two camp with its gathered nodes intact', () => {
    const storage = new MemoryStorage();
    const old = legacySnapshot();
    delete old.inventory.fiber;
    old.nodes = old.nodes.filter((node: { kind: string }) => node.kind !== 'fiber');
    old.inventory.wood = 4;
    old.nodes[0].amount = 0;
    old.nodes[0].readyDay = 2;
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 2, state: old }));
    const loaded = loadGame(storage);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind === 'loaded') {
      expect(loaded.state.inventory).toEqual({ wood: 4, food: 0, fiber: 0, stone: 0 });
      expect(loaded.state.nodes[0]).toEqual(old.nodes[0]);
      expect(loaded.state.nodes.filter(node => node.kind === 'fiber')).toHaveLength(8);
    }
  });

  it('rejects malformed version one data without rewriting it', () => {
    const storage = new MemoryStorage();
    const legacy = legacySnapshot();
    delete legacy.inventory.fiber;
    legacy.nodes = legacy.nodes.filter((node: { kind: string }) => node.kind !== 'fiber');
    delete legacy.progress;
    delete legacy.structures.hearth;
    delete legacy.structures.dryingRack;
    delete legacy.structures.windbreak;
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
    delete (state.inventory as Partial<typeof state.inventory>).fiber;
    state.nodes = state.nodes.filter(node => node.kind !== 'fiber');
    delete (state.structures as Partial<typeof state.structures>).dryingRack;
    delete (state.structures as Partial<typeof state.structures>).windbreak;
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 2, state }));
    expect(loadGame(storage).kind).toBe('invalid');
  });

  it('rejects a version three save whose fiber exceeds the bag capacity', () => {
    const storage = new MemoryStorage();
    const state = legacySnapshot();
    state.inventory.wood = 7;
    state.inventory.fiber = 2;
    delete state.structures.dryingRack;
    delete state.structures.windbreak;
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 3, state }));
    expect(loadGame(storage).kind).toBe('invalid');
  });

  it('migrates a version three camp from main and adds fiber without changing its structures', () => {
    const storage = new MemoryStorage();
    const legacy = legacySnapshot();
    legacy.day = 4;
    legacy.progress.nextStormDay = 6;
    legacy.structures.dryingRack = true;
    legacy.structures.windbreak = true;
    delete legacy.inventory.fiber;
    legacy.nodes = legacy.nodes.filter((node: { kind: string }) => node.kind !== 'fiber');
    const raw = JSON.stringify({ version: 3, state: legacy });
    storage.setItem(SAVE_KEY, raw);
    const loaded = loadGame(storage);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind === 'loaded') {
      expect(loaded.state.inventory.fiber).toBe(0);
      expect(loaded.state.nodes.filter(node => node.kind === 'fiber')).toHaveLength(8);
      expect(loaded.state.structures.dryingRack).toBe(true);
      expect(loaded.state.structures.windbreak).toBe(true);
    }
    expect(storage.getItem(SAVE_KEY)).toBe(raw);
  });

  it('migrates a version three fiber camp and adds the new structures', () => {
    const storage = new MemoryStorage();
    const legacy = legacySnapshot();
    legacy.inventory.fiber = 2;
    legacy.nodes.find((node: { kind: string }) => node.kind === 'fiber').amount = 0;
    delete legacy.structures.dryingRack;
    delete legacy.structures.windbreak;
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 3, state: legacy }));
    const loaded = loadGame(storage);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind === 'loaded') {
      expect(loaded.state.inventory.fiber).toBe(2);
      expect(loaded.state.nodes.find(node => node.kind === 'fiber')?.amount).toBe(0);
      expect(loaded.state.structures.dryingRack).toBe(false);
      expect(loaded.state.structures.windbreak).toBe(false);
    }
  });

  it('migrates a version two camp without changing its cold-night progress or stored data', () => {
    const storage = new MemoryStorage();
    const legacy = legacySnapshot();
    legacy.day = 5;
    legacy.timeOfDay = 95;
    legacy.inventory.wood = 3;
    legacy.structures.hearth = true;
    legacy.progress = { nextStormDay: null, hearthUnlocked: true };
    delete legacy.inventory.fiber;
    legacy.nodes = legacy.nodes.filter((node: { kind: string }) => node.kind !== 'fiber');
    delete legacy.structures.dryingRack;
    delete legacy.structures.windbreak;
    const raw = JSON.stringify({ version: 2, state: legacy });
    storage.setItem(SAVE_KEY, raw);
    const loaded = loadGame(storage);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind === 'loaded') {
      expect(loaded.state.day).toBe(5);
      expect(loaded.state.timeOfDay).toBe(95);
      expect(loaded.state.inventory.wood).toBe(3);
      expect(loaded.state.structures).toEqual({ shelter: false, bed: false, crate: false, hearth: true, dryingRack: false, windbreak: false });
      expect(loaded.state.progress).toEqual({ nextStormDay: null, hearthUnlocked: true });
    }
    expect(storage.getItem(SAVE_KEY)).toBe(raw);
  });

  it('rejects version three data with missing or invalid new structure flags', () => {
    const storage = new MemoryStorage();
    const state = legacySnapshot();
    delete state.inventory.fiber;
    state.nodes = state.nodes.filter((node: { kind: string }) => node.kind !== 'fiber');
    delete state.structures.dryingRack;
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 3, state }));
    expect(loadGame(storage).kind).toBe('invalid');
    const current = createGame();
    (current.structures as unknown as Record<string, unknown>).windbreak = 'yes';
    expect(saveGame(storage, current).ok).toBe(false);
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

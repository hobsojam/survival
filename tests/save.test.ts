import { describe, expect, it } from 'vitest';
import { BALANCE, createGame } from '../src/game/state';
import { autosaveDelayMs, loadGame, saveGame, SAVE_KEY } from '../src/game/save';

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
  it('round trips rations and rejects counts that overfill the bag', () => {
    const storage = new MemoryStorage();
    const state = createGame();
    state.inventory.trailFood = 2;
    expect(saveGame(storage, state).ok).toBe(true);
    expect(loadGame(storage)).toEqual({ kind: 'loaded', state });
    state.inventory.wood = 7;
    expect(saveGame(storage, state).ok).toBe(false);
    state.inventory.wood = 0;
    state.inventory.trailFood = -1;
    expect(saveGame(storage, state).ok).toBe(false);
  });

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
    expect(JSON.parse(storage.getItem(SAVE_KEY)!).version).toBe(11);
    const loaded = loadGame(storage);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind === 'loaded') expect(loaded.state).toEqual(state);
  });

  it('persists discovered places and rejects invalid discovery flags', () => {
    const storage = new MemoryStorage();
    const state = createGame();
    state.progress.discoveries.basket = true;
    state.progress.discoveries.spring = true;
    expect(saveGame(storage, state).ok).toBe(true);
    expect(loadGame(storage)).toEqual({ kind: 'loaded', state });
    (state.progress.discoveries as unknown as Record<string, unknown>).cairn = 'yes';
    expect(saveGame(storage, state).ok).toBe(false);
  });

  it('persists a crafted axe and chopped tree timing in the current save', () => {
    const storage = new MemoryStorage();
    const state = createGame();
    state.day = 5;
    state.progress.hearthUnlocked = true;
    state.progress.nextStormDay = null;
    state.progress.axeCrafted = true;
    state.trees[0].readyDay = 8;
    expect(saveGame(storage, state).ok).toBe(true);
    expect(loadGame(storage)).toEqual({ kind: 'loaded', state });
  });

  it('rejects altered tree locations and impossible regrowth dates', () => {
    const storage = new MemoryStorage();
    const state = createGame();
    state.trees[0].x += 1;
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 11, state }));
    expect(loadGame(storage).kind).toBe('invalid');
    state.trees[0] = { ...createGame().trees[0], readyDay: state.day + BALANCE.treeRegrowDays + 1 };
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 11, state }));
    expect(loadGame(storage).kind).toBe('invalid');
  });

  it('persists a repaired lookout in the current save', () => {
    const storage = new MemoryStorage();
    const state = createGame();
    state.progress.nextStormDay = null;
    state.progress.hearthUnlocked = true;
    state.progress.lookoutRepaired = true;
    expect(saveGame(storage, state).ok).toBe(true);
    expect(loadGame(storage)).toEqual({ kind: 'loaded', state });
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
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 11, state }));
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

  it('round-trips loose piles, the stone pile and stored stone', () => {
    const storage = new MemoryStorage();
    const state = createGame();
    state.stonePiles = [{ id: 'pile-1-50-50', x: 5, y: 5, count: 3, area: 'camp' }];
    state.structures.stonePile = true;
    state.storedStone = 4;
    expect(saveGame(storage, state)).toEqual({ ok: true });
    expect(loadGame(storage)).toEqual({ kind: 'loaded', state });
  });

  it('rejects every earlier version', () => {
    for (let version = 1; version <= 10; version++) {
      const storage = new MemoryStorage();
      storage.setItem(SAVE_KEY, JSON.stringify({ version, state: createGame() }));
      expect(loadGame(storage).kind, `version ${version}`).toBe('invalid');
    }
  });

  it('rejects bags over capacity counting stone as two spaces', () => {
    const storage = new MemoryStorage();
    const state = createGame();
    state.inventory.stone = 5;
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 11, state }));
    expect(loadGame(storage).kind).toBe('invalid');
  });

  it('rejects bad loose piles and stored stone', () => {
    const variants: ((state: ReturnType<typeof createGame>) => void)[] = [
      state => { state.stonePiles = [{ id: 'p', x: 5, y: 5, count: 0, area: 'camp' }]; },
      state => { state.stonePiles = [{ id: 'p', x: BALANCE.mapWidth + 1, y: 5, count: 1, area: 'camp' }]; },
      state => { state.stonePiles = [{ id: 'p', x: 5, y: 5, count: 1.5, area: 'camp' }]; },
      state => { state.structures.stonePile = true; state.storedStone = 13; },
      state => { state.storedStone = 1; },
      state => { state.structures.stonePile = true; state.storedStone = 0.5; }
    ];
    variants.forEach((change, index) => {
      const storage = new MemoryStorage();
      const state = createGame();
      change(state);
      storage.setItem(SAVE_KEY, JSON.stringify({ version: 11, state }));
      expect(loadGame(storage).kind, `variant ${index}`).toBe('invalid');
    });
  });
});

describe('autosave backoff', () => {
  it('saves every 10 seconds, then backs off to 30 and 60 seconds after repeated failures', () => {
    expect(autosaveDelayMs(0)).toBe(10000);
    expect(autosaveDelayMs(1)).toBe(10000);
    expect(autosaveDelayMs(2)).toBe(30000);
    expect(autosaveDelayMs(3)).toBe(60000);
    expect(autosaveDelayMs(40)).toBe(60000);
  });
});

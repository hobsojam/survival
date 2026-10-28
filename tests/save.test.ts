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
    expect(JSON.parse(storage.getItem(SAVE_KEY)!).version).toBe(15);
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
    state.structures.toolshed = true;
    state.progress.axeCrafted = true;
    state.trees[0].readyDay = 8;
    expect(saveGame(storage, state).ok).toBe(true);
    expect(loadGame(storage)).toEqual({ kind: 'loaded', state });
  });

  it('rejects altered tree locations and impossible regrowth dates', () => {
    const storage = new MemoryStorage();
    const state = createGame();
    state.trees[0].x += 1;
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 15, state }));
    expect(loadGame(storage).kind).toBe('invalid');
    state.trees[0] = { ...createGame().trees[0], readyDay: state.day + BALANCE.treeRegrowDays + 1 };
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 15, state }));
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

  it('keeps a repaired lookout without a toolshed, which only the axe needs', () => {
    const storage = new MemoryStorage();
    const state = createGame();
    state.progress = { ...state.progress, nextStormDay: null, hearthUnlocked: true, lookoutRepaired: true };
    expect(state.structures.toolshed).toBe(false);
    expect(saveGame(storage, state)).toEqual({ ok: true });
    expect(loadGame(storage)).toEqual({ kind: 'loaded', state });
  });

  it('accepts the quarry and rubble ready days right up to their limits', () => {
    const storage = new MemoryStorage();
    const state = createGame();
    state.day = 2;
    state.quarryReadyDay = state.day + 1;
    state.rubbleReadyDay = state.day + BALANCE.rubbleRegrowDays;
    expect(saveGame(storage, state)).toEqual({ ok: true });
    expect(loadGame(storage).kind).toBe('loaded');
    for (const change of [(s: typeof state) => { s.quarryReadyDay = 0; }, (s: typeof state) => { s.rubbleReadyDay = 0; }]) {
      const broken = structuredClone(state);
      change(broken);
      storage.setItem(SAVE_KEY, JSON.stringify({ version: 15, state: broken }));
      expect(loadGame(storage).kind).toBe('invalid');
    }
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
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 15, state }));
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

  it('round-trips a camp left in the quarry area', () => {
    const storage = new MemoryStorage();
    const state = createGame();
    state.day = 2;
    state.area = 'quarry';
    state.structures.shelter = true;
    state.structures.toolshed = true;
    state.progress.quarryFound = true;
    state.progress.pickaxeCrafted = true;
    state.quarryReadyDay = 3;
    state.rubbleReadyDay = 5;
    state.stonePiles = [{ id: 'pile-2-12-12', x: 12, y: 12, count: 2, area: 'quarry' }];
    expect(saveGame(storage, state)).toEqual({ ok: true });
    expect(loadGame(storage)).toEqual({ kind: 'loaded', state });
  });

  it('rejects impossible quarry progress', () => {
    const variants: ((state: any) => void)[] = [
      state => { state.area = 'mine'; },
      state => { state.area = 'quarry'; },
      state => { state.progress.quarryFound = true; },
      state => { state.structures.shelter = true; state.structures.toolshed = true; state.progress.pickaxeCrafted = true; },
      state => { state.structures.shelter = true; state.progress.quarryFound = true; state.progress.pickaxeCrafted = true; },
      state => { state.progress.hearthUnlocked = true; state.progress.nextStormDay = null; state.progress.axeCrafted = true; },
      state => { state.quarryReadyDay = state.day + 2; },
      state => { state.rubbleReadyDay = state.day + 4; },
      state => { state.stonePiles = [{ id: 'p', x: 5, y: 5, count: 1 }]; }
    ];
    variants.forEach((change, index) => {
      const storage = new MemoryStorage();
      const state = createGame();
      change(state);
      storage.setItem(SAVE_KEY, JSON.stringify({ version: 15, state }));
      expect(loadGame(storage).kind, `variant ${index}`).toBe('invalid');
    });
  });

  it('rejects every earlier version', () => {
    for (let version = 1; version <= 14; version++) {
      const storage = new MemoryStorage();
      storage.setItem(SAVE_KEY, JSON.stringify({ version, state: createGame() }));
      expect(loadGame(storage).kind, `version ${version}`).toBe('invalid');
    }
  });

  it('round-trips the last wolf visit', () => {
    const storage = new MemoryStorage();
    const state = createGame();
    state.day = 13;
    state.progress.nextStormDay = 13;
    state.lastWolf = { day: 12, took: 'berry' };
    expect(saveGame(storage, state).ok).toBe(true);
    expect(loadGame(storage)).toEqual({ kind: 'loaded', state });
  });

  it('rejects a wolf visit from the future or of an unknown kind', () => {
    const visits: unknown[] = [{ day: 14, took: 'nothing' }, { day: 12, took: 'fish' }, { day: 1.5, took: 'ration' }, { day: 0, took: 'ration' }, 'yes', { took: 'ration' }];
    visits.forEach((lastWolf, index) => {
      const storage = new MemoryStorage();
      const state = { ...createGame(), day: 13, lastWolf };
      state.progress.nextStormDay = 13;
      storage.setItem(SAVE_KEY, JSON.stringify({ version: 15, state }));
      expect(loadGame(storage).kind, `visit ${index}`).toBe('invalid');
    });
  });

  it('rejects bags over capacity counting stone as two spaces', () => {
    const storage = new MemoryStorage();
    const state = createGame();
    state.inventory.stone = 5;
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 15, state }));
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
      storage.setItem(SAVE_KEY, JSON.stringify({ version: 15, state }));
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

describe('the year journal in the save', () => {
  const store = (state: ReturnType<typeof createGame>, version = 15) => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ version, state }));
    return loadGame(storage).kind;
  };
  /** A valid game on this day: the first cold front still due, or long weathered. */
  const onDay = (day: number) => {
    const state = { ...createGame(), day };
    state.progress = day > 3 ? { ...state.progress, nextStormDay: null, hearthUnlocked: true } : state.progress;
    return state;
  };

  it('round-trips journal entries and rejects version 13 saves', () => {
    const storage = new MemoryStorage();
    const state = { ...onDay(4), journal: [{ year: 1, id: 'leaves' as const, day: 1, variant: 0 }, { year: 1, id: 'coldFront' as const, day: 3, variant: 1 }] };
    expect(saveGame(storage, state).ok).toBe(true);
    expect(loadGame(storage)).toEqual({ kind: 'loaded', state });
    expect(store(state, 13)).toBe('invalid');
  });

  it('rejects journals that could not have been written', () => {
    const entries: unknown[][] = [
      [{ year: 1, id: 'leaves', day: 1, variant: 0 }, { year: 1, id: 'leaves', day: 2, variant: 0 }],
      [{ year: 1, id: 'dragons', day: 1, variant: 0 }],
      [{ year: 2, id: 'coldFront', day: 15, variant: 0 }],
      [{ year: 2, id: 'leaves', day: 5, variant: 0 }],
      [{ year: 1, id: 'leaves', day: 9, variant: 0 }],
      [{ year: 1, id: 'leaves', day: 1, variant: 1 }]
    ];
    entries.forEach((journal, index) => {
      const state = { ...onDay(5), journal } as unknown as ReturnType<typeof createGame>;
      expect(store(state), `case ${index}`).toBe('invalid');
    });
  });

  it('loads a long game with ten years of entries', () => {
    const ids = ['leaves', 'fox', 'coldFront', 'driedBerries', 'stars'] as const;
    const journal = Array.from({ length: 10 }, (_, year) => ids.map((id, index) => ({ year: year + 1, id, day: year * 40 + index + 1, variant: 0 }))).flat();
    expect(store(onDay(5))).toBe('loaded');
    expect(store({ ...onDay(400), journal })).toBe('loaded');
  });
});

describe('the companion in the save', () => {
  const store = (state: unknown, version = 15) => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ version, state }));
    return loadGame(storage).kind;
  };
  const onDay = (day: number) => {
    const state = { ...createGame(), day };
    state.progress = { ...state.progress, nextStormDay: null, hearthUnlocked: true };
    return state;
  };
  const withCompanion = (changes: Record<string, unknown>, day = 30) => {
    const state = onDay(day);
    return { ...state, companion: { ...state.companion, ...changes } };
  };

  it('round-trips a friend and rejects version 14 saves', () => {
    const storage = new MemoryStorage();
    const state = withCompanion({ friend: 'fox', since: 20, trust: { bird: 2, fox: 4, wolf: 1 }, lastOffer: { bird: 3, fox: 20, wolf: 12 },
      keepsakes: 3, keepsakeLying: true, lastFind: 28, lastGift: 27 });
    expect(saveGame(storage, state).ok).toBe(true);
    expect(loadGame(storage)).toEqual({ kind: 'loaded', state });
    expect(store(state, 14)).toBe('invalid');
  });

  it('rejects companions that could not have come about', () => {
    const cases = [
      { friend: 'cat', since: 3 },
      { friend: 'fox', since: 3, trust: { bird: 0, fox: 4, wolf: 0 }, keepsakes: 7 },
      { trust: { bird: 5, fox: 0, wolf: 0 } },
      { friend: 'fox', since: 3, trust: { bird: 0, fox: 4, wolf: 0 }, pillow: true },
      { friend: 'bird', since: 3, trust: { bird: 5, fox: 0, wolf: 0 }, cloak: true },
      { friend: 'bird', since: 40, trust: { bird: 5, fox: 0, wolf: 0 } },
      { friend: null, since: null, keepsakes: 2 }
    ];
    cases.forEach((changes, index) => expect(store(withCompanion(changes)), `case ${index}`).toBe('invalid'));
    expect(store(withCompanion({ friend: 'bird', since: 3, trust: { bird: 5, fox: 0, wolf: 0 } }))).toBe('loaded');
  });

  it('loads wolf visits that were offered or chased off', () => {
    expect(store({ ...onDay(12), lastWolf: { day: 12, took: 'offered' } })).toBe('loaded');
    expect(store({ ...onDay(12), lastWolf: { day: 11, took: 'chased' } })).toBe('loaded');
  });
});

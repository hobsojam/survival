import { finishedCastleCamp, street } from './townStreet';
import { describe, expect, it } from 'vitest';
import { BALANCE, createGame, type GameState } from '../src/game/state';
import { addFood, emptyFood, type FoodStore } from '../src/game/food';
import { STEP_IDS, placeBranches } from '../src/game/clearing';
import { autosaveDelayMs, loadGame, saveGame, SAVE_KEY, SAVE_VERSION } from '../src/game/save';
import { carriedCount } from '../src/game/rules';
import { stock } from './stock';
import { emptyCastle, moatFill, NEEDS, type CastleState } from '../src/game/castle';

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
  it('moves the starter branch piles of an older save out to the trees at the clearing\'s edge', () => {
    const storage = new MemoryStorage();
    const state = createGame();
    const old = [[22, 15], [18, 16], [21, 18], [16, 14], [24, 13], [13, 7]];
    const saved = { ...state, nodes: state.nodes.map((node, index) => index < old.length ? { ...node, x: old[index][0], y: old[index][1], amount: 0 } : node) };
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 23, state: saved }));
    const loaded = loadGame(storage);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;
    expect(loaded.state.nodes).toEqual(state.nodes.map((node, index) => index < old.length ? { ...node, amount: 0 } : node));
  });

  it('round trips rations and rejects counts that overfill the bag', () => {
    const storage = new MemoryStorage();
    const state = createGame();
    state.inventory.food.trailFood = 2;
    expect(saveGame(storage, state).ok).toBe(true);
    expect(loadGame(storage)).toEqual({ kind: 'loaded', state });
    state.inventory.wood = 7;
    expect(saveGame(storage, state).ok).toBe(false);
    state.inventory.wood = 0;
    state.inventory.food.trailFood = -1;
    expect(saveGame(storage, state).ok).toBe(false);
  });

  it('round-trips the day each berry was picked, and rejects food that could not be', () => {
    const storage = new MemoryStorage();
    const state = { ...createGame(), day: 3 };
    state.inventory.food = addFood(addFood(emptyFood(), 'berry', 1, 1), 'berry', 1, 3);
    expect(saveGame(storage, state).ok).toBe(true);
    expect(loadGame(storage)).toEqual({ kind: 'loaded', state });
    const saves = (food: unknown) => saveGame(new MemoryStorage(), { ...state, inventory: { ...state.inventory, food } as GameState['inventory'] }).ok;
    expect(saves({ ...emptyFood(), berry: [4] })).toBe(false);
    expect(saves({ ...emptyFood(), berry: [0] })).toBe(false);
    expect(saves({ ...emptyFood(), greens: [2.5] })).toBe(false);
    expect(saves({ ...emptyFood(), honey: 1.5 })).toBe(false);
    expect(saves({ ...emptyFood(), berry: 2 })).toBe(false);
    const partial: Partial<FoodStore> = emptyFood();
    delete partial.pineNeedles;
    expect(saves(partial)).toBe(false);
    expect(saves(3)).toBe(false);
  });

  it('rejects a version 18 save, from before the food store', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 18, state: createGame() }));
    expect(loadGame(storage).kind).toBe('invalid');
  });

  it('rejects a version 19 save, from before the fibre stack', () => {
    const storage = new MemoryStorage();
    const { storedFiber: _stored, ...older } = createGame();
    const { fibreStack: _stack, ...structures } = older.structures;
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 19, state: { ...older, structures } }));
    expect(loadGame(storage).kind).toBe('invalid');
  });

  it('rejects a version 21 save, from before the vegetable beds', () => {
    const storage = new MemoryStorage();
    const { beds: _beds, ...older } = createGame();
    const { vegetableBeds: _vegetableBeds, ...structures } = older.structures;
    const { vegetables: _vegetables, ...food } = older.inventory.food;
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 21, state: { ...older, structures, inventory: { ...older.inventory, food } } }));
    expect(loadGame(storage).kind).toBe('invalid');
  });

  it('rejects a version 22 save, from before the workshop', () => {
    const storage = new MemoryStorage();
    const older = createGame();
    const { workshop: _workshop, ...structures } = older.structures;
    const { workshop: _upgrades, ...progress } = older.progress;
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 22, state: { ...older, structures, progress } }));
    expect(loadGame(storage).kind).toBe('invalid');
  });

  it('round-trips progression across a page reload', () => {
    const storage = new MemoryStorage();
    const state = createGame();
    state.day = 3;
    state.timeOfDay = 92;
    state.player.x = 7.5;
    state.player.y = 11.25;
    state.inventory.wood = 5;
    state.inventory.food = stock(2);
    state.inventory.fiber = 1;
    state.fireFuel = 43;
    state.clearing = { cleared: [...STEP_IDS], marked: null, felled: [] };
    state.nodes = placeBranches(state.nodes, [...STEP_IDS]);
    state.structures.shelter = true;
    state.structures.toolshed = true;
    state.progress.packWoven = true;
    state.structures.dryingRack = true;
    state.structures.windbreak = true;
    state.nodes[0].amount = 0;
    state.nodes[0].readyDay = 4;
    state.nodes.find(node => node.kind === 'fiber')!.amount = 0;
    state.nodes.find(node => node.kind === 'fiber')!.readyDay = 4;
    expect(saveGame(storage, state).ok).toBe(true);
    expect(JSON.parse(storage.getItem(SAVE_KEY)!).version).toBe(SAVE_VERSION);
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

  it('round-trips completed shelter upgrades and rejects a broken upgrade chain', () => {
    const storage = new MemoryStorage();
    const state = createGame();
    state.structures.shelter = true;
    state.structures.shelterThatched = true;
    state.structures.hearth = true;
    state.structures.shelterStonework = true;
    state.structures.shelterPorch = true;
    state.structures.shelterFinished = true;
    state.progress = { ...state.progress, hearthUnlocked: true, nextStormDay: null };
    expect(saveGame(storage, state).ok).toBe(true);
    expect(loadGame(storage)).toEqual({ kind: 'loaded', state });

    state.structures.shelterPorch = false;
    expect(saveGame(storage, state).ok).toBe(false);
  });

  it('persists a crafted axe and chopped tree timing in the current save', () => {
    const storage = new MemoryStorage();
    const state = createGame();
    state.day = 5;
    state.progress.hearthUnlocked = true;
    state.progress.nextStormDay = null;
    state.structures.shelter = true;
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
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 16, state }));
    expect(loadGame(storage).kind).toBe('invalid');
    state.trees[0] = { ...createGame().trees[0], readyDay: state.day + BALANCE.treeRegrowDays + 1 };
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 16, state }));
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
      storage.setItem(SAVE_KEY, JSON.stringify({ version: 16, state: broken }));
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
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 16, state }));
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
    state.stonePiles = [{ id: 'pile-1-50-50', x: 5, y: 5, count: 3, area: 'camp', item: 'stone' }];
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
    state.stonePiles = [{ id: 'pile-2-12-12', x: 12, y: 12, count: 2, area: 'quarry', item: 'stone' }];
    expect(saveGame(storage, state)).toEqual({ ok: true });
    expect(loadGame(storage)).toEqual({ kind: 'loaded', state });
  });

  it('round-trips the mine and rejects impossible second-dig timers', () => {
    const storage = new MemoryStorage();
    const state = createGame();
    state.day = 2;
    state.structures.shelter = true;
    state.structures.toolshed = true;
    state.progress.quarryFound = true;
    state.progress.pickaxeCrafted = true;
    state.progress.mineBuilt = true;
    state.mineReadyDay = 3;
    expect(saveGame(storage, state)).toEqual({ ok: true });
    expect(loadGame(storage)).toEqual({ kind: 'loaded', state });
    state.mineReadyDay = 4;
    expect(saveGame(storage, state).ok).toBe(false);
    state.mineReadyDay = 1;
    state.progress.mineBuilt = false;
    state.mineReadyDay = 3;
    expect(saveGame(storage, state).ok).toBe(false);
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
      storage.setItem(SAVE_KEY, JSON.stringify({ version: 16, state }));
      expect(loadGame(storage).kind, `variant ${index}`).toBe('invalid');
    });
  });

  it('rejects every earlier version', () => {
    for (let version = 1; version <= 16; version++) {
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
      storage.setItem(SAVE_KEY, JSON.stringify({ version: 16, state }));
      expect(loadGame(storage).kind, `visit ${index}`).toBe('invalid');
    });
  });

  it('rejects bags over capacity counting stone as two spaces', () => {
    const storage = new MemoryStorage();
    const state = createGame();
    state.inventory.stone = 5;
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 16, state }));
    expect(loadGame(storage).kind).toBe('invalid');
  });

  it('rejects bad loose piles and stored stone', () => {
    const variants: ((state: ReturnType<typeof createGame>) => void)[] = [
      state => { state.stonePiles = [{ id: 'p', x: 5, y: 5, count: 0, area: 'camp', item: 'stone' }]; },
      state => { state.stonePiles = [{ id: 'p', x: BALANCE.mapWidth + 1, y: 5, count: 1, area: 'camp', item: 'stone' }]; },
      state => { state.stonePiles = [{ id: 'p', x: 5, y: 5, count: 1.5, area: 'camp', item: 'stone' }]; },
      state => { state.structures.stonePile = true; state.storedStone = 13; },
      state => { state.storedStone = 1; },
      state => { state.structures.stonePile = true; state.storedStone = 0.5; }
    ];
    variants.forEach((change, index) => {
      const storage = new MemoryStorage();
      const state = createGame();
      change(state);
      storage.setItem(SAVE_KEY, JSON.stringify({ version: 16, state }));
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

describe('garden plots in saves', () => {
  const yearTwoGarden = () => {
    const state = { ...createGame(), day: 51 };
    state.structures.garden = true;
    state.progress = { ...state.progress, nextStormDay: null, hearthUnlocked: true };
    return state;
  };
  const accepts = (state: unknown) => saveGame(new MemoryStorage(), state as ReturnType<typeof createGame>).ok;

  it('round-trips a ready perennial harvest through winter', () => {
    const state = yearTwoGarden();
    state.gardenPlots[0] = { plantedYear: 1, harvestedYear: null, harvestReady: true };
    expect(accepts(state)).toBe(true);
    const storage = new MemoryStorage();
    saveGame(storage, state);
    expect(loadGame(storage)).toEqual({ kind: 'loaded', state });
  });

  it('rejects a harvest that is marked ready before its planted year has cycled', () => {
    const state = createGame();
    state.structures.garden = true;
    state.gardenPlots[0] = { plantedYear: 1, harvestedYear: null, harvestReady: true };
    expect(accepts(state)).toBe(false);
  });

  it('rejects malformed plot history and plants without a garden', () => {
    const malformed = yearTwoGarden();
    malformed.gardenPlots.pop();
    expect(accepts(malformed)).toBe(false);

    const missingGarden = yearTwoGarden();
    missingGarden.structures.garden = false;
    missingGarden.gardenPlots[0] = { plantedYear: 1, harvestedYear: null, harvestReady: false };
    expect(accepts(missingGarden)).toBe(false);

    const missingPlant = yearTwoGarden();
    missingPlant.gardenPlots[0] = { plantedYear: null, harvestedYear: 1, harvestReady: false };
    expect(accepts(missingPlant)).toBe(false);

    const malformedReady = yearTwoGarden();
    (malformedReady.gardenPlots[0] as unknown as Record<string, unknown>).harvestReady = 'yes';
    expect(accepts(malformedReady)).toBe(false);

    const impossibleHistory: unknown[] = [
      { plantedYear: 0, harvestedYear: null, harvestReady: false },
      { plantedYear: 3, harvestedYear: null, harvestReady: false },
      { plantedYear: 1, harvestedYear: 0, harvestReady: false },
      { plantedYear: 1, harvestedYear: 3, harvestReady: false },
      { plantedYear: 2, harvestedYear: 1, harvestReady: false },
      { plantedYear: null, harvestedYear: null, harvestReady: true },
      { plantedYear: 1, harvestedYear: 2, harvestReady: true }
    ];
    impossibleHistory.forEach(plot => {
      const invalid = yearTwoGarden();
      invalid.gardenPlots[0] = plot as typeof invalid.gardenPlots[number];
      expect(accepts(invalid)).toBe(false);
    });
  });
});

describe('the year journal in the save', () => {
  const store = (state: ReturnType<typeof createGame>, version = 23) => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ version, state }));
    return loadGame(storage).kind;
  };
  /** A valid game on this day: the first cold night still due, or long weathered. */
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
  const store = (state: unknown, version = 23) => {
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
    const state = withCompanion({ friend: 'fox', since: 20, friends: { bird: null, fox: 20, wolf: null }, trust: { bird: 2, fox: 4, wolf: 1 }, lastOffer: { bird: 3, fox: 20, wolf: 12 },
      keepsakes: 3, keepsakeLying: true, lastFind: 28, lastGift: 27 });
    expect(saveGame(storage, state).ok).toBe(true);
    expect(loadGame(storage)).toEqual({ kind: 'loaded', state });
    expect(store(state, 14)).toBe('invalid');
  });

  it('round-trips three friends with independent keepsakes and gifts', () => {
    const storage = new MemoryStorage();
    const state = withCompanion({ friend: 'bird', since: 10,
      friends: { bird: 10, fox: 12, wolf: 15 },
      trust: { bird: 5, fox: 4, wolf: 3 },
      lastOffer: { bird: 10, fox: 12, wolf: 15 },
      keepsakes: 2, keepsakesByKind: { feather: 2, fur: 4 },
      lyingByKind: { feather: false, fur: true },
      lastFindByKind: { feather: 25, fur: 27 },
      lastGiftByFriend: { fox: 26, wolf: 28 } });
    expect(saveGame(storage, state).ok).toBe(true);
    expect(loadGame(storage)).toEqual({ kind: 'loaded', state });
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

describe('the spoiled-food note in the save', () => {
  const accepts = (lastSpoiled: unknown) => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 23, state: { ...createGame(), day: 6, lastSpoiled, progress: { ...createGame().progress, nextStormDay: null, hearthUnlocked: true } } }));
    return loadGame(storage).kind === 'loaded';
  };

  it('accepts none, or a lived day with something thrown out', () => {
    expect(accepts(null)).toBe(true);
    expect(accepts({ day: 6, berry: 1, greens: 0 })).toBe(true);
    expect(accepts({ day: 4, berry: 0, greens: 2 })).toBe(true);
  });

  it('refuses a future day, an empty loss or odd counts', () => {
    [{ day: 7, berry: 1, greens: 0 }, { day: 0, berry: 1, greens: 0 }, { day: 5, berry: 0, greens: 0 }, { day: 5, berry: -1, greens: 2 },
      { day: 5, berry: 1.5, greens: 0 }, { day: 5, berry: 1 }, 'soft', undefined].forEach(bad => expect(accepts(bad), JSON.stringify(bad)).toBe(false));
  });
});

describe('the clearing in the save', () => {
  const accepts = (state: unknown, version = 23) => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ version, state }));
    return loadGame(storage).kind === 'loaded';
  };
  const grown = () => {
    const state = createGame();
    const cleared: ('north-near')[] = ['north-near'];
    const placed = placeBranches(state.nodes, cleared);
    return { ...state, nodes: state.nodes.map((node, i) => ({ ...node, x: placed[i].x, y: placed[i].y })),
      clearing: { cleared, marked: 'east-near', felled: [1, 3] } } as ReturnType<typeof createGame>;
  };

  it('round trips a grown clearing', () => {
    const storage = new MemoryStorage();
    expect(saveGame(storage, grown()).ok).toBe(true);
    const loaded = loadGame(storage);
    expect(loaded).toEqual({ kind: 'loaded', state: grown() });
  });

  it('rejects clearings that could not have happened', () => {
    expect(accepts(grown())).toBe(true);
    const withClearing = (clearing: unknown) => ({ ...grown(), clearing });
    expect(accepts(withClearing({ cleared: ['north-near'], marked: 'east-near', felled: [1, 9] }))).toBe(false);
    expect(accepts(withClearing({ cleared: ['north-near'], marked: null, felled: [1] }))).toBe(false);
    expect(accepts(withClearing({ cleared: ['north-near'], marked: 'east-near', felled: [1, 1] }))).toBe(false);
    expect(accepts(withClearing({ cleared: ['west-far'], marked: null, felled: [] }))).toBe(false);
    expect(accepts(withClearing({ cleared: ['north-near'], marked: 'north-near', felled: [] }))).toBe(false);
    expect(accepts(withClearing({ cleared: ['north-near', 'north-near'], marked: null, felled: [] }))).toBe(false);
    expect(accepts(withClearing({ cleared: ['nowhere'], marked: null, felled: [] }))).toBe(false);
    expect(accepts(withClearing(undefined))).toBe(false);
  });

  it('rejects branches left where the clearing says they are not', () => {
    const state = grown();
    const moved = state.nodes.findIndex((node, i) => node.x !== createGame().nodes[i].x);
    expect(moved).toBeGreaterThanOrEqual(0);
    const wrong = { ...state, nodes: state.nodes.map((node, i) => i === moved ? { ...node, x: node.x + 1 } : node) };
    expect(accepts(wrong)).toBe(false);
  });

  it('rejects a version 17 save', () => {
    expect(accepts(grown(), 17)).toBe(false);
  });
});

describe('forage regrowth in the save', () => {
  const saved = (id: string, readyDay: number): string => {
    const storage = new MemoryStorage();
    const state = createGame();
    state.day = 32;
    state.progress.hearthUnlocked = true;
    state.progress.nextStormDay = null;
    const node = state.nodes.find(item => item.id === id)!;
    node.amount = 0;
    node.readyDay = readyDay;
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 23, state }));
    return loadGame(storage).kind;
  };

  it('lets the hollow tree wait up to three days for its honey', () => {
    expect(saved('honey-0', 35)).toBe('loaded');
    expect(saved('honey-0', 36)).toBe('invalid');
  });

  it('saves and loads gathered honey and greens in the bag', () => {
    const storage = new MemoryStorage();
    const state = createGame();
    state.day = 32;
    state.progress.hearthUnlocked = true;
    state.progress.nextStormDay = null;
    const honey = state.nodes.find(item => item.id === 'honey-0')!;
    honey.amount = 0;
    honey.readyDay = state.day + BALANCE.honeyRegrowDays;
    state.inventory.food = addFood(addFood(emptyFood(), 'honey', 1, 32), 'greens', 2, 30);
    expect(saveGame(storage, state).ok).toBe(true);
    expect(loadGame(storage)).toEqual({ kind: 'loaded', state });
  });

  it('keeps every other spot to the next day', () => {
    expect(saved('hazel-0', 33)).toBe('loaded');
    expect(saved('hazel-0', 34)).toBe('invalid');
    expect(saved('greens-3', 34)).toBe('invalid');
  });
});

describe('the cooking pot in the save', () => {
  const accepts = (change: (state: GameState) => void) => {
    const storage = new MemoryStorage();
    const state = createGame();
    change(state);
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 23, state }));
    return loadGame(storage).kind === 'loaded';
  };

  it('keeps a pot made in the toolshed, and a honey cake\'s bonus', () => {
    expect(accepts(state => { state.structures.shelter = true; state.structures.toolshed = true; state.progress.potCrafted = true; state.cakeBonus = true; })).toBe(true);
  });

  it('refuses a pot without a toolshed, or odd flags', () => {
    expect(accepts(state => { state.progress.potCrafted = true; })).toBe(false);
    expect(accepts(state => { (state.progress as any).potCrafted = 'yes'; })).toBe(false);
    expect(accepts(state => { delete (state.progress as any).potCrafted; })).toBe(false);
    expect(accepts(state => { (state as any).cakeBonus = 1; })).toBe(false);
    expect(accepts(state => { delete (state as any).cakeBonus; })).toBe(false);
  });
});

describe('the larder in the save', () => {
  const accepts = (change: (state: GameState) => void) => {
    const storage = new MemoryStorage();
    const state = createGame();
    state.day = 6;
    state.progress = { ...state.progress, nextStormDay: null, hearthUnlocked: true };
    const placed = placeBranches(state.nodes, ['north-near']);
    state.nodes = state.nodes.map((node, i) => ({ ...node, x: placed[i].x, y: placed[i].y }));
    state.clearing = { cleared: ['north-near'], marked: null, felled: [] };
    change(state);
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 23, state }));
    return loadGame(storage).kind === 'loaded';
  };

  it('keeps the woodpile to its ground, its capacity and a built pile', () => {
    const east = (change: (state: GameState) => void) => accepts(state => {
      const placed = placeBranches(createGame().nodes, ['east-near']);
      state.nodes = state.nodes.map((node, i) => ({ ...node, x: placed[i].x, y: placed[i].y }));
      state.clearing = { cleared: ['east-near'], marked: null, felled: [] };
      change(state);
    });
    expect(east(state => { state.structures.woodpile = true; state.storedWood = 24; })).toBe(true);
    expect(east(state => { state.structures.woodpile = true; state.storedWood = 25; })).toBe(false);
    expect(east(state => { state.structures.woodpile = true; state.storedWood = 0.5; })).toBe(false);
    expect(east(state => { state.storedWood = 1; })).toBe(false);
    expect(east(state => { delete (state as any).storedWood; })).toBe(false);
    expect(accepts(state => { state.structures.woodpile = true; })).toBe(false);
  });

  it('keeps the fibre stack to its ground, its capacity and a built stack', () => {
    const east = (change: (state: GameState) => void) => accepts(state => {
      const placed = placeBranches(createGame().nodes, ['east-near']);
      state.nodes = state.nodes.map((node, i) => ({ ...node, x: placed[i].x, y: placed[i].y }));
      state.clearing = { cleared: ['east-near'], marked: null, felled: [] };
      change(state);
    });
    expect(east(state => { state.structures.fibreStack = true; state.storedFiber = 12; })).toBe(true);
    expect(east(state => { state.structures.fibreStack = true; state.storedFiber = 13; })).toBe(false);
    expect(east(state => { state.structures.fibreStack = true; state.storedFiber = 0.5; })).toBe(false);
    expect(east(state => { state.storedFiber = 1; })).toBe(false);
    expect(east(state => { delete (state as any).storedFiber; })).toBe(false);
    expect(accepts(state => { state.structures.fibreStack = true; })).toBe(false);
  });

  it('round-trips a stocked larder', () => {
    const storage = new MemoryStorage();
    const state = createGame();
    const placed = placeBranches(state.nodes, ['north-near']);
    state.nodes = state.nodes.map((node, i) => ({ ...node, x: placed[i].x, y: placed[i].y }));
    state.clearing = { cleared: ['north-near'], marked: null, felled: [] };
    state.structures.larder = true;
    state.larder = addFood(addFood(emptyFood(), 'berry', 2, 1), 'honey', 1, 1);
    expect(saveGame(storage, state).ok).toBe(true);
    expect(loadGame(storage)).toEqual({ kind: 'loaded', state });
  });

  it('holds real food, at most 10, and only once built', () => {
    expect(accepts(state => { state.structures.larder = true; state.larder = addFood(stock(4), 'hazelnut', 6, 1); })).toBe(true);
    expect(accepts(state => { state.structures.larder = true; state.larder = addFood(stock(5), 'hazelnut', 6, 1); })).toBe(false);
    expect(accepts(state => { state.larder = stock(1); })).toBe(false);
    expect(accepts(state => { state.structures.larder = true; state.larder = { ...emptyFood(), berry: [7] }; })).toBe(false);
    expect(accepts(state => { state.structures.larder = true; (state.larder as any).honey = -1; })).toBe(false);
    expect(accepts(state => { delete (state as any).larder; })).toBe(false);
  });

  it('accepts 30 food after the storehouse upgrade and rejects an orphaned storehouse', () => {
    expect(accepts(state => { state.structures.larder = true; state.structures.storehouse = true; state.larder = stock(30); })).toBe(true);
    expect(accepts(state => { state.structures.larder = true; state.structures.storehouse = true; state.larder = stock(31); })).toBe(false);
    expect(accepts(state => { state.structures.storehouse = true; })).toBe(false);
  });

  it('stands only on cleared north ground', () => {
    expect(accepts(state => { state.structures.larder = true; })).toBe(true);
    expect(accepts(state => {
      state.structures.larder = true;
      state.clearing = { cleared: [], marked: null, felled: [] };
      state.nodes = createGame().nodes;
    })).toBe(false);
  });

  it('leaves the larder out of the bag\'s count', () => {
    const state = createGame();
    state.inventory.food = stock(3);
    expect(carriedCount({ ...state, larder: stock(10) })).toBe(3);
    expect(accepts(state => { state.structures.larder = true; state.inventory.food = stock(8); state.larder = stock(10); })).toBe(true);
  });
});

describe('the town in the save', () => {
  /** A finished castle with the hall home, and the town changed as given. */
  const finished = (change: (state: GameState) => void = () => {}): GameState => {
    const state = finishedCastleCamp();
    change(state);
    return state;
  };
  const accepts = (change?: (state: GameState) => void) => saveGame(new MemoryStorage(), finished(change)).ok;
  const ada = { name: 'Ada', job: 'hens' as const, house: null, arrivedDay: 20 };
  const built = { stone: 30, beams: 4, fittings: 1, doneDay: 30 };

  it('accepts no town, a traveller, a person in the hall, and a person in a finished house', () => {
    expect(accepts()).toBe(true);
    expect(accepts(state => { state.town.traveller = { name: 'Ada', arrivedDay: 20, refusals: 2, askedDay: 22 }; state.town.namesUsed = 1; })).toBe(true);
    expect(accepts(state => { state.town.people = [ada]; state.town.namesUsed = 1; })).toBe(true);
    expect(accepts(state => { state.town.people = [{ ...ada, house: 0 }]; state.town.houses = street(built); state.town.namesUsed = 1; })).toBe(true);
    expect(accepts(state => { state.town.people = [ada]; state.town.houses = street({ stone: 30, beams: 2, fittings: 0, doneDay: null }); state.town.namesUsed = 1; })).toBe(true);
    expect(accepts(state => { state.town.goneDay = 30; state.town.namesUsed = 1; })).toBe(true);
    expect(accepts(state => { state.town.people = [{ ...ada, house: 0 }, { name: 'Tomas', job: 'honey', house: 1, arrivedDay: 31 }]; state.town.houses = street(built, built); state.town.namesUsed = 2; })).toBe(true);
    const twoHouses = (state: GameState) => { state.town.people = [{ ...ada, house: 0 }, { name: 'Tomas', job: 'honey', house: 1, arrivedDay: 31 }]; state.town.houses = street(built, built); state.town.namesUsed = 2; };
    expect(accepts(state => { twoHouses(state); Object.assign(state.town.square, { paving: 40, doneDays: { paving: 40 } }); state.town.square.stalls.bread = { beams: 2, hangings: 0 }; })).toBe(true);
    expect(accepts(state => { twoHouses(state); Object.assign(state.town.square, { paving: 40, well: { stone: 12, fittings: 1 }, doneDays: { paving: 40, well: 41 } }); })).toBe(true);
  });

  it.each([
    ['a town before the castle is finished', (state: GameState) => { state.castle.finishedDay = null; state.castle.feast.honey = 2; state.castle.home = 'house'; state.castle.offeredHome = false; state.town.people = [ada]; state.town.namesUsed = 1; }],
    ['a person with an unknown job', (state: GameState) => { state.town.people = [{ ...ada, job: 'pigs' as 'hens' }]; state.town.namesUsed = 1; }],
    ['two people on one job', (state: GameState) => { state.town.people = [ada, { ...ada, name: 'Tomas' }]; state.town.namesUsed = 2; }],
    ['a person in a house that is not finished', (state: GameState) => { state.town.people = [{ ...ada, house: 0 }]; state.town.houses = street({ ...built, fittings: 0, doneDay: null }); state.town.namesUsed = 1; }],
    ['a person in a house that does not exist', (state: GameState) => { state.town.people = [{ ...ada, house: 3 }]; state.town.namesUsed = 1; }],
    ['two people in one house', (state: GameState) => { state.town.people = [{ ...ada, house: 0 }, { name: 'Tomas', job: 'honey', house: 0, arrivedDay: 21 }]; state.town.houses = street(built); state.town.namesUsed = 2; }],
    ['a traveller named like a person', (state: GameState) => { state.town.people = [ada]; state.town.traveller = { name: 'Ada', arrivedDay: 25, refusals: 0, askedDay: null }; state.town.namesUsed = 2; }],
    ['three refusals still waiting', (state: GameState) => { state.town.traveller = { name: 'Ada', arrivedDay: 20, refusals: 3, askedDay: 23 }; state.town.namesUsed = 1; }],
    ['a house over its stone', (state: GameState) => { state.town.houses = street({ stone: 31, beams: 0, fittings: 0, doneDay: null }); }],
    ['beams before the stone is laid', (state: GameState) => { state.town.houses = street({ stone: 29, beams: 1, fittings: 0, doneDay: null }); }],
    ['a fitting before the beams', (state: GameState) => { state.town.houses = street({ stone: 30, beams: 3, fittings: 1, doneDay: null }); }],
    ['a finished day on an unfinished house', (state: GameState) => { state.town.houses = street({ stone: 30, beams: 4, fittings: 0, doneDay: 30 }); }],
    ['a finished house with no day', (state: GameState) => { state.town.houses = street({ ...built, doneDay: null }); }],
    ['fewer names used than people', (state: GameState) => { state.town.people = [ada]; state.town.namesUsed = 0; }],
    ['a town that is not an object', (state: GameState) => { (state as unknown as Record<string, unknown>).town = null; }],
    ['a town with no house plots', (state: GameState) => { state.town.houses = []; }],
    ['a town with eleven houses', (state: GameState) => { state.town.houses = state.town.houses.slice(0, 11); }],
    ['square work with only one house finished', (state: GameState) => { state.town.houses = street(built); state.town.square.paving = 3; }],
    ['a stall beam before the paving is done', (state: GameState) => { state.town.houses = street(built, built); state.town.square.paving = 39; state.town.square.stalls.bread.beams = 1; }],
    ['a well fitting before its stone', (state: GameState) => { state.town.houses = street(built, built); Object.assign(state.town.square, { paving: 40, doneDays: { paving: 40 }, well: { stone: 11, fittings: 1 } }); }],
    ['paving past what the square takes', (state: GameState) => { state.town.houses = street(built, built); state.town.square.paving = 41; }],
    ['stall stock with no one keeping it', (state: GameState) => { state.town.houses = street(built, built); Object.assign(state.town.square, { paving: 40, doneDays: { paving: 40, bread: 41 } }); state.town.square.stalls.bread = { beams: 2, hangings: 1 }; state.town.square.stock.bread = 3; }],
    ['a finished piece with no finished day', (state: GameState) => { state.town.houses = street(built, built); state.town.square.paving = 40; }],
    ['a finished day on an unfinished piece', (state: GameState) => { state.town.houses = street(built, built); Object.assign(state.town.square, { paving: 39, doneDays: { paving: 40 } }); }],
    ['the second house finished before the first', (state: GameState) => { state.town.houses = street({ stone: 0, beams: 0, fittings: 0, doneDay: null }, built); }],
    ['a town with more houses than plots', (state: GameState) => { state.town.houses = [...state.town.houses, { stone: 0, beams: 0, fittings: 0, doneDay: null }]; }]
  ])('rejects %s', (_, change) => {
    expect(accepts(change)).toBe(false);
  });
});

describe('the castle in the save', () => {
  /** A camp with the keep finished on day 2 and the castle revealed on day 5. */
  const camp = (change: (state: GameState) => void = () => {}): GameState => {
    const state = createGame();
    state.day = 9;
    state.progress.quarryFound = true;
    state.progress.hillsFound = true;
    state.progress.oreFoundDay = 2;
    state.clearing = { cleared: [...STEP_IDS], marked: null, felled: [] };
    state.nodes = placeBranches(state.nodes, [...STEP_IDS]);
    state.structures.shelter = true;
    state.structures.toolshed = true;
    state.structures.workshop = true;
    state.progress.nextStormDay = null;
    state.progress.hearthUnlocked = true;
    state.progress.packWoven = true;
    state.progress.workshop.forge = true;
    state.keep = { stones: 60, door: false, startedDay: 1, finishedDay: 2, ponyNight: null };
    state.progress.workshop.hinges = true;
    state.keep.door = true;
    state.castle = { ...emptyCastle(), firstClimbDay: 4, revealedDay: 5 };
    change(state);
    return state;
  };
  const accepts = (change?: (state: GameState) => void) => saveGame(new MemoryStorage(), camp(change)).ok;
  const wallDone = (castle: CastleState) => {
    castle.wall = { north: 30, east: 30, south: 30, west: 30 }; castle.frames = NEEDS.frames;
    castle.doneDays = { ...castle.doneDays, frames: 7, 'wall-north': 8, 'wall-east': 8, 'wall-south': 8, 'wall-west': 8 };
  };
  const cartMade = (state: GameState) => { state.castle.road = 30; state.castle.doneDays = { road: 6 }; state.progress.workshop.stoneCart = true; };
  const framesDone = (state: GameState) => { cartMade(state); state.castle.frames = NEEDS.frames; state.castle.doneDays.frames = 7; };
  const fullTower = { stones: 20, beams: 4, fittings: 2 };

  it('accepts a moat dug in part, and one dug whole, and a mid-spring game fills the same after a reload', () => {
    const dugIn = (stretches: number, dugDay: number | null) => (state: GameState) => {
      cartMade(state); wallDone(state.castle);
      state.castle.moat = { stretches, lastDugDay: 8, dugDay };
      if (dugDay !== null) state.castle.doneDays.moat = dugDay;
    };
    expect(accepts(dugIn(5, null))).toBe(true);
    expect(accepts(dugIn(16, 8))).toBe(true);
    const storage = new MemoryStorage();
    const state = camp(dugIn(16, 8));
    state.day = 25;
    expect(saveGame(storage, state).ok).toBe(true);
    const loaded = loadGame(storage);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;
    expect(moatFill(loaded.state)).toBe(moatFill(state));
    expect(moatFill(loaded.state)).toBeGreaterThan(0);
    expect(moatFill(loaded.state)).toBeLessThan(1);
    expect(moatFill({ ...loaded.state, day: 31 })).toBe(1);
  });

  it('accepts a revealed castle, and one still hidden', () => {
    expect(accepts()).toBe(true);
    expect(accepts(state => { state.castle = emptyCastle(); })).toBe(true);
    expect(accepts(state => { state.castle.revealedDay = null; })).toBe(true);
  });

  it('accepts a castle built in order, up to its finish', () => {
    expect(accepts(state => { state.castle.road = 30; state.castle.doneDays = { road: 6 }; state.progress.workshop.stoneCart = true; state.castle.cart.stone = 40; wallDone(state.castle); })).toBe(true);
    expect(accepts(state => {
      const castle = state.castle;
      castle.road = 30; castle.doneDays = { road: 6 }; state.progress.workshop.stoneCart = true; state.progress.workshop.portcullis = true; wallDone(castle);
      castle.towers = { nw: { ...fullTower }, ne: { ...fullTower }, se: { ...fullTower }, sw: { ...fullTower } };
      castle.doneDays = { ...castle.doneDays, 'tower-nw': 8, 'tower-ne': 8, 'tower-se': 8, 'tower-sw': 8 };
      castle.gatehouse = 30; castle.doneDays['gatehouse'] = 8; castle.moat = { stretches: 16, lastDugDay: 8, dugDay: 8 }; castle.doneDays['moat'] = 8;
      castle.hall = { stones: 40, beams: 12, fittings: 6, hangings: 2 }; castle.doneDays['hall'] = 8;
      castle.feast = { ...NEEDS.feast };
      castle.finishedDay = 9; castle.home = 'hall'; castle.offeredHome = true;
    })).toBe(true);
  });

  const everythingBuilt = (state: GameState): void => {
    const castle = state.castle;
    castle.road = 30; state.progress.workshop.stoneCart = true; state.progress.workshop.portcullis = true; wallDone(castle);
    castle.towers = { nw: { ...fullTower }, ne: { ...fullTower }, se: { ...fullTower }, sw: { ...fullTower } };
    castle.gatehouse = 30; castle.moat = { stretches: 16, lastDugDay: 8, dugDay: 8 }; castle.hall = { stones: 40, beams: 12, fittings: 6, hangings: 2 };
    castle.doneDays = { ...castle.doneDays, road: 6, 'tower-nw': 8, 'tower-ne': 8, 'tower-se': 8, 'tower-sw': 8, gatehouse: 8, moat: 8, hall: 8 };
  };

  it('accepts the feast part-laid, whole and unfinished, and whole and finished, once everything is built', () => {
    expect(accepts(state => { everythingBuilt(state); })).toBe(true);
    expect(accepts(state => { everythingBuilt(state); state.castle.feast = { bread: 2, roastedHazelnuts: 0, honey: 1, apple: 0, vegetables: 0 }; })).toBe(true);
    expect(accepts(state => { everythingBuilt(state); state.castle.feast = { ...NEEDS.feast, vegetables: 3 }; })).toBe(true);
    expect(accepts(state => { everythingBuilt(state); state.castle.feast = { ...NEEDS.feast }; state.castle.finishedDay = 9; })).toBe(true);
    expect(accepts(state => { everythingBuilt(state); state.castle.feast = { ...NEEDS.feast }; state.castle.finishedDay = state.day; })).toBe(true);
  });

  it('accepts a moat dug whole and still empty as built, for the feast', () => {
    expect(accepts(state => { everythingBuilt(state); state.castle.moat = { stretches: 16, lastDugDay: state.day, dugDay: state.day }; state.castle.doneDays.moat = state.day; state.castle.feast = { ...NEEDS.feast }; state.castle.finishedDay = state.day; })).toBe(true);
  });

  it.each<[string, (state: GameState) => void]>([
    ['a whole feast with no finished day', state => { everythingBuilt(state); state.castle.feast = { ...NEEDS.feast }; }],
    ['a finished day with the feast one dish short', state => { everythingBuilt(state); state.castle.feast = { ...NEEDS.feast, honey: 2 }; state.castle.finishedDay = 9; }],
    ['a finished day with no feast laid', state => { everythingBuilt(state); state.castle.finishedDay = 9; }],
    ['a finished day with the moat one stretch short', state => { everythingBuilt(state); state.castle.moat = { stretches: 15, lastDugDay: 8, dugDay: null }; delete state.castle.doneDays.moat; state.castle.feast = { ...NEEDS.feast }; state.castle.finishedDay = 9; }],
    ['a finished day with the hall one hanging short', state => { everythingBuilt(state); state.castle.hall.hangings = 1; delete state.castle.doneDays.hall; state.castle.feast = { ...NEEDS.feast }; state.castle.finishedDay = 9; }],
    ['a finished day with a tower unfinished', state => { everythingBuilt(state); state.castle.towers.nw = { ...fullTower, fittings: 1 }; delete state.castle.doneDays['tower-nw']; state.castle.feast = { ...NEEDS.feast }; state.castle.finishedDay = 9; }],
    ['a finished day with no portcullis or gatehouse', state => { cartMade(state); wallDone(state.castle); state.castle.feast = { ...NEEDS.feast }; state.castle.finishedDay = 9; }],
    ['a finished day in the future', state => { everythingBuilt(state); state.castle.feast = { ...NEEDS.feast }; state.castle.finishedDay = 9999; }],
    ['a finished day of zero', state => { everythingBuilt(state); state.castle.feast = { ...NEEDS.feast }; state.castle.finishedDay = 0; }],
    ['a finished day that is not whole', state => { everythingBuilt(state); state.castle.feast = { ...NEEDS.feast }; state.castle.finishedDay = 9.5; }],
    ['a finished day that is a string', state => { everythingBuilt(state); state.castle.feast = { ...NEEDS.feast }; (state.castle as unknown as Record<string, unknown>).finishedDay = '9'; }],
    ['a dish laid before everything is built', state => { cartMade(state); state.castle.feast.bread = 1; }],
    ['a dish laid with the hall one hanging short', state => { everythingBuilt(state); state.castle.hall.hangings = 1; delete state.castle.doneDays.hall; state.castle.feast.bread = 1; }],
    ['a negative dish count', state => { everythingBuilt(state); state.castle.feast.honey = -1; }],
    ['a fractional dish count', state => { everythingBuilt(state); state.castle.feast.honey = 1.5; }]
  ])('rejects %s', (_, change) => {
    expect(accepts(change)).toBe(false);
  });

  it('accepts a gatehouse part-laid and one finished, each with its portcullis', () => {
    expect(accepts(state => { cartMade(state); wallDone(state.castle); state.progress.workshop.portcullis = true; state.castle.gatehouse = 12; })).toBe(true);
    expect(accepts(state => { cartMade(state); wallDone(state.castle); state.progress.workshop.portcullis = true; state.castle.gatehouse = 30; state.castle.doneDays.gatehouse = 9; })).toBe(true);
  });

  it('accepts a hall part-built in its order, and one finished with its day', () => {
    expect(accepts(state => { framesDone(state); state.castle.hall = { stones: 12, beams: 0, fittings: 0, hangings: 0 }; })).toBe(true);
    expect(accepts(state => { framesDone(state); state.castle.hall = { stones: 40, beams: 5, fittings: 0, hangings: 0 }; })).toBe(true);
    expect(accepts(state => { framesDone(state); state.castle.hall = { stones: 40, beams: 12, fittings: 6, hangings: 1 }; })).toBe(true);
    expect(accepts(state => { framesDone(state); state.castle.hall = { stones: 40, beams: 12, fittings: 6, hangings: 2 }; state.castle.doneDays.hall = 9; })).toBe(true);
  });

  it('accepts frames part-raised, a wall begun, and towers part-built in their order', () => {
    expect(accepts(state => { cartMade(state); state.castle.frames = 4; })).toBe(true);
    expect(accepts(state => { framesDone(state); state.castle.wall = { north: 30, east: 12, south: 0, west: 0 }; state.castle.doneDays['wall-north'] = 8; })).toBe(true);
    expect(accepts(state => { cartMade(state); wallDone(state.castle); state.castle.towers.nw = { stones: 20, beams: 2, fittings: 0 }; state.castle.towers.ne = { ...fullTower }; state.castle.doneDays['tower-ne'] = 9; })).toBe(true);
  });

  it.each<[string, (state: GameState) => void]>([
    ['frames before the cart is made', state => { state.castle.frames = 2; }],
    ['a frames day with the frames unfinished', state => { cartMade(state); state.castle.frames = 10; state.castle.doneDays.frames = 7; }],
    ['finished frames with no day', state => { cartMade(state); state.castle.frames = 12; }],
    ['a wall day with its side unfinished', state => { framesDone(state); state.castle.wall.east = 29; state.castle.doneDays['wall-east'] = 8; }],
    ['a finished wall side with no day', state => { framesDone(state); state.castle.wall.east = 30; }],
    ['a tower day with the tower unfinished', state => { cartMade(state); wallDone(state.castle); state.castle.towers.se = { stones: 20, beams: 4, fittings: 1 }; state.castle.doneDays['tower-se'] = 9; }],
    ['a finished tower with no day', state => { cartMade(state); wallDone(state.castle); state.castle.towers.se = { ...fullTower }; }],
    ['tower beams before its stones are done', state => { cartMade(state); wallDone(state.castle); state.castle.towers.nw = { stones: 19, beams: 1, fittings: 0 }; }],
    ['tower fittings before its beams are done', state => { cartMade(state); wallDone(state.castle); state.castle.towers.nw = { stones: 20, beams: 3, fittings: 1 }; }],
    ['a road day with the road unfinished', state => { state.castle.road = 29; state.castle.doneDays = { road: 5 }; }],
    ['a finished road with no day', state => { state.castle.road = 30; state.castle.doneDays = {}; }],
    ['a done day in the future', state => { state.castle.road = 30; state.castle.doneDays = { road: 9999 }; }],
    ['a done day of zero', state => { state.castle.road = 30; state.castle.doneDays = { road: 0 }; }],
    ['a done day that is not whole', state => { state.castle.road = 30; state.castle.doneDays = { road: 5.5 }; }],
    ['a done day for an unknown section', state => { (state.castle.doneDays as Record<string, number>).keep = 5; }],
    ['done days that are not a map', state => { (state.castle as unknown as Record<string, unknown>).doneDays = null; }],
    ['a road over its length', state => { state.castle.road = 31; }],
    ['more stone in the cart than it holds', state => { state.castle.cart.stone = 41; }],
    ['a wall side over its length', state => { state.castle.wall.north = 31; }],
    ['a reveal with no first climb', state => { state.castle.firstClimbDay = null; }],
    ['a road before the reveal', state => { state.castle.revealedDay = null; state.castle.road = 1; }],
    ['a cart before the road is done', state => { state.castle.road = 29; state.progress.workshop.stoneCart = true; }],
    ['wall stones before the frames', state => { state.castle.frames = 11; state.castle.wall.east = 1; }],
    ['tower stones before the wall is done', state => { state.castle.frames = 12; state.castle.wall = { north: 30, east: 30, south: 30, west: 29 }; state.castle.towers.nw.stones = 1; }],
    ['a portcullis before the wall is done', state => { state.progress.workshop.portcullis = true; }],
    ['a gatehouse day with the gatehouse unfinished', state => { cartMade(state); wallDone(state.castle); state.progress.workshop.portcullis = true; state.castle.gatehouse = 29; state.castle.doneDays.gatehouse = 9; }],
    ['a finished gatehouse with no day', state => { cartMade(state); wallDone(state.castle); state.progress.workshop.portcullis = true; state.castle.gatehouse = 30; }],
    ['gatehouse stones with no portcullis made', state => { cartMade(state); wallDone(state.castle); state.castle.gatehouse = 1; }],
    ['gatehouse stones before the wall is done', state => { cartMade(state); state.progress.workshop.portcullis = true; state.castle.gatehouse = 1; }],
    ['a gatehouse over its length', state => { cartMade(state); wallDone(state.castle); state.progress.workshop.portcullis = true; state.castle.gatehouse = 31; }],
    ['a moat day with the moat unfinished', state => { cartMade(state); wallDone(state.castle); state.castle.moat = { stretches: 15, lastDugDay: 8, dugDay: null }; state.castle.doneDays.moat = 8; }],
    ['a finished moat with no day', state => { cartMade(state); wallDone(state.castle); state.castle.moat = { stretches: 16, lastDugDay: 8, dugDay: 8 }; }],
    ['a moat day that is not the day it was dug', state => { cartMade(state); wallDone(state.castle); state.castle.moat = { stretches: 16, lastDugDay: 8, dugDay: 8 }; state.castle.doneDays.moat = 7; }],
    ['a dug moat day with the moat unfinished', state => { cartMade(state); wallDone(state.castle); state.castle.moat = { stretches: 15, lastDugDay: 8, dugDay: 8 }; }],
    ['moat stretches before the wall is done', state => { state.castle.moat = { stretches: 1, lastDugDay: 8, dugDay: null }; }],
    ['hall beams before its stones are done', state => { framesDone(state); state.castle.hall = { stones: 39, beams: 1, fittings: 0, hangings: 0 }; }],
    ['hall fittings before its beams are done', state => { framesDone(state); state.castle.hall = { stones: 40, beams: 11, fittings: 1, hangings: 0 }; }],
    ['hall hangings before its fittings are done', state => { framesDone(state); state.castle.hall = { stones: 40, beams: 12, fittings: 5, hangings: 1 }; }],
    ['a hall day with the hall unfinished', state => { framesDone(state); state.castle.hall = { stones: 40, beams: 12, fittings: 6, hangings: 1 }; state.castle.doneDays.hall = 9; }],
    ['a finished hall with no day', state => { framesDone(state); state.castle.hall = { stones: 40, beams: 12, fittings: 6, hangings: 2 }; }],
    ['a hall over its hangings', state => { framesDone(state); state.castle.hall = { stones: 40, beams: 12, fittings: 6, hangings: 3 }; }],
    ['bread over the feast\'s need', state => { state.castle.feast.bread = 5; }],
    ['a finish with every section short', state => { state.castle.finishedDay = 9; }],
    ['moving into the hall before the finish', state => { state.castle.home = 'hall'; }],
    ['the hall offered as a home before the finish', state => { state.castle.offeredHome = true; }],
    ['a reveal with the keep not finished', state => { state.keep = { stones: 59, door: true, startedDay: 1, finishedDay: null, ponyNight: null }; }],
    ['a castle that is not an object', state => { (state as unknown as Record<string, unknown>).castle = null; }]
  ])('rejects %s', (_, change) => {
    expect(accepts(change)).toBe(false);
  });
});

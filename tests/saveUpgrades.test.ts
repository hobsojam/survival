import { describe, expect, it } from 'vitest';
import { createGame } from '../src/game/state';
import { loadGame, saveGame, SAVE_KEY, SAVE_VERSION } from '../src/game/save';
import { emptyField } from '../src/game/field';
import { beehiveCamp } from './beehiveCamp';
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

describe('the version 31 upgrade: timber yard', () => {
  it('starts older woodpiles without a yard and preserves their stored wood', () => {
    const base = createGame();
    const old = { ...base, storedWood: 12, structures: { ...base.structures, woodpile: true } } as Record<string, any>;
    delete old.structures.timberYard;
    const upgraded = SAVE_UPGRADES[30](old) as ReturnType<typeof createGame>;
    expect(upgraded.structures).toMatchObject({ woodpile: true, timberYard: false });
    expect(upgraded.storedWood).toBe(12);
    expect(old.structures.timberYard).toBeUndefined();
    const storage = new MemoryStorage();
    const freshOld = createGame() as Record<string, any>;
    delete freshOld.structures.timberYard;
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 30, state: freshOld }));
    expect(loadGame(storage)).toMatchObject({ kind: 'loaded', state: { structures: { timberYard: false } } });
  });
});

describe('the version 26 upgrade: the grain field', () => {
  /** A version 25 camp: today's game without anything the field brought. */
  function version25(changes: Record<string, unknown> = {}) {
    const game = createGame() as unknown as Record<string, any>;
    const { flour: _f, bread: _b, ...food } = game.inventory.food;
    const { flour: _lf, bread: _lb, ...larder } = game.larder;
    const { field: _sf, granary: _sg, ...structures } = game.structures;
    const { harvestTools: _ht, quern: _q, ...workshop } = game.progress.workshop;
    const { field: _drop, ...state } = game;
    return { ...state, structures, progress: { ...game.progress, workshop }, nodes: game.nodes.filter((node: { kind: string }) => node.kind !== 'wildGrain'),
      inventory: { ...game.inventory, food }, larder, ...changes };
  }

  it('adds an empty field, no new buildings or tools, the wild grain, and no flour or bread', () => {
    const upgraded = SAVE_UPGRADES[25](structuredClone(version25())) as ReturnType<typeof createGame>;
    const fresh = createGame();
    expect(upgraded.field).toEqual(emptyField());
    expect(upgraded.structures).toEqual(fresh.structures);
    expect(upgraded.progress.workshop).toEqual(fresh.progress.workshop);
    expect(upgraded.nodes).toEqual(fresh.nodes);
    expect(upgraded.inventory.food).toEqual(fresh.inventory.food);
    expect(upgraded.larder).toEqual(fresh.larder);
    expect(upgraded.lastSpoiled).toBeNull();
  });

  it('counts no spoiled bread on the last spoiled dawn', () => {
    const upgraded = SAVE_UPGRADES[25](structuredClone(version25({ day: 5, lastSpoiled: { day: 4, berry: 1, greens: 0 } }))) as ReturnType<typeof createGame>;
    expect(upgraded.lastSpoiled).toEqual({ day: 4, berry: 1, greens: 0, bread: 0 });
  });

  it('loads a version 25 camp', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 25, state: version25() }));
    expect(loadGame(storage).kind).toBe('loaded');
  });
});

describe('the version 27 upgrade: the windmill and bakery', () => {
  /** A version 26 camp: today's game without anything the windmill and bakery brought. */
  function version26(changes: Record<string, unknown> = {}) {
    const game = createGame() as unknown as Record<string, any>;
    const { windmill: _w, bakery: _b, ...structures } = game.structures;
    const { millFlour: _m, bakery: _s, ...state } = game;
    return { ...state, structures, ...changes };
  }

  it('adds no windmill or bakery, an empty flour bin and a bare shelf', () => {
    const upgraded = SAVE_UPGRADES[26](structuredClone(version26())) as ReturnType<typeof createGame>;
    const fresh = createGame();
    expect(upgraded.structures).toEqual(fresh.structures);
    expect(upgraded.millFlour).toBe(0);
    expect(upgraded.bakery).toEqual({ shelf: [], lastBaked: null, resumed: null });
  });

  it('leaves a camp that already has them as it was', () => {
    const current = { ...createGame(), millFlour: 3, bakery: { shelf: [4], lastBaked: 4, resumed: 4 } };
    expect(SAVE_UPGRADES[26](structuredClone(current))).toEqual(current);
  });

  it('loads a version 26 camp', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 26, state: version26() }));
    expect(loadGame(storage).kind).toBe('loaded');
  });
});

describe('the version 28 upgrade: the beehive', () => {
  /** A version 27 camp: today's game without anything the beehive brought. */
  function version27(changes: Record<string, unknown> = {}) {
    const game = createGame() as unknown as Record<string, any>;
    const { beehive: _h, ...structures } = game.structures;
    const { beehive: _b, ...state } = game;
    return { ...state, structures, ...changes };
  }

  it('adds no beehive and an empty hive', () => {
    const upgraded = SAVE_UPGRADES[27](structuredClone(version27())) as ReturnType<typeof createGame>;
    expect(upgraded.structures.beehive).toBe(false);
    expect(upgraded.beehive).toEqual({ honey: 0, nextHoney: null });
  });

  it('leaves a camp that already has a hive as it was', () => {
    const game = createGame();
    const current = { ...game, structures: { ...game.structures, beehive: true }, beehive: { honey: 2, nextHoney: 9 } };
    expect(SAVE_UPGRADES[27](structuredClone(current))).toEqual(current);
  });

  it('loads a version 27 camp with the north far ground cleared', () => {
    const camp = beehiveCamp({ built: false }) as unknown as Record<string, any>;
    const { beehive: _h, ...structures } = camp.structures;
    const { beehive: _b, ...state } = camp;
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 27, state: { ...state, structures } }));
    const loaded = loadGame(storage);
    expect(loaded.kind).toBe('loaded');
    expect(loaded.kind === 'loaded' && [loaded.state.structures.beehive, loaded.state.beehive]).toEqual([false, { honey: 0, nextHoney: null }]);
  });
});

describe('the version 29 upgrade: the wild tree out of camp', () => {
  /** A version 28 camp: today's game with the broadleaf still standing on the north far ground. */
  function version28(readyDay = 1) {
    const game = createGame();
    return { ...game, trees: game.trees.map(tree => tree.id === 'tree-1' ? { ...tree, x: 17, y: 9, readyDay } : tree) };
  }

  it('moves the broadleaf off the north far ground, keeping its stump\'s regrowth', () => {
    const upgraded = SAVE_UPGRADES[28](structuredClone(version28(30))) as ReturnType<typeof createGame>;
    expect(upgraded.trees.find(tree => tree.id === 'tree-1')).toEqual({ id: 'tree-1', x: 16, y: 4, sprite: 'treeBroadleaf', readyDay: 30 });
    expect(upgraded.trees.filter(tree => tree.id !== 'tree-1')).toEqual(createGame().trees.filter(tree => tree.id !== 'tree-1'));
  });

  it('leaves a camp whose tree has already moved as it was', () => {
    const current = createGame();
    expect(SAVE_UPGRADES[28](structuredClone(current))).toEqual(current);
  });

  it('loads a version 28 camp', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 28, state: version28() }));
    const loaded = loadGame(storage);
    expect(loaded.kind === 'loaded' && loaded.state.trees.find(tree => tree.id === 'tree-1')).toMatchObject({ x: 16, y: 4 });
  });
});

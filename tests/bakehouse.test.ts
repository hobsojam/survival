import { describe, expect, it } from 'vitest';
import { BALANCE, BUILDINGS, createGame, type GameState } from '../src/game/state';
import { loadGame, SAVE_KEY, SAVE_VERSION } from '../src/game/save';
import { applyAction, groundBlocker } from '../src/game/rules';
import { millGrainBlocker, milledFlour } from '../src/game/bakehouse';
import { addFood, availableFood, emptyFood, reachableMillFlour, spendFood } from '../src/game/food';
import { dishBlocker } from '../src/game/cooking';
import { nightStart } from '../src/game/calendar';
import { TOO_TIRED_MESSAGE, workSeconds } from '../src/game/needs';
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

describe('milling at the windmill', () => {
  const tired = (state: GameState): GameState => ({ ...state, player: { ...state.player, energy: 0 } });

  it('refuses until it can grind', () => {
    expect(millGrainBlocker(bakehouseCamp({ windmill: false, grain: 6 }))).toBe('Build the windmill first.');
    const away = bakehouseCamp({ grain: 6 });
    expect(millGrainBlocker({ ...away, player: { ...away.player, x: 2, y: 2 } })).toBe('Return to camp to mill the grain.');
    expect(millGrainBlocker(bakehouseCamp({ grain: 1 }))).toBe('There isn\'t enough grain in the granary to mill.');
    expect(millGrainBlocker(bakehouseCamp({ grain: 6, millFlour: 8 }))).toBe('The mill\'s flour bin is full.');
    expect(millGrainBlocker(tired(bakehouseCamp({ grain: 6 })))).toBe(TOO_TIRED_MESSAGE);
    expect(millGrainBlocker(bakehouseCamp({ grain: 6 }))).toBeNull();
  });

  it('grinds the whole granary in one heavy job, leaving an odd grain', () => {
    const before = bakehouseCamp({ grain: 15 });
    const { state: after, message } = applyAction(before, { type: 'millGrain' });
    expect(after.field.grain).toBe(1);
    expect(after.millFlour).toBe(7);
    expect(after.inventory.food.flour).toBe(0);
    expect(message).toBe('The sails turn, and the millstones grind 7 flour.');
    expect(after.player.energy).toBe(before.player.energy - BALANCE.fieldWorkEnergy);
    expect(after.timeOfDay).toBeCloseTo(before.timeOfDay + workSeconds(before, BALANCE.fieldWorkSeconds));
  });

  it('grinds only what fits in a nearly full bin, and the rest stays as grain', () => {
    const { state: after, message } = applyAction(bakehouseCamp({ grain: 16, millFlour: 7 }), { type: 'millGrain' });
    expect(after).toMatchObject({ millFlour: 8, field: { grain: 14 } });
    expect(message).toBe('The sails turn, and the millstones grind 1 flour. The bin is full.');
    expect(milledFlour(bakehouseCamp({ grain: 16, millFlour: 7 }))).toBe(1);
  });

  it('refuses without changing anything', () => {
    const state = bakehouseCamp({ grain: 1 });
    expect(applyAction(state, { type: 'millGrain' })).toEqual({ state, message: 'There isn\'t enough grain in the granary to mill.' });
  });
});

describe('baking at the fire from the mill\'s flour', () => {
  const evening = (options: Parameters<typeof bakehouseCamp>[0] = {}, bagFlour = 0): GameState => {
    const base = bakehouseCamp(options);
    return { ...base, timeOfDay: nightStart(22) + 10, fireFuel: 60, inventory: { ...base.inventory, food: addFood(emptyFood(), 'flour', bagFlour, 22) } };
  };

  it('reaches the mill\'s flour only in camp, after the bag', () => {
    expect(availableFood(evening({ millFlour: 3 }, 1), 'flour')).toBe(4);
    expect(reachableMillFlour(evening({ millFlour: 3 }))).toBe(3);
    const away = evening({ millFlour: 3 }, 1);
    expect(availableFood({ ...away, player: { ...away.player, x: 2, y: 2 } }, 'flour')).toBe(1);
    expect(reachableMillFlour(evening({ windmill: false }))).toBe(0);
  });

  it('bakes from the bag\'s flour first, then the mill\'s', () => {
    const fromBag = applyAction(evening({ millFlour: 3 }, 1), { type: 'cook', dish: 'loaf' }).state;
    expect(fromBag).toMatchObject({ millFlour: 3, inventory: { food: { flour: 0, bread: [22] } } });
    const fromMill = applyAction(evening({ millFlour: 3 }), { type: 'cook', dish: 'loaf' }).state;
    expect(fromMill).toMatchObject({ millFlour: 2, inventory: { food: { flour: 0, bread: [22] } } });
  });

  it('spends across the bag and the mill when the bag runs short', () => {
    const paid = spendFood(evening({ millFlour: 3 }, 1), 'flour', 3)!;
    expect(paid.inventory.food.flour).toBe(0);
    expect(paid.millFlour).toBe(1);
    expect(spendFood(evening({ millFlour: 1 }, 1), 'flour', 3)).toBeNull();
  });

  it('refuses a loaf from the mill\'s flour alone when the bag is full', () => {
    const full = evening({ millFlour: 3 });
    expect(dishBlocker({ ...full, inventory: { ...full.inventory, wood: 8 } }, 'loaf')).toBe('Make room in your bag for the loaf.');
    const withBagFlour = evening({ millFlour: 3 }, 1);
    expect(dishBlocker({ ...withBagFlour, inventory: { ...withBagFlour.inventory, wood: 7 } }, 'loaf')).toBeNull();
  });
});

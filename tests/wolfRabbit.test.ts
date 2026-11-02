// A wolf friend now and then brings a rabbit home in winter. It's a quiet easter egg: nothing on screen
// mentions a rabbit until the first one turns up.
import { describe, expect, it } from 'vitest';
import { nightStart } from '../src/game/calendar';
import { addFood, availableFood, emptyFood, quickEatItem } from '../src/game/food';
import { newsBetween } from '../src/game/news';
import { advanceTime, applyAction } from '../src/game/rules';
import { loadGame, saveGame, SAVE_KEY } from '../src/game/save';
import { upgradeSave } from '../src/game/saveUpgrades';
import { BALANCE, createGame, type Friend, type GameState } from '../src/game/state';
import { bagView, foodLaidByDays, larderView, nightDishesView } from '../src/ui/panels';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
}

const WINTER_DAY = 14;
const RABBIT_NEWS = 'Your wolf left a rabbit by your bedroll.';

/** A winter camp with the shelter up, standing at the fire, with a friend made long ago. */
function camp(friend: Friend | null = 'wolf', changes: Partial<GameState> = {}): GameState {
  const base = createGame();
  return {
    ...base,
    day: WINTER_DAY,
    timeOfDay: 30,
    progress: { ...base.progress, nextStormDay: null, hearthUnlocked: true },
    structures: { ...base.structures, shelter: true },
    player: { ...base.player, x: BALANCE.campX, y: BALANCE.campY },
    companion: { ...base.companion, friend, since: 1, lastFind: WINTER_DAY, lastGift: 1 },
    ...changes
  };
}
const withRabbits = (state: GameState, n: number): GameState => ({ ...state, inventory: { ...state.inventory, food: addFood(state.inventory.food, 'rabbit', n, state.day) } });
const rabbits = (state: GameState): number => availableFood(state, 'rabbit');

/** Ticks across the dawn into `day`, with the fire well fed. */
function dawnInto(state: GameState, day: number) {
  const before = { ...state, day: day - 1, timeOfDay: BALANCE.daySeconds - 0.5, fireFuel: 100 };
  const after = advanceTime(before, 1);
  return { after, news: newsBetween(before, after) };
}

describe('the wolf brings a rabbit', () => {
  it('leaves one by the bedroll at a winter dawn at camp, then every second dawn', () => {
    const first = dawnInto(camp(), WINTER_DAY);
    expect(rabbits(first.after)).toBe(1);
    expect(first.after.companion.lastGift).toBe(WINTER_DAY);
    expect(first.news).toContain(RABBIT_NEWS);
    expect(rabbits(dawnInto(first.after, WINTER_DAY + 1).after)).toBe(1);
    expect(rabbits(dawnInto(first.after, WINTER_DAY + 2).after)).toBe(2);
  });

  it('brings nothing outside winter, from any other friend, or with no friend', () => {
    expect(rabbits(dawnInto(camp('wolf', { day: 5 }), 5).after)).toBe(0);
    expect(rabbits(dawnInto(camp('wolf', { day: 25 }), 25).after)).toBe(0);
    for (const friend of ['fox', 'bird', null] as const) expect(rabbits(dawnInto(camp(friend), WINTER_DAY).after)).toBe(0);
  });

  it('waits while the survivor is away from camp or the bag is full', () => {
    const away = dawnInto(camp('wolf', { area: 'quarry', player: { ...createGame().player, x: 20, y: 15 } }), WINTER_DAY).after;
    expect([rabbits(away), away.companion.lastGift]).toEqual([0, 1]);
    const full = dawnInto(camp('wolf', { inventory: { ...createGame().inventory, wood: 8 } }), WINTER_DAY).after;
    expect([rabbits(full), full.companion.lastGift]).toEqual([0, 1]);
  });
});

describe('the rabbit as food', () => {
  const night = (state: GameState = withRabbits(camp(), 1)): GameState =>
    ({ ...state, timeOfDay: nightStart(WINTER_DAY) + 1, fireFuel: 200, player: { ...state.player, hunger: 20, warmth: 50 } });

  it("isn't eaten raw, and Q never picks it", () => {
    const refused = applyAction(night(), { type: 'eat', item: 'rabbit' } as never);
    expect(rabbits(refused.state)).toBe(1);
    expect(refused.state.player.hunger).toBe(20);
    expect(quickEatItem(night())).toBeNull();
  });

  it('roasts at the fire with no pot into a warm, hearty meal that counts for a sick survivor', () => {
    const sick = night({ ...withRabbits(camp(), 1), sickness: { ...createGame().sickness, sick: true, sickFromDay: WINTER_DAY - 1 } });
    const cooked = applyAction(sick, { type: 'cook', dish: 'rabbit' });
    expect(cooked.message).toBe('You roast the rabbit over the fire. A warm, hearty meal.');
    expect(cooked.state.player.hunger).toBeCloseTo(20 - BALANCE.cookSeconds / 8 + BALANCE.cookedRabbitHunger);
    expect(cooked.state.player.warmth).toBeGreaterThan(sick.player.warmth);
    expect(cooked.state.sickness.ateWarm).toBe(true);
    expect(rabbits(cooked.state)).toBe(0);
  });

  it('counts toward the food laid by as the meal it makes', () => {
    expect(foodLaidByDays(withRabbits(camp(), 3))).toBe(Math.floor(3 * BALANCE.cookedRabbitHunger / 30));
  });
});

describe('keeping the secret', () => {
  it('shows no rabbit anywhere until one has been brought', () => {
    const none = night();
    expect(nightDishesView(none).map(dish => dish.dish)).not.toContain('rabbit');
    expect(bagView(none).foods.rabbit.shown).toBe(false);
    const stocked = { ...none, structures: { ...none.structures, larder: true } };
    expect(larderView(stocked).rows.map(row => row.item)).not.toContain('rabbit');
  });

  it('shows the rabbit, and a way to cook it, once there is one', () => {
    const one = withRabbits(night(), 1);
    expect(nightDishesView(one).map(dish => dish.dish)).toContain('rabbit');
    expect(bagView(one).foods.rabbit).toMatchObject({ count: 1, shown: true });
  });

  function night(): GameState {
    return { ...camp(), timeOfDay: nightStart(WINTER_DAY) + 1, fireFuel: 200 };
  }
});

describe('saving rabbits', () => {
  it('keeps the rabbits through a save', () => {
    const storage = new MemoryStorage();
    expect(saveGame(storage, withRabbits(camp(), 2)).ok).toBe(true);
    const loaded = loadGame(storage);
    expect(loaded.kind === 'loaded' && loaded.state.inventory.food.rabbit).toBe(2);
    expect(storage.getItem(SAVE_KEY)).toContain('"rabbit":2');
  });

  it('brings a version 24 save in with no rabbits', () => {
    const game = createGame();
    const { rabbit: _bag, ...bagFood } = game.inventory.food;
    const { rabbit: _larder, ...larderFood } = game.larder;
    const old = { ...game, inventory: { ...game.inventory, food: bagFood }, larder: larderFood };
    const upgraded = upgradeSave(24, old);
    expect(upgraded.ok && upgraded.state).toMatchObject({ inventory: { food: { rabbit: 0 } }, larder: { rabbit: 0 } });
  });

  it('starts a new camp with no rabbits', () => {
    expect(createGame().inventory.food.rabbit).toBe(0);
    expect(emptyFood().rabbit).toBe(0);
  });
});

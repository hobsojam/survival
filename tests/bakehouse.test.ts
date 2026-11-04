import { describe, expect, it } from 'vitest';
import { BALANCE, BUILDINGS, createGame, type GameState } from '../src/game/state';
import { loadGame, SAVE_KEY, SAVE_VERSION } from '../src/game/save';
import { advanceTime, applyAction, groundBlocker } from '../src/game/rules';
import { bakeryNews, millGrainBlocker, milledFlour, takeLoafBlocker } from '../src/game/bakehouse';
import { newsBetween } from '../src/game/news';
import { journalSeason, recordJournal } from '../src/game/journalEntries';
import { currentPage, journalPageView } from '../src/ui/yearJournal';
import { addFood, availableFood, emptyFood, reachableMillFlour, spendFood } from '../src/game/food';
import { dishBlocker } from '../src/game/cooking';
import { bakeryPanelView, foodLaidByDays, windmillPanelView } from '../src/ui/panels';
import { CAMP_STRUCTURES, sceneVisuals } from '../src/scene/visuals';
import { sprites } from '../src/art/sprites';
import { inClearing } from '../src/game/clearing';
import { PATH_DESTINATIONS, segmentDistance } from './placement';
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
    expect(game.bakery).toEqual({ shelf: [], lastBaked: null, resumed: null });
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
    const state = bakehouseCamp({ millFlour: 8, shelf: [21, 22], lastBaked: 22, resumed: 21 });
    const loaded = roundTrip(state);
    expect(loaded.kind).toBe('loaded');
    expect(loaded.kind === 'loaded' && [loaded.state.millFlour, loaded.state.bakery]).toEqual([8, { shelf: [21, 22], lastBaked: 22, resumed: 21 }]);
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
      bakehouseCamp({ bakery: false, lastBaked: null, resumed: 22 }),
      bakehouseCamp({ lastBaked: 20, resumed: 21 }),
      bakehouseCamp({ lastBaked: null, resumed: 20 }),
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

  it('spends the bag\'s flour, then the larder\'s, and the mill\'s last', () => {
    const base = evening({ millFlour: 3 }, 1);
    const stocked = { ...base, structures: { ...base.structures, larder: true }, larder: addFood(emptyFood(), 'flour', 1, 22) };
    expect(availableFood(stocked, 'flour')).toBe(5);
    expect(spendFood(stocked, 'flour', 1)).toMatchObject({ millFlour: 3, larder: { flour: 1 }, inventory: { food: { flour: 0 } } });
    expect(spendFood(stocked, 'flour', 2)).toMatchObject({ millFlour: 3, larder: { flour: 0 }, inventory: { food: { flour: 0 } } });
    expect(spendFood(stocked, 'flour', 3)).toMatchObject({ millFlour: 2, larder: { flour: 0 }, inventory: { food: { flour: 0 } } });
  });

  it('refuses a loaf from the mill\'s flour alone when the bag is full', () => {
    const full = evening({ millFlour: 3 });
    expect(dishBlocker({ ...full, inventory: { ...full.inventory, wood: 8 } }, 'loaf')).toBe('Make room in your bag for the loaf.');
    const withBagFlour = evening({ millFlour: 3 }, 1);
    expect(dishBlocker({ ...withBagFlour, inventory: { ...withBagFlour.inventory, wood: 7 } }, 'loaf')).toBeNull();
  });
});

/** The state just before dawn, rested through it into the next day. */
const acrossDawn = (state: GameState): GameState => advanceTime({ ...state, timeOfDay: BALANCE.daySeconds - 1 }, 2, 'resting');
const away = (state: GameState): GameState => ({ ...state, player: { ...state.player, x: 2, y: 2 } });

describe('the morning loaf', () => {
  it('bakes one loaf at dawn from the mill\'s flour, wherever the survivor is', () => {
    const after = acrossDawn(away(bakehouseCamp({ millFlour: 3 })));
    expect(after.day).toBe(23);
    expect(after.millFlour).toBe(2);
    expect(after.bakery).toEqual({ shelf: [23], lastBaked: 23, resumed: 23 });
  });

  it('waits while the shelf is full or the bin is empty, using nothing', () => {
    expect(acrossDawn(bakehouseCamp({ millFlour: 3, shelf: [21, 22], lastBaked: 22 }))).toMatchObject({ millFlour: 3, bakery: { shelf: [21, 22], lastBaked: 22 } });
    expect(acrossDawn(bakehouseCamp({ millFlour: 0, lastBaked: 20 })).bakery).toEqual({ shelf: [], lastBaked: 20, resumed: null });
    expect(acrossDawn(bakehouseCamp({ millFlour: 3, bakery: false })).millFlour).toBe(3);
  });

  it('throws out a shelf loaf five dawns after baking, then bakes into the space', () => {
    const after = acrossDawn(bakehouseCamp({ millFlour: 1, shelf: [18, 21], lastBaked: 21 }));
    expect(after.bakery.shelf).toEqual([21, 23]);
    expect(after.lastSpoiled).toEqual({ day: 23, berry: 0, greens: 0, bread: 1, apple: 0, egg: 0 });
  });

  it('keeps a shelf loaf through its fourth dawn', () => {
    expect(acrossDawn(bakehouseCamp({ shelf: [19] })).bakery.shelf).toEqual([19]);
  });

  it('says so on the first bake and after a pause, never two mornings running', () => {
    const pair = (lastBaked: number | null, millFlour: number) => {
      const before = bakehouseCamp({ millFlour, lastBaked });
      return [before, acrossDawn(before)] as const;
    };
    expect(bakeryNews(...pair(null, 1))).toBe('Fresh bread from the oven this morning.');
    expect(bakeryNews(...pair(22, 1))).toBeNull();
    expect(bakeryNews(...pair(20, 1))).toBe('Fresh bread from the oven this morning.');
    expect(bakeryNews(...pair(20, 0))).toBeNull();
    const before = bakehouseCamp({ millFlour: 1 });
    expect(newsBetween(before, acrossDawn(before))).toContain('Fresh bread from the oven this morning.');
  });
});

describe('the morning line across more than one dawn', () => {
  const twoDawns = (state: GameState): GameState => advanceTime({ ...state, timeOfDay: BALANCE.daySeconds - 1 }, BALANCE.daySeconds + 2, 'resting');

  it('says so when the oven waited one morning and baked the next', () => {
    const before = bakehouseCamp({ millFlour: 1, shelf: [19, 22], lastBaked: 22 });
    const after = twoDawns(before);
    expect(after.day).toBe(24);
    expect(after.bakery.shelf).toEqual([22, 24]);
    expect(bakeryNews(before, after)).toBe('Fresh bread from the oven this morning.');
  });

  it('stays quiet when the oven baked both mornings', () => {
    const before = bakehouseCamp({ millFlour: 2, shelf: [], lastBaked: 22 });
    const after = twoDawns(before);
    expect(after.bakery.shelf).toEqual([23, 24]);
    expect(bakeryNews(before, after)).toBeNull();
  });
});

describe('taking a loaf', () => {
  it('moves the oldest shelf loaf into the bag, keeping its bake day, in no time', () => {
    const before = bakehouseCamp({ shelf: [20, 22], lastBaked: 22 });
    const { state: after, message } = applyAction(before, { type: 'takeLoaf' });
    expect(after.bakery.shelf).toEqual([22]);
    expect(after.inventory.food.bread).toEqual([20]);
    expect(after.timeOfDay).toBe(before.timeOfDay);
    expect(message).toBe('You take a loaf from the bakery shelf.');
  });

  it('refuses with no bakery, away from camp, an empty shelf, or a full bag', () => {
    expect(takeLoafBlocker(bakehouseCamp({ bakery: false }))).toBe('Build the bakery first.');
    expect(takeLoafBlocker(away(bakehouseCamp({ shelf: [22], lastBaked: 22 })))).toBe('Return to camp to take a loaf.');
    expect(takeLoafBlocker(bakehouseCamp())).toBe('There\'s no loaf on the shelf yet.');
    const full = bakehouseCamp({ shelf: [22], lastBaked: 22 });
    expect(takeLoafBlocker({ ...full, inventory: { ...full.inventory, wood: 8 } })).toBe('Make room in your bag for the loaf.');
    expect(takeLoafBlocker(full)).toBeNull();
  });

  it('lets a four-day-old loaf taken into the bag go soft at the next dawn, by the bag\'s rule', () => {
    const taken = applyAction(bakehouseCamp({ shelf: [19], lastBaked: 19 }), { type: 'takeLoaf' }).state;
    expect(acrossDawn(taken).inventory.food.bread).toEqual([]);
  });
});

describe('the windmill and bakery panels', () => {
  it('shows the mill\'s flour and why milling waits', () => {
    expect(windmillPanelView(bakehouseCamp({ millFlour: 3, grain: 6 }))).toEqual({ shown: true, stored: '3 of 8 flour', mill: { disabled: false, hint: '' } });
    expect(windmillPanelView(bakehouseCamp({ grain: 1 })).mill).toEqual({ disabled: true, hint: 'There isn\'t enough grain in the granary to mill.' });
    expect(windmillPanelView(bakehouseCamp({ windmill: false })).shown).toBe(false);
  });

  it('shows the loaves on the shelf, one going soft, and the take button', () => {
    expect(bakeryPanelView(bakehouseCamp({ shelf: [22], lastBaked: 22 }))).toEqual({ shown: true, shelf: '1 of 2 loaves on the shelf', note: '', take: { disabled: false, hint: '' } });
    expect(bakeryPanelView(bakehouseCamp({ shelf: [18, 22], lastBaked: 22 }))).toMatchObject({ shelf: '2 of 2 loaves on the shelf', note: '(1 going soft)' });
    expect(bakeryPanelView(bakehouseCamp()).take).toEqual({ disabled: true, hint: 'There\'s no loaf on the shelf yet.' });
    expect(bakeryPanelView(bakehouseCamp({ bakery: false })).shown).toBe(false);
  });

  it('counts the mill\'s flour and the shelf\'s loaves as food laid by', () => {
    expect(foodLaidByDays(bakehouseCamp())).toBe(0);
    expect(foodLaidByDays(bakehouseCamp({ millFlour: 4, shelf: [22, 22], lastBaked: 22 }))).toBe(10);
    expect(foodLaidByDays(bakehouseCamp({ millFlour: 1 }))).toBe(1);
    expect(foodLaidByDays(bakehouseCamp({ shelf: [22], lastBaked: 22 }))).toBe(1);
  });
});

describe('the oven in the year journal', () => {
  it('writes down a spring morning the oven bakes', () => {
    const before = bakehouseCamp({ millFlour: 1, day: 21 });
    const after = acrossDawn(before);
    const { state: written, messages } = recordJournal(before, after);
    expect(written.journal.map(entry => entry.id)).toContain('ovenBread');
    expect(messages).toContain('Written in your journal: Woke to warm bread from my own oven.');
    expect(journalSeason('ovenBread')).toBe('spring');
  });

  it('writes nothing on a morning the survivor wakes away from camp', () => {
    const before = away(bakehouseCamp({ millFlour: 1, day: 21 }));
    const after = acrossDawn(before);
    expect(after.bakery.lastBaked).toBe(22);
    expect(recordJournal(before, after).state.journal.map(entry => entry.id)).not.toContain('ovenBread');
  });

  it('writes nothing on a morning the oven waits', () => {
    const before = bakehouseCamp({ day: 21 });
    expect(recordJournal(before, acrossDawn(before)).state.journal.map(entry => entry.id)).not.toContain('ovenBread');
  });

  it('leaves the oven line off the spring page until the bakery stands', () => {
    const spring = (bakery: boolean) => journalPageView(bakehouseCamp({ bakery, day: 22 }), currentPage(22)).blanks;
    expect(spring(true) - spring(false)).toBe(1);
  });
});

describe('the windmill and bakery in camp', () => {
  const { campX, campY } = BALANCE;
  const spot = (id: 'windmill' | 'bakery') => {
    const entry = CAMP_STRUCTURES.find(([other]) => other === id)!;
    return { x: campX + entry[1], y: campY + entry[2] };
  };
  const others = (id: string) => [{ x: campX - 3, y: campY - 2 },
    ...CAMP_STRUCTURES.filter(([other]) => other !== id).map(([, dx, dy]) => ({ x: campX + dx, y: campY + dy }))];
  const textures = (state: GameState, prefix: string, timeMs = 0) =>
    sceneVisuals(state, timeMs).filter(visual => visual.id === prefix || visual.id === `${prefix}Site`).map(visual => visual.texture);

  it('stands each on its own nook, which the far ground alone doesn\'t reach', () => {
    expect(CAMP_STRUCTURES).toContainEqual(['windmill', -2.75, 9.75]);
    expect(CAMP_STRUCTURES).toContainEqual(['bakery', -2, -10]);
    const mill = spot('windmill'), bakery = spot('bakery');
    expect(inClearing(mill.x, mill.y, ['south-near', 'south-far', 'south-outer'])).toBe(true);
    expect(inClearing(mill.x, mill.y, ['south-near', 'south-far'])).toBe(false);
    expect(inClearing(bakery.x, bakery.y, ['north-near', 'north-far', 'north-outer'])).toBe(true);
    expect(inClearing(bakery.x, bakery.y, ['north-near', 'north-far'])).toBe(false);
  });

  it('keeps 2 tiles from the other buildings, clear of the paths and the forage', () => {
    const forage = createGame().nodes.filter(node => node.kind !== 'branch');
    for (const id of ['windmill', 'bakery'] as const) {
      const at = spot(id);
      for (const other of others(id)) expect(Math.hypot(at.x - other.x, at.y - other.y), `${id} by ${other.x},${other.y}`).toBeGreaterThanOrEqual(2);
      for (const [dx, dy] of PATH_DESTINATIONS) expect(segmentDistance(at.x, at.y, dx, dy)).toBeGreaterThanOrEqual(1.5);
      for (const node of forage) expect(Math.hypot(at.x - node.x, at.y - node.y), `${id} by ${node.id}`).toBeGreaterThanOrEqual(2);
      for (const tree of createGame().trees) expect(Math.hypot(at.x - tree.x, at.y - tree.y), `${id} by ${tree.id}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('shows each site once its nook is clear, and nothing before', () => {
    const bare = bakehouseCamp({ windmill: false });
    expect(textures(bare, 'windmill')).toEqual(['windmillSite:still']);
    expect(textures(bare, 'bakery')).toEqual(['bakerySite:still']);
    const uncleared = { ...bare, clearing: { ...bare.clearing, cleared: bare.clearing.cleared.filter(id => id !== 'south-outer' && id !== 'north-outer') } };
    expect(textures(uncleared, 'windmill')).toEqual([]);
    expect(textures(uncleared, 'bakery')).toEqual([]);
  });

  it('turns the sails a frame every 700 ms', () => {
    const state = bakehouseCamp();
    expect(textures(state, 'windmill', 0)).toEqual(['windmill:turn0']);
    expect(textures(state, 'windmill', 700)).toEqual(['windmill:turn1']);
    expect(textures(state, 'windmill', 2800)).toEqual(['windmill:turn0']);
  });

  it('smokes the bakery chimney through the morning it baked, and shows the loaves on its shelf', () => {
    expect(textures({ ...bakehouseCamp({ shelf: [22], lastBaked: 22 }), timeOfDay: 10 }, 'bakery')).toEqual(['bakery:baking']);
    expect(textures({ ...bakehouseCamp({ shelf: [22], lastBaked: 22 }), timeOfDay: BALANCE.daySeconds / 2 }, 'bakery')).toEqual(['bakery:loaves']);
    expect(textures(bakehouseCamp({ shelf: [20], lastBaked: 20 }), 'bakery')).toEqual(['bakery:loaves']);
    expect(textures(bakehouseCamp(), 'bakery')).toEqual(['bakery:cold']);
  });

  it('draws every frame', () => {
    for (const [name, frames] of [['windmill', ['turn0', 'turn1', 'turn2', 'turn3']], ['bakery', ['cold', 'loaves', 'baking']], ['windmillSite', ['still']], ['bakerySite', ['still']]] as const) {
      expect(Object.keys(sprites[name].frames)).toEqual(frames);
    }
  });
});

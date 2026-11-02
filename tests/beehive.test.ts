import { describe, expect, it } from 'vitest';
import { BALANCE, BUILDINGS, createGame, type GameState } from '../src/game/state';
import { loadGame, SAVE_KEY, SAVE_VERSION } from '../src/game/save';
import { advanceTime, applyAction, groundBlocker } from '../src/game/rules';
import { availableFood } from '../src/game/food';
import { takeHoneyBlocker } from '../src/game/beehive';
import { beehivePanelView, foodLaidByDays } from '../src/ui/panels';
import { CAMP_STRUCTURES, sceneVisuals } from '../src/scene/visuals';
import { inClearing } from '../src/game/clearing';
import { nightStart } from '../src/game/calendar';
import { PATH_DESTINATIONS, segmentDistance } from './placement';
import { beehiveCamp } from './beehiveCamp';

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

describe('the beehive to begin with', () => {
  it('starts unbuilt and empty, on the north far ground, for 4 wood and 6 fiber', () => {
    const game = createGame();
    expect(game.structures.beehive).toBe(false);
    expect(game.beehive).toEqual({ honey: 0, nextHoney: null });
    expect(BUILDINGS.beehive).toEqual({ name: 'Beehive', description: 'Keep bees for honey all year', symbol: '❀', cost: { wood: 4, fiber: 6 }, prerequisite: null, ground: 'north-far' });
    expect([BALANCE.hiveHoneyCapacity, BALANCE.hiveHoneyDays]).toEqual([2, 3]);
  });
});

describe('saving the beehive', () => {
  it('saves and loads the honey waiting and the next honey day', () => {
    const loaded = roundTrip(beehiveCamp({ honey: 2, nextHoney: 25 }));
    expect(loaded.kind === 'loaded' && loaded.state.beehive).toEqual({ honey: 2, nextHoney: 25 });
  });

  it('refuses too much or part honey, honey or a honey day without a hive, a hive with no honey day, and a hive on uncleared ground', () => {
    const uncleared = beehiveCamp();
    const bad: GameState[] = [
      beehiveCamp({ honey: 3 }),
      beehiveCamp({ honey: 1.5 }),
      beehiveCamp({ honey: -1 }),
      beehiveCamp({ built: false, honey: 1 }),
      beehiveCamp({ built: false, nextHoney: 25 }),
      beehiveCamp({ nextHoney: null }),
      beehiveCamp({ nextHoney: 2.5 }),
      { ...uncleared, clearing: { ...uncleared.clearing, cleared: ['north-near'] } }
    ];
    for (const state of bad) expect(roundTrip(state).kind, JSON.stringify(state.beehive)).toBe('invalid');
  });
});

const acrossDawn = (state: GameState): GameState => advanceTime({ ...state, timeOfDay: BALANCE.daySeconds - 1 }, 2, 'resting');
const away = (state: GameState): GameState => ({ ...state, player: { ...state.player, x: 2, y: 2 } });
const withBag = (state: GameState, wood: number): GameState => ({ ...state, inventory: { ...state.inventory, wood } });

describe('building the beehive', () => {
  it('costs 4 wood and 6 fiber and starts the bees', () => {
    const before = beehiveCamp({ built: false });
    const stocked = { ...before, progress: { ...before.progress, packWoven: true }, inventory: { ...before.inventory, wood: 5, fiber: 7 } };
    const { state: after, message } = applyAction(stocked, { type: 'build', structureId: 'beehive' });
    expect(message).toBe('Built the beehive.');
    expect(after.structures.beehive).toBe(true);
    expect(after.beehive).toEqual({ honey: 0, nextHoney: 25 });
    expect([after.inventory.wood, after.inventory.fiber]).toEqual([1, 1]);
  });

  it('needs the north far ground cleared', () => {
    const near = { ...beehiveCamp({ built: false }), clearing: { cleared: ['north-near'] as GameState['clearing']['cleared'], marked: null, felled: [] } };
    expect(groundBlocker(near, 'beehive')).not.toBeNull();
    expect(applyAction(near, { type: 'build', structureId: 'beehive' }).message).toBe(groundBlocker(near, 'beehive'));
  });
});

describe('the bees making honey', () => {
  it('makes its first honey three dawns after building', () => {
    const one = acrossDawn(beehiveCamp({ day: 22, nextHoney: 25 }));
    const two = acrossDawn(one);
    expect([one.beehive.honey, two.beehive.honey]).toEqual([0, 0]);
    const three = acrossDawn(two);
    expect(three.day).toBe(25);
    expect(three.beehive).toEqual({ honey: 1, nextHoney: 28 });
  });

  it('makes honey in winter too', () => {
    expect(acrossDawn(beehiveCamp({ day: 15, nextHoney: 16 })).beehive).toEqual({ honey: 1, nextHoney: 19 });
  });

  it('stops at two honey', () => {
    expect(acrossDawn(beehiveCamp({ honey: 2, nextHoney: 23 })).beehive.honey).toBe(2);
  });

  it('makes one honey, not more, after waiting full', () => {
    const waited = beehiveCamp({ day: 22, honey: 2, nextHoney: 10 });
    const emptied = applyAction(withBag(waited, 0), { type: 'takeHoney' }).state;
    const next = acrossDawn(emptied);
    expect(next.beehive).toEqual({ honey: 1, nextHoney: 26 });
    expect(acrossDawn(next).beehive.honey).toBe(1);
  });

  it('makes honey while the survivor is away', () => {
    expect(acrossDawn(away(beehiveCamp({ nextHoney: 23 }))).beehive.honey).toBe(1);
    expect(acrossDawn({ ...beehiveCamp({ nextHoney: 23 }), area: 'quarry' }).beehive.honey).toBe(1);
  });

  it('makes nothing without a hive', () => {
    expect(acrossDawn(beehiveCamp({ built: false })).beehive).toEqual({ honey: 0, nextHoney: null });
  });
});

describe('taking the honey', () => {
  it('takes all the waiting honey into the bag, in no time', () => {
    const before = beehiveCamp({ honey: 2 });
    const { state: after, message } = applyAction(before, { type: 'takeHoney' });
    expect(message).toBe('You take 2 honey from the hive.');
    expect(after.beehive.honey).toBe(0);
    expect(after.inventory.food.honey).toBe(before.inventory.food.honey + 2);
    expect(after.timeOfDay).toBe(before.timeOfDay);
  });

  it('takes what fits and leaves the rest', () => {
    const before = withBag(beehiveCamp({ honey: 2 }), 7);
    const { state: after, message } = applyAction(before, { type: 'takeHoney' });
    expect(message).toBe('You take 1 honey from the hive.');
    expect([after.beehive.honey, after.inventory.food.honey]).toEqual([1, before.inventory.food.honey + 1]);
  });

  it('refuses with no hive', () => {
    expect(takeHoneyBlocker(beehiveCamp({ built: false }))).toBe('Build the beehive first.');
  });

  it('refuses off cleared ground', () => {
    expect(takeHoneyBlocker(away(beehiveCamp({ honey: 1 })))).toBe('Return to camp to take the honey.');
  });

  it('refuses with no honey waiting', () => {
    expect(takeHoneyBlocker(beehiveCamp())).toBe('The bees have no honey for you yet.');
  });

  it('refuses with a full bag', () => {
    const full = withBag(beehiveCamp({ honey: 1 }), 8);
    expect(takeHoneyBlocker(full)).toBe('Make room in your bag for the honey.');
    expect(applyAction(full, { type: 'takeHoney' })).toEqual({ state: full, message: 'Make room in your bag for the honey.' });
  });

  it('keeps hive honey out of reach for eating and cooking', () => {
    expect(availableFood(beehiveCamp({ honey: 2 }), 'honey')).toBe(0);
  });
});

describe('the Beehive panel', () => {
  it('shows the honey waiting and whether it can be taken', () => {
    expect(beehivePanelView(beehiveCamp({ honey: 1 }))).toEqual({ shown: true, stored: '1 of 2 honey', take: { disabled: false, hint: '' } });
    expect(beehivePanelView(beehiveCamp()).take).toEqual({ disabled: true, hint: 'The bees have no honey for you yet.' });
    expect(beehivePanelView(beehiveCamp({ built: false })).shown).toBe(false);
  });

  it('counts the hive\'s honey as food laid by', () => {
    expect(foodLaidByDays(beehiveCamp())).toBe(0);
    expect(foodLaidByDays(beehiveCamp({ honey: 2 }))).toBe(1);
  });
});

describe('the beehive in camp', () => {
  const { campX, campY } = BALANCE;
  const entry = () => CAMP_STRUCTURES.find(([other]) => other === 'beehive')!;
  const spot = () => ({ x: campX + entry()[1], y: campY + entry()[2] });
  const textures = (state: GameState, timeMs = 0) =>
    sceneVisuals(state, timeMs).filter(visual => visual.id === 'beehive' || visual.id === 'beehiveSite').map(visual => visual.texture);

  it('stands east of the house on the north far ground', () => {
    expect(CAMP_STRUCTURES).toContainEqual(['beehive', 1.75, -7.25]);
    expect(inClearing(spot().x, spot().y, ['north-near', 'north-far'])).toBe(true);
    expect(inClearing(spot().x, spot().y, ['north-near'])).toBe(false);
  });

  it('keeps 2 tiles from the other buildings, clear of the paths and the forage', () => {
    const at = spot();
    const others = [{ x: campX - 3, y: campY - 2 }, ...CAMP_STRUCTURES.filter(([other]) => other !== 'beehive').map(([, dx, dy]) => ({ x: campX + dx, y: campY + dy }))];
    for (const other of others) expect(Math.hypot(at.x - other.x, at.y - other.y), `by ${other.x},${other.y}`).toBeGreaterThanOrEqual(2);
    for (const [dx, dy] of PATH_DESTINATIONS) expect(segmentDistance(at.x, at.y, dx, dy)).toBeGreaterThanOrEqual(1.5);
    for (const node of createGame().nodes.filter(item => item.kind !== 'branch')) expect(Math.hypot(at.x - node.x, at.y - node.y), node.id).toBeGreaterThanOrEqual(2);
    for (const tree of createGame().trees) expect(Math.hypot(at.x - tree.x, at.y - tree.y), tree.id).toBeGreaterThanOrEqual(2);
  });

  it('shows the site once the far ground is clear, then the hive', () => {
    expect(textures(beehiveCamp({ built: false }))).toEqual(['beehiveSite:still']);
    const near = beehiveCamp({ built: false });
    expect(textures({ ...near, clearing: { ...near.clearing, cleared: ['north-near'] } })).toEqual([]);
    expect(textures(beehiveCamp())[0]).toMatch(/^beehive:/);
  });

  it('has bees by day, fewer in winter, and none at night', () => {
    const summer = beehiveCamp({ day: 32 });
    expect(textures(summer, 0)).toEqual(['beehive:bees0']);
    expect(textures(summer, 400)).toEqual(['beehive:bees1']);
    expect(textures(beehiveCamp({ day: 15 }), 0)).toEqual(['beehive:winter0']);
    expect(textures({ ...summer, timeOfDay: nightStart(32) }, 0)).toEqual(['beehive:still']);
  });
});

import { describe, expect, it } from 'vitest';
import { LOOKOUT, SITES, createGame, type GameState } from '../src/game/state';
import { RABBIT_HOMES } from '../src/game/wildlife';
import { advanceTime, applyAction, type GameAction } from '../src/game/rules';
import { nightStart } from '../src/game/calendar';
import { journalEntry, recordJournal, type JournalId } from '../src/game/journalEntries';
import { stock } from './stock';
import { addFood, emptyFood, type FoodItem } from '../src/game/food';

const base = createGame();
const at = (day: number, timeOfDay: number, extra: Partial<GameState> = {}): GameState => ({ ...base, day, timeOfDay, ...extra });
const tick = (state: GameState, seconds = 1) => recordJournal(state, advanceTime(state, seconds));
const act = (state: GameState, action: GameAction) => recordJournal(state, applyAction(state, action).state, action);
const ids = (state: GameState): JournalId[] => state.journal.map(entry => entry.id);
const sheltered = (day: number, timeOfDay: number, fireFuel: number): GameState =>
  at(day, timeOfDay, { fireFuel, structures: { ...base.structures, shelter: true } });

describe('the year journal', () => {
  it('writes the first leaves of autumn once, with the day', () => {
    const first = tick(at(1, 30));
    expect(first.state.journal).toEqual([{ year: 1, id: 'leaves', day: 1, variant: 0 }]);
    expect(first.messages).toEqual(['Written in your journal: The first leaves came down over camp.']);
    const again = recordJournal(first.state, first.state);
    expect(again.state).toBe(first.state);
    expect(again.messages).toEqual([]);
  });

  it('keeps each season to its own page', () => {
    const night = at(12, nightStart(12) + 5, { fireFuel: 100, progress: { ...base.progress, nextStormDay: null, hearthUnlocked: true } });
    expect(act(night, { type: 'stargaze' }).state.journal).toEqual([]);
  });

  it('records how the cold night went, even asleep', () => {
    const kept = act(sheltered(3, nightStart(3) + 1, 300), { type: 'sleep' }).state;
    expect(kept.journal.find(entry => entry.id === 'coldFront')).toEqual({ year: 1, id: 'coldFront', day: 3, variant: 0 });
    const lost = act(sheltered(3, nightStart(3) + 1, 0), { type: 'sleep' }).state;
    expect(lost.journal.find(entry => entry.id === 'coldFront')?.variant).toBe(1);
  });

  it('stays silent for moments already announced', () => {
    const snow = act({ ...sheltered(10, nightStart(10) + 1, 0), progress: { ...base.progress, nextStormDay: null, hearthUnlocked: true } }, { type: 'sleep' });
    expect(ids(snow.state)).toContain('firstSnow');
    expect(snow.messages.some(text => text.includes('Snow'))).toBe(false);
    const rain = tick(at(22, 29.5), 1);
    expect(ids(rain.state)).toContain('firstRain');
    expect(rain.messages.some(text => text.includes('rain'))).toBe(false);
  });

  it('notices a whole winter night slept by a fire that never went out', () => {
    const night = sheltered(12, nightStart(12) + 5, 300);
    const sleep: GameAction = { type: 'sleep' };
    expect(ids(act(night, sleep).state)).toContain('winterFire');
    expect(ids(act({ ...night, fireFuel: 50 }, sleep).state)).not.toContain('winterFire');
    expect(ids(act({ ...night, lastWolf: { day: 12, took: 'nothing' } }, sleep).state)).not.toContain('winterFire');
    expect(ids(act({ ...night, lastWolf: { day: 12, took: 'chased' } }, sleep).state)).not.toContain('winterFire');
    expect(ids(act({ ...night, lastWolf: { day: 12, took: 'offered' } }, sleep).state)).toContain('winterFire');
    // Walking in just before dawn, awake, isn't a night kept.
    expect(ids(tick({ ...night, timeOfDay: 239.5 }).state)).not.toContain('winterFire');
  });

  it('writes summer evenings during a timed action', () => {
    const rested = act(at(34, nightStart(34) - 2), { type: 'rest' });
    expect(ids(rested.state)).toContain('goldEvening');
  });

  it('writes a warm summer sleep on the last night of the year', () => {
    const woke = act(sheltered(40, nightStart(40) + 1, 0), { type: 'sleep' }).state;
    expect(woke.day).toBe(41);
    expect(woke.journal).toContainEqual({ year: 1, id: 'warmSleep', day: 40, variant: 0 });
    expect(ids(woke)).not.toContain('fireflies');
    expect(tick({ ...woke, timeOfDay: 30 }).state.journal).toContainEqual({ year: 2, id: 'leaves', day: 41, variant: 0 });
  });

  it('finds the rabbits near their homes in spring daylight', () => {
    const home = RABBIT_HOMES[0];
    expect(ids(tick(at(21, 60, { player: { ...base.player, x: home.x, y: home.y } })).state)).toContain('rabbits');
    expect(ids(tick(at(21, 60, { player: { ...base.player, x: 2, y: 2 } })).state)).not.toContain('rabbits');
  });

  it('never changes the game', () => {
    const before = at(1, 30);
    const after = advanceTime(before, 1);
    const written = recordJournal(before, after).state;
    expect({ ...written, journal: after.journal }).toEqual(after);
  });

  it('leaves the new-game prompt alone on the first moments of a day', () => {
    expect(tick(at(1, 0), 0.05).state.journal).toEqual([]);
    expect(tick(at(41, 0), 0.05).state.journal).toEqual([]);
  });

  it('adds no second line for the cold night or the wolf, which have their own messages', () => {
    const front = act(sheltered(3, nightStart(3) + 1, 300), { type: 'sleep' });
    expect(ids(front.state)).toContain('coldFront');
    const wolf = tick(at(12, nightStart(12) + 1, { fireFuel: 0 }));
    expect(ids(wolf.state)).toContain('wolfTracks');
    expect([...front.messages, ...wolf.messages].filter(text => /cold night|Paw prints/.test(text))).toEqual([]);
  });

  it('remembers a cold autumn night by the fire in the years after the front', () => {
    const weathered = { ...base.progress, nextStormDay: null, hearthUnlocked: true };
    const night = at(45, 239.5, { fireFuel: 50, progress: weathered });
    expect(tick(night).state.journal).toContainEqual({ year: 2, id: 'coldFront', day: 45, variant: 2 });
    expect(ids(tick({ ...night, fireFuel: 0 }).state)).not.toContain('coldFront');
  });

  it('writes two handfuls only from a bush, not from the old basket', () => {
    const basket = at(34, 60, { player: { ...base.player, x: SITES.basket.x, y: SITES.basket.y } });
    const found = act(basket, { type: 'visitSite', siteId: 'basket' });
    expect(found.state.inventory.food.berry.length).toBe(2);
    expect(ids(found.state)).not.toContain('twoHandfuls');
  });
});

describe('the fox line', () => {
  it('hints at what the fox likes to eat', () => {
    expect(journalEntry('fox')?.lines[0]).toBe('A fox nosed around the berry bushes at dusk.');
  });
});

describe('each moment of the year', () => {
  const withPlayer = (state: GameState, x: number, y: number): GameState => ({ ...state, player: { ...state.player, x, y } });
  const written = (result: { state: GameState }, id: JournalId) => ids(result.state).includes(id);

  it('notes a fox by the bushes at an autumn dusk, at camp', () => {
    expect(written(tick(at(5, nightStart(5) - 10)), 'fox')).toBe(true);
    expect(written(tick(withPlayer(at(5, nightStart(5) - 10), 5, 25)), 'fox')).toBe(false);
  });

  it('notes the berries dried and cooked, in their own seasons', () => {
    const rack = { ...base.structures, dryingRack: true, shelter: true };
    expect(written(act(at(5, 60, { structures: rack, inventory: { ...base.inventory, food: stock(1) } }), { type: 'prepareTrailFood' }), 'driedBerries')).toBe(true);
    const cooking = at(12, nightStart(12) + 5, { fireFuel: 100, inventory: { ...base.inventory, food: stock(1) } });
    expect(written(act(cooking, { type: 'cook' }), 'winterCooking')).toBe(true);
    expect(written(act({ ...cooking, day: 5, timeOfDay: nightStart(5) + 5 }, { type: 'cook' }), 'winterCooking')).toBe(false);
  });

  it('notes paw prints quietly when a wolf comes to the dark camp', () => {
    const dark = tick(at(12, nightStart(12) + 5, { fireFuel: 0 }));
    expect(written(dark, 'wolfTracks')).toBe(true);
    expect(dark.messages.some(text => text.includes('Paw prints'))).toBe(false);
  });

  it('notes the spring frozen in winter and a rest beside it in spring', () => {
    const spring = (day: number) => withPlayer(at(day, 60), SITES.spring.x, SITES.spring.y);
    const visit: GameAction = { type: 'visitSite', siteId: 'spring' };
    expect(written(act(spring(12), visit), 'frozenSpring')).toBe(true);
    expect(written(act(spring(22), visit), 'springRest')).toBe(true);
    expect(written(act(spring(22), visit), 'frozenSpring')).toBe(false);
  });

  it('notes full bushes on a spring pick and a stump growing back at dawn', () => {
    const picking = withPlayer(at(22, 60), 19, 14);
    expect(written(act(picking, { type: 'gather', nodeId: 'berry-0' }), 'bushesFull')).toBe(true);
    const regrowing = at(21, 239.5, { trees: base.trees.map((tree, index) => (index === 0 ? { ...tree, readyDay: 22 } : tree)) });
    expect(written(tick(regrowing), 'stumpGrowing')).toBe(true);
    expect(written(tick(at(21, 239.5)), 'stumpGrowing')).toBe(false);
  });

  it('notes a long summer evening at the restored lookout', () => {
    const repaired = { ...base.progress, lookoutRepaired: true, hearthUnlocked: true, nextStormDay: null };
    const evening = withPlayer(at(34, nightStart(34) - 10, { progress: repaired }), LOOKOUT.x, LOOKOUT.y + 1);
    expect(written(tick(evening), 'lookoutEvening')).toBe(true);
    expect(written(tick({ ...evening, progress: { ...repaired, lookoutRepaired: false } }), 'lookoutEvening')).toBe(false);
  });

  describe('foraging and cooking', () => {
    const beside = (nodeId: string, day: number): GameState => {
      const node = base.nodes.find(item => item.id === nodeId)!;
      return withPlayer(at(day, 60), node.x, node.y);
    };
    const evening = (day: number, food: Partial<Record<FoodItem, number>>): GameState => {
      let store = emptyFood();
      for (const [item, n] of Object.entries(food) as [FoodItem, number][]) store = addFood(store, item, n, day);
      return at(day, nightStart(day) + 5, {
        fireFuel: 100, structures: { ...base.structures, shelter: true, toolshed: true },
        progress: { ...base.progress, potCrafted: true },
        inventory: { ...base.inventory, food: store }
      });
    };

    it('writes hazelnuts, and wild honey, on the first gather of each', () => {
      const hazel = act(beside('hazel-0', 2), { type: 'gather', nodeId: 'hazel-0' });
      expect(hazel.state.journal).toContainEqual({ year: 1, id: 'hazelnuts', day: 2, variant: 0 });
      expect(hazel.messages).toContain('Written in your journal: Found hazelnuts in the leaf litter.');
      expect(written(act(beside('honey-0', 34), { type: 'gather', nodeId: 'honey-0' }), 'wildHoney')).toBe(true);
      // Out of season the spot isn't there, so nothing is gathered or written.
      expect(written(act(beside('hazel-0', 12), { type: 'gather', nodeId: 'hazel-0' }), 'hazelnuts')).toBe(false);
    });

    it('writes each gather only once a year', () => {
      const first = act(beside('hazel-0', 2), { type: 'gather', nodeId: 'hazel-0' });
      const second = recordJournal(first.state, first.state, { type: 'gather', nodeId: 'hazel-0' });
      expect(second.state).toBe(first.state);
      const nextYear = act(beside('hazel-0', 42), { type: 'gather', nodeId: 'hazel-0' });
      expect(nextYear.state.journal).toContainEqual({ year: 2, id: 'hazelnuts', day: 42, variant: 0 });
    });

    it('writes pine tea from a bare C press in winter, and salad when it is the dish cooked in spring', () => {
      const tea = act(evening(12, { pineNeedles: 1 }), { type: 'cook' });
      expect(tea.state.journal).toContainEqual({ year: 1, id: 'pineTea', day: 12, variant: 0 });
      expect(tea.messages).toContain('Written in your journal: Pine needle tea, hot in the snow.');
      const salad = act(evening(22, { greens: 1, berry: 1 }), { type: 'cook', dish: 'salad' });
      expect(salad.state.journal).toContainEqual({ year: 1, id: 'salad', day: 22, variant: 0 });
      expect(salad.messages).toContain('Written in your journal: Greens and berries, the first salad of spring.');
      // A bare press with a berry in hand toasts the berry, so no salad was cooked.
      expect(written(act(evening(22, { greens: 1, berry: 1 }), { type: 'cook' }), 'salad')).toBe(false);
    });

    it('keeps tea and salad to their own seasons and dishes', () => {
      expect(written(act(evening(2, { pineNeedles: 1 }), { type: 'cook' }), 'pineTea')).toBe(false);
      expect(written(act(evening(12, { greens: 1, berry: 1 }), { type: 'cook' }), 'salad')).toBe(false);
      expect(written(act(evening(12, { berry: 1 }), { type: 'cook' }), 'pineTea')).toBe(false);
      expect(written(act(evening(22, { pineNeedles: 1 }), { type: 'cook' }), 'salad')).toBe(false);
      // Nothing to cook with: no change, no entry.
      expect(written(act(evening(12, {}), { type: 'cook' }), 'pineTea')).toBe(false);
    });
  });
});

import { describe, expect, it } from 'vitest';
import { CLEARING_STEPS, STEP_IDS, inClearing } from '../src/game/clearing';
import { BALANCE, SITES, createGame, type GameState } from '../src/game/state';
import { FORAGE, SHOWER_GREENS, nodeShown } from '../src/game/forage';
import { addFood, emptyFood, quickEatItem, type FoodItem, type FoodStore } from '../src/game/food';
import { advanceTime, applyAction } from '../src/game/rules';
import { rainWindow } from '../src/game/rain';
import { CAMP_STRUCTURES } from '../src/scene/visuals';
import { PATH_DESTINATIONS, segmentDistance } from './placement';

const AUTUMN = 1, WINTER = 11, SPRING = 21, SUMMER = 31;
const SEASON_DAYS = { autumn: AUTUMN, winter: WINTER, spring: SPRING, summer: SUMMER } as const;
const game = createGame();
const isForage = (kind: string): kind is keyof typeof FORAGE => kind in FORAGE;
const forage = game.nodes.filter(node => isForage(node.kind));
const node = (id: string) => game.nodes.find(item => item.id === id)!;
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** A spring day with a shower, and one without. */
const SHOWER_DAY = Array.from({ length: 10 }, (_, i) => SPRING + i).find(day => rainWindow(day))!;
const DRY_SPRING_DAY = Array.from({ length: 10 }, (_, i) => SPRING + i).find(day => !rainWindow(day))!;

/** The survivor standing on a node on a given day and time. */
function beside(id: string, day: number, timeOfDay = 0): GameState {
  const spot = node(id);
  return { ...game, day, timeOfDay, player: { ...game.player, x: spot.x, y: spot.y } };
}

const withFood = (state: GameState, food: FoodStore): GameState => ({ ...state, inventory: { ...state.inventory, food } });
const hungry = (state: GameState): GameState => ({ ...state, player: { ...state.player, hunger: 40, energy: 40 } });

describe('where the forage grows', () => {
  it('has three hazels, three pines, five greens patches and one hollow tree', () => {
    expect(forage.map(item => item.id)).toEqual([
      'hazel-0', 'hazel-1', 'hazel-2', 'pine-0', 'pine-1', 'pine-2',
      'greens-0', 'greens-1', 'greens-2', 'greens-3', 'greens-4', 'honey-0'
    ]);
    expect(SHOWER_GREENS).toEqual(['greens-3', 'greens-4']);
  });

  it('sets each hazel beside a wild broadleaf tree', () => {
    for (const hazel of forage.filter(item => item.kind === 'hazel')) {
      const host = game.trees.find(tree => tree.sprite === 'treeBroadleaf' && distance(tree, hazel) <= 1.6);
      expect(host, hazel.id).toBeDefined();
      expect(distance(host!, hazel), hazel.id).toBeGreaterThanOrEqual(0.75);
    }
  });

  it('puts two greens patches by the spring and one out in the meadow', () => {
    expect(distance(node('greens-0'), SITES.spring)).toBeLessThanOrEqual(3);
    expect(distance(node('greens-1'), SITES.spring)).toBeLessThanOrEqual(3);
    expect(distance(node('greens-2'), SITES.spring)).toBeGreaterThan(6);
  });

  it('keeps every spot clear of other nodes, trees and camp buildings', () => {
    const stepTrees = STEP_IDS.flatMap(id => CLEARING_STEPS[id].trees);
    const camp = [
      { x: BALANCE.campX - 3, y: BALANCE.campY - 2 },
      ...CAMP_STRUCTURES.map(([, dx, dy]) => ({ x: BALANCE.campX + dx, y: BALANCE.campY + dy }))
    ];
    for (const spot of forage) {
      for (const other of game.nodes.filter(item => item !== spot)) expect(distance(spot, other), `${spot.id} by ${other.id}`).toBeGreaterThanOrEqual(1.5);
      for (const tree of game.trees) {
        const host = spot.kind === 'hazel' && tree.sprite === 'treeBroadleaf' && distance(spot, tree) <= 1.6;
        expect(distance(spot, tree), `${spot.id} by ${tree.id}`).toBeGreaterThanOrEqual(host ? 0.75 : 1.5);
      }
      for (const tree of stepTrees) expect(distance(spot, tree), `${spot.id} by a clearing tree`).toBeGreaterThanOrEqual(1.5);
      for (const building of camp) expect(distance(spot, building), `${spot.id} by the camp`).toBeGreaterThanOrEqual(1.5);
    }
  });

  it('keeps every spot off the paths, outside the fullest clearing and within reach of the fire', () => {
    for (const spot of forage) {
      for (const [dx, dy] of PATH_DESTINATIONS) expect(segmentDistance(spot.x + 0.5, spot.y + 0.5, dx, dy), spot.id).toBeGreaterThanOrEqual(1.35);
      if (spot.x < 16) expect(Math.abs(spot.y + 0.5 - 15), `${spot.id} by the west path`).toBeGreaterThanOrEqual(1.35);
      expect(inClearing(spot.x, spot.y, STEP_IDS), spot.id).toBe(false);
      expect(distance(spot, { x: BALANCE.campX, y: BALANCE.campY }), spot.id).toBeLessThanOrEqual(11);
    }
  });
});

describe('forage in its season', () => {
  it('shows each spot only in its own season', () => {
    for (const spot of forage.filter(item => !SHOWER_GREENS.includes(item.id))) {
      for (const [season, day] of Object.entries(SEASON_DAYS)) {
        expect(nodeShown({ ...game, day }, spot), `${spot.id} in ${season}`).toBe(season === FORAGE[spot.kind as keyof typeof FORAGE].season);
      }
    }
  });

  it('always shows the branches, bushes, reeds and rocks', () => {
    for (const day of Object.values(SEASON_DAYS)) for (const spot of game.nodes.filter(item => !isForage(item.kind))) {
      expect(nodeShown({ ...game, day }, spot), spot.id).toBe(true);
    }
  });

  it('shows the shower greens from the start of a spring shower until the day ends', () => {
    const { start } = rainWindow(SHOWER_DAY)!;
    for (const id of SHOWER_GREENS) {
      const patch = node(id);
      expect(nodeShown({ ...game, day: SHOWER_DAY, timeOfDay: start - 1 }, patch)).toBe(false);
      expect(nodeShown({ ...game, day: SHOWER_DAY, timeOfDay: start }, patch)).toBe(true);
      expect(nodeShown({ ...game, day: SHOWER_DAY, timeOfDay: BALANCE.daySeconds - 1 }, patch)).toBe(true);
      expect(nodeShown({ ...game, day: DRY_SPRING_DAY, timeOfDay: 200 }, patch)).toBe(false);
      expect(nodeShown({ ...game, day: SUMMER, timeOfDay: 200 }, patch)).toBe(false);
    }
  });

  it('refuses to gather a spot that is not there', () => {
    const state = beside('hazel-0', SPRING);
    expect(applyAction(state, { type: 'gather', nodeId: 'hazel-0' })).toEqual({ state, message: 'Move closer to gather.' });
    const dry = beside('greens-3', DRY_SPRING_DAY, 100);
    expect(applyAction(dry, { type: 'gather', nodeId: 'greens-3' }).message).toBe('Move closer to gather.');
  });
});

describe('gathering forage', () => {
  it('gathers a hazelnut in autumn', () => {
    const result = applyAction(beside('hazel-0', AUTUMN), { type: 'gather', nodeId: 'hazel-0' });
    expect(result.message).toBe('Gathered a hazelnut.');
    expect(result.state.inventory.food.hazelnut).toBe(1);
    expect(result.state.inventory.food.berry).toEqual([]);
  });

  it('gathers pine needles in winter', () => {
    const result = applyAction(beside('pine-0', WINTER), { type: 'gather', nodeId: 'pine-0' });
    expect(result.message).toBe('Gathered a bunch of pine needles.');
    expect(result.state.inventory.food.pineNeedles).toBe(1);
  });

  it('picks wild greens in spring, dated the day they were picked', () => {
    const result = applyAction(beside('greens-0', SPRING + 2), { type: 'gather', nodeId: 'greens-0' });
    expect(result.message).toBe('Picked wild greens.');
    expect(result.state.inventory.food.greens).toEqual([SPRING + 2]);
  });

  it('picks shower greens once the shower has started', () => {
    const { start } = rainWindow(SHOWER_DAY)!;
    const result = applyAction(beside('greens-4', SHOWER_DAY, start + 1), { type: 'gather', nodeId: 'greens-4' });
    expect(result.state.inventory.food.greens).toEqual([SHOWER_DAY]);
  });

  it('regrows hazels, pines and greens at the next dawn', () => {
    const picked = applyAction(beside('hazel-1', AUTUMN), { type: 'gather', nodeId: 'hazel-1' }).state;
    expect(picked.nodes.find(item => item.id === 'hazel-1')?.amount).toBe(0);
    expect(advanceTime(picked, BALANCE.daySeconds).nodes.find(item => item.id === 'hazel-1')?.amount).toBe(1);
  });

  it('takes honey in summer, and the hollow tree has none again until three dawns later', () => {
    const result = applyAction(beside('honey-0', SUMMER), { type: 'gather', nodeId: 'honey-0' });
    expect(result.message).toBe('Took a little honey from the hollow tree.');
    expect(result.state.inventory.food.honey).toBe(1);
    const honeyAfter = (dawns: number): number => {
      let state = result.state;
      for (let i = 0; i < dawns; i++) state = advanceTime(state, BALANCE.daySeconds - state.timeOfDay);
      return state.nodes.find(item => item.id === 'honey-0')!.amount;
    };
    expect(honeyAfter(1)).toBe(0);
    expect(honeyAfter(2)).toBe(0);
    expect(honeyAfter(3)).toBe(1);
  });
});

describe('eating forage raw', () => {
  const eat = (food: FoodStore, item?: FoodItem) =>
    applyAction(hungry(withFood(game, food)), item ? { type: 'eat', item } : { type: 'eat' });

  it('eats greens, a hazelnut, honey or the roasted hazelnuts', () => {
    const greens = eat(addFood(emptyFood(), 'greens', 1, 1), 'greens');
    expect([greens.message, greens.state.player.hunger, greens.state.inventory.food.greens]).toEqual(['Ate a handful of greens.', 55, []]);
    const nut = eat(addFood(emptyFood(), 'hazelnut', 2, 1), 'hazelnut');
    expect([nut.message, nut.state.player.hunger, nut.state.inventory.food.hazelnut]).toEqual(['Ate a hazelnut.', 55, 1]);
    const honey = eat(addFood(emptyFood(), 'honey', 1, 1), 'honey');
    expect([honey.message, honey.state.player.hunger, honey.state.player.energy]).toEqual(['Ate some honey.', 60, 45]);
    const roasted = eat(addFood(emptyFood(), 'roastedHazelnuts', 1, 1), 'roastedHazelnuts');
    expect([roasted.message, roasted.state.player.hunger]).toEqual(['Ate the roasted hazelnuts.', 90]);
    const berry = eat(addFood(emptyFood(), 'berry', 1, 1), 'berry');
    expect([berry.message, berry.state.player.hunger]).toEqual(['Ate some berries.', 40 + BALANCE.eatHungerGain]);
  });

  it('keeps pine needles for tea', () => {
    const result = eat(addFood(emptyFood(), 'pineNeedles', 1, 1), 'pineNeedles');
    expect(result.message).toBe('Pine needles are for tea.');
    expect(result.state.inventory.food.pineNeedles).toBe(1);
  });

  it('refuses with an empty bag, or without the item asked for', () => {
    expect(eat(emptyFood()).message).toBe('No food in your bag.');
    expect(eat(emptyFood(), 'honey').message).toBe('No food in your bag.');
  });

  it('eats what Q picks when no item is named', () => {
    const food = addFood(addFood(emptyFood(), 'greens', 1, 2), 'berry', 1, 3);
    const result = eat(food);
    expect(result.message).toBe('Ate a handful of greens.');
    expect(result.state.inventory.food.berry).toEqual([3]);
  });
});

describe('what Q eats', () => {
  const pick = (food: FoodStore) => quickEatItem(withFood({ ...game, day: 4 }, food));

  it('eats the fresh food nearest to going soft first, berries winning a tie', () => {
    expect(pick(addFood(addFood(addFood(emptyFood(), 'greens', 1, 2), 'berry', 1, 3), 'hazelnut', 1, 1))).toBe('greens');
    expect(pick(addFood(addFood(emptyFood(), 'greens', 1, 3), 'berry', 1, 2))).toBe('berry');
    expect(pick(addFood(addFood(emptyFood(), 'greens', 1, 3), 'berry', 1, 3))).toBe('berry');
  });

  it('then a hazelnut, then honey, then roasted hazelnuts', () => {
    expect(pick(addFood(addFood(emptyFood(), 'hazelnut', 1, 1), 'honey', 1, 1))).toBe('hazelnut');
    expect(pick(addFood(addFood(emptyFood(), 'roastedHazelnuts', 1, 1), 'honey', 1, 1))).toBe('honey');
    expect(pick(addFood(emptyFood(), 'roastedHazelnuts', 1, 1))).toBe('roastedHazelnuts');
  });

  it('never eats pine needles or rations', () => {
    expect(pick(addFood(addFood(emptyFood(), 'pineNeedles', 1, 1), 'trailFood', 1, 1))).toBeNull();
    expect(pick(emptyFood())).toBeNull();
  });
});

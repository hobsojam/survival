import { describe, expect, it } from 'vitest';
import { BALANCE, BUILDINGS, createGame, type GameState } from '../src/game/state';
import { CLEARING_STEPS, STEP_IDS, clearingReach, inClearing, placeBranches } from '../src/game/clearing';
import { drawWaterBlocker, type Bed } from '../src/game/beds';
import { DISHES, DISH_ORDER, dishBlocker } from '../src/game/cooking';
import { nightStart } from '../src/game/calendar';
import { addFood, emptyFood } from '../src/game/food';
import { TOO_TIRED_MESSAGE, workSeconds } from '../src/game/needs';
import { rainWindow } from '../src/game/rain';
import { advanceTime, applyAction, buildStatus } from '../src/game/rules';
import { loadGame, SAVE_KEY } from '../src/game/save';
import { CAMP_STRUCTURES, sceneVisuals } from '../src/scene/visuals';
import { sprites } from '../src/art/sprites';
import { bedsPanelView, nightDishMarkup, nightDishesView } from '../src/ui/panels';
import { PATH_DESTINATIONS, segmentDistance } from './placement';

const { campX, campY, daySeconds } = BALANCE;
const SPOT = { x: 13, y: 13.5 };
const BEDS_SPOT = { x: 15.5, y: 15 };
const WEST: GameState['clearing']['cleared'] = ['west-near', 'west-far'];
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

const EMPTY: Bed = { sown: false, grown: 0, dryDays: 0, wateredDay: null };
const bed = (changes: Partial<Bed> = {}): Bed => ({ sown: true, grown: 0, dryDays: 0, wateredDay: null, ...changes });

/** A camp past its cold night with both west steps cleared and the beds built, standing at the fire, the well built or not. */
function camp(well = true, changes: Partial<GameState> = {}): GameState {
  const base = createGame();
  const placed = placeBranches(base.nodes, WEST);
  return {
    ...base,
    day: 6,
    nodes: base.nodes.map((node, i) => ({ ...node, x: placed[i].x, y: placed[i].y })),
    clearing: { cleared: WEST, marked: null, felled: [] },
    progress: { ...base.progress, nextStormDay: null, hearthUnlocked: true },
    structures: { ...base.structures, vegetableBeds: true, well },
    player: { ...base.player, x: campX, y: campY },
    ...changes
  };
}
const withBeds = (state: GameState, beds: Bed[]): GameState => ({ ...state, beds });

/** The first day from `from` on whose rain status (raining or not) is as asked. */
function findDay(from: number, rainy: boolean): number {
  let day = from;
  while ((rainWindow(day) !== null) !== rainy) day++;
  return day;
}

describe('building the well', () => {
  it('is defined as asked', () => {
    expect(BUILDINGS.well).toEqual({ name: 'Well', description: 'Draw water for the beds and the pot', symbol: '◉',
      cost: { wood: 2, fiber: 0, stone: 6 }, prerequisite: 'vegetableBeds', ground: 'west-far' });
    expect(BALANCE).toMatchObject({ stewHungerGain: 55, stewWarmthGain: 15 });
    expect(createGame().structures.well).toBe(false);
  });

  it("waits for the west side's far ground, and for the beds", () => {
    const stocked = (state: GameState): GameState => ({ ...state, inventory: { ...state.inventory, wood: 2, stone: 6 } });
    const near = stocked(camp(false, { clearing: { cleared: ['west-near'], marked: null, felled: [] } }));
    expect(buildStatus(near, 'well')).toBe('needsGround');
    expect(applyAction(near, { type: 'build', structureId: 'well' })).toEqual({ state: near, message: "Clear the west side's far ground first." });
    const noBeds = stocked(camp(false, { structures: { ...createGame().structures, vegetableBeds: false } }));
    expect(buildStatus(noBeds, 'well')).toBe('needsPrerequisite');
    expect(applyAction(noBeds, { type: 'build', structureId: 'well' })).toEqual({ state: noBeds, message: 'Build the vegetable beds first.' });
  });

  it('builds for 2 wood and 6 stone', () => {
    const state = camp(false, { inventory: { ...createGame().inventory, wood: 2, stone: 6 } });
    expect(buildStatus(state, 'well')).toBe('ready');
    const built = applyAction(state, { type: 'build', structureId: 'well' });
    expect(built.message).toBe('Built the well.');
    expect(built.state.structures.well).toBe(true);
    expect(built.state.inventory).toMatchObject({ wood: 0, stone: 0, fiber: 0 });
  });
});

describe('where the well stands', () => {
  it("stands on the west side's far ground", () => {
    expect(CAMP_STRUCTURES).toContainEqual(['well', -7, -1.5]);
    expect(SPOT).toEqual({ x: campX - 7, y: campY - 1.5 });
    expect(inClearing(SPOT.x, SPOT.y, WEST)).toBe(true);
    expect(inClearing(SPOT.x, SPOT.y, ['west-near'])).toBe(false);
  });

  it('sits wholly on cleared earth, every corner of its footprint inside the west ground', () => {
    const cx = SPOT.x + 0.5, cy = SPOT.y + 0.5;
    const corners = [[cx - 0.6, cy - 1.3], [cx + 0.6, cy - 1.3], [cx - 0.6, cy + 0.2], [cx + 0.6, cy + 0.2]];
    for (const [x, y] of corners) {
      const spare = clearingReach(x, y, WEST) - Math.hypot(x - campX, y - campY);
      expect(spare, `corner at ${x},${y}`).toBeGreaterThanOrEqual(0.3);
    }
  });

  it('keeps clear of nodes, trees and paths', () => {
    for (const node of placeBranches(createGame().nodes, WEST)) expect(distance(SPOT, node), node.id).toBeGreaterThanOrEqual(1.5);
    for (const tree of createGame().trees) expect(distance(SPOT, tree), tree.id).toBeGreaterThanOrEqual(1.5);
    for (const id of STEP_IDS.filter(step => !WEST.includes(step))) {
      for (const tree of CLEARING_STEPS[id].trees) expect(distance(SPOT, tree), id).toBeGreaterThanOrEqual(1.5);
    }
    for (const [dx, dy] of PATH_DESTINATIONS) expect(segmentDistance(SPOT.x + 0.5, SPOT.y + 0.5, dx, dy)).toBeGreaterThanOrEqual(1.35);
  });

  it('keeps 2 tiles from the shelter, the beds and the other camp buildings', () => {
    expect(distance(SPOT, BEDS_SPOT)).toBeGreaterThanOrEqual(2);
    const others = [{ x: campX - 3, y: campY - 2 }, ...CAMP_STRUCTURES.filter(([id]) => id !== 'well').map(([, dx, dy]) => ({ x: campX + dx, y: campY + dy }))];
    for (const other of others) expect(distance(SPOT, other)).toBeGreaterThanOrEqual(2);
  });

  it('shows a site once the ground is clear and the well once built, edged in dark wood', () => {
    const well = (state: GameState) => sceneVisuals(state, 0).filter(visual => visual.id === 'well').map(visual => visual.texture);
    expect(well(camp(false, { clearing: { cleared: ['west-near'], marked: null, felled: [] } }))).toEqual([]);
    expect(well(camp(false))).toEqual(['wellSite:still']);
    expect(well(camp())).toEqual(['well:built']);
    expect(sprites.well.size).toEqual([20, 24]);
    expect(sprites.wellSite.frames.still).toBeDefined();
    const symbols = new Set(sprites.well.frames.built.join('').split('').map(symbol => sprites.well.legend[symbol]));
    expect(symbols).toContain('wood0');
    expect([...symbols].some(key => key?.startsWith('stone'))).toBe(true);
  });
});

describe('drawing water', () => {
  it('refuses in order: no well, away from camp, winter, nothing to water, already watered, rained on, too tired', () => {
    const growing = withBeds(camp(), [bed(), EMPTY, EMPTY]);
    expect(drawWaterBlocker({ ...growing, structures: { ...growing.structures, well: false }, area: 'quarry' })).toBe('Build the well first.');
    expect(drawWaterBlocker({ ...growing, area: 'quarry', day: 15 })).toBe('Return to camp to draw water.');
    expect(drawWaterBlocker({ ...growing, player: { ...growing.player, x: 5, y: 5 } })).toBe('Return to camp to draw water.');
    const tired = { ...growing, player: { ...growing.player, energy: 0 } };
    expect(drawWaterBlocker({ ...tired, day: 15 })).toBe('The beds are resting for winter.');
    expect(drawWaterBlocker(withBeds(tired, [EMPTY, EMPTY, EMPTY]))).toBe('Nothing in the beds needs water.');
    expect(drawWaterBlocker(withBeds(tired, [bed({ grown: 3 }), EMPTY, EMPTY]))).toBe('Nothing in the beds needs water.');
    expect(drawWaterBlocker(withBeds(tired, [bed({ grown: 3 }), bed({ wateredDay: 6 }), EMPTY]))).toBe('The beds are already watered today.');
    // A bed watered on another day, or sown since the water was drawn, still wants water.
    expect(drawWaterBlocker(withBeds(tired, [bed({ wateredDay: 5 }), bed({ wateredDay: 6 }), EMPTY]))).toBe(TOO_TIRED_MESSAGE);
    const rainy = findDay(21, true);
    const start = rainWindow(rainy)!.start;
    expect(drawWaterBlocker({ ...tired, day: rainy, timeOfDay: start })).toBe('The rain has watered the beds today.');
    expect(drawWaterBlocker({ ...tired, day: rainy, timeOfDay: daySeconds - 10 })).toBe('The rain has watered the beds today.');
    expect(drawWaterBlocker(withBeds({ ...tired, day: rainy, timeOfDay: start }, [bed({ wateredDay: rainy }), EMPTY, EMPTY]))).toBe('The beds are already watered today.');
    expect(drawWaterBlocker({ ...tired, day: rainy, timeOfDay: start - 1 })).toBe(TOO_TIRED_MESSAGE);
    expect(drawWaterBlocker(tired)).toBe(TOO_TIRED_MESSAGE);
    expect(drawWaterBlocker(growing)).toBeNull();
    expect(drawWaterBlocker({ ...growing, day: rainy, timeOfDay: start - 1 })).toBeNull();
    expect(drawWaterBlocker({ ...growing, day: findDay(21, false), timeOfDay: 100 })).toBeNull();
  });

  it('waters every sown bed still growing, spending the time and energy of gathering', () => {
    const state = withBeds(camp(), [bed({ grown: 1, dryDays: 2 }), bed({ grown: 3 }), bed({ wateredDay: 4 })]);
    const drawn = applyAction(state, { type: 'drawWater' });
    expect(drawn.message).toBe('You draw a bucket and water the beds.');
    expect(drawn.state.beds).toEqual([bed({ grown: 1, dryDays: 2, wateredDay: 6 }), bed({ grown: 3 }), bed({ wateredDay: 6 })]);
    expect(drawn.state.player.energy).toBe(state.player.energy - BALANCE.gatherEnergyCost);
    expect(drawn.state.timeOfDay).toBe(state.timeOfDay + workSeconds(state, BALANCE.gatherSeconds));
    expect(drawn.state.inventory).toEqual(state.inventory);
  });

  it('refuses a second draw the same day, or on a day the rain has come, changing nothing (Review Focus 5)', () => {
    const drawn = applyAction(withBeds(camp(), [bed(), EMPTY, EMPTY]), { type: 'drawWater' }).state;
    expect(applyAction(drawn, { type: 'drawWater' })).toEqual({ state: drawn, message: 'The beds are already watered today.' });
    const rainy = findDay(21, true);
    const wet = withBeds(camp(true, { day: rainy, timeOfDay: rainWindow(rainy)!.start + 1 }), [bed(), EMPTY, EMPTY]);
    expect(applyAction(wet, { type: 'drawWater' })).toEqual({ state: wet, message: 'The rain has watered the beds today.' });
  });

  it('lets a bed sown after the water was drawn have its own bucket', () => {
    const drawn = applyAction(withBeds(camp(), [bed(), EMPTY, EMPTY]), { type: 'drawWater' }).state;
    const sown = applyAction(drawn, { type: 'sowBed', index: 1 }).state;
    expect(sown.beds[1].wateredDay).toBeNull();
    const again = applyAction(sown, { type: 'drawWater' });
    expect(again.message).toBe('You draw a bucket and water the beds.');
    expect(again.state.beds.map(item => item.wateredDay)).toEqual([6, 6, null]);
  });

  it('grows a watered bed at the next dawn', () => {
    const drawn = applyAction(withBeds(camp(), [bed({ grown: 1, dryDays: 2 }), EMPTY, EMPTY]), { type: 'drawWater' }).state;
    const after = advanceTime({ ...drawn, timeOfDay: daySeconds - 1 }, 1.5, 'resting');
    expect(after.day).toBe(7);
    expect(after.beds[0]).toEqual(bed({ grown: 2, dryDays: 0, wateredDay: 6 }));
  });

  it('shows a Draw water button in the beds panel once the well stands, with the refusal as its hint', () => {
    expect(bedsPanelView(withBeds(camp(false), [bed(), EMPTY, EMPTY])).water).toEqual({ shown: false, disabled: true, hint: 'Build the well first.' });
    expect(bedsPanelView(withBeds(camp(), [bed(), EMPTY, EMPTY])).water).toEqual({ shown: true, disabled: false, hint: '' });
    expect(bedsPanelView(withBeds(camp(), [EMPTY, EMPTY, EMPTY])).water).toEqual({ shown: true, disabled: true, hint: 'Nothing in the beds needs water.' });
    expect(bedsPanelView(camp()).hint).toContain('well');
    expect(bedsPanelView(camp(false)).hint).not.toContain('a bucket from the well');
  });
});

describe('vegetable stew', () => {
  const NIGHT = nightStart(6);
  /** An evening at the lit campfire with the pot made, and vegetables in the bag. */
  const evening = (vegetables: number, well = true, changes: Partial<GameState> = {}): GameState => {
    const state = camp(well);
    return {
      ...state,
      timeOfDay: NIGHT + 10,
      fireFuel: 60,
      progress: { ...state.progress, potCrafted: true },
      inventory: { ...state.inventory, food: addFood(emptyFood(), 'vegetables', vegetables, 6) },
      player: { ...state.player, hunger: 30, warmth: 40 },
      ...changes
    };
  };

  it('is a pot dish of two vegetables, cooked last', () => {
    expect(DISHES.stew).toEqual({ name: 'vegetable stew', ingredients: { vegetables: 2 }, potOnly: true });
    expect(DISH_ORDER.at(-1)).toBe('stew');
  });

  it('needs the well', () => {
    expect(dishBlocker(evening(2, false), 'stew')).toBe('Build the well to cook stew.');
    expect(applyAction(evening(2, false), { type: 'cook', dish: 'stew' }).message).toBe('Build the well to cook stew.');
  });

  it('needs two vegetables', () => {
    expect(dishBlocker(evening(1), 'stew')).toBe('You need 2 vegetables for vegetable stew.');
  });

  it('fills you up and warms you through at the campfire', () => {
    const state = evening(3);
    expect(dishBlocker(state, 'stew')).toBeNull();
    const cooked = applyAction(state, { type: 'cook', dish: 'stew' });
    expect(cooked.message).toBe('You simmer a vegetable stew. It fills you up and warms you through.');
    expect(cooked.state.inventory.food.vegetables).toBe(1);
    const after = advanceTime(state, BALANCE.cookSeconds, 'resting');
    expect(cooked.state.player.hunger).toBeCloseTo(after.player.hunger + 55);
    expect(cooked.state.player.warmth).toBeCloseTo(Math.min(100, after.player.warmth + 15));
  });

  it('caps hunger and warmth at 100', () => {
    const cooked = applyAction(evening(2, true, { player: { ...camp().player, hunger: 90, warmth: 95 } }), { type: 'cook', dish: 'stew' });
    expect(cooked.state.player.hunger).toBe(100);
    expect(cooked.state.player.warmth).toBe(100);
  });

  it('cooks at home by the fireplace once you live in the house', () => {
    const base = evening(2);
    const home = {
      ...base,
      clearing: { ...base.clearing, cleared: [...WEST, 'north-near', 'north-far'] as GameState['clearing']['cleared'] },
      structures: { ...base.structures, shelter: true, shelterThatched: true, shelterStonework: true, hearth: true, shelterPorch: true, shelterFinished: true, bed: true, house: true },
      fireFuel: 0,
      fireplaceFuel: 60,
      player: { ...base.player, x: campX - 0.5, y: campY - 6.5 }
    };
    expect(dishBlocker({ ...home, player: base.player }, 'stew')).toBe('Go home to cook.');
    expect(dishBlocker({ ...home, fireplaceFuel: 0 }, 'stew')).toBe('The fireplace is out. Stock the wood store.');
    expect(dishBlocker(home, 'stew')).toBeNull();
    const cooked = applyAction(home, { type: 'cook', dish: 'stew' });
    expect(cooked.message).toBe('You simmer a vegetable stew. It fills you up and warms you through.');
    expect(cooked.state.inventory.food.vegetables).toBe(0);
  });

  it('has a button with the other pot dishes', () => {
    const dishes = nightDishesView(evening(2));
    expect(dishes.map(entry => entry.dish)).toEqual(['pineTea', 'salad', 'roastedHazelnuts', 'honeyCake', 'stew']);
    expect(dishes.at(-1)).toMatchObject({ name: 'Vegetable stew', cost: `2 vegetables · ${BALANCE.cookSeconds} seconds`, disabled: false, title: 'Cook vegetable stew.' });
    expect(dishes.at(-1)!.icon).toMatch(/^data:image\//);
    expect(nightDishesView(evening(2, false)).at(-1)).toMatchObject({ disabled: true, title: 'Build the well to cook stew.' });
    expect(nightDishMarkup()).toContain('id="dish-stew"');
  });
});

describe('the well in the save', () => {
  const load = (state: GameState): string => {
    const data = new Map<string, string>([[SAVE_KEY, JSON.stringify({ version: 23, state })]]);
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: () => undefined, removeItem: () => undefined } as unknown as Storage;
    return loadGame(storage).kind;
  };

  it('loads a well on cleared far ground beside the beds, and nowhere else', () => {
    expect(load(withBeds(camp(), [bed({ wateredDay: 6 }), EMPTY, EMPTY]))).toBe('loaded');
    expect(load(camp(true, { clearing: { cleared: ['west-near'], marked: null, felled: [] } }))).toBe('invalid');
    expect(load(camp(true, { structures: { ...createGame().structures, well: true } }))).toBe('invalid');
  });
});

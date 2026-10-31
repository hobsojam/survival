import { describe, expect, it } from 'vitest';
import { BALANCE, BUILDINGS, createGame, type GameState } from '../src/game/state';
import { CLEARING_STEPS, STEP_IDS, clearingReach, inClearing, placeBranches } from '../src/game/clearing';
import { BED_CROPS, bedSoil, bedStage, bedsDawn, dryLimits, harvestBedBlocker, sowBedBlocker, wateredOn, witheredMessage, type Bed } from '../src/game/beds';
import { FOOD_ITEMS, addFood, emptyFood, type FoodStore } from '../src/game/food';
import { TOO_TIRED_MESSAGE, workSeconds } from '../src/game/needs';
import { rainWindow } from '../src/game/rain';
import { advanceTime, applyAction, buildStatus, groundBlocker } from '../src/game/rules';
import { loadGame, saveGame, SAVE_KEY } from '../src/game/save';
import { newsBetween } from '../src/game/news';
import { CAMP_STRUCTURES, sceneVisuals } from '../src/scene/visuals';
import { worldX, worldY } from '../src/scene/art';
import { sprites } from '../src/art/sprites';
import { bagView, bedsPanelView } from '../src/ui/panels';
import { PATH_DESTINATIONS, segmentDistance } from './placement';

const { campX, campY, daySeconds } = BALANCE;
const SPOT = { x: 15.5, y: 15 };
const WEST: GameState['clearing']['cleared'] = ['west-near'];
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

const EMPTY: Bed = { sown: false, grown: 0, dryDays: 0, wateredDay: null };
const bed = (changes: Partial<Bed> = {}): Bed => ({ sown: true, grown: 0, dryDays: 0, wateredDay: null, ...changes });

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
}

/** A camp past its cold night with the west side's near ground cleared, standing at the fire, the beds built or not. */
function camp(built = true, changes: Partial<GameState> = {}): GameState {
  const base = createGame();
  const placed = placeBranches(base.nodes, WEST);
  return {
    ...base,
    day: 6,
    nodes: base.nodes.map((node, i) => ({ ...node, x: placed[i].x, y: placed[i].y })),
    clearing: { cleared: WEST, marked: null, felled: [] },
    progress: { ...base.progress, nextStormDay: null, hearthUnlocked: true },
    structures: { ...base.structures, vegetableBeds: built },
    player: { ...base.player, x: campX, y: campY },
    ...changes
  };
}
const withBeds = (state: GameState, beds: Bed[]): GameState => ({ ...state, beds });
const withFood = (state: GameState, food: FoodStore): GameState => ({ ...state, inventory: { ...state.inventory, food } });

/** Passes the dawn that ends the state's day, with nothing else done. */
const nextDawn = (state: GameState): GameState => advanceTime({ ...state, timeOfDay: daySeconds - 1 }, 1.5, 'resting');

/** The first day whose rain status (raining or not) is as asked, from `from` on. */
function findDay(from: number, rainy: boolean): number {
  let day = from;
  while ((rainWindow(day) !== null) !== rainy) day++;
  return day;
}

describe('building the vegetable beds', () => {
  it('is defined as asked', () => {
    expect(BUILDINGS.vegetableBeds).toEqual({ name: 'Vegetable beds', description: 'Three raised beds for potatoes, beans and carrots', symbol: '▦',
      cost: { wood: 6, fiber: 2 }, prerequisite: null, ground: 'west-near' });
    expect(BALANCE).toMatchObject({ cropGrowDays: 3, cropYield: 2, vegetableHunger: 20 });
    expect(BED_CROPS).toEqual(['potatoes', 'beans', 'carrots']);
    expect(createGame().beds).toEqual([EMPTY, EMPTY, EMPTY]);
    expect(createGame().structures.vegetableBeds).toBe(false);
  });

  it("waits for the west side's near ground", () => {
    const base = createGame();
    const state = { ...base, inventory: { ...base.inventory, wood: 6, fiber: 2 }, player: { ...base.player, x: campX, y: campY } };
    expect(buildStatus(state, 'vegetableBeds')).toBe('needsGround');
    expect(groundBlocker(state, 'vegetableBeds')).toBe("Clear the west side's near ground first.");
    expect(applyAction(state, { type: 'build', structureId: 'vegetableBeds' })).toEqual({ state, message: "Clear the west side's near ground first." });
  });

  it('builds for 6 wood and 2 fiber once the ground is clear', () => {
    const state = camp(false, { inventory: { ...createGame().inventory, wood: 6, fiber: 2 } });
    expect(buildStatus(state, 'vegetableBeds')).toBe('ready');
    const built = applyAction(state, { type: 'build', structureId: 'vegetableBeds' });
    expect(built.message).toBe('Built the vegetable beds.');
    expect(built.state.structures.vegetableBeds).toBe(true);
    expect(built.state.inventory).toMatchObject({ wood: 0, fiber: 0 });
  });
});

describe('where the beds stand', () => {
  it("stands on the west side's near ground, outside the starting ring", () => {
    expect(CAMP_STRUCTURES).toContainEqual(['vegetableBeds', -4.5, 0]);
    expect(SPOT).toEqual({ x: campX - 4.5, y: campY });
    expect(inClearing(SPOT.x, SPOT.y, WEST)).toBe(true);
    expect(inClearing(SPOT.x, SPOT.y, [])).toBe(false);
  });

  it('sits wholly on cleared earth, every corner of its footprint inside the west ground', () => {
    const cx = SPOT.x + 0.5, cy = SPOT.y + 0.5;
    const corners = [[cx - 1.25, cy - 0.9], [cx + 1.25, cy - 0.9], [cx - 1.25, cy + 0.2], [cx + 1.25, cy + 0.2]];
    for (const [x, y] of corners) {
      const spare = clearingReach(x, y, WEST) - Math.hypot(x - campX, y - campY);
      expect(spare, `corner at ${x},${y}`).toBeGreaterThanOrEqual(0.3);
    }
  });

  it('keeps clear of nodes, trees and paths', () => {
    for (const node of placeBranches(createGame().nodes, WEST)) expect(distance(SPOT, node), node.id).toBeGreaterThanOrEqual(1.5);
    for (const tree of createGame().trees) expect(distance(SPOT, tree), tree.id).toBeGreaterThanOrEqual(1.5);
    for (const id of STEP_IDS.filter(step => step !== 'west-near')) {
      for (const tree of CLEARING_STEPS[id].trees) expect(distance(SPOT, tree), id).toBeGreaterThanOrEqual(1.5);
    }
    for (const [dx, dy] of PATH_DESTINATIONS) expect(segmentDistance(SPOT.x + 0.5, SPOT.y + 0.5, dx, dy)).toBeGreaterThanOrEqual(1.35);
  });

  it('keeps 2 tiles from the shelter and the other camp buildings', () => {
    const others = [{ x: campX - 3, y: campY - 2 }, ...CAMP_STRUCTURES.filter(([id]) => id !== 'vegetableBeds').map(([, dx, dy]) => ({ x: campX + dx, y: campY + dy }))];
    for (const other of others) expect(distance(SPOT, other)).toBeGreaterThanOrEqual(2);
  });
});

describe('sowing', () => {
  it('refuses in order: a bad bed, no beds, away from camp, winter, a growing bed, too tired', () => {
    const state = camp();
    expect(sowBedBlocker(state, 3)).toBe('That bed is unavailable.');
    expect(sowBedBlocker(state, -1)).toBe('That bed is unavailable.');
    expect(sowBedBlocker(state, 0.5)).toBe('That bed is unavailable.');
    expect(sowBedBlocker(camp(false, { area: 'quarry', day: 11 }), 0)).toBe('Build the vegetable beds first.');
    expect(sowBedBlocker(camp(true, { area: 'quarry', day: 11 }), 0)).toBe('Return to camp to tend the beds.');
    expect(sowBedBlocker({ ...state, player: { ...state.player, x: 5, y: 5 } }, 0)).toBe('Return to camp to tend the beds.');
    const tired = { ...state, player: { ...state.player, energy: 0 } };
    expect(sowBedBlocker(withBeds({ ...tired, day: 11 }, [bed(), EMPTY, EMPTY]), 0)).toBe('The beds rest in winter. Sow again in spring.');
    expect(sowBedBlocker(withBeds(tired, [bed(), EMPTY, EMPTY]), 0)).toBe('That bed is already growing.');
    expect(sowBedBlocker(tired, 0)).toBe(TOO_TIRED_MESSAGE);
    expect(sowBedBlocker(state, 0)).toBeNull();
    for (const day of [1, 21, 31]) expect(sowBedBlocker({ ...state, day }, 0), `day ${day}`).toBeNull();
    expect(applyAction(state, { type: 'sowBed', index: 7 })).toEqual({ state, message: 'That bed is unavailable.' });
  });

  it('sows a bed for free, spending the time and energy of planting', () => {
    const state = camp();
    const sown = applyAction(state, { type: 'sowBed', index: 2 });
    expect(sown.message).toBe('Sowed the carrots.');
    expect(sown.state.beds).toEqual([EMPTY, EMPTY, { sown: true, grown: 0, dryDays: 0, wateredDay: null }]);
    expect(sown.state.player.energy).toBe(state.player.energy - BALANCE.gatherEnergyCost);
    expect(sown.state.timeOfDay).toBe(state.timeOfDay + workSeconds(state, BALANCE.gatherSeconds));
    expect(sown.state.inventory).toEqual(state.inventory);
    expect(applyAction(state, { type: 'sowBed', index: 0 }).message).toBe('Sowed the potatoes.');
    expect(applyAction(state, { type: 'sowBed', index: 1 }).message).toBe('Sowed the beans.');
  });
});

describe('growing', () => {
  it('counts a day as watered when water was drawn that day or it rained', () => {
    const rainy = findDay(21, true), dry = findDay(21, false);
    const state = camp();
    expect(wateredOn(state, bed({ wateredDay: 4 }), 4)).toBe(true);
    expect(wateredOn(state, bed({ wateredDay: 4 }), 5)).toBe(false);
    expect(wateredOn(state, bed(), rainy)).toBe(true);
    expect(wateredOn(state, bed(), dry)).toBe(false);
  });

  it('grows a watered bed by a day and dries it no further', () => {
    const state = withBeds(camp(), [EMPTY, EMPTY, bed({ grown: 1, dryDays: 2, wateredDay: 6 })]);
    const after = nextDawn(state);
    expect(after.day).toBe(7);
    expect(after.beds[2]).toEqual(bed({ grown: 2, dryDays: 0, wateredDay: 6 }));
    expect(after.beds[0]).toEqual(EMPTY);
  });

  it('grows a bed on a rain day with no water drawn', () => {
    const day = findDay(21, true);
    const after = nextDawn(withBeds(camp(true, { day }), [bed({ dryDays: 1 }), EMPTY, EMPTY]));
    expect(after.beds[0]).toEqual(bed({ grown: 1, dryDays: 0 }));
  });

  it('dries an unwatered bed day by day: it grows for two dry days, stalls on the third and withers on the fourth', () => {
    let state = withBeds(camp(true, { day: 2 }), [EMPTY, EMPTY, bed()]);
    const seen: [number, number][] = [];
    for (let dawn = 0; dawn < 3; dawn++) {
      state = nextDawn(state);
      seen.push([state.beds[2].grown, state.beds[2].dryDays]);
    }
    expect(seen).toEqual([[1, 1], [2, 2], [2, 3]]);
    const before = state;
    const withered = nextDawn(state);
    expect(withered.beds[2]).toEqual(EMPTY);
    expect(witheredMessage(before, withered)).toBe('The carrots withered in the dry. You saved the seed.');
    expect(newsBetween(before, withered)).toContain('The carrots withered in the dry. You saved the seed.');
    expect(witheredMessage(state, nextDawn(withBeds(state, [EMPTY, EMPTY, bed({ grown: 1, dryDays: 1 })])))).toBeNull();
  });

  it('names every bed that withered at once', () => {
    const state = withBeds(camp(true, { day: 2 }), [bed({ dryDays: 3 }), EMPTY, bed({ grown: 2, dryDays: 3 })]);
    expect(witheredMessage(state, nextDawn(state))).toBe('The potatoes and carrots withered in the dry. You saved the seed.');
  });

  it('ripens on the third day of growth, and a ripe bed stops drying', () => {
    const state = withBeds(camp(true, { day: 2 }), [bed({ grown: 2, dryDays: 1 }), EMPTY, EMPTY]);
    const ripe = nextDawn(state);
    expect(ripe.beds[0]).toEqual(bed({ grown: 3, dryDays: 0 }));
    expect(bedStage(ripe.beds[0])).toBe('ripe');
  });

  it('updates the beds from the day that ended', () => {
    const next = withBeds(camp(true, { day: 7 }), [bed({ wateredDay: 6 }), bed({ wateredDay: 7 }), EMPTY]);
    bedsDawn(next, 6);
    expect(next.beds.map(item => [item.grown, item.dryDays])).toEqual([[1, 0], [1, 1], [0, 0]]);
  });
});

describe('a ripe crop left waiting (Review Focus 1)', () => {
  it('stays ripe, never drying, through six dry dawns and a whole winter, and harvests as usual', () => {
    let state = withBeds(camp(true, { day: 2 }), [bed({ grown: 3 }), EMPTY, EMPTY]);
    for (let dawn = 0; dawn < 6; dawn++) {
      state = nextDawn(state);
      expect(state.beds[0], `day ${state.day}`).toEqual(bed({ grown: 3 }));
    }
    while (state.day < 21) {
      state = nextDawn(state);
      expect(state.beds[0], `day ${state.day}`).toEqual(bed({ grown: 3 }));
    }
    expect(state.day).toBe(21);
    const harvested = applyAction(state, { type: 'harvestBed', index: 0 });
    expect(harvested.message).toBe('Harvested the potatoes.');
    expect(harvested.state.inventory.food.vegetables).toBe(2);
  });
});

describe('a bed growing as winter comes (Review Focus 2)', () => {
  it('keeps its growth and dryness through every winter dawn and carries on in spring', () => {
    // The last autumn dawn leaves the bed at one day grown and two dry, going into winter.
    let state = nextDawn(withBeds(camp(true, { day: 10 }), [EMPTY, bed({ dryDays: 1 }), EMPTY]));
    expect(state.day).toBe(11);
    expect(state.beds[1]).toEqual(bed({ grown: 1, dryDays: 2 }));
    expect(bedSoil(state, state.beds[1])).toBe('frost');
    while (state.day < 21) {
      state = nextDawn(state);
      expect(state.beds[1], `day ${state.day}`).toEqual(bed({ grown: 1, dryDays: 2 }));
    }
    expect(sowBedBlocker(state, 0)).toBeNull();
    const watered = nextDawn(withBeds(state, [EMPTY, { ...state.beds[1], wateredDay: 21 }, EMPTY]));
    expect(watered.beds[1]).toEqual(bed({ grown: 2, dryDays: 0, wateredDay: 21 }));
    const dry = nextDawn(withBeds({ ...state, day: findDay(21, false) }, state.beds));
    expect(dry.beds[1]).toEqual(bed({ grown: 1, dryDays: 3 }));
  });

  it('pauses on the winter days themselves, wherever the season is', () => {
    const next = withBeds(camp(true, { day: 12 }), [bed({ grown: 2, dryDays: 3 }), EMPTY, EMPTY]);
    bedsDawn(next, 11);
    expect(next.beds[0]).toEqual(bed({ grown: 2, dryDays: 3 }));
    bedsDawn(next, 20);
    expect(next.beds[0]).toEqual(bed({ grown: 2, dryDays: 3 }));
  });
});

describe('sleeping through several days at once (Review Focus 4)', () => {
  const sowAt = (day: number): GameState => applyAction(camp(true, { day, timeOfDay: 0 }), { type: 'sowBed', index: 2 }).state;

  it('withers a bed left dry from sowing at the fourth dawn, not before', () => {
    const sown = sowAt(2);
    const three = advanceTime(sown, 3 * daySeconds, 'resting');
    expect(three.day).toBe(5);
    expect(three.beds[2]).toEqual(bed({ grown: 2, dryDays: 3 }));
    expect(witheredMessage(sown, three)).toBeNull();
    const four = advanceTime(sown, 4 * daySeconds, 'resting');
    expect(four.day).toBe(6);
    expect(four.beds[2]).toEqual(EMPTY);
    expect(witheredMessage(sown, four)).toBe('The carrots withered in the dry. You saved the seed.');
  });

  it('keeps a bed alive when the second day brings rain', () => {
    let day = 21;
    while (rainWindow(day + 1) === null) day++;
    expect(day + 4).toBeLessThanOrEqual(31);
    const four = advanceTime(sowAt(day), 4 * daySeconds, 'resting');
    expect(four.beds[2].sown).toBe(true);
    expect(four.beds[2].dryDays).toBeLessThanOrEqual(2);
    expect(advanceTime(sowAt(day), 2 * daySeconds, 'resting').beds[2].dryDays).toBe(0);
  });
});

describe('harvesting', () => {
  const ripe = (changes: Partial<GameState> = {}): GameState => withBeds(camp(true, changes), [bed({ grown: 3 }), bed({ grown: 2 }), EMPTY]);

  it('refuses a bed that is not ready, away from camp, or without the beds', () => {
    const state = ripe();
    expect(harvestBedBlocker(state, 3)).toBe('That bed is unavailable.');
    expect(harvestBedBlocker(withBeds(camp(false), state.beds), 0)).toBe('Build the vegetable beds first.');
    expect(harvestBedBlocker({ ...state, area: 'quarry' }, 0)).toBe('Return to camp to tend the beds.');
    expect(harvestBedBlocker(state, 1)).toBe('That bed is not ready yet.');
    expect(harvestBedBlocker(state, 2)).toBe('That bed is not ready yet.');
    expect(harvestBedBlocker({ ...state, player: { ...state.player, energy: 0 } }, 0)).toBe(TOO_TIRED_MESSAGE);
    expect(harvestBedBlocker(state, 0)).toBeNull();
    expect(harvestBedBlocker({ ...state, day: 15 }, 0)).toBeNull();
  });

  it('refuses a bag with fewer than two spaces, changing nothing (Review Focus 3)', () => {
    const state = ripe({ inventory: { ...createGame().inventory, wood: 7 } });
    expect(harvestBedBlocker(state, 0)).toBe('Make room for 2 vegetables before harvesting.');
    expect(applyAction(state, { type: 'harvestBed', index: 0 })).toEqual({ state, message: 'Make room for 2 vegetables before harvesting.' });
    const room = ripe({ inventory: { ...createGame().inventory, wood: 6 } });
    const harvested = applyAction(room, { type: 'harvestBed', index: 0 });
    expect(harvested.state.inventory).toMatchObject({ wood: 6, food: { vegetables: 2 } });
  });

  it('puts two vegetables in the bag and empties the bed, keeping its seed', () => {
    const state = ripe();
    const harvested = applyAction(state, { type: 'harvestBed', index: 0 });
    expect(harvested.message).toBe('Harvested the potatoes.');
    expect(harvested.state.inventory.food.vegetables).toBe(2);
    expect(harvested.state.beds).toEqual([EMPTY, bed({ grown: 2 }), EMPTY]);
    expect(harvested.state.player.energy).toBe(state.player.energy - BALANCE.gatherEnergyCost);
    expect(harvested.state.timeOfDay).toBe(state.timeOfDay + workSeconds(state, BALANCE.gatherSeconds));
    expect(witheredMessage(state, harvested.state)).toBeNull();
    expect(sowBedBlocker(harvested.state, 0)).toBeNull();
  });
});

describe('vegetables', () => {
  it('are kept food that never spoils', () => {
    expect(FOOD_ITEMS).toContain('vegetables');
    expect(emptyFood().vegetables).toBe(0);
    const state = withFood(camp(true, { day: 2 }), addFood(emptyFood(), 'vegetables', 3, 2));
    expect(advanceTime(state, 10 * daySeconds, 'resting').inventory.food.vegetables).toBe(3);
  });

  it('can be eaten raw from the bag or the larder for 20 hunger', () => {
    const hungry = (state: GameState): GameState => ({ ...state, player: { ...state.player, hunger: 50 } });
    const bag = applyAction(hungry(withFood(camp(), addFood(emptyFood(), 'vegetables', 1, 6))), { type: 'eat', item: 'vegetables' });
    expect(bag.message).toBe('Ate some raw vegetables.');
    expect(bag.state.player.hunger).toBe(70);
    expect(bag.state.inventory.food.vegetables).toBe(0);
    const larder = camp(true, { structures: { ...camp().structures, larder: true }, larder: addFood(emptyFood(), 'vegetables', 1, 6) });
    const fromLarder = applyAction(hungry(larder), { type: 'eat', item: 'vegetables' });
    expect(fromLarder.message).toBe('Ate some raw vegetables.');
    expect(fromLarder.state.player.hunger).toBe(70);
    expect(fromLarder.state.larder.vegetables).toBe(0);
    const full = applyAction(withFood(camp(), addFood(emptyFood(), 'vegetables', 1, 6)), { type: 'eat', item: 'vegetables' });
    expect(full.state.player.hunger).toBe(100);
  });

  it('show in the bag with an Eat button while there are any to hand', () => {
    expect(bagView(camp()).foods.vegetables).toEqual({ count: 0, shown: false, note: '' });
    const state = withFood(camp(), addFood(emptyFood(), 'vegetables', 2, 6));
    expect(bagView(state).foods.vegetables).toEqual({ count: 2, shown: true, note: '' });
    expect(bagView(state).eatable.vegetables).toBe(true);
  });
});

describe('how the beds look', () => {
  it('reads each bed as empty, sprouting, growing or ripe', () => {
    expect(bedStage(EMPTY)).toBe('empty');
    expect(bedStage(bed())).toBe('sprout');
    expect(bedStage(bed({ grown: 1 }))).toBe('growing');
    expect(bedStage(bed({ grown: 2 }))).toBe('growing');
    expect(bedStage(bed({ grown: 3 }))).toBe('ripe');
  });

  it('reads the soil as fresh, dry, wilted, or frosted in winter', () => {
    const autumn = camp(true, { day: 2 }), winter = camp(true, { day: 15 });
    expect(bedSoil(autumn, bed())).toBe('fresh');
    expect(bedSoil(autumn, bed({ dryDays: 1 }))).toBe('fresh');
    expect(bedSoil(autumn, bed({ dryDays: 2 }))).toBe('dry');
    expect(bedSoil(autumn, bed({ dryDays: 3 }))).toBe('wilted');
    expect(bedSoil(winter, bed({ dryDays: 3 }))).toBe('frost');
    expect(bedSoil(winter, bed({ grown: 3 }))).toBe('frost');
    expect(bedSoil(winter, EMPTY)).toBe('frost');
  });

  it('shows a staked site once the ground is clear, and three beds once built', () => {
    const textures = (state: GameState) => sceneVisuals(state, 0).filter(visual => visual.id.startsWith('vegBed') || visual.id === 'vegetableBeds');
    expect(textures(camp(false, { clearing: { cleared: [], marked: null, felled: [] } }))).toEqual([]);
    expect(textures(camp(false)).map(visual => visual.texture)).toEqual(['vegetableBedsSite:still']);
    const built = withBeds(camp(true, { day: 2 }), [EMPTY, bed(), bed({ grown: 1, dryDays: 2 })]);
    const beds = textures(built);
    expect(beds.map(visual => visual.texture)).toEqual(['vegBed:potatoes-empty-fresh', 'vegBed:beans-sprout-fresh', 'vegBed:carrots-growing-dry']);
    expect(beds.map(visual => visual.x)).toEqual([-0.9, 0, 0.9].map(dx => Math.round(worldX(SPOT.x + dx))));
    expect(beds.every(visual => visual.y === Math.round(worldY(SPOT.y)))).toBe(true);
    const winter = withBeds(camp(true, { day: 15 }), [bed({ grown: 3 }), bed({ grown: 1, dryDays: 3 }), EMPTY]);
    expect(textures(winter).map(visual => visual.texture)).toEqual(['vegBed:potatoes-ripe-frost', 'vegBed:beans-growing-frost', 'vegBed:carrots-empty-frost']);
  });

  it('has a drawn frame for every crop, stage and soil', () => {
    expect(sprites.vegBed.size).toEqual([14, 12]);
    expect(sprites.vegetableBedsSite.frames.still).toBeDefined();
    const plants = new Set<string>();
    for (const crop of BED_CROPS) for (const stage of ['empty', 'sprout', 'growing', 'ripe']) for (const soil of ['fresh', 'dry', 'wilted', 'frost']) {
      const frame = sprites.vegBed.frames[`${crop}-${stage}-${soil}`];
      expect(frame, `${crop}-${stage}-${soil}`).toBeDefined();
      if (stage === 'growing' || stage === 'ripe') plants.add(frame.join(''));
    }
    // Each crop looks its own, growing differs from ripe, and the soil shows in every one.
    expect(plants.size).toBe(3 * 2 * 4);
    const soils = (stage: string) => new Set(['fresh', 'dry', 'wilted', 'frost'].map(soil => sprites.vegBed.frames[`beans-${stage}-${soil}`].join(''))).size;
    expect(soils('sprout')).toBe(4);
    expect(soils('empty')).toBe(3);
    // The edge is dark wood, so the bed reads on the bare earth of the camp.
    expect(sprites.vegBed.frames['potatoes-empty-fresh'].join('').split('').map(symbol => sprites.vegBed.legend[symbol])).toContain('wood0');
  });
});

describe('the beds panel', () => {
  it('lists each bed with its crop, stage and soil, and a Sow or Harvest button', () => {
    const state = withBeds(camp(true, { day: 2 }), [EMPTY, bed({ grown: 3 }), bed({ grown: 1, dryDays: 2 })]);
    const view = bedsPanelView(state);
    expect(view.shown).toBe(true);
    expect(view.beds.map(item => item.label)).toEqual(['Potatoes · Empty, ready to sow', 'Beans · Ready to harvest', 'Carrots · Growing · Dry, water soon']);
    expect(view.beds.map(item => item.action)).toEqual(['sowBed', 'harvestBed', 'harvestBed']);
    expect(view.beds.map(item => item.disabled)).toEqual([false, false, true]);
    expect(view.beds.map(item => item.title)).toEqual(['Sow the potatoes.', 'Harvest 2 vegetables.', 'That bed is not ready yet.']);
    expect(bedsPanelView(camp(false)).shown).toBe(false);
  });

  it('words the sprouting, wilting and frosted beds', () => {
    const autumn = withBeds(camp(true, { day: 2 }), [bed(), bed({ grown: 2, dryDays: 3 }), EMPTY]);
    expect(bedsPanelView(autumn).beds.map(item => item.label).slice(0, 2)).toEqual(['Potatoes · Sprouting', 'Beans · Growing · Wilting, water today']);
    const winter = withBeds(camp(true, { day: 15 }), [bed(), EMPTY, EMPTY]);
    expect(bedsPanelView(winter).beds[0].label).toBe('Potatoes · Sprouting · Resting under the frost');
  });

  it('calls an empty winter bed resting, never both empty and under the frost', () => {
    const winter = withBeds(camp(true, { day: 15 }), [bed({ grown: 1 }), EMPTY, EMPTY]);
    expect(bedsPanelView(winter).beds.map(item => item.label)).toEqual(['Potatoes · Growing · Resting under the frost', 'Beans · Empty, resting for winter', 'Carrots · Empty, resting for winter']);
  });

  it('says what waters the beds, by season and well', () => {
    const hint = (built: boolean, day: number) => bedsPanelView(camp(true, { day, structures: { ...camp(true).structures, well: built } })).hint;
    expect(hint(true, 25)).toContain('a bucket from the well waters them all for the day');
    expect(hint(true, 35)).toContain('a bucket from the well waters them all for the day');
    expect(hint(false, 25)).toContain('Rain waters the beds.');
    expect(hint(false, 25)).not.toContain('well');
    expect(hint(false, 35)).toContain('No rain falls until spring; a well on the west ground would water them.');
    expect(hint(false, 35)).not.toContain('!');
  });
});

describe('the beds in the save', () => {
  const load = (state: unknown, version = 23): string => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ version, state }));
    return loadGame(storage).kind;
  };
  const planted = withBeds(camp(true, { day: 6 }), [bed({ grown: 3 }), bed({ grown: 1, dryDays: 3, wateredDay: 6 }), EMPTY]);

  it('accepts version 23 and rejects 22', () => {
    expect(load(planted)).toBe('loaded');
    expect(load(planted, 22)).toBe('invalid');
    const storage = new MemoryStorage();
    expect(saveGame(storage, planted).ok).toBe(true);
    expect(JSON.parse(storage.getItem(SAVE_KEY)!).version).toBe(23);
  });

  it('needs exactly three well-formed beds', () => {
    const { beds: _, ...missing } = planted;
    expect(load(missing)).toBe('invalid');
    expect(load({ ...planted, beds: planted.beds.slice(0, 2) })).toBe('invalid');
    expect(load({ ...planted, beds: [...planted.beds, EMPTY] })).toBe('invalid');
    expect(load({ ...planted, beds: [EMPTY, EMPTY, null] })).toBe('invalid');
    expect(load({ ...planted, beds: [EMPTY, EMPTY, { ...EMPTY, sown: 'yes' }] })).toBe('invalid');
  });

  it('keeps growth, dryness and the watered day in range', () => {
    const one = (changes: Partial<Bed>) => withBeds(planted, [bed(changes), EMPTY, EMPTY]);
    expect(load(one({ grown: BALANCE.cropGrowDays }))).toBe('loaded');
    expect(load(one({ grown: BALANCE.cropGrowDays + 1 }))).toBe('invalid');
    expect(load(one({ grown: -1 }))).toBe('invalid');
    expect(load(one({ grown: 1.5 }))).toBe('invalid');
    expect(load(one({ dryDays: 3 }))).toBe('loaded');
    expect(load(one({ dryDays: 4 }))).toBe('invalid');
    expect(load(one({ grown: BALANCE.cropGrowDays, dryDays: 1 }))).toBe('invalid');
    expect(load(one({ dryDays: -1 }))).toBe('invalid');
    expect(load(one({ wateredDay: 6 }))).toBe('loaded');
    expect(load(one({ wateredDay: 7 }))).toBe('invalid');
    expect(load(one({ wateredDay: 0 }))).toBe('invalid');
    expect(load(one({ wateredDay: 'today' as unknown as number }))).toBe('invalid');
  });

  it('keeps an empty bed bare', () => {
    expect(load(withBeds(planted, [{ ...EMPTY, grown: 1 }, EMPTY, EMPTY]))).toBe('invalid');
    expect(load(withBeds(planted, [{ ...EMPTY, dryDays: 1 }, EMPTY, EMPTY]))).toBe('invalid');
  });

  it('sows nothing without the beds built', () => {
    expect(load({ ...planted, structures: { ...planted.structures, vegetableBeds: false } })).toBe('invalid');
    expect(load(withBeds({ ...planted, structures: { ...planted.structures, vegetableBeds: false } }, [EMPTY, EMPTY, EMPTY]))).toBe('loaded');
  });

  it('keeps vegetables in the bag and the larder', () => {
    expect(load(withFood(planted, addFood(emptyFood(), 'vegetables', 2, 6)))).toBe('loaded');
    expect(load(withFood(planted, { ...emptyFood(), vegetables: -1 }))).toBe('invalid');
    const { vegetables: _, ...noVegetables } = emptyFood();
    expect(load(withFood(planted, noVegetables as FoodStore))).toBe('invalid');
  });
});

describe('the bed tools', () => {
  /** The beds built, with the workshop up and its hoe and watering can made. */
  const tooled = (beds: Bed[], changes: Partial<GameState> = {}): GameState => {
    const state = withBeds(camp(true, changes), beds);
    return {
      ...state,
      clearing: { ...state.clearing, cleared: ['west-near', 'east-near', 'east-far'] },
      structures: { ...state.structures, shelter: true, toolshed: true, workshop: true },
      progress: { ...state.progress, workshop: { ...state.progress.workshop, bedTools: true } }
    };
  };

  it('moves every drying threshold a day later', () => {
    expect(dryLimits(camp())).toEqual({ dry: 2, stall: 3, wither: 4 });
    expect(dryLimits(tooled([]))).toEqual({ dry: 3, stall: 4, wither: 5 });
    const soil = (dryDays: number) => bedSoil(tooled([]), bed({ dryDays }));
    expect([0, 1, 2, 3, 4].map(soil)).toEqual(['fresh', 'fresh', 'fresh', 'dry', 'wilted']);
  });

  it('are made at the workshop once the beds are built', () => {
    const state = tooled([EMPTY, EMPTY, EMPTY]);
    const unmade = { ...state, progress: { ...state.progress, workshop: { ...state.progress.workshop, bedTools: false } }, inventory: { ...state.inventory, wood: 3, fiber: 1, stone: 1 } };
    const result = applyAction(unmade, { type: 'makeUpgrade', upgrade: 'bedTools' });
    expect(result.message).toBe('You made a hoe and a watering can. The beds hold their water a day longer now.');
    expect(result.state.progress.workshop.bedTools).toBe(true);
  });

  it('keeps a growing bed through its third dry day, stalls it on the fourth, and withers it on the fifth', () => {
    let state = tooled([EMPTY, EMPTY, bed({ grown: 1, dryDays: 2 })], { day: 2 });
    state = nextDawn(state);
    expect(state.beds[2]).toEqual(bed({ grown: 2, dryDays: 3 }));
    expect(bedSoil(state, state.beds[2])).toBe('dry');
    const stalled = withBeds(state, [EMPTY, EMPTY, bed({ grown: 1, dryDays: 3 })]);
    const fourth = nextDawn(stalled);
    expect(fourth.beds[2]).toEqual(bed({ grown: 1, dryDays: 4 }));
    expect(bedSoil(fourth, fourth.beds[2])).toBe('wilted');
    expect(nextDawn(fourth).beds[2]).toEqual(EMPTY);
  });

  it('saves a wilting bed that the tools were made for', () => {
    const wilting = withBeds(camp(true, { day: 3 }), [EMPTY, EMPTY, bed({ grown: 1, dryDays: 3 })]);
    const state = tooled(wilting.beds, { day: 3 });
    expect(bedSoil(state, state.beds[2])).toBe('dry');
    const next = nextDawn(state);
    expect(next.beds[2]).toEqual(bed({ grown: 1, dryDays: 4 }));
  });

  it('lets a save hold four dry days with the tools, and not five', () => {
    const load = (state: unknown): string => {
      const storage = new MemoryStorage();
      storage.setItem(SAVE_KEY, JSON.stringify({ version: 23, state }));
      return loadGame(storage).kind;
    };
    expect(load(tooled([EMPTY, EMPTY, bed({ grown: 1, dryDays: 4 })]))).toBe('loaded');
    expect(load(tooled([EMPTY, EMPTY, bed({ grown: 1, dryDays: 5 })]))).toBe('invalid');
    expect(load(withBeds(camp(), [EMPTY, EMPTY, bed({ grown: 1, dryDays: 4 })]))).toBe('invalid');
    const noBeds = tooled([EMPTY, EMPTY, EMPTY]);
    expect(load({ ...noBeds, structures: { ...noBeds.structures, vegetableBeds: false } })).toBe('invalid');
  });
});

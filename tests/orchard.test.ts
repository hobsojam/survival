import { describe, expect, it } from 'vitest';
import { CLEARING_STEPS, STEP_IDS, inClearedPatch, placeBranches, previousStep, stepGround, stepWhere, type StepId } from '../src/game/clearing';
import { addFood } from '../src/game/food';
import { recordJournal } from '../src/game/journalEntries';
import { newsBetween } from '../src/game/news';
import { sprites } from '../src/art/sprites';
import { ORCHARD_SPOTS, autumnsPassed, emptyOrchard, nearestSpot, orchardNews, spotAction, treeBears, treeFrame, treeRipe, treeStage, treesPlanted, type OrchardState } from '../src/game/orchard';
import { applyAction, buildStatus, type GameAction } from '../src/game/rules';
import { saveGame } from '../src/game/save';
import { upgradeSave } from '../src/game/saveUpgrades';
import { BUILDINGS, SITES, createGame, type GameState } from '../src/game/state';
import { unnamedAnimalAt } from '../src/scene/animalTap';
import { buildMap } from '../src/scene/map';
import { orchardChoice } from '../src/scene/prompts';
import { pickTapTarget, targetAction } from '../src/scene/tapTarget';
import { sceneVisuals } from '../src/scene/visuals';
import { pipsLine } from '../src/ui/panels';
import { journalPageView } from '../src/ui/yearJournal';

const game = createGame();
const fakeStorage = (): Storage => {
  const items = new Map<string, string>();
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) } as unknown as Storage;
};
const saves = (state: GameState): boolean => saveGame(fakeStorage(), state).ok;
const WEST: StepId[] = ['west-near', 'west-far', 'west-outer'];
const NO_ORCHARD = { ...game.structures, shelter: true };
const NOT_FOUND = { ...game.progress, homesteadFound: false, nextStormDay: null, hearthUnlocked: true };

/** A real camp in year two's spring with the orchard standing, that saves unless its orchard is impossible. */
function orchardCamp(orchard: Partial<OrchardState> = {}, changes: Partial<GameState> = {}): GameState {
  const placed = placeBranches(game.nodes, [...STEP_IDS]);
  return {
    ...game,
    day: 62,
    nodes: game.nodes.map((node, i) => ({ ...node, x: placed[i].x, y: placed[i].y })),
    clearing: { cleared: [...STEP_IDS], marked: null, felled: [] },
    structures: { ...game.structures, shelter: true, orchard: true },
    progress: { ...game.progress, homesteadFound: true, nextStormDay: null, hearthUnlocked: true },
    orchard: { ...emptyOrchard(), ...orchard },
    ...changes
  };
}

describe('the orchard ground', () => {
  const step = CLEARING_STEPS['west-outer'];
  const patch = step.patch!;

  it('follows the west far ground, at the outer price, with three trees', () => {
    expect(previousStep('west-outer')).toBe('west-far');
    expect(step.cost).toEqual({ wood: 8, fiber: 4, stone: 2 });
    expect(step.trees).toHaveLength(3);
    expect(step.room).toEqual(['orchard']);
  });

  it('asks nothing wild to move', () => {
    const on = (place: { x: number; y: number }) => inClearedPatch(place.x, place.y, ['west-outer']);
    expect(game.nodes.filter(on)).toEqual([]);
    expect(Object.values(SITES).filter(on)).toEqual([]);
    const map = buildMap(game.nodes, 'camp-both-open', 'autumn', { cleared: [...STEP_IDS], marked: null, felled: [] });
    expect([...map.trees, ...map.groves.flat()].filter(on)).toEqual([]);
    expect(STEP_IDS.filter(id => id !== 'west-outer').flatMap(id => CLEARING_STEPS[id].trees).filter(on)).toEqual([]);
  });

  it('stands its own trees on the patch', () => {
    for (const tree of step.trees) expect(inClearedPatch(tree.x, tree.y, ['west-outer']), `${tree.x},${tree.y}`).toBe(true);
  });

  it('has six spots on the patch, with room between them', () => {
    expect(ORCHARD_SPOTS).toHaveLength(6);
    ORCHARD_SPOTS.forEach((spot, i) => {
      expect(spot.x).toBeGreaterThanOrEqual(patch.x);
      expect(spot.x).toBeLessThanOrEqual(patch.x + patch.width);
      expect(spot.y).toBeGreaterThanOrEqual(patch.y);
      expect(spot.y).toBeLessThanOrEqual(patch.y + patch.height);
      ORCHARD_SPOTS.slice(i + 1).forEach(other => expect(Math.hypot(spot.x - other.x, spot.y - other.y)).toBeGreaterThanOrEqual(2));
    });
  });

  it('says where it is', () => {
    expect(stepWhere('west-outer')).toBe('north of the west path');
    expect(stepGround('west-outer')).toBe('the ground north of the west path');
    expect(stepWhere('east-outer')).toBe('up past the lookout');
    expect(stepGround('east-outer')).toBe('the meadow up past the lookout');
    expect(stepWhere('west-far')).toBe('on the west side');
  });
});

describe('building the orchard', () => {
  const ready = (changes: Partial<GameState['progress']> = {}, cleared: StepId[] = WEST): GameState => ({
    ...game,
    player: { ...game.player, x: game.player.x, y: game.player.y },
    clearing: { cleared, marked: null, felled: [] },
    inventory: { ...game.inventory, wood: 6, fiber: 2 },
    progress: { ...game.progress, homesteadFound: true, ...changes }
  });
  const build = (state: GameState) => applyAction(state, { type: 'build', structureId: 'orchard' });

  it('costs six wood and two fiber', () => {
    expect(BUILDINGS.orchard.cost).toEqual({ wood: 6, fiber: 2 });
    const built = build(ready());
    expect(built.message).toBe('Built the orchard.');
    expect(built.state.structures.orchard).toBe(true);
  });

  it('waits until the old homestead has been found, and says so', () => {
    const state = ready({ homesteadFound: false });
    expect(build(state).message).toBe('Find the old homestead first.');
    expect(buildStatus(state, 'orchard')).toBe('locked');
  });

  it('needs its ground cleared', () => {
    expect(build(ready({}, ['west-near', 'west-far'])).message).toBe("Clear the west side's outer ground first.");
  });
});

describe('a new game and an older save', () => {
  it('starts with no pips, no orchard and no trees', () => {
    expect(game.structures.orchard).toBe(false);
    expect(game.orchard).toEqual({ pips: 0, trees: [null, null, null, null, null, null] });
    expect(treesPlanted(game)).toBe(0);
  });

  it('upgrades a version 35 save to the same', () => {
    const old = structuredClone(game) as unknown as Record<string, any>;
    delete old.orchard;
    delete old.structures.orchard;
    const result = upgradeSave(35, old);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state).toEqual(game);
    if (result.ok) expect(saves(result.state as GameState)).toBe(true);
  });
});

describe('saves an orchard can really reach', () => {
  const tree = { plantedDay: 41, ripeDay: 41 };
  const planted = (count: number) => Array.from({ length: 6 }, (_, i) => (i < count ? tree : null));

  it('keeps pips and trees', () => {
    expect(saves(orchardCamp())).toBe(true);
    expect(saves(orchardCamp({ pips: 2, trees: planted(4) }))).toBe(true);
    expect(saves(orchardCamp({ trees: [{ plantedDay: 41, ripeDay: 65 }, null, null, null, null, null] }))).toBe(true);
  });

  it.each([
    ['more than six trees and pips', { pips: 3, trees: planted(4) }],
    ['a plantedDay after today', { trees: [{ plantedDay: 63, ripeDay: 63 }, null, null, null, null, null] }],
    ['a tree planted in winter', { trees: [{ plantedDay: 55, ripeDay: 55 }, null, null, null, null, null] }],
    ['a ripe day too far off', { trees: [{ plantedDay: 41, ripeDay: 66 }, null, null, null, null, null] }],
    ['a ripe day before planting', { trees: [{ plantedDay: 41, ripeDay: 40 }, null, null, null, null, null] }],
    ['too few slots', { trees: [null, null] }],
    ['a broken tree', { trees: [{ plantedDay: 41 } as never, null, null, null, null, null] }],
    ['a broken pip count', { pips: -1 }]
  ])('refuses %s', (_label, orchard) => {
    expect(saves(orchardCamp(orchard))).toBe(false);
  });

  it('keeps a camp that has neither found the homestead nor built an orchard', () => {
    expect(saves(orchardCamp({}, { structures: NO_ORCHARD, progress: NOT_FOUND }))).toBe(true);
  });

  it('refuses a tree without the orchard', () => {
    expect(saves(orchardCamp({ trees: planted(1) }, { structures: NO_ORCHARD }))).toBe(false);
  });

  it('refuses pips before the homestead is found', () => {
    expect(saves(orchardCamp({ pips: 1 }, { structures: NO_ORCHARD, progress: NOT_FOUND }))).toBe(false);
  });

  it('refuses the orchard before the homestead is found', () => {
    expect(saves(orchardCamp({}, { progress: NOT_FOUND }))).toBe(false);
  });

  it('refuses the orchard before its ground is cleared', () => {
    expect(saves(orchardCamp({}, { clearing: { cleared: ['west-near', 'west-far'], marked: null, felled: [] } }))).toBe(false);
  });
});

describe('growing', () => {
  it.each([[1, 40, 0], [1, 41, 1], [1, 120, 2], [1, 121, 3], [40, 41, 1], [40, 121, 3], [21, 121, 3]])(
    'planted day %i, on day %i, has seen %i autumns', (planted, day, autumns) => {
      expect(autumnsPassed(planted, day)).toBe(autumns);
    });

  it.each([[5, 'sprout'], [41, 'sapling'], [81, 'young'], [121, 'grown'], [400, 'grown']] as const)('on day %i a tree planted on day 1 is a %s', (day, stage) => {
    expect(treeStage({ plantedDay: 1, ripeDay: 1 }, day)).toBe(stage);
  });

  it('bears at its third autumn and only in autumn', () => {
    const tree = { plantedDay: 40, ripeDay: 40 };
    expect(treeBears(tree, 81)).toBe(false);
    expect(treeBears(tree, 121)).toBe(true);
    expect(treeBears(tree, 131)).toBe(false);
    expect(treeBears(tree, 161)).toBe(true);
  });

  it('is ripe only while bearing and past its ripe day', () => {
    expect(treeRipe({ plantedDay: 1, ripeDay: 1 }, 121)).toBe(true);
    expect(treeRipe({ plantedDay: 1, ripeDay: 124 }, 123)).toBe(false);
    expect(treeRipe({ plantedDay: 1, ripeDay: 124 }, 124)).toBe(true);
    expect(treeRipe({ plantedDay: 1, ripeDay: 1 }, 81)).toBe(false);
  });
});

const withFood = (state: GameState, item: Parameters<typeof addFood>[1], n = 1): GameState => ({ ...state, inventory: { ...state.inventory, food: addFood(state.inventory.food, item, n, state.day) } });
const tree = { plantedDay: 1, ripeDay: 1 };
const treesOf = (count: number) => Array.from({ length: 6 }, (_, i) => (i < count ? tree : null));

describe('saving pips', () => {
  const found = orchardCamp({}, { day: 5, structures: { ...game.structures, shelter: true } });
  const eat = (state: GameState) => applyAction(state, { type: 'eat', item: 'apple' });

  it('keeps one for each apple eaten, and says so only the first time', () => {
    const first = eat(withFood(found, 'apple', 2));
    expect(first.state.orchard.pips).toBe(1);
    expect(first.message).toBe('Ate an apple. You keep the pips.');
    const second = eat(first.state);
    expect(second.state.orchard.pips).toBe(2);
    expect(second.message).toBe('Ate an apple.');
  });

  it('stays quiet once a tree is planted, even with no pips left', () => {
    const planted = eat(withFood({ ...found, structures: { ...found.structures, orchard: true }, orchard: { pips: 0, trees: treesOf(1) } }, 'apple'));
    expect(planted.state.orchard.pips).toBe(1);
    expect(planted.message).toBe('Ate an apple.');
  });

  it('keeps none past six, counting trees and pips together', () => {
    const full = eat(withFood({ ...found, orchard: { pips: 2, trees: treesOf(4) } }, 'apple'));
    expect(full.state.orchard.pips).toBe(2);
    expect(full.message).toBe('Ate an apple.');
  });

  it('keeps none from other food', () => {
    expect(applyAction(withFood(found, 'berry'), { type: 'eat', item: 'berry' }).state.orchard.pips).toBe(0);
    expect(applyAction(withFood(found, 'greens'), { type: 'eat', item: 'greens' }).state.orchard.pips).toBe(0);
  });

  const atFire: Partial<GameState> = { fireFuel: 300, player: { ...game.player, x: 20, y: 16 } };

  it('keeps one from a baked apple, with the same word', () => {
    const baked = applyAction(withFood({ ...found, ...atFire }, 'apple'), { type: 'cook', dish: 'bakedApple' });
    expect(baked.state.inventory.food.apple).toEqual([]);
    expect(baked.state.orchard.pips).toBe(1);
    expect(baked.message.endsWith(' You keep the pips.')).toBe(true);
  });

  it('keeps one from an apple pie', () => {
    const ready = withFood(withFood(withFood({ ...found, ...atFire, progress: { ...found.progress, potCrafted: true } }, 'apple'), 'egg'), 'flour');
    const pie = applyAction(ready, { type: 'cook', dish: 'applePie' });
    expect(pie.state.orchard.pips).toBe(1);
  });

  it('keeps none from another dish', () => {
    const berries = applyAction(withFood({ ...found, ...atFire }, 'berry'), { type: 'cook', dish: 'berries' });
    expect(berries.state.inventory.food.berry).toEqual([]);
    expect(berries.state.orchard.pips).toBe(0);
  });

  it('keeps none from an apple that goes rotten', () => {
    const old = withFood({ ...found, day: 1 }, 'apple');
    const later = applyAction({ ...old, day: 30, timeOfDay: 200, player: { ...old.player, x: 20, y: 16 } }, { type: 'sleep' }).state;
    expect(later.inventory.food.apple).toEqual([]);
    expect(later.orchard.pips).toBe(0);
  });
});

describe('planting a pip', () => {
  const by = (spot: number) => ({ x: ORCHARD_SPOTS[spot].x, y: ORCHARD_SPOTS[spot].y });
  const standing = (spot: number, orchard: Partial<OrchardState>, changes: Partial<GameState> = {}): GameState =>
    orchardCamp(orchard, { player: { ...game.player, ...by(spot) }, ...changes });
  const plant = (state: GameState, spot: number) => applyAction(state, { type: 'plantPip', spot });

  it('spends a pip and fills the spot, for the work of gathering', () => {
    const state = standing(2, { pips: 2 });
    const { state: after, message } = plant(state, 2);
    expect(after.orchard.pips).toBe(1);
    expect(after.orchard.trees[2]).toEqual({ plantedDay: 62, ripeDay: 62 });
    expect(message).toBe('You plant a pip and mark it with a stake.');
    expect(after.player.energy).toBeLessThan(state.player.energy);
    expect(after.timeOfDay).toBeGreaterThan(state.timeOfDay);
  });

  it.each([
    ['away from the spot', standing(0, { pips: 1 }), 5, 'Stand beside the spot.'],
    ['on a tree', standing(0, { pips: 1, trees: treesOf(1) }), 0, 'Something is already growing here.'],
    ['with no pips', standing(0, {}), 0, 'You have no pips to plant.'],
    ['in winter', standing(0, { pips: 1 }, { day: 55 }), 0, 'The ground is frozen hard.'],
    ['off the plot', standing(0, { pips: 1 }), 6, "That spot isn't there."],
    ['with no index', standing(0, { pips: 1 }), 0.5, "That spot isn't there."],
    ['with no orchard', standing(0, { pips: 1 }, { structures: game.structures }), 0, 'Build the orchard first.']
  ])('refuses %s', (_label, state, spot, message) => {
    const refused = plant(state, spot);
    expect(refused.message).toBe(message);
    expect(refused.state).toBe(state);
  });

  it('plants from another area never', () => {
    const state = standing(0, { pips: 1 }, { area: 'homestead' });
    expect(plant(state, 0).message).toBe('Stand beside the spot.');
  });
});

describe('picking from your own tree', () => {
  const AUTUMN = 121;
  const standing = (spot: number, orchard: Partial<OrchardState>, changes: Partial<GameState> = {}): GameState =>
    orchardCamp(orchard, { day: AUTUMN, player: { ...game.player, x: ORCHARD_SPOTS[spot].x, y: ORCHARD_SPOTS[spot].y }, ...changes });
  const pick = (state: GameState, spot: number) => applyAction(state, { type: 'pickOrchardApple', spot });

  it('gives an apple and leaves only that tree waiting', () => {
    const state = standing(1, { trees: treesOf(3) });
    const { state: after, message } = pick(state, 1);
    expect(message).toBe('You pick an apple from your own tree.');
    expect(after.inventory.food.apple).toEqual([AUTUMN]);
    expect(after.orchard.trees[1]).toEqual({ plantedDay: 1, ripeDay: AUTUMN + 3 });
    expect(after.orchard.trees[0]).toEqual(tree);
    expect(after.orchard.trees[2]).toEqual(tree);
    expect(after.player.energy).toBeLessThan(state.player.energy);
  });

  const full = { ...game.inventory, food: addFood(game.inventory.food, 'berry', 20, AUTUMN) };
  it.each([
    ['away from it', standing(0, { trees: treesOf(6) }), 5, 'Stand beside the tree.'],
    ['an empty spot', standing(0, {}), 0, 'Stand beside the tree.'],
    ['a young tree', standing(0, { trees: [{ plantedDay: 41, ripeDay: 41 }, null, null, null, null, null] }), 0, 'This tree is too young for apples.'],
    ['out of season', standing(0, { trees: treesOf(1) }, { day: 141 }), 0, 'The tree bears apples in autumn.'],
    ['just picked', standing(0, { trees: [{ plantedDay: 1, ripeDay: AUTUMN + 1 }, null, null, null, null, null] }), 0, 'The tree has no ripe apples yet.'],
    ['a full bag', standing(0, { trees: treesOf(1) }, { inventory: full }), 0, 'Make room in your bag for an apple.'],
    ['off the plot', standing(0, { trees: treesOf(1) }), 9, "That spot isn't there."]
  ])('refuses %s', (_label, state, spot, message) => {
    const refused = pick(state, spot);
    expect(refused.message).toBe(message);
    expect(refused.state).toBe(state);
  });
});

describe('the nearest spot', () => {
  const at = (x: number, y: number, changes: Partial<GameState> = {}) => orchardCamp({}, { player: { ...game.player, x, y }, ...changes });

  it('is the closer of two in reach', () => {
    expect(nearestSpot(at(3.8, 10))).toBe(0);
    expect(nearestSpot(at(4.2, 10))).toBe(1);
  });

  it('is nothing far away, in another area, or with no orchard', () => {
    expect(nearestSpot(at(20, 16))).toBeNull();
    expect(nearestSpot(at(3, 10, { area: 'homestead' }))).toBeNull();
    expect(nearestSpot(at(3, 10, { structures: game.structures }))).toBeNull();
  });
});

describe('what a spot offers', () => {
  const at = (day: number, orchard: Partial<OrchardState>) => orchardCamp(orchard, { day, player: { ...game.player, x: 3, y: 10 } });
  const action = (state: GameState): GameAction | null => spotAction(state, 0);

  it('plants an empty spot with a pip in the right season', () => {
    expect(action(at(62, { pips: 1 }))).toEqual({ type: 'plantPip', spot: 0 });
    expect(action(at(62, {}))).toBeNull();
    expect(action(at(55, { pips: 1 }))).toBeNull();
  });

  it('picks a ripe tree, and nothing else on a tree', () => {
    expect(action(at(121, { trees: treesOf(1) }))).toEqual({ type: 'pickOrchardApple', spot: 0 });
    expect(action(at(141, { trees: treesOf(1) }))).toBeNull();
    expect(action(at(121, { trees: [{ plantedDay: 1, ripeDay: 122 }, null, null, null, null, null] }))).toBeNull();
  });
});

describe('the first apples', () => {
  const NOTE = 'There are apples on your own tree this morning.';
  const on = (day: number, trees = [{ plantedDay: 1, ripeDay: 1 }, null, null, null, null, null] as OrchardState['trees']) => orchardCamp({ trees }, { day });

  it('gets a morning note, as part of the day\'s news', () => {
    expect(orchardNews(on(120), on(121))).toEqual([NOTE]);
    expect(newsBetween(on(120), on(121))).toContain(NOTE);
  });

  it('gets none in other years, on other mornings, or with no trees', () => {
    expect(orchardNews(on(160), on(161))).toEqual([]);
    expect(orchardNews(on(121), on(122))).toEqual([]);
    expect(orchardNews(on(80), on(81))).toEqual([]);
    expect(orchardNews(orchardCamp({}, { day: 120 }), orchardCamp({}, { day: 121 }))).toEqual([]);
  });

  it('gets none when a younger tree comes to bear later', () => {
    const both = [{ plantedDay: 1, ripeDay: 1 }, { plantedDay: 41, ripeDay: 41 }, null, null, null, null];
    expect(orchardNews(on(160, both), on(161, both))).toEqual([]);
  });
});

describe('the journal line', () => {
  const LINE = 'Picked an apple from a tree I grew myself.';
  const ready = orchardCamp({ trees: treesOf(2) }, { day: 121, player: { ...game.player, x: 3, y: 10 } });
  const written = (state: GameState, spot: number) => {
    const action: GameAction = { type: 'pickOrchardApple', spot };
    return recordJournal(state, applyAction(state, action).state, action).state;
  };

  it('is written on the first pick of the autumn, once', () => {
    const once = written(ready, 0);
    expect(journalPageView(once, 12).entries.map(entry => entry.line)).toContain(LINE);
    const twice = written({ ...once, player: ready.player }, 1);
    expect(twice.journal.filter(entry => entry.id === 'orchardApple')).toHaveLength(1);
  });

  it('is not written by a refused pick', () => {
    expect(written({ ...ready, day: 81 }, 0).journal.filter(entry => entry.id === 'orchardApple')).toEqual([]);
  });

  it('stays off the page until the orchard stands', () => {
    const blanks = (state: GameState) => journalPageView(state, 0).blanks;
    expect(blanks(orchardCamp({}, { day: 5 }))).toBe(blanks(orchardCamp({}, { day: 5, structures: { ...game.structures, shelter: true } })) + 1);
  });
});

describe('how a tree looks', () => {
  const planted = { plantedDay: 1, ripeDay: 1 };

  it.each([
    [5, 'sprout'], [51, 'saplingBare'], [71, 'sapling'],
    [91, 'youngBare'], [101, 'youngBlossom'], [111, 'youngGreen'], [81, 'youngAutumn'],
    [131, 'grownBare'], [141, 'grownBlossom'], [151, 'grownGreen'], [121, 'grownFruit']
  ])('on day %i it is drawn as %s', (day, frame) => {
    expect(treeFrame(planted, day)).toBe(frame);
  });

  it('shows no apples just after a picking', () => {
    expect(treeFrame({ plantedDay: 1, ripeDay: 124 }, 121)).toBe('grownAutumn');
  });

  it('has art for every frame, and each age looks different', () => {
    const { frames } = sprites.orchardTree;
    const all = ['sprout', 'saplingBare', 'sapling', 'youngBare', 'youngBlossom', 'youngGreen', 'youngAutumn', 'grownBare', 'grownBlossom', 'grownGreen', 'grownAutumn', 'grownFruit'];
    for (const frame of all) expect(frames[frame], frame).toBeDefined();
    expect(new Set(all.map(frame => frames[frame].join())).size).toBe(all.length);
    const painted = (frame: string) => frames[frame].join('').replaceAll('.', '').length;
    expect(painted('sprout')).toBeLessThan(painted('sapling'));
    expect(painted('sapling')).toBeLessThan(painted('youngGreen'));
    expect(painted('youngGreen')).toBeLessThan(painted('grownGreen'));
  });
});

describe('the orchard on the map', () => {
  const visuals = (state: GameState) => sceneVisuals(state, 0);

  it('lies flat as a ground decal once built, under the survivor and trees', () => {
    const plot = visuals(orchardCamp()).find(visual => visual.id === 'orchard')!;
    expect(plot.texture).toBe('orchard:built');
    expect(plot.depth).toBeLessThan(0);
  });

  it('draws a tree for each one planted, and nothing on an empty spot', () => {
    const state = orchardCamp({ trees: [null, { plantedDay: 1, ripeDay: 1 }, null, null, null, null] });
    const trees = visuals(state).filter(visual => visual.id.startsWith('orchard-tree-'));
    expect(trees.map(tree => [tree.id, tree.texture])).toEqual([['orchard-tree-1', 'orchardTree:sapling']]);
  });

  it('sorts trees by how far down the plot they stand', () => {
    const state = orchardCamp({ trees: treesOf(6) });
    const depth = (index: number) => visuals(state).find(visual => visual.id === `orchard-tree-${index}`)!.depth;
    expect(depth(4)).toBeGreaterThan(depth(1));
  });

  it('shows only the marked site before the build, and nothing before the homestead is found', () => {
    const unbuilt = { ...game.structures, shelter: true };
    expect(visuals(orchardCamp({}, { structures: unbuilt })).find(visual => visual.id === 'orchard')?.texture).toBe('orchardSite:still');
    expect(visuals(orchardCamp({}, { structures: unbuilt, progress: { ...game.progress, homesteadFound: false } })).find(visual => visual.id === 'orchard')).toBeUndefined();
  });
});

describe('tapping in the orchard', () => {
  const tap = (state: GameState, spot: number) => pickTapTarget(state, ORCHARD_SPOTS[spot].x, ORCHARD_SPOTS[spot].y);

  it('finds the spot tapped', () => {
    expect(tap(orchardCamp(), 4)).toMatchObject({ kind: 'orchard', spot: 4, x: 5, y: 13 });
  });

  it('plants an empty spot with a pip, from anywhere', () => {
    expect(targetAction(tap(orchardCamp({ pips: 1 }), 4))).toEqual({ type: 'plantPip', spot: 4 });
  });

  it('picks a ripe tree', () => {
    expect(targetAction(tap(orchardCamp({ trees: treesOf(1) }, { day: 121 }), 0))).toEqual({ type: 'pickOrchardApple', spot: 0 });
  });

  it('counts a tap on a grown tree\'s branches as the tree', () => {
    const state = orchardCamp({ trees: [null, null, null, treesOf(1)[0], null, null] }, { day: 121 });
    expect(pickTapTarget(state, 3, 11.4)).toMatchObject({ kind: 'orchard', spot: 3 });
  });

  it('only walks to a tree with nothing to offer', () => {
    const target = tap(orchardCamp({ trees: treesOf(1) }, { day: 141 }), 0);
    expect(target.kind).toBe('orchard');
    expect(targetAction(target)).toBeNull();
  });

  it('only walks to an empty spot with no pip', () => {
    expect(targetAction(tap(orchardCamp(), 0))).toBeNull();
  });

  it('is ground with no orchard', () => {
    expect(tap(orchardCamp({}, { structures: game.structures }), 0).kind).toBe('ground');
  });

  it('never asks a name for a tap on a tree', () => {
    const state = orchardCamp({ trees: treesOf(1) }, { sheep: { ...game.sheep, arrived: true, fluff: 40, fedUntil: 1 } });
    expect(unnamedAnimalAt(state, 0, ORCHARD_SPOTS[0].x, ORCHARD_SPOTS[0].y)).toBeNull();
  });
});

describe('the prompt in the orchard', () => {
  const at = (day: number, orchard: Partial<OrchardState>) => orchardCamp(orchard, { day, player: { ...game.player, x: 3, y: 10 } });
  const waiting = [{ plantedDay: 1, ripeDay: 122 }, null, null, null, null, null];
  const young = [{ plantedDay: 41, ripeDay: 41 }, null, null, null, null, null];

  it.each([
    ['Pick apples', at(121, { trees: treesOf(1) }), { type: 'pickOrchardApple', spot: 0 }],
    ['Plant a pip', at(62, { pips: 1 }), { type: 'plantPip', spot: 0 }],
    ['Apple tree · no ripe apples yet', at(121, { trees: waiting }), undefined],
    ['Apple tree · apples come in autumn', at(141, { trees: treesOf(1) }), undefined],
    ['Young apple tree · not bearing yet', at(62, { trees: young }), undefined],
    ['Orchard spot · the ground is frozen', at(55, { pips: 1 }), undefined],
    ['Orchard spot · no pips', at(62, {}), undefined]
  ])('says %s', (label, state, action) => {
    expect(orchardChoice(state)).toEqual(action ? { label, action } : { label });
  });

  it('says nothing away from the plot', () => {
    expect(orchardChoice(orchardCamp({}, { player: { ...game.player, x: 20, y: 16 } }))).toBeNull();
  });
});

describe('the pips in the bag', () => {
  it.each([[0, ''], [1, '1 apple pip'], [2, '2 apple pips']])('with %i says %j', (pips, line) => {
    expect(pipsLine(orchardCamp({ pips }))).toBe(line);
  });
});

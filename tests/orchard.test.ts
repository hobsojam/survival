import { describe, expect, it } from 'vitest';
import { CLEARING_STEPS, STEP_IDS, inClearedPatch, placeBranches, previousStep, stepGround, stepWhere, type StepId } from '../src/game/clearing';
import { ORCHARD_SPOTS, emptyOrchard, treesPlanted, type OrchardState } from '../src/game/orchard';
import { applyAction, buildStatus } from '../src/game/rules';
import { saveGame } from '../src/game/save';
import { upgradeSave } from '../src/game/saveUpgrades';
import { BUILDINGS, SITES, createGame, type GameState } from '../src/game/state';
import { buildMap } from '../src/scene/map';

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
export function orchardCamp(orchard: Partial<OrchardState> = {}, changes: Partial<GameState> = {}): GameState {
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

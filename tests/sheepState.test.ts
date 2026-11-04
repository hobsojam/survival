import { describe, expect, it } from 'vitest';
import { BALANCE, BUILDINGS, createGame, type GameState, type StructureId } from '../src/game/state';
import { CLEARING_STEPS, STEP_IDS, clearingReach, inClearing, placeBranches, previousStep, stepGround } from '../src/game/clearing';
import { applyAction, groundBlocker } from '../src/game/rules';
import { clearingView } from '../src/ui/panels';
import { saveGame } from '../src/game/save';
import { SAVE_VERSION, upgradeSave } from '../src/game/saveUpgrades';
import { buildMap } from '../src/scene/map';
import { CAMP_STRUCTURES } from '../src/scene/visuals';

const fakeStorage = (): Storage => {
  const items = new Map<string, string>();
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) } as unknown as Storage;
};
const saves = (state: GameState): boolean => saveGame(fakeStorage(), state).ok;
const MEADOW_CORNERS = [[31, 2], [37, 2], [31, 7], [37, 7]] as const;
const game = createGame();
const WITHOUT_MEADOW = STEP_IDS.filter(id => id !== 'east-outer');

describe('the sheep in a new game', () => {
  it('starts with no pen, no loom, no sheep and no straw', () => {
    expect(game.structures.sheepPen).toBe(false);
    expect(game.structures.loom).toBe(false);
    expect(game.sheep).toEqual({ arrived: false, fluff: 0, fedUntil: null, lastShornYear: null, wool: 0, woven: { blanket: false, jumper: false, rug: false } });
    expect(game.field.straw).toBe(0);
    expect(game.progress.workshop.shears).toBe(false);
    expect(saves(game)).toBe(true);
  });
});

describe('the east meadow', () => {
  it('follows the east far ground, at the outer price, with three trees', () => {
    expect(STEP_IDS[STEP_IDS.indexOf('east-far') + 1]).toBe('east-outer');
    expect(previousStep('east-outer')).toBe('east-far');
    expect(CLEARING_STEPS['east-outer'].cost).toEqual({ wood: 8, fiber: 4, stone: 2 });
    expect(CLEARING_STEPS['east-outer'].trees).toHaveLength(3);
    expect(CLEARING_STEPS['east-outer'].room).toEqual(['sheepPen']);
  });

  it('counts as cleared ground only once it is cleared', () => {
    for (const [x, y] of MEADOW_CORNERS) {
      expect(inClearing(x, y, WITHOUT_MEADOW), `${x},${y}`).toBe(false);
      expect(inClearing(x, y, STEP_IDS), `${x},${y}`).toBe(true);
    }
  });

  it('does not widen the clearing around the fire', () => {
    for (let angle = 0; angle < 360; angle += 5) {
      const x = BALANCE.campX + Math.cos(angle * Math.PI / 180) * 10, y = BALANCE.campY + Math.sin(angle * Math.PI / 180) * 10;
      expect(clearingReach(x, y, STEP_IDS), `${angle}`).toBe(clearingReach(x, y, WITHOUT_MEADOW));
    }
  });

  it('keeps every marked tree on the meadow', () => {
    for (const tree of CLEARING_STEPS['east-outer'].trees) {
      expect(inClearing(tree.x, tree.y, STEP_IDS), `${tree.x},${tree.y}`).toBe(true);
    }
  });

  it('has no decorative tree standing on it once cleared', () => {
    const map = buildMap(game.nodes, 'camp-both-open', 'autumn', { cleared: [...STEP_IDS], marked: null, felled: [] });
    const onMeadow = [...map.trees, ...map.groves.flat()].filter(tree => tree.x >= 31 && tree.x <= 37 && tree.y >= 2 && tree.y <= 7);
    expect(onMeadow).toEqual([]);
  });

  it('hides the pen until its ground is clear', () => {
    expect(groundBlocker(game, 'sheepPen')).not.toBeNull();
    expect(groundBlocker({ ...game, clearing: { cleared: ['east-near', 'east-far', 'east-outer'], marked: null, felled: [] } }, 'sheepPen')).toBeNull();
  });
});

describe('upgrading a save', () => {
  it('gives an older camp its unbuilt pen and loom, no sheep and no straw', () => {
    const old = structuredClone(createGame()) as unknown as Record<string, any>;
    delete old.sheep;
    delete old.field.straw;
    delete old.structures.sheepPen;
    delete old.structures.loom;
    delete old.progress.workshop.shears;
    const result = upgradeSave(SAVE_VERSION - 1, old);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state).toEqual(createGame());
  });
});

/** A real camp in year two's spring, with the pen and its ground, that saves unless its flock is impossible. */
function flockCamp(flock: Partial<GameState['sheep']>, extra: StructureId[] = [], without: StructureId[] = []): GameState {
  const structures = { ...game.structures };
  const want: string[] = ['sheepPen', 'workshop', 'granary', ...extra];
  while (want.length) {
    const id = want.pop() as StructureId;
    const building = BUILDINGS[id];
    if (!building) continue;
    if (!without.includes(id)) structures[id] = true;
    if (building.prerequisite) want.push(building.prerequisite);
    if ('alsoRequires' in building && building.alsoRequires) want.push(building.alsoRequires);
  }
  const placed = placeBranches(game.nodes, [...STEP_IDS]);
  return {
    ...game,
    day: 62,
    nodes: game.nodes.map((node, i) => ({ ...node, x: placed[i].x, y: placed[i].y })),
    clearing: { cleared: [...STEP_IDS], marked: null, felled: [] },
    structures,
    progress: { ...game.progress, nextStormDay: null, hearthUnlocked: true, workshop: { ...game.progress.workshop, shears: true } },
    sheep: { ...game.sheep, ...flock }
  };
}

describe('saves a flock can really reach', () => {
  const shorn = { arrived: true, fluff: 0, fedUntil: 60, lastShornYear: 2 };
  it.each<[string, GameState]>([
    ['a pen with nothing in it', flockCamp({})],
    ['feed out before they come', flockCamp({ fedUntil: 65 })],
    ['a flock that has just come', flockCamp({ arrived: true, fluff: 40, fedUntil: 65 })],
    ['a cloud', flockCamp({ arrived: true, fluff: 200, fedUntil: 60 })],
    ['a full basket', flockCamp({ ...shorn, wool: 8 })],
    ['a shorn flock with the loom', flockCamp({ ...shorn, wool: 4 }, ['loom'])],
    ['everything woven', flockCamp({ ...shorn, woven: { blanket: true, jumper: true, rug: true } }, ['loom', 'bed', 'house'])]
  ])('saves %s', (_name, state) => {
    expect(saves(state)).toBe(true);
  });
});

describe('where the loom stands', () => {
  it('is on cleared ground by the time it can be built, since the flock needs the field on the south ground', () => {
    const [, dx, dy] = CAMP_STRUCTURES.find(([id]) => id === 'loom')!;
    expect(BUILDINGS.sheepPen.prerequisite).toBe('field');
    expect(BUILDINGS.field.ground).toBe('south-far');
    expect(inClearing(BALANCE.campX + dx, BALANCE.campY + dy, ['east-near', 'east-far', 'south-near', 'south-far'])).toBe(true);
  });
});

describe('saves that cannot happen', () => {
  const sheep = (changes: Partial<GameState['sheep']>, more: Partial<GameState> = {}): GameState => ({ ...game, ...more, sheep: { ...game.sheep, ...changes } });

  it.each([
    ['sheep without a pen', sheep({ arrived: true, fluff: 40 })],
    ['fluff on sheep that have not come', sheep({ fluff: 10 })],
    ['fluff past the cap', sheep({ arrived: true, fluff: 201 })],
    ['wool past the basket', sheep({ wool: 9 })],
    ['straw past the cap', { ...game, field: { ...game.field, straw: 13 } }],
    ['a loom before any shearing', { ...flockCamp({ arrived: true, fluff: 40, fedUntil: 60 }, ['loom']) }],
    ['a shearing with no shears', { ...flockCamp({ arrived: true, fluff: 0, fedUntil: 60, lastShornYear: 2 }), progress: { ...flockCamp({}).progress, workshop: { ...flockCamp({}).progress.workshop, shears: false } } }],
    ['a blanket with no bed', flockCamp({ arrived: true, fluff: 0, fedUntil: 60, lastShornYear: 2, woven: { blanket: true, jumper: false, rug: false } }, ['loom'], ['bed', 'house'])],
    ['a rug with no house', flockCamp({ arrived: true, fluff: 0, fedUntil: 60, lastShornYear: 2, woven: { blanket: false, jumper: false, rug: true } }, ['loom'], ['house'])],
    ['a shearing with no sheep', sheep({ lastShornYear: 1 })],
    ['a woven item with no loom', sheep({ woven: { blanket: false, jumper: true, rug: false } })],
    ['a feed day that is not a number', sheep({ fedUntil: 'soon' as unknown as number })]
  ])('rejects %s', (_name, state) => {
    expect(saves(state)).toBe(false);
  });
});

describe('finding the meadow', () => {
  const marking = (): GameState => ({ ...flockCamp({}), clearing: { cleared: STEP_IDS.filter(id => id !== 'east-outer'), marked: null, felled: [] }, structures: { ...game.structures }, progress: { ...game.progress, axeCrafted: true } });

  it('says where its marked trees are, not just which side', () => {
    const { message } = applyAction(marking(), { type: 'markClearing', step: 'east-outer' });
    expect(message).toBe('Tied pale fibre round 3 trees up past the lookout.');
  });

  it('keeps pointing there while they are felled and cleared', () => {
    const marked = applyAction(marking(), { type: 'markClearing', step: 'east-outer' }).state;
    expect(clearingView(marked).clear.copy).toBe('Fell the 3 marked trees left up past the lookout.');
    const felled = { ...marked, clearing: { ...marked.clearing, felled: [0, 1, 2] } };
    expect(clearingView(felled).clear.copy).toBe('Ready to clear the meadow up past the lookout.');
    expect(stepGround('east-outer')).toBe('the meadow up past the lookout');
    expect(stepGround('east-near')).toBe('the east side');
  });

  it('still names the side for ordinary ground', () => {
    const state = { ...marking(), clearing: { cleared: [], marked: null, felled: [] } };
    expect(applyAction(state, { type: 'markClearing', step: 'east-near' }).message).toBe('Tied pale fibre round 4 trees on the east side.');
  });
});

import { describe, expect, it } from 'vitest';
import { BALANCE, createGame, type GameState } from '../src/game/state';
import { CLEARING_STEPS, STEP_IDS, clearingReach, inClearing, previousStep } from '../src/game/clearing';
import { groundBlocker } from '../src/game/rules';
import { saveGame } from '../src/game/save';
import { SAVE_VERSION, upgradeSave } from '../src/game/saveUpgrades';
import { buildMap } from '../src/scene/map';

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

describe('saves that cannot happen', () => {
  const sheep = (changes: Partial<GameState['sheep']>, more: Partial<GameState> = {}): GameState => ({ ...game, ...more, sheep: { ...game.sheep, ...changes } });
  const built = (...ids: (keyof GameState['structures'])[]): Partial<GameState> => ({ structures: { ...game.structures, ...Object.fromEntries(ids.map(id => [id, true])) } });

  it.each([
    ['sheep without a pen', sheep({ arrived: true, fluff: 40 })],
    ['fluff on sheep that have not come', sheep({ fluff: 10 })],
    ['fluff past the cap', sheep({ arrived: true, fluff: 201 })],
    ['wool past the basket', sheep({ wool: 9 })],
    ['straw past the cap', { ...game, field: { ...game.field, straw: 13 } }],
    ['a loom before any shearing', sheep({}, built('loom'))],
    ['a shearing with no sheep', sheep({ lastShornYear: 1 })],
    ['a woven item with no loom', sheep({ woven: { blanket: false, jumper: true, rug: false } })],
    ['a feed day that is not a number', sheep({ fedUntil: 'soon' as unknown as number })]
  ])('rejects %s', (_name, state) => {
    expect(saves(state)).toBe(false);
  });
});

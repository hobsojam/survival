import { describe, expect, it } from 'vitest';
import { STEP_IDS } from '../src/game/clearing';
import { emptyOrchard, treeStage } from '../src/game/orchard';
import { createGame, type GameState } from '../src/game/state';
import { emptyCastle } from '../src/game/castle';
import { campView, castleView } from '../src/scene/keepViewCamp';

const game = createGame();
const withBuilt = (...built: (keyof GameState['structures'])[]): GameState => ({
  ...game,
  structures: { ...game.structures, ...Object.fromEntries(built.map(id => [id, true])) }
});
const AUTUMN_YEAR_FOUR = 121;
const SPRING_YEAR_FOUR = 141;
const planted = (day: number) => ({ plantedDay: day, ripeDay: day + 120 });
const withTrees = (day: number, ...trees: ReturnType<typeof planted>[]): GameState => ({
  ...withBuilt('orchard'),
  day,
  orchard: { ...emptyOrchard(), trees: emptyOrchard().trees.map((_, i) => trees[i] ?? null) }
});

describe('what the camp shows from the keep', () => {
  it('a new camp shows only its clearing and fire', () => {
    expect(campView(game)).toEqual({
      clearingRadius: 15, shelter: 'none', campfire: true, house: false, beds: false, well: false, workshop: false, field: false, windmill: false, bakery: false, sheep: 0, orchard: null, castle: { line: false, walls: 0, towers: 0, gatehouse: false, moat: false }
    });
  });

  it.each([
    ['vegetableBeds', 'beds'], ['well', 'well'], ['workshop', 'workshop'], ['field', 'field'], ['windmill', 'windmill'], ['bakery', 'bakery']
  ] as const)('%s appears only once built', (structure, flag) => {
    expect(campView(game)[flag]).toBe(false);
    expect(campView(withBuilt(structure))).toEqual({ ...campView(game), [flag]: true });
  });

  it('the shelter reads as a woodshed once the house stands, and the campfire goes', () => {
    expect(campView(withBuilt('shelter'))).toMatchObject({ shelter: 'shelter', campfire: true, house: false });
    expect(campView(withBuilt('shelter', 'house'))).toMatchObject({ shelter: 'woodshed', campfire: false, house: true });
  });

  it('the clearing widens with each cleared step', () => {
    const radii = STEP_IDS.map((_, i) => campView({ ...game, clearing: { ...game.clearing, cleared: STEP_IDS.slice(0, i + 1) } }).clearingRadius);
    [15, ...radii].reduce((previous, radius) => { expect(radius).toBeGreaterThan(previous); return radius; });
    expect(radii.at(-1)).toBe(30);
  });

  it('sheep show once they have arrived, and not for an empty pen', () => {
    expect(campView(withBuilt('sheepPen')).sheep).toBe(0);
    expect(campView({ ...game, sheep: { ...game.sheep, arrived: true } }).sheep).toBe(3);
  });

  it('the orchard shows a tree for each one planted', () => {
    expect(campView(withBuilt('orchard')).orchard).toEqual([]);
    const young = planted(AUTUMN_YEAR_FOUR - 80);
    const old = planted(1);
    const state = withTrees(AUTUMN_YEAR_FOUR, young, old);
    expect(campView(state).orchard?.map(tree => tree.stage)).toEqual([treeStage(young, AUTUMN_YEAR_FOUR), treeStage(old, AUTUMN_YEAR_FOUR)]);
  });

  it('only a grown tree in autumn has apples', () => {
    const old = planted(1);
    const young = planted(AUTUMN_YEAR_FOUR - 80);
    expect(treeStage(old, AUTUMN_YEAR_FOUR)).toBe('grown');
    expect(treeStage(young, AUTUMN_YEAR_FOUR)).toBe('young');
    expect(campView(withTrees(AUTUMN_YEAR_FOUR, old, young)).orchard?.map(tree => tree.apples)).toEqual([true, false]);
    expect(campView(withTrees(SPRING_YEAR_FOUR, old)).orchard?.[0].apples).toBe(false);
  });
});

describe('what the castle shows from the keep', () => {
  it('shows nothing before the line of stones has shown', () => {
    expect(castleView(game)).toEqual({ line: false, walls: 0, towers: 0, gatehouse: false, moat: false });
  });

  it('shows the line once revealed', () => {
    expect(castleView({ ...game, castle: { ...emptyCastle(), revealedDay: 5 } })).toEqual({ line: true, walls: 0, towers: 0, gatehouse: false, moat: false });
    expect(campView({ ...game, castle: { ...emptyCastle(), revealedDay: 5 } }).castle).toEqual({ line: true, walls: 0, towers: 0, gatehouse: false, moat: false });
  });
});

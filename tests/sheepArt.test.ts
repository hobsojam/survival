import { describe, expect, it } from 'vitest';
import { sheepSprites } from '../src/art/sheepSprites';
import { validateSprite } from '../src/art/textures';
import { sprites } from '../src/art/sprites';
import { createGame, type GameState } from '../src/game/state';
import { worldX, worldY } from '../src/scene/art';
import { SHEEP_RACK, sceneVisuals } from '../src/scene/visuals';

const paintedWidth = (rows: readonly string[]): number => {
  const columns = rows.flatMap(row => [...row].flatMap((cell, x) => (cell === '.' ? [] : [x])));
  return Math.max(...columns) - Math.min(...columns) + 1;
};

const STAGES = ['shorn', 'woolly', 'round', 'cloud'] as const;

function flock(fluff: number, sheep: Partial<GameState['sheep']> = {}, day = 25): GameState {
  const base = createGame();
  return {
    ...base,
    day,
    clearing: { cleared: ['east-near', 'east-far', 'east-outer', 'south-near', 'south-far'], marked: null, felled: [] },
    structures: { ...base.structures, shelter: true, field: true, sheepPen: true },
    sheep: { ...base.sheep, arrived: true, fluff, fedUntil: 1, ...sheep }
  };
}
const sheepVisuals = (state: GameState, timeMs = 0) => sceneVisuals(state, timeMs).filter(visual => /^sheep-\d$/.test(visual.id));

describe('the flock\'s sprites', () => {
  it('are all valid', () => {
    for (const [name, def] of Object.entries(sheepSprites)) expect(() => validateSprite(def), name).not.toThrow();
    expect(Object.keys(sprites)).toEqual(expect.arrayContaining(Object.keys(sheepSprites)));
  });

  it('have every look, standing and walking', () => {
    for (const stage of STAGES) expect(Object.keys(sheepSprites.sheep.frames)).toEqual(expect.arrayContaining([`${stage}Idle`, `${stage}Walk`]));
    expect(Object.keys(sheepSprites.sheepPen.frames)).toContain('built');
    expect(sheepSprites.sheepPen.size).toEqual([96, 80]);
  });

  it('make a cloud at least twice as wide as a shorn sheep, and unlike a round one', () => {
    const { frames } = sheepSprites.sheep;
    expect(paintedWidth(frames.cloudIdle)).toBeGreaterThanOrEqual(2 * paintedWidth(frames.shornIdle));
    expect(frames.cloudIdle).not.toEqual(frames.roundIdle);
    expect(frames.cloudWalk).not.toEqual(frames.cloudIdle);
  });
});

describe('the flock in the scene', () => {
  it('has no sheep before they arrive, then three', () => {
    expect(sheepVisuals(flock(0, { arrived: false, fedUntil: null }))).toHaveLength(0);
    expect(sheepVisuals(flock(40))).toHaveLength(3);
  });

  it('keeps them inside the pen at any moment, however fat', () => {
    for (const fluff of [0, 40, 120, 200]) {
      for (const timeMs of [0, 1234, 9000, 40000, 123456, 987654]) {
        for (const fed of [1, 40]) {
          for (const sheep of sheepVisuals(flock(fluff, { fedUntil: fed }), timeMs)) {
            expect(sheep.x).toBeGreaterThanOrEqual(worldX(31) - 8 + 23);
            expect(sheep.x).toBeLessThanOrEqual(worldX(37) - 8 - 23);
            expect(sheep.y).toBeGreaterThanOrEqual(worldY(2) + 32);
            expect(sheep.y).toBeLessThanOrEqual(worldY(7) - 8);
          }
        }
      }
    }
  });

  it.each([[0, 'shorn'], [40, 'woolly'], [120, 'round'], [200, 'cloud']] as const)('draws %i fluff as %s', (fluff, stage) => {
    for (const sheep of sheepVisuals(flock(fluff))) expect(sheep.texture.startsWith(`sheep:${stage}`)).toBe(true);
  });

  it('draws them over the pen, whichever way they wander', () => {
    const state = flock(40);
    const pen = sceneVisuals(state, 0).find(visual => visual.id === 'sheepPen')!;
    for (const sheep of sheepVisuals(state, 500)) expect(sheep.depth).toBeGreaterThan(pen.depth);
  });

  it('gives each sheep a cap of snow in winter, and only then', () => {
    const caps = (state: GameState) => sceneVisuals(state, 0).filter(visual => visual.id.endsWith('-snow') && visual.id.startsWith('sheep'));
    expect(caps(flock(40, {}, 15))).toHaveLength(3);
    expect(caps(flock(40, {}, 25))).toHaveLength(0);
    expect(caps(flock(40, {}, 5))).toHaveLength(0);
    expect(caps(flock(200, {}, 15))[0].texture).toBe('sheepSnow:large');
    expect(caps(flock(0, {}, 15))[0].texture).toBe('sheepSnow:small');
  });

  it('draws them closer to the rack while the feed lasts', () => {
    const fromRack = (state: GameState) => sheepVisuals(state, 3000)
      .map(sheep => Math.hypot(sheep.x - worldX(SHEEP_RACK.x), sheep.y - worldY(SHEEP_RACK.y)))
      .reduce((total, distance) => total + distance, 0);
    expect(fromRack(flock(40, { fedUntil: 28 }))).toBeLessThan(fromRack(flock(40, { fedUntil: 25 })));
  });

  it('lays the rug only once it is made and the house stands', () => {
    const rug = (state: GameState) => sceneVisuals(state, 0).some(visual => visual.texture === 'rug:still');
    const state = flock(40);
    const house = { ...state.structures, shelterFinished: true, house: true };
    expect(rug({ ...state, structures: house })).toBe(false);
    expect(rug({ ...state, structures: { ...house, loom: true }, sheep: { ...state.sheep, woven: { blanket: false, jumper: false, rug: true } } })).toBe(true);
    expect(rug({ ...state, sheep: { ...state.sheep, woven: { blanket: false, jumper: false, rug: true } } })).toBe(false);
  });
});

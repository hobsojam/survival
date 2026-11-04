import { describe, expect, it } from 'vitest';
import { COOP_SITE } from '../src/game/chickens';
import { STEP_IDS, placeBranches } from '../src/game/clearing';
import { newlyStayed } from '../src/game/names';
import { createGame, type GameState } from '../src/game/state';
import { unnamedAnimalAt, type DrawnFriend } from '../src/scene/animalTap';
import { pickTapTarget } from '../src/scene/tapTarget';
import { sceneVisuals } from '../src/scene/visuals';

const game = createGame();
/** Tile units for a pixel in the world, the same sum the scene's tap handler does. */
const tile = (pixel: number): number => pixel / 16 - 0.5;

const camp = (changes: Partial<GameState> = {}): GameState => ({
  ...game,
  nodes: game.nodes.map((node, i) => ({ ...node, ...placeBranches(game.nodes, [...STEP_IDS])[i] })),
  clearing: { cleared: [...STEP_IDS], marked: null, felled: [] },
  structures: { ...game.structures, shelter: true, field: true, sheepPen: true, chickenCoop: true },
  sheep: { ...game.sheep, arrived: true, fluff: 40, fedUntil: 1 },
  chickens: { ...game.chickens, discovered: true, rescued: true },
  ...changes
});
const spot = (state: GameState, id: string, timeMs = 0) => sceneVisuals(state, timeMs).find(visual => visual.id === id)!;
/** Taps the middle of a sheep's fleece. */
const onSheep = (state: GameState, timeMs = 0) => {
  const sheep = spot(state, 'sheep-1', timeMs);
  return unnamedAnimalAt(state, timeMs, tile(sheep.x), tile(sheep.y - 9));
};

describe('tapping a sheep', () => {
  it('asks about that sheep when the tap lands on it', () => {
    expect(onSheep(camp())).toEqual({ kind: 'sheep', index: 1 });
  });

  it('finds it wherever it has wandered', () => {
    for (const timeMs of [0, 1500, 9000, 40000]) expect(onSheep(camp(), timeMs)).toEqual({ kind: 'sheep', index: 1 });
  });

  it('ignores the blank part of its picture', () => {
    const state = camp();
    const sheep = spot(state, 'sheep-0');
    expect(unnamedAnimalAt(state, 0, tile(sheep.x - 22), tile(sheep.y - 30))).toBeNull();
  });

  it('ignores a named sheep', () => {
    expect(onSheep(camp({ names: { ...game.names, sheep: [null, 'Maud', null] } }))).toBeNull();
  });

  it('ignores an empty pen', () => {
    const state = camp();
    const sheep = spot(state, 'sheep-1');
    expect(unnamedAnimalAt({ ...state, sheep: game.sheep }, 0, tile(sheep.x), tile(sheep.y - 9))).toBeNull();
  });

  it('ignores the flock from another area', () => {
    const state = camp();
    const sheep = spot(state, 'sheep-1');
    expect(unnamedAnimalAt({ ...state, area: 'quarry' }, 0, tile(sheep.x), tile(sheep.y - 9))).toBeNull();
  });
});

describe('tapping the hens', () => {
  const scan = (state: GameState) => {
    const found = new Set<number>();
    const coopTaps: unknown[] = [];
    for (let x = COOP_SITE.x - 4; x <= COOP_SITE.x + 4; x += 0.05) {
      for (let y = COOP_SITE.y - 4; y <= COOP_SITE.y + 4; y += 0.05) {
        const target = unnamedAnimalAt(state, 0, x, y);
        if (target?.kind === 'chicken') found.add(target.index);
        if (pickTapTarget(state, x, y).kind === 'coop') coopTaps.push(target);
      }
    }
    return { found, coopTaps };
  };

  it('can find each hen, and a tap on the coop is never a naming', () => {
    const { found, coopTaps } = scan(camp());
    expect([...found].sort()).toEqual([0, 1, 2]);
    expect(coopTaps.length).toBeGreaterThan(0);
    expect(coopTaps.every(target => target === null)).toBe(true);
  });

  it('leaves hens alone until they are home', () => {
    const { found } = scan(camp({ chickens: { ...game.chickens, discovered: true, following: true }, player: { ...game.player, x: COOP_SITE.x, y: COOP_SITE.y } }));
    expect(found.size).toBe(0);
  });
});

describe('tapping a friend', () => {
  const fox: DrawnFriend = { animal: 'fox', x: 15, y: 20, height: 0, frame: 'sit0', facing: 1 };
  const withFox = camp({ companion: { ...game.companion, friend: 'fox', since: 1, friends: { ...game.companion.friends, fox: 1 } } });

  it('asks about a friend from an old save when tapped', () => {
    const answers = [];
    for (let dx = -1; dx <= 1; dx += 0.05) for (let dy = -1; dy <= 0.2; dy += 0.05) answers.push(unnamedAnimalAt(withFox, 0, fox.x + dx, fox.y + dy, [fox]));
    expect(answers).toContainEqual({ kind: 'friend', animal: 'fox' });
  });

  it('leaves a named friend alone', () => {
    const named = { ...withFox, names: { ...withFox.names, fox: 'Rusty' } };
    for (let dx = -1; dx <= 1; dx += 0.1) for (let dy = -1; dy <= 0.2; dy += 0.1) expect(unnamedAnimalAt(named, 0, fox.x + dx, fox.y + dy, [fox])).toBeNull();
  });
});

describe('a friend that stays', () => {
  const stayed = (state: GameState, animal: 'fox' | 'bird'): GameState => ({ ...state, companion: { ...state.companion, friends: { ...state.companion.friends, [animal]: state.day } } });

  it('is noticed on the action that makes it stay', () => {
    expect(newlyStayed(game, stayed(game, 'bird'))).toBe('bird');
  });

  it('is not noticed again, or on any other change', () => {
    const friend = stayed(game, 'fox');
    expect(newlyStayed(friend, friend)).toBeNull();
    expect(newlyStayed(friend, { ...friend, day: 2 })).toBeNull();
    expect(newlyStayed(game, game)).toBeNull();
  });
});

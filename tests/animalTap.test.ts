import { describe, expect, it } from 'vitest';
import { COOP_SITE } from '../src/game/chickens';
import { STEP_IDS, placeBranches } from '../src/game/clearing';
import { newlyStayed } from '../src/game/names';
import { sprites } from '../src/art/sprites';
import { createGame, type Friend, type GameState } from '../src/game/state';
import { unnamedAnimalAt, type DrawnFriend } from '../src/scene/animalTap';
import { companionPoseFor } from '../src/scene/companionPose';
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

  it('stands each hen in plain sight, with room to tap it once the camp has filled up', () => {
    const built = camp({ structures: { ...game.structures, ...Object.fromEntries(Object.keys(game.structures).map(id => [id, true])) } as GameState['structures'] });
    const paintedAt = (texture: string, x: number, y: number): [number, number][] => {
      const [name, frame] = texture.split(':');
      const def = sprites[name];
      const rows = def.frames[frame] ?? [];
      return rows.flatMap((row, r) => [...row].flatMap((cell, c): [number, number][] => (cell === '.' || def.legend[cell] === 'shadow' ? [] : [[x + c - def.anchor[0], y + r - def.anchor[1]]])));
    };
    for (const timeMs of [0, 1500, 9000]) {
      const visuals = sceneVisuals(built, timeMs);
      for (const index of [0, 1, 2]) {
        const hen = visuals.find(visual => visual.id === `chicken-${index}`)!;
        const others = visuals.filter(visual => visual.id !== hen.id && visual.depth >= hen.depth).flatMap(visual => paintedAt(visual.texture, visual.x, visual.y).map(([x, y]) => `${x},${y}`));
        const hidden = new Set(others);
        const inSight = paintedAt(hen.texture, hen.x, hen.y).filter(([x, y]) => !hidden.has(`${x},${y}`));
        const asks = inSight.filter(([x, y]) => {
          const target = unnamedAnimalAt(built, timeMs, tile(x + 0.5), tile(y + 0.5));
          return target?.kind === 'chicken' && target.index === index;
        });
        expect(asks.length, `hen ${index} at ${timeMs}ms`).toBeGreaterThanOrEqual(60);
      }
    }
  });

  it('leaves hens alone until they are home', () => {
    const { found } = scan(camp({ chickens: { ...game.chickens, discovered: true, following: true }, player: { ...game.player, x: COOP_SITE.x, y: COOP_SITE.y } }));
    expect(found.size).toBe(0);
  });
});

describe('tapping a friend', () => {
  const STILL = 30;
  /** A friend by day, close by the survivor, who is at camp a step from the fire. */
  const befriended = (animal: Friend, changes: Partial<GameState> = {}): GameState => camp({
    companion: { ...game.companion, friend: animal, since: 1, friends: { ...game.companion.friends, [animal]: 1 } },
    player: { ...game.player, x: game.player.x, y: game.player.y + 1 },
    ...changes
  });
  const pose = (state: GameState, animal: Friend, timeMs: number, stillSeconds: number): DrawnFriend => ({ ...companionPoseFor(state, animal, timeMs, stillSeconds, 1)!, animal });
  /** How many pixels around a pose ask about the friend. */
  const tappable = (state: GameState, friend: DrawnFriend, stillSeconds: number): number => {
    const middleX = (friend.x + 0.5) * 16;
    const middleY = (friend.y - friend.height + 0.5) * 16;
    let hits = 0;
    for (let pixelX = middleX - 32; pixelX < middleX + 32; pixelX++) {
      for (let pixelY = middleY - 48; pixelY < middleY + 32; pixelY++) {
        const target = unnamedAnimalAt(state, 0, tile(pixelX + 0.5), tile(pixelY + 0.5), { friends: [friend], stillSeconds, replaying: false });
        if (target?.kind === 'friend' && target.animal === friend.animal) hits++;
      }
    }
    return hits;
  };

  it.each(['bird', 'fox', 'wolf'] as const)('asks about a %s from an old save, when the survivor stands still', animal => {
    const state = befriended(animal);
    for (const timeMs of [0, 2500, 6100]) expect(tappable(state, pose(state, animal, timeMs, STILL), STILL)).toBeGreaterThanOrEqual(12);
  });

  it.each(['bird', 'fox', 'wolf'] as const)('leaves a %s trailing the survivor alone, so tapping to walk still walks', animal => {
    const state = befriended(animal);
    expect(tappable(state, pose(state, animal, 0, 0), 0)).toBe(0);
  });

  it('leaves a named friend alone', () => {
    const state = befriended('fox');
    expect(tappable({ ...state, names: { ...state.names, fox: 'Rusty' } }, pose(state, 'fox', 0, STILL), STILL)).toBe(0);
  });
});

describe('during the cold-night replay', () => {
  it('asks about nothing, because the game is ignoring input', () => {
    const state = camp();
    const sheep = spot(state, 'sheep-1');
    expect(unnamedAnimalAt(state, 0, tile(sheep.x), tile(sheep.y - 9), { friends: [], stillSeconds: 30, replaying: true })).toBeNull();
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

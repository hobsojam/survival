import { afterEach, expect, it, vi } from 'vitest';
import { BALANCE, createGame, type GameState } from '../src/game/state';
import { shownTerrainKey } from '../src/scene/map';

vi.mock('phaser', () => ({ default: { Scene: class {} } }));

import { GameScene } from '../src/scene/GameScene';

afterEach(() => vi.unstubAllGlobals());

it('advances the live world clock at the slower pace while updating the scene', () => {
  vi.stubGlobal('document', { hidden: false });
  const state = createGame();
  const scene = Object.create(GameScene.prototype) as GameScene;
  const noop = () => undefined;
  Object.assign(scene, {
    state,
    keys: {},
    terrainShown: shownTerrainKey(state),
    walkFromKeys: () => false,
    walkTowardTarget: () => false,
    handleActionKeys: noop,
    reportWeather: noop,
    syncPlayerSprite: noop,
    paintObjects: noop,
    nightWatch: { tick: (_now: number, advance: () => unknown) => advance(), sunriseAgeMs: () => 0 },
    ambient: { update: noop },
    effects: { update: noop },
    lighting: { update: noop },
    time: { now: 0 },
    hudElapsed: 0,
    onStateChange: noop
  });

  scene.update(0, 50);

  expect((scene as unknown as { state: GameState }).state.timeOfDay).toBeCloseTo(0.05 * BALANCE.clockRate);
});

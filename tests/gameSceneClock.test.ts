import { afterEach, expect, it, vi } from 'vitest';
import { BALANCE, createGame, type GameState } from '../src/game/state';
import { shownTerrainKey } from '../src/scene/map';

vi.mock('phaser', () => ({ default: { Scene: class {} } }));

import { GameScene } from '../src/scene/GameScene';
import { DoorFade } from '../src/scene/doorFade';

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
    updateDoorFade: noop,
    walkFromKeys: () => false,
    walkTowardTarget: () => false,
    handleActionKeys: noop,
    reportWeather: noop,
    syncPlayerSprite: noop,
    paintObjects: noop,
    doorFade: new DoorFade(),
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

it('says nothing about keys pressed while the keep door fades', () => {
  const said: string[] = [];
  const scene = Object.create(GameScene.prototype) as GameScene;
  const doorFade = new DoorFade();
  doorFade.begin('sleep', 0);
  Object.assign(scene, { state: createGame(), doorFade, time: { now: 100 }, onFeedback: (line: string) => said.push(line), scene: { isPaused: () => false } });
  const keys = scene as unknown as { pressUse(): void; pressChop(): void };
  keys.pressUse();
  keys.pressChop();
  scene.visitNearestSite();
  expect(said).toEqual([]);
});

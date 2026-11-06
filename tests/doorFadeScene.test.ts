import { afterEach, expect, it, vi } from 'vitest';
import { STEP_IDS, placeBranches } from '../src/game/clearing';
import { KEEP_SITE } from '../src/game/keep';
import { BALANCE, createGame, type GameState } from '../src/game/state';
import { shownTerrainKey } from '../src/scene/map';

vi.mock('phaser', () => ({ default: { Scene: class {} } }));

import { GameScene } from '../src/scene/GameScene';
import { SceneLighting } from '../src/scene/SceneLighting';
import { DOOR_FADE_MS, DoorFade } from '../src/scene/doorFade';
import { NightWatch } from '../src/scene/sleepReplay';

afterEach(() => vi.unstubAllGlobals());

const game = createGame();
const placed = placeBranches(game.nodes, [...STEP_IDS]);
const atDoor = (changes: Partial<GameState> = {}): GameState => ({
  ...game,
  day: 5,
  nodes: game.nodes.map((node, i) => ({ ...node, x: placed[i].x, y: placed[i].y })),
  area: 'hills',
  timeOfDay: 40,
  player: { ...game.player, ...KEEP_SITE },
  progress: { ...game.progress, nextStormDay: null, workshop: { ...game.progress.workshop, forge: true, hinges: true } },
  keep: { stones: 60, door: true, startedDay: 1, finishedDay: 1, ponyNight: null },
  ...changes
});

/** Anything whose setters return itself, as Phaser's do, remembering what it was last given. */
function chainable(extra: Record<string, unknown> = {}): Record<string, unknown> & { called: Record<string, unknown[]> } {
  const called: Record<string, unknown[]> = {};
  return new Proxy({ called, ...extra } as Record<string, unknown> & { called: Record<string, unknown[]> }, {
    get(target, key: string, self) {
      if (key in target) return target[key];
      return (...args: unknown[]) => { called[key] = args; return self; };
    }
  });
}

interface SceneInside {
  state: GameState; pendingDoor?: unknown; viewShown: boolean; doorFade: DoorFade; time: { now: number }; walkTarget?: unknown;
  updateDoorFade(now: number): void; handleTap(x: number, y: number): void; syncPlayerSprite(moving: boolean): void;
  perform: GameScene['perform']; update: GameScene['update'];
}

function sceneAt(state: GameState) {
  const said: string[] = [];
  const carried: unknown[] = [];
  const sprite = chainable({ texture: { key: 'x' }, x: 10, y: 20, flipX: false, depth: 1 });
  const cover = chainable();
  const camera = chainable({ width: 480, height: 300, roundPixels: true });
  const scene = Object.create(GameScene.prototype) as unknown as SceneInside;
  Object.assign(scene, {
    state, said, doorFade: new DoorFade(), nightWatch: new NightWatch(), time: { now: 1000 }, viewShown: false, playerSprite: sprite, fadeCover: cover,
    cameras: { main: camera }, scene: { isPaused: () => false }, onFeedback: (line: string) => said.push(line), tapGate: () => true,
    unnamedAnimalUnder: () => null, showTapMarker: () => undefined,
    carryOut: (action: unknown) => { carried.push(action); }
  });
  return { scene, said, carried, sprite, cover, camera };
}

it('waits for black before carrying out a climb, and shows the view until it is over', () => {
  const { scene, carried, sprite, cover, camera } = sceneAt(atDoor());
  scene.perform({ type: 'enterKeep' });
  expect(carried).toEqual([]);
  expect(scene.pendingDoor).toEqual({ type: 'climbKeep' });
  scene.updateDoorFade(1100);
  expect(carried).toEqual([]);
  expect(sprite.called.setVisible).toEqual([false]);
  expect(cover.called.setVisible).toEqual([true]);
  scene.updateDoorFade(1400);
  expect(carried).toEqual([{ type: 'climbKeep' }]);
  expect(camera.called.setZoom).toEqual([0.75]);
  expect(camera.called.stopFollow).toBeDefined();
  scene.updateDoorFade(1000 + DOOR_FADE_MS.view);
  expect(carried).toHaveLength(1);
  expect(camera.called.setZoom).toEqual([1]);
  expect(camera.called.startFollow?.[0]).toBe(sprite);
  expect(sprite.called.setVisible).toEqual([true]);
  expect(cover.called.setVisible).toEqual([false]);
});

it('never moves the camera for a night', () => {
  const { scene, carried, camera } = sceneAt(atDoor({ timeOfDay: 190 }));
  scene.perform({ type: 'enterKeep' });
  scene.updateDoorFade(1400);
  expect(carried).toEqual([{ type: 'sleep' }]);
  expect(camera.called.setZoom).toBeUndefined();
});

it('still happens, and puts everything back, on a frame that comes very late', () => {
  const { scene, carried, sprite, camera } = sceneAt(atDoor());
  scene.perform({ type: 'enterKeep' });
  scene.updateDoorFade(1400);
  scene.updateDoorFade(1e9);
  expect(carried).toHaveLength(1);
  expect(scene.viewShown).toBe(false);
  expect(camera.called.setZoom).toEqual([1]);
  expect(sprite.called.setVisible).toEqual([true]);
  const skipped = sceneAt(atDoor());
  skipped.scene.perform({ type: 'enterKeep' });
  skipped.scene.updateDoorFade(1e9);
  expect(skipped.carried).toEqual([{ type: 'climbKeep' }]);
  expect(skipped.camera.called.setZoom).toBeUndefined();
});

it('ignores every other action and tap while it runs', () => {
  const { scene, carried, said } = sceneAt(atDoor());
  scene.perform({ type: 'enterKeep' });
  scene.time.now = 1100;
  scene.perform({ type: 'rest' });
  scene.perform({ type: 'move', dx: 1, dy: 0 });
  scene.handleTap(0, 0);
  expect(carried).toEqual([]);
  expect(said).toEqual([]);
  expect(scene.walkTarget).toBeUndefined();
  expect(scene.pendingDoor).toEqual({ type: 'climbKeep' });
});

it('carries out anything else straight away', () => {
  const { scene, carried } = sceneAt(atDoor());
  scene.perform({ type: 'rest' });
  expect(carried).toEqual([{ type: 'rest' }]);
  expect(scene.pendingDoor).toBeUndefined();
});

it('holds the clock from going in until it has happened, so night or dawn cannot get there first', () => {
  vi.stubGlobal('document', { hidden: false });
  const noop = () => undefined;
  const update = (pendingDoor: unknown): number => {
    const state = atDoor();
    const scene = Object.create(GameScene.prototype) as unknown as SceneInside;
    Object.assign(scene, { state, keys: {}, pendingDoor, terrainShown: shownTerrainKey(state), updateDoorFade: noop, walkFromKeys: () => false, walkTowardTarget: () => false,
      handleActionKeys: noop, reportWeather: noop, syncPlayerSprite: noop, paintObjects: noop, doorFade: new DoorFade(), viewShown: false,
      nightWatch: { tick: (_now: number, advance: () => unknown) => advance(), sunriseAgeMs: () => 0 }, ambient: { update: noop }, effects: { update: noop }, lighting: { update: noop },
      time: { now: 0 }, hudElapsed: 0, onStateChange: noop });
    scene.update(0, 50);
    return scene.state.timeOfDay;
  };
  expect(update({ type: 'climbKeep' })).toBe(40);
  expect(update(undefined)).toBeCloseTo(40 + 0.05 * BALANCE.clockRate);
});

it('lets out no breath or cough from a survivor who has gone in', () => {
  const puffs = (fading: boolean): number => {
    const { scene } = sceneAt(atDoor({ sickness: { ...game.sickness, sick: true, sickFromDay: 4 } }));
    let count = 0;
    Object.assign(scene, { letOutPuff: () => { count += 1; }, facing: 'down', areaShown: 'hills' });
    if (fading) scene.doorFade.begin('view', 1000);
    scene.syncPlayerSprite(false);
    return count;
  };
  expect(puffs(false)).toBe(1);
  expect(puffs(true)).toBe(0);
});

it('hides the lighting for the view, and lets the keep window through it at night', () => {
  const layer = chainable();
  const erased: unknown[][] = [];
  layer.erase = (...args: unknown[]) => { erased.push(args); return layer; };
  const lighting = Object.create(SceneLighting.prototype) as SceneLighting;
  Object.assign(lighting, { layer, scene: { cameras: { main: { scrollX: 0, scrollY: 0 } }, textures: { exists: () => true } } });
  lighting.hide();
  expect(layer.called.setVisible).toEqual([false]);
  lighting.update(atDoor({ timeOfDay: 190 }), 0, 0);
  expect(layer.called.setVisible).toEqual([true]);
  expect(erased).toHaveLength(1);
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { STEP_IDS, placeBranches } from '../src/game/clearing';
import { nightStart } from '../src/game/calendar';
import { KEEP_SITE } from '../src/game/keep';
import { applyAction, type GameAction } from '../src/game/rules';
import { BALANCE, createGame, type GameState } from '../src/game/state';
import { shownTerrainKey } from '../src/scene/map';

vi.mock('phaser', () => ({ default: { Scene: class {} } }));

import { GameScene } from '../src/scene/GameScene';
import { SceneLighting } from '../src/scene/SceneLighting';
import { DoorFade, VIEW_INPUT_DELAY_MS, comesDownKey } from '../src/scene/doorFade';
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
  state: GameState; pendingDoor?: unknown; viewShown: boolean; doorFade: DoorFade; time: { now: number }; walkTarget?: unknown; tapGate: () => boolean; scene: { isPaused(): boolean };
  updateDoorFade(now: number): void; handleTap(x: number, y: number): void; syncPlayerSprite(moving: boolean): void; keyComesDown(event: Parameters<typeof comesDownKey>[0]): void; say(...messages: (string | null)[]): void;
  perform: GameScene['perform']; update: GameScene['update']; viewing: GameScene['viewing']; resizeViewport: GameScene['resizeViewport'];
}

function sceneAt(state: GameState) {
  const said: string[] = [];
  const carried: unknown[] = [];
  const sprite = chainable({ texture: { key: 'x' }, x: 10, y: 20, flipX: false, depth: 1 });
  const cover = chainable();
  const camera = chainable({ width: 480, height: 300, roundPixels: true });
  const view = viewStub();
  const scene = Object.create(GameScene.prototype) as unknown as SceneInside;
  Object.assign(scene, {
    state, said, heldNotices: [], doorFade: new DoorFade(), nightWatch: new NightWatch(), time: { now: 1000 }, viewShown: false, playerSprite: sprite, fadeCover: cover,
    keepView: view, scale: { gameSize: { width: 480, height: 300 } }, lighting: { resize: () => undefined },
    cameras: { main: camera }, scene: { isPaused: () => false }, onFeedback: (line: string) => said.push(line), tapGate: () => true,
    unnamedAnimalUnder: () => null, showTapMarker: () => undefined,
    carryOut: (action: unknown) => { carried.push(action); }
  });
  return { scene, said, carried, sprite, cover, camera, view };
}

/** The picture stood in for: what it was asked to show, and whether it's up. */
function viewStub() {
  const shown: unknown[][] = [];
  const resized: unknown[][] = [];
  let hides = 0;
  return {
    shown, resized,
    get hides() { return hides; },
    show: (...args: unknown[]) => { shown.push(args); },
    hide: () => { hides += 1; },
    resize: (...args: unknown[]) => { resized.push(args); },
    update: () => undefined
  };
}

/** A scene with the picture up, having gone in at 1000 and reached black at 1350. */
function lookingOut(state: GameState = atDoor()) {
  const inside = sceneAt(state);
  inside.scene.perform({ type: 'enterKeep' });
  inside.scene.time.now = 1400;
  inside.scene.updateDoorFade(1400);
  return inside;
}

const SETTLED = 1350 + VIEW_INPUT_DELAY_MS;

it('waits for black before carrying out a climb, and shows the picture until the player comes down', () => {
  const { scene, carried, sprite, cover, camera, view } = sceneAt(atDoor());
  scene.perform({ type: 'enterKeep' });
  expect(carried).toEqual([]);
  expect(scene.pendingDoor).toEqual({ type: 'climbKeep' });
  scene.updateDoorFade(1100);
  expect(carried).toEqual([]);
  expect(view.shown).toEqual([]);
  expect(sprite.called.setVisible).toEqual([false]);
  expect(cover.called.setVisible).toEqual([true]);
  scene.updateDoorFade(1400);
  expect(carried).toEqual([{ type: 'climbKeep' }]);
  expect(view.shown).toEqual([[scene.state, 480, 300]]);
  scene.updateDoorFade(1e6);
  expect(carried).toHaveLength(1);
  expect(view.shown).toHaveLength(1);
  expect(view.hides).toBe(0);
  expect(scene.viewing()).toBe(true);
  scene.time.now = 1e6;
  scene.handleTap(0, 0);
  scene.updateDoorFade(1e6 + 650);
  expect(view.hides).toBe(1);
  expect(scene.viewing()).toBe(false);
  expect(sprite.called.setVisible).toEqual([true]);
  expect(cover.called.setVisible).toEqual([false]);
  expect(camera.called.setZoom).toBeUndefined();
  expect(camera.called.stopFollow).toBeUndefined();
  expect(camera.called.startFollow).toBeUndefined();
});

it('a tap comes down only after the first second, and neither walks nor acts', () => {
  const { scene, carried } = lookingOut();
  scene.time.now = SETTLED - 1;
  scene.handleTap(0, 0);
  scene.updateDoorFade(SETTLED + 2000);
  expect(scene.viewing()).toBe(true);
  scene.time.now = SETTLED + 2000;
  scene.handleTap(0, 0);
  expect(scene.walkTarget).toBeUndefined();
  scene.updateDoorFade(SETTLED + 2000 + 650);
  expect(scene.viewing()).toBe(false);
  expect(carried).toHaveLength(1);
});

it('a tap with a phone sheet open only closes the sheet', () => {
  const { scene } = lookingOut();
  scene.tapGate = () => false;
  scene.time.now = SETTLED + 5000;
  scene.handleTap(0, 0);
  scene.updateDoorFade(SETTLED + 6000);
  expect(scene.viewing()).toBe(true);
});

it('a key comes down, but not a repeat of the key held at the door, or Esc', () => {
  const { scene } = lookingOut();
  scene.time.now = SETTLED + 100;
  scene.keyComesDown({ key: 'e', repeat: true });
  scene.keyComesDown({ key: 'Escape', repeat: false });
  scene.updateDoorFade(SETTLED + 2000);
  expect(scene.viewing()).toBe(true);
  scene.time.now = SETTLED + 2000;
  scene.keyComesDown({ key: 'e', repeat: false });
  scene.updateDoorFade(SETTLED + 2000 + 650);
  expect(scene.viewing()).toBe(false);
});

it('a key combination such as a screenshot leaves the picture up', () => {
  const { scene } = lookingOut();
  scene.time.now = SETTLED + 100;
  scene.keyComesDown({ key: 's', repeat: false, metaKey: true });
  scene.keyComesDown({ key: 'PrintScreen', repeat: false });
  scene.updateDoorFade(SETTLED + 2000);
  expect(scene.viewing()).toBe(true);
});

it('a key means nothing when the picture is not up', () => {
  const { scene } = sceneAt(atDoor());
  scene.time.now = 5000;
  scene.keyComesDown({ key: 'e', repeat: false });
  expect(scene.doorFade.running(5000)).toBe(false);
});

it('nothing comes down while paused', () => {
  const { scene } = lookingOut();
  scene.scene.isPaused = () => true;
  scene.time.now = SETTLED + 5000;
  scene.handleTap(0, 0);
  scene.keyComesDown({ key: 'e', repeat: false });
  scene.updateDoorFade(SETTLED + 6000);
  expect(scene.viewing()).toBe(true);
});

it('a rotated phone resizes the picture', () => {
  const { scene, view } = lookingOut();
  scene.resizeViewport(195, 339);
  expect(view.resized).toEqual([[195, 339]]);
});

it('climbing just before nightfall still shows the picture, and comes down into the night', () => {
  const day = 5;
  const evening = nightStart(day) - 1;
  const inside = sceneAt(atDoor({ day, timeOfDay: evening }));
  Object.assign(inside.scene, { carryOut: (action: GameAction) => { inside.scene.state = applyAction(inside.scene.state, action).state; } });
  inside.scene.perform({ type: 'enterKeep' });
  inside.scene.updateDoorFade(1400);
  expect(inside.view.shown).toHaveLength(1);
  expect(inside.scene.state.timeOfDay).toBeGreaterThanOrEqual(nightStart(day));
  inside.scene.time.now = SETTLED + 100;
  inside.scene.handleTap(0, 0);
  inside.scene.updateDoorFade(SETTLED + 100 + 650);
  expect(inside.scene.viewing()).toBe(false);
  expect(inside.scene.state.timeOfDay).toBeGreaterThanOrEqual(nightStart(day));
});

describe('what the picture keeps back until the player comes down', () => {
  const speaking = (state: GameState = atDoor()) => sceneAt(state);

  it('holds the journal notice, and says it once, after coming down', () => {
    const { scene, said } = speaking();
    scene.doorFade.begin('view', 0);
    scene.say('Written in your journal: x');
    expect(said).toEqual([]);
    scene.updateDoorFade(1400);
    scene.doorFade.comeDown(2000);
    scene.updateDoorFade(2000 + 649);
    expect(said).toEqual([]);
    scene.updateDoorFade(2000 + 650);
    expect(said).toEqual(['Written in your journal: x']);
    scene.updateDoorFade(2000 + 651);
    expect(said).toHaveLength(1);
  });

  it('says several held notices together, in order', () => {
    const { scene, said } = speaking();
    scene.doorFade.begin('view', 0);
    scene.say('First.', null);
    scene.say('Second.');
    scene.doorFade.comeDown(2000);
    scene.updateDoorFade(2650);
    expect(said).toEqual(['First. Second.']);
  });

  it('holds nothing when no view is up, or for a night', () => {
    const { scene, said } = speaking();
    scene.say('hello');
    scene.doorFade.begin('sleep', 1000);
    scene.say('goodnight');
    expect(said).toEqual(['hello', 'goodnight']);
  });

  it('holds the notice from the climb itself, which comes as the picture opens', () => {
    const { scene, said } = speaking();
    Object.assign(scene, { carryOut: () => scene.say('Written in your journal: x') });
    scene.perform({ type: 'enterKeep' });
    scene.updateDoorFade(1400);
    expect(said).toEqual([]);
    scene.time.now = SETTLED;
    scene.handleTap(0, 0);
    scene.updateDoorFade(SETTLED + 650);
    expect(said).toEqual(['Written in your journal: x']);
  });
});

it('never moves the camera for a night', () => {
  const { scene, carried, camera } = sceneAt(atDoor({ timeOfDay: 190 }));
  scene.perform({ type: 'enterKeep' });
  scene.updateDoorFade(1400);
  expect(carried).toEqual([{ type: 'sleep' }]);
  expect(camera.called.setZoom).toBeUndefined();
});

it('a very late frame neither loses the climb nor ends the view', () => {
  const { scene, carried, view } = sceneAt(atDoor());
  scene.perform({ type: 'enterKeep' });
  scene.updateDoorFade(1e9);
  expect(carried).toEqual([{ type: 'climbKeep' }]);
  expect(view.shown).toHaveLength(1);
  expect(scene.viewing()).toBe(true);
});

it('a very late frame after coming down still puts everything back', () => {
  const { scene, sprite, view } = lookingOut();
  scene.time.now = SETTLED + 1;
  scene.handleTap(0, 0);
  scene.updateDoorFade(1e9);
  expect(view.hides).toBe(1);
  expect(scene.viewShown).toBe(false);
  expect(sprite.called.setVisible).toEqual([true]);
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
  const update = (pendingDoor: unknown, looking = false): number => {
    const state = atDoor();
    const fade = new DoorFade();
    if (looking) fade.begin('view', 0);
    const scene = Object.create(GameScene.prototype) as unknown as SceneInside;
    Object.assign(scene, { state, keys: {}, pendingDoor, terrainShown: shownTerrainKey(state), updateDoorFade: noop, walkFromKeys: () => false, walkTowardTarget: () => false,
      handleActionKeys: noop, reportWeather: noop, syncPlayerSprite: noop, paintObjects: noop, doorFade: fade, viewShown: looking, keepView: viewStub(),
      nightWatch: { tick: (_now: number, advance: () => unknown) => advance(), sunriseAgeMs: () => 0 }, ambient: { update: noop }, effects: { update: noop }, lighting: { update: noop, hide: noop },
      time: { now: 0 }, hudElapsed: 0, onStateChange: noop });
    scene.update(0, 50);
    return scene.state.timeOfDay;
  };
  expect(update({ type: 'climbKeep' })).toBe(40);
  expect(update(undefined)).toBeCloseTo(40 + 0.05 * BALANCE.clockRate);
  expect(update(undefined, true)).toBe(40);
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

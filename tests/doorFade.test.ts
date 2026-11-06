import { describe, expect, it } from 'vitest';
import { STEP_IDS, placeBranches } from '../src/game/clearing';
import { KEEP_SITE } from '../src/game/keep';
import { BALANCE, createGame, type GameState } from '../src/game/state';
import { DOOR_FADE_MS, DoorFade, VIEW_INPUT_DELAY_MS, doorFadeFor } from '../src/scene/doorFade';

const game = createGame();
const placed = placeBranches(game.nodes, [...STEP_IDS]);
const atDoor = (changes: Partial<GameState> = {}, stones = 60): GameState => ({
  ...game,
  nodes: game.nodes.map((node, i) => ({ ...node, x: placed[i].x, y: placed[i].y })),
  area: 'hills',
  player: { ...game.player, ...KEEP_SITE },
  progress: { ...game.progress, workshop: { ...game.progress.workshop, forge: true, hinges: true } },
  keep: { stones, door: true, startedDay: 1, finishedDay: stones === 60 ? 1 : null, ponyNight: null },
  ...changes
});

describe('when the door fades', () => {
  it('fades on a night in the keep and a climb, and on nothing else', () => {
    expect(doorFadeFor({ type: 'sleep' }, atDoor({ timeOfDay: 190 }))).toBe('sleep');
    expect(doorFadeFor({ type: 'climbKeep' }, atDoor({ timeOfDay: 40 }))).toBe('view');
    expect(doorFadeFor({ type: 'climbKeep' }, atDoor({ timeOfDay: 190 }))).toBeNull();
    expect(doorFadeFor({ type: 'climbKeep' }, atDoor({ timeOfDay: 40 }, 59))).toBeNull();
    expect(doorFadeFor({ type: 'sleep' }, atDoor({ timeOfDay: 40 }))).toBeNull();
    expect(doorFadeFor({ type: 'rest' }, atDoor({ timeOfDay: 40 }))).toBeNull();
  });

  it('does not fade for a night at camp', () => {
    const atCamp = atDoor({ area: 'camp', timeOfDay: 190, structures: { ...game.structures, shelter: true }, player: { ...game.player, x: BALANCE.campX, y: BALANCE.campY } });
    expect(doorFadeFor({ type: 'sleep' }, atCamp)).toBeNull();
  });
});

describe('the fade', () => {
  const started = (kind: 'sleep' | 'view', at = 1000): DoorFade => {
    const fade = new DoorFade();
    fade.begin(kind, at);
    return fade;
  };

  it('does nothing until it is begun', () => {
    const fade = new DoorFade();
    expect([fade.running(0), fade.alpha(0), fade.hold(0), fade.viewing(0)]).toEqual([false, 0, false, false]);
  });

  it('lasts as long as it should for a night', () => {
    expect(DOOR_FADE_MS).toEqual({ sleep: 1200 });
    expect(started('sleep').running(1000 + 1199)).toBe(true);
    expect(started('sleep').running(1000 + 1200)).toBe(false);
  });

  it('goes black, holds, comes back and ends', () => {
    const fade = started('sleep');
    expect(fade.alpha(1000)).toBe(0);
    expect(fade.hold(1000)).toBe(false);
    expect(fade.alpha(1000 + 175)).toBeCloseTo(0.5);
    expect(fade.alpha(1000 + 500)).toBe(1);
    expect(fade.hold(1000 + 500)).toBe(true);
    expect(fade.alpha(1000 + 1200)).toBe(0);
    expect(fade.running(1000 + 1200)).toBe(false);
  });

  it('never moves the camera for a night', () => {
    const fade = started('sleep');
    for (const at of [0, 400, 800, 1100]) expect(fade.viewing(1000 + at)).toBe(false);
  });

  it('opens the view out of black', () => {
    const fade = started('view');
    expect(fade.alpha(1000 + 349)).toBeGreaterThan(0.9);
    expect(fade.viewing(1000 + 349)).toBe(false);
    expect(fade.alpha(1000 + 350)).toBe(1);
    expect(fade.viewing(1000 + 350)).toBe(true);
    expect(fade.alpha(1000 + 650)).toBe(0);
  });

  it('keeps the view open until the player comes down', () => {
    const fade = started('view', 0);
    expect(fade.running(1e9)).toBe(true);
    expect(fade.viewing(1e9)).toBe(true);
    expect(fade.alpha(1e9)).toBe(0);
  });

  it('refuses to come down during the first second of the picture', () => {
    const fade = started('view', 0);
    expect(VIEW_INPUT_DELAY_MS).toBe(1000);
    expect(fade.comeDown(350 + 999)).toBe(false);
    expect(fade.running(1e9)).toBe(true);
    expect(fade.comeDown(350 + 1000)).toBe(true);
  });

  it('comes down through black and ends', () => {
    const fade = started('view', 0);
    fade.comeDown(5000);
    expect(fade.alpha(5150)).toBeCloseTo(0.5);
    expect(fade.viewing(5299)).toBe(true);
    expect(fade.alpha(5300)).toBe(1);
    expect(fade.viewing(5300)).toBe(false);
    expect(fade.hold(5300)).toBe(false);
    expect(fade.alpha(5475)).toBeCloseTo(0.5);
    expect(fade.running(5649)).toBe(true);
    expect(fade.running(5650)).toBe(false);
    expect(fade.alpha(5650)).toBe(0);
  });

  it('ignores a second press while coming down', () => {
    const fade = started('view', 0);
    fade.comeDown(5000);
    expect(fade.comeDown(5100)).toBe(false);
    expect(fade.running(5650)).toBe(false);
  });

  it('starts fresh the next time, after coming down', () => {
    const fade = started('view', 0);
    fade.comeDown(5000);
    fade.begin('view', 9000);
    expect(fade.running(1e9)).toBe(true);
  });

  it('does not come down from a night', () => {
    const fade = started('sleep', 0);
    expect(fade.comeDown(600)).toBe(false);
  });

  it('holds the clock for the whole view, and not for a night', () => {
    const view = started('view', 0);
    expect(view.holdsClock(0)).toBe(true);
    expect(view.holdsClock(1e6)).toBe(true);
    view.comeDown(1e6);
    expect(view.holdsClock(1e6 + 500)).toBe(true);
    expect(view.holdsClock(1e6 + 650)).toBe(false);
    const night = started('sleep', 0);
    expect(night.holdsClock(0)).toBe(false);
    expect(night.holdsClock(600)).toBe(false);
  });

  it('a night is over however late it is asked', () => {
    const fade = started('sleep');
    expect([fade.running(1e9), fade.alpha(1e9), fade.hold(1e9), fade.viewing(1e9)]).toEqual([false, 0, false, false]);
  });
});

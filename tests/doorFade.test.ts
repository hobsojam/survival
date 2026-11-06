import { describe, expect, it } from 'vitest';
import { STEP_IDS, placeBranches } from '../src/game/clearing';
import { KEEP_SITE } from '../src/game/keep';
import { BALANCE, createGame, type GameState } from '../src/game/state';
import { DOOR_FADE_MS, DoorFade, doorFadeFor, viewZoom } from '../src/scene/doorFade';

const game = createGame();
const placed = placeBranches(game.nodes, [...STEP_IDS]);
const atDoor = (changes: Partial<GameState> = {}, stones = 60): GameState => ({
  ...game,
  nodes: game.nodes.map((node, i) => ({ ...node, x: placed[i].x, y: placed[i].y })),
  area: 'hills',
  player: { ...game.player, ...KEEP_SITE },
  progress: { ...game.progress, workshop: { ...game.progress.workshop, forge: true, hinges: true } },
  keep: { stones, door: true, startedDay: 1, finishedDay: stones === 60 ? 1 : null },
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

describe('the view from the top', () => {
  const map = { width: 640, height: 480 };
  it('pulls back to fill the frame, leaving nothing blank', () => {
    expect(viewZoom(480, 300, map.width, map.height)).toBeCloseTo(0.75);
    const zoom = viewZoom(195, 339, map.width, map.height);
    expect(zoom * map.height).toBeGreaterThanOrEqual(339);
    expect(zoom).toBeCloseTo(339 / 480);
  });
  it('never zooms in', () => {
    expect(viewZoom(1000, 800, map.width, map.height)).toBe(1);
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

  it('lasts as long as it should', () => {
    expect(DOOR_FADE_MS).toEqual({ sleep: 1200, view: 2600 });
    expect(started('sleep').running(1000 + 1199)).toBe(true);
    expect(started('sleep').running(1000 + 1200)).toBe(false);
    expect(started('view').running(1000 + 2599)).toBe(true);
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

  it('shows the view between two dips to black', () => {
    const fade = started('view');
    expect(fade.alpha(1000 + 349)).toBeGreaterThan(0.9);
    expect(fade.viewing(1000 + 349)).toBe(false);
    expect(fade.alpha(1000 + 350)).toBe(1);
    expect(fade.viewing(1000 + 350)).toBe(true);
    expect(fade.alpha(1000 + 1000)).toBe(0);
    expect(fade.viewing(1000 + 2200)).toBe(true);
    expect(fade.alpha(1000 + 2249)).toBeGreaterThan(0.9);
    expect(fade.viewing(1000 + 2250)).toBe(false);
    expect(fade.alpha(1000 + 2600)).toBe(0);
  });

  it('is over however late it is asked', () => {
    for (const kind of ['sleep', 'view'] as const) {
      const fade = started(kind);
      expect([fade.running(1e9), fade.alpha(1e9), fade.hold(1e9), fade.viewing(1e9)]).toEqual([false, 0, false, false]);
    }
  });
});

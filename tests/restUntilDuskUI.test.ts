import { describe, expect, it, vi } from 'vitest';
import { nightStart } from '../src/game/calendar';
import { createGame, type GameState } from '../src/game/state';

vi.mock('phaser', () => ({ default: { Scene: class {} } }));

import { App } from '../src/ui/App';
import { GameScene } from '../src/scene/GameScene';

function ready(): GameState {
  const state = createGame();
  state.structures.shelter = true;
  state.timeOfDay = nightStart(state.day) - 5;
  return state;
}

describe('rest until dusk scene control', () => {
  it('advances once, announces the result, and updates the HUD', () => {
    const state = ready();
    const calls: string[] = [];
    const scene = Object.create(GameScene.prototype) as GameScene;
    Object.assign(scene, {
      state, scene: { isPaused: () => false }, nightWatch: { running: false },
      doorFading: () => false, walkTarget: { kind: 'point' },
      showActionDone: () => calls.push('effect'), needsAlert: () => null,
      say: (...lines: (string | null)[]) => calls.push(...lines.filter((line): line is string => line !== null)),
      onStateChange: (next: GameState, cause: string) => calls.push(`${cause}:${next.timeOfDay}`),
      paintObjects: () => calls.push('paint'), playerSprite: {}
    });

    scene.performRestUntilDusk();

    expect((scene as unknown as { state: GameState }).state.timeOfDay).toBe(nightStart(state.day));
    expect(calls).toEqual(['effect', 'You rest until dusk. Night has fallen.', `action:${nightStart(state.day)}`, 'paint']);
  });

  it('does nothing while paused', () => {
    const state = ready();
    const changed = vi.fn();
    const scene = Object.create(GameScene.prototype) as GameScene;
    Object.assign(scene, { state, scene: { isPaused: () => true }, onStateChange: changed });
    scene.performRestUntilDusk();
    expect((scene as unknown as { state: GameState }).state).toBe(state);
    expect(changed).not.toHaveBeenCalled();
  });
});

describe('rest until dusk HUD', () => {
  it('shows costs, throttles fractional ticks, and refreshes after an action', () => {
    const state = ready();
    state.timeOfDay = 0.25;
    state.fireFuel = 5;
    const button = { disabled: false, title: '', classList: { toggle: vi.fn() } };
    const lines: string[] = [];
    const app = Object.create(App.prototype) as App;
    Object.assign(app, {
      state, longRestDirty: true, longRestPreviewSecond: -1,
      root: { querySelector: (selector: string) => selector === '#rest-until-dusk' ? button : null, querySelectorAll: () => [] },
      setText: (id: string, copy: string) => { if (id === 'rest-until-dusk-preview') lines.push(copy); }
    });

    app['renderNight']();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/Hunger.*Fire 5→0s/);
    state.timeOfDay = 0.75;
    app['renderNight']();
    expect(lines).toHaveLength(1);
    state.player.hunger = 20;
    Object.assign(app, { longRestDirty: true });
    app['renderNight']();
    expect(button.disabled).toBe(true);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatch(/Eat before resting longer/);
  });
});

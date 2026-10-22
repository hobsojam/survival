import { describe, expect, it } from 'vitest';
import { facingFromInput, selectSurvivorVisual, type SurvivorVisualState } from '../src/scene/survivorVisual';

const state: SurvivorVisualState = { facing: 'down', moving: false, warmth: 80, nowMs: 1000 };

describe('survivor visual selection', () => {
  it('retains the last meaningful movement direction', () => {
    expect(facingFromInput(0, -1, 'down')).toBe('up');
    expect(facingFromInput(-1, 0, 'up')).toBe('left');
    expect(facingFromInput(1, 1, 'down')).toBe('right');
    expect(facingFromInput(0, 0, 'left')).toBe('left');
  });

  it('plays four walking frames at eight frames per second and flips left', () => {
    expect(selectSurvivorVisual({ ...state, moving: true, facing: 'left' })).toEqual({ texture: 'survivor:walkSide0', flipX: true });
    expect(selectSurvivorVisual({ ...state, moving: true, facing: 'right', nowMs: 1125 })).toEqual({ texture: 'survivor:walkSide1', flipX: false });
    expect(selectSurvivorVisual({ ...state, moving: true, facing: 'up', nowMs: 1375 })).toEqual({ texture: 'survivor:walkUp3', flipX: false });
    expect(selectSurvivorVisual({ ...state, moving: true, facing: 'down', nowMs: 1500 })).toEqual({ texture: 'survivor:walkDown0', flipX: false });
  });

  it('keeps idle direction and uses a two frame front breathing cycle', () => {
    expect(selectSurvivorVisual(state)).toEqual({ texture: 'survivor:idleDown0', flipX: false });
    expect(selectSurvivorVisual({ ...state, nowMs: 1500 })).toEqual({ texture: 'survivor:idleDown1', flipX: false });
    expect(selectSurvivorVisual({ ...state, facing: 'up' })).toEqual({ texture: 'survivor:walkUp0', flipX: false });
    expect(selectSurvivorVisual({ ...state, facing: 'left' })).toEqual({ texture: 'survivor:walkSide0', flipX: true });
  });

  it('plays successful action poses briefly, then returns to idle', () => {
    for (const kind of ['gather', 'rest', 'cook', 'stargaze'] as const) {
      const action = { kind, startedAtMs: 1000 };
      expect(selectSurvivorVisual({ ...state, action, nowMs: 1000 }).texture).toBe(`survivor:${kind}0`);
      expect(selectSurvivorVisual({ ...state, action, nowMs: 1250 }).texture).toBe(`survivor:${kind}1`);
      if (kind === 'gather') expect(selectSurvivorVisual({ ...state, action, nowMs: 1500 }).texture).toBe('survivor:gather1');
      expect(selectSurvivorVisual({ ...state, action, nowMs: 3000 }).texture).toBe('survivor:idleDown0');
    }
  });

  it('prioritizes movement over an action and shivers only while idle at low warmth', () => {
    const action = { kind: 'gather' as const, startedAtMs: 1000 };
    expect(selectSurvivorVisual({ ...state, action, moving: true }).texture).toBe('survivor:walkDown0');
    expect(selectSurvivorVisual({ ...state, warmth: 20 }).texture).toBe('survivor:shiver0');
    expect(selectSurvivorVisual({ ...state, warmth: 20, nowMs: 1500 }).texture).toBe('survivor:shiver1');
    expect(selectSurvivorVisual({ ...state, warmth: 20, action }).texture).toBe('survivor:gather0');
  });
});

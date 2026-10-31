import { describe, expect, it } from 'vitest';
import { effectPose, facingFromInput, needLook, puffDue, selectSurvivorVisual, type SurvivorVisualState } from '../src/scene/survivorVisual';
import { survivorSprite } from '../src/art/survivor';

const state: SurvivorVisualState = { facing: 'down', moving: false, warmth: 80, energy: 80, hunger: 80, sick: false, nowMs: 1000 };

describe('survivor visual selection', () => {
  it('retains the last meaningful movement direction', () => {
    expect(facingFromInput(0, -1, 'down')).toBe('up');
    expect(facingFromInput(-1, 0, 'up')).toBe('left');
    expect(facingFromInput(1, 1, 'down')).toBe('right');
    expect(facingFromInput(0, 0, 'left')).toBe('left');
  });

  it('plays four walking frames at eight frames per second and flips left', () => {
    expect(selectSurvivorVisual({ ...state, moving: true, facing: 'left' })).toMatchObject({ texture: 'survivor:walkSide0', flipX: true });
    expect(selectSurvivorVisual({ ...state, moving: true, facing: 'right', nowMs: 1125 })).toMatchObject({ texture: 'survivor:walkSide1', flipX: false });
    expect(selectSurvivorVisual({ ...state, moving: true, facing: 'up', nowMs: 1375 })).toMatchObject({ texture: 'survivor:walkUp3', flipX: false });
    expect(selectSurvivorVisual({ ...state, moving: true, facing: 'down', nowMs: 1500 })).toMatchObject({ texture: 'survivor:walkDown0', flipX: false });
  });

  it('keeps idle direction and uses a two frame front breathing cycle', () => {
    expect(selectSurvivorVisual(state)).toMatchObject({ texture: 'survivor:idleDown0', flipX: false });
    expect(selectSurvivorVisual({ ...state, nowMs: 1500 })).toMatchObject({ texture: 'survivor:idleDown1', flipX: false });
    expect(selectSurvivorVisual({ ...state, facing: 'up' })).toMatchObject({ texture: 'survivor:walkUp0', flipX: false });
    expect(selectSurvivorVisual({ ...state, facing: 'left' })).toMatchObject({ texture: 'survivor:walkSide0', flipX: true });
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

  it('slumps and yawns while idle and tired, after shivering', () => {
    expect(selectSurvivorVisual({ ...state, energy: 20 }).texture).toBe('survivor:tired0');
    expect(selectSurvivorVisual({ ...state, energy: 20, nowMs: 1500 }).texture).toBe('survivor:tired1');
    expect(selectSurvivorVisual({ ...state, energy: 20, facing: 'left' })).toMatchObject({ texture: 'survivor:tired0', flipX: false });
    expect(selectSurvivorVisual({ ...state, energy: 20, warmth: 20 }).texture).toBe('survivor:shiver0');
    expect(selectSurvivorVisual({ ...state, energy: 20, moving: true }).texture).toBe('survivor:walkDown0');
  });

  it('holds a hungry stomach while idle, after tiredness', () => {
    expect(selectSurvivorVisual({ ...state, hunger: 20 }).texture).toBe('survivor:hungry0');
    expect(selectSurvivorVisual({ ...state, hunger: 20, nowMs: 1500 }).texture).toBe('survivor:hungry1');
    expect(selectSurvivorVisual({ ...state, hunger: 20, energy: 20 }).texture).toBe('survivor:tired0');
    expect(selectSurvivorVisual({ ...state, hunger: 20, action: { kind: 'rest', startedAtMs: 1000 } }).texture).toBe('survivor:rest0');
  });

  it('carries the most serious look while walking, not just while standing still', () => {
    expect(selectSurvivorVisual({ ...state, moving: true, warmth: 20 })).toEqual({ texture: 'survivor:walkDown0', flipX: false, effect: 'shiver', puff: 'breath' });
    expect(selectSurvivorVisual({ ...state, moving: true, facing: 'left', sick: true, warmth: 20 })).toEqual({ texture: 'survivor:walkSide0', flipX: true, effect: 'sway', puff: 'cough' });
    expect(selectSurvivorVisual({ ...state, moving: true, hunger: 20 })).toMatchObject({ effect: 'hunch', puff: null });
    expect(selectSurvivorVisual({ ...state, moving: true })).toMatchObject({ effect: null, puff: null });
  });

  it('holds a hand to the mouth while idle and sick, before shivering', () => {
    expect(selectSurvivorVisual({ ...state, sick: true, warmth: 20 }).texture).toBe('survivor:sick0');
    expect(selectSurvivorVisual({ ...state, sick: true, nowMs: 1500 }).texture).toBe('survivor:sick1');
    expect(selectSurvivorVisual({ ...state, sick: true, packed: true }).texture).toBe('survivor:sick0Pack');
  });

  it('only ever picks a texture the survivor sheet has', () => {
    const looks = [{}, { warmth: 20 }, { energy: 20 }, { hunger: 20 }, { sick: true }];
    for (const look of looks) for (const facing of ['down', 'up', 'left', 'right'] as const) for (const moving of [false, true]) for (const packed of [false, true]) {
      const texture = selectSurvivorVisual({ ...state, ...look, facing, moving, packed }).texture;
      expect(survivorSprite.frames[texture.replace('survivor:', '')], texture).toBeDefined();
    }
  });
});

describe('how the survivor looks', () => {
  it('leads with sickness, then cold, then tiredness, then hunger', () => {
    expect(needLook({ ...state, sick: true, warmth: 20 })).toEqual({ effect: 'sway', puff: 'cough', idle: 'sick' });
    expect(needLook({ ...state, warmth: 20, energy: 20 })).toEqual({ effect: 'shiver', puff: 'breath', idle: 'shiver' });
    expect(needLook({ ...state, energy: 20, hunger: 20 })).toEqual({ effect: 'droop', puff: null, idle: 'tired' });
    expect(needLook({ ...state, hunger: 20 })).toEqual({ effect: 'hunch', puff: null, idle: 'hungry' });
    expect(needLook(state)).toEqual({ effect: null, puff: null, idle: null });
  });
});

describe('playing the look on the sprite', () => {
  it('jitters a shiver a pixel either way about twelve times a second', () => {
    expect(effectPose('shiver', 0)).toEqual({ dx: -1, dy: 0, rotation: 0 });
    expect(effectPose('shiver', 90)).toEqual({ dx: 1, dy: 0, rotation: 0 });
  });

  it('sways a sick survivor gently over 1.6 seconds', () => {
    expect(effectPose('sway', 400).rotation).toBeCloseTo(0.06);
    expect(effectPose('sway', 1200).rotation).toBeCloseTo(-0.06);
    expect(Math.abs(effectPose('sway', 0).rotation)).toBeLessThan(1e-9);
  });

  it('hunches a hungry survivor a pixel low', () => {
    expect(effectPose('hunch', 123)).toEqual({ dx: 0, dy: 1, rotation: 0 });
  });

  it('dips a tired survivor briefly every two seconds', () => {
    expect(effectPose('droop', 100).dy).toBe(1);
    expect(effectPose('droop', 1000).dy).toBe(0);
    expect(effectPose('droop', 2100).dy).toBe(1);
  });

  it('stands still when well', () => {
    expect(effectPose(null, 500)).toEqual({ dx: 0, dy: 0, rotation: 0 });
  });

  it('lets a puff out every 1.5 seconds', () => {
    expect(puffDue(undefined, 0)).toBe(true);
    expect(puffDue(1000, 2400)).toBe(false);
    expect(puffDue(1000, 2500)).toBe(true);
  });
});

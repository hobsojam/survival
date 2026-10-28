import { describe, expect, it } from 'vitest';
import { nightStart } from '../src/game/calendar';
import { BALANCE, createGame, type Friend, type GameState } from '../src/game/state';
import { companionPose } from '../src/scene/companionPose';

const base = createGame();
const withFriend = (friend: Friend, changes: Partial<GameState> = {}): GameState => ({
  ...base, day: 5, timeOfDay: 60, player: { ...base.player, x: 22, y: 14 },
  companion: { ...base.companion, friend, since: 1 }, ...changes
});
const fromPlayer = (state: GameState, pose: { x: number; y: number }) => Math.hypot(pose.x - state.player.x, pose.y - state.player.y);
const fromFire = (pose: { x: number; y: number }) => Math.hypot(pose.x - BALANCE.campX, pose.y - BALANCE.campY);

describe('where the friend is', () => {
  it('is nowhere without a friend', () => {
    expect(companionPose(base, 0, 0, 1)).toBeNull();
  });

  it('naps by the fire at night, the fox sitting and the wolf lying down', () => {
    const night = { timeOfDay: nightStart(5) + 20 };
    const fox = companionPose(withFriend('fox', night), 0, 0, 1)!;
    expect(fox.frame).toMatch(/^fox:sit/);
    expect(fromFire(fox)).toBeLessThan(2);
    const wolf = companionPose(withFriend('wolf', night), 0, 0, 1)!;
    expect(wolf.frame).toBe('wolf:lie');
    expect(fromFire(wolf)).toBeLessThan(2);
  });

  it('walks beside the survivor by day, the wolf close and the fox a few steps back', () => {
    const wolf = withFriend('wolf');
    expect(fromPlayer(wolf, companionPose(wolf, 0, 0, 1)!)).toBeLessThanOrEqual(1);
    expect(companionPose(wolf, 0, 0, 1)!.frame).toMatch(/^wolf:walk/);
    expect(companionPose(wolf, 0, 5, 1)!.frame).toBe('wolf:sit');
    const fox = withFriend('fox');
    const behind = companionPose(fox, 0, 0, 1)!;
    expect(behind.x).toBeLessThan(fox.player.x);
    expect(companionPose(fox, 0, 0, -1)!.x).toBeGreaterThan(fox.player.x);
    expect(fromPlayer(fox, behind)).toBeCloseTo(1.5, 1);
  });

  it('lands the bird on the shoulder once the survivor stands still', () => {
    const bird = withFriend('bird');
    const ahead = companionPose(bird, 0, 0, 1)!;
    expect(ahead.height).toBeGreaterThan(0);
    const perched = companionPose(bird, 0, 3, 1)!;
    expect(fromPlayer(bird, perched)).toBeLessThanOrEqual(0.5);
    expect(perched.frame).toBe('bird:idle');
  });

  it('waits at the fire while the survivor is away', () => {
    const quarry = withFriend('fox', { area: 'quarry' });
    expect(fromFire(companionPose(quarry, 0, 0, 1)!)).toBeLessThan(2);
    const far = withFriend('wolf', { player: { ...base.player, x: 35, y: 26 } });
    expect(fromFire(companionPose(far, 0, 0, 1)!)).toBeLessThan(2);
  });
});

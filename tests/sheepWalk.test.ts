import { describe, expect, it } from 'vitest';
import { SheepWalk } from '../src/scene/sheepWalk';
import type { SceneVisual } from '../src/scene/visuals';

const sheep = (x: number, y: number, depth = 100): SceneVisual => ({ id: 'sheep-0', texture: 'sheep:woollyIdle', x, y, depth });
const snow = (x: number, y: number, depth = 100.0005): SceneVisual => ({ id: 'sheep-0-snow', texture: 'sheepSnow:small', x, y, depth });

describe('sheep walking across the pen', () => {
  it('stands a sheep straight on its spot when it first comes into view', () => {
    const walk = new SheepWalk();
    expect(walk.apply([sheep(100, 100)], 0)).toEqual([sheep(100, 100)]);
  });

  it('walks a sheep to a new spot instead of jumping there', () => {
    const walk = new SheepWalk();
    walk.apply([sheep(100, 100)], 0);
    const [step] = walk.apply([sheep(140, 100)], 1000);
    expect(step.x).toBeGreaterThan(100);
    expect(step.x).toBeLessThan(140);
    expect(step.y).toBe(100);
  });

  it('gets there in the end and stays', () => {
    const walk = new SheepWalk();
    walk.apply([sheep(100, 100)], 0);
    let shown = sheep(100, 100);
    for (let now = 100; now <= 10000; now += 100) [shown] = walk.apply([sheep(140, 100)], now);
    expect(shown).toEqual(sheep(140, 100));
  });

  it('uses the walking picture on the way, in step', () => {
    const walk = new SheepWalk();
    walk.apply([sheep(100, 100)], 0);
    const pictures = new Set<string>();
    for (let now = 100; now <= 1000; now += 100) pictures.add(walk.apply([sheep(140, 100)], now)[0].texture);
    expect(pictures).toEqual(new Set(['sheep:woollyIdle', 'sheep:woollyWalk']));
  });

  it("leaves a sheep's slow drift about its spot alone", () => {
    const walk = new SheepWalk();
    walk.apply([sheep(100, 100)], 0);
    expect(walk.apply([sheep(100.2, 100)], 50)).toEqual([sheep(100.2, 100)]);
  });

  it('keeps it sorted by where its feet are while it walks', () => {
    const walk = new SheepWalk();
    walk.apply([sheep(100, 100, 100)], 0);
    const [step] = walk.apply([sheep(100, 140, 100.04)], 1000);
    expect(step.depth).toBeCloseTo(100 + (step.y - 100) / 1000, 6);
  });

  it('carries the snow along with its sheep', () => {
    const walk = new SheepWalk();
    walk.apply([sheep(100, 100), snow(100, 90)], 0);
    const [body, cap] = walk.apply([sheep(140, 100), snow(140, 90)], 1000);
    expect(cap.x).toBe(body.x);
    expect(cap.y).toBe(body.y - 10);
  });

  it('passes everything else through untouched', () => {
    const walk = new SheepWalk();
    const fire: SceneVisual = { id: 'campfire', texture: 'fire:lit', x: 5, y: 5, depth: 1 };
    walk.apply([fire], 0);
    expect(walk.apply([{ ...fire, x: 50 }], 1000)).toEqual([{ ...fire, x: 50 }]);
  });

  it('forgets sheep out of view, so coming back to camp finds them on their spots', () => {
    const walk = new SheepWalk();
    walk.apply([sheep(100, 100)], 0);
    walk.apply([], 500);
    expect(walk.apply([sheep(140, 100)], 1000)).toEqual([sheep(140, 100)]);
  });
});

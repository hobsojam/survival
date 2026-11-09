import { describe, expect, it } from 'vitest';
import { BRIDGE_HOUSES, BRIDGE_NEEDS, BRIDGE_STAGES, bridgeDone, bridgeOpen, bridgeStage, emptyBridge, type BridgeState } from '../src/game/bridge';
import { MILESTONE_STONE, ROAD_SECTIONS, ROAD_WORK, emptyRoad, milestoneDone, roadDone } from '../src/game/meadow';
import { finishedCastleCamp, street } from './townStreet';

// EASTER EGG: the town, see src/game/town.ts. The bridge to the meadow and the old road beyond it.

const built = (doneDay: number) => ({ stone: 30, beams: 4, fittings: 1, doneDay });
const laid = (stone: number, beams = 0, fittings = 0): BridgeState => ({ stone, beams, fittings, doneDays: {} });

describe('the bridge', () => {
  it('is raised in three stages, each taking what it needs in order', () => {
    expect(BRIDGE_STAGES).toEqual(['piers', 'arch', 'parapet']);
    expect(BRIDGE_NEEDS).toEqual({ piers: { stone: 24 }, arch: { beams: 4, stone: 16 }, parapet: { stone: 10, fittings: 2 } });
    expect(emptyBridge()).toEqual({ stone: 0, beams: 0, fittings: 0, doneDays: {} });
    expect(bridgeStage(laid(0))).toBe('piers');
    expect(bridgeStage(laid(23))).toBe('piers');
    expect(bridgeStage(laid(24))).toBe('arch');
    expect(bridgeStage(laid(24, 4))).toBe('arch');
    expect(bridgeStage(laid(40, 4))).toBe('parapet');
    expect(bridgeStage(laid(50, 4, 1))).toBe('parapet');
    expect(bridgeStage(laid(50, 4, 2))).toBeNull();
    expect(bridgeDone(laid(50, 4, 2))).toBe(true);
    expect(bridgeDone(laid(50, 4, 1))).toBe(false);
  });

  it('opens once the eighth house is finished, until it is done', () => {
    expect(BRIDGE_HOUSES).toBe(8);
    const camp = finishedCastleCamp();
    camp.town.houses = street(...Array.from({ length: 7 }, (_, i) => built(20 + i)));
    expect(bridgeOpen(camp)).toBe(false);
    camp.town.houses = street(...Array.from({ length: 8 }, (_, i) => built(20 + i)));
    expect(bridgeOpen(camp)).toBe(true);
    camp.town.bridge = laid(50, 4, 2);
    expect(bridgeOpen(camp)).toBe(false);
  });
});

describe('the old road', () => {
  it('is cleared a section at a time, then marked with a milestone', () => {
    expect([ROAD_SECTIONS, ROAD_WORK, MILESTONE_STONE]).toEqual([6, 4, 6]);
    expect(emptyRoad()).toEqual({ cleared: 0, work: 0, milestone: 0, doneDays: {} });
    expect(roadDone({ ...emptyRoad(), cleared: 5 })).toBe(false);
    expect(roadDone({ ...emptyRoad(), cleared: 6 })).toBe(true);
    expect(milestoneDone({ ...emptyRoad(), cleared: 6, milestone: 5 })).toBe(false);
    expect(milestoneDone({ ...emptyRoad(), cleared: 6, milestone: 6 })).toBe(true);
  });
});

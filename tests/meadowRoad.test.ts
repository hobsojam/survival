import { describe, expect, it } from 'vitest';
import { emptyRoad, type RoadState } from '../src/game/meadow';
import { MILESTONE_SITE, ROAD_ORDER, ROAD_SPOTS, roadSpot } from '../src/game/roadSites';
import { applyAction } from '../src/game/rules';
import type { GameState } from '../src/game/state';
import { HOUSE_PLOTS } from '../src/game/townSites';
import { MEADOW_PATHS, pathDistance } from '../src/scene/mapGeometry';
import { promptFor, useKeyAction } from '../src/scene/prompts';
import { pickTapTarget, targetAction } from '../src/scene/tapTarget';
import { finishedCastleCamp, street } from './townStreet';

// EASTER EGG: the town, see src/game/town.ts. Clearing the old traders' road through the meadow, and its milestone.

const built = (doneDay: number) => ({ stone: 30, beams: 4, fittings: 1, doneDay });

/** The bridge finished, the survivor rested in the meadow at the road's next spot, with stone in the bag. */
const onRoad = (road: Partial<RoadState> = {}, change: (state: GameState) => void = () => {}): GameState => {
  const state = finishedCastleCamp();
  state.town = { ...state.town, houses: street(...Array.from({ length: 8 }, (_, i) => built(20 + i))),
    bridge: { stone: 50, beams: 4, fittings: 2, doneDays: { piers: 40, arch: 45, parapet: 50 } }, road: { ...emptyRoad(), ...road } };
  state.area = 'meadow';
  state.progress.meadowFound = true;
  state.inventory = { ...state.inventory, stone: 8 };
  state.player = { ...state.player, energy: 100 };
  change(state);
  const spot = roadSpot(state);
  if (spot) state.player = { ...state.player, x: spot.x, y: spot.y - 0.5 };
  return state;
};
const work = (state: GameState) => applyAction(state, { type: 'roadWork' });

describe('the old road', () => {
  it('runs in six sections along the meadow, cleared outwards from where the lane meets it', () => {
    expect(ROAD_SPOTS).toEqual([0, 1, 2, 3, 4, 5].map(i => ({ x: 3.5 + i * 6.5, y: 18 })));
    expect(ROAD_ORDER).toEqual([3, 4, 2, 5, 1, 0]);
    expect(roadSpot(onRoad())).toEqual({ area: 'meadow', ...ROAD_SPOTS[3] });
    expect(roadSpot(onRoad({ cleared: 2 }))).toEqual({ area: 'meadow', ...ROAD_SPOTS[2] });
  });

  it('is not there to clear before the bridge is finished', () => {
    expect(roadSpot(onRoad({}, state => { state.town.bridge = { stone: 40, beams: 4, fittings: 0, doneDays: { piers: 40, arch: 45 } }; }))).toBeNull();
  });

  it('gives the same work from the prompt, the E key and a tap', () => {
    const state = onRoad();
    expect(promptFor(state)).toContain('Clear the old road (0/4)');
    expect(useKeyAction(state)).toEqual({ type: 'roadWork' });
    expect(targetAction(pickTapTarget(state, ROAD_SPOTS[3].x, ROAD_SPOTS[3].y))).toEqual({ type: 'roadWork' });
  });

  it('takes four goes to clear a section, and needs no tool and gives nothing', () => {
    const first = work(onRoad());
    expect(first.message).toBe('You pull back the bracken and find the old stones underneath.');
    expect(first.state.town.road).toMatchObject({ cleared: 0, work: 1 });
    expect(first.state.inventory).toEqual(onRoad().inventory);
    const open = work(onRoad({ work: 3 }));
    expect(open.message).toBe('Another stretch of the old road is open.');
    expect(open.state.town.road).toMatchObject({ cleared: 1, work: 0 });
    expect(roadSpot(open.state)).toMatchObject(ROAD_SPOTS[4]);
  });

  it('runs clear on the last section, on the day it is done', () => {
    const done = work(onRoad({ cleared: 5, work: 3 }));
    expect(done.message).toBe('The old road runs clear from one side of the meadow to the other.');
    expect(done.state.town.road.doneDays.road).toBe(done.state.day);
  });

  it('refuses from too far away or too tired', () => {
    const far = onRoad();
    expect(work({ ...far, player: { ...far.player, y: far.player.y - 5 } }).message).toBe('Move closer to the road.');
    expect(work(onRoad({}, state => { state.player.energy = 0; })).message).toMatch(/tired/i);
  });
});

describe('the milestone', () => {
  const cleared = { cleared: 6, doneDays: { road: 52 } };

  it('stands by the road\'s east end, clear of the meadow\'s plots and the lane', () => {
    expect(MILESTONE_SITE).toEqual({ x: 37, y: 16.5 });
    for (const plot of HOUSE_PLOTS.filter(each => each.area === 'meadow')) expect(Math.hypot(plot.x - MILESTONE_SITE.x, plot.y - MILESTONE_SITE.y)).toBeGreaterThan(3);
    expect(pathDistance(MILESTONE_SITE.x + 0.5, MILESTONE_SITE.y + 0.5, [MEADOW_PATHS[0]])).toBeGreaterThan(3);
  });

  it('opens once the road is clear, and takes stone from the bag', () => {
    expect(roadSpot(onRoad(cleared))).toEqual({ area: 'meadow', ...MILESTONE_SITE });
    const state = onRoad(cleared);
    expect(promptFor(state)).toContain('Set a milestone stone (0/6)');
    const set = work(state);
    expect(set.message).toBe('You set another stone on the milestone.');
    expect(set.state.inventory.stone).toBe(7);
    expect(set.state.town.road.milestone).toBe(1);
  });

  it('stands on the day its last stone goes in, and then there is nothing more to do on the road', () => {
    const done = work(onRoad({ ...cleared, milestone: 5 }));
    expect(done.message).toBe('The milestone stands by the road. Someone coming this way would see it.');
    expect(done.state.town.road.doneDays.milestone).toBe(done.state.day);
    expect(roadSpot(done.state)).toBeNull();
  });

  it('wants stone carried in the bag, since the cart can\'t cross the bridge', () => {
    const empty = onRoad(cleared, state => { state.inventory.stone = 0; state.castle.cart = { ...state.castle.cart, at: 'hills', stone: 10 }; });
    expect(promptFor(empty)).toContain('Milestone · bring stone from the quarry in your bag');
    expect(work(empty).message).toBe('Bring stone from the quarry in your bag.');
  });
});

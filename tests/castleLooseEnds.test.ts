import { describe, expect, it } from 'vitest';
import { NEEDS, emptyCastle, type CastleState } from '../src/game/castle';
import { KEEP_STONES } from '../src/game/keep';
import { createGame, type GameState } from '../src/game/state';
import { sceneVisuals } from '../src/scene/visuals';
import { castleSprites } from '../src/art/castleSprites';
import { HALL_LANTERN, HALL_LIGHTS_OFFSETS, hallLights } from '../src/scene/lighting';

// EASTER EGG: the castle, see src/game/castle.ts. The finishing touches once it is built.

const game = createGame();
const TOWER = { stones: NEEDS.towerStones, beams: NEEDS.towerBeams, fittings: NEEDS.towerFittings };
const BUILT: CastleState = {
  ...emptyCastle(), firstClimbDay: 4, revealedDay: 5, road: NEEDS.road, frames: NEEDS.frames,
  wall: { north: NEEDS.wallSide, east: NEEDS.wallSide, south: NEEDS.wallSide, west: NEEDS.wallSide },
  towers: { nw: TOWER, ne: TOWER, se: TOWER, sw: TOWER }, gatehouse: NEEDS.gatehouse, moat: { stretches: NEEDS.moat, lastDugDay: 20, dugDay: 20 },
  hall: { stones: NEEDS.hallStones, beams: NEEDS.hallBeams, fittings: NEEDS.hallFittings, hangings: NEEDS.hallHangings },
  doneDays: { road: 3, frames: 2, 'wall-north': 2, 'wall-east': 2, 'wall-south': 2, 'wall-west': 2, 'tower-nw': 4, 'tower-ne': 4, 'tower-se': 4, 'tower-sw': 4, gatehouse: 5, moat: 20, hall: 6 }
};
const onHills = (castle: Partial<CastleState> = {}): GameState => ({
  ...game, day: 50, timeOfDay: 40, area: 'hills',
  progress: { ...game.progress, workshop: { ...game.progress.workshop, forge: true, stoneCart: true, portcullis: true } },
  keep: { ...game.keep, stones: KEEP_STONES, door: true, startedDay: 2, finishedDay: 3 },
  castle: { ...BUILT, ...castle }
});
const frames = (state: GameState) => sceneVisuals(state, 0).find(visual => visual.id === 'castle-frames');

describe('the frames and hoist', () => {
  it('stand while anything is still to build', () => {
    expect(frames(onHills({ hall: { ...BUILT.hall, hangings: 1 }, doneDays: { ...BUILT.doneDays, hall: undefined } }))).toBeDefined();
    expect(frames(onHills({ gatehouse: 29, doneDays: { ...BUILT.doneDays, gatehouse: undefined } }))).toBeDefined();
    expect(frames(onHills({ moat: { stretches: 15, lastDugDay: 20, dugDay: null } }))).toBeDefined();
  });

  it('come down once every section is built, before the feast, and stay down', () => {
    expect(frames(onHills())).toBeUndefined();
    expect(frames(onHills({ feast: { ...NEEDS.feast }, finishedDay: 34 }))).toBeUndefined();
    expect(frames({ ...onHills(), day: 25 })).toBeUndefined();
  });
});

describe('the hall at night: the window and a lantern by the door', () => {
  const night = (castle: Partial<CastleState> = {}): GameState => ({ ...onHills({ feast: { ...NEEDS.feast }, finishedDay: 34, ...castle }), timeOfDay: 190 });
  const lit = castleSprites.castleHallGlow.frames.lit.flatMap((row, y) => [...row].map((pixel, x) => ({ pixel, x, y }))).filter(({ pixel }) => pixel !== '.' && pixel !== ' ');

  it('lights the window and the lantern once the castle is finished, at night on the hills', () => {
    expect(hallLights(night()).map(light => light.offset)).toEqual([HALL_LIGHTS_OFFSETS.window, HALL_LIGHTS_OFFSETS.lantern]);
    expect(hallLights({ ...night(), timeOfDay: 40 })).toEqual([]);
    expect(hallLights(night({ finishedDay: null, feast: { ...NEEDS.feast, honey: 2 } }))).toEqual([]);
    expect(hallLights({ ...night(), area: 'camp' })).toEqual([]);
  });

  it('casts the lantern\'s light wider than the window\'s, so it pools on the yard', () => {
    const [window, lantern] = hallLights(night());
    expect(lantern.radii.outer).toBeGreaterThan(window.radii.outer);
  });

  it('draws the lantern on the wall beside the door, clear of the doorway and the first hanging, with its light where the lantern is', () => {
    const inLantern = lit.filter(({ x, y }) => x >= HALL_LANTERN.x && x < HALL_LANTERN.x + HALL_LANTERN.w && y >= HALL_LANTERN.y && y < HALL_LANTERN.y + HALL_LANTERN.h);
    expect(inLantern.length).toBeGreaterThan(3);
    expect(HALL_LANTERN.x).toBeGreaterThanOrEqual(22);
    expect(HALL_LANTERN.x + HALL_LANTERN.w).toBeLessThanOrEqual(24);
    const [, anchorY] = castleSprites.castleHall.anchor;
    const [anchorX] = castleSprites.castleHall.anchor;
    expect(HALL_LIGHTS_OFFSETS.lantern.x).toBeCloseTo(HALL_LANTERN.x + HALL_LANTERN.w / 2 - anchorX, 0);
    expect(HALL_LIGHTS_OFFSETS.lantern.y).toBeCloseTo(HALL_LANTERN.y + HALL_LANTERN.h / 2 - anchorY, 0);
  });
});

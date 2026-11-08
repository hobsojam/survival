import { describe, expect, it } from 'vitest';
import { HALL_DOOR_SPOT, NEEDS, emptyCastle, type CastleState } from '../src/game/castle';
import { alarmAfter } from '../src/game/companion';
import { coldNightMessage } from '../src/game/coldNight';
import { cookBlocker } from '../src/game/cooking';
import { emptyFood } from '../src/game/food';
import { HOUSE_SPOT, fuelLeft, isAtHome } from '../src/game/home';
import { KEEP_SITE, KEEP_STONES, atHallDoor, inKeep } from '../src/game/keep';
import { isWarmRestHere } from '../src/game/sickness';
import { applyAction } from '../src/game/rules';
import { createGame, type GameState } from '../src/game/state';
import { promptFor, useKeyAction } from '../src/scene/prompts';
import { pickTapTarget, targetAction } from '../src/scene/tapTarget';
import { homeChoiceView } from '../src/ui/panels';

// EASTER EGG: the castle, see src/game/castle.ts. Moving into the finished hall.

const game = createGame();
const DAY = 40;
const TOWER = { stones: NEEDS.towerStones, beams: NEEDS.towerBeams, fittings: NEEDS.towerFittings };
/** Every section built and the feast laid on day 34. */
const BUILT: CastleState = {
  ...emptyCastle(), firstClimbDay: 4, revealedDay: 5, road: NEEDS.road, frames: NEEDS.frames,
  wall: { north: NEEDS.wallSide, east: NEEDS.wallSide, south: NEEDS.wallSide, west: NEEDS.wallSide },
  towers: { nw: TOWER, ne: TOWER, se: TOWER, sw: TOWER }, gatehouse: NEEDS.gatehouse, moat: { stretches: NEEDS.moat, lastDugDay: 20, dugDay: 20 },
  hall: { stones: NEEDS.hallStones, beams: NEEDS.hallBeams, fittings: NEEDS.hallFittings, hangings: NEEDS.hallHangings }, feast: { ...NEEDS.feast },
  doneDays: { road: 3, frames: 2, 'wall-north': 2, 'wall-east': 2, 'wall-south': 2, 'wall-west': 2, 'tower-nw': 4, 'tower-ne': 4, 'tower-se': 4, 'tower-sw': 4, gatehouse: 5, moat: 20, hall: 6 },
  finishedDay: 34
};
const NIGHT = 190;

/** A finished castle on the hills, the survivor at the hall's door in the house's year, every camp fire out and no wood anywhere. */
const finished = (castle: Partial<GameState['castle']> = {}, changes: Partial<GameState> = {}): GameState => ({
  ...game,
  day: 50,
  timeOfDay: DAY,
  area: 'hills',
  player: { ...game.player, ...HALL_DOOR_SPOT, energy: 60, hunger: 80, warmth: 80 },
  structures: { ...game.structures, shelter: true, woodpile: true, house: true },
  progress: { ...game.progress, potCrafted: true, workshop: { ...game.progress.workshop, forge: true, stoneCart: true, portcullis: true } },
  fireFuel: 0,
  fireplaceFuel: 0,
  storedWood: 0,
  inventory: { ...game.inventory, wood: 0, food: { ...emptyFood(), berry: [50] } },
  keep: { ...game.keep, stones: KEEP_STONES, door: true, startedDay: 2, finishedDay: 3 },
  castle: { ...BUILT, ...castle },
  ...changes
});
const at = (state: GameState, spot: { x: number; y: number }, area: GameState['area'] = state.area): GameState => ({ ...state, area, player: { ...state.player, x: spot.x, y: spot.y } });
const hallHome = (changes: Partial<GameState> = {}): GameState => finished({ offeredHome: true, home: 'hall' }, changes);

describe('the hall door', () => {
  it('is there once the castle is finished, on the hills, within reach of the door', () => {
    expect(atHallDoor(finished())).toBe(true);
    expect(atHallDoor(at(finished(), { x: HALL_DOOR_SPOT.x + 1.5, y: HALL_DOOR_SPOT.y }))).toBe(true);
    expect(atHallDoor(at(finished(), { x: HALL_DOOR_SPOT.x + 3, y: HALL_DOOR_SPOT.y }))).toBe(false);
    expect(atHallDoor(finished({ finishedDay: null, feast: { ...NEEDS.feast, vegetables: 3 } }))).toBe(false);
    expect(atHallDoor({ ...finished(), area: 'quarry' })).toBe(false);
  });

  it('is clear of the keep door, so the two never share a spot', () => {
    expect(Math.hypot(HALL_DOOR_SPOT.x - KEEP_SITE.x, HALL_DOOR_SPOT.y - KEEP_SITE.y)).toBeGreaterThan(3);
    expect(atHallDoor(at(finished(), KEEP_SITE))).toBe(false);
  });

  it('counts as in the keep, so sleep, warmth, wolves and the sick day carry over', () => {
    expect(inKeep(finished())).toBe(true);
    expect(inKeep(finished({ finishedDay: null, feast: { ...NEEDS.feast, vegetables: 3 } }))).toBe(false);
    expect(isWarmRestHere(finished())).toBe(true);
  });

  it('offers sleep at night and the climb by day, by key and by tap', () => {
    expect(promptFor(finished({}, { timeOfDay: NIGHT }))).toBe('E  Sleep in the hall until morning');
    expect(promptFor(finished()).startsWith('E  Climb to the top')).toBe(true);
    expect(useKeyAction(finished())).toEqual({ type: 'enterKeep' });
    expect(targetAction(pickTapTarget(finished(), HALL_DOOR_SPOT.x, HALL_DOOR_SPOT.y - 0.5))).toEqual({ type: 'enterKeep' });
  });

  it('keeps the keep\'s own words at the keep door', () => {
    expect(promptFor(at(finished({}, { timeOfDay: NIGHT }), KEEP_SITE))).toBe('E  Sleep in the keep until morning');
  });

  it('sleeps the night through in the hall, warm with no fire anywhere', () => {
    const { state } = applyAction(finished({}, { timeOfDay: NIGHT }), { type: 'enterKeep' });
    expect(state.day).toBe(51);
    expect(state.player.energy).toBe(100);
  });

  it('has no door before the castle is finished', () => {
    expect(promptFor(finished({ finishedDay: null, feast: { ...NEEDS.feast, vegetables: 3 } }))).not.toContain('hall');
    expect(useKeyAction(finished({ finishedDay: null, feast: { ...NEEDS.feast, vegetables: 3 } }))?.type).not.toBe('enterKeep');
  });
});

describe('the offer to make the hall home', () => {
  it('stays hidden until the first time through the hall door, then stays', () => {
    expect(homeChoiceView(finished()).shown).toBe(false);
    const slept = applyAction(finished({}, { timeOfDay: NIGHT }), { type: 'enterKeep' }).state;
    expect(slept.castle.offeredHome).toBe(true);
    const climbed = applyAction(finished(), { type: 'enterKeep' }).state;
    expect(climbed.castle.offeredHome).toBe(true);
    expect(homeChoiceView(climbed).shown).toBe(true);
    expect(homeChoiceView(at(climbed, HOUSE_SPOT, 'camp')).shown).toBe(true);
  });

  it('is made by the sleep or the climb the scene sends for the door, as well as by the door itself', () => {
    expect(applyAction(finished({}, { timeOfDay: NIGHT }), { type: 'sleep' }).state.castle.offeredHome).toBe(true);
    expect(applyAction(finished(), { type: 'climbKeep' }).state.castle.offeredHome).toBe(true);
    expect(applyAction(finished({}, { timeOfDay: NIGHT }), { type: 'climbKeep' }).state.castle.offeredHome).toBe(false);
  });

  it('is not made at the keep door', () => {
    expect(applyAction(at(finished(), KEEP_SITE), { type: 'enterKeep' }).state.castle.offeredHome).toBe(false);
  });

  it('says plainly what moving would mean, both ways', () => {
    expect(homeChoiceView(finished({ offeredHome: true }))).toEqual({
      shown: true, home: 'house', choose: 'hall', button: 'Make the hall your home',
      copy: 'You could make the hall your home. The camp will carry on below, and the house stays yours.'
    });
    expect(homeChoiceView(hallHome())).toEqual({
      shown: true, home: 'hall', choose: 'house', button: 'Make the house your home again',
      copy: 'The hall is your home. The camp carries on below, and the house is still yours.'
    });
  });

  it('takes effect at once, either way, from anywhere', () => {
    const offered = at(finished({ offeredHome: true }), HOUSE_SPOT, 'camp');
    const moved = applyAction(offered, { type: 'chooseHome', home: 'hall' });
    expect(moved.state.castle.home).toBe('hall');
    expect(moved.message).toBe('The hall is your home now.');
    const back = applyAction(moved.state, { type: 'chooseHome', home: 'house' });
    expect(back.state.castle.home).toBe('house');
    expect(back.message).toBe('The house is your home again.');
    expect(back.state.day).toBe(offered.day);
    expect(back.state.timeOfDay).toBe(offered.timeOfDay);
  });

  it('can\'t be taken before it is offered, or to the home already chosen', () => {
    expect(applyAction(finished(), { type: 'chooseHome', home: 'hall' }).state.castle.home).toBe('house');
    const same = applyAction(hallHome(), { type: 'chooseHome', home: 'hall' });
    expect(same.state).toEqual(hallHome());
  });
});

describe('a cold night in the hall', () => {
  it('says where it was slept through', () => {
    const before = finished({}, { timeOfDay: NIGHT, progress: { ...finished().progress, nextStormDay: 50 } });
    const after = applyAction(before, { type: 'enterKeep' }).state;
    expect(coldNightMessage(before, after)).toMatch(/^You slept through the cold night in the hall\./);
    expect(coldNightMessage(at(before, KEEP_SITE), applyAction(at(before, KEEP_SITE), { type: 'enterKeep' }).state)).toMatch(/^You slept through the cold night in the keep\./);
  });
});

describe('the hall as home', () => {
  it('is home at the hall door, and the house is still home too', () => {
    expect(isAtHome(hallHome())).toBe(true);
    expect(isAtHome(at(hallHome(), HOUSE_SPOT, 'camp'))).toBe(true);
    expect(isAtHome(finished({ offeredHome: true }))).toBe(false);
  });

  it('has a fire that needs no wood, only at the hall', () => {
    expect(fuelLeft(hallHome())).toBe(Infinity);
    expect(fuelLeft(at(hallHome(), HOUSE_SPOT, 'camp'))).toBe(0);
    expect(fuelLeft(finished())).toBe(0);
  });

  it('lets the survivor rest and cook there with every camp fire out and no wood anywhere', () => {
    const rested = applyAction(hallHome(), { type: 'rest' });
    expect(rested.state.player.energy).toBeGreaterThan(60);
    expect(cookBlocker(hallHome())).toBeNull();
    expect(applyAction(hallHome(), { type: 'cook' }).state.inventory.food.berry).toHaveLength(0);
    expect(cookBlocker(finished({ offeredHome: true }))).toBe('Go home to cook.');
    expect(applyAction(finished({ offeredHome: true }), { type: 'rest' }).state.player.energy).toBe(60);
  });

  it('keeps a sick survivor warm to eat and rest', () => {
    const sick = hallHome({ sickness: { ...game.sickness, sick: true } });
    expect(isWarmRestHere(sick)).toBe(true);
    expect(applyAction(sick, { type: 'cook' }).state.sickness.ateWarm).toBe(true);
  });

  it('never has the bird\'s alarm go off there', () => {
    const winterNight = hallHome({ day: 25, timeOfDay: NIGHT, companion: { ...game.companion, friends: { ...game.companion.friends, bird: 3 } } });
    expect(alarmAfter(winterNight)).toBeNull();
  });

  it('leaves the camp carrying on the same, whichever home is chosen', () => {
    const away = (home: 'house' | 'hall'): GameState => {
      let state = finished({ offeredHome: true, home }, { timeOfDay: NIGHT });
      for (let night = 0; night < 40; night++) state = applyAction({ ...state, timeOfDay: NIGHT, player: { ...state.player, ...HALL_DOOR_SPOT, hunger: 80, warmth: 80 } }, { type: 'enterKeep' }).state;
      return state;
    };
    const [house, hall] = [away('house'), away('hall')];
    for (const part of ['structures', 'field', 'beds', 'sheep', 'chickens', 'orchard', 'beehive', 'larder', 'storedWood'] as const) {
      expect(hall[part as keyof GameState], part).toEqual(house[part as keyof GameState]);
    }
  });
});

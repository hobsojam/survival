import { STEP_IDS, placeBranches } from '../src/game/clearing';
import { NEEDS, emptyCastle } from '../src/game/castle';
import { createGame, type GameState } from '../src/game/state';
import { HOUSE_COUNT, emptyHouse, type HouseState } from '../src/game/town';

// EASTER EGG: the town, see src/game/town.ts. Shared fixtures for the town's tests.

/** The town's houses with the first few as given and the rest of the street unbuilt. */
export const street = (...first: HouseState[]): HouseState[] => [...first, ...Array.from({ length: HOUSE_COUNT - first.length }, emptyHouse)];

const TOWER = { stones: 20, beams: 4, fittings: 2 };

/** A camp on day 60 with the castle finished on day 9 and the hall home, and no town yet. */
export const finishedCastleCamp = (): GameState => {
  const state = createGame();
  state.day = 60;
  state.progress.quarryFound = true; state.progress.hillsFound = true; state.progress.oreFoundDay = 2;
  state.clearing = { cleared: [...STEP_IDS], marked: null, felled: [] };
  state.nodes = placeBranches(state.nodes, [...STEP_IDS]);
  Object.assign(state.structures, { shelter: true, toolshed: true, workshop: true });
  state.progress.nextStormDay = null; state.progress.hearthUnlocked = true; state.progress.packWoven = true;
  Object.assign(state.progress.workshop, { forge: true, hinges: true, stoneCart: true, portcullis: true });
  state.keep = { stones: 60, door: true, startedDay: 1, finishedDay: 2, ponyNight: null };
  state.castle = { ...emptyCastle(), firstClimbDay: 4, revealedDay: 5, road: 30, frames: NEEDS.frames,
    wall: { north: 30, east: 30, south: 30, west: 30 }, towers: { nw: TOWER, ne: TOWER, se: TOWER, sw: TOWER }, gatehouse: 30,
    moat: { stretches: 16, lastDugDay: 8, dugDay: 8 }, hall: { stones: 40, beams: 12, fittings: 6, hangings: 2 }, feast: { ...NEEDS.feast },
    doneDays: { road: 6, frames: 7, 'wall-north': 8, 'wall-east': 8, 'wall-south': 8, 'wall-west': 8, 'tower-nw': 8, 'tower-ne': 8, 'tower-se': 8, 'tower-sw': 8, gatehouse: 8, moat: 8, hall: 8 },
    finishedDay: 9, home: 'hall', offeredHome: true };
  return state;
};

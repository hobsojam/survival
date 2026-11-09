import type { GameState } from './state';

// EASTER EGG: the town after the castle is deliberately left out of the README and hidden on screen until a lost
// traveller comes to the hall door, an evening after the survivor has made the hall their home. People come one at a
// time, each takes over one of the survivor's jobs, and each new house brings one more. See the design in
// docs/superpowers/specs/2026-11-08-town-design.md.

/** A job a worker can take over from the survivor. */
export type JobId = 'hens' | 'honey' | 'loaves' | 'wood' | 'beds' | 'field' | 'sheep' | 'orchard';
export const JOB_IDS: readonly JobId[] = ['hens', 'honey', 'loaves', 'wood', 'beds', 'field', 'sheep', 'orchard'];

/** Someone at the hall door who hasn't stayed yet. `askedDay` is the last day they were told no. */
export interface Traveller { name: string; arrivedDay: number; refusals: number; askedDay: number | null }
/** Someone who stayed: their own name, their job, and their house by plot, or null while they sleep in the hall. */
export interface Person { name: string; job: JobId; house: number | null; arrivedDay: number }
/** What is laid of a house so far, in the order it is laid, and the day it was finished. */
export interface HouseState { stone: number; beams: number; fittings: number; doneDay: number | null }

export interface TownState {
  traveller: Traveller | null;
  /** The day the last traveller moved on, so the next comes later. */
  goneDay: number | null;
  /** How many names from TOWN_NAMES have been given out, so no name comes twice. */
  namesUsed: number;
  people: Person[];
  /** One for each plot. */
  houses: HouseState[];
}

/** What a house takes: stone for its footings and walls, beams for its roof, and an iron fitting for its door. */
export const HOUSE_NEEDS = { stone: 30, beams: 4, fittings: 1 } as const;

/** How many plots there are for houses. */
export const HOUSE_COUNT = 8;

/** The names people arrive with, in the order they come. People are people and already have names: these are never changed. */
export const TOWN_NAMES: readonly string[] = ['Ada', 'Tomas', 'Elin', 'Bram', 'Maud', 'Osric', 'Hild', 'Piers', 'Agnes', 'Wat', 'Isolde', 'Hugh',
  'Cuthbert', 'Edith', 'Godric', 'Joan', 'Lettice', 'Martin', 'Nell', 'Roger', 'Sybil', 'Walter', 'Alys', 'Ralf'];

export const emptyHouse = (): HouseState => ({ stone: 0, beams: 0, fittings: 0, doneDay: null });

export const emptyTown = (): TownState => ({ traveller: null, goneDay: null, namesUsed: 0, people: [], houses: Array.from({ length: HOUSE_COUNT }, emptyHouse) });

/** Whether anyone has come yet. */
export const townStarted = (state: GameState): boolean => state.town.traveller !== null || state.town.people.length > 0;

/** Whether every part of a house is laid. */
export const houseFinished = (house: HouseState): boolean =>
  house.stone === HOUSE_NEEDS.stone && house.beams === HOUSE_NEEDS.beams && house.fittings === HOUSE_NEEDS.fittings;

import { describe, expect, it } from 'vitest';
import { HALL_DOOR_SPOT, NEEDS, emptyCastle } from '../src/game/castle';
import { nightStart } from '../src/game/calendar';
import { STEP_IDS, placeBranches } from '../src/game/clearing';
import { recordJournal } from '../src/game/journalEntries';
import { newsBetween } from '../src/game/news';
import { advanceTime, applyAction } from '../src/game/rules';
import { loadGame, saveGame } from '../src/game/save';
import { createGame, type GameState } from '../src/game/state';
import { TRAVELLER_REFUSALS, TRAVELLER_RETURN_DAYS, travellerArrives, travellerAsking, townNews } from '../src/game/traveller';
import { visitorView } from '../src/ui/panels';
import { renderVisitorPanel, visitorAction } from '../src/ui/townPanel';
import { currentPage, journalPageView } from '../src/ui/yearJournal';

// EASTER EGG: the town, see src/game/town.ts. The lost traveller at the hall door.

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
}

const TOWER = { stones: NEEDS.towerStones, beams: NEEDS.towerBeams, fittings: NEEDS.towerFittings };
const DAY = 60;

/** A finished castle with the hall made home, the hens home in their coop and a larder, at camp in the late afternoon of day 60. */
const hallHome = (change: (state: GameState) => void = () => {}): GameState => {
  const state = createGame();
  state.day = DAY;
  state.timeOfDay = 100;
  state.progress.quarryFound = true; state.progress.hillsFound = true; state.progress.oreFoundDay = 2; state.progress.homesteadFound = true;
  state.clearing = { cleared: [...STEP_IDS], marked: null, felled: [] };
  state.nodes = placeBranches(state.nodes, [...STEP_IDS]);
  Object.assign(state.structures, { shelter: true, toolshed: true, workshop: true, larder: true, chickenCoop: true });
  state.chickens = { discovered: true, following: false, rescued: true, eggs: 0, nextEggDay: 61 };
  state.progress.nextStormDay = null; state.progress.hearthUnlocked = true; state.progress.packWoven = true;
  Object.assign(state.progress.workshop, { forge: true, hinges: true, stoneCart: true, portcullis: true });
  state.keep = { stones: 60, door: true, startedDay: 1, finishedDay: 2, ponyNight: null };
  state.castle = { ...emptyCastle(), firstClimbDay: 4, revealedDay: 5, road: NEEDS.road, frames: NEEDS.frames,
    wall: { north: NEEDS.wallSide, east: NEEDS.wallSide, south: NEEDS.wallSide, west: NEEDS.wallSide },
    towers: { nw: TOWER, ne: TOWER, se: TOWER, sw: TOWER }, gatehouse: NEEDS.gatehouse,
    moat: { stretches: NEEDS.moat, lastDugDay: 8, dugDay: 8 }, hall: { stones: NEEDS.hallStones, beams: NEEDS.hallBeams, fittings: NEEDS.hallFittings, hangings: NEEDS.hallHangings },
    feast: { ...NEEDS.feast },
    doneDays: { road: 6, frames: 7, 'wall-north': 8, 'wall-east': 8, 'wall-south': 8, 'wall-west': 8, 'tower-nw': 8, 'tower-ne': 8, 'tower-se': 8, 'tower-sw': 8, gatehouse: 8, moat: 8, hall: 8 },
    finishedDay: 9, home: 'hall', offeredHome: true };
  change(state);
  return state;
};

/** Runs the clock across nightfall. */
const throughNightfall = (state: GameState, activity: Parameters<typeof advanceTime>[2] = 'awake'): GameState =>
  advanceTime({ ...state, timeOfDay: nightStart(state.day) - 1 }, 2, activity);

/** The next morning, the traveller still by the fire. */
const nextMorning = (state: GameState): GameState => ({ ...state, day: state.day + 1, timeOfDay: 30 });

/** Ada arrived last night, and it is morning. */
const asking = (change?: (state: GameState) => void): GameState => {
  const arrived = hallHome(change);
  arrived.town = { ...arrived.town, traveller: { name: 'Ada', arrivedDay: DAY, refusals: 0, askedDay: null }, namesUsed: 1 };
  return nextMorning(arrived);
};

const answer = (state: GameState, yes: boolean) => applyAction(state, { type: 'answerTraveller', yes });

describe('the traveller arrives', () => {
  it('comes to the hall door at the first nightfall with the hall as home, wherever the survivor is', () => {
    const atCamp = throughNightfall(hallHome());
    expect(atCamp.town.traveller).toEqual({ name: 'Ada', arrivedDay: DAY, refusals: 0, askedDay: null });
    expect(atCamp.town.namesUsed).toBe(1);
    expect(throughNightfall(hallHome(), 'resting').town.traveller?.name).toBe('Ada');
    const onHills = hallHome(state => { state.area = 'hills'; state.player = { ...state.player, ...HALL_DOOR_SPOT }; });
    expect(throughNightfall(onHills).town.traveller?.name).toBe('Ada');
  });

  it('does not come before nightfall', () => {
    expect(advanceTime(hallHome(), 10).town.traveller).toBeNull();
  });

  it('does not come with the house as home, before the castle is finished, or with no job to offer', () => {
    expect(throughNightfall(hallHome(state => { state.castle.home = 'house'; })).town.traveller).toBeNull();
    expect(throughNightfall(hallHome(state => { state.castle.finishedDay = null; state.castle.home = 'house'; state.castle.offeredHome = false; })).town.traveller).toBeNull();
    expect(throughNightfall(hallHome(state => { state.structures.larder = false; })).town.traveller).toBeNull();
  });

  it('comes only once while they wait, and not again once someone has stayed', () => {
    const waiting = asking();
    travellerArrives(waiting);
    expect(waiting.town.namesUsed).toBe(1);
    const stayed = answer(asking(), true).state;
    stayed.structures.beehive = true;
    travellerArrives(stayed);
    expect(stayed.town.traveller).toBeNull();
  });
});

describe('asking for work', () => {
  it('asks from the next morning, not on the night they arrive', () => {
    const arrived = throughNightfall(hallHome());
    expect(travellerAsking(arrived)).toBe(false);
    expect(answer(arrived, true).state).toBe(arrived);
    expect(travellerAsking(nextMorning(arrived))).toBe(true);
  });

  it('makes them a neighbour on a yes, with the first job, sleeping in the hall', () => {
    const result = answer(asking(), true);
    expect(result.message).toBe('Ada will stay.');
    expect(result.state.town.traveller).toBeNull();
    expect(result.state.town.people).toEqual([{ name: 'Ada', job: 'hens', house: null, arrivedDay: DAY }]);
    const written = recordJournal(asking(), result.state, { type: 'answerTraveller', yes: true }).state.journal;
    expect(written.find(entry => entry.id.startsWith('neighbour'))).toMatchObject({ name: 'Ada', day: DAY + 1 });
  });

  it('asks again the next morning after a no, and not before', () => {
    const first = answer(asking(), false);
    expect(first.message).toBe('Ada will ask again tomorrow.');
    expect(first.state.town.traveller).toMatchObject({ refusals: 1, askedDay: DAY + 1 });
    expect(travellerAsking(first.state)).toBe(false);
    expect(answer(first.state, false).state).toBe(first.state);
    expect(travellerAsking(nextMorning(first.state))).toBe(true);
  });

  it('goes on their way after three noes, and someone new comes ten days later', () => {
    expect(TRAVELLER_REFUSALS).toBe(3);
    expect(TRAVELLER_RETURN_DAYS).toBe(10);
    let state = asking();
    let message = '';
    for (let no = 0; no < TRAVELLER_REFUSALS; no++) {
      ({ state, message } = answer(state, false));
      if (no < TRAVELLER_REFUSALS - 1) state = nextMorning(state);
    }
    expect(message).toBe('Ada thanks you for the shelter and goes on their way.');
    expect(state.town.traveller).toBeNull();
    expect(state.town.goneDay).toBe(DAY + 3);
    expect(throughNightfall({ ...state, day: DAY + 3 + TRAVELLER_RETURN_DAYS - 1 }).town.traveller).toBeNull();
    const back = throughNightfall({ ...state, day: DAY + 3 + TRAVELLER_RETURN_DAYS });
    expect(back.town.traveller).toMatchObject({ name: 'Tomas', arrivedDay: DAY + 3 + TRAVELLER_RETURN_DAYS });
    expect(back.town.namesUsed).toBe(2);
  });

  it('sends the next traveller even with the house made home again, since only the first needs the hall', () => {
    let state = asking();
    for (let no = 0; no < TRAVELLER_REFUSALS; no++) {
      state = answer(state, false).state;
      if (no < TRAVELLER_REFUSALS - 1) state = nextMorning(state);
    }
    const house = { ...state, day: DAY + 3 + TRAVELLER_RETURN_DAYS, castle: { ...state.castle, home: 'house' as const } };
    expect(throughNightfall(house).town.traveller).toMatchObject({ name: 'Tomas' });
  });

  it('refuses an answer with no one asking', () => {
    const quiet = hallHome();
    expect(answer(quiet, true)).toEqual({ state: quiet, message: '' });
  });

  it('keeps a neighbour as they are when the house is made home again', () => {
    const stayed = answer(asking(), true).state;
    const back = applyAction(stayed, { type: 'chooseHome', home: 'house' }).state;
    expect(back.town).toEqual(stayed.town);
    expect(throughNightfall(back).town).toEqual(stayed.town);
  });

  it('still asks after the game is saved and loaded mid-ask', () => {
    const storage = new MemoryStorage();
    expect(saveGame(storage, asking()).ok).toBe(true);
    const loaded = loadGame(storage);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;
    expect(travellerAsking(loaded.state)).toBe(true);
    expect(answer(loaded.state, true).message).toBe('Ada will stay.');
  });
});

describe('the morning after', () => {
  it('names the traveller in the morning news', () => {
    const arrived = throughNightfall(hallHome());
    const morning = advanceTime({ ...arrived, timeOfDay: 239.5 }, 1);
    expect(townNews(arrived, morning)).toEqual(['Ada, a lost traveller, came to the hall door at nightfall and slept by the fire.']);
    expect(newsBetween(arrived, morning)).toContain('Ada, a lost traveller, came to the hall door at nightfall and slept by the fire.');
    expect(townNews(morning, advanceTime(morning, 5))).toEqual([]);
  });

  it('writes the first traveller in the journal once', () => {
    const before = { ...hallHome(), timeOfDay: nightStart(DAY) - 1 };
    const arrived = advanceTime(before, 2);
    const written = recordJournal(before, arrived).state;
    expect(written.journal.filter(entry => entry.id.startsWith('traveller'))).toHaveLength(1);
    expect(recordJournal(written, advanceTime(written, 2)).state.journal.filter(entry => entry.id.startsWith('traveller'))).toHaveLength(1);
  });
});

describe('the visitor on the page', () => {
  it('shows the ask with its two answers only while someone is asking', () => {
    expect(visitorView(hallHome()).shown).toBe(false);
    expect(visitorView(asking())).toEqual({ shown: true, copy: 'Ada asks if there is any work. Ada could look after the hens.', yes: 'Offer work', no: 'Not today' });
  });

  const page = () => {
    const elements = {
      '.visitor-panel': { hidden: true, textContent: null, dataset: {} },
      '#visitor-copy': { hidden: false, textContent: null, dataset: {} },
      '#visitor-yes': { hidden: false, textContent: null, dataset: { answer: 'yes' } },
      '#visitor-no': { hidden: false, textContent: null, dataset: { answer: 'no' } }
    } as Record<string, { hidden: boolean; textContent: string | null; dataset: DOMStringMap }>;
    return { elements, root: { querySelector: (selector: string) => elements[selector] ?? null } };
  };

  it('lays out the panel and reads the answers from its buttons', () => {
    const { elements, root } = page();
    renderVisitorPanel(root, visitorView(asking()));
    expect(elements['.visitor-panel'].hidden).toBe(false);
    expect(elements['#visitor-copy'].textContent).toBe('Ada asks if there is any work. Ada could look after the hens.');
    expect(elements['#visitor-yes'].textContent).toBe('Offer work');
    expect(elements['#visitor-no'].textContent).toBe('Not today');
    expect(visitorAction(elements['#visitor-yes'].dataset)).toEqual({ type: 'answerTraveller', yes: true });
    expect(visitorAction(elements['#visitor-no'].dataset)).toEqual({ type: 'answerTraveller', yes: false });
    renderVisitorPanel(root, visitorView(hallHome()));
    expect(elements['.visitor-panel'].hidden).toBe(true);
  });

  it('copes with a page missing its parts', () => {
    expect(() => renderVisitorPanel({ querySelector: () => null }, visitorView(asking()))).not.toThrow();
  });
});

describe('the town in the year journal', () => {
  it('writes a line for each neighbour who stays, even two in one season, and never one twice', () => {
    const first = recordJournal(asking(), answer(asking(), true).state, { type: 'answerTraveller', yes: true }).state;
    const tomas = { name: 'Tomas', job: 'honey' as const, house: null, arrivedDay: DAY + 2 };
    const before = { ...first, day: DAY + 3 };
    const after = { ...before, town: { ...before.town, people: [...before.town.people, tomas], namesUsed: 2 } };
    const both = recordJournal(before, after, { type: 'answerTraveller', yes: true }).state;
    expect(both.journal.filter(entry => entry.id.startsWith('neighbour')).map(entry => entry.name)).toEqual(['Ada', 'Tomas']);
    const again = recordJournal(after, { ...after, town: { ...after.town, people: [...after.town.people] } }).state;
    expect(again.journal.filter(entry => entry.id.startsWith('neighbour'))).toHaveLength(1);
  });


  it('leaves its lines off the page as blanks until they are written', () => {
    const before = journalPageView(hallHome(), currentPage(DAY)).blanks;
    const stayed = recordJournal(asking(), answer(asking(), true).state, { type: 'answerTraveller', yes: true }).state;
    const view = journalPageView(stayed, currentPage(DAY + 1));
    expect(view.entries.map(entry => entry.line)).toContain('Ada is staying on.');
    expect(view.blanks).toBe(before);
  });
});

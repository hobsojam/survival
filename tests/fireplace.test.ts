import { describe, expect, it } from 'vitest';
import { BALANCE, createGame, type GameState } from '../src/game/state';
import { placeBranches } from '../src/game/clearing';
import { advanceTime, applyAction, sleepBlocker, type GameAction } from '../src/game/rules';
import { nightStart } from '../src/game/calendar';
import { cookBlocker, dishBlocker } from '../src/game/cooking';
import { HOUSE_SPOT, fuelLeft, isAtHome, warmFuel } from '../src/game/home';
import { wolvesClose } from '../src/game/wolves';
import { alarmAfter } from '../src/game/companion';
import { stormReadiness } from '../src/game/forecast';
import { recordJournal, type JournalId } from '../src/game/journalEntries';
import { bagView } from '../src/ui/panels';
import { journalPageView, currentPage } from '../src/ui/yearJournal';
import { sceneVisuals } from '../src/scene/visuals';
import { effectVisuals } from '../src/scene/effectVisuals';
import { houseGlow } from '../src/scene/lighting';
import { replayFrame } from '../src/scene/sleepReplay';
import { gatherKeyAction, promptFor } from '../src/scene/prompts';
import { stock } from './stock';

const { campX, campY, daySeconds } = BALANCE;
type Structures = Partial<GameState['structures']>;

const FINISHED_SHELTER: Structures = {
  shelter: true, shelterThatched: true, shelterStonework: true, shelterPorch: true, shelterFinished: true, hearth: true, bed: true
};
const AUTUMN = 6;
const WINTER = 12;

/** A camp past its first cold night with north-far cleared and the given buildings, the survivor standing at the house. */
function camp(structures: Structures, changes: Partial<GameState> = {}): GameState {
  const base = createGame();
  const cleared: GameState['clearing']['cleared'] = ['north-near', 'north-far', 'east-near'];
  const placed = placeBranches(base.nodes, cleared);
  return {
    ...base,
    day: AUTUMN,
    timeOfDay: 50,
    nodes: base.nodes.map((node, i) => ({ ...node, x: placed[i].x, y: placed[i].y })),
    clearing: { cleared, marked: null, felled: [] },
    progress: { ...base.progress, nextStormDay: null, hearthUnlocked: true },
    structures: { ...base.structures, ...structures },
    player: { ...base.player, x: HOUSE_SPOT.x, y: HOUSE_SPOT.y, warmth: 50, hunger: 80, energy: 60 },
    ...changes
  };
}
/** Living in the house, standing at it. */
const housed = (changes: Partial<GameState> = {}, structures: Structures = {}): GameState =>
  camp({ ...FINISHED_SHELTER, house: true, ...structures }, changes);
/** No house, but otherwise the same camp and spot. */
const unhoused = (changes: Partial<GameState> = {}): GameState => camp(FINISHED_SHELTER, changes);
const night = (day = AUTUMN, after = 0): Partial<GameState> => ({ day, timeOfDay: nightStart(day) + after });
const atFire = (state: GameState): GameState => ({ ...state, player: { ...state.player, x: campX, y: campY } });
const act = (state: GameState, action: GameAction) => applyAction(state, action);

describe('where home is', () => {
  it('is by the house once the survivor lives there, and by the campfire before', () => {
    expect(isAtHome(housed())).toBe(true);
    expect(isAtHome(atFire(housed()))).toBe(false);
    expect(isAtHome(housed({ area: 'quarry' }))).toBe(false);
    expect(isAtHome(unhoused())).toBe(false);
    expect(isAtHome(atFire(unhoused()))).toBe(true);
    expect(warmFuel(housed({ fireplaceFuel: 30, fireFuel: 90 }))).toBe(30);
    expect(warmFuel(unhoused({ fireFuel: 90 }))).toBe(90);
  });
});

describe('the fireplace burning', () => {
  it('stays banked in daylight', () => {
    const after = advanceTime(housed({ fireplaceFuel: 80, storedWood: 5 }), 60);
    expect(after.fireplaceFuel).toBe(80);
    expect(after.storedWood).toBe(5);
  });

  it('takes one log from the store at nightfall', () => {
    const after = advanceTime(housed({ ...night(), storedWood: 5, fireplaceFuel: 0 }), 1);
    expect(after.storedWood).toBe(4);
    expect(after.fireplaceFuel).toBeCloseTo(BALANCE.fireplaceSecondsPerWood - 1);
  });

  it('draws logs one at a time through several freezing nights, never from the bag', () => {
    let state = housed({ ...night(WINTER), storedWood: 10, fireplaceFuel: 0, inventory: { ...createGame().inventory, wood: 4 } });
    const drawn: number[] = [];
    let nightSeconds = 0;
    while (state.day < WINTER + 3) {
      if (state.timeOfDay >= nightStart(state.day)) nightSeconds++;
      const next = advanceTime(state, 1);
      drawn.push(state.storedWood - next.storedWood);
      state = next;
    }
    // Each log keeps a freezing night going for fireplaceSecondsPerWood / coldNightFireBurn seconds, and is drawn the moment the last one is spent.
    const logs = Math.ceil(nightSeconds * BALANCE.coldNightFireBurn / BALANCE.fireplaceSecondsPerWood);
    expect(logs).toBeGreaterThanOrEqual(3);
    expect(drawn.every(n => n === 0 || n === 1)).toBe(true);
    expect(drawn.filter(n => n === 1)).toHaveLength(logs);
    expect(state.storedWood).toBe(10 - logs);
    expect(state.inventory.wood).toBe(4);
  });

  it('goes out and stays out when the store is empty', () => {
    const before = housed({ ...night(), storedWood: 0, fireplaceFuel: 30, inventory: { ...createGame().inventory, wood: 3 } });
    const out = advanceTime(before, 40);
    expect(out.fireplaceFuel).toBe(0);
    expect(out.storedWood).toBe(0);
    expect(out.inventory.wood).toBe(3);
    const later = advanceTime(out, daySeconds);
    expect(later.fireplaceFuel).toBe(0);
    expect(later.inventory.wood).toBe(3);
  });

  it('burns fast on a freezing night', () => {
    const after = advanceTime(housed({ ...night(WINTER), storedWood: 5, fireplaceFuel: 100 }), 10);
    expect(after.fireplaceFuel).toBeCloseTo(100 - 10 * BALANCE.coldNightFireBurn);
  });

  it('does nothing without the house', () => {
    const after = advanceTime(unhoused({ ...night(), storedWood: 5 }), 10);
    expect(after.storedWood).toBe(5);
    expect(after.fireplaceFuel).toBe(0);
  });
});

describe('warmth with the house', () => {
  it('rises at home by the fireplace with the campfire unlit', () => {
    const after = advanceTime(housed({ ...night(), fireplaceFuel: 100, fireFuel: 0 }), 2);
    expect(after.player.warmth).toBeCloseTo(51);
  });

  it('falls in the quarry while the fireplace burns on at home', () => {
    const after = advanceTime(housed({ ...night(), area: 'quarry', fireplaceFuel: 1, storedWood: 5, fireFuel: 0 }), 4);
    expect(after.player.warmth).toBeCloseTo(48);
    expect(after.storedWood).toBe(4);
    expect(after.fireplaceFuel).toBeGreaterThan(190);
  });

  it('still rises by a lit campfire at camp', () => {
    const after = advanceTime(atFire(housed({ ...night(), fireFuel: 100, fireplaceFuel: 0, storedWood: 0 })), 2);
    expect(after.player.warmth).toBeCloseTo(51);
  });

  it('keeps the windbreak at home, so a cold house is never colder than the shelter', () => {
    const empty = { ...night(WINTER), fireFuel: 0, fireplaceFuel: 0, storedWood: 0 };
    const rest = daySeconds - nightStart(WINTER) - 1;
    const atHouse = advanceTime(housed(empty, { windbreak: true }), rest);
    const inShelter = advanceTime(atFire(camp({ ...FINISHED_SHELTER, windbreak: true }, empty)), rest);
    expect(atHouse.player.warmth).toBeLessThan(50);
    expect(atHouse.player.warmth).toBeGreaterThanOrEqual(inShelter.player.warmth);
  });

  it('keeps the woodshed roof over camp in a spring shower by day', () => {
    // Day 22's shower runs from 30 s to 76 s.
    const shower = { day: 22, timeOfDay: 30, fireFuel: 0 };
    const withHouse = advanceTime(atFire(housed(shower)), 40);
    const withoutHouse = advanceTime(atFire(unhoused(shower)), 40);
    expect(withHouse.player.warmth).toBeCloseTo(withoutHouse.player.warmth);
    expect(withHouse.player.warmth).toBeCloseTo(54);
  });
});

describe('sleeping and resting at home', () => {
  it('sends the survivor home to sleep and rest', () => {
    const atCamp = atFire(housed(night()));
    expect(sleepBlocker(atCamp)).toBe('Go home to sleep.');
    expect(act(atCamp, { type: 'rest' }).message).toBe('Go home to rest.');
    expect(sleepBlocker(housed(night(), { shelter: false }))).toBeNull();
    expect(act(housed(), { type: 'rest' }).message).toBe('You take a short rest.');
  });

  it('keeps the old words without the house', () => {
    expect(sleepBlocker(unhoused(night()))).toBe('Move closer to the fire to sleep.');
    expect(act(unhoused(), { type: 'rest' }).message).toBe('Move closer to the fire to rest.');
  });

  it('wakes warm with the campfire unlit and the store stocked', () => {
    const before = housed({ ...night(), fireFuel: 0, fireplaceFuel: 0, storedWood: 5 });
    const slept = act(before, { type: 'sleep' });
    expect(slept.message).toBe('You sleep until morning.');
    expect(slept.state.day).toBe(AUTUMN + 1);
    expect(slept.state.player.warmth).toBeGreaterThanOrEqual(50);
  });

  it('says so when the fireplace went out in the night', () => {
    const slept = act(housed({ ...night(), fireFuel: 0, fireplaceFuel: 20, storedWood: 0 }), { type: 'sleep' });
    expect(slept.message).toBe('You sleep until morning. The fireplace went out in the night.');
    // A fireplace that was never lit did not go out, and a campfire left to die is not mentioned.
    expect(act(housed({ ...night(), fireplaceFuel: 0, storedWood: 0 }), { type: 'sleep' }).message).toBe('You sleep until morning.');
    expect(act(housed({ ...night(), fireFuel: 10, storedWood: 5 }), { type: 'sleep' }).message).toBe('You sleep until morning.');
  });
});

describe('cooking at home', () => {
  const food = { inventory: { ...createGame().inventory, food: stock(3) } };
  const pot = (state: GameState): GameState => ({ ...state, progress: { ...state.progress, potCrafted: true } });

  it('sends the survivor home to cook', () => {
    const atCamp = pot(atFire(housed({ ...night(), ...food, fireFuel: 100, fireplaceFuel: 100 })));
    expect(cookBlocker(atCamp)).toBe('Go home to cook.');
    expect(dishBlocker(atCamp, 'salad')).toBe('Go home to cook.');
  });

  it('needs the fireplace lit', () => {
    const cold = pot(housed({ ...night(), ...food, fireFuel: 100, fireplaceFuel: 0 }));
    expect(cookBlocker(cold)).toBe('The fireplace is out. Stock the wood store.');
    expect(dishBlocker(cold, 'salad')).toBe('The fireplace is out. Stock the wood store.');
  });

  it('cooks by the fireplace with the campfire out', () => {
    const lit = pot(housed({ ...night(), ...food, fireFuel: 0, fireplaceFuel: 100 }));
    expect(cookBlocker(lit)).toBeNull();
    expect(dishBlocker(lit, 'berries')).toBeNull();
  });

  it('still cooks between logs while the store holds wood', () => {
    const between = pot(housed({ ...night(), ...food, fireFuel: 0, fireplaceFuel: 0, storedWood: 3 }));
    expect(cookBlocker(between)).toBeNull();
    expect(dishBlocker(between, 'berries')).toBeNull();
  });
});

describe('wolves and the house', () => {
  const ration = { inventory: { ...createGame().inventory, food: stock(0, 1) } };

  it('come when the fireplace is out, whatever the campfire does', () => {
    const before = atFire(housed({ ...night(WINTER), ...ration, fireplaceFuel: 0, storedWood: 0, fireFuel: 100 }));
    expect(wolvesClose(before)).toBe(true);
    const after = advanceTime(before, 1);
    expect(after.lastWolf).toEqual({ day: WINTER, took: 'ration' });
  });

  it('stay away while the fireplace burns', () => {
    const before = housed({ ...night(WINTER), ...ration, fireplaceFuel: 100, storedWood: 0, fireFuel: 0 });
    expect(wolvesClose(before)).toBe(false);
    expect(advanceTime(before, 5).lastWolf).toBeNull();
  });

  it('stay away between logs while the store holds wood', () => {
    const before = housed({ ...night(WINTER), ...ration, fireplaceFuel: 5, storedWood: 3, fireFuel: 0 });
    expect(wolvesClose(before)).toBe(false);
    expect(advanceTime(before, 10).lastWolf).toBeNull();
  });
});

describe('the bird and the forecast with the house', () => {
  it('counts the logs in store as fuel still to come', () => {
    const state = housed({ ...night(WINTER), fireplaceFuel: 10, storedWood: 3 });
    expect(fuelLeft(state)).toBe(10 + 3 * BALANCE.fireplaceSecondsPerWood);
    expect(fuelLeft(unhoused({ fireFuel: 40, storedWood: 3 }))).toBe(40);
  });

  const bird = (state: GameState): GameState => ({ ...state, companion: { ...state.companion, friend: 'bird' } });

  it('lets the bird sleep on while the store holds wood', () => {
    expect(alarmAfter(bird(housed({ ...night(WINTER), fireplaceFuel: 30, storedWood: 5 })))).toBeGreaterThan(daySeconds);
    expect(alarmAfter(bird(housed({ ...night(WINTER), fireplaceFuel: 30, storedWood: 0 })))).toBeCloseTo(5);
  });

  it('has the bird wake the sleeper to the fireplace, not the fire', () => {
    const woken = act(bird(housed({ ...night(WINTER), fireplaceFuel: 30, storedWood: 0 })), { type: 'sleep' });
    expect(woken.message).toBe('Your bird woke you. The fireplace is nearly out.');
    expect(woken.state.day).toBe(WINTER);
  });

  it('reads the fireplace and the wood store for the cold night', () => {
    const state = housed({ day: AUTUMN, timeOfDay: 50, fireplaceFuel: 20, storedWood: 1,
      progress: { ...createGame().progress, nextStormDay: AUTUMN, hearthUnlocked: false } });
    expect(stormReadiness(state).fuel).toBe(20 + BALANCE.fireplaceSecondsPerWood);
  });
});

describe('the cold night in the house', () => {
  it('is weathered at home with the fireplace burning', () => {
    const before = housed({ ...night(), fireFuel: 0, fireplaceFuel: 0, storedWood: 5, player: { ...housed().player, warmth: 80 },
      progress: { ...createGame().progress, nextStormDay: AUTUMN, hearthUnlocked: false } });
    const after = advanceTime(before, daySeconds - before.timeOfDay);
    expect(after.day).toBe(AUTUMN + 1);
    expect(after.progress.hearthUnlocked).toBe(true);
  });
});

describe('the fire status line', () => {
  it('tells of the fireplace and the wood store', () => {
    expect(bagView(housed({ storedWood: 9, fireplaceFuel: 40 })).fire).toBe('The fireplace is banked · 9 logs in store');
    expect(bagView(housed({ ...night(), storedWood: 9, fireplaceFuel: 40 })).fire).toBe('The fireplace is burning · 9 logs in store');
    expect(bagView(housed({ ...night(), storedWood: 2, fireplaceFuel: 40 })).fire).toBe('Wood is running low · 2 logs in store');
    expect(bagView(housed({ ...night(), storedWood: 0, fireplaceFuel: 0 })).fire).toBe('The fireplace is out. Stock the wood store.');
  });

  it('is unchanged without the house', () => {
    expect(bagView(unhoused({ fireFuel: 40, storedWood: 9 })).fire).toBe('Fire burning · 40s of warmth');
    expect(bagView(unhoused({ ...night(), fireFuel: 0 })).fire).toBe('The fire is unlit');
  });
});

describe('the journal by the fireplace', () => {
  const ids = (state: GameState): JournalId[] => state.journal.map(entry => entry.id);
  const sleep = (state: GameState) => recordJournal(state, act(state, { type: 'sleep' }).state, { type: 'sleep' }).state;

  it('writes an autumn night by the fireplace', () => {
    const slept = recordJournal(housed({ ...night(), storedWood: 5 }), act(housed({ ...night(), storedWood: 5 }), { type: 'sleep' }).state, { type: 'sleep' });
    expect(ids(slept.state)).toContain('fireside');
    expect(slept.messages).toContain('Written in your journal: A night by the fireplace, the door shut against the wind.');
    expect(ids(sleep(housed({ ...night(), storedWood: 0, fireplaceFuel: 10 })))).not.toContain('fireside');
    expect(ids(sleep(atFire(unhoused({ ...night(), fireFuel: 200 }))))).not.toContain('fireside');
  });

  it('keeps a winter night by the fireplace', () => {
    const winter = { ...night(WINTER), storedWood: 5 };
    expect(ids(sleep(housed(winter)))).toContain('winterFire');
  });

  it('leaves the fireside line off the page until the survivor lives in the house', () => {
    expect(journalPageView(unhoused(), currentPage(AUTUMN)).blanks).toBe(6);
    expect(journalPageView(housed(), currentPage(AUTUMN)).blanks).toBe(7);
  });
});

describe('the house by night', () => {
  const house = (state: GameState) => sceneVisuals(state, 0).find(visual => visual.id === 'house')?.texture;
  const chimney = (state: GameState) => effectVisuals(state, 0, []).filter(visual => visual.id.startsWith('chimney:'));

  it('lights its window, smokes and glows while the fireplace burns at night', () => {
    const lit = housed({ ...night(), fireplaceFuel: 50 });
    expect(house(lit)).toBe('house:lit');
    expect(chimney(lit).length).toBeGreaterThan(0);
    expect(houseGlow(lit)).not.toBeNull();
  });

  it('stays lit between logs while the store holds wood', () => {
    const between = housed({ ...night(), fireplaceFuel: 0, storedWood: 3 });
    expect(house(between)).toBe('house:lit');
    expect(chimney(between).length).toBeGreaterThan(0);
    expect(houseGlow(between)).not.toBeNull();
  });

  it('stays dark by day and once the fire is out', () => {
    for (const dark of [housed({ fireplaceFuel: 50 }), housed({ ...night(), fireplaceFuel: 0 }), housed({ ...night(), fireplaceFuel: 50, area: 'quarry' })]) {
      expect(chimney(dark)).toEqual([]);
      expect(houseGlow(dark)).toBeNull();
    }
    expect(house(housed({ fireplaceFuel: 50 }))).toBe('house:dark');
    expect(house(housed({ ...night(), fireplaceFuel: 0 }))).toBe('house:dark');
  });

  it('replays the fireplace through the cold night', () => {
    const before = housed({ ...night(), fireplaceFuel: 10, storedWood: 2,
      progress: { ...createGame().progress, nextStormDay: AUTUMN, hearthUnlocked: false } });
    const after = act(before, { type: 'sleep' }).state;
    const halfway = replayFrame(before, after, 2250);
    expect(halfway.fireplaceFuel).toBeGreaterThan(0);
    expect(halfway.storedWood).toBe(1);
    expect(replayFrame(unhoused(), unhoused(), 0).fireplaceFuel).toBe(0);
  });
});

describe('the prompts at home', () => {
  it('rests and sleeps at home, and feeds the campfire at camp', () => {
    expect(gatherKeyAction({ ...housed(), nodes: [] })).toEqual({ type: 'rest' });
    expect(gatherKeyAction({ ...atFire(housed()), nodes: [] })).toBeUndefined();
    expect(promptFor({ ...housed(night()), nodes: [] })).toContain('Z Sleep');
    const camp = promptFor({ ...atFire(housed(night())), nodes: [] });
    expect(camp).toContain('F Fire');
    expect(camp).not.toContain('Z Sleep');
    expect(camp).not.toContain('R Rest');
  });
});

describe('the fireplace at nightfall', () => {
  it('warms from the first night step when it has a log to draw', () => {
    const after = advanceTime(housed({ ...night(), fireplaceFuel: 0, storedWood: 5, fireFuel: 0 }), 2);
    expect(after.player.warmth).toBeCloseTo(51);
  });

  it('notes an autumn night kept warm at home, even lying down before the first log is drawn', () => {
    const before = housed({ ...night(), fireplaceFuel: 0, storedWood: 5 });
    const slept = recordJournal(before, applyAction(before, { type: 'sleep' }).state, { type: 'sleep' });
    expect(slept.state.journal.find(entry => entry.id === 'coldFront')?.variant).toBe(2);
  });
});

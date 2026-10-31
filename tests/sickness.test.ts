import { describe, expect, it } from 'vitest';
import { nightStart } from '../src/game/calendar';
import { addFood } from '../src/game/food';
import { HOUSE_SPOT } from '../src/game/home';
import { newsBetween } from '../src/game/news';
import { advanceTime, applyAction } from '../src/game/rules';
import { loadGame, saveGame, SAVE_KEY } from '../src/game/save';
import { upgradeSave } from '../src/game/saveUpgrades';
import { ENDED_MESSAGE, isSick, isWarmRestHere, judgeSickDay } from '../src/game/sickness';
import { BALANCE, createGame, type GameState } from '../src/game/state';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
}

const WINTER_DAY = 12;
const WELL = { starvedSeconds: 0, sick: false, sickFromDay: null, cared: 0, uncared: 0, ateWarm: false, restedWarm: false };
type Sickness = GameState['sickness'];

/** A winter camp with the shelter up, standing at the fire, with an empty stomach unless told otherwise. */
function winter(changes: Partial<GameState> = {}, player: Partial<GameState['player']> = {}): GameState {
  const base = createGame();
  return {
    ...base,
    day: WINTER_DAY,
    timeOfDay: 20,
    progress: { ...base.progress, nextStormDay: null, hearthUnlocked: true },
    structures: { ...base.structures, shelter: true },
    player: { ...base.player, x: BALANCE.campX, y: BALANCE.campY, hunger: 0, energy: 60, warmth: 60, ...player },
    ...changes
  };
}
const sick = (sickness: Partial<Sickness> = {}, changes: Partial<GameState> = {}, player: Partial<GameState['player']> = {}): GameState =>
  winter({ sickness: { ...WELL, sick: true, sickFromDay: WINTER_DAY - 1, ...sickness }, ...changes }, player);

describe('falling sick', () => {
  it('sickens after a whole day at zero hunger, and not a second before', () => {
    const start = winter({ timeOfDay: 0 });
    expect(createGame().sickness).toEqual(WELL);
    expect(createGame().ending).toBeNull();
    expect(advanceTime(start, BALANCE.starvedSecondsToSicken - 1, 'resting').sickness.sick).toBe(false);
    const ill = advanceTime(start, BALANCE.starvedSecondsToSicken, 'resting');
    expect(ill.sickness).toMatchObject({ sick: true, sickFromDay: WINTER_DAY });
    expect(isSick(ill)).toBe(true);
  });

  it('starts counting again once there is any food in the stomach', () => {
    const counted = advanceTime(winter(), 200, 'resting');
    expect(counted.sickness.starvedSeconds).toBe(200);
    expect(advanceTime({ ...counted, player: { ...counted.player, hunger: 30 } }, 1, 'resting').sickness.starvedSeconds).toBe(0);
  });

  it('says so, plainly', () => {
    const before = advanceTime(winter(), BALANCE.starvedSecondsToSicken - 1, 'resting');
    const after = advanceTime(before, 1, 'resting');
    expect(newsBetween(before, after)).toContain("You've gone too long without food, and you're falling ill.");
    expect(newsBetween(after, advanceTime(after, 1, 'resting'))).not.toContain("You've gone too long without food, and you're falling ill.");
  });

  it('drains energy and warmth on top of everything else', () => {
    const fed = { hunger: 80 };
    const well = advanceTime(winter({}, fed), 10, 'resting');
    const ill = advanceTime(sick({}, {}, fed), 10, 'resting');
    expect(well.player.energy - ill.player.energy).toBeCloseTo(10 * BALANCE.sickEnergyDrainPerSecond);
    expect(well.player.warmth - ill.player.warmth).toBeCloseTo(10 * BALANCE.sickWarmthDrainPerSecond);
  });

  it("isn't cured by eating", () => {
    const state = sick({}, { inventory: { ...createGame().inventory, food: addFood(createGame().inventory.food, 'berry', 1, WINTER_DAY) } });
    const ate = applyAction(state, { type: 'eat', item: 'berry' }).state;
    expect(ate.player.hunger).toBeGreaterThan(0);
    expect(ate.sickness.sick).toBe(true);
  });
});

describe('judging a sick day at dawn', () => {
  const judged = (sickness: Partial<Sickness>): GameState => {
    const next = structuredClone(sick(sickness));
    judgeSickDay(next, WINTER_DAY);
    return next;
  };

  it('counts a day with a warm meal and a warm rest as cared for, and any other as not, then starts the next day afresh', () => {
    expect(judged({ ateWarm: true, restedWarm: true }).sickness).toMatchObject({ cared: 1, uncared: 0, ateWarm: false, restedWarm: false });
    expect(judged({ ateWarm: true }).sickness).toMatchObject({ cared: 0, uncared: 1, ateWarm: false });
    expect(judged({ restedWarm: true }).sickness).toMatchObject({ cared: 0, uncared: 1, restedWarm: false });
  });

  it('makes the survivor well after two cared-for days, and ends the run after three uncared-for ones', () => {
    expect(judged({ cared: 1, ateWarm: true, restedWarm: true }).sickness).toEqual(WELL);
    const ended = judged({ uncared: 2 });
    expect(ended.ending).toEqual({ day: WINTER_DAY });
    expect(judged({ cared: 1, uncared: 2, ateWarm: true, restedWarm: true }).sickness).toEqual(WELL);
    expect(judged({ cared: 1, uncared: 2 }).ending).toEqual({ day: WINTER_DAY });
  });

  it("doesn't judge the day the sickness began", () => {
    const next = structuredClone(sick({ sickFromDay: WINTER_DAY }));
    judgeSickDay(next, WINTER_DAY);
    expect(next.sickness).toMatchObject({ cared: 0, uncared: 0, sick: true });
  });

  it('judges nothing for a well survivor', () => {
    const next = structuredClone(winter());
    judgeSickDay(next, WINTER_DAY);
    expect(next.sickness).toEqual(WELL);
  });
});

describe('warm food and warm rest', () => {
  const night = (changes: Partial<GameState> = {}): GameState => sick({}, { timeOfDay: nightStart(WINTER_DAY) + 1, fireFuel: 200, ...changes }, { hunger: 40 });

  it('counts a dish cooked at the fire, but not raw food or nuts roasted for later', () => {
    const food = addFood(addFood(createGame().inventory.food, 'berry', 2, WINTER_DAY), 'hazelnut', 2, WINTER_DAY);
    const stocked = night({ inventory: { ...createGame().inventory, food }, progress: { ...night().progress, potCrafted: true } });
    expect(applyAction(stocked, { type: 'cook', dish: 'berries' }).state.sickness.ateWarm).toBe(true);
    expect(applyAction(stocked, { type: 'eat', item: 'berry' }).state.sickness.ateWarm).toBe(false);
    expect(applyAction(stocked, { type: 'cook', dish: 'roastedHazelnuts' }).state.sickness.ateWarm).toBe(false);
  });

  it('counts pine needle tea as warm', () => {
    const food = addFood(createGame().inventory.food, 'pineNeedles', 1, WINTER_DAY);
    const state = night({ inventory: { ...createGame().inventory, food }, progress: { ...night().progress, potCrafted: true } });
    expect(applyAction(state, { type: 'cook', dish: 'pineTea' }).state.sickness.ateWarm).toBe(true);
  });

  it('counts a rest by a burning fire, but not by a cold one', () => {
    expect(applyAction(winter({ fireFuel: 100, sickness: { ...WELL, sick: true, sickFromDay: 1 } }), { type: 'rest' }).state.sickness.restedWarm).toBe(true);
    expect(applyAction(winter({ fireFuel: 0, sickness: { ...WELL, sick: true, sickFromDay: 1 } }), { type: 'rest' }).state.sickness.restedWarm).toBe(false);
  });

  it('counts the house as warm while its fireplace has fuel', () => {
    const base = createGame();
    const house = { ...base.structures, shelter: true, shelterThatched: true, shelterStonework: true, shelterPorch: true, shelterFinished: true, bed: true, house: true };
    const home = winter({ structures: house, fireplaceFuel: 100, clearing: { cleared: ['north-near', 'north-far'], marked: null, felled: [] } },
      { x: HOUSE_SPOT.x, y: HOUSE_SPOT.y });
    expect(isWarmRestHere(home)).toBe(true);
    expect(isWarmRestHere({ ...home, fireplaceFuel: 0, storedWood: 0 })).toBe(false);
    expect(isWarmRestHere({ ...home, player: { ...home.player, x: BALANCE.campX - 8, y: BALANCE.campY + 8 } })).toBe(false);
  });
});

describe('the end of the run', () => {
  it('comes to a starving survivor left alone in winter: not within three days, but within five', () => {
    const alone = winter({ timeOfDay: 0 });
    expect(advanceTime(alone, 3 * BALANCE.daySeconds, 'resting').ending).toBeNull();
    expect(advanceTime(alone, 5 * BALANCE.daySeconds, 'resting').ending).not.toBeNull();
  });

  it('can come in the night, and then nothing more happens', () => {
    const lastNight = sick({ uncared: 2 }, { timeOfDay: nightStart(WINTER_DAY) + 1, fireFuel: 0 });
    const slept = applyAction(lastNight, { type: 'sleep' });
    expect(slept.state.ending).toEqual({ day: WINTER_DAY });
    expect(slept.message).toBe('Your strength gave out in the night.');
    for (const action of [{ type: 'rest' }, { type: 'stokeFire' }, { type: 'move', dx: 1, dy: 0 }] as const) {
      expect(applyAction(slept.state, action)).toEqual({ state: slept.state, message: ENDED_MESSAGE });
    }
    expect(ENDED_MESSAGE).toBe('Your story has ended.');
    expect(advanceTime(slept.state, 100)).toBe(slept.state);
  });
});

describe('saving sickness', () => {
  it('brings a version 23 save in well, with no ending', () => {
    const { sickness: _s, ending: _e, ...old } = createGame();
    const upgraded = upgradeSave(23, old);
    expect(upgraded.ok && (upgraded.state as GameState).sickness).toEqual(WELL);
    expect(upgraded.ok && (upgraded.state as GameState).ending).toBeNull();
  });

  it('keeps a sickness through a save, and refuses a broken one', () => {
    const storage = new MemoryStorage();
    const state = sick({ cared: 1, uncared: 1, starvedSeconds: 0 });
    expect(saveGame(storage, state).ok).toBe(true);
    const loaded = loadGame(storage);
    expect(loaded.kind === 'loaded' && loaded.state.sickness).toEqual(state.sickness);
    expect(saveGame(storage, sick({ uncared: -1 })).ok).toBe(false);
    expect(saveGame(storage, sick({ cared: 2 })).ok).toBe(false);
  });

  it('removes the save once the run has ended, so the camp never comes back', () => {
    const storage = new MemoryStorage();
    expect(saveGame(storage, winter()).ok).toBe(true);
    expect(saveGame(storage, { ...sick(), ending: { day: WINTER_DAY } })).toEqual({ ok: true });
    expect(storage.getItem(SAVE_KEY)).toBeNull();
    expect(loadGame(storage)).toEqual({ kind: 'empty' });
  });
});

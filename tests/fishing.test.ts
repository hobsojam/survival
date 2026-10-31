import { describe, expect, it } from 'vitest';
import { nightStart } from '../src/game/calendar';
import { addFood, availableFood, eatEffect, emptyFood, quickEatItem } from '../src/game/food';
import { fishingBlocker, fishingLineBlocker, fishingSecondsFor, springAction, withFishing } from '../src/game/fishing';
import { applyAction, type GameAction } from '../src/game/rules';
import { loadGame, saveGame } from '../src/game/save';
import { upgradeSave } from '../src/game/saveUpgrades';
import { sitePrompt } from '../src/game/sitePrompt';
import { BALANCE, SITES, createGame, type GameState } from '../src/game/state';
import { fishingLineView } from '../src/ui/panels';

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
const SPRING = SITES.spring;
const CATCH = 'You break the ice and wait. A fish takes the line.';
const MISS = 'You wait by the hole in the ice, but nothing bites.';

/** A winter camp with the shelter up, standing at the fire with some wood and fiber, well fed unless told otherwise. */
function winter(changes: Partial<GameState> = {}, player: Partial<GameState['player']> = {}): GameState {
  const base = createGame();
  return {
    ...base,
    day: WINTER_DAY,
    timeOfDay: 20,
    progress: { ...base.progress, nextStormDay: null, hearthUnlocked: true },
    structures: { ...base.structures, shelter: true },
    inventory: { ...base.inventory, wood: 4, fiber: 2 },
    player: { ...base.player, x: BALANCE.campX, y: BALANCE.campY, ...player },
    ...changes
  };
}
const withLine = (state: GameState): GameState => ({ ...state, progress: { ...state.progress, fishingLine: true } });
const atSpring = (state: GameState): GameState => ({ ...state, player: { ...state.player, x: SPRING.x, y: SPRING.y } });
const weak = { energy: 0, hunger: 0, warmth: 15 };
const sickness = { starvedSeconds: 300, sick: true, sickFromDay: WINTER_DAY - 1, cared: 0, uncared: 0, ateWarm: false, restedWarm: false };
const fishIn = (state: GameState): number => availableFood(state, 'fish');

describe('the fishing line', () => {
  it('is made in the clearing for a wood and a fiber', () => {
    const made = applyAction(winter(), { type: 'makeFishingLine' });
    expect(made.message).toBe('You twist fiber into a line and tie it to a stick.');
    expect(made.state.progress.fishingLine).toBe(true);
    expect(made.state.inventory).toMatchObject({ wood: 3, fiber: 1 });
    expect(createGame().progress.fishingLine).toBe(false);
  });

  it('says why it cannot be made, in order', () => {
    expect(fishingLineBlocker(withLine(winter()))).toBe('You already have a fishing line.');
    expect(fishingLineBlocker(atSpring(winter()))).toBe('Return to camp to make the fishing line.');
    expect(fishingLineBlocker(winter({ inventory: { ...createGame().inventory, wood: 1 } }))).toBe('Need 1 wood and 1 fiber for a fishing line.');
    expect(fishingLineBlocker(winter())).toBeNull();
  });

  it('is still made by a survivor who is exhausted, starving and sick', () => {
    expect(applyAction(winter({ sickness }, weak), { type: 'makeFishingLine' }).state.progress.fishingLine).toBe(true);
  });

  it('shows in the Forest tools panel', () => {
    expect(fishingLineView(winter())).toMatchObject({ title: 'Fishing line', cost: '1 wood · 1 fiber', disabled: false, ready: true });
    expect(fishingLineView(withLine(winter()))).toMatchObject({ cost: 'Made', disabled: true, ready: false });
  });
});

describe('fishing through the ice', () => {
  it('says why it cannot fish, in order', () => {
    expect(fishingBlocker(withLine(atSpring(winter({ area: 'quarry' }))))).toBe('There is nothing like that here.');
    expect(fishingBlocker(withLine(winter()))).toBe('Walk to the quiet spring to fish.');
    expect(fishingBlocker(withLine(atSpring(winter({ day: 25 }))))).toBe('The spring only freezes in winter.');
    expect(fishingBlocker(atSpring(winter()))).toBe('Make a fishing line first.');
    expect(fishingBlocker(withLine(atSpring(winter({ inventory: { ...createGame().inventory, wood: 6, fiber: 2 } }))))).toBe('Make room in your bag for a fish.');
    expect(fishingBlocker(withLine(atSpring(winter())))).toBeNull();
  });

  it('is never refused for weakness', () => {
    expect(fishingBlocker(withLine(atSpring(winter({ sickness }, weak))))).toBeNull();
    expect(fishIn(applyAction(withLine(atSpring(winter({ sickness }, weak))), { type: 'fish', roll: 0.9 }).state)).toBe(1);
  });

  it('catches a fish, or comes up empty, by the roll', () => {
    const ready = withLine(atSpring(winter()));
    const caught = applyAction(ready, { type: 'fish', roll: 0.5 });
    expect(caught.message).toBe(CATCH);
    expect(fishIn(caught.state)).toBe(1);
    expect(caught.state.fishingMisses).toBe(0);
    const missed = applyAction(ready, { type: 'fish', roll: 0.1 });
    expect(missed.message).toBe(MISS);
    expect(fishIn(missed.state)).toBe(0);
    expect(missed.state.fishingMisses).toBe(1);
  });

  it('never comes up empty more than twice in a row', () => {
    let state = withLine(atSpring(winter()));
    const messages: string[] = [];
    for (let go = 0; go < 3; go++) {
      const result = applyAction(state, { type: 'fish', roll: 0 });
      messages.push(result.message);
      state = result.state;
    }
    expect(messages).toEqual([MISS, MISS, CATCH]);
    expect(state.fishingMisses).toBe(0);
  });

  it('refuses a roll that is not a chance', () => {
    const ready = withLine(atSpring(winter()));
    for (const roll of [-0.1, 1, Number.NaN]) expect(applyAction(ready, { type: 'fish', roll })).toEqual({ state: ready, message: 'That action is not available yet.' });
  });

  it('takes longer when the survivor is weak', () => {
    expect(fishingSecondsFor(winter())).toBe(BALANCE.fishingSeconds);
    expect(fishingSecondsFor(winter({}, { hunger: 10 }))).toBe(BALANCE.fishingSeconds * BALANCE.fishingWeakFactor);
    expect(fishingSecondsFor(winter({ sickness }))).toBe(BALANCE.fishingSeconds * BALANCE.fishingWeakFactor);
    const ready = withLine(atSpring(winter()));
    expect(applyAction(ready, { type: 'fish', roll: 0.5 }).state.timeOfDay).toBeCloseTo(ready.timeOfDay + BALANCE.fishingSeconds);
  });

  it('fishes at the frozen spring with V or a tap, and still explores it otherwise', () => {
    const visit: GameAction = { type: 'visitSite', siteId: 'spring' };
    expect(springAction(withLine(winter()), 0.4)).toEqual({ type: 'fish', roll: 0.4 });
    expect(springAction(winter(), 0.4)).toEqual(visit);
    expect(springAction(withLine(winter({ day: 25 })), 0.4)).toEqual(visit);
    expect(withFishing(withLine(winter()), visit, 0.4)).toEqual({ type: 'fish', roll: 0.4 });
    expect(withFishing(withLine(winter()), { type: 'rest' }, 0.4)).toEqual({ type: 'rest' });
    expect(withFishing(withLine(winter()), { type: 'visitSite', siteId: 'cairn' }, 0.4)).toEqual({ type: 'visitSite', siteId: 'cairn' });
  });

  it('prompts and hints at fishing at the frozen spring', () => {
    const discovered = (state: GameState): GameState => ({ ...state, progress: { ...state.progress, discoveries: { ...state.progress.discoveries, spring: true } } });
    expect(sitePrompt(withLine(discovered(winter())), 'spring')).toBe('V  Fish through the ice');
    expect(sitePrompt(discovered(winter()), 'spring')).toBe('V  Explore quiet spring');
    expect(applyAction(atSpring(winter()), { type: 'visitSite', siteId: 'spring' }).message)
      .toBe('The spring is frozen over. With a fishing line, you could fish through the ice.');
  });
});

describe('eating fish', () => {
  const night = (food = addFood(emptyFood(), 'fish', 1, WINTER_DAY)): GameState =>
    winter({ timeOfDay: nightStart(WINTER_DAY) + 1, fireFuel: 200, sickness, inventory: { ...createGame().inventory, food } }, { hunger: 20 });

  it('barely helps raw, and Q never picks it', () => {
    expect(eatEffect('fish').hunger).toBe(10);
    expect(applyAction(night(), { type: 'eat', item: 'fish' }).state.player.hunger).toBe(30);
    expect(quickEatItem(night())).toBeNull();
  });

  it('is a warm, filling meal cooked at the fire, with no pot and no berry', () => {
    const cooked = applyAction(night(), { type: 'cook' });
    expect(cooked.message).toBe('You cook the fish over the fire. A warm, filling meal.');
    // The few seconds at the fire burn a little hunger before the meal lands.
    expect(cooked.state.player.hunger).toBeCloseTo(20 - BALANCE.cookSeconds / 8 + BALANCE.cookedFishHunger);
    expect(cooked.state.sickness.ateWarm).toBe(true);
    expect(fishIn(cooked.state)).toBe(0);
    expect(applyAction(night(emptyFood()), { type: 'cook', dish: 'fish' }).message).toBe('You need 1 fish for a fish.');
    expect(applyAction({ ...night(), timeOfDay: 30 }, { type: 'cook', dish: 'fish' }).message).toBe('Cook after nightfall.');
  });
});

describe('saving fishing', () => {
  it('keeps the line, the misses and the fish', () => {
    const storage = new MemoryStorage();
    const state = { ...withLine(winter({ inventory: { ...createGame().inventory, food: addFood(emptyFood(), 'fish', 2, WINTER_DAY) } })), fishingMisses: 2 };
    expect(saveGame(storage, state).ok).toBe(true);
    const loaded = loadGame(storage);
    expect(loaded.kind === 'loaded' && loaded.state).toMatchObject({ fishingMisses: 2, progress: { fishingLine: true }, inventory: { food: { fish: 2 } } });
    expect(saveGame(storage, { ...state, fishingMisses: 3 }).ok).toBe(false);
  });

  it('brings a version 23 save in with no line and no fish', () => {
    const game = createGame();
    const { fish: _bag, ...bagFood } = game.inventory.food;
    const { fish: _larder, ...larderFood } = game.larder;
    const { fishingLine: _line, ...progress } = game.progress;
    const { fishingMisses: _misses, sickness: _s, ending: _e, ...rest } = game;
    const old = { ...rest, progress, inventory: { ...game.inventory, food: bagFood }, larder: larderFood };
    const upgraded = upgradeSave(23, old);
    expect(upgraded.ok && upgraded.state).toMatchObject({ fishingMisses: 0, progress: { fishingLine: false }, inventory: { food: { fish: 0 } }, larder: { fish: 0 } });
  });
});

describe('the rescue from rock bottom', () => {
  /** Walks in straight steps to a spot, the way a player would. */
  function walkTo(state: GameState, x: number, y: number): GameState {
    let walked = state;
    for (let step = 0; step < 200 && Math.hypot(walked.player.x - x, walked.player.y - y) > 0.3; step++) {
      const dx = x - walked.player.x, dy = y - walked.player.y;
      const away = Math.hypot(dx, dy);
      walked = applyAction(walked, { type: 'move', dx: dx / away * Math.min(1, away), dy: dy / away * Math.min(1, away) }).state;
    }
    return walked;
  }
  const act = (state: GameState, action: GameAction): GameState => {
    const result = applyAction(state, action);
    expect(result.state, `${action.type}: ${result.message}`).not.toBe(state);
    return result.state;
  };

  /** Walks to the nearest branches and picks them up, a wood at a time. */
  function gatherWood(start: GameState, wood: number): GameState {
    let state = start;
    for (let picked = 0; picked < wood; picked++) {
      const here = state;
      const branch = here.nodes.filter(node => node.kind === 'branch' && node.amount > 0)
        .sort((a, b) => Math.hypot(a.x - here.player.x, a.y - here.player.y) - Math.hypot(b.x - here.player.x, b.y - here.player.y))[0];
      state = act(walkTo(state, branch.x, branch.y), { type: 'gather', nodeId: branch.id });
    }
    return state;
  }

  /** One hard winter day: out to the spring, fish until a catch, home, keep the fire, cook it after dark, sleep by the fire. */
  function day(start: GameState, rolls: number[]): GameState {
    let state = walkTo(start, SPRING.x, SPRING.y);
    for (const roll of rolls) state = act(state, { type: 'fish', roll });
    state = walkTo(state, BALANCE.campX, BALANCE.campY);
    state = act(state, { type: 'stokeFire' });
    while (state.timeOfDay < nightStart(state.day)) state = act(state, { type: 'rest' });
    if (state.fireFuel <= 0) state = act(state, { type: 'stokeFire' });
    state = act(state, { type: 'cook', dish: 'fish' });
    if (state.fireFuel <= 0) state = act(state, { type: 'stokeFire' });
    return act(state, { type: 'sleep' });
  }

  it('brings a sick, exhausted, starving survivor back to health in two days', () => {
    const bottom = winter({ sickness, timeOfDay: 0, inventory: { ...createGame().inventory, wood: 6, fiber: 2 } }, weak);
    const lined = act(bottom, { type: 'makeFishingLine' });
    const first = day(lined, [0, 0, 0]);
    expect(first.ending).toBeNull();
    expect(first.sickness).toMatchObject({ sick: true, cared: 1, uncared: 0 });
    const second = day(gatherWood(first, 2), [0.9]);
    expect(second.ending).toBeNull();
    expect(second.sickness.sick).toBe(false);
  });
});

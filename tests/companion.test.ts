import { describe, expect, it } from 'vitest';
import { nightStart } from '../src/game/calendar';
import { BALANCE, createGame, type Friend, type GameState } from '../src/game/state';
import { advanceTime, applyAction } from '../src/game/rules';
import { KEEPSAKE_SPOT, findDue, offerBlocker, offerFor, sceneryKeepsake } from '../src/game/companion';
import { newsBetween } from '../src/game/news';
import { FOX, foxAt } from '../src/game/wildlife';
import { wolfMessage } from '../src/game/wolves';
import { stock } from './stock';

const base = createGame();
/** Beside the berry bush at (19, 13), inside the camp ring, with the cold night long behind. */
const camp = (day: number, timeOfDay: number, inventory: Partial<GameState['inventory']> = {}): GameState => ({
  ...base, day, timeOfDay,
  player: { ...base.player, x: 19, y: 14 },
  inventory: { ...base.inventory, ...inventory },
  structures: { ...base.structures, shelter: true },
  progress: { ...base.progress, hearthUnlocked: true, nextStormDay: null }
});
const offer = (state: GameState) => applyAction(state, { type: 'befriend' });
/** The same state on another day at the same time, keeping its companion. */
const later = (state: GameState, day: number): GameState => ({ ...state, day });

describe('befriending', () => {
  it('offers a berry to the birds by a bush on a spring day', () => {
    const spring = camp(22, 60, { food: stock(1) });
    expect(offerFor(spring)).toBe('bird');
    expect(offerBlocker(spring)).toBeNull();
    const result = offer(spring);
    expect(result.state.inventory.food.berry.length).toBe(0);
    expect(result.state.companion.trust.bird).toBe(1);
    expect(result.message).toBe('The birds peck at the berry. One lingers a moment longer.');
    const again = { ...result.state, inventory: { ...result.state.inventory, food: stock(1) } };
    expect(offerFor(again)).toBeNull();
    expect(offerBlocker(again)).toBe('You have already left something out today.');
    expect(offerFor(camp(12, 60, { food: stock(1) }))).toBeNull();
  });

  it('befriends the bird on the fifth day', () => {
    let state = camp(22, 60, { food: stock(5) });
    let message = '';
    for (const day of [22, 23, 24, 25, 26]) ({ state, message } = offer(later(state, day)));
    expect(state.companion).toMatchObject({ friend: 'bird', since: 26 });
    expect(message).toBe('A little bird has decided to stay.');
    const stocked = { ...state, inventory: { ...state.inventory, food: stock(2, 1) } };
    expect(offerFor(later(stocked, 27))).toBeNull();
    expect(offerFor({ ...later(stocked, 1), timeOfDay: nightStart(1) - 5 })).toBeNull();
    expect(offerFor({ ...later(stocked, 12), timeOfDay: nightStart(12) + 5 })).toBeNull();
  });

  it('lets the fox take precedence when both could be offered', () => {
    const dusk = camp(1, nightStart(1) - 5, { food: stock(1) });
    expect(foxAt(1, dusk.timeOfDay)?.nibbling).toBe(true);
    expect(offerFor(dusk)).toBe('fox');
    const result = offer(dusk);
    expect(result.state.companion.trust).toEqual({ bird: 0, fox: 1, wolf: 0 });
    expect(result.message).toBe('The fox takes the berry, and watches you a while.');
  });

  it('leaves an offering on ground the clearing has grown over', () => {
    const night = { ...camp(12, nightStart(12) + 5, { food: stock(0, 1) }), player: { ...base.player, x: 20, y: 9.5 }, fireFuel: 100 };
    expect(offerFor(night)).toBeNull();
    const grown = { ...night, clearing: { ...night.clearing, cleared: ['north-near' as const] } };
    expect(offerFor(grown)).toBe('wolf');
  });

  it('leaves a ration for the wolves on any winter night, fire lit or not', () => {
    const night = { ...camp(12, nightStart(12) + 5, { food: stock(0, 1) }), player: { ...base.player, x: 20, y: 16 }, fireFuel: 100 };
    expect(offerFor(night)).toBe('wolf');
    const result = offer(night);
    expect(result.state.inventory.food.trailFood).toBe(0);
    expect(result.state.lastWolf).toEqual({ day: 12, took: 'offered' });
    expect(result.message).toBe('Something takes the ration from the edge of the firelight.');
    expect(wolfMessage(night, result.state)).toBeNull();
    const dark = advanceTime({ ...result.state, fireFuel: 0, inventory: { ...result.state.inventory, food: stock(2) } }, 2);
    expect(dark.inventory.food.berry.length).toBe(2);
    expect(dark.lastWolf).toEqual({ day: 12, took: 'offered' });
  });

  it('never offers from the quarry or with nothing to give', () => {
    const spring = camp(22, 60, { food: stock(1) });
    expect(offerFor({ ...spring, area: 'quarry' })).toBeNull();
    expect(offerFor({ ...spring, inventory: base.inventory })).toBeNull();
    expect(offerFor({ ...spring, player: { ...spring.player, x: 5, y: 25 } })).toBeNull();
    expect(offerBlocker({ ...spring, inventory: base.inventory })).toBe('Nothing here wants an offering right now.');
    const refused = offer({ ...spring, inventory: base.inventory });
    expect(refused.state.companion.trust.bird).toBe(0);
  });

  it('decides finds by the day, at most every third dawn', () => {
    expect(findDue(5, 4, 0)).toBe(false);
    expect(findDue(6, 4, 0)).toBe(false);
    const due = Array.from({ length: 400 }, (_, i) => findDue(i + 4, i + 1, 0)).filter(Boolean).length;
    expect(due / 400).toBeGreaterThan(0.4);
    expect(due / 400).toBeLessThan(0.6);
    expect(Array.from({ length: 50 }, (_, i) => findDue(i + 9, i, 50))).toEqual(Array.from({ length: 50 }, (_, i) => findDue(i + 9, i, 50)));
  });
});

/** A friend that came long ago, at camp with the shelter and toolshed built. */
const withFriend = (friend: Friend, changes: Partial<GameState['companion']> = {}, state: GameState = camp(5, 60)): GameState => ({
  ...state,
  structures: { ...state.structures, toolshed: true },
  companion: { ...state.companion, friend, since: 1, trust: { ...state.companion.trust, [friend]: 3 }, ...changes }
});
/** The first day from `from` on whose dawn a find of this kind is due, three dawns after the last. */
const dueDay = (salt: number, from = 42) => Array.from({ length: 60 }, (_, i) => from + i).find(day => findDue(day, day - 3, salt))!;
/** Ticks across the dawn into `day`, with the fire well fed. */
const dawnInto = (state: GameState, day: number) => {
  const before = { ...state, day: day - 1, timeOfDay: BALANCE.daySeconds - 0.5, fireFuel: 100 };
  const after = advanceTime(before, 1);
  return { after, news: newsBetween(before, after) };
};

describe('what a friend does', () => {
  it('chases the wild wolves off when the fire goes out', () => {
    const night = withFriend('wolf', {}, { ...camp(12, nightStart(12) + 5, { food: stock(1, 1) }), fireFuel: 1 });
    const after = advanceTime(night, 2);
    expect(after.inventory.food).toMatchObject({ trailFood: 1, berry: [1] });
    expect(after.lastWolf).toEqual({ day: 12, took: 'chased' });
    expect(newsBetween(night, after)).toContain('Your wolf saw the others off into the dark.');
  });

  it('wakes the sleeper once when the fire burns low on a winter night', () => {
    const night = withFriend('bird', {}, { ...camp(12, nightStart(12) + 5), player: { ...base.player, x: 20, y: 16 }, fireFuel: 60 });
    const woken = applyAction(night, { type: 'sleep' });
    expect(woken.message).toBe('Your bird woke you. The fire is nearly out.');
    expect(woken.state.day).toBe(12);
    expect(woken.state.fireFuel).toBeCloseTo(20);
    expect(woken.state.companion.alarmDay).toBe(12);
    expect(applyAction(woken.state, { type: 'sleep' }).state.day).toBe(13);
    const low = applyAction({ ...night, fireFuel: 10 }, { type: 'sleep' });
    expect([low.state.day, low.message]).toEqual([12, 'Your bird woke you. The fire is nearly out.']);
    expect(applyAction({ ...night, fireFuel: 0 }, { type: 'sleep' }).state.day).toBe(13);
  });

  it('brings a berry on a find dawn, and waits when the bag is full', () => {
    const day = dueDay(50);
    const fox = withFriend('fox', { lastGift: day - 3, lastFind: day });
    const { after, news } = dawnInto(fox, day);
    expect(after.inventory.food.berry.length).toBe(1);
    expect(after.companion.lastGift).toBe(day);
    expect(news).toContain('The fox left a berry by your bedroll.');
    const full = dawnInto({ ...fox, inventory: { ...fox.inventory, wood: 8 } }, day).after;
    expect([full.inventory.food.berry.length, full.companion.lastGift]).toEqual([0, day - 3]);
    expect(dawnInto(withFriend('wolf', { lastGift: day - 3, lastFind: day }), day).after.inventory.food.berry.length).toBe(0);
    const away = dawnInto({ ...fox, area: 'quarry', player: { ...fox.player, x: 20, y: 15 } }, day).after;
    expect([away.inventory.food.berry.length, away.companion.lastGift]).toEqual([0, day - 3]);
  });

  it('sheds one piece at a time, only while it is needed', () => {
    const day = dueDay(71);
    const { after, news } = dawnInto(withFriend('fox', { lastFind: day - 3 }), day);
    expect(after.companion).toMatchObject({ keepsakeLying: true, lastFind: day });
    expect(news).toContain('A tuft of fur lies by the fire.');
    expect(dawnInto(withFriend('fox', { lastFind: day - 3, keepsakeLying: true }), day).after.companion.lastFind).toBe(day - 3);
    expect(dawnInto(withFriend('fox', { lastFind: day - 3, keepsakes: 6 }), day).after.companion.keepsakeLying).toBe(false);
    const made = dawnInto(withFriend('fox', { lastFind: day - 3, cloak: true }), day).after;
    expect(made.companion.keepsakeLying).toBe(false);
    expect(sceneryKeepsake(made)).toBe(true);
    expect(sceneryKeepsake({ ...made, day: day + 1 })).toBe(false);
  });

  it('picks a keepsake up by the fire', () => {
    const lying = withFriend('bird', { keepsakeLying: true, keepsakes: 2 }, { ...camp(5, 60), player: { ...base.player, x: KEEPSAKE_SPOT.x + 0.5, y: KEEPSAKE_SPOT.y } });
    const moved = applyAction(lying, { type: 'move', dx: -0.1, dy: 0 }).state;
    expect(moved.companion).toMatchObject({ keepsakes: 3, keepsakeLying: false });
    expect(newsBetween(lying, moved)).toContain('You found a feather by the fire.');
    const far = { ...lying, player: { ...lying.player, x: KEEPSAKE_SPOT.x + 3 } };
    expect(applyAction(far, { type: 'move', dx: -0.1, dy: 0 }).state.companion.keepsakes).toBe(2);
  });

  it('makes a fur cloak and keeps warmer at night', () => {
    const fox = withFriend('fox', { keepsakes: 6 });
    const made = applyAction(fox, { type: 'craftCloak' });
    expect(made.state.companion).toMatchObject({ cloak: true, keepsakes: 0 });
    expect(applyAction(withFriend('fox', { keepsakes: 5 }), { type: 'craftCloak' }).message).toBe('Need 6 fur for the cloak.');
    const outdoors = { ...camp(5, nightStart(5) + 5), player: { ...base.player, x: 30, y: 25 }, fireFuel: 0 };
    const lost = (state: GameState) => 100 - advanceTime({ ...state, player: { ...state.player, warmth: 100 } }, 8).player.warmth;
    const cloaked = { ...outdoors, companion: made.state.companion };
    expect(lost(cloaked)).toBeCloseTo(lost(outdoors) * 0.75);
    const quarry = { ...outdoors, area: 'quarry' as const, player: { ...outdoors.player, x: 20, y: 15 } };
    expect(lost({ ...quarry, companion: made.state.companion })).toBeCloseTo(lost(quarry) * 0.75);
    expect(lost({ ...cloaked, timeOfDay: 60 })).toBe(lost({ ...outdoors, timeOfDay: 60 }));
  });

  it('makes a feather pillow that rests deeper', () => {
    const bird = withFriend('bird', { keepsakes: 6 });
    expect(applyAction(bird, { type: 'craftPillow' }).message).toBe('Build a bed first.');
    const bed = { ...bird, structures: { ...bird.structures, bed: true } };
    const made = applyAction(bed, { type: 'craftPillow' }).state;
    expect(made.companion).toMatchObject({ pillow: true, keepsakes: 0 });
    const rested = (state: GameState) => applyAction({ ...state, player: { ...state.player, energy: 30 } }, { type: 'rest' }).state.player.energy;
    expect(rested(made) - rested(bed)).toBeCloseTo(10);
    const hungry = (state: GameState) => applyAction({ ...state, timeOfDay: nightStart(5) + 5, player: { ...state.player, x: 20, y: 16, energy: 10, hunger: 10 } }, { type: 'sleep' }).state;
    expect(hungry(bed).player.energy).toBeLessThanOrEqual(BALANCE.hungrySleepCap);
    expect(hungry(made).player.energy).toBeGreaterThan(BALANCE.hungrySleepCap);
    expect(hungry(made).player.energy).toBeLessThanOrEqual(BALANCE.hungrySleepCap + 10);
  });
});

describe('a startled fox', () => {
  it('runs off for the evening when the survivor comes too close, and takes nothing', () => {
    const time = nightStart(1) - 5;
    const fox = foxAt(1, time)!;
    const close = { ...camp(1, time, { food: stock(1) }), player: { ...base.player, x: fox.x + 1, y: fox.y + 0.5 } };
    const startled = advanceTime(close, 0.1);
    expect(startled.companion.foxFled).toBe(1);
    expect(offerFor({ ...startled, player: { ...base.player, x: 21, y: 16 } })).toBeNull();
    expect(offerFor(camp(1, time, { food: stock(1) }))).toBe('fox');
  });

  it('lets the survivor come a little closer once it trusts them', () => {
    const time = nightStart(1) - 5;
    const fox = foxAt(1, time)!;
    const near = { ...camp(1, time, { food: stock(1) }), player: { ...base.player, x: fox.x + 1.5, y: fox.y } };
    expect(advanceTime(near, 0.1).companion.foxFled).toBe(1);
    const trusting = { ...near, companion: { ...near.companion, trust: { bird: 0, fox: 1, wolf: 0 } } };
    expect(advanceTime(trusting, 0.1).companion.foxFled).toBe(0);
    expect(FOX.spookRadius).toBeGreaterThan(1.5);
  });
});

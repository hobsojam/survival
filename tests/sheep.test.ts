import { describe, expect, it } from 'vitest';
import { BALANCE, createGame, type GameState } from '../src/game/state';
import { nightStart } from '../src/game/calendar';
import { TOO_TIRED_MESSAGE } from '../src/game/needs';
import { newsBetween } from '../src/game/news';
import { advanceTime, applyAction, buildStatus } from '../src/game/rules';
import { threshedField } from '../src/game/field';
import { wellSickness } from '../src/game/sickness';
import { feedBlocker, shearBlocker, sheepStage } from '../src/game/sheep';

const ARRIVAL_NOTE = 'Three sheep were in the pen this morning. They seem to have decided something.';

/** A camp with the pen built, standing at the fire on `day`, in the morning. */
function penCamp(sheep: Partial<GameState['sheep']> = {}, changes: Partial<GameState> = {}, straw = 3, day = 1): GameState {
  const base = createGame();
  return {
    ...base,
    day,
    timeOfDay: 30,
    player: { ...base.player, x: BALANCE.campX, y: BALANCE.campY },
    clearing: { cleared: ['east-near', 'east-far', 'east-outer', 'south-near', 'south-far'], marked: null, felled: [] },
    structures: { ...base.structures, shelter: true, field: true, sheepPen: true },
    field: { ...base.field, straw },
    sheep: { ...base.sheep, ...sheep },
    ...changes
  };
}
const toNextDawn = (state: GameState): GameState => advanceTime(state, BALANCE.daySeconds - state.timeOfDay + 1, 'resting');
const dawns = (state: GameState, count: number): GameState => Array.from({ length: count }).reduce<GameState>(toNextDawn, state);

describe('straw from threshing', () => {
  const threshing = (grain: number, straw: number) => {
    const state = penCamp({}, {}, straw);
    return threshedField({ ...state, field: { ...state.field, grain, strips: state.field.strips.map((strip, i) => i === 0 ? { sownDay: 1, cut: true } : strip) } }, 0).field.straw;
  };

  it('leaves two straw a strip', () => {
    expect(threshing(0, 0)).toBe(BALANCE.strawPerStrip);
  });

  it('still leaves straw when the granary is full', () => {
    expect(threshing(BALANCE.granaryCapacity, 0)).toBe(2);
  });

  it('stops at twelve straw without refusing the threshing', () => {
    expect(threshing(0, 11)).toBe(12);
    expect(threshing(0, 12)).toBe(12);
  });
});

describe('how the flock looks', () => {
  it.each([[0, 'shorn'], [39, 'shorn'], [40, 'woolly'], [119, 'woolly'], [120, 'round'], [199, 'round'], [200, 'cloud']] as const)('at %i fluff it is %s', (fluff, stage) => {
    expect(sheepStage(fluff)).toBe(stage);
  });
});

describe('putting out feed', () => {
  it('needs the pen, the clearing and straw', () => {
    const base = createGame();
    expect(feedBlocker(base)).toBe('Build the sheep pen first.');
    const away = penCamp();
    expect(feedBlocker({ ...away, player: { ...away.player, x: 1, y: 28 } })).toBe('Return to camp to feed the sheep.');
    expect(feedBlocker(penCamp({}, {}, 0))).toBe('There is no straw. Thresh a strip of the field.');
    expect(feedBlocker(penCamp())).toBeNull();
  });

  it('works while exhausted, like gathering by hand', () => {
    const state = penCamp();
    expect(feedBlocker({ ...state, player: { ...state.player, energy: 1 } })).toBeNull();
    expect(TOO_TIRED_MESSAGE).not.toBe(feedBlocker({ ...state, player: { ...state.player, energy: 1 } }));
  });

  it('works from the meadow itself', () => {
    const state = penCamp();
    expect(feedBlocker({ ...state, player: { ...state.player, x: 34, y: 4 } })).toBeNull();
  });

  it('spends a straw, lasts three dawns and takes a gather\'s time and energy', () => {
    const state = penCamp();
    const { state: fed, message } = applyAction(state, { type: 'feedSheep' });
    expect(fed.field.straw).toBe(2);
    expect(fed.sheep.fedUntil).toBe(4);
    expect(fed.timeOfDay).toBeCloseTo(state.timeOfDay + BALANCE.gatherSeconds);
    expect(fed.player.energy).toBeLessThan(state.player.energy);
    expect(message).toContain('feed');
  });

  it('refuses a second feed while the first lasts, and allows one on its last day', () => {
    expect(feedBlocker(penCamp({ arrived: true, fluff: 40, fedUntil: 4 }, { day: 3 }))).toBe('The sheep still have plenty.');
    expect(feedBlocker(penCamp({ arrived: true, fluff: 40, fedUntil: 4 }, { day: 4 }))).toBeNull();
  });
});

describe('the strays arrive', () => {
  const fed = () => applyAction(penCamp(), { type: 'feedSheep' }).state;

  it('are there at the first dawn after a feed, woolly enough to shear, and say so once', () => {
    const before = fed();
    const after = toNextDawn(before);
    expect(after.sheep).toMatchObject({ arrived: true, fluff: 40 });
    expect(newsBetween(before, after)).toContain(ARRIVAL_NOTE);
    expect(newsBetween(after, toNextDawn(after))).not.toContain(ARRIVAL_NOTE);
  });

  it('do not come with no feed out', () => {
    expect(dawns(penCamp(), 3).sheep.arrived).toBe(false);
  });

  it('are noticed by a survivor who slept through the dawn', () => {
    const put = fed();
    const before = { ...put, timeOfDay: nightStart(put.day) + 5, fireFuel: 300, player: { ...put.player, energy: 50 } };
    const after = applyAction(before, { type: 'sleep' }).state;
    expect(after.day).toBe(before.day + 1);
    expect(after.sheep.arrived).toBe(true);
    expect(newsBetween(before, after)).toContain(ARRIVAL_NOTE);
  });
});

describe('fluff', () => {
  const flock = (fluff: number, fedUntil: number) => penCamp({ arrived: true, fluff, fedUntil }, { day: 5 });

  it('grows by two each dawn the feed lasts', () => {
    expect(toNextDawn(flock(50, 6)).sheep.fluff).toBe(52);
  });

  it('grows by one when they only graze, and costs nothing else', () => {
    // Fed each day, so the survivor outlasts the hundred dawns: an empty stomach would end the run first.
    const after = Array.from({ length: 100 }).reduce<GameState>(state => toNextDawn({ ...state, player: { ...state.player, hunger: 100, warmth: 100, energy: 100 }, sickness: wellSickness() }), flock(50, 1));
    expect(after.sheep.fluff).toBe(150);
    expect(after.sheep).toMatchObject({ arrived: true, wool: 0 });
  });

  it('stops at the cloud', () => {
    expect(toNextDawn(flock(200, 6)).sheep.fluff).toBe(200);
    expect(toNextDawn(flock(199, 6)).sheep.fluff).toBe(200);
  });
});

describe('shearing', () => {
  /** A woolly flock, with the shears, on a morning of `day`. The year opens in autumn, so day 21 is its first spring. */
  const ready = (sheep: Partial<GameState['sheep']> = {}, day = 21): GameState => {
    const state = penCamp({ arrived: true, fluff: 40, fedUntil: 1, ...sheep }, { day });
    return { ...state, progress: { ...state.progress, workshop: { ...state.progress.workshop, shears: true } } };
  };
  const shear = (state: GameState) => applyAction(state, { type: 'shearFlock' });

  it('gives each reason it has to wait, in order', () => {
    const noSheep = penCamp();
    expect(shearBlocker(noSheep)).toBe('The pen is empty.');
    expect(shearBlocker(penCamp({ arrived: true, fluff: 40, fedUntil: 1 }, { day: 21 }))).toBe('Make shears at the workshop first.');
    expect(shearBlocker(ready({}, 11))).toBe('Shearing waits for spring.');
    expect(shearBlocker(ready({ lastShornYear: 1 }))).toBe('The flock has been sheared this year.');
    expect(shearBlocker(ready({ fluff: 39 }))).toBe("There isn't enough wool to shear yet.");
    const state = ready();
    expect(shearBlocker({ ...state, player: { ...state.player, x: 1, y: 28 } })).toBe('Return to camp to shear the flock.');
    expect(shearBlocker({ ...state, player: { ...state.player, energy: 0 } })).toBe(TOO_TIRED_MESSAGE);
    expect(shearBlocker(state)).toBeNull();
  });

  it('allows a shearing the spring after the last one', () => {
    expect(shearBlocker(ready({ lastShornYear: 1 }, 61))).toBeNull();
  });

  it('takes a field job, leaves them bare and fills the basket', () => {
    const state = ready();
    const { state: after, message } = shear(state);
    expect(after.timeOfDay).toBeCloseTo(state.timeOfDay + BALANCE.fieldWorkSeconds);
    expect(state.player.energy - after.player.energy).toBeCloseTo(BALANCE.fieldWorkEnergy, 0);
    expect(after.sheep).toMatchObject({ fluff: 0, lastShornYear: 1, wool: 4 });
    expect(sheepStage(after.sheep.fluff)).toBe('shorn');
    expect(message).toBe('You sheared the flock. Four wool went into the basket.');
  });

  it('gets the same wool from a cloud as from a woolly flock', () => {
    expect(shear(ready({ fluff: 200 })).state.sheep.wool).toBe(4);
    expect(shear(ready({ fluff: 40 })).state.sheep.wool).toBe(4);
  });

  it('loses what the basket can\'t hold, and says so', () => {
    const { state, message } = shear(ready({ wool: 6, lastShornYear: 0 }));
    expect(state.sheep.wool).toBe(8);
    expect(message).toBe('You sheared the flock. The basket is full, so the rest of the wool was lost.');
  });

  it('still shears with a full basket', () => {
    const { state, message } = shear(ready({ wool: 8, lastShornYear: 0 }));
    expect(state.sheep).toMatchObject({ wool: 8, fluff: 0, lastShornYear: 1 });
    expect(message).toContain('the rest of the wool was lost');
  });

  it('brings the loom into the build list', () => {
    const state = ready();
    expect(buildStatus(state, 'loom')).toBe('locked');
    expect(buildStatus(shear(state).state, 'loom')).not.toBe('locked');
  });
});

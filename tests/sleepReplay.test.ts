import { describe, expect, it } from 'vitest';
import { nightStart } from '../src/game/calendar';
import { BALANCE, createGame, type GameState } from '../src/game/state';
import { NightWatch, SLEEP_REPLAY_MS, SleepReplay, replayFrame, replaysSleep } from '../src/scene/sleepReplay';

const base = createGame();
const night: GameState = { ...base, day: 3, timeOfDay: nightStart(3) + 10, fireFuel: 120,
  progress: { ...base.progress, nextStormDay: 3 }, player: { ...base.player, warmth: 90 } };
const dawn: GameState = { ...night, day: 4, timeOfDay: 0, fireFuel: 30,
  progress: { ...night.progress, nextStormDay: null, hearthUnlocked: true }, player: { ...night.player, warmth: 60 } };

describe('sleeping through the cold night', () => {
  it('plays out only a sleep through the cold night', () => {
    expect(replaysSleep(night, dawn, { type: 'sleep' })).toBe(true);
    expect(replaysSleep(night, dawn, { type: 'rest' })).toBe(false);
    const ordinary = { ...night, progress: { ...night.progress, nextStormDay: 6 } };
    expect(replaysSleep(ordinary, { ...dawn, progress: ordinary.progress }, { type: 'sleep' })).toBe(false);
    // A refused sleep changes nothing, so there is no night to show.
    expect(replaysSleep(night, night, { type: 'sleep' })).toBe(false);
  });

  it('runs the night on quickly, still on the cold night, with the fire burning down', () => {
    const start = replayFrame(night, dawn, 0);
    expect(start.timeOfDay).toBe(night.timeOfDay);
    const middle = replayFrame(night, dawn, SLEEP_REPLAY_MS / 2);
    const left = BALANCE.daySeconds - night.timeOfDay;
    expect(middle.day).toBe(3);
    expect(middle.timeOfDay).toBeCloseTo(night.timeOfDay + left / 2);
    expect(middle.fireFuel).toBeCloseTo(120 - left / 2 * BALANCE.coldNightFireBurn);
    expect(middle.player.warmth).toBeCloseTo(75);
    const end = replayFrame(night, dawn, SLEEP_REPLAY_MS * 2);
    expect(end.day).toBe(3);
    expect(end.timeOfDay).toBeLessThan(BALANCE.daySeconds);
    expect(end.timeOfDay).toBeGreaterThan(BALANCE.daySeconds - 0.01);
  });

  it('lets the fire go out partway when there was too little wood', () => {
    const short = { ...night, fireFuel: 20 };
    expect(replayFrame(short, { ...dawn, fireFuel: 0 }, SLEEP_REPLAY_MS).fireFuel).toBe(0);
  });
});

describe('a sleep replay playing out', () => {
  it('shows the night frame by frame, then hands over the real morning and its journal lines once', () => {
    const replay = new SleepReplay(night, dawn, ['Written in your journal: a line.'], 1000);
    const middle = replay.step(1000 + SLEEP_REPLAY_MS / 2);
    expect(middle.done).toBe(false);
    expect(middle.messages).toEqual([]);
    expect(middle.state.timeOfDay).toBeGreaterThan(night.timeOfDay);
    const morning = replay.step(1000 + SLEEP_REPLAY_MS);
    expect(morning).toEqual({ state: dawn, messages: ['Written in your journal: a line.'], done: true });
  });
});

describe('the scene\'s night watch', () => {
  const morning = { state: dawn, messages: ['A page for the journal.'] };
  const tick = { state: { ...night, timeOfDay: night.timeOfDay + 1 }, messages: [] };

  it('lets the ordinary tick run until a sleep through the cold night begins', () => {
    const watch = new NightWatch();
    expect(watch.tick(0, () => tick)).toBe(tick);
    expect(watch.begin(night, { state: night, messages: [] }, { type: 'sleep' }, 0)).toBe(false);
    expect(watch.running).toBe(false);
  });

  it('plays the night out in place of the tick, then hands over the morning and its journal', () => {
    const watch = new NightWatch();
    expect(watch.begin(night, morning, { type: 'sleep' }, 1000)).toBe(true);
    expect(watch.running).toBe(true);
    const during = watch.tick(1000 + SLEEP_REPLAY_MS / 2, () => tick);
    expect(during.state.day).toBe(3);
    expect(during.messages).toEqual([]);
    expect(watch.tick(1000 + SLEEP_REPLAY_MS, () => tick)).toEqual(morning);
    expect(watch.running).toBe(false);
    expect(watch.tick(1000 + SLEEP_REPLAY_MS + 16, () => tick)).toBe(tick);
  });

  it('starts the sunrise when the fire held, and asks for frost when it did not', () => {
    const watch = new NightWatch();
    expect(watch.sunriseAgeMs(500)).toBe(Infinity);
    expect(watch.dawn(night, dawn, 2000)).toBe(false);
    expect(watch.sunriseAgeMs(2500)).toBe(500);
    const failed = { ...dawn, progress: { ...dawn.progress, hearthUnlocked: false, nextStormDay: 6 } };
    expect(new NightWatch().dawn(night, failed, 2000)).toBe(true);
    expect(new NightWatch().dawn(dawn, dawn, 2000)).toBe(false);
  });
});

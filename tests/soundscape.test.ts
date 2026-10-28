import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nightStart } from '../src/game/calendar';
import { BALANCE, createGame, type GameState } from '../src/game/state';
import { Soundscape } from '../src/game/soundscape';

/** An AudioParam that remembers the last value it was sent, however it was sent. */
function param() {
  const p = {
    value: 0,
    setValueAtTime: (value: number) => { p.value = value; },
    linearRampToValueAtTime: (value: number) => { p.value = value; },
    exponentialRampToValueAtTime: (value: number) => { p.value = value; },
    setTargetAtTime: (value: number) => { p.value = value; },
    cancelScheduledValues: () => undefined
  };
  return p;
}

/** Just enough of an AudioContext to build the soundscape, counting what it creates. */
class FakeAudioContext {
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  currentTime = 0;
  sampleRate = 100;
  destination = {};
  gains: ReturnType<FakeAudioContext['node']>[] = [];
  created: Record<string, number> = {};
  closed = false;

  private node(kind: string) {
    this.created[kind] = (this.created[kind] ?? 0) + 1;
    const node = { kind, type: '', buffer: null as unknown, gain: param(), frequency: param(), detune: param(), Q: param(), pan: param(),
      connect: (next: unknown) => next, start: () => undefined, stop: () => undefined };
    return node;
  }

  createGain() { const gain = this.node('gain'); this.gains.push(gain); return gain; }
  createOscillator() { return this.node('oscillator'); }
  createBiquadFilter() { return this.node('filter'); }
  createStereoPanner() { return this.node('panner'); }
  createBufferSource() { return this.node('bufferSource'); }
  createBuffer(_channels: number, length: number) { return { getChannelData: () => new Float32Array(length) }; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  close() { this.closed = true; this.state = 'closed'; return Promise.resolve(); }
}

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const saved = new Map(Object.entries(initial));
  return { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => { saved.set(key, value); } } as Storage;
}

function setup(storage = memoryStorage()) {
  const context = new FakeAudioContext();
  const sound = new Soundscape(storage, () => context as unknown as AudioContext);
  // The layers are created in order: master, birds, crickets, fire, quarry, wolves, rain.
  const layer = (index: number) => context.gains[index].gain.value;
  return { context, sound, storage, master: () => layer(0), birds: () => layer(1), crickets: () => layer(2), fire: () => layer(3), quarry: () => layer(4), wolves: () => layer(5), rain: () => layer(6) };
}

function world(changes: Partial<GameState> = {}): GameState {
  const state = createGame();
  return { ...state, player: { ...state.player, x: BALANCE.campX, y: BALANCE.campY }, fireFuel: 30, ...changes };
}

const night = nightStart(1) + 10;

describe('the soundscape', () => {
  it('starts the audio at the master volume, or silent when muted last time', () => {
    const playing = setup();
    playing.sound.start();
    expect(playing.master()).toBeCloseTo(0.34);
    expect(playing.context.state).toBe('running');
    const muted = setup(memoryStorage({ 'hearthwild.sound-muted': 'true' }));
    muted.sound.start();
    expect([muted.master(), muted.sound.isMuted, muted.context.state]).toEqual([0, true, 'suspended']);
  });

  it('plays birds and the fire by day at camp, and crickets at night', () => {
    const { sound, birds, crickets, fire, quarry } = setup();
    sound.update(world());
    sound.start();
    expect([birds(), crickets(), quarry()]).toEqual([0.48, 0, 0]);
    expect(fire()).toBeCloseTo(0.55);
    sound.update(world({ timeOfDay: night, fireFuel: 0 }));
    expect([birds(), crickets(), fire()]).toEqual([0, 0.34, 0]);
  });

  it('lets a friendly bird sing at spring dawns and stay through winter', () => {
    const { sound, birds } = setup();
    sound.start();
    const bird = { ...createGame().companion, friend: 'bird' as const, since: 1 };
    sound.update(world({ day: 22, timeOfDay: 10, companion: bird }));
    expect(birds()).toBe(0.8);
    sound.update(world({ day: 22, timeOfDay: 10 }));
    expect(birds()).toBe(0.48);
    sound.update(world({ day: 22, timeOfDay: 60, companion: bird }));
    expect(birds()).toBe(0.48);
    sound.update(world({ day: 12, timeOfDay: 60, companion: bird }));
    expect(birds()).toBe(0.16);
    sound.update(world({ day: 12, timeOfDay: 60 }));
    expect(birds()).toBe(0);
  });

  it('quietens the birds and adds the stone drone in the quarry', () => {
    const { sound, birds, crickets, fire, quarry } = setup();
    sound.start();
    sound.update(world({ area: 'quarry' }));
    expect([birds(), fire(), quarry()]).toEqual([0.16, 0, 0.48]);
    sound.update(world({ area: 'quarry', timeOfDay: night }));
    expect([birds(), crickets(), quarry()]).toEqual([0, 0.22, 0.72]);
  });

  it('lets the wolves howl near a dying fire on winter nights, and silences winter birds', () => {
    const { sound, birds, crickets, wolves } = setup();
    sound.start();
    const weathered = { ...createGame().progress, hearthUnlocked: true, nextStormDay: null };
    const winterNight = world({ day: 12, timeOfDay: nightStart(12) + 10, fireFuel: 0, progress: weathered });
    sound.update(winterNight);
    expect(wolves()).toBeCloseTo(0.5);
    sound.update({ ...winterNight, fireFuel: 30 });
    expect(wolves()).toBe(0);
    sound.update({ ...winterNight, area: 'quarry' });
    expect(wolves()).toBe(0);
    sound.update(world({ day: 8, timeOfDay: nightStart(8) + 10, fireFuel: 0, progress: weathered }));
    expect(wolves()).toBe(0);
    sound.update(world({ day: 12, timeOfDay: 30, progress: weathered }));
    expect(birds()).toBe(0);
    sound.update(winterNight);
    expect(crickets()).toBe(0);
  });

  it('plays the rain while a shower falls, wherever the survivor is', () => {
    const { sound, rain } = setup();
    sound.start();
    sound.update(world({ day: 22, timeOfDay: 40 }));
    expect(rain()).toBeCloseTo(0.35);
    sound.update(world({ day: 22, timeOfDay: 40, area: 'quarry' }));
    expect(rain()).toBeCloseTo(0.35);
    sound.update(world({ day: 22, timeOfDay: 80 }));
    expect(rain()).toBe(0);
  });

  it('mutes and unmutes, and remembers the choice', () => {
    const { sound, master, storage } = setup();
    sound.start();
    sound.toggle();
    expect([sound.isMuted, master(), storage.getItem('hearthwild.sound-muted')]).toEqual([true, 0, 'true']);
    sound.toggle();
    expect(master()).toBeCloseTo(0.34);
    expect(storage.getItem('hearthwild.sound-muted')).toBe('false');
  });

  it('plays a short chime for gathering and building, but not while muted or before audio runs', () => {
    const { sound, context } = setup();
    sound.playCue('gather');
    expect(context.created.oscillator ?? 0).toBe(0);
    sound.start();
    const drone = context.created.oscillator;
    sound.playCue('gather');
    sound.playCue('build');
    expect(context.created.oscillator - drone).toBe(5);
    sound.toggle();
    sound.playCue('build');
    expect(context.created.oscillator - drone).toBe(5);
  });

  it('suspends while paused and ignores resume requests until unpaused', () => {
    const { sound, context } = setup();
    sound.start();
    sound.setPaused(true);
    expect(context.state).toBe('suspended');
    sound.resume();
    expect(context.state).toBe('suspended');
    sound.setPaused(false);
    expect(context.state).toBe('running');
  });

  it('keeps going without audio when the browser has none', () => {
    const sound = new Soundscape(undefined, () => undefined);
    expect(() => { sound.start(); sound.update(world()); sound.playCue('build'); sound.toggle(); }).not.toThrow();
  });

  it('gives up cleanly if building the audio fails, and can try again later', () => {
    let attempts = 0;
    const context = new FakeAudioContext();
    const sound = new Soundscape(undefined, () => {
      attempts += 1;
      if (attempts === 1) throw new Error('no audio device');
      return context as unknown as AudioContext;
    });
    expect(() => sound.start()).not.toThrow();
    sound.start();
    expect([attempts, context.state]).toEqual([2, 'running']);
  });
});

describe('ambient sounds over time', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('sings birds by day and crickets by night', () => {
    const { sound, context } = setup();
    sound.update(world({ fireFuel: 0 }));
    sound.start();
    const before = context.created.oscillator;
    vi.advanceTimersByTime(6000);
    expect(context.created.panner).toBeGreaterThan(0);
    sound.update(world({ timeOfDay: night, fireFuel: 0 }));
    const panners = context.created.panner;
    vi.advanceTimersByTime(7200);
    expect(context.created.panner).toBe(panners);
    expect(context.created.oscillator).toBeGreaterThan(before);
  });

  it('crackles while the fire burns at camp, and moans in the quarry', () => {
    const { sound, context } = setup();
    sound.update(world());
    sound.start();
    vi.advanceTimersByTime(500);
    expect(context.created.bufferSource).toBeGreaterThan(0);
    sound.update(world({ area: 'quarry' }));
    const crackles = context.created.bufferSource;
    const filters = context.created.filter;
    vi.advanceTimersByTime(18000);
    expect(context.created.bufferSource).toBe(crackles);
    expect(context.created.filter).toBeGreaterThan(filters);
  });

  it('stays silent over time while muted', () => {
    const { sound, context } = setup();
    sound.update(world());
    sound.start();
    sound.toggle();
    const created = { ...context.created };
    vi.advanceTimersByTime(20000);
    expect(context.created).toEqual(created);
  });
});

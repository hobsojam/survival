import { BALANCE, type GameState } from './state';

const MUTE_KEY = 'hearthwild.sound-muted';
const MASTER_VOLUME = 0.34;

export type SoundCue = 'gather' | 'build';

export class Soundscape {
  private context?: AudioContext;
  private master?: GainNode;
  private birds?: GainNode;
  private crickets?: GainNode;
  private fire?: GainNode;
  private quarry?: GainNode;
  private noise?: AudioBuffer;
  private state?: GameState & { area?: string };
  private muted: boolean;
  private readonly gainTargets = new WeakMap<GainNode, number>();
  private started = false;
  private birdTimer?: number;
  private cricketTimer?: number;
  private fireTimer?: number;
  private quarryTimer?: number;

  constructor(private readonly storage?: Storage) {
    this.muted = this.readMuted();
  }

  start(): void {
    try {
      if (!this.context) this.createAudioGraph();
      if (!this.context) return;
      this.resume();
      if (!this.started) {
        this.started = true;
        this.scheduleBirds();
        this.scheduleCrickets();
        this.scheduleFire();
        this.scheduleQuarry();
      }
      this.syncAmbience();
    } catch {
      this.resetAfterAudioFailure();
    }
  }

  resume(): void {
    if (!this.context || this.muted || this.context.state === 'running') return;
    void this.context.resume().catch(() => undefined);
  }

  update(state: GameState & { area?: string }): void {
    this.state = state;
    this.syncAmbience();
  }

  get isMuted(): boolean {
    return this.muted;
  }

  toggle(): void {
    this.muted = !this.muted;
    try {
      this.storage?.setItem(MUTE_KEY, String(this.muted));
    } catch {
      // Sound still works for this session when browser storage is unavailable.
    }
    this.setGain(this.master, this.muted ? 0 : MASTER_VOLUME);
    this.resume();
  }

  playCue(cue: SoundCue): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master || this.muted || context.state !== 'running') return;
    const notes = cue === 'gather' ? [620, 880] : [392, 523, 659];
    const now = context.currentTime;
    notes.forEach((frequency, index) => {
      const start = now + index * 0.11;
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = cue === 'gather' ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(frequency, start);
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.linearRampToValueAtTime(cue === 'gather' ? 0.1 : 0.075, start + 0.012);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      oscillator.connect(envelope).connect(master);
      oscillator.start(start);
      oscillator.stop(start + 0.23);
    });
  }

  private readMuted(): boolean {
    try {
      return this.storage?.getItem(MUTE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private createAudioGraph(): void {
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    this.context = context;
    const master = context.createGain();
    master.gain.value = this.muted ? 0 : MASTER_VOLUME;
    master.connect(context.destination);
    this.master = master;
    this.birds = this.makeLayer(context, master, 0);
    this.crickets = this.makeLayer(context, master, 0);
    this.fire = this.makeLayer(context, master, 0);
    this.quarry = this.makeLayer(context, master, 0);
    this.makeQuarryDrone(context, this.quarry);
    this.noise = this.makeNoiseBuffer(context);
  }

  private makeLayer(context: AudioContext, destination: GainNode, initialGain: number): GainNode {
    const layer = context.createGain();
    layer.gain.value = initialGain;
    layer.connect(destination);
    return layer;
  }

  private makeNoiseBuffer(context: AudioContext): AudioBuffer {
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    return buffer;
  }

  private syncAmbience(): void {
    if (!this.context || !this.state) return;
    const isNight = this.state.timeOfDay >= BALANCE.nightStart;
    const inQuarry = this.state.area === 'quarry';
    const distance = Math.hypot(this.state.player.x - BALANCE.campX, this.state.player.y - BALANCE.campY);
    const campVolume = Math.max(0, 1 - distance / (BALANCE.campRadius + 4));
    let birdVolume = 0.48;
    let cricketVolume = 0;
    let quarryVolume = 0;
    if (isNight) {
      birdVolume = 0;
      cricketVolume = inQuarry ? 0.22 : 0.34;
    }
    if (inQuarry) {
      birdVolume = isNight ? 0 : 0.16;
      quarryVolume = isNight ? 0.72 : 0.48;
    }
    this.setGain(this.birds, birdVolume);
    this.setGain(this.crickets, cricketVolume);
    this.setGain(this.fire, !inQuarry && this.state.fireFuel > 0 ? campVolume * 0.55 : 0);
    this.setGain(this.quarry, quarryVolume);
  }

  private resetAfterAudioFailure(): void {
    const context = this.context;
    if (this.birdTimer !== undefined) window.clearTimeout(this.birdTimer);
    if (this.cricketTimer !== undefined) window.clearTimeout(this.cricketTimer);
    if (this.fireTimer !== undefined) window.clearTimeout(this.fireTimer);
    if (this.quarryTimer !== undefined) window.clearTimeout(this.quarryTimer);
    this.birdTimer = undefined;
    this.cricketTimer = undefined;
    this.fireTimer = undefined;
    this.quarryTimer = undefined;
    this.context = undefined;
    this.master = undefined;
    this.birds = undefined;
    this.crickets = undefined;
    this.fire = undefined;
    this.quarry = undefined;
    this.noise = undefined;
    this.started = false;
    if (context) void context.close().catch(() => undefined);
  }

  private setGain(node: GainNode | undefined, value: number): void {
    if (!node || !this.context) return;
    if (this.gainTargets.get(node) === value) return;
    this.gainTargets.set(node, value);
    const gain = node.gain;
    const now = this.context.currentTime;
    gain.cancelScheduledValues(now);
    gain.setTargetAtTime(value, now, 0.35);
  }

  private scheduleBirds(): void {
    this.birdTimer = window.setTimeout(() => {
      if (this.state && this.state.timeOfDay < BALANCE.nightStart) this.playBirdPhrase();
      this.scheduleBirds();
    }, 2400 + Math.random() * 3600);
  }

  private playBirdPhrase(): void {
    if (!this.context || !this.birds || !this.master || this.muted || this.context.state !== 'running') return;
    const calls = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < calls; i++) {
      const start = this.context.currentTime + i * (0.13 + Math.random() * 0.06);
      const oscillator = this.context.createOscillator();
      const envelope = this.context.createGain();
      const panner = this.context.createStereoPanner();
      const base = 2100 + Math.random() * 800;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(base, start);
      oscillator.frequency.exponentialRampToValueAtTime(base * 1.48, start + 0.055);
      oscillator.frequency.exponentialRampToValueAtTime(base * 1.17, start + 0.13);
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.linearRampToValueAtTime(0.08, start + 0.015);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.15);
      panner.pan.value = Math.random() * 1.5 - 0.75;
      oscillator.connect(envelope).connect(panner).connect(this.birds);
      oscillator.start(start);
      oscillator.stop(start + 0.16);
    }
  }

  private scheduleCrickets(): void {
    this.cricketTimer = window.setTimeout(() => {
      if (this.state && this.state.timeOfDay >= BALANCE.nightStart) this.playCricketTrill();
      this.scheduleCrickets();
    }, 3600 + Math.random() * 3600);
  }

  private playCricketTrill(): void {
    if (!this.context || !this.crickets || this.muted || this.context.state !== 'running') return;
    const pulses = 6 + Math.floor(Math.random() * 4);
    const start = this.context.currentTime;
    const frequency = 3900 + Math.random() * 500;
    for (let i = 0; i < pulses; i++) {
      const pulseAt = start + i * 0.055;
      const oscillator = this.context.createOscillator();
      const envelope = this.context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency + Math.random() * 120, pulseAt);
      envelope.gain.setValueAtTime(0.0001, pulseAt);
      envelope.gain.linearRampToValueAtTime(0.055, pulseAt + 0.006);
      envelope.gain.exponentialRampToValueAtTime(0.0001, pulseAt + 0.043);
      oscillator.connect(envelope).connect(this.crickets);
      oscillator.start(pulseAt);
      oscillator.stop(pulseAt + 0.045);
    }
  }

  private scheduleFire(): void {
    this.fireTimer = window.setTimeout(() => {
      if (this.state?.area !== 'quarry' && this.state?.fireFuel && this.fire && this.context?.state === 'running') this.playCrackle();
      this.scheduleFire();
    }, 120 + Math.random() * 380);
  }

  private makeQuarryDrone(context: AudioContext, destination: GainNode): void {
    for (const frequency of [110, 164.8, 168.2]) {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 520;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      envelope.gain.value = frequency === 110 ? 0.1 : 0.045;
      oscillator.connect(filter).connect(envelope).connect(destination);
      oscillator.start();
      const wobble = context.createOscillator();
      const wobbleDepth = context.createGain();
      wobble.frequency.value = 0.07;
      wobbleDepth.gain.value = frequency === 110 ? 4 : 7;
      wobble.connect(wobbleDepth).connect(oscillator.detune);
      wobble.start();
    }
  }

  private scheduleQuarry(): void {
    this.quarryTimer = window.setTimeout(() => {
      if (this.state?.area === 'quarry') this.playStoneMoan();
      this.scheduleQuarry();
    }, 9000 + Math.random() * 9000);
  }

  private playStoneMoan(): void {
    if (!this.context || !this.quarry || this.muted || this.context.state !== 'running') return;
    const start = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    const pitch = 205 + Math.random() * 90;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(650, start);
    filter.frequency.exponentialRampToValueAtTime(240, start + 1.7);
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(pitch, start);
    oscillator.frequency.exponentialRampToValueAtTime(pitch * 0.68, start + 1.7);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.linearRampToValueAtTime(0.11, start + 0.45);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + 1.8);
    oscillator.connect(filter).connect(envelope).connect(this.quarry);
    oscillator.start(start);
    oscillator.stop(start + 1.85);
  }

  private playCrackle(): void {
    if (!this.context || !this.noise || !this.fire || this.muted) return;
    const context = this.context;
    const start = context.currentTime;
    const duration = 0.025 + Math.random() * 0.065;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    filter.type = 'bandpass';
    filter.frequency.value = 900 + Math.random() * 3000;
    filter.Q.value = 0.8 + Math.random() * 1.5;
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.linearRampToValueAtTime(0.12 + Math.random() * 0.16, start + 0.004);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.buffer = this.noise;
    source.connect(filter).connect(envelope).connect(this.fire);
    source.start(start, Math.random() * 1.8, duration);
    source.stop(start + duration + 0.005);
  }
}

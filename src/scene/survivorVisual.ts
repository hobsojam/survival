import { isLowMeter } from '../game/needs';

export type Facing = 'down' | 'up' | 'left' | 'right';
export type SurvivorAction = 'gather' | 'rest' | 'cook' | 'stargaze';

export interface SurvivorVisualState {
  facing: Facing;
  moving: boolean;
  warmth: number;
  energy: number;
  hunger: number;
  /** Fallen ill from going too long without food. */
  sick: boolean;
  nowMs: number;
  /** Wearing the woven pack: every texture has a `…Pack` twin. */
  packed?: boolean;
  action?: { kind: SurvivorAction; startedAtMs: number };
}

/** How the scene moves the sprite to show how the survivor feels: a shiver, a sickly sway, a hungry hunch or a tired droop. */
export type SurvivorEffect = 'shiver' | 'sway' | 'hunch' | 'droop';
export type SurvivorPuff = 'breath' | 'cough';

export interface SurvivorVisual {
  texture: string;
  flipX: boolean;
  /** Played on the sprite whatever the pose, walking included, so a low meter always shows. */
  effect: SurvivorEffect | null;
  /** A little cloud near the head now and then: breath in the cold, a cough when sick. */
  puff: SurvivorPuff | null;
}

export interface NeedLook { effect: SurvivorEffect | null; puff: SurvivorPuff | null; idle: 'sick' | 'shiver' | 'tired' | 'hungry' | null }

const WELL: NeedLook = { effect: null, puff: null, idle: null };

/** How the survivor looks, led by the most serious state: sick, then cold, then tired, then hungry. */
export function needLook(state: SurvivorVisualState): NeedLook {
  if (state.sick) return { effect: 'sway', puff: 'cough', idle: 'sick' };
  if (isLowMeter(state.warmth)) return { effect: 'shiver', puff: 'breath', idle: 'shiver' };
  if (isLowMeter(state.energy)) return { effect: 'droop', puff: null, idle: 'tired' };
  if (isLowMeter(state.hunger)) return { effect: 'hunch', puff: null, idle: 'hungry' };
  return WELL;
}

type Pose = Omit<SurvivorVisual, 'effect' | 'puff'>;

const actionDurationMs: Record<SurvivorAction, number> = {
  gather: 600, rest: 1200, cook: 1400, stargaze: 1600
};

/** The survivor's last pose, once the story has ended. */
export const ENDING_TEXTURE = 'survivor:lying';

export function facingFromInput(horizontal: number, vertical: number, previous: Facing): Facing {
  if (Math.abs(horizontal) >= Math.abs(vertical) && horizontal !== 0) return horizontal < 0 ? 'left' : 'right';
  if (vertical !== 0) return vertical < 0 ? 'up' : 'down';
  return previous;
}

/** The pose for an action still playing out, or null once it has finished. */
function actionVisual(state: SurvivorVisualState): Pose | null {
  if (!state.action) return null;
  const { kind, startedAtMs } = state.action;
  const elapsed = state.nowMs - startedAtMs;
  if (elapsed < 0 || elapsed >= actionDurationMs[kind]) return null;
  const frame = kind === 'gather' ? Math.min(1, Math.floor(elapsed / 250)) : Math.floor(elapsed / 250) % 2;
  const sidePose = kind === 'gather' || kind === 'cook';
  return { texture: `survivor:${kind}${frame}`, flipX: sidePose && state.facing === 'left' };
}

export function selectSurvivorVisual(state: SurvivorVisualState): SurvivorVisual {
  const look = needLook(state);
  const pose = unpackedPose(state, look);
  return { texture: state.packed ? `${pose.texture}Pack` : pose.texture, flipX: pose.flipX, effect: look.effect, puff: look.puff };
}

function unpackedPose(state: SurvivorVisualState, look: NeedLook): Pose {
  if (state.moving) {
    let group = 'walkSide';
    if (state.facing === 'up') group = 'walkUp';
    if (state.facing === 'down') group = 'walkDown';
    const frame = Math.floor(state.nowMs / 125) % 4;
    return { texture: `survivor:${group}${frame}`, flipX: state.facing === 'left' };
  }
  const action = actionVisual(state);
  if (action) return action;
  if (look.idle) return { texture: `survivor:${look.idle}${Math.floor(state.nowMs / 500) % 2}`, flipX: false };
  if (state.facing === 'up') return { texture: 'survivor:walkUp0', flipX: false };
  if (state.facing === 'left' || state.facing === 'right') return { texture: 'survivor:walkSide0', flipX: state.facing === 'left' };
  const frame = Math.floor(state.nowMs / 500) % 2;
  return { texture: `survivor:idleDown${frame}`, flipX: false };
}

export interface EffectPose { dx: number; dy: number; rotation: number }

const STILL: EffectPose = { dx: 0, dy: 0, rotation: 0 };
const SHIVER_STEP_MS = 1000 / 12;
const SWAY_PERIOD_MS = 1600;
const SWAY_RADIANS = 0.06;
const DROOP_PERIOD_MS = 2000;
const DROOP_MS = 400;
const PUFF_EVERY_MS = 1500;

/** How far to nudge and tilt the sprite at a moment, for the look it carries. */
export function effectPose(effect: SurvivorEffect | null, nowMs: number): EffectPose {
  switch (effect) {
    case 'shiver': return { ...STILL, dx: Math.floor(nowMs / SHIVER_STEP_MS) % 2 === 0 ? -1 : 1 };
    case 'sway': return { ...STILL, rotation: SWAY_RADIANS * Math.sin(nowMs / SWAY_PERIOD_MS * 2 * Math.PI) };
    case 'hunch': return { ...STILL, dy: 1 };
    case 'droop': return { ...STILL, dy: nowMs % DROOP_PERIOD_MS < DROOP_MS ? 1 : 0 };
    default: return STILL;
  }
}

/** Whether the next little cloud is due, given when the last one went. */
export function puffDue(lastPuffMs: number | undefined, nowMs: number): boolean {
  return lastPuffMs === undefined || nowMs - lastPuffMs >= PUFF_EVERY_MS;
}

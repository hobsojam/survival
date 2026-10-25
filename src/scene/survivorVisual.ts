import { isLowMeter } from '../game/needs';

export type Facing = 'down' | 'up' | 'left' | 'right';
export type SurvivorAction = 'gather' | 'rest' | 'cook' | 'stargaze';

export interface SurvivorVisualState {
  facing: Facing;
  moving: boolean;
  warmth: number;
  energy: number;
  hunger: number;
  nowMs: number;
  action?: { kind: SurvivorAction; startedAtMs: number };
}

export interface SurvivorVisual {
  texture: string;
  flipX: boolean;
}

const actionDurationMs: Record<SurvivorAction, number> = {
  gather: 600, rest: 1200, cook: 1400, stargaze: 1600
};

export function facingFromInput(horizontal: number, vertical: number, previous: Facing): Facing {
  if (Math.abs(horizontal) >= Math.abs(vertical) && horizontal !== 0) return horizontal < 0 ? 'left' : 'right';
  if (vertical !== 0) return vertical < 0 ? 'up' : 'down';
  return previous;
}

/** The pose for an action still playing out, or null once it has finished. */
function actionVisual(state: SurvivorVisualState): SurvivorVisual | null {
  if (!state.action) return null;
  const { kind, startedAtMs } = state.action;
  const elapsed = state.nowMs - startedAtMs;
  if (elapsed < 0 || elapsed >= actionDurationMs[kind]) return null;
  const frame = kind === 'gather' ? Math.min(1, Math.floor(elapsed / 250)) : Math.floor(elapsed / 250) % 2;
  const sidePose = kind === 'gather' || kind === 'cook';
  return { texture: `survivor:${kind}${frame}`, flipX: sidePose && state.facing === 'left' };
}

/** The idle pose a low meter calls for, coldest first: shivering, then tired, then hungry. */
function idleNeedPose(state: SurvivorVisualState): 'shiver' | 'tired' | 'hungry' | null {
  if (isLowMeter(state.warmth)) return 'shiver';
  if (isLowMeter(state.energy)) return 'tired';
  if (isLowMeter(state.hunger)) return 'hungry';
  return null;
}

export function selectSurvivorVisual(state: SurvivorVisualState): SurvivorVisual {
  if (state.moving) {
    let group = 'walkSide';
    if (state.facing === 'up') group = 'walkUp';
    if (state.facing === 'down') group = 'walkDown';
    const frame = Math.floor(state.nowMs / 125) % 4;
    return { texture: `survivor:${group}${frame}`, flipX: state.facing === 'left' };
  }
  const action = actionVisual(state);
  if (action) return action;
  const need = idleNeedPose(state);
  if (need) return { texture: `survivor:${need}${Math.floor(state.nowMs / 500) % 2}`, flipX: false };
  if (state.facing === 'up') return { texture: 'survivor:walkUp0', flipX: false };
  if (state.facing === 'left' || state.facing === 'right') return { texture: 'survivor:walkSide0', flipX: state.facing === 'left' };
  const frame = Math.floor(state.nowMs / 500) % 2;
  return { texture: `survivor:idleDown${frame}`, flipX: false };
}

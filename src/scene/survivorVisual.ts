export type Facing = 'down' | 'up' | 'left' | 'right';
export type SurvivorAction = 'gather' | 'rest' | 'cook' | 'stargaze';

export interface SurvivorVisualState {
  facing: Facing;
  moving: boolean;
  warmth: number;
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

export function selectSurvivorVisual(state: SurvivorVisualState): SurvivorVisual {
  if (state.moving) {
    let group = 'walkSide';
    if (state.facing === 'up') group = 'walkUp';
    if (state.facing === 'down') group = 'walkDown';
    const frame = Math.floor(state.nowMs / 125) % 4;
    return { texture: `survivor:${group}${frame}`, flipX: state.facing === 'left' };
  }
  if (state.action) {
    const elapsed = state.nowMs - state.action.startedAtMs;
    if (elapsed >= 0 && elapsed < actionDurationMs[state.action.kind]) {
      let frame = Math.floor(elapsed / 250) % 2;
      if (state.action.kind === 'gather') frame = Math.min(1, Math.floor(elapsed / 250));
      const sidePose = state.action.kind === 'gather' || state.action.kind === 'cook';
      return { texture: `survivor:${state.action.kind}${frame}`, flipX: sidePose && state.facing === 'left' };
    }
  }
  if (state.warmth <= 20) {
    const frame = Math.floor(state.nowMs / 500) % 2;
    return { texture: `survivor:shiver${frame}`, flipX: false };
  }
  if (state.facing === 'up') return { texture: 'survivor:walkUp0', flipX: false };
  if (state.facing === 'left' || state.facing === 'right') return { texture: 'survivor:walkSide0', flipX: state.facing === 'left' };
  const frame = Math.floor(state.nowMs / 500) % 2;
  return { texture: `survivor:idleDown${frame}`, flipX: false };
}

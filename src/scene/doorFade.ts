import { climbKeepBlocker, inKeep } from '../game/keep';
import { sleepBlocker, type GameAction } from '../game/rules';
import type { GameState } from '../game/state';

// Going in at the keep's door is a short fade: to black, the night or the climb happens while nothing can be seen, and back.
// Nothing about it is saved, so a reload part-way starts clean, and it always ends, however late it is asked.

export type DoorFadeKind = 'sleep' | 'view';

export const DOOR_FADE_MS: Record<DoorFadeKind, number> = { sleep: 1200, view: 2600 };

const TO_BLACK_MS = 350;
const SLEEP_BLACK_MS = 300;
/** The view opens out of black and dips back into it before the walk back down. */
const VIEW_DIP_MS = 300;

/** The fade an action that goes in at the door plays, or null: only one that will really happen. */
export function doorFadeFor(action: GameAction, before: GameState): DoorFadeKind | null {
  if (action.type === 'sleep') return inKeep(before) && !sleepBlocker(before) ? 'sleep' : null;
  if (action.type === 'climbKeep') return climbKeepBlocker(before) ? null : 'view';
  return null;
}

/** How far the view from the top pulls back: as far as it can while the map still fills the frame, and never closer than usual. */
export function viewZoom(viewWidth: number, viewHeight: number, mapWidth: number, mapHeight: number): number {
  return Math.min(1, Math.max(viewWidth / mapWidth, viewHeight / mapHeight));
}

export class DoorFade {
  private kind: DoorFadeKind = 'sleep';
  private startedAt: number | null = null;

  begin(kind: DoorFadeKind, nowMs: number): void {
    this.kind = kind;
    this.startedAt = nowMs;
  }

  private elapsed(nowMs: number): number | null {
    if (this.startedAt === null) return null;
    const elapsed = nowMs - this.startedAt;
    return elapsed < DOOR_FADE_MS[this.kind] ? elapsed : null;
  }

  running(nowMs: number): boolean {
    return this.elapsed(nowMs) !== null;
  }

  /** How dark the screen is, from 0 to 1. */
  alpha(nowMs: number): number {
    const elapsed = this.elapsed(nowMs);
    if (elapsed === null) return 0;
    const total = DOOR_FADE_MS[this.kind];
    if (elapsed < TO_BLACK_MS) return elapsed / TO_BLACK_MS;
    if (this.kind === 'sleep') return elapsed < TO_BLACK_MS + SLEEP_BLACK_MS ? 1 : (total - elapsed) / (total - TO_BLACK_MS - SLEEP_BLACK_MS);
    if (elapsed < TO_BLACK_MS + VIEW_DIP_MS) return 1 - (elapsed - TO_BLACK_MS) / VIEW_DIP_MS;
    const closing = total - TO_BLACK_MS - VIEW_DIP_MS;
    if (elapsed < closing) return 0;
    if (elapsed < total - TO_BLACK_MS) return (elapsed - closing) / VIEW_DIP_MS;
    return (total - elapsed) / TO_BLACK_MS;
  }

  /** Whether the first dip to black is over: the moment the night or the climb has happened by. */
  hold(nowMs: number): boolean {
    const elapsed = this.elapsed(nowMs);
    return elapsed !== null && elapsed >= TO_BLACK_MS && (this.kind === 'sleep' ? elapsed < TO_BLACK_MS + SLEEP_BLACK_MS : elapsed < DOOR_FADE_MS.view - TO_BLACK_MS);
  }

  /** Whether the camera should be showing the view from the top. */
  viewing(nowMs: number): boolean {
    return this.kind === 'view' && this.hold(nowMs);
  }
}

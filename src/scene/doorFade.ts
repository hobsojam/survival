import { climbKeepBlocker, inKeep } from '../game/keep';
import { sleepBlocker, type GameAction } from '../game/rules';
import type { GameState } from '../game/state';

// Going in at the keep's door is a short fade: to black, the night or the climb happens while nothing can be seen, and back.
// A climb stays open on the view until the player comes down. Nothing about it is saved, so a reload part-way starts clean.

export type DoorFadeKind = 'sleep' | 'view';

export const DOOR_FADE_MS = { sleep: 1200 };
/** How long the view ignores input once it starts to open, so the tap or key that went in can't close it. */
export const VIEW_INPUT_DELAY_MS = 1000;

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

export class DoorFade {
  private kind: DoorFadeKind = 'sleep';
  private startedAt: number | null = null;
  /** When the player came down from the view, if they have. */
  private closingAt: number | null = null;

  begin(kind: DoorFadeKind, nowMs: number): void {
    this.kind = kind;
    this.startedAt = nowMs;
    this.closingAt = null;
  }

  running(nowMs: number): boolean {
    if (this.startedAt === null) return false;
    if (this.kind === 'sleep') return nowMs - this.startedAt < DOOR_FADE_MS.sleep;
    return this.closingAt === null || nowMs - this.closingAt < VIEW_DIP_MS + TO_BLACK_MS;
  }

  /** How dark the screen is, from 0 to 1. */
  alpha(nowMs: number): number {
    if (!this.running(nowMs)) return 0;
    const elapsed = nowMs - this.startedAt!;
    if (elapsed < TO_BLACK_MS) return elapsed / TO_BLACK_MS;
    if (this.kind === 'sleep') {
      const total = DOOR_FADE_MS.sleep;
      return elapsed < TO_BLACK_MS + SLEEP_BLACK_MS ? 1 : (total - elapsed) / (total - TO_BLACK_MS - SLEEP_BLACK_MS);
    }
    if (this.closingAt !== null) {
      const closing = nowMs - this.closingAt;
      return closing < VIEW_DIP_MS ? closing / VIEW_DIP_MS : 1 - (closing - VIEW_DIP_MS) / TO_BLACK_MS;
    }
    return elapsed < TO_BLACK_MS + VIEW_DIP_MS ? 1 - (elapsed - TO_BLACK_MS) / VIEW_DIP_MS : 0;
  }

  /** Whether the first dip to black is over: the moment the night or the climb has happened by. */
  hold(nowMs: number): boolean {
    if (!this.running(nowMs) || nowMs - this.startedAt! < TO_BLACK_MS) return false;
    if (this.kind === 'sleep') return nowMs - this.startedAt! < TO_BLACK_MS + SLEEP_BLACK_MS;
    return this.closingAt === null || nowMs - this.closingAt < VIEW_DIP_MS;
  }

  /** Whether the view from the top should be showing. */
  viewing(nowMs: number): boolean {
    return this.kind === 'view' && this.hold(nowMs);
  }

  /** Starts back down from the view, if it's been up long enough and isn't already closing. Returns whether it did. */
  comeDown(nowMs: number): boolean {
    if (this.kind !== 'view' || this.startedAt === null || this.closingAt !== null) return false;
    if (nowMs - this.startedAt < TO_BLACK_MS + VIEW_INPUT_DELAY_MS) return false;
    this.closingAt = nowMs;
    return true;
  }

  /** Time stands still from going up until the player is back down, so looking costs nothing. */
  holdsClock(nowMs: number): boolean {
    return this.kind === 'view' && this.running(nowMs);
  }
}

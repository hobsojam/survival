import { isColdNight, type GameAction } from '../game/rules';
import { BALANCE, type GameState } from '../game/state';

// Sleeping through the cold night plays the storm out in a few quick seconds rather than in a blink.
// The rules have already worked out the morning; this only shows the night on its way there.

export const SLEEP_REPLAY_MS = 4500;

/** Whether a sleep just carried the survivor through the cold night to the next dawn. */
export function replaysSleep(before: GameState, after: GameState, action: GameAction): boolean {
  return action.type === 'sleep' && isColdNight(before) && after.day === before.day + 1;
}

/** The night as shown partway through: still the cold night, the clock running on, the fire burning down at its storm rate. */
export function replayFrame(before: GameState, after: GameState, elapsedMs: number): GameState {
  const progress = Math.max(0, Math.min(1, elapsedMs / SLEEP_REPLAY_MS));
  const night = BALANCE.daySeconds - before.timeOfDay;
  const passed = progress * night;
  const warmth = before.player.warmth + progress * (after.player.warmth - before.player.warmth);
  return {
    ...before,
    // Stop just short of dawn, so the night's own end is left to the real morning.
    timeOfDay: Math.min(BALANCE.daySeconds - 0.001, before.timeOfDay + passed),
    fireFuel: Math.max(0, before.fireFuel - passed * BALANCE.coldNightFireBurn),
    player: { ...before.player, warmth }
  };
}

/** One sleep through the cold night: each step shows the night as it stands, until the morning takes over. */
export class SleepReplay {
  constructor(private readonly before: GameState, private readonly after: GameState,
    private readonly journal: string[], private readonly startedAtMs: number) {}

  /** The state to show now; once the night has played out, the real morning with its journal lines, and done. */
  step(nowMs: number): { state: GameState; messages: string[]; done: boolean } {
    const elapsed = nowMs - this.startedAtMs;
    if (elapsed < SLEEP_REPLAY_MS) return { state: replayFrame(this.before, this.after, elapsed), messages: [], done: false };
    return { state: this.after, messages: this.journal, done: true };
  }
}

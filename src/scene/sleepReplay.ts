import { isColdNight, type GameAction } from '../game/rules';
import { dawnEffect } from '../game/coldNight';
import { BALANCE, type GameState } from '../game/state';
import { livesInHouse } from '../game/home';
import { logsInStore } from '../game/wood';

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
    ...fireplaceFrame(before, after, passed),
    player: { ...before.player, warmth }
  };
}

/** The fireplace partway through the night: burning at the storm rate, drawing a log each time it runs out, as many as the night took,
 * from the store first and then the handcart. */
function fireplaceFrame(before: GameState, after: GameState, passed: number): Pick<GameState, 'fireplaceFuel' | 'storedWood' | 'cartWood'> {
  if (!livesInHouse(before)) return { fireplaceFuel: before.fireplaceFuel, storedWood: before.storedWood, cartWood: before.cartWood };
  const logs = logsInStore(before) - logsInStore(after);
  let fuel = before.fireplaceFuel - passed * BALANCE.coldNightFireBurn;
  let drawn = 0;
  while (fuel <= 0 && drawn < logs) {
    fuel += BALANCE.fireplaceSecondsPerWood;
    drawn += 1;
  }
  const fromStore = Math.min(drawn, before.storedWood);
  return { fireplaceFuel: Math.max(0, fuel), storedWood: before.storedWood - fromStore, cartWood: before.cartWood - (drawn - fromStore) };
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

type Written = { state: GameState; messages: string[] };

/** What the scene keeps about the cold night: a sleep being played out, and when the last sunrise began. */
export class NightWatch {
  private replay: SleepReplay | null = null;
  private sunriseAtMs = -Infinity;

  /** While a sleep plays out, input is ignored. */
  get running(): boolean { return this.replay !== null; }

  /** Starts playing out the sleep if it carried the survivor through the cold night; true if it did. */
  begin(before: GameState, written: Written, action: GameAction, nowMs: number): boolean {
    if (!replaysSleep(before, written.state, action)) return false;
    this.replay = new SleepReplay(before, written.state, written.messages, nowMs);
    return true;
  }

  /** The state for this frame: the replay's while it runs, otherwise the ordinary tick. */
  tick(nowMs: number, advance: () => Written): Written {
    if (!this.replay) return advance();
    const step = this.replay.step(nowMs);
    if (step.done) this.replay = null;
    return { state: step.state, messages: step.messages };
  }

  /** Notes the morning after the cold night: a held fire starts the sunrise; true when frost should show instead. */
  dawn(before: GameState, after: GameState, nowMs: number): boolean {
    const effect = dawnEffect(before, after);
    if (effect === 'sunrise') this.sunriseAtMs = nowMs;
    return effect === 'frost';
  }

  sunriseAgeMs(nowMs: number): number { return nowMs - this.sunriseAtMs; }
}

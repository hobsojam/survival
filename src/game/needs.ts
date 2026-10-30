import { BALANCE, type GameState } from './state';

/** Any meter at or below the low line: the bars turn amber and walking slows. */
export const isLowMeter = (value: number): boolean => value <= BALANCE.lowNeed;

export const isTired = (state: GameState): boolean => isLowMeter(state.player.energy);
export const isExhausted = (state: GameState): boolean => state.player.energy < BALANCE.exhaustedEnergy;
export const isHungry = (state: GameState): boolean => isLowMeter(state.player.hunger);
export const isStarving = (state: GameState): boolean => state.player.hunger <= 0;

export const TOO_TIRED_MESSAGE = "You're too tired for heavy work. Rest or sleep first.";

/** How long work takes: longer when tired. */
export function workSeconds(state: GameState, seconds: number): number {
  return isTired(state) ? seconds * BALANCE.tiredWorkFactor : seconds;
}

/** Energy rest would restore, halved when hungry. */
export function recovery(state: GameState, gain: number): number {
  return isHungry(state) ? gain * BALANCE.hungryRecoveryFactor : gain;
}

export type NeedAlert = 'tired' | 'exhausted' | 'hungry' | 'starving';

/** Worst first, which is also the order alerts are read out. */
export const ALL_NEED_ALERTS: readonly NeedAlert[] = ['exhausted', 'starving', 'tired', 'hungry'];

const NEED_MESSAGES: Record<NeedAlert, string> = {
  exhausted: "You're exhausted. Heavy work will have to wait until you rest.",
  starving: "You're starving, and it's wearing you down. Eat something now.",
  tired: "You're getting tired. Rest at camp or sleep tonight.",
  hungry: "You're hungry. Eat something soon."
};

interface Meter {
  severe: NeedAlert;
  mild: NeedAlert;
  value: (state: GameState) => number;
  isSevere: (state: GameState) => boolean;
  isMild: (state: GameState) => boolean;
  /** Each alert re-arms once its meter climbs ten past the line. */
  severeRearm: number;
}

/** Built on use: food.ts reaches this module through camp.ts while state.ts is still loading, before BALANCE exists. */
const meters = (): readonly Meter[] => [
  { severe: 'exhausted', mild: 'tired', value: state => state.player.energy, isSevere: isExhausted, isMild: isTired, severeRearm: BALANCE.exhaustedEnergy + 10 },
  { severe: 'starving', mild: 'hungry', value: state => state.player.hunger, isSevere: isStarving, isMild: isHungry, severeRearm: 10 }
];

/**
 * Which need alerts to show now, and which stay armed for later. An alert fires once when its
 * meter reaches the line, then waits until the meter climbs back above the line plus ten.
 */
export function needAlerts(armed: ReadonlySet<NeedAlert>, state: GameState): { armed: Set<NeedAlert>; fired: NeedAlert[] } {
  const next = new Set(armed);
  const fired: NeedAlert[] = [];
  for (const meter of meters()) {
    const value = meter.value(state);
    if (value >= meter.severeRearm) next.add(meter.severe);
    if (value > BALANCE.lowNeed + 10) next.add(meter.mild);
    if (meter.isSevere(state) && next.has(meter.severe)) {
      fired.push(meter.severe);
      next.delete(meter.severe);
      next.delete(meter.mild);
    } else if (meter.isMild(state) && next.has(meter.mild)) {
      fired.push(meter.mild);
      next.delete(meter.mild);
    }
  }
  return { armed: next, fired };
}

/** The fired alerts as one feedback line, worst first. */
export function needsMessage(alerts: readonly NeedAlert[]): string {
  return ALL_NEED_ALERTS.filter(alert => alerts.includes(alert)).map(alert => NEED_MESSAGES[alert]).join(' ');
}

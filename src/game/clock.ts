import { BALANCE } from './state';

export type DayPhase = 'Morning' | 'Afternoon' | 'Night';

export function dayPhase(timeOfDay: number): DayPhase {
  if (timeOfDay >= BALANCE.nightStart) return 'Night';
  return timeOfDay >= BALANCE.afternoonStart ? 'Afternoon' : 'Morning';
}

/** The next change of light and how many whole seconds until it. */
export function nextChange(timeOfDay: number): { event: 'Night' | 'Dawn'; seconds: number } {
  return timeOfDay < BALANCE.nightStart
    ? { event: 'Night', seconds: Math.ceil(BALANCE.nightStart - timeOfDay) }
    : { event: 'Dawn', seconds: Math.ceil(BALANCE.daySeconds - timeOfDay) };
}

export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

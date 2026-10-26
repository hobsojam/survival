import { BALANCE } from './state';
import { afternoonStart, nightStart } from './calendar';

export type DayPhase = 'Morning' | 'Afternoon' | 'Night';

export function dayPhase(timeOfDay: number, day: number): DayPhase {
  if (timeOfDay >= nightStart(day)) return 'Night';
  return timeOfDay >= afternoonStart(day) ? 'Afternoon' : 'Morning';
}

/** The next change of light and how many whole seconds until it. */
export function nextChange(timeOfDay: number, day: number): { event: 'Night' | 'Dawn'; seconds: number } {
  const night = nightStart(day);
  return timeOfDay < night
    ? { event: 'Night', seconds: Math.ceil(night - timeOfDay) }
    : { event: 'Dawn', seconds: Math.ceil(BALANCE.daySeconds - timeOfDay) };
}

export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

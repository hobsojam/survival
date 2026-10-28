// The year is worked out from the day number alone, so nothing here is saved.

export type Season = 'autumn' | 'winter' | 'spring' | 'summer';

export const SEASON_LENGTH = 10;
export const YEAR_LENGTH = 40;

const SEASONS: readonly Season[] = ['autumn', 'winter', 'spring', 'summer'];
const MIDSUMMER = 36;

const ARRIVALS: Record<Season, string> = {
  autumn: 'The leaves are turning gold. Autumn has come.',
  winter: 'Snow fell in the night. Winter has come.',
  spring: 'The snow is melting. Spring has come.',
  summer: 'The days are long and warm. Summer has come.'
};

export function season(day: number): Season {
  return SEASONS[Math.floor((day - 1) / SEASON_LENGTH) % SEASONS.length];
}

export function seasonName(s: Season): string {
  return s[0].toUpperCase() + s.slice(1);
}

export function daysLeftInSeason(day: number): number {
  return SEASON_LENGTH - (day - 1) % SEASON_LENGTH;
}

/** Seconds into the day when night falls: 130 in midwinter, 190 in midsummer, changing a little each dawn. */
export function nightStart(day: number): number {
  return Math.round(160 + 30 * Math.cos(2 * Math.PI * (day - MIDSUMMER) / YEAR_LENGTH));
}

/** The afternoon keeps the same share of the daylight all year. */
export function afternoonStart(day: number): number {
  return Math.round(nightStart(day) * 0.6875);
}

/** The morning message for a new season, or null when the season hasn't changed. */
export function seasonMessage(beforeDay: number, afterDay: number): string | null {
  const next = season(afterDay);
  return next === season(beforeDay) ? null : ARRIVALS[next];
}

/** Which year of camp a day falls in: days 1–40 are year one. */
export const yearOf = (day: number): number => Math.floor((day - 1) / YEAR_LENGTH) + 1;

/** Seconds of dusk before nightfall: summer evenings linger. */
export const duskLength = (day: number): number => (season(day) === 'summer' ? 45 : 30);

export const isSpring = (day: number): boolean => season(day) === 'spring';
export const isSummer = (day: number): boolean => season(day) === 'summer';
export const isWinter = (day: number): boolean => season(day) === 'winter';
export const firefliesOut = (day: number): boolean => season(day) === 'summer';
export const leavesFalling = (day: number): boolean => season(day) === 'autumn';

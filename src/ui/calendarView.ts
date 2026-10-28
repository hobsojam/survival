import { BALANCE, type GameState } from '../game/state';
import { YEAR_LENGTH, daysLeftInSeason, nightStart, season, seasonName, type Season } from '../game/calendar';
import { dayPhase, formatClock, nextChange, type DayPhase } from '../game/clock';
import { isColdNight, isFreezingNight } from '../game/rules';
import { journalIconUrl } from '../art/journalIcons';

const YEAR: readonly Season[] = ['autumn', 'winter', 'spring', 'summer'];

export interface DayPillView {
  season: string;
  day: string;
  phase: DayPhase | 'Cold night';
  countdown: string;
  night: boolean;
  /** The autumn cold night: the pill names it and wears a snowflake. */
  cold: boolean;
  /** Any freezing night, the cold night or a bitter winter one: frost creeps in round the view. */
  frosty: boolean;
  handPercent: number;
  nightPercent: number;
}

export function dayPillView(state: GameState): DayPillView {
  const phase = dayPhase(state.timeOfDay, state.day);
  const change = nextChange(state.timeOfDay, state.day);
  const cold = isColdNight(state);
  return {
    season: seasonName(season(state.day)),
    day: `Day ${state.day}`,
    phase: cold ? 'Cold night' : phase,
    countdown: `${change.event} in ${formatClock(change.seconds)}`,
    night: phase === 'Night',
    cold,
    frosty: isFreezingNight(state),
    handPercent: state.timeOfDay / BALANCE.daySeconds * 100,
    nightPercent: nightStart(state.day) / BALANCE.daySeconds * 100
  };
}

export interface YearWheelView {
  label: string;
  /** Degrees clockwise from the top, where autumn begins. */
  angle: number;
  seasons: { name: string; current: boolean }[];
}

export function yearWheelView(day: number, timeOfDay: number): YearWheelView {
  const now = season(day);
  const left = daysLeftInSeason(day);
  return {
    label: `${seasonName(now)} · ${left === 1 ? 'last day' : `${left} days left`}`,
    angle: ((day - 1) % YEAR_LENGTH + timeOfDay / BALANCE.daySeconds) / YEAR_LENGTH * 360,
    seasons: YEAR.map(s => ({ name: seasonName(s), current: s === now }))
  };
}

/** The parts of a page element the calendar touches. */
export interface CalendarElement {
  textContent: string | null;
  style: { left: string; transform: string };
  classList: { toggle(name: string, force: boolean): boolean };
  setAttribute(name: string, value: string): void;
}

export interface CalendarRoot { querySelector(selector: string): CalendarElement | null }

const setText = (root: CalendarRoot, selector: string, text: string) => {
  const element = root.querySelector(selector);
  if (element) element.textContent = text;
};

export function renderDayPill(root: CalendarRoot, view: DayPillView): void {
  setText(root, '#day-season', view.season);
  setText(root, '#day-number', view.day);
  setText(root, '#day-phase', view.phase);
  setText(root, '#day-countdown', view.countdown);
  root.querySelector('#day-pill')?.classList.toggle('night', view.night);
  root.querySelector('#day-pill')?.classList.toggle('cold', view.cold);
  root.querySelector('.game-frame')?.classList.toggle('frosty', view.frosty);
  // The snowflake shows on phones too, where the phase's name is hidden for room.
  if (view.cold) root.querySelector('#day-cold')?.setAttribute('style', `background-image: url("${journalIconUrl('coldFront')}")`);
  const hand = root.querySelector('#day-dial-hand');
  if (hand) hand.style.left = `${view.handPercent}%`;
  const night = root.querySelector('#day-dial-night');
  if (night) night.style.left = `${view.nightPercent}%`;
}

export function renderYearWheel(root: CalendarRoot, view: YearWheelView): void {
  setText(root, '#year-label', view.label);
  const hand = root.querySelector('#year-hand');
  if (hand) hand.style.transform = `rotate(${view.angle}deg)`;
  view.seasons.forEach((entry, index) => {
    const item = root.querySelector(`#year-season-${index}`);
    item?.setAttribute('aria-current', String(entry.current));
    item?.classList.toggle('current', entry.current);
  });
}

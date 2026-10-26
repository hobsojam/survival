import { describe, expect, it } from 'vitest';
import { createGame } from '../src/game/state';
import { nightStart } from '../src/game/calendar';
import { dayPillView, renderDayPill, renderYearWheel, yearWheelView } from '../src/ui/calendarView';

const at = (day: number, timeOfDay: number) => ({ ...createGame(), day, timeOfDay });

describe('the day pill', () => {
  it('names the season, the day and the part of the day', () => {
    const view = dayPillView(at(14, 0));
    expect(view).toMatchObject({ season: 'Winter', day: 'Day 14', phase: 'Morning', night: false, countdown: 'Night in 2:11', handPercent: 0 });
    expect(view.nightPercent).toBeCloseTo(nightStart(14) / 240 * 100);
  });

  it('counts down to dawn on a winter evening', () => {
    const view = dayPillView(at(16, 135));
    expect(view.night).toBe(true);
    expect(view.countdown).toMatch(/^Dawn in/);
  });
});

describe('the year wheel', () => {
  it('starts the year at the top in autumn', () => {
    expect(yearWheelView(1, 0)).toMatchObject({ angle: 0, label: 'Autumn · 10 days left' });
  });

  it('marks the last day of a season', () => {
    expect(yearWheelView(20, 0).label).toBe('Winter · last day');
  });

  it('turns once a year and comes back round', () => {
    expect(yearWheelView(41, 0).angle).toBe(0);
    expect(yearWheelView(11, 120).angle).toBeCloseTo((10 + 0.5) / 40 * 360);
  });

  it('lists the four seasons with the current one marked', () => {
    expect(yearWheelView(31, 0).seasons).toEqual([
      { name: 'Autumn', current: false }, { name: 'Winter', current: false },
      { name: 'Spring', current: false }, { name: 'Summer', current: true }
    ]);
  });
});

function fakeRoot() {
  const elements = new Map<string, { textContent: string | null; style: { left: string; transform: string }; attributes: Record<string, string>;
    classes: Set<string>; classList: { toggle(name: string, force: boolean): boolean }; setAttribute(name: string, value: string): void }>();
  const element = () => {
    const classes = new Set<string>();
    const attributes: Record<string, string> = {};
    return { textContent: null as string | null, style: { left: '', transform: '' }, attributes, classes,
      classList: { toggle: (name: string, force: boolean) => { if (force) classes.add(name); else classes.delete(name); return force; } },
      setAttribute: (name: string, value: string) => { attributes[name] = value; } };
  };
  return { elements, querySelector: (selector: string) => {
    if (!elements.has(selector)) elements.set(selector, element());
    return elements.get(selector)!;
  } };
}

describe('drawing the calendar', () => {
  it('fills the day pill and moves its hand and night marker', () => {
    const root = fakeRoot();
    renderDayPill(root, dayPillView(at(16, 135)));
    const get = (selector: string) => root.elements.get(selector)!;
    expect([get('#day-season').textContent, get('#day-number').textContent, get('#day-phase').textContent]).toEqual(['Winter', 'Day 16', 'Night']);
    expect(get('#day-countdown').textContent).toBe('Dawn in 1:45');
    expect(get('#day-pill').classes.has('night')).toBe(true);
    expect(get('#day-dial-hand').style.left).toBe(`${135 / 240 * 100}%`);
    expect(get('#day-dial-night').style.left).toBe(`${130 / 240 * 100}%`);
  });

  it('turns the wheel and marks the current season', () => {
    const root = fakeRoot();
    renderYearWheel(root, yearWheelView(31, 0));
    const get = (selector: string) => root.elements.get(selector)!;
    expect(get('#year-label').textContent).toBe('Summer · 10 days left');
    expect(get('#year-hand').style.transform).toBe('rotate(270deg)');
    expect(get('#year-season-3').attributes['aria-current']).toBe('true');
    expect(get('#year-season-0').attributes['aria-current']).toBe('false');
  });

  it('skips parts of the page that are missing', () => {
    const empty = { querySelector: () => null };
    expect(() => { renderDayPill(empty, dayPillView(at(1, 0))); renderYearWheel(empty, yearWheelView(1, 0)); }).not.toThrow();
  });
});

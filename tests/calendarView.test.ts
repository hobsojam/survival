import { describe, expect, it } from 'vitest';
import { createGame } from '../src/game/state';
import { nightStart } from '../src/game/calendar';
import { dayPillView, renderDayPill, renderYearWheel, yearWheelView } from '../src/ui/calendarView';
import { journalIconUrl } from '../src/art/journalIcons';

const at = (day: number, timeOfDay: number) => ({ ...createGame(), day, timeOfDay });

describe('the day pill', () => {
  it('names the season, the day and the part of the day', () => {
    const view = dayPillView(at(14, 0));
    expect(view).toMatchObject({ season: 'Winter', day: 'Day 14', phase: 'Morning', night: false, countdown: 'Night in 3:27', handPercent: 0 });
    expect(view.nightPercent).toBeCloseTo(nightStart(14) / 240 * 100);
  });

  it('counts down to dawn on a winter evening', () => {
    const view = dayPillView(at(16, 155));
    expect(view.night).toBe(true);
    expect(view.countdown).toMatch(/^Dawn in/);
  });
});

describe('the day pill on the cold night', () => {
  const coldNight = { ...at(3, nightStart(3) + 5), progress: { ...createGame().progress, nextStormDay: 3 } };

  it('names the cold night and turns frosty', () => {
    expect(dayPillView(coldNight)).toMatchObject({ phase: 'Cold night', night: true, cold: true, frosty: true });
  });

  it('frosts the view on a bitter winter night, but keeps the cold night\'s name for autumn', () => {
    const winter = { ...at(16, 155), progress: { ...createGame().progress, nextStormDay: null, hearthUnlocked: true } };
    expect(dayPillView(winter)).toMatchObject({ phase: 'Night', cold: false, frosty: true });
    expect(dayPillView(at(6, 200))).toMatchObject({ phase: 'Night', cold: false, frosty: false });
  });

  it('draws the frost, the snowflake and the name, even where the phase is hidden', () => {
    const root = fakeRoot();
    renderDayPill(root, dayPillView(coldNight));
    const get = (selector: string) => root.elements.get(selector)!;
    expect(get('#day-phase').textContent).toBe('Cold night');
    expect(get('#day-pill').classes.has('cold')).toBe(true);
    expect(get('.game-frame').classes.has('frosty')).toBe(true);
    expect(get('#day-cold').attributes.style).toBe(`background-image: url("${journalIconUrl('coldFront')}")`);
    renderDayPill(root, dayPillView(at(6, 100)));
    expect(get('#day-pill').classes.has('cold')).toBe(false);
    expect(get('.game-frame').classes.has('frosty')).toBe(false);
  });
});

describe('the winter warning on the day pill', () => {
  it('counts down autumn\'s last three days to winter', () => {
    expect(dayPillView(at(8, 0)).winterIn).toBe('Winter in 3 days');
    expect(dayPillView(at(9, 0)).winterIn).toBe('Winter in 2 days');
    expect(dayPillView(at(10, 0)).winterIn).toBe('Winter in 1 day');
    expect(dayPillView(at(48, 0)).winterIn).toBe('Winter in 3 days');
  });

  it('says nothing earlier in autumn or once winter has come', () => {
    expect(dayPillView(at(7, 0)).winterIn).toBe('');
    expect(dayPillView(at(11, 0)).winterIn).toBe('');
    expect(dayPillView(at(38, 0)).winterIn).toBe('');
  });

  it('shows the warning on the pill, and hides it when there is none', () => {
    const root = fakeRoot();
    const get = (selector: string) => root.elements.get(selector)!;
    renderDayPill(root, dayPillView(at(9, 0)));
    expect(get('#day-winter').textContent).toBe('Winter in 2 days');
    expect(get('#day-pill').classes.has('winter-soon')).toBe(true);
    expect(get('#day-winter').attributes.style).toBe(`background-image: url("${journalIconUrl('coldFront')}")`);
    renderDayPill(root, dayPillView(at(11, 0)));
    expect(get('#day-winter').textContent).toBe('');
    expect(get('#day-pill').classes.has('winter-soon')).toBe(false);
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
    renderDayPill(root, dayPillView(at(16, 155)));
    const get = (selector: string) => root.elements.get(selector)!;
    expect([get('#day-season').textContent, get('#day-number').textContent, get('#day-phase').textContent]).toEqual(['Winter', 'Day 16', 'Night']);
    expect(get('#day-countdown').textContent).toBe('Dawn in 1:57');
    expect(get('#day-pill').classes.has('night')).toBe(true);
    expect(get('#day-dial-hand').style.left).toBe(`${155 / 240 * 100}%`);
    expect(get('#day-dial-night').style.left).toBe(`${149 / 240 * 100}%`);
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

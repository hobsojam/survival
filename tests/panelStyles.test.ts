import { describe, expect, it } from 'vitest';
import STYLES from '../src/style.css?raw';
import APP from '../src/ui/App.ts?raw';

const css = STYLES.replace(/\/\*[\s\S]*?\*\//g, '');
/** The declarations of every rule whose selector list names the selector, joined. */
const rulesFor = (selector: string): string => [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
  .filter(([, selectors]) => selectors.split(/,(?![^(]*\))/).some((item: string) => item.replace(/\s+/g, ' ').trim() === selector
    || item.includes(':is(') && expandIs(item).includes(selector)))
  .map(([, , body]) => body).join(';');
/** `:is(.a, .b) .c` as ['.a .c', '.b .c']. */
function expandIs(item: string): string[] {
  const match = item.match(/:is\(([^)]*)\)/);
  if (!match) return [item.replace(/\s+/g, ' ').trim()];
  return match[1].split(',').map(part => item.replace(match[0], part.trim()).replace(/\s+/g, ' ').trim());
}

describe('panel buttons', () => {
  it('styles the action buttons in every panel with tool rows', () => {
    for (const panel of ['workshop', 'granary', 'windmill', 'bakery', 'beehive', 'beds']) {
      const rules = rulesFor(`.${panel}-panel .tool-row button`);
      expect(rules, panel).toContain('border-radius');
      expect(rules, panel).toContain('background');
      expect(rulesFor(`.${panel}-panel .tool-row button.ready`), panel).toContain('background');
      expect(rulesFor(`.${panel}-panel .tool-row button:disabled`), panel).toContain('opacity');
    }
  });

  it('styles the buttons on each garden plot, bed and field strip', () => {
    const rules = rulesFor('.garden-plot button');
    expect(rules).toContain('border-radius');
    expect(rules).toContain('background');
    expect(rulesFor('.garden-plot button:disabled')).toContain('opacity');
  });
});

const app = APP;

/** Splits a selector list at its top-level commas, and opens one level of :is(), so each alternative stands alone. */
function alternatives(selectorList: string): string[] {
  const parts: string[] = [];
  let depth = 0, start = 0;
  [...selectorList].forEach((char, index) => {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === ',' && depth === 0) { parts.push(selectorList.slice(start, index)); start = index + 1; }
  });
  parts.push(selectorList.slice(start));
  return parts.flatMap(part => {
    const open = /:is\(([^()]*)\)/.exec(part);
    return open ? open[1].split(',').map(choice => part.replace(open[0], choice.trim())) : [part];
  }).map(part => part.trim());
}

/** Every alternative selector in the stylesheet, whether it names a button, and the classes and ids it asks for. */
const rules = [...css.matchAll(/([^{}]+)\{/g)].flatMap(match => alternatives(match[1]))
  .map(selector => ({ button: /\bbutton\b/.test(selector), tokens: [...selector.matchAll(/[.#][\w-]+/g)].map(token => token[0]) }));

const classesIn = (markup: string): string[] => [...markup.matchAll(/class="([^"$]*)"/g)].flatMap(match => match[1].split(/\s+/).map(name => `.${name}`));

/** Whether some rule reaches this panel's buttons: it asks only for classes and ids the panel has, and either names a
 * button or ends at a class or id a button carries. */
function reaches(panel: { name: string; body: string }): boolean {
  const buttons = [...panel.body.matchAll(/<button[^>]*>/g)].map(match => match[0]);
  const onButtons = new Set([...buttons.flatMap(classesIn), ...buttons.flatMap(button => [...button.matchAll(/id="([^"$]*)"/g)].map(match => `#${match[1]}`))]);
  const present = new Set([`.${panel.name}`, ...classesIn(panel.body), ...[...panel.body.matchAll(/id="([^"$]*)"/g)].map(match => `#${match[1]}`)]);
  return rules.some(({ button, tokens }) => tokens.length > 0 && (button || onButtons.has(tokens.at(-1)!))
    && tokens.every(token => token === '.ready' || present.has(token)));
}

/** Each panel section in the page: its own class and its markup. */
const panels = [...app.matchAll(/<section class="panel ([\w-]+)[^"]*"[^>]*>([\s\S]*?)<\/section>/g)].map(match => ({ name: match[1], body: match[2] }));

// Buttons fall back to the browser's grey bevelled look unless a rule reaches them. A new panel or dialog is easy to add
// without one, so these check the page's own markup against the stylesheet, rather than a list that has to be kept up.
describe('every button on the page', () => {
  it('finds the panels to check', () => {
    expect(panels.length).toBeGreaterThan(20);
  });

  it('styles the buttons in every panel that has them', () => {
    const unstyled = panels
      .filter(panel => /<button(?![^>]*class="[^"]*(build-item|supply-action|primary-button|secondary-button))/.test(panel.body))
      .filter(panel => !reaches(panel))
      .map(panel => panel.name);
    expect(unstyled).toEqual([]);
  });

  it('gives every button in a dialog\'s row of answers its primary or secondary look', () => {
    const rows = [...app.matchAll(/<div class="(name-actions|start-buttons)">([\s\S]*?)<\/div>/g)];
    expect(rows.length).toBeGreaterThan(0);
    const plain = rows.flatMap(row => [...row[2].matchAll(/<button[^>]*>/g)].map(button => button[0]))
      .filter(button => !/class="[^"]*(primary|secondary)-button/.test(button));
    expect(plain).toEqual([]);
  });
});

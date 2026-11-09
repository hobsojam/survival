import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Buttons fall back to the browser's grey bevelled look unless a rule in the stylesheet reaches them. A new panel or
// dialog is easy to add without one, so these check the page's markup against the stylesheet.

const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/ui/App.ts', import.meta.url), 'utf8');

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

describe('the buttons on the page', () => {
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

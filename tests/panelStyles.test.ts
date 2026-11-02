import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
/** The declarations of every rule whose selector list names the selector, joined. */
const rulesFor = (selector: string): string => [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
  .filter(([, selectors]) => selectors.split(/,(?![^(]*\))/).some(item => item.replace(/\s+/g, ' ').trim() === selector
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

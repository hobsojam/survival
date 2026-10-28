import { describe, expect, it } from 'vitest';
import { JOURNAL_ICONS, JOURNAL_ICON_SIZE, journalIconUrl } from '../src/art/journalIcons';
import { palette } from '../src/art/palette';
import { JOURNAL_PAGES } from '../src/game/journalEntries';

const ids = Object.values(JOURNAL_PAGES).flat().map(entry => entry.id);

describe('the journal icons', () => {
  it('draws every moment of the year', () => {
    expect(Object.keys(JOURNAL_ICONS).sort()).toEqual([...ids].sort());
  });

  it('keeps every icon on a square grid, coloured only from its legend', () => {
    for (const id of ids) {
      const { legend, rows } = JOURNAL_ICONS[id];
      expect(rows, id).toHaveLength(JOURNAL_ICON_SIZE);
      for (const row of rows) {
        expect(row, id).toHaveLength(JOURNAL_ICON_SIZE);
        for (const pixel of row) if (pixel !== '.') expect(legend[pixel], `${id} '${pixel}'`).toBeDefined();
      }
    }
  });

  it('gives each moment a picture of its own', () => {
    const pictures = new Set(ids.map(id => JOURNAL_ICONS[id].rows.join('')));
    expect(pictures.size).toBe(ids.length);
  });

  it('paints an icon as a crisp SVG in the game palette', () => {
    const svg = decodeURIComponent(journalIconUrl('fox').replace('data:image/svg+xml,', ''));
    expect(journalIconUrl('fox').startsWith('data:image/svg+xml,')).toBe(true);
    expect(svg).toContain(`viewBox="0 0 ${JOURNAL_ICON_SIZE} ${JOURNAL_ICON_SIZE}"`);
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toContain(`fill="${palette.fox2}"`);
    // Clear pixels draw nothing.
    const filled = JOURNAL_ICONS.fox.rows.join('').replaceAll('.', '').length;
    expect(svg.match(/<rect /g)?.length).toBeLessThanOrEqual(filled);
  });
});

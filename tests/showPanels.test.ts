import { describe, expect, it } from 'vitest';
import { BALANCE, BUILDINGS, createGame, type GameState } from '../src/game/state';
import { buildListMarkup, buildListView, campStoresMarkup, campStoresView } from '../src/ui/panels';
import { showBuildList, showCampStores, type Shown } from '../src/ui/showPanels';

/** A page of plain elements, found by id, standing in for the browser's. */
function page(ids: string[]) {
  const elements = new Map<string, Shown>(ids.map(id => [`#${id}`, { hidden: true, textContent: '' }]));
  return { find: (selector: string) => elements.get(selector) ?? null, get: (id: string) => elements.get(`#${id}`)! };
}
const STORE_IDS = ['stores-panel', 'store-line-wood', 'store-line-fiber', 'store-line-stone', 'store-line-cart'];
const atCamp = (changes: Partial<GameState> = {}, structures: Partial<GameState['structures']> = {}): GameState => {
  const base = createGame();
  return { ...base, player: { ...base.player, x: BALANCE.campX, y: BALANCE.campY }, structures: { ...base.structures, ...structures }, ...changes };
};

describe('the camp stores panel on the page', () => {
  it('lays out a hidden line for each store inside the hidden panel, with the larder', () => {
    const markup = campStoresMarkup();
    expect(markup).toMatch(/^<section class="panel stores-panel" id="stores-panel" data-tab="bag" hidden><p class="eyebrow">CAMP STORES<\/p>/);
    for (const id of ['wood', 'fiber', 'stone', 'cart']) expect(markup).toContain(`<p id="store-line-${id}" class="store-line" hidden></p>`);
    expect(markup).toContain('id="larder-controls"');
  });

  it('shows the panel and only the stores that exist, with their counts', () => {
    const shown = page(STORE_IDS);
    showCampStores(shown.find, campStoresView(atCamp({ storedStone: 6 }, { stonePile: true })));
    expect(shown.get('stores-panel').hidden).toBe(false);
    expect(shown.get('store-line-stone')).toEqual({ hidden: false, textContent: 'Stone 6/12' });
    for (const id of ['wood', 'fiber', 'cart']) expect(shown.get(`store-line-${id}`).hidden, id).toBe(true);
  });

  it('hides the panel again when there are no stores, and copes with missing lines', () => {
    const shown = page(['stores-panel']);
    shown.get('stores-panel').hidden = false;
    showCampStores(shown.find, campStoresView(atCamp()));
    expect(shown.get('stores-panel').hidden).toBe(true);
  });
});

describe('the build list on the page', () => {
  it('lays out a button for every building, with the shelter upgrades heading just above the thatched roof', () => {
    const markup = buildListMarkup();
    for (const [id, { name }] of Object.entries(BUILDINGS)) expect(markup, id).toContain(`data-build="${id}"><span class="build-symbol">${BUILDINGS[id as keyof typeof BUILDINGS].symbol}</span><span class="build-copy"><strong>${name}</strong>`);
    expect(markup.match(/build-group-heading/g)).toHaveLength(1);
    expect(markup).toContain('<h3 id="shelter-upgrades-heading" class="build-group-heading">Shelter upgrades</h3><button type="button" class="build-item" data-build="shelterThatched">');
  });


  it('writes the hint and shows the shelter upgrades heading only while an upgrade is offered', () => {
    const shown = page(['build-hint', 'shelter-upgrades-heading']);
    showBuildList(shown.find, buildListView(atCamp({}, { shelter: true })));
    expect(shown.get('shelter-upgrades-heading').hidden).toBe(false);
    expect(shown.get('build-hint').textContent).toBe('In the clearing — click an upgrade to build.');
    showBuildList(shown.find, buildListView(atCamp()));
    expect(shown.get('shelter-upgrades-heading').hidden).toBe(true);
  });

  it('copes with a page that has neither', () => {
    expect(() => showBuildList(() => null, buildListView(atCamp()))).not.toThrow();
  });
});

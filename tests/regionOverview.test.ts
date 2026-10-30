import { describe, expect, it } from 'vitest';
import { createGame } from '../src/game/state';
import { journalView } from '../src/ui/journal';
import { renderRegionOverview } from '../src/ui/regionOverview';

class FakeElement {
  className = '';
  children: FakeElement[] = [];
  classes = new Set<string>();
  private ownText = '';
  classList = { toggle: (name: string, on: boolean) => {
    if (on) this.classes.add(name);
    else this.classes.delete(name);
    return on;
  } };

  get textContent(): string { return [this.ownText, ...this.children.map(child => child.textContent)].filter(Boolean).join(' '); }
  set textContent(value: string) { this.ownText = value; this.children = []; }
  append(...children: FakeElement[]): void { this.children.push(...children); }
  replaceChildren(...children: FakeElement[]): void { this.children = children; this.ownText = ''; }
}

function page() {
  const home = new FakeElement();
  const destinations = new FakeElement();
  const elements: Record<string, FakeElement> = { '#region-home-status': home, '#region-destinations': destinations };
  const root = { querySelector: (selector: string) => elements[selector] ?? null } as unknown as HTMLElement;
  const doc = { createElement: () => new FakeElement() } as unknown as Document;
  return { root, doc, home, destinations };
}

describe('area overview', () => {
  it('shows an unknown route, then quarry resources after the lookout survey', () => {
    const state = createGame();
    state.structures.shelter = true;
    const view = page();
    renderRegionOverview(view.root, view.doc, journalView(state).regions, state.area);
    expect(view.destinations.textContent).toContain('West path Unexplored area Unexplored');
    expect(view.destinations.textContent).not.toContain('Stone');

    state.progress.lookoutRepaired = true;
    renderRegionOverview(view.root, view.doc, journalView(state).regions, state.area);
    expect(view.destinations.textContent).toContain('Old quarry Seen from lookout');
    expect(view.destinations.textContent).toContain('Resources: Stone');
    expect(view.destinations.textContent).toContain('Places: Loose rubble, Quarry face');
  });

  it('marks the current area and shows the route opening condition', () => {
    const state = createGame();
    const view = page();
    renderRegionOverview(view.root, view.doc, journalView(state).regions, state.area);
    expect(view.home.textContent).toBe('You are here');
    expect(view.destinations.textContent).toContain('Build a shelter');

    state.structures.shelter = true;
    state.area = 'quarry';
    renderRegionOverview(view.root, view.doc, journalView(state).regions, state.area);
    expect(view.home.textContent).toBe('Home');
    expect(view.destinations.textContent).toContain('Old quarry You are here');
    expect(view.destinations.children[0].children[1].classes.has('current')).toBe(true);
  });

  it('shows a visited area and tolerates a missing destination container', () => {
    const state = createGame();
    state.structures.shelter = true;
    state.progress.quarryFound = true;
    const view = page();
    renderRegionOverview(view.root, view.doc, journalView(state).regions, state.area);
    expect(view.destinations.textContent).toContain('Old quarry Visited');
    expect(() => renderRegionOverview({ querySelector: () => null } as unknown as HTMLElement, view.doc, journalView(state).regions, state.area)).not.toThrow();
  });
});

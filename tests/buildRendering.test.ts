import { describe, expect, it, vi } from 'vitest';
import { createGame } from '../src/game/state';
import { STEP_IDS } from '../src/game/clearing';
import { App } from '../src/ui/App';

vi.mock('phaser', () => ({ default: {} }));
vi.mock('../src/scene/GameScene', () => ({ GameScene: class {} }));

function element() {
  return {
    hidden: false,
    disabled: false,
    textContent: '',
    title: '',
    style: { width: '' },
    classList: { toggle: () => undefined },
    querySelector: (() => { const children = new Map<string, ReturnType<typeof element>>(); return (selector: string) => {
      if (!children.has(selector)) children.set(selector, element());
      return children.get(selector)!;
    }; })()
  };
}

function renderer() {
  const nodes = new Map<string, ReturnType<typeof element>>();
  const root = {
    querySelector: (selector: string) => {
      if (!nodes.has(selector)) nodes.set(selector, element());
      return nodes.get(selector)!;
    }
  };
  const app = Object.create(App.prototype) as App;
  Object.assign(app, { root, state: createGame() });
  return { app, nodes, get: (selector: string) => root.querySelector(selector) };
}

describe('completed Build actions', () => {
  it('hides finished tool rows and the Forest tools section when all tools are made', () => {
    const { app, get } = renderer();
    const state = createGame();
    state.progress.axeCrafted = true;
    state.progress.pickaxeCrafted = true;
    state.progress.potCrafted = true;
    state.progress.packWoven = true;
    state.progress.fishingLine = true;
    Object.assign(app, { state });

    app['renderTools']();

    expect(get('#axe-row, #axe-panel').hidden).toBe(true);
    expect(get('#line-row, #line-panel').hidden).toBe(true);
    expect(get('#forest-tools-panel').hidden).toBe(true);
  });

  it('keeps cleared-ground progress while removing finished clearing buttons', () => {
    const { app, get } = renderer();
    const state = createGame();
    state.progress.axeCrafted = true;
    state.clearing.cleared = ['north-near', 'north-far', 'north-outer'];
    Object.assign(app, { state });

    app['renderClearing']();
    expect(get('[data-clear-side="north"]').hidden).toBe(true);
    expect(get('[data-clear-side="east"]').hidden).toBe(false);
    expect(get('#clearing-progress').textContent).toContain('north near');
    expect(get('#clear-row, #clear-panel').hidden).toBe(false);

    state.clearing.cleared = [...STEP_IDS];
    app['renderClearing']();
    expect(get('#clearing-progress').textContent).toBe('All ground cleared.');
    expect(get('#clear-row, #clear-panel').hidden).toBe(true);
  });

  it('hides the workshop when finished and restores it when bed tools unlock', () => {
    const { app, get } = renderer();
    const state = createGame();
    state.structures.workshop = true;
    state.progress.workshop.saw = true;
    state.progress.workshop.handcart = true;
    Object.assign(app, { state });

    app['renderWorkshop']();
    expect(get('#workshop-panel').hidden).toBe(true);
    expect(get('#saw-row, #saw-panel').hidden).toBe(true);

    state.structures.vegetableBeds = true;
    app['renderWorkshop']();
    expect(get('#workshop-panel').hidden).toBe(false);
    expect(get('#bedtools-row, #bedtools-panel').hidden).toBe(false);
  });
});

describe('completed Camp discoveries', () => {
  it('hides the Follow the paths panel only after every place is found', () => {
    const { app, get } = renderer();
    const state = createGame();
    Object.assign(app, { state });

    app['renderSurvivor']();
    expect(get('.sites-panel').hidden).toBe(false);

    state.progress.discoveries.basket = true;
    state.progress.discoveries.spring = true;
    app['renderSurvivor']();
    expect(get('.sites-panel').hidden).toBe(false);

    state.progress.discoveries.cairn = true;
    app['renderSurvivor']();
    expect(get('.sites-panel').hidden).toBe(true);
  });
});

describe('house decoration controls', () => {
  it('appears only after the house and reflects material and completion state', () => {
    const { app, get } = renderer();
    app['renderDecorations']();
    expect(get('#decoration-group').hidden).toBe(true);

    const state = createGame();
    state.structures.house = true;
    state.inventory.wood = 6;
    state.inventory.fiber = 1;
    Object.assign(app, { state });
    app['renderDecorations']();
    expect(get('#decoration-group').hidden).toBe(false);
    const fence = get('[data-decorate="fence"]');
    expect(fence.disabled).toBe(false);
    expect(fence.querySelector('.build-price').textContent).toBe('6 wood · 1 fiber');
    expect(fence.querySelector('.decor-description').textContent).toContain('Section 1 of 3');

    state.decorations.fence = 3;
    app['renderDecorations']();
    expect(fence.disabled).toBe(true);
    expect(fence.querySelector('.build-verb').textContent).toBe('Done');
    expect(fence.title).toContain('complete');
  });
});

describe('mine Build panel', () => {
  it('reveals the inner row when the browser returns its outer panel for a selector list', () => {
    const { app, get } = renderer();
    const state = createGame();
    state.progress.pickaxeCrafted = true;
    Object.assign(app, { state });
    const panel = get('#mine-panel');
    const row = get('#mine-row');
    panel.hidden = true;
    row.hidden = true;
    const root = app['root'];
    const original = root.querySelector.bind(root);
    root.querySelector = ((selector: string) => selector === '#mine-row, #mine-panel' ? panel : original(selector)) as typeof root.querySelector;

    app['renderTools']();

    expect(panel.hidden).toBe(false);
    expect(row.hidden).toBe(false);
  });
  it('shows its row and panel after the pickaxe is crafted, then keeps the built status visible', () => {
    const { app, get } = renderer();
    app['renderTools']();
    expect(get('#mine-panel').hidden).toBe(true);
    expect(get('#mine-row, #mine-panel').hidden).toBe(true);

    const state = createGame();
    state.progress.pickaxeCrafted = true;
    Object.assign(app, { state });
    app['renderTools']();
    expect(get('#mine-panel').hidden).toBe(false);
    expect(get('#mine-row, #mine-panel').hidden).toBe(false);
    expect(get('#mine-button').disabled).toBe(true);

    state.progress.mineBuilt = true;
    app['renderTools']();
    expect(get('#mine-copy').textContent).toContain('2 digs left');
    expect(get('#mine-panel').hidden).toBe(false);
  });
});

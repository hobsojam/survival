import { describe, expect, it, vi } from 'vitest';
import { createGame } from '../src/game/state';
import { STEP_IDS } from '../src/game/clearing';
import { addFood } from '../src/game/food';
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
    },
    querySelectorAll: (selector: string) => selector === '[data-larder-item]'
      ? [...nodes].filter(([key]) => key.startsWith('[data-larder-item=')).map(([, node]) => node)
      : []
  };
  const app = Object.create(App.prototype) as App;
  Object.assign(app, { root, state: createGame() });
  return { app, nodes, get: (selector: string) => root.querySelector(selector) };
}

describe('larder controls', () => {
  it('renders bounded bulk counts and enabled buttons for food that can move', () => {
    const { app, get } = renderer();
    const state = createGame();
    state.structures.larder = true;
    state.inventory.food = addFood(state.inventory.food, 'berry', 3, state.day);
    state.larder = addFood(state.larder, 'honey', 9, state.day);
    Object.assign(app, { state });
    const berry = get('[data-larder-item="berry"]');
    const honey = get('[data-larder-item="honey"]');

    app['renderLarder']();

    expect(get('#larder-controls').hidden).toBe(false);
    expect(get('#larder-stored').textContent).toBe('Stored food 9/10');
    expect(berry.hidden).toBe(false);
    expect(berry.querySelector('[data-action="storeFoodAll"]')).toMatchObject({ disabled: false, textContent: 'Store all (1)', title: 'Store 1 berry.' });
    expect(berry.querySelector('[data-action="takeFoodAll"]')).toMatchObject({ disabled: true, textContent: 'Take all (0)' });
    expect(honey.querySelector('[data-action="storeFoodAll"]')).toMatchObject({ disabled: true, textContent: 'Store all (0)' });
    expect(honey.querySelector('[data-action="takeFoodAll"]')).toMatchObject({ disabled: false, textContent: 'Take all (5)', title: 'Take 5 honey.' });
  });

  it('disables bulk buttons away from camp and hides a row after its food is gone', () => {
    const { app, get } = renderer();
    const state = createGame();
    state.structures.larder = true;
    state.inventory.food = addFood(state.inventory.food, 'berry', 1, state.day);
    state.player.x = 5;
    state.player.y = 5;
    Object.assign(app, { state });
    const berry = get('[data-larder-item="berry"]');

    app['renderLarder']();
    expect(berry.querySelector('[data-action="storeFoodAll"]')).toMatchObject({ disabled: true, title: 'Return to camp to use the larder.' });
    expect(berry.querySelector('[data-action="takeFoodAll"]')).toMatchObject({ disabled: true, title: 'Return to camp to use the larder.' });

    state.inventory.food.berry = [];
    app['renderLarder']();
    expect(berry.hidden).toBe(true);
  });
});

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
  it('shows its row and panel after the pickaxe is crafted, then hides it after building', () => {
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
    expect(get('#mine-panel').hidden).toBe(true);
  });
});

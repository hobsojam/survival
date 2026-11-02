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
    classList: { toggle: () => undefined },
    querySelector: () => element()
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

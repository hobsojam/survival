import { describe, expect, it } from 'vitest';
import { createGame, type GameState } from '../src/game/state';
import { applyAction, decorationBlocker, availableWood, availableFiber } from '../src/game/rules';
import { sceneVisuals } from '../src/scene/visuals';
import { phase3Sprites } from '../src/art/phase3Sprites';
import { upgradeSave } from '../src/game/saveUpgrades';
import { loadGame, saveGame, SAVE_KEY, SAVE_VERSION } from '../src/game/save';
import { DECORATION_CHOICES, decorationButtonView, decorationMarkup } from '../src/ui/panels';

function house(changes: Partial<GameState> = {}): GameState {
  const base = createGame();
  return { ...base, structures: { ...base.structures, house: true }, clearing: { ...base.clearing, cleared: ['north-near', 'north-far'] },
    inventory: { ...base.inventory, wood: 24, fiber: 12, food: { ...base.inventory.food, berry: [1, 1], greens: [1, 1] } }, ...changes };
}

function texture(state: GameState, id: string): string | undefined {
  return sceneVisuals(state, 0).find(visual => visual.id === id)?.texture;
}

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

describe('decoration choices in the Build tab', () => {
  it('lists all four fixed choices with their material prices after the house stands', () => {
    const markup = decorationMarkup();
    for (const choice of DECORATION_CHOICES) expect(markup).toContain(`data-decorate="${choice}"`);
    const state = house();
    expect(decorationButtonView(state, 'berryPaint')).toMatchObject({ shown: true, disabled: false, price: '2 fiber · 2 berries' });
    expect(decorationButtonView(state, 'leafPaint')).toMatchObject({ shown: true, disabled: false, price: '2 fiber · 2 greens' });
    expect(decorationButtonView(state, 'flowerBoxes')).toMatchObject({ shown: true, disabled: false, price: '3 wood · 2 fiber' });
    expect(decorationButtonView(state, 'fence')).toMatchObject({ shown: true, disabled: false, price: '6 wood · 1 fiber', description: 'Section 1 of 3 · fixed around the yard' });
  });

  it('shows unavailable and completed choices distinctly', () => {
    expect(decorationButtonView(createGame(), 'fence')).toMatchObject({ shown: false, disabled: true, locked: true });
    const base = house();
    const empty = { ...base, inventory: createGame().inventory };
    expect(decorationButtonView(empty, 'fence')).toMatchObject({ shown: true, disabled: true, locked: true });
    const completed = { ...base, decorations: { paint: 'berry' as const, flowerBoxes: true, fence: 3 } };
    expect(decorationButtonView(completed, 'berryPaint')).toMatchObject({ built: true, disabled: true, verb: 'Done' });
    expect(decorationButtonView(completed, 'flowerBoxes')).toMatchObject({ built: true, disabled: true, verb: 'Done' });
    expect(decorationButtonView(completed, 'fence')).toMatchObject({ built: true, disabled: true, description: 'Section 3 of 3 · fixed around the yard' });
  });
});

describe('homestead decoration', () => {
  it('needs a house, the clearing and the stated materials', () => {
    const base = createGame();
    expect(decorationBlocker(base, 'fence')).toContain('house');
    expect(decorationBlocker(house({ area: 'quarry' }), 'fence')).toContain('camp');
    expect(decorationBlocker(house({ inventory: base.inventory }), 'fence')).toContain('wood');
    expect(applyAction(base, { type: 'decorate', choice: 'fence' }).state).toBe(base);
  });

  it('pays for each fixed fence section once and stops at three', () => {
    let state = house();
    for (let count = 1; count <= 3; count++) {
      const result = applyAction(state, { type: 'decorate', choice: 'fence' });
      state = result.state;
      expect(state.decorations.fence).toBe(count);
      expect(availableWood(state)).toBe(24 - 6 * count);
      expect(availableFiber(state)).toBe(12 - count);
      expect(texture(state, `house-fence-${count - 1}`)).toMatch(/^fence:/);
    }
    expect(decorationBlocker(state, 'fence')).toContain('complete');
    expect(applyAction(state, { type: 'decorate', choice: 'fence' }).state).toBe(state);
  });

  it('paints with food pigment, can repaint, and builds the flower boxes once', () => {
    let state = house();
    state = applyAction(state, { type: 'decorate', choice: 'berryPaint' }).state;
    expect(state.decorations.paint).toBe('berry');
    expect(state.inventory.food.berry).toEqual([]);
    expect(texture(state, 'house')).toBe('house:berry-bare-dark');
    expect(applyAction(state, { type: 'decorate', choice: 'berryPaint' }).state).toBe(state);
    state = applyAction(state, { type: 'decorate', choice: 'leafPaint' }).state;
    expect(state.decorations.paint).toBe('leaf');
    expect(state.inventory.food.greens).toEqual([]);
    state = applyAction(state, { type: 'decorate', choice: 'flowerBoxes' }).state;
    expect(availableWood(state)).toBe(21);
    expect(state.decorations.flowerBoxes).toBe(true);
    expect(texture(state, 'house')).toBe('house:leaf-boxes-dark');
    expect(applyAction(state, { type: 'decorate', choice: 'flowerBoxes' }).state).toBe(state);
    expect(phase3Sprites.house.frames['leaf-boxes-dark']).toBeDefined();
  });

  it('upgrades old saves and rejects decoration data without a house', () => {
    const old = structuredClone(createGame()) as unknown as Record<string, unknown>;
    delete old.decorations;
    const upgraded = upgradeSave(SAVE_VERSION - 1, old);
    expect(upgraded.ok).toBe(true);
    if (upgraded.ok) expect((upgraded.state as GameState).decorations).toEqual({ paint: 'natural', flowerBoxes: false, fence: 0 });
    const storage = new MemoryStorage();
    expect(saveGame(storage, createGame()).ok).toBe(true);
    const saved = JSON.parse(storage.getItem(SAVE_KEY)!);
    saved.state.decorations.fence = 1;
    storage.setItem(SAVE_KEY, JSON.stringify(saved));
    expect(loadGame(storage).kind).toBe('invalid');
  });
});

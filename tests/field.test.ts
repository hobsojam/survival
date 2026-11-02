import { describe, expect, it } from 'vitest';
import { BALANCE, createGame, type GameState } from '../src/game/state';
import { CLEARING_STEPS, STEP_IDS, inClearing, placeBranches } from '../src/game/clearing';
import { FIELD_STRIPS, emptyField, ripeDay, type FieldState, type FieldStrip } from '../src/game/field';
import { upgradeBlocker } from '../src/game/workshop';
import { loadGame, saveGame, SAVE_KEY } from '../src/game/save';

const { campX, campY } = BALANCE;
const SOUTH: GameState['clearing']['cleared'] = ['south-near', 'south-far'];

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
}

/** A camp past its cold night with the south ground cleared, standing at the fire; the field, granary and workshop as asked. */
export function fieldCamp(structures: Partial<GameState['structures']> = {}, changes: Partial<GameState> = {}): GameState {
  const base = createGame();
  const placed = placeBranches(base.nodes, SOUTH);
  return {
    ...base,
    day: 22,
    nodes: base.nodes.map((node, i) => ({ ...node, x: placed[i].x, y: placed[i].y })),
    clearing: { cleared: SOUTH, marked: null, felled: [] },
    progress: { ...base.progress, nextStormDay: null, hearthUnlocked: true },
    structures: { ...base.structures, field: true, ...structures },
    player: { ...base.player, x: campX, y: campY },
    ...changes
  };
}

export const strip = (changes: Partial<FieldStrip> = {}): FieldStrip => ({ sownDay: null, cut: false, ...changes });
export const withField = (state: GameState, field: Partial<FieldState>): GameState => ({ ...state, field: { ...state.field, ...field } });

/** Saves a state and loads it back, as the game would. */
function roundTrip(state: GameState) {
  const storage = new MemoryStorage();
  storage.setItem(SAVE_KEY, JSON.stringify({ version: 26, state }));
  return loadGame(storage);
}

describe('the field and granary to begin with', () => {
  it('starts with no field, no granary, bare strips, no seed and no grain', () => {
    const game = createGame();
    expect(game.field).toEqual(emptyField());
    expect(game.field.strips).toHaveLength(FIELD_STRIPS);
    expect(game.structures.field).toBe(false);
    expect(game.structures.granary).toBe(false);
    expect(game.progress.workshop.harvestTools).toBe(false);
    expect(game.progress.workshop.quern).toBe(false);
  });

  it('ripens on summer\'s fifth day of the year it was sown', () => {
    expect(ripeDay(21)).toBe(35);
    expect(ripeDay(30)).toBe(35);
    expect(ripeDay(61)).toBe(75);
  });

  it('stands the field on the south far ground and the granary on the south near ground', () => {
    expect(CLEARING_STEPS['south-far'].room).toContain('field');
    expect(CLEARING_STEPS['south-near'].room).toContain('granary');
  });

  it('makes the harvest tools only once the field stands, and the quern only once the granary does', () => {
    const state = fieldCamp({ field: false, workshop: true, toolshed: true, shelter: true });
    expect(upgradeBlocker(state, 'harvestTools')).toBe('Build the field first.');
    expect(upgradeBlocker(state, 'quern')).toBe('Build the granary first.');
  });

  it('grows wild grain outside the widest clearing, clear of every other spot', () => {
    const nodes = placeBranches(createGame().nodes, STEP_IDS);
    const grain = nodes.find(node => node.kind === 'wildGrain');
    expect(grain).toMatchObject({ id: 'wildGrain-0', amount: 1, readyDay: 1 });
    expect(nodes.at(-1)).toBe(grain);
    expect(inClearing(grain!.x, grain!.y, STEP_IDS)).toBe(false);
    for (const node of nodes) {
      if (node !== grain) expect(Math.hypot(node.x - grain!.x, node.y - grain!.y)).toBeGreaterThanOrEqual(1.5);
    }
  });
});

describe('saving the field', () => {
  const granaryCamp = () => fieldCamp({ granary: true });

  it('saves and loads a sown field with grain in the granary', () => {
    const state = withField(granaryCamp(), { strips: [strip({ sownDay: 22 }), strip(), strip(), strip()], seed: 3, grain: 8 });
    const storage = new MemoryStorage();
    expect(saveGame(storage, state).ok).toBe(true);
    const loaded = loadGame(storage);
    expect(loaded.kind).toBe('loaded');
    expect(loaded.kind === 'loaded' && loaded.state.field).toEqual(state.field);
  });

  it('refuses a field that could never have been', () => {
    const base = granaryCamp();
    const bad: GameState[] = [
      withField(base, { strips: [strip({ cut: true }), strip(), strip(), strip()] }),
      withField(base, { strips: [strip({ sownDay: 23 }), strip(), strip(), strip()] }),
      withField({ ...base, structures: { ...base.structures, field: false, granary: false } }, { strips: [strip({ sownDay: 22 }), strip(), strip(), strip()] }),
      withField(base, { seed: 5 }),
      withField(base, { seed: -1 }),
      withField(base, { grain: BALANCE.granaryCapacity + 1 }),
      withField({ ...base, structures: { ...base.structures, granary: false } }, { grain: 1 }),
      withField(base, { strips: [strip({ sownDay: 22, cut: true }), strip(), strip(), strip()] }),
      withField(base, { strips: [strip(), strip(), strip()] }),
      { ...base, structures: { ...base.structures, field: false, granary: false, workshop: true, toolshed: true, shelter: true },
        progress: { ...base.progress, workshop: { ...base.progress.workshop, harvestTools: true } } },
      { ...base, structures: { ...base.structures, granary: false, workshop: true, toolshed: true, shelter: true },
        progress: { ...base.progress, workshop: { ...base.progress.workshop, quern: true } } }
    ];
    for (const state of bad) expect(roundTrip(state).kind).toBe('invalid');
  });

  it('loads a cut strip once it has ripened', () => {
    const state = withField({ ...granaryCamp(), day: 36 }, { strips: [strip({ sownDay: 22, cut: true }), strip(), strip(), strip()] });
    expect(roundTrip(state).kind).toBe('loaded');
  });
});

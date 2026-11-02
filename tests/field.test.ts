import { describe, expect, it } from 'vitest';
import { BALANCE, createGame, type GameState } from '../src/game/state';
import { CLEARING_STEPS, STEP_IDS, inClearing, placeBranches } from '../src/game/clearing';
import { FIELD_STRIPS, cutStripBlocker, emptyField, ripeDay, sowStripBlocker, stripStage, threshGrain, threshStripBlocker, wildGrainBlocker } from '../src/game/field';
import { TOO_TIRED_MESSAGE, workSeconds } from '../src/game/needs';
import { advanceTime, applyAction } from '../src/game/rules';
import { nodeShown } from '../src/game/forage';
import { upgradeBlocker } from '../src/game/workshop';
import { loadGame, saveGame, SAVE_KEY } from '../src/game/save';
import { fieldCamp, strip, withField } from './fieldCamp';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
}

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

describe('the field through the year', () => {
  const sown = strip({ sownDay: 22 });
  it('shows shoots in spring, tall green in summer, then gold from summer\'s fifth day, and stooks once cut', () => {
    expect(stripStage(strip(), 25)).toBe('bare');
    expect(stripStage(sown, 25)).toBe('shoots');
    expect(stripStage(sown, 31)).toBe('green');
    expect(stripStage(sown, 34)).toBe('green');
    expect(stripStage(sown, 35)).toBe('gold');
    expect(stripStage(sown, 45)).toBe('gold');
    expect(stripStage({ ...sown, cut: true }, 36)).toBe('stooks');
  });
});

describe('working the field', () => {
  /** A camp in spring, with seed for two strips, the granary and the harvest tools ready. */
  const ready = (changes: Partial<GameState> = {}): GameState => {
    const base = fieldCamp({ granary: true, workshop: true, toolshed: true, shelter: true }, changes);
    return withField({ ...base, progress: { ...base.progress, workshop: { ...base.progress.workshop, harvestTools: true } } }, { seed: 2 });
  };
  const gold = (state: GameState, grain = 0, seed = 2): GameState =>
    withField({ ...state, day: 36 }, { strips: [strip({ sownDay: 22 }), strip(), strip(), strip()], grain, seed });
  const stooks = (state: GameState, grain = 0, seed = 2): GameState =>
    withField({ ...state, day: 36 }, { strips: [strip({ sownDay: 22, cut: true }), strip(), strip(), strip()], grain, seed });
  const noTools = (state: GameState): GameState => ({ ...state, progress: { ...state.progress, workshop: { ...state.progress.workshop, harvestTools: false } } });

  it('refuses every job on a strip that isn\'t there, before the field, or away from camp', () => {
    const state = ready();
    for (const blocker of [sowStripBlocker, cutStripBlocker, threshStripBlocker]) {
      expect(blocker(state, 4)).toBe('That strip is unavailable.');
      expect(blocker(state, 1.5)).toBe('That strip is unavailable.');
      expect(blocker({ ...state, structures: { ...state.structures, field: false } }, 0)).toBe('Build the field first.');
      expect(blocker({ ...state, player: { ...state.player, x: 2, y: 2 } }, 0)).toBe('Return to camp to work the field.');
    }
  });

  it('sows only in spring, on a bare strip, with seed, and not when worn out', () => {
    const state = ready();
    expect(sowStripBlocker(state, 0)).toBeNull();
    expect(sowStripBlocker({ ...state, day: 31 }, 0)).toBe('Sow the field in spring.');
    expect(sowStripBlocker({ ...stooks(state), day: 61 }, 0)).toBe('Thresh that strip before sowing it again.');
    expect(sowStripBlocker(withField(state, { strips: [strip({ sownDay: 21 }), strip(), strip(), strip()] }), 0)).toBe('That strip is already sown.');
    expect(sowStripBlocker(withField(state, { seed: 0 }), 0)).toBe('You have no seed. Gather wild grain at the edge of the clearing.');
    expect(sowStripBlocker({ ...state, player: { ...state.player, energy: 0 } }, 0)).toBe(TOO_TIRED_MESSAGE);
  });

  it('cuts only gold grain, with the sickle and flail, and not when worn out', () => {
    const state = gold(ready());
    expect(cutStripBlocker(state, 0)).toBeNull();
    expect(cutStripBlocker(state, 1)).toBe('That strip isn\'t ripe yet.');
    expect(cutStripBlocker(withField(state, { strips: [strip({ sownDay: 22 }), strip(), strip(), strip()] }), 0)).toBeNull();
    expect(cutStripBlocker({ ...state, day: 33 }, 0)).toBe('That strip isn\'t ripe yet.');
    expect(cutStripBlocker(noTools(state), 0)).toBe('Make a sickle and flail at the workshop first.');
    expect(cutStripBlocker({ ...state, player: { ...state.player, energy: 0 } }, 0)).toBe(TOO_TIRED_MESSAGE);
  });

  it('threshes only stooks, with the tools, into a granary, and not when worn out', () => {
    const state = stooks(ready());
    expect(threshStripBlocker(state, 0)).toBeNull();
    expect(threshStripBlocker(state, 1)).toBe('Cut that strip before threshing it.');
    expect(threshStripBlocker(noTools(state), 0)).toBe('Make a sickle and flail at the workshop first.');
    expect(threshStripBlocker({ ...state, structures: { ...state.structures, granary: false } }, 0)).toBe('Build the granary first.');
    expect(threshStripBlocker({ ...state, player: { ...state.player, energy: 0 } }, 0)).toBe(TOO_TIRED_MESSAGE);
  });

  it('sows a strip from the seed, in the time and energy of a gather', () => {
    const state = ready();
    const { state: after, message } = applyAction(state, { type: 'sowStrip', index: 2 });
    expect(after.field.strips[2]).toEqual({ sownDay: 22, cut: false });
    expect(after.field.seed).toBe(1);
    expect(message).toBe('Sowed a strip of grain.');
    expect(after.player.energy).toBe(state.player.energy - BALANCE.gatherEnergyCost);
    expect(after.timeOfDay).toBeCloseTo(state.timeOfDay + workSeconds(state, BALANCE.gatherSeconds));
  });

  it('cuts a gold strip into stooks, as heavier work', () => {
    const state = gold(ready());
    const { state: after, message } = applyAction(state, { type: 'cutStrip', index: 0 });
    expect(after.field.strips[0]).toEqual({ sownDay: 22, cut: true });
    expect(message).toBe('Cut the strip and stood the sheaves in stooks.');
    expect(after.player.energy).toBe(state.player.energy - BALANCE.fieldWorkEnergy);
    expect(after.timeOfDay).toBeCloseTo(state.timeOfDay + workSeconds(state, BALANCE.fieldWorkSeconds));
  });

  it('threshes a strip into the granary and keeps a strip\'s seed', () => {
    const state = stooks(ready());
    const { state: after, message } = applyAction(state, { type: 'threshStrip', index: 0 });
    expect(after.field.strips[0]).toEqual({ sownDay: null, cut: false });
    expect(after.field.grain).toBe(BALANCE.grainPerStrip);
    expect(after.field.seed).toBe(3);
    expect(message).toBe('Threshed the strip. 4 grain went into the granary.');
    expect(after.player.energy).toBe(state.player.energy - BALANCE.fieldWorkEnergy);
    expect(after.timeOfDay).toBeCloseTo(state.timeOfDay + workSeconds(state, BALANCE.fieldWorkSeconds));
  });

  it('fills the granary and leaves the rest as straw, keeping the seed either way', () => {
    const nearlyFull = applyAction(stooks(ready(), 14), { type: 'threshStrip', index: 0 });
    expect(nearlyFull.state.field.grain).toBe(16);
    expect(nearlyFull.state.field.seed).toBe(3);
    expect(nearlyFull.message).toBe('Threshed the strip. The granary is full now, and the rest stays as straw.');
    expect(threshGrain(stooks(ready(), 14))).toBe(2);
    const full = applyAction(stooks(ready(), 16), { type: 'threshStrip', index: 0 });
    expect(full.state.field.grain).toBe(16);
    expect(full.state.field.strips[0]).toEqual({ sownDay: null, cut: false });
    expect(full.state.field.seed).toBe(3);
    expect(full.message).toBe('The granary is already full. You kept the seed, and the rest stays as straw.');
  });

  it('keeps no more seed than the field has strips', () => {
    expect(applyAction(stooks(ready(), 0, 4), { type: 'threshStrip', index: 0 }).state.field.seed).toBe(FIELD_STRIPS);
  });

  it('leaves uncut grain gold into the next spring, to be cut and threshed before it is sown again', () => {
    const spring = withField({ ...ready(), day: 61 }, { strips: [strip({ sownDay: 22 }), strip(), strip(), strip()], seed: 2 });
    expect(stripStage(spring.field.strips[0], 61)).toBe('gold');
    expect(sowStripBlocker(spring, 0)).toBe('That strip is already sown.');
    const cut = applyAction(spring, { type: 'cutStrip', index: 0 }).state;
    const threshed = applyAction(cut, { type: 'threshStrip', index: 0 }).state;
    expect(sowStripBlocker(threshed, 0)).toBeNull();
  });
});

describe('wild grain', () => {
  /** Standing beside the wild grain on a given day, with the bag as full as asked. */
  const atGrain = (day = 2, seed = 0): GameState => {
    const base = createGame();
    const grain = base.nodes.find(node => node.kind === 'wildGrain')!;
    return withField({ ...base, day, progress: { ...base.progress, nextStormDay: null, hearthUnlocked: true }, player: { ...base.player, x: grain.x, y: grain.y + 1 } }, { seed });
  };

  it('gives a strip\'s seed, into no bag, in the time and energy of a gather', () => {
    const state = atGrain();
    const { state: after, message } = applyAction(state, { type: 'gather', nodeId: 'wildGrain-0' });
    expect(after.field.seed).toBe(1);
    expect(after.inventory).toEqual(state.inventory);
    expect(message).toBe('Gathered wild grain: seed for one strip of a field on the south ground.');
    expect(after.player.energy).toBe(state.player.energy - BALANCE.gatherEnergyCost);
    expect(after.timeOfDay).toBeCloseTo(state.timeOfDay + workSeconds(state, BALANCE.gatherSeconds));
    expect(after.nodes.find(node => node.id === 'wildGrain-0')).toMatchObject({ amount: 0, readyDay: 3 });
  });

  it('can be gathered with a full bag', () => {
    const state = atGrain();
    const full = { ...state, inventory: { ...state.inventory, wood: 8 } };
    expect(applyAction(full, { type: 'gather', nodeId: 'wildGrain-0' }).state.field.seed).toBe(1);
  });

  it('stops once there is seed for the whole field', () => {
    const state = atGrain(2, FIELD_STRIPS);
    expect(wildGrainBlocker(state)).toBe('You have seed enough for the whole field.');
    expect(wildGrainBlocker(atGrain(2, 3))).toBeNull();
    const { state: after, message } = applyAction(state, { type: 'gather', nodeId: 'wildGrain-0' });
    expect(after).toBe(state);
    expect(message).toBe('You have seed enough for the whole field.');
  });

  it('is gone under the winter snow, and there in every other season', () => {
    const node = createGame().nodes.find(item => item.kind === 'wildGrain')!;
    expect(nodeShown(atGrain(12), node)).toBe(false);
    for (const day of [2, 22, 32]) expect(nodeShown(atGrain(day), node)).toBe(true);
  });

  it('comes back at dawn', () => {
    const gathered = applyAction(atGrain(), { type: 'gather', nodeId: 'wildGrain-0' }).state;
    const dawned = advanceTime({ ...gathered, timeOfDay: BALANCE.daySeconds - 1 }, 1.5, 'resting');
    expect(dawned.nodes.find(node => node.id === 'wildGrain-0')!.amount).toBe(1);
  });
});

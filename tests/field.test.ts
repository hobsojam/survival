import { describe, expect, it } from 'vitest';
import { BALANCE, createGame, type GameState } from '../src/game/state';
import { CLEARING_STEPS, STEP_IDS, inClearing, placeBranches } from '../src/game/clearing';
import { FIELD_STRIPS, cutStripBlocker, emptyField, fieldNews, ripeDay, sowStripBlocker, stripStage, threshGrain, threshStripBlocker, wildGrainBlocker } from '../src/game/field';
import { TOO_TIRED_MESSAGE, workSeconds } from '../src/game/needs';
import { advanceTime, applyAction } from '../src/game/rules';
import { nodeShown } from '../src/game/forage';
import { newsBetween } from '../src/game/news';
import { journalEntry, journalSeason, recordJournal } from '../src/game/journalEntries';
import { nightStart } from '../src/game/calendar';
import { addFood, emptyFood } from '../src/game/food';
import { CAMP_STRUCTURES, FIELD_STRIP_OFFSETS, sceneVisuals } from '../src/scene/visuals';
import { sprites } from '../src/art/sprites';
import { PATH_DESTINATIONS, segmentDistance } from './placement';
import { upgradeBlocker } from '../src/game/workshop';
import { loadGame, saveGame, SAVE_KEY } from '../src/game/save';

const { campX, campY } = BALANCE;
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

describe('news from the field', () => {
  const dawnInto = (state: GameState, day: number): [GameState, GameState] => [{ ...state, day: day - 1 }, { ...state, day }];
  const sownOn = (state: GameState, day: number): GameState => withField(state, { strips: [strip({ sownDay: day }), strip(), strip(), strip()] });

  it('says it is time to sow at the first dawn of spring, with a field, seed and a bare strip', () => {
    const state = withField(fieldCamp(), { seed: 2 });
    expect(fieldNews(...dawnInto(state, 21))).toBe('The ground is soft. Time to sow the field.');
    expect(fieldNews(...dawnInto(state, 22))).toBeNull();
    expect(fieldNews(...dawnInto(withField(state, { seed: 0 }), 21))).toBeNull();
    expect(fieldNews(...dawnInto({ ...state, structures: { ...state.structures, field: false } }, 21))).toBeNull();
    const allSown = withField(state, { strips: Array.from({ length: FIELD_STRIPS }, () => strip({ sownDay: 2 })) });
    expect(fieldNews(...dawnInto(allSown, 21))).toBeNull();
  });

  it('says the grain has turned gold on the dawn it ripens, pointing to the workshop until the tools are made', () => {
    const state = sownOn(fieldCamp(), 22);
    expect(fieldNews(...dawnInto(state, 35))).toBe('The grain has turned gold. Make a sickle and flail at the workshop to bring it in.');
    const tooled = { ...state, progress: { ...state.progress, workshop: { ...state.progress.workshop, harvestTools: true } } };
    expect(fieldNews(...dawnInto(tooled, 35))).toBe('The grain has turned gold. It\'s ready to cut.');
    expect(fieldNews(...dawnInto(state, 34))).toBeNull();
    expect(fieldNews(...dawnInto(state, 36))).toBeNull();
    expect(fieldNews(...dawnInto(withField(state, { strips: [strip({ sownDay: 22, cut: true }), strip(), strip(), strip()] }), 35))).toBeNull();
    expect(fieldNews(state, { ...state, timeOfDay: 10 })).toBeNull();
  });

  it('is part of the news between two moments', () => {
    const state = withField(fieldCamp(), { seed: 2 });
    expect(newsBetween(...dawnInto(state, 21))).toContain('The ground is soft. Time to sow the field.');
  });
});

describe('the harvest in the year journal', () => {
  const tooled = (state: GameState): GameState => ({ ...state, progress: { ...state.progress, workshop: { ...state.progress.workshop, harvestTools: true } } });

  it('writes down the grain brought in on a summer threshing', () => {
    const state = withField(tooled(fieldCamp({ granary: true })), { strips: [strip({ sownDay: 22, cut: true }), strip(), strip(), strip()] });
    const summer = { ...state, day: 36 };
    const action = { type: 'threshStrip', index: 0 } as const;
    const { state: written, messages } = recordJournal(summer, applyAction(summer, action).state, action);
    expect(written.journal.map(entry => entry.id)).toContain('grainIn');
    expect(messages).toContain('Written in your journal: Brought the grain in. The granary smells of summer.');
  });

  it('writes nothing when the granary was already full and no grain went in', () => {
    const state = withField(tooled(fieldCamp({ granary: true })), { strips: [strip({ sownDay: 22, cut: true }), strip(), strip(), strip()], grain: 16 });
    const summer = { ...state, day: 36 };
    const action = { type: 'threshStrip', index: 0 } as const;
    const ids = recordJournal(summer, applyAction(summer, action).state, action).state.journal.map(entry => entry.id);
    expect(ids).not.toContain('grainIn');
  });

  it('writes down grain threshed in autumn on the autumn page', () => {
    const state = withField(tooled(fieldCamp({ granary: true })), { strips: [strip({ sownDay: 22, cut: true }), strip(), strip(), strip()] });
    const autumn = { ...state, day: 43 };
    const action = { type: 'threshStrip', index: 0 } as const;
    const { state: written, messages } = recordJournal(autumn, applyAction(autumn, action).state, action);
    expect(written.journal.map(entry => entry.id)).toContain('autumnGrain');
    expect(written.journal.map(entry => entry.id)).not.toContain('grainIn');
    expect(messages).toContain('Written in your journal: Threshed the grain with the leaves coming down.');
    expect(journalSeason('autumnGrain')).toBe('autumn');
  });

  it('writes nothing for an autumn threshing into a full granary', () => {
    const state = withField(tooled(fieldCamp({ granary: true })), { strips: [strip({ sownDay: 22, cut: true }), strip(), strip(), strip()], grain: 16 });
    const autumn = { ...state, day: 43 };
    const action = { type: 'threshStrip', index: 0 } as const;
    expect(recordJournal(autumn, applyAction(autumn, action).state, action).state.journal.map(entry => entry.id)).not.toContain('autumnGrain');
  });

  it('writes down a summer loaf from the new grain', () => {
    const base = fieldCamp();
    const state = { ...base, day: 37, timeOfDay: nightStart(37) + 5, fireFuel: 60, inventory: { ...base.inventory, food: addFood(emptyFood(), 'flour', 1, 37) } };
    const action = { type: 'cook', dish: 'loaf' } as const;
    const { state: written, messages } = recordJournal(state, applyAction(state, action).state, action);
    expect(written.journal.map(entry => entry.id)).toContain('summerBread');
    expect(messages).toContain('Written in your journal: The first loaf from the new grain, still warm.');
    expect(journalSeason('summerBread')).toBe('summer');
  });

  it('writes down the first winter loaf, and not as an ordinary winter supper', () => {
    const base = fieldCamp();
    const state = { ...base, day: 12, timeOfDay: nightStart(12) + 5, fireFuel: 60, inventory: { ...base.inventory, food: addFood(emptyFood(), 'flour', 1, 12) } };
    const action = { type: 'cook', dish: 'loaf' } as const;
    const ids = recordJournal(state, applyAction(state, action).state, action).state.journal.map(entry => entry.id);
    expect(ids).toContain('winterBread');
    expect(ids).not.toContain('winterCooking');
    expect(journalEntry('winterBread')!.lines[0]).toBe('Bread from my own field, warm by the fire.');
  });
});

describe('the field and granary in camp', () => {
  const FIELD_SPOT = { x: campX - 1.5, y: campY + 7 };
  const GRANARY_SPOT = { x: campX + 3, y: campY + 4.5 };
  const others = (id: string) => [{ x: campX - 3, y: campY - 2 },
    ...CAMP_STRUCTURES.filter(([other]) => other !== id).map(([, dx, dy]) => ({ x: campX + dx, y: campY + dy }))];
  const textures = (state: GameState, prefix: string) => sceneVisuals(state, 0).filter(visual => visual.id.startsWith(prefix)).map(visual => visual.texture);

  it('stands the granary on the south near ground and the field beyond it, on the far ground', () => {
    expect(CAMP_STRUCTURES).toContainEqual(['granary', 3, 4.5]);
    expect(CAMP_STRUCTURES).toContainEqual(['field', -1.5, 7]);
    expect(inClearing(GRANARY_SPOT.x, GRANARY_SPOT.y, ['south-near'])).toBe(true);
    expect(inClearing(GRANARY_SPOT.x, GRANARY_SPOT.y, [])).toBe(false);
    expect(inClearing(FIELD_SPOT.x, FIELD_SPOT.y, ['south-near'])).toBe(false);
    for (const dx of FIELD_STRIP_OFFSETS) expect(inClearing(FIELD_SPOT.x + dx, FIELD_SPOT.y, ['south-near', 'south-far']), `strip at ${dx}`).toBe(true);
  });

  it('keeps 2 tiles from the shelter and the other camp buildings, and clear of the paths', () => {
    for (const [id, spot] of [['granary', GRANARY_SPOT], ['field', FIELD_SPOT]] as const) {
      for (const other of others(id)) expect(Math.hypot(spot.x - other.x, spot.y - other.y), `${id} by ${other.x},${other.y}`).toBeGreaterThanOrEqual(2);
      for (const [dx, dy] of PATH_DESTINATIONS) expect(segmentDistance(spot.x, spot.y, dx, dy)).toBeGreaterThanOrEqual(1.5);
    }
  });

  it('shows the sites once the ground is clear, then the granary filling and the strips as they grow', () => {
    const bare = fieldCamp({ field: false });
    expect(textures(bare, 'field')).toEqual(['fieldSite:still']);
    expect(textures(bare, 'granary')).toEqual(['granarySite:still']);
    expect(textures({ ...bare, clearing: { cleared: ['south-near'], marked: null, felled: [] } }, 'field')).toEqual([]);
    expect(textures(fieldCamp(), 'granary')).toEqual(['granarySite:still']);
    const growing = withField({ ...fieldCamp({ granary: true }), day: 36 }, {
      grain: 5, strips: [strip(), strip({ sownDay: 22 }), strip({ sownDay: 22, cut: true }), strip({ sownDay: 21 })]
    });
    expect(textures(growing, 'granary')).toEqual(['granary:some']);
    expect(textures(withField(growing, { grain: 0 }), 'granary')).toEqual(['granary:empty']);
    expect(textures(withField(growing, { grain: 16 }), 'granary')).toEqual(['granary:full']);
    expect(textures(growing, 'field')).toEqual(['fieldStrip:bare', 'fieldStrip:gold', 'fieldStrip:stooks', 'fieldStrip:gold']);
    expect(textures({ ...growing, day: 32 }, 'field-strip-3')).toEqual(['fieldStrip:green']);
    expect(textures({ ...growing, day: 25 }, 'field-strip-3')).toEqual(['fieldStrip:shoots']);
  });

  it('shows the wild grain in its seasons, and gathered once taken', () => {
    const state = fieldCamp({ field: false });
    expect(textures({ ...state, day: 2 }, 'wildGrain')).toEqual(['wildGrain:ready']);
    expect(textures({ ...state, day: 12 }, 'wildGrain')).toEqual([]);
    const taken = { ...state, day: 2, nodes: state.nodes.map(node => node.kind === 'wildGrain' ? { ...node, amount: 0 } : node) };
    expect(textures(taken, 'wildGrain')).toEqual(['wildGrain:gathered']);
  });

  it('draws every stage of a strip, the granary filling, and both sites, edged in dark wood', () => {
    expect(Object.keys(sprites.fieldStrip.frames).sort()).toEqual(['bare', 'gold', 'green', 'shoots', 'stooks']);
    expect(Object.keys(sprites.granary.frames).sort()).toEqual(['empty', 'full', 'some']);
    for (const id of ['fieldSite', 'granarySite']) expect(sprites[id].frames.still, id).toBeDefined();
    for (const id of ['fieldStrip', 'granary']) {
      for (const frame of Object.values(sprites[id].frames)) {
        expect(frame.join('').split('').map(symbol => sprites[id].legend[symbol])).toContain('wood0');
      }
    }
    const frames = Object.values(sprites.fieldStrip.frames).map(frame => frame.join(''));
    expect(new Set(frames).size).toBe(frames.length);
  });
});

describe('the field clear of the camp\'s trees', () => {
  it('keeps every strip a tree\'s width from the trees that stand at camp', () => {
    const spot = { x: campX - 1.5, y: campY + 7 };
    for (const dx of FIELD_STRIP_OFFSETS) for (const tree of createGame().trees) {
      expect(Math.hypot(spot.x + dx - tree.x, spot.y - tree.y), `strip at ${dx} by ${tree.id}`).toBeGreaterThanOrEqual(2);
    }
  });
});

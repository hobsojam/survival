import { describe, expect, it } from 'vitest';
import { journalEntry, recordJournal } from '../src/game/journalEntries';
import { applyAction } from '../src/game/rules';
import type { GameState } from '../src/game/state';
import { townNews } from '../src/game/traveller';
import { currentPage, journalPageView } from '../src/ui/yearJournal';
import { MILESTONE_SITE } from '../src/game/roadSites';
import { BRIDGE_SITE } from '../src/game/bridgeSites';
import { finishedCastleCamp, street } from './townStreet';

// EASTER EGG: the town, see src/game/town.ts. The bridge and the meadow road, in the mornings and in the year journal.

const built = (doneDay: number) => ({ stone: 30, beams: 4, fittings: 1, doneDay });
const DAY = 75;

/** Eight houses on a summer day, the survivor rested, with the bridge and the road as given. */
const town = (change: (state: GameState) => void = () => {}): GameState => {
  const state = finishedCastleCamp();
  state.day = DAY;
  state.town.houses = street(...Array.from({ length: 8 }, (_, i) => built(20 + i)));
  state.player = { ...state.player, energy: 100 };
  change(state);
  return state;
};
const finishing = () => town(state => {
  state.area = 'hills';
  state.town.bridge = { stone: 50, beams: 4, fittings: 1, doneDays: { piers: 60, arch: 70 } };
  state.castle.goods.fittings = 1;
  state.player = { ...state.player, x: BRIDGE_SITE.x, y: BRIDGE_SITE.y - 0.6 };
});
const bridged = (state: GameState) => {
  state.town.bridge = { stone: 50, beams: 4, fittings: 2, doneDays: { piers: 60, arch: 70, parapet: DAY - 5 } };
};
const nextMorning = (state: GameState): GameState => ({ ...state, day: state.day + 1, timeOfDay: 1 });
const lines = (state: GameState) => journalPageView(state, currentPage(state.day)).entries.map(entry => entry.line);

describe('the mornings after', () => {
  it('tells of the bridge the morning after it is finished, once', () => {
    const done = applyAction(finishing(), { type: 'bridgeWork' }).state;
    expect(townNews(done, nextMorning(done))).toContain('The bridge over the stream is finished.');
    const later = nextMorning(done);
    expect(townNews(later, nextMorning(later))).not.toContain('The bridge over the stream is finished.');
  });

  it('tells of the road and the milestone the morning after each', () => {
    const road = town(state => { bridged(state); state.town.road = { cleared: 6, work: 0, milestone: 0, doneDays: { road: DAY } }; });
    expect(townNews(road, nextMorning(road))).toEqual(['The old road through the meadow is clear.']);
    const stone = town(state => { bridged(state); state.town.road = { cleared: 6, work: 0, milestone: 6, doneDays: { road: DAY - 3, milestone: DAY } }; });
    expect(townNews(stone, nextMorning(stone))).toEqual(['The milestone stands by the meadow road.']);
  });
});

describe('the year journal', () => {
  const BRIDGE_LINE = 'Built a bridge over the stream, and found the meadow beyond.';
  const ROAD_LINE = 'Cleared the old road and set a milestone by it.';

  it('writes the bridge when the survivor first comes out in the meadow, once, and leaves no blank before', () => {
    const before = town(bridged);
    const blanks = journalPageView(before, currentPage(DAY)).blanks;
    expect(lines(before)).not.toContain(BRIDGE_LINE);
    const atBridge = { ...before, area: 'hills' as const, player: { ...before.player, x: 25, y: 28.9 } };
    const crossed = applyAction(atBridge, { type: 'move', dx: 0, dy: 1 });
    const written = recordJournal(atBridge, crossed.state, { type: 'move', dx: 0, dy: 1 }).state;
    const entry = written.journal.find(each => each.id.startsWith('meadowFound'));
    expect(entry && journalEntry(entry.id)?.lines[entry.variant]).toBe(BRIDGE_LINE);
    expect(lines(written)).toContain(BRIDGE_LINE);
    expect(journalPageView(written, currentPage(DAY)).blanks).toBe(blanks);
    const back = { ...written, area: 'hills' as const, progress: { ...written.progress } };
    expect(recordJournal(back, written).state.journal.filter(each => each.id.startsWith('meadowFound'))).toHaveLength(1);
  });

  it('writes the road when the milestone stands, once', () => {
    const before = town(state => {
      bridged(state);
      state.area = 'meadow';
      state.progress.meadowFound = true;
      state.inventory.stone = 2;
      state.town.road = { cleared: 6, work: 0, milestone: 5, doneDays: { road: DAY - 2 } };
      state.player = { ...state.player, x: MILESTONE_SITE.x, y: MILESTONE_SITE.y - 0.5 };
    });
    expect(lines(before)).not.toContain(ROAD_LINE);
    const done = applyAction(before, { type: 'roadWork' }).state;
    const written = recordJournal(before, done, { type: 'roadWork' }).state;
    expect(lines(written)).toContain(ROAD_LINE);
    expect(recordJournal(written, { ...done, journal: written.journal }).state.journal.filter(each => each.id.startsWith('meadowRoad'))).toHaveLength(1);
  });
});

import { describe, expect, it } from 'vitest';
import type { Season } from '../src/game/calendar';
import { NEEDS, WALLS, emptyCastle, isRevealed, treeUnderWall } from '../src/game/castle';
import { castleNews, castlePrompt, castleSpots, castleWorkBlocker, castleWorkLine, nearestCastleSpot, siteNeed } from '../src/game/castleSites';
import { HILLS_EXIT, QUARRY_HILLS_EXIT } from '../src/game/hills';
import { QUARRY_SITE } from '../src/game/areas';
import { TOO_TIRED_MESSAGE, workSeconds } from '../src/game/needs';
import { newsBetween } from '../src/game/news';
import { upgradeBlocker } from '../src/game/workshop';
import { recordJournal } from '../src/game/journalEntries';
import { KEEP_SITE, KEEP_STONES } from '../src/game/keep';
import { applyAction } from '../src/game/rules';
import { BALANCE, createGame, type GameState } from '../src/game/state';
import { actionEffect, actionPose, promptFor, useKeyAction } from '../src/scene/prompts';
import { HILL_TREES, sceneVisuals } from '../src/scene/visuals';
import { journalPageView } from '../src/ui/yearJournal';

const game = createGame();
const finishedKeep = (day = 5): GameState => ({
  ...game, day, timeOfDay: 40, area: 'hills', player: { ...game.player, ...KEEP_SITE },
  progress: { ...game.progress, hillsFound: true, workshop: { ...game.progress.workshop, forge: true } },
  keep: { ...game.keep, stones: KEEP_STONES }
});
const climb = (state: GameState): GameState => applyAction(state, { type: 'climbKeep' }).state;
const later = (state: GameState): GameState => ({ ...state, day: state.day + 1, timeOfDay: 40 });
const revealed = (day = 5): GameState => ({ ...finishedKeep(day), castle: { ...emptyCastle(), firstClimbDay: day - 1, revealedDay: day } });
const BY_THE_LINE = { x: 18, y: 13 };

describe('seeing the line of stones', () => {
  it('the first climb only records the day', () => {
    const after = climb(finishedKeep());
    expect(after.castle.firstClimbDay).toBe(after.day);
    expect(isRevealed(after)).toBe(false);
  });

  it('a second climb the same day reveals nothing', () => {
    const after = climb(climb(finishedKeep()));
    expect(after.castle.firstClimbDay).toBe(5);
    expect(after.castle.revealedDay).toBeNull();
  });

  it.each([[2, 'autumn'], [12, 'winter'], [22, 'spring'], [32, 'summer']] as [number, Season][])('a climb on a later day reveals the line, in %s', (day) => {
    const first = climb(finishedKeep(day));
    const result = applyAction(later(first), { type: 'climbKeep' });
    expect(result.state.castle.revealedDay).toBe(day + 1);
    expect(result.state.castle.firstClimbDay).toBe(day);
    expect(result.message).toBe('');
  });

  it('a refused climb records nothing', () => {
    const night = { ...finishedKeep(), timeOfDay: 190 };
    expect(applyAction(night, { type: 'climbKeep' }).state.castle).toEqual(emptyCastle());
  });

  it('pins the walls around the keep', () => {
    expect(WALLS).toEqual({ left: 13, right: 24, top: 5, bottom: 15 });
    expect(KEEP_SITE.x).toBeGreaterThan(WALLS.left);
    expect(KEEP_SITE.x).toBeLessThan(WALLS.right);
    expect(KEEP_SITE.y).toBeGreaterThan(WALLS.top);
    expect(KEEP_SITE.y).toBeLessThan(WALLS.bottom);
  });

  it('shows no castle visual before the reveal, and the line after it', () => {
    const ids = (state: GameState): string[] => sceneVisuals(state, 0).map(visual => visual.id);
    expect(ids(finishedKeep()).filter(id => id.startsWith('castle'))).toEqual([]);
    expect(ids(climb(finishedKeep())).filter(id => id.startsWith('castle'))).toEqual([]);
    expect(ids(revealed())).toContain('castle-line');
  });

  it('shows the line on the hills only', () => {
    expect(sceneVisuals({ ...revealed(), area: 'camp' }, 0).some(visual => visual.id === 'castle-line')).toBe(false);
  });

  it('keeps every hill tree today, since none stand inside the walls', () => {
    const count = (state: GameState): number => sceneVisuals(state, 0).filter(visual => visual.id.startsWith('hill-tree-')).length;
    expect(count(revealed())).toBe(HILL_TREES.length);
  });

  it('clears a tree inside the walls once the wall side nearest it starts, not before', () => {
    const tree = { x: 15, y: 10 };
    const castle = emptyCastle();
    expect(treeUnderWall(castle, tree)).toBe(false);
    expect(treeUnderWall({ ...castle, wall: { ...castle.wall, east: 5, north: 5, south: 5 } }, tree)).toBe(false);
    expect(treeUnderWall({ ...castle, wall: { ...castle.wall, west: 1 } }, tree)).toBe(true);
    expect(treeUnderWall({ ...castle, wall: { ...castle.wall, west: 1 } }, { x: 22, y: 10 })).toBe(false);
    expect(treeUnderWall({ ...castle, wall: { ...castle.wall, west: 1 } }, { x: 30, y: 10 })).toBe(false);
  });
});

describe('the line of stones in the journal', () => {
  const page = (day: number): number => Math.floor((day - 1) / 10);
  const lineIds = (state: GameState): string[] => state.journal.filter(entry => entry.id.startsWith('castleLine')).map(entry => entry.id);
  const reveal = (day: number): { before: GameState; after: GameState } => {
    const before = { ...finishedKeep(day), castle: { ...emptyCastle(), firstClimbDay: day - 1 } };
    return { before, after: climb(before) };
  };

  it.each([[2, 'castleLineAutumn'], [12, 'castleLineWinter'], [22, 'castleLineSpring'], [32, 'castleLineSummer']])('revealing on day %i writes %s once', (day, id) => {
    const { before, after } = reveal(day);
    const written = recordJournal(before, after, { type: 'climbKeep' });
    expect(lineIds(written.state)).toEqual([id]);
    const next = later(written.state);
    expect(lineIds(recordJournal(written.state, climb(next), { type: 'climbKeep' }).state)).toEqual([id]);
  });

  it('writes nothing for the first climb', () => {
    const before = finishedKeep(2);
    expect(lineIds(recordJournal(before, climb(before), { type: 'climbKeep' }).state)).toEqual([]);
  });

  it('is never a blank, and only shows on its page once written', () => {
    const { before, after } = reveal(2);
    const { state } = recordJournal(before, after, { type: 'climbKeep' });
    const without = { ...state, journal: state.journal.filter(entry => !entry.id.startsWith('castleLine')) };
    expect(journalPageView(without, page(2)).blanks).toBe(journalPageView(state, page(2)).blanks);
    expect(journalPageView(state, page(2)).entries).toHaveLength(journalPageView(without, page(2)).entries.length + 1);
    expect(journalPageView(state, page(2)).entries.map(entry => entry.line)).toContain('A line of old stones showed in the grass below the keep.');
  });
});

describe('standing near the line', () => {
  it('names the old stones once the line has shown', () => {
    const near = { ...revealed(), player: { ...revealed().player, ...BY_THE_LINE } };
    expect(promptFor(near)).toBe('Old stones · a wall could run here');
  });

  it('says nothing about them before the reveal, or far from the line', () => {
    const unseen = { ...finishedKeep(), player: { ...finishedKeep().player, ...BY_THE_LINE } };
    expect(promptFor(unseen)).not.toContain('Old stones');
    const far = { ...revealed(), player: { ...revealed().player, x: 30, y: 25 } };
    expect(promptFor(far)).not.toContain('Old stones');
  });
});

/** Revealed, standing at the road's head with stone in the bag and the road at `road` stones. */
const atRoad = (road: number, changes: Partial<GameState> = {}): GameState => {
  const base = { ...revealed(), castle: { ...revealed().castle, road }, inventory: { ...game.inventory, stone: 5 }, ...changes };
  const spot = castleSpots(base)[0];
  return { ...base, area: spot.area, player: { ...base.player, x: spot.x, y: spot.y, energy: 100 } };
};
const work = (state: GameState) => applyAction(state, { type: 'castleWork', site: 'road' });

describe('the road: where it is', () => {
  it('has no spots before the line shows, and refuses the work', () => {
    const unseen = { ...finishedKeep(), inventory: { ...game.inventory, stone: 5 } };
    expect(castleSpots(unseen)).toEqual([]);
    expect(nearestCastleSpot(unseen)).toBeNull();
    const result = work(unseen);
    expect(result.state).toBe(unseen);
    expect(result.message).toBe('There is nothing to build here yet.');
  });

  it('opens on the quarry floor, between the face and the west edge', () => {
    const [spot, ...rest] = castleSpots(revealed());
    expect(rest).toEqual([]);
    expect(spot.site).toBe('road');
    expect(spot.area).toBe('quarry');
    expect(spot.x).toBeGreaterThan(QUARRY_HILLS_EXIT.x);
    expect(spot.x).toBeLessThan(QUARRY_SITE.x);
  });

  it('keeps the first ten stones on the quarry, running to its west edge', () => {
    const heads = Array.from({ length: 11 }, (_, road) => castleSpots(atRoad(road))[0]);
    expect(heads.slice(0, 10).every(spot => spot.area === 'quarry')).toBe(true);
    expect(heads[9].x).toBeCloseTo(QUARRY_HILLS_EXIT.x, 0);
    expect(heads[9].y).toBeCloseTo(QUARRY_HILLS_EXIT.y, 0);
    expect(heads[10].area).toBe('hills');
    const xs = heads.slice(0, 10).map(spot => spot.x);
    expect([...xs].sort((a, b) => b - a)).toEqual(xs);
  });

  it('runs the next twenty along the hills path to the keep door', () => {
    const heads = Array.from({ length: 20 }, (_, i) => castleSpots(atRoad(10 + i))[0]);
    expect(heads.every(spot => spot.area === 'hills')).toBe(true);
    expect(Math.hypot(heads[0].x - HILLS_EXIT.x, heads[0].y - HILLS_EXIT.y)).toBeLessThan(3);
    expect(heads[19].x).toBeCloseTo(KEEP_SITE.x, 0);
    expect(heads[19].y).toBeCloseTo(KEEP_SITE.y + 1, 0);
    const keepGap = heads.map(spot => Math.hypot(spot.x - KEEP_SITE.x, spot.y - KEEP_SITE.y));
    expect(keepGap[0]).toBeGreaterThan(keepGap[19]);
  });

  it('has no spot once the road is finished', () => {
    expect(castleSpots(atRoad(29, { area: 'hills' })).length).toBe(1);
    const done = { ...revealed(), castle: { ...revealed().castle, road: NEEDS.road } };
    expect(castleSpots(done)).toEqual([]);
    expect(siteNeed(done, 'road')).toBeNull();
  });

  it('finds the nearest spot only in the area the survivor is in', () => {
    expect(nearestCastleSpot(atRoad(0))?.site).toBe('road');
    expect(nearestCastleSpot({ ...atRoad(0), area: 'hills' })).toBeNull();
  });

  it('asks for a stone, and says later sites are not open', () => {
    expect(siteNeed(revealed(), 'road')).toEqual({ kind: 'stone' });
    expect(castleSpots(revealed()).map(spot => spot.site)).toEqual(['road']);
    const refused = applyAction(atRoad(0), { type: 'castleWork', site: 'frames' });
    expect(refused.message).toBe('There is nothing to build here yet.');
    expect(refused.state.castle).toEqual(atRoad(0).castle);
  });
});

describe('the road: laying stones', () => {
  it('takes one stone from the bag and half a dig of time and energy', () => {
    const before = atRoad(0);
    const { state, message } = work(before);
    expect(state.castle.road).toBe(1);
    expect(state.inventory.stone).toBe(4);
    expect(state.player.energy).toBeCloseTo(before.player.energy - BALANCE.digEnergyCost / 2);
    expect(state.timeOfDay).toBeCloseTo(before.timeOfDay + workSeconds(before, BALANCE.digSeconds / 2));
    expect(message).toBe('You lay the first stone of a road.');
  });

  it('moves the head on with each stone', () => {
    const before = atRoad(3);
    const after = work(before).state;
    expect(castleSpots(after)[0]).not.toEqual(castleSpots(before)[0]);
  });

  it('crosses from the quarry to the hills at the eleventh stone', () => {
    const tenth = work(atRoad(9)).state;
    expect(tenth.castle.road).toBe(10);
    expect(tenth.area).toBe('quarry');
    expect(work(tenth).message).toBe('Move closer to the road.');
    const eleventh = work(atRoad(10)).state;
    expect(eleventh.castle.road).toBe(11);
    expect(castleSpots(eleventh)[0].area).toBe('hills');
  });

  it('refuses when too far, when the bag is empty, and when too tired', () => {
    const far = atRoad(0);
    const farAway = { ...far, player: { ...far.player, x: far.player.x + 5 } };
    expect(castleWorkBlocker(farAway, 'road')).toBe('Move closer to the road.');
    expect(work(farAway).state).toBe(farAway);
    const empty = { ...far, inventory: { ...far.inventory, stone: 0 } };
    expect(castleWorkBlocker(empty, 'road')).toBe('Bring stone to lay the road.');
    expect(work(empty).message).toBe('Bring stone to lay the road.');
    const tired = { ...far, player: { ...far.player, energy: 0 } };
    expect(castleWorkBlocker(tired, 'road')).toBe(TOO_TIRED_MESSAGE);
    expect(work(tired).state).toBe(tired);
    expect(castleWorkBlocker(far, 'road')).toBeNull();
  });

  it('refuses from the wrong area, and once the road is done', () => {
    expect(castleWorkBlocker({ ...atRoad(0), area: 'hills' }, 'road')).toBe('Move closer to the road.');
    const done = atRoad(29, { area: 'hills' });
    const finished = work(done).state;
    expect(castleWorkBlocker(finished, 'road')).toBe('The road is finished.');
    expect(work(finished).state).toBe(finished);
  });

  it.each([[0, 'You lay the first stone of a road.'], [9, 'The road reaches the edge of the quarry.'], [19, 'The road is halfway to the keep.'], [28, 'You lay another stone of the road.'], [29, 'You lay the last stone. The road runs from the quarry to the keep.']])('says the right thing when stone %i is laid', (road, line) => {
    expect(castleWorkLine(atRoad(road), work(atRoad(road)).state)).toBe(line);
    expect(work(atRoad(road)).message).toBe(line);
  });

  it('marks the day the road was finished, and no sooner', () => {
    expect(work(atRoad(28)).state.castle.roadDay).toBeNull();
    expect(work(atRoad(29)).state.castle.roadDay).toBe(5);
  });

  it('lets the workshop offer the cart once the road is done', () => {
    const shod = { ...game.pony, shod: 2, won: 1 };
    const workshopState = (road: number): GameState => ({
      ...game, structures: { ...game.structures, workshop: true }, pony: shod, castle: { ...emptyCastle(), road, revealedDay: 5, firstClimbDay: 4 },
      progress: { ...game.progress, workshop: { ...game.progress.workshop, forge: true } }, inventory: { ...game.inventory, wood: 20, ore: 4 }
    });
    expect(upgradeBlocker(workshopState(29), 'stoneCart')).toBe('The cart needs the finished road and a shod pony.');
    expect(upgradeBlocker(workshopState(30), 'stoneCart')).toBeNull();
  });
});

describe('the road: the morning after', () => {
  it('has a note on the dawn after the last stone, once', () => {
    const done = work(atRoad(29)).state;
    const next = { ...done, day: done.day + 1, timeOfDay: 5 };
    expect(castleNews(done, next)).toEqual(['The road is finished. The pony could pull a cart along it now.']);
    expect(newsBetween(done, next)).toContain('The road is finished. The pony could pull a cart along it now.');
    expect(castleNews(next, { ...next, day: next.day + 1 })).toEqual([]);
    expect(castleNews(done, { ...done, timeOfDay: done.timeOfDay + 1 })).toEqual([]);
  });

  it('has nothing for a road still being laid', () => {
    const before = work(atRoad(5)).state;
    expect(castleNews(before, { ...before, day: before.day + 1 })).toEqual([]);
  });
});

describe('the road: prompts, keys and sprites', () => {
  it('says what the road asks for, and lays on the key', () => {
    const state = atRoad(2);
    expect(promptFor(state)).toBe('E  Lay a road stone (2/30)');
    expect(useKeyAction(state)).toEqual({ type: 'castleWork', site: 'road' });
    expect(castlePrompt(state, castleSpots(state)[0])).toBe('Lay a road stone (2/30)');
  });

  it('asks for stone when the bag is empty, with nothing to press', () => {
    const state = atRoad(2, { inventory: { ...game.inventory, stone: 0 } });
    expect(promptFor(state)).toBe('Road · bring stone to lay it');
    expect(useKeyAction(state)).toBeUndefined();
  });

  it('shows the same on the hills end of the road', () => {
    const state = atRoad(12);
    expect(state.area).toBe('hills');
    expect(promptFor(state)).toBe('E  Lay a road stone (12/30)');
  });

  it('shows nothing about the road before the line has shown', () => {
    const unseen = { ...finishedKeep(), area: 'quarry' as const, player: { ...game.player, x: 8, y: 13 } };
    expect(promptFor(unseen)).not.toContain('road');
  });

  it('draws a stone for each one laid, only in the area it lies in, once the line has shown', () => {
    const ids = (state: GameState): string[] => sceneVisuals(state, 0).map(visual => visual.id).filter(id => id.startsWith('castle-road'));
    expect(ids(atRoad(0))).toEqual([]);
    expect(ids(atRoad(4))).toHaveLength(4);
    expect(ids(atRoad(14, { area: 'hills' }))).toHaveLength(4);
    expect(ids({ ...atRoad(14), area: 'camp' })).toEqual([]);
  });

  it('plays the dust and the build sound pose for a stone laid', () => {
    const after = work(atRoad(2)).state;
    expect(actionEffect({ type: 'castleWork', site: 'road' }, after)).toEqual({ kind: 'dust', x: after.player.x, y: after.player.y });
    expect(actionPose('castleWork')).toBe('gather');
  });
});

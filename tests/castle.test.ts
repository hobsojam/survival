import { describe, expect, it } from 'vitest';
import type { Season } from '../src/game/calendar';
import { MOAT_TILES, NEEDS, castleFinished, everyOtherSectionDone, hallFinished, moatPiece, WALLS, emptyCastle, isRevealed, moatFill, moatLevel, treeUnderWall, type Tower } from '../src/game/castle';
import { rainWindow } from '../src/game/rain';
import { season } from '../src/game/calendar';
import { buildMap } from '../src/scene/map';
import { moatAt } from '../src/scene/hillsGeometry';
import { roadStone } from '../src/game/castleSites';
import { PASSAGE_H, castleSprites } from '../src/art/castleSprites';
import { castleView } from '../src/scene/keepViewCamp';
import { CART_SPOTS, GATE_SPOT, cartFollows, cartRoom, castleNews, castlePrompt, castleSpots, castleWorkBlocker, castleWorkLine, nearestCastleSpot, siteNeed, spendCastleStone } from '../src/game/castleSites';
import { availableStone, availableWood } from '../src/game/camp';
import { pickTapTarget, targetAction } from '../src/scene/tapTarget';
import { HILLS_EXIT, OUTCROP_SITE, QUARRY_HILLS_EXIT } from '../src/game/hills';
import { QUARRY_SITE, RUBBLE_SITE } from '../src/game/areas';
import { TOO_TIRED_MESSAGE, workSeconds } from '../src/game/needs';
import { newsBetween } from '../src/game/news';
import { upgradeBlocker } from '../src/game/workshop';
import { FRAMES_SPOT, GOODS, HALL_SPOT, goodBatch, goodBlocker, goodRoom } from '../src/game/castleSites';
import { HALL_DOOR, HALL_STEPS } from '../src/art/castleSprites';
import { keepSprites } from '../src/art/keepSprites';
import { hallStep } from '../src/scene/visuals';
import { JOURNAL_PAGES, journalEntry, recordJournal } from '../src/game/journalEntries';
import { JOURNAL_ICONS } from '../src/art/journalIcons';
import { emptyFood, foodCount, spoil } from '../src/game/food';
import { HALL_LANTERN, HALL_WINDOW_OFFSET, hallWindowGlow } from '../src/scene/lighting';
import { KEEP_SITE, KEEP_STONES } from '../src/game/keep';
import { FULL_BAG_MESSAGE, applyAction, type GameAction } from '../src/game/rules';
import { BALANCE, createGame, type GameState } from '../src/game/state';
import { actionEffect, actionPose, promptFor, useKeyAction } from '../src/scene/prompts';
import { HILL_TREES, playerVisualDepth, sceneVisuals } from '../src/scene/visuals';
import { journalPageView } from '../src/ui/yearJournal';
import { effectVisuals } from '../src/scene/effectVisuals';
import { workshopView } from '../src/ui/panels';

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
    expect(Math.hypot(heads[19].x - KEEP_SITE.x, heads[19].y - KEEP_SITE.y)).toBeLessThan(3.5);
    const keepGap = heads.map(spot => Math.hypot(spot.x - KEEP_SITE.x, spot.y - KEEP_SITE.y));
    expect(keepGap[0]).toBeGreaterThan(keepGap[19]);
  });

  it('has no spot once the road is finished', () => {
    expect(castleSpots(atRoad(29, { area: 'hills' }))).toHaveLength(1);
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

describe('the road: out of the way of other work', () => {
  it('keeps every head beyond reach of the quarry face, the rubble and the keep', () => {
    for (let road = 0; road < NEEDS.road; road++) {
      const head = castleSpots(atRoad(road))[0];
      for (const site of [QUARRY_SITE, RUBBLE_SITE, KEEP_SITE]) {
        if (head.area === (site === KEEP_SITE ? 'hills' : 'quarry')) expect(Math.hypot(head.x - site.x, head.y - site.y), `stone ${road + 1}`).toBeGreaterThan(BALANCE.interactionRadius);
      }
    }
  });

  it.each([0, 28, 29])('lays a stone on E at road = %i', road => {
    expect(useKeyAction(atRoad(road))).toEqual({ type: 'castleWork', site: 'road' });
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
    expect(work(atRoad(28)).state.castle.doneDays).toEqual({});
    expect(work(atRoad(29)).state.castle.doneDays).toEqual({ road: 5 });
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

/** Road done, cart made, a shod pony: the survivor stands at the quarry face by day with an empty bag, the cart at the quarry with `stone` in it. */
const withCart = (stone = 0, changes: Partial<GameState> = {}): GameState => {
  const base = revealed();
  return {
    ...base, area: 'quarry', player: { ...base.player, ...QUARRY_SITE, energy: 100 }, inventory: { ...game.inventory, stone: 0 },
    pony: { ...game.pony, won: 1, shod: 2 }, quarryReadyDay: 0, rubbleReadyDay: 0,
    progress: { ...base.progress, quarryFound: true, pickaxeCrafted: true, workshop: { ...base.progress.workshop, stoneCart: true } },
    castle: { ...base.castle, road: NEEDS.road, doneDays: { road: 3 }, cart: { stone, at: 'quarry' } }, ...changes
  };
};
const cartAt = (state: GameState, at: 'quarry' | 'hills', stone = state.castle.cart.stone): GameState => ({ ...state, castle: { ...state.castle, cart: { stone, at } } });
const atRubble = (state: GameState): GameState => ({ ...state, player: { ...state.player, ...RUBBLE_SITE } });
const cross = (state: GameState, to: 'quarry' | 'hills'): GameState => {
  const exit = to === 'hills' ? QUARRY_HILLS_EXIT : HILLS_EXIT;
  const from = { ...state, area: to === 'hills' ? 'quarry' as const : 'hills' as const, player: { ...state.player, x: exit.x, y: exit.y } };
  return applyAction(from, { type: 'cross' }).state;
};
const ironPickaxe = (state: GameState): GameState => ({ ...state, progress: { ...state.progress, workshop: { ...state.progress.workshop, ironPickaxe: true } } });
const dig = (state: GameState) => applyAction(state, { type: 'digQuarry' });

describe('the stone cart: digging into it', () => {
  it('holds forty and has room for what is left, or none before it is made', () => {
    expect(cartRoom(withCart(0))).toBe(NEEDS.cartStone);
    expect(cartRoom(withCart(15))).toBe(25);
    const unmade = withCart(0);
    expect(cartRoom({ ...unmade, progress: { ...unmade.progress, workshop: { ...unmade.progress.workshop, stoneCart: false } } })).toBe(0);
  });

  it('puts a dig at the quarry straight into the cart', () => {
    const result = dig(withCart(3));
    expect(result.state.castle.cart.stone).toBe(4);
    expect(result.state.inventory.stone).toBe(0);
    expect(result.message).toBe('Broke a good stone from the quarry face. It went into the cart.');
  });

  it('splits an iron-pickaxe dig across the cart and the bag when one room is left', () => {
    const result = dig(ironPickaxe(withCart(39)));
    expect(result.state.castle.cart.stone).toBe(40);
    expect(result.state.inventory.stone).toBe(1);
    expect(result.message).toBe('Broke two good stones from the quarry face. One went into the cart.');
  });

  it('puts both stones of an iron-pickaxe dig into the cart when there is room', () => {
    const result = dig(ironPickaxe(withCart(10)));
    expect(result.state.castle.cart.stone).toBe(12);
    expect(result.message).toBe('Broke two good stones from the quarry face. Both went into the cart.');
  });

  it('digs into the bag as before when the cart is full or stands on the hills', () => {
    const full = dig(withCart(40));
    expect(full.state.castle.cart.stone).toBe(40);
    expect(full.state.inventory.stone).toBe(1);
    expect(full.message).toBe('Broke a good stone from the quarry face.');
    const away = dig(cartAt(withCart(0), 'hills'));
    expect(away.state.inventory.stone).toBe(1);
    expect(away.state.castle.cart.stone).toBe(0);
  });

  it('leaves the day\'s dig limit unchanged', () => {
    const first = dig(withCart(0)).state;
    expect(first.quarryReadyDay).toBe(first.day + 1);
    expect(dig(first).message).toBe('The quarry face is worked out until morning.');
  });

  it('refuses with the full-bag line, spending nothing, when the cart and the bag are both full', () => {
    const state = withCart(40, { inventory: { ...game.inventory, stone: 8 } });
    const result = dig(state);
    expect(result.message).toBe(FULL_BAG_MESSAGE);
    expect(result.state.inventory.stone).toBe(8);
    expect(result.state.castle.cart.stone).toBe(40);
    expect(result.state.quarryReadyDay).toBe(state.quarryReadyDay);
    expect(result.state.player.energy).toBe(state.player.energy);
    expect(result.state.timeOfDay).toBe(state.timeOfDay);
  });

  it('digs into a full bag when the cart has room', () => {
    const result = dig(withCart(0, { inventory: { ...game.inventory, stone: 8 } }));
    expect(result.state.castle.cart.stone).toBe(1);
    expect(result.state.inventory.stone).toBe(8);
  });

  it('takes rubble the same way', () => {
    const result = applyAction(atRubble(withCart(5)), { type: 'gatherRubble' });
    expect(result.state.castle.cart.stone).toBe(6);
    expect(result.state.inventory.stone).toBe(0);
    expect(result.message).toBe('Pried a stone from the rubble. It went into the cart.');
    const full = applyAction(atRubble(withCart(40)), { type: 'gatherRubble' });
    expect(full.state.inventory.stone).toBe(1);
    expect(full.message).toBe('Pried a stone from the rubble.');
    const stuck = applyAction(atRubble(withCart(40, { inventory: { ...game.inventory, stone: 8 } })), { type: 'gatherRubble' });
    expect(stuck.message).toBe(FULL_BAG_MESSAGE);
    expect(stuck.state.rubbleReadyDay).toBe(0);
  });

  it('never counts the cart as stone for building, or settles it at camp', () => {
    const state = withCart(30, { storedStone: 2, inventory: { ...game.inventory, stone: 1 } });
    expect(availableStone(state)).toBe(3);
    const camp = applyAction({ ...state, area: 'quarry', player: { ...state.player, x: 39, y: 15 } }, { type: 'cross' }).state;
    expect(camp.area).toBe('camp');
    expect(camp.castle.cart).toEqual({ stone: 30, at: 'quarry' });
    expect(availableStone(camp)).toBe(3);
  });
});

describe('the stone cart: taking stone from it', () => {
  const atCart = (state: GameState): GameState => ({ ...state, player: { ...state.player, ...CART_SPOTS[state.castle.cart.at] }, area: state.castle.cart.at });
  const take = (state: GameState) => applyAction(atCart(state), { type: 'takeCartStone' });

  it('moves a bag\'s worth when the cart holds more', () => {
    const result = take(withCart(30));
    expect(result.state.inventory.stone).toBe(8);
    expect(result.state.castle.cart.stone).toBe(22);
  });

  it('moves what is there when the cart holds less than the bag has room for', () => {
    const result = take(withCart(3, { inventory: { ...game.inventory, stone: 1 } }));
    expect(result.state.inventory.stone).toBe(4);
    expect(result.state.castle.cart.stone).toBe(0);
  });

  it('refuses when the cart is empty, the bag is full or the cart is out of reach', () => {
    expect(take(withCart(0)).message).toBe('The cart is empty.');
    expect(take(withCart(5, { inventory: { ...game.inventory, stone: 8 } })).message).toBe(FULL_BAG_MESSAGE);
    expect(applyAction(withCart(5), { type: 'takeCartStone' }).message).toBe('Move closer to the cart.');
    expect(applyAction(cartAt(atCart(withCart(5)), 'hills'), { type: 'takeCartStone' }).message).toBe('Move closer to the cart.');
  });

  it('works for a tired survivor', () => {
    const tired = withCart(5, { player: { ...game.player, energy: 0 } });
    expect(take(tired).state.inventory.stone).toBe(5);
  });

  it('is a tap on the cart, and E at it, and shows the load in the prompt', () => {
    const state = atCart(withCart(12));
    expect(targetAction(pickTapTarget(state, CART_SPOTS.quarry.x, CART_SPOTS.quarry.y))).toEqual({ type: 'takeCartStone' });
    expect(useKeyAction(state)).toEqual({ type: 'takeCartStone' });
    expect(promptFor(state)).toContain('E  Take stone from the cart (12/40)');
    expect(promptFor(atCart(withCart(0)))).toContain('Cart · empty');
    const hills = atCart(cartAt(withCart(7), 'hills'));
    expect(useKeyAction(hills)).toEqual({ type: 'takeCartStone' });
    expect(promptFor(hills)).toContain('(7/40)');
  });

  it('shows no cart before it is made, and none where it does not stand', () => {
    const unmade = withCart(0);
    const state = { ...unmade, player: { ...unmade.player, ...CART_SPOTS.quarry }, progress: { ...unmade.progress, workshop: { ...unmade.progress.workshop, stoneCart: false } } };
    expect(promptFor(state)).not.toContain('art');
    expect(useKeyAction(state)).toBeUndefined();
    expect(useKeyAction({ ...atCart(withCart(5)), area: 'hills' })).toBeUndefined();
  });

  it('keeps the cart out of reach of every other place to act, so E does what it did before', () => {
    for (const at of ['quarry', 'hills'] as const) {
      const spot = CART_SPOTS[at];
      const others = at === 'quarry' ? [QUARRY_SITE, RUBBLE_SITE, QUARRY_HILLS_EXIT, { x: 39, y: 15 }] : [KEEP_SITE, HILLS_EXIT, { x: 10, y: 7 }];
      for (const other of others) expect(Math.hypot(spot.x - other.x, spot.y - other.y), `${at} ${other.x},${other.y}`).toBeGreaterThan(BALANCE.interactionRadius * 2);
      for (let road = 0; road < NEEDS.road; road++) {
        const head = roadHead(road);
        if (head.area === at) expect(Math.hypot(spot.x - head.x, spot.y - head.y), `stone ${road + 1}`).toBeGreaterThan(BALANCE.interactionRadius * 2);
      }
    }
  });

  it('leaves E at the quarry face and the road to what they were', () => {
    expect(useKeyAction(withCart(12))).toEqual({ type: 'digQuarry' });
    expect(useKeyAction(atRoad(0, { progress: withCart().progress }))).toEqual({ type: 'castleWork', site: 'road' });
  });
});

const roadHead = (road: number) => castleSpots(atRoad(road))[0];

describe('the stone cart: following the pony', () => {
  it('goes to the hills with the shod pony, and comes back', () => {
    const up = cross(withCart(12), 'hills');
    expect(up.area).toBe('hills');
    expect(up.castle.cart).toEqual({ stone: 12, at: 'hills' });
    const down = cross(up, 'quarry');
    expect(down.castle.cart).toEqual({ stone: 12, at: 'quarry' });
  });

  it('stays behind without the pony shod, or after dark when the pony has gone home', () => {
    const unshod = withCart(12);
    expect(cross({ ...unshod, pony: { ...unshod.pony, shod: null } }, 'hills').castle.cart.at).toBe('quarry');
    expect(cross({ ...unshod, timeOfDay: 400 }, 'hills').castle.cart.at).toBe('quarry');
  });

  it('stays at the quarry in winter, and keeps filling', () => {
    const winter = withCart(12, { day: 12 });
    expect(cross(winter, 'hills').castle.cart).toEqual({ stone: 12, at: 'quarry' });
    expect(dig(winter).state.castle.cart.stone).toBe(13);
  });

  it('is left on the hills when winter has come: laying draws from it, a dig goes to the bag, and spring brings it back', () => {
    const stuck = cartAt(withCart(12, { day: 12 }), 'hills');
    expect(cross({ ...stuck, area: 'hills' }, 'quarry').castle.cart).toEqual({ stone: 12, at: 'hills' });
    const bag = dig({ ...stuck, area: 'quarry' });
    expect(bag.state.inventory.stone).toBe(1);
    expect(bag.state.castle.cart.stone).toBe(12);
    const spring = { ...stuck, day: 22 };
    expect(cross(cross(spring, 'hills'), 'quarry').castle.cart.at).toBe('quarry');
  });

  it('only moves between the quarry and the hills', () => {
    const state = withCart(12);
    expect(cartFollows(state, { ...state, area: 'camp' }).castle.cart.at).toBe('quarry');
    expect(cartFollows(state, state)).toBe(state);
  });

  it('moves only a cart that has been made', () => {
    const unmade = withCart(0);
    const state = { ...unmade, progress: { ...unmade.progress, workshop: { ...unmade.progress.workshop, stoneCart: false } } };
    expect(cross(state, 'hills').castle.cart.at).toBe('quarry');
  });
});

describe('the stone cart: spending it', () => {
  it('spends from a cart on the hills first, then the bag', () => {
    const state: GameState = { ...cartAt(withCart(2, { inventory: { ...game.inventory, stone: 3 } }), 'hills'), area: 'hills' };
    const one = spendCastleStone(state);
    expect(one?.castle.cart.stone).toBe(1);
    expect(one?.inventory.stone).toBe(3);
    const two = spendCastleStone(one as GameState);
    const three = spendCastleStone(two as GameState);
    expect(three?.castle.cart.stone).toBe(0);
    expect(three?.inventory.stone).toBe(2);
  });

  it('never spends from a cart at the quarry, and gives null when there is nothing', () => {
    const state = withCart(9, { inventory: { ...game.inventory, stone: 1 } });
    expect(spendCastleStone(state)?.inventory.stone).toBe(0);
    expect(spendCastleStone(state)?.castle.cart.stone).toBe(9);
    expect(spendCastleStone({ ...state, inventory: { ...state.inventory, stone: 0 } })).toBeNull();
    expect(spendCastleStone(cartAt({ ...state, inventory: { ...state.inventory, stone: 0 } }, 'hills', 0))).toBeNull();
  });

  it('lets the road be laid from a cart on the hills with an empty bag', () => {
    const base = atRoad(20, { inventory: { ...game.inventory, stone: 0 } });
    const state = { ...cartAt(base, 'hills', 3), progress: withCart().progress };
    expect(castleWorkBlocker(state, 'road')).toBeNull();
    const laid = work(state).state;
    expect(laid.castle.road).toBe(21);
    expect(laid.castle.cart.stone).toBe(2);
    expect(laid.inventory.stone).toBe(0);
    expect(castleWorkBlocker(cartAt(state, 'hills', 0), 'road')).toBe('Bring stone to lay the road.');
    expect(castleWorkBlocker(cartAt(state, 'quarry', 3), 'road')).toBe('Bring stone to lay the road.');
  });
});

describe('the stone cart: in the scene', () => {
  const cartVisual = (state: GameState) => sceneVisuals(state, 0).find(visual => visual.id === 'castle-cart');

  it('stands where it is, once made, loaded as full as it is', () => {
    expect(cartVisual(withCart(0))?.texture).toBe('castleCart:empty');
    expect(cartVisual(withCart(10))?.texture).toBe('castleCart:some');
    expect(cartVisual(withCart(30))?.texture).toBe('castleCart:full');
    expect(cartVisual({ ...cartAt(withCart(10), 'hills'), area: 'hills' })?.texture).toBe('castleCart:some');
  });

  it('is not drawn where it does not stand, or before it is made', () => {
    expect(cartVisual({ ...cartAt(withCart(10), 'hills'), area: 'quarry' })).toBeUndefined();
    const unmade = withCart(0);
    expect(cartVisual({ ...unmade, progress: { ...unmade.progress, workshop: { ...unmade.progress.workshop, stoneCart: false } } })).toBeUndefined();
  });
});

describe('the stone cart: its load beside the work', () => {
  const atRubbleSpot = (state: GameState): GameState => atRubble(state);
  const onHillsRoad = (state: GameState): GameState => {
    const base = { ...cartAt(state, 'hills'), castle: { ...state.castle, road: 29, cart: { stone: 12, at: 'hills' as const } } };
    const spot = castleSpots(base)[0];
    return { ...base, area: 'hills', player: { ...base.player, x: spot.x, y: spot.y } };
  };

  it('shows the load at the quarry face, worked out or not, and keeps E on the dig', () => {
    const state = withCart(12);
    expect(promptFor(state)).toContain('E  Dig the quarry');
    expect(promptFor(state)).toContain('Cart 12/40');
    expect(useKeyAction(state)).toEqual({ type: 'digQuarry' });
    const spent = { ...state, quarryReadyDay: state.day + 1 };
    expect(promptFor(spent)).toContain('Cart 12/40');
    expect(useKeyAction(spent)).toBeUndefined();
  });

  it('shows the load at the rubble, and keeps E on the rubble', () => {
    const state = atRubbleSpot(withCart(3));
    expect(promptFor(state)).toContain('Cart 3/40');
    expect(useKeyAction(state)).toEqual({ type: 'gatherRubble' });
  });

  it('shows the load at an open site on the hills, and keeps E on the work', () => {
    const state = { ...onHillsRoad(withCart(12)), inventory: { ...game.inventory, stone: 2 } };
    expect(promptFor(state)).toContain('Lay a road stone (29/30)');
    expect(promptFor(state)).toContain('Cart 12/40');
    expect(useKeyAction(state)).toEqual({ type: 'castleWork', site: 'road' });
  });

  it('is absent before the cart is made', () => {
    const unmade = withCart(0);
    const state = { ...unmade, progress: { ...unmade.progress, workshop: { ...unmade.progress.workshop, stoneCart: false } } };
    expect(promptFor(state)).not.toContain('Cart ');
    expect(promptFor(atRubble(state))).not.toContain('Cart ');
  });

  it('is absent when the cart stands in the other area', () => {
    expect(promptFor(cartAt(withCart(12), 'hills'))).not.toContain('Cart ');
    const hills = { ...onHillsRoad(withCart(12)), inventory: { ...game.inventory, stone: 2 }, castle: { ...onHillsRoad(withCart(12)).castle, cart: { stone: 12, at: 'quarry' as const } } };
    expect(promptFor(hills)).toContain('Lay a road stone');
    expect(promptFor(hills)).not.toContain('Cart ');
  });

  it('is not repeated at the cart, which names its own load', () => {
    const state = { ...withCart(12), player: { ...withCart(12).player, ...CART_SPOTS.quarry } };
    expect(promptFor(state).match(/12\/40/g)).toHaveLength(1);
  });
});

describe('making beams and fittings', () => {
  const atCamp = (changes: Partial<GameState> = {}, goods: Partial<GameState['castle']['goods']> = {}, frames = 1): GameState => {
    const base = revealed();
    return {
      ...base, area: 'camp', player: { ...base.player, x: BALANCE.campX, y: BALANCE.campY },
      structures: { ...base.structures, workshop: true },
      progress: { ...base.progress, oreFoundDay: 1, workshop: { ...base.progress.workshop, forge: true } },
      storedWood: 20, storedOre: 5,
      castle: { ...base.castle, frames, goods: { ...base.castle.goods, ...goods } },
      ...changes
    };
  };
  const make = (state: GameState, good: 'beams' | 'fittings' | 'hangings') => applyAction(state, { type: 'makeCastleGood', good });

  it('makes four beams from eight wood, drawing on the stores and the bag', () => {
    const state = atCamp({ storedWood: 3, inventory: { ...game.inventory, wood: 5 } });
    expect(GOODS.beams).toEqual({ batch: 4, cost: { wood: 8 } });
    const { state: after } = make(state, 'beams');
    expect(after.castle.goods.beams).toBe(4);
    expect(after.inventory.wood + after.storedWood).toBe(0);
    expect(after.player.energy).toBeLessThan(state.player.energy);
  });

  it('makes a fitting from one wood and one ore', () => {
    const { state: after } = make(atCamp({ storedOre: 0, inventory: { ...game.inventory, ore: 1 } }), 'fittings');
    expect(after.castle.goods.fittings).toBe(1);
    expect(after.inventory.ore + after.storedOre).toBe(0);
    expect(after.storedWood).toBe(19);
  });

  it('needs the workshop, the forge and the frames begun', () => {
    expect(goodBlocker(atCamp({}, {}, 0), 'beams')).toMatch(/frames/);
    expect(goodBlocker(atCamp({}, {}, 0), 'fittings')).toMatch(/frames/);
    const noShop = atCamp();
    expect(goodBlocker({ ...noShop, structures: { ...noShop.structures, workshop: false } }, 'beams')).toMatch(/workshop/);
    expect(goodBlocker({ ...noShop, progress: { ...noShop.progress, workshop: { ...noShop.progress.workshop, forge: false } } }, 'fittings')).toMatch(/forge/);
    expect(goodBlocker(atCamp(), 'beams')).toBeNull();
    expect(goodBlocker(atCamp(), 'fittings')).toBeNull();
  });

  it('is not offered before the line of stones has shown', () => {
    const state = atCamp();
    expect(goodBlocker({ ...state, castle: { ...state.castle, revealedDay: null } }, 'beams')).not.toBeNull();
  });

  it('is made only in the clearing', () => {
    const state = atCamp();
    expect(goodBlocker({ ...state, area: 'hills' }, 'beams')).toMatch(/camp/);
    expect(make({ ...state, area: 'hills' }, 'beams').state.castle.goods.beams).toBe(0);
  });

  it('refuses a tired survivor with the usual line, and spends nothing', () => {
    const state = atCamp();
    const tired = { ...state, player: { ...state.player, energy: 0 } };
    const result = make(tired, 'beams');
    expect(result.message).toBe(TOO_TIRED_MESSAGE);
    expect(result.state.castle.goods.beams).toBe(0);
    expect(result.state.storedWood).toBe(20);
  });

  it('refuses when there is too little to pay', () => {
    expect(goodBlocker(atCamp({ storedWood: 7 }), 'beams')).toBe('Need 8 wood for the beams.');
    expect(goodBlocker(atCamp({ storedOre: 0 }), 'fittings')).toBe('Need 1 wood and 1 ore for a fitting.');
  });

  it('stops once the whole castle has what it needs, counting what is already built in', () => {
    // 4 per tower and 12 for the hall is 28 beams; 2 per tower and 6 for the hall is 14 fittings.
    expect(goodBlocker(atCamp({}, { beams: 28 }), 'beams')).toMatch(/enough/);
    expect(goodBlocker(atCamp({}, { fittings: 14 }), 'fittings')).toMatch(/enough/);
    expect(goodBlocker(atCamp({}, { beams: 24 }), 'beams')).toBeNull();
    const state = atCamp({}, { beams: 4, fittings: 2 });
    const built = { ...state, castle: { ...state.castle,
      towers: { ...state.castle.towers, nw: { stones: 20, beams: 4, fittings: 2 }, ne: { stones: 20, beams: 4, fittings: 2 } },
      hall: { ...state.castle.hall, beams: 12, fittings: 6 } } };
    expect(goodBlocker(built, 'beams')).toBeNull();
    const nearly = { ...built, castle: { ...built.castle, goods: { ...built.castle.goods, beams: 8 } } };
    expect(goodBlocker(nearly, 'beams')).toMatch(/enough/);
    const fits = { ...built, castle: { ...built.castle, goods: { ...built.castle.goods, fittings: 6 } } };
    expect(goodBlocker(fits, 'fittings')).toMatch(/enough/);
  });

  it('does not reopen when a tower is finished from the goods', () => {
    const full = atCamp({}, { beams: 28 });
    const built = { ...full, castle: { ...full.castle, goods: { ...full.castle.goods, beams: 24 },
      towers: { ...full.castle.towers, nw: { stones: 20, beams: 4, fittings: 0 } } } };
    expect(goodBlocker(built, 'beams')).toMatch(/enough/);
  });

  });

// ---- Frames, wall and towers ----

const SIDE_LIST = ['north', 'east', 'south', 'west'] as const;
const TOWER_LIST = ['nw', 'ne', 'se', 'sw'] as const;
const FULL_TOWER: Tower = { stones: NEEDS.towerStones, beams: NEEDS.towerBeams, fittings: NEEDS.towerFittings };
const ALL_WALL = { north: 30, east: 30, south: 30, west: 30 };

/** Road done and the cart made, the survivor on the hills with a rested body, and the castle changed as asked. */
const built = (castle: Partial<GameState['castle']> = {}, changes: Partial<GameState> = {}): GameState => {
  const base = revealed();
  return {
    ...base, area: 'hills', player: { ...base.player, x: 20, y: 12, energy: 100 }, inventory: { ...game.inventory, stone: 0, wood: 0 },
    keep: { ...base.keep, door: true },
    progress: { ...base.progress, workshop: { ...base.progress.workshop, stoneCart: true } },
    castle: { ...base.castle, road: NEEDS.road, doneDays: { road: 3 }, cart: { stone: 0, at: 'hills' }, ...castle }, ...changes
  };
};
const spotOf = (state: GameState, site: string) => castleSpots(state).find(spot => spot.site === site)!;
const standAt = (state: GameState, site: string): GameState => ({ ...state, player: { ...state.player, x: spotOf(state, site).x, y: spotOf(state, site).y } });
const doWork = (state: GameState, site: string) => applyAction(state, { type: 'castleWork', site: site as 'frames' });
const framesUp = (castle: Partial<GameState['castle']> = {}, changes: Partial<GameState> = {}): GameState => built({ frames: NEEDS.frames, doneDays: { road: 3, frames: 2 }, ...castle }, changes);
const wallsUp = (castle: Partial<GameState['castle']> = {}, changes: Partial<GameState> = {}): GameState =>
  framesUp({ wall: ALL_WALL, doneDays: { road: 3, frames: 2, 'wall-north': 2, 'wall-east': 2, 'wall-south': 2, 'wall-west': 2 }, ...castle }, changes);

describe('the frames', () => {
  it('open only with the cart made, and ask for two wood at a time', () => {
    const unmade = built();
    const noCart = { ...unmade, progress: { ...unmade.progress, workshop: { ...unmade.progress.workshop, stoneCart: false } } };
    expect(siteNeed(noCart, 'frames')).toBeNull();
    expect(castleSpots(noCart).map(spot => spot.site)).not.toContain('frames');
    expect(siteNeed(unmade, 'frames')).toEqual({ kind: 'wood', amount: 2 });
    expect(castleSpots(unmade).map(spot => spot.site)).toEqual(['frames']);
  });

  it('take two wood a go up to twelve, from the stores and the bag', () => {
    let state = standAt(built({}, { storedWood: 7, inventory: { ...game.inventory, wood: 5 } }), 'frames');
    for (let go = 1; go <= 6; go++) {
      state = { ...doWork(state, 'frames').state, player: { ...state.player, energy: 100 } };
      expect(state.castle.frames, `go ${go}`).toBe(go * 2);
      expect(availableWood(state), `go ${go}`).toBe(12 - go * 2);
    }
    expect(siteNeed(state, 'frames')).toBeNull();
    expect(state.castle.doneDays.frames).toBe(state.day);
    expect(doWork(state, 'frames').message).toBe('The frames are finished.');
  });

  it('refuse with a plain line when there is not wood for a go, and spend nothing', () => {
    const state = standAt(built({}, { storedWood: 1 }), 'frames');
    expect(castleWorkBlocker(state, 'frames')).toBe('Bring wood to raise the frames.');
    const result = doWork(state, 'frames');
    expect(result.state).toBe(state);
    expect(promptFor(state)).toBe('Frames · bring wood to raise them');
    expect(useKeyAction(state)).toBeUndefined();
  });

  it('say so on the key, and name the count', () => {
    const state = standAt(built({ frames: 4 }, { storedWood: 4 }), 'frames');
    expect(promptFor(state)).toBe('E  Raise the timber frames (4/12)');
    expect(useKeyAction(state)).toEqual({ type: 'castleWork', site: 'frames' });
  });

  it('refuse a tired survivor with the usual line', () => {
    const state = standAt(built({}, { storedWood: 4 }), 'frames');
    const tired = { ...state, player: { ...state.player, energy: 0 } };
    expect(doWork(tired, 'frames').message).toBe(TOO_TIRED_MESSAGE);
    expect(castleWorkBlocker(tired, 'frames')).toBe(TOO_TIRED_MESSAGE);
  });

  it('say something for the first go and the last, and a morning note after the last', () => {
    const first = standAt(built({}, { storedWood: 4 }), 'frames');
    const done = doWork(first, 'frames');
    expect(done.message).toBe('You set the first timbers of the frames.');
    const last = standAt(built({ frames: 10 }, { storedWood: 4 }), 'frames');
    const finished = doWork(last, 'frames').state;
    expect(castleWorkLine(last, finished)).toBe('The frames and the hoist are up. The wall can start now.');
    expect(castleNews(finished, { ...finished, day: finished.day + 1 })).toEqual(['The frames stand finished. The wall can start now.']);
    expect(castleNews(last, { ...last, day: last.day + 1 })).toEqual([]);
  });

  it('draw scaffolding that grows with the wood, with snow in winter', () => {
    const texture = (frames: number, day = 5) => sceneVisuals(built({ frames }, { day }), 0).find(visual => visual.id === 'castle-frames')?.texture;
    expect(texture(0)).toBeUndefined();
    const seen = Array.from({ length: 7 }, (_, step) => texture(step * 2));
    expect(texture(2)).not.toBe(texture(4));
    expect(new Set(seen.slice(1)).size).toBe(6);
    expect(texture(12, 12)).toBe(`${texture(12)}s`);
    for (const name of seen.concat(texture(12, 12))) if (name) expect(castleSprites.castleFrames.frames[name.split(':')[1]]).toBeDefined();
  });
});

describe('the wall', () => {
  it('opens only when the frames are done, with every side open together in any order', () => {
    expect(SIDE_LIST.map(side => siteNeed(built({ frames: 10 }), `wall-${side}`))).toEqual([null, null, null, null]);
    const open = framesUp();
    expect(SIDE_LIST.map(side => siteNeed(open, `wall-${side}`))).toEqual(SIDE_LIST.map(() => ({ kind: 'stone' })));
    expect(castleSpots(open).map(spot => spot.site)).toEqual([...SIDE_LIST.map(side => `wall-${side}`), 'hall']);
    const south = standAt(framesUp({}, { inventory: { ...game.inventory, stone: 3 } }), 'wall-south');
    expect(doWork(south, 'wall-south').state.castle.wall).toEqual({ north: 0, east: 0, south: 1, west: 0 });
  });

  it('stands each side at the middle of that side', () => {
    const open = framesUp();
    expect(spotOf(open, 'wall-north')).toMatchObject({ area: 'hills', x: (WALLS.left + WALLS.right) / 2, y: WALLS.top });
    expect(spotOf(open, 'wall-south')).toMatchObject({ x: (WALLS.left + WALLS.right) / 2, y: WALLS.bottom });
    expect(spotOf(open, 'wall-west')).toMatchObject({ x: WALLS.left, y: (WALLS.top + WALLS.bottom) / 2 });
    expect(spotOf(open, 'wall-east')).toMatchObject({ x: WALLS.right, y: (WALLS.top + WALLS.bottom) / 2 });
  });

  it('works whichever side is nearest the survivor', () => {
    const open = framesUp({}, { inventory: { ...game.inventory, stone: 2 } });
    const west = { ...open, player: { ...open.player, x: 14, y: 10 } };
    expect(nearestCastleSpot(west)?.site).toBe('wall-west');
    const north = { ...open, player: { ...open.player, x: 17, y: 5.5 } };
    expect(nearestCastleSpot(north)?.site).toBe('wall-north');
  });

  it('takes a stone from the cart first, then the bag, thirty to a side', () => {
    let state = standAt(framesUp({ cart: { stone: 1, at: 'hills' } }, { inventory: { ...game.inventory, stone: 2 } }), 'wall-east');
    state = doWork(state, 'wall-east').state;
    expect(state.castle.cart.stone).toBe(0);
    expect(state.inventory.stone).toBe(2);
    state = doWork({ ...state, player: { ...state.player, energy: 100 } }, 'wall-east').state;
    expect(state.inventory.stone).toBe(1);
    expect(state.castle.wall.east).toBe(2);
    const nearly = standAt(framesUp({ wall: { ...ALL_WALL, east: 29, north: 0 } }, { inventory: { ...game.inventory, stone: 2 } }), 'wall-east');
    const finished = doWork(nearly, 'wall-east');
    expect(finished.state.castle.wall.east).toBe(30);
    expect(finished.state.castle.doneDays['wall-east']).toBe(nearly.day);
    expect(doWork(finished.state, 'wall-east').message).toBe('The east wall is finished.');
  });

  it('refuses without stone, far away, or when tired', () => {
    const state = standAt(framesUp(), 'wall-north');
    expect(castleWorkBlocker(state, 'wall-north')).toBe('Bring stone to build the wall. North wall 0/30.');
    expect(promptFor(state)).toBe('North wall 0/30 · bring stone · Cart 0/40');
    const stocked = { ...state, inventory: { ...state.inventory, stone: 1 } };
    expect(castleWorkBlocker({ ...stocked, player: { ...stocked.player, x: 30, y: 12 } }, 'wall-north')).toBe('Move closer to the wall.');
    expect(castleWorkBlocker({ ...stocked, player: { ...stocked.player, energy: 0 } }, 'wall-north')).toBe(TOO_TIRED_MESSAGE);
    expect(promptFor(stocked)).toBe('E  Lay a wall stone, north side (0/30) · Cart 0/40');
  });

  it('keeps a partly built side count visible while stone is missing', () => {
    const state = standAt(framesUp({ wall: { ...ALL_WALL, west: 8, north: 0 } }), 'wall-west');
    expect(castlePrompt(state, spotOf(state, 'wall-west'))).toBe('West wall 8/30 · bring stone');
    expect(castleWorkBlocker(state, 'wall-west')).toBe('Bring stone to build the wall. West wall 8/30.');

    const stocked = { ...state, inventory: { ...state.inventory, stone: 1 } };
    expect(castlePrompt(stocked, spotOf(stocked, 'wall-west'))).toBe('Lay a wall stone, west side (8/30)');
    expect(castleSpots(framesUp({ wall: ALL_WALL })).some(spot => spot.site === 'wall-west')).toBe(false);
  });

  it('says the first stone, the half, and the finish of each side, and leaves a morning note', () => {
    const lay = (stones: number) => {
      const before = standAt(framesUp({ wall: { ...ALL_WALL, north: stones, east: 0 } }, { inventory: { ...game.inventory, stone: 2 } }), 'wall-north');
      return { before, after: doWork(before, 'wall-north').state };
    };
    const first = lay(0);
    expect(castleWorkLine(first.before, first.after)).toBe('You lay the first stone of the north wall.');
    const half = lay(14);
    expect(castleWorkLine(half.before, half.after)).toBe('The north wall is halfway.');
    const other = lay(5);
    expect(castleWorkLine(other.before, other.after)).toBe('You lay another stone of the wall.');
    const last = lay(29);
    expect(castleWorkLine(last.before, last.after)).toBe('The north wall is finished.');
    expect(castleNews(last.after, { ...last.after, day: last.after.day + 1 })).toEqual(['The north wall stands finished.']);
  });

  it('changes the picture at least every four stones, with every side', () => {
    const signature = (stones: number): string => JSON.stringify(sceneVisuals(framesUp({ wall: { north: stones, east: 0, south: 0, west: 0 } }), 0).filter(visual => visual.id.startsWith('castle-wall')));
    for (let stones = 0; stones < 30; stones++) {
      expect(Array.from({ length: 4 }, (_, i) => signature(Math.min(30, stones + i)) !== signature(Math.min(30, stones + i + 1))).some(Boolean), `from ${stones}`).toBe(true);
    }
    expect(signature(0)).not.toBe(signature(30));
    for (const side of SIDE_LIST) {
      const sides = { north: 0, east: 0, south: 0, west: 0, [side]: 12 };
      expect(sceneVisuals(framesUp({ wall: sides }), 0).some(visual => visual.id.startsWith(`castle-wall-${side}`)), side).toBe(true);
    }
  });

  it('draws snow on the wall tops in winter, and only on the hills', () => {
    const textures = (day: number, area: GameState['area'] = 'hills') => sceneVisuals(wallsUp({}, { day, area }), 0).filter(visual => visual.id.startsWith('castle-wall')).map(visual => visual.texture);
    expect(textures(5).length).toBeGreaterThan(30);
    expect(textures(5).every(texture => !texture.endsWith('s'))).toBe(true);
    expect(textures(12).every(texture => texture.endsWith('s'))).toBe(true);
    expect(textures(5, 'camp')).toEqual([]);
    for (const texture of new Set([...textures(5), ...textures(12)])) expect(castleSprites.castleWall.frames[texture.split(':')[1]], texture).toBeDefined();
  });

  it('sorts the survivor against a wall in front and behind', () => {
    const state = wallsUp();
    const depth = (id: string) => sceneVisuals(state, 0).find(visual => visual.id === id)!.depth;
    const north = depth('castle-wall-north-5');
    expect(playerVisualDepth({ ...state, player: { ...state.player, x: 18, y: WALLS.top - 1 } })).toBeLessThan(north);
    expect(playerVisualDepth({ ...state, player: { ...state.player, x: 18, y: WALLS.top + 1 } })).toBeGreaterThan(north);
    const west = sceneVisuals(state, 0).filter(visual => visual.id.startsWith('castle-wall-west'));
    expect(new Set(west.map(visual => visual.depth)).size).toBe(west.length);
    const middle = west[4];
    expect(playerVisualDepth({ ...state, player: { ...state.player, x: WALLS.left, y: 9 } })).toBeLessThan(middle.depth);
    expect(playerVisualDepth({ ...state, player: { ...state.player, x: WALLS.left, y: 11 } })).toBeGreaterThan(middle.depth);
  });

  it('clears the trees under a side as soon as it starts, and keeps the survivor out of no corner', () => {
    expect(treeUnderWall(framesUp({ wall: { ...ALL_WALL, west: 1, north: 0 } }).castle, { x: 15, y: 10 })).toBe(true);
  });
});

describe('the towers', () => {
  it('open only once all four sides are done', () => {
    const open = TOWER_LIST.map(id => siteNeed(wallsUp(), `tower-${id}`));
    expect(open).toEqual(TOWER_LIST.map(() => ({ kind: 'stone' })));
    const short = framesUp({ wall: { ...ALL_WALL, west: 29 } });
    expect(TOWER_LIST.map(id => siteNeed(short, `tower-${id}`))).toEqual([null, null, null, null]);
    expect(castleSpots(wallsUp()).map(spot => spot.site)).toEqual([...TOWER_LIST.map(id => `tower-${id}`), 'gatehouse', 'moat', 'hall']);
  });

  it('ask for stones, then four beams, then two fittings, in that order', () => {
    const need = (tower: Partial<Tower>) => siteNeed(wallsUp({ towers: { ...emptyCastle().towers, nw: { ...FULL_TOWER, ...tower } } }), 'tower-nw');
    expect(need({ stones: 0, beams: 0, fittings: 0 })).toEqual({ kind: 'stone' });
    expect(need({ stones: 19, beams: 0, fittings: 0 })).toEqual({ kind: 'stone' });
    expect(need({ beams: 0, fittings: 0 })).toEqual({ kind: 'good', good: 'beams' });
    expect(need({ beams: 3, fittings: 0 })).toEqual({ kind: 'good', good: 'beams' });
    expect(need({ fittings: 0 })).toEqual({ kind: 'good', good: 'fittings' });
    expect(need({ fittings: 1 })).toEqual({ kind: 'good', good: 'fittings' });
    expect(need({})).toBeNull();
  });

  it('lays stones from the cart first, then the bag, and finishes at twenty', () => {
    const tower = (stones: number) => standAt(wallsUp({ cart: { stone: 1, at: 'hills' }, towers: { ...emptyCastle().towers, se: { stones, beams: 0, fittings: 0 } } }, { inventory: { ...game.inventory, stone: 1 } }), 'tower-se');
    const first = doWork(tower(0), 'tower-se').state;
    expect(first.castle.towers.se.stones).toBe(1);
    expect(first.castle.cart.stone).toBe(0);
    expect(first.inventory.stone).toBe(1);
    const last = doWork(tower(19), 'tower-se').state;
    expect(last.castle.towers.se.stones).toBe(20);
    expect(last.castle.doneDays['tower-se']).toBeUndefined();
  });

  it('moves a beam from the goods into the tower, from anywhere on the hills', () => {
    const state = standAt(wallsUp({ goods: { beams: 5, fittings: 0, hangings: 0 }, towers: { ...emptyCastle().towers, ne: { stones: 20, beams: 1, fittings: 0 } } }), 'tower-ne');
    expect(promptFor(state)).toBe('E  Set a roof beam on the north-east tower (1/4)');
    const after = doWork(state, 'tower-ne').state;
    expect(after.castle.towers.ne.beams).toBe(2);
    expect(after.castle.goods.beams).toBe(4);
    expect(after.player.energy).toBeLessThan(state.player.energy);
  });

  it('leaves the cap on beams and fittings unchanged when goods move into a tower', () => {
    const state = standAt(wallsUp({ goods: { beams: 5, fittings: 3, hangings: 0 }, towers: { ...emptyCastle().towers, ne: { stones: 20, beams: 1, fittings: 0 } } }), 'tower-ne');
    const roomBefore = [goodRoom(state, 'beams'), goodRoom(state, 'fittings')];
    const beamed = doWork(state, 'tower-ne').state;
    expect([goodRoom(beamed, 'beams'), goodRoom(beamed, 'fittings')]).toEqual(roomBefore);
    const done = { ...state, castle: { ...state.castle, towers: { ...state.castle.towers, ne: { stones: 20, beams: 4, fittings: 0 } } } };
    const fitted = doWork(done, 'tower-ne').state;
    expect(fitted.castle.towers.ne.fittings).toBe(1);
    expect(fitted.castle.goods.fittings).toBe(2);
    expect([goodRoom(fitted, 'beams'), goodRoom(fitted, 'fittings')]).toEqual([goodRoom(done, 'beams'), goodRoom(done, 'fittings')]);
    expect(goodBlocker({ ...state, storedWood: 20, area: 'camp', player: { ...state.player, x: BALANCE.campX, y: BALANCE.campY }, structures: { ...state.structures, workshop: true }, progress: { ...state.progress, workshop: { ...state.progress.workshop, forge: true } } }, 'beams')).toBeNull();
  });

  it('refuses a beam or a fitting that has not been made, saying what to make', () => {
    const beams = standAt(wallsUp({ towers: { ...emptyCastle().towers, nw: { stones: 20, beams: 0, fittings: 0 } } }), 'tower-nw');
    expect(castleWorkBlocker(beams, 'tower-nw')).toBe('Make oak beams at the workshop for the tower.');
    expect(promptFor(beams)).toBe('Tower · make oak beams at the workshop');
    expect(useKeyAction(beams)).toBeUndefined();
    const fittings = standAt(wallsUp({ towers: { ...emptyCastle().towers, nw: { stones: 20, beams: 4, fittings: 0 } } }), 'tower-nw');
    expect(castleWorkBlocker(fittings, 'tower-nw')).toBe('Make iron fittings at the forge for the tower.');
    expect(promptFor(fittings)).toBe('Tower · make iron fittings at the forge');
  });

  it('refuses a tired survivor with the usual line, with the goods in hand', () => {
    const state = standAt(wallsUp({ goods: { beams: 4, fittings: 0, hangings: 0 }, towers: { ...emptyCastle().towers, nw: { stones: 20, beams: 0, fittings: 0 } } }), 'tower-nw');
    expect(doWork({ ...state, player: { ...state.player, energy: 0 } }, 'tower-nw').message).toBe(TOO_TIRED_MESSAGE);
  });

  it('marks the day a tower is finished, with a line and a morning note', () => {
    const before = standAt(wallsUp({ goods: { beams: 0, fittings: 2, hangings: 0 }, towers: { ...emptyCastle().towers, sw: { stones: 20, beams: 4, fittings: 1 } } }), 'tower-sw');
    const after = doWork(before, 'tower-sw').state;
    expect(after.castle.doneDays['tower-sw']).toBe(before.day);
    expect(castleWorkLine(before, after)).toBe('The south-west tower is roofed and fitted.');
    expect(castleNews(after, { ...after, day: after.day + 1 })).toEqual(['The south-west tower stands finished.']);
    expect(siteNeed(after, 'tower-sw')).toBeNull();
  });

  it('says a line for the first stone, a beam, and a fitting', () => {
    const line = (tower: Tower, goods: Partial<GameState['castle']['goods']>, inventory: Partial<GameState['inventory']> = {}) => {
      const before = standAt(wallsUp({ goods: { beams: 3, fittings: 3, hangings: 0, ...goods }, towers: { ...emptyCastle().towers, nw: tower } }, { inventory: { ...game.inventory, stone: 2, ...inventory } }), 'tower-nw');
      return castleWorkLine(before, doWork(before, 'tower-nw').state);
    };
    expect(line({ stones: 0, beams: 0, fittings: 0 }, {})).toBe('You lay the first stone of the north-west tower.');
    expect(line({ stones: 5, beams: 0, fittings: 0 }, {})).toBe('You lay another stone of the tower.');
    expect(line({ stones: 20, beams: 0, fittings: 0 }, {})).toBe('You set a roof beam on the north-west tower.');
    expect(line({ stones: 20, beams: 4, fittings: 0 }, {})).toBe('You fit iron to the north-west tower roof.');
  });

  it('draws each tower rising stone by stone, then roofed, with snow in winter', () => {
    const texture = (tower: Tower, day = 5, id: 'nw' | 'se' = 'nw') => sceneVisuals(wallsUp({ towers: { ...emptyCastle().towers, [id]: tower } }, { day }), 0).find(visual => visual.id === `castle-tower-${id}`)?.texture;
    expect(texture({ stones: 0, beams: 0, fittings: 0 })).toBeUndefined();
    const steps = [
      { stones: 1, beams: 0, fittings: 0 }, { stones: 5, beams: 0, fittings: 0 }, { stones: 9, beams: 0, fittings: 0 }, { stones: 13, beams: 0, fittings: 0 },
      { stones: 17, beams: 0, fittings: 0 }, { stones: 20, beams: 0, fittings: 0 }, { stones: 20, beams: 1, fittings: 0 }, { stones: 20, beams: 2, fittings: 0 },
      { stones: 20, beams: 4, fittings: 0 }, { stones: 20, beams: 4, fittings: 1 }, { stones: 20, beams: 4, fittings: 2 }
    ];
    const names = steps.map(step => texture(step));
    expect(new Set(names).size).toBe(steps.length);
    expect(texture({ stones: 5, beams: 0, fittings: 0 }, 12)).toBe(`${names[1]}s`);
    for (const name of names.concat(texture(FULL_TOWER, 12))) expect(castleSprites.castleTower.frames[name!.split(':')[1]], name).toBeDefined();
    for (let stones = 0; stones < 16; stones += 4) expect(texture({ stones: stones + 1, beams: 0, fittings: 0 })).not.toBe(texture({ stones: stones + 5, beams: 0, fittings: 0 }));
  });

  it('stands each tower at its corner, inside the line', () => {
    const open = wallsUp();
    for (const [id, near] of [['nw', [WALLS.left, WALLS.top]], ['ne', [WALLS.right, WALLS.top]], ['se', [WALLS.right, WALLS.bottom]], ['sw', [WALLS.left, WALLS.bottom]]] as const) {
      const spot = spotOf(open, `tower-${id}`);
      expect(Math.hypot(spot.x - near[0], spot.y - near[1])).toBeLessThan(1.5);
      expect(spot.x).toBeGreaterThanOrEqual(WALLS.left);
      expect(spot.x).toBeLessThanOrEqual(WALLS.right);
      expect(spot.y).toBeGreaterThanOrEqual(WALLS.top);
      expect(spot.y).toBeLessThanOrEqual(WALLS.bottom);
    }
  });
});

describe('where the frames, the wall and the towers stand', () => {
  const everyone = (): { site: string; x: number; y: number }[] => [
    ...castleSpots(built()), ...castleSpots(framesUp()), ...castleSpots(wallsUp())
  ];
  const OTHERS = [KEEP_SITE, OUTCROP_SITE, HILLS_EXIT, CART_SPOTS.hills];

  it('keeps every spot within the map and clear of the keep, the outcrop, the exit and the cart', () => {
    for (const spot of everyone()) {
      expect(spot.x, spot.site).toBeGreaterThan(0);
      expect(spot.x, spot.site).toBeLessThan(BALANCE.mapWidth);
      expect(spot.y, spot.site).toBeGreaterThan(0);
      expect(spot.y, spot.site).toBeLessThan(BALANCE.mapHeight);
      // The hall stands within reach of the keep's door on purpose: its sweep below shows the door keeps working there.
      for (const other of OTHERS) {
        const apart = spot.site === 'hall' && other === KEEP_SITE ? 3 : BALANCE.interactionRadius * 2;
        expect(Math.hypot(spot.x - other.x, spot.y - other.y), `${spot.site} from ${other.x},${other.y}`).toBeGreaterThan(apart);
      }
    }
  });

  it('keeps each side and each corner out of reach of the others, so E takes the one the prompt names', () => {
    const spots = [...castleSpots(framesUp()), ...castleSpots(wallsUp()).filter(spot => spot.site !== 'gatehouse' && spot.site !== 'moat')].filter(spot => spot.site !== 'hall');
    expect(spots).toHaveLength(8);
    for (const a of spots) for (const b of spots) {
      if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.site} and ${b.site}`).toBeGreaterThan(BALANCE.interactionRadius * 2);
    }
  });

  it('keeps the frames beyond reach of the keep door, and never open at once with the wall', () => {
    expect(spotOf(built(), 'frames')).toMatchObject({ area: 'hills' });
    expect(castleSpots(framesUp()).map(spot => spot.site)).not.toContain('frames');
    expect(castleSpots(wallsUp()).map(spot => spot.site)).not.toContain('wall-north');
  });

  it('does what the prompt says at every spot: the same site on E and on a tap', () => {
    const stocked = { inventory: { ...game.inventory, stone: 3 } };
    const cases: [string, GameState][] = [
      ['frames', built({}, { storedWood: 4 })],
      ...SIDE_LIST.map(side => [`wall-${side}`, framesUp({}, stocked)] as [string, GameState]),
      ...TOWER_LIST.map(id => [`tower-${id}`, wallsUp({}, stocked)] as [string, GameState])
    ];
    for (const [site, base] of cases) {
      const state = standAt(base, site);
      expect(useKeyAction(state), site).toEqual({ type: 'castleWork', site });
      expect(promptFor(state), site).toMatch(/^E  /);
      expect(targetAction(pickTapTarget(state, spotOf(state, site).x, spotOf(state, site).y)), site).toEqual({ type: 'castleWork', site });
    }
  });

  it('keeps E on the pile when a stone pile lies beside a site, and the site on a tap', () => {
    const base = standAt(framesUp({}, { inventory: { ...game.inventory, stone: 3 } }), 'wall-north');
    const pile = { id: 'pile-near', x: base.player.x + 1, y: base.player.y, count: 2, area: 'hills' as const, item: 'stone' as const };
    const state = { ...base, stonePiles: [pile] };
    expect(useKeyAction(state)).toEqual({ type: 'pickUpStone', pileId: 'pile-near' });
    expect(promptFor(state)).toContain('Lay a wall stone');
    expect(targetAction(pickTapTarget(state, spotOf(state, 'wall-north').x, spotOf(state, 'wall-north').y))).toEqual({ type: 'castleWork', site: 'wall-north' });
  });

  it('keeps the outcrop on E when the survivor stands at the outcrop, with a site open', () => {
    const state = { ...framesUp(), player: { ...game.player, ...OUTCROP_SITE, energy: 100 }, progress: { ...framesUp().progress, oreFoundDay: 1, pickaxeCrafted: true } };
    expect(useKeyAction(state)?.type).not.toBe('castleWork');
  });

  it('is reachable: nothing stops the survivor walking across a wall line to an open site', () => {
    const state = framesUp({}, { inventory: { ...game.inventory, stone: 1 } });
    const outside = { ...state, player: { ...state.player, x: WALLS.left - 0.5, y: 10 } };
    const moved = applyAction(outside, { type: 'move', dx: 1, dy: 0 }).state;
    expect(moved.player.x).toBeGreaterThan(WALLS.left);
    expect(castleWorkBlocker(standAt(state, 'wall-west'), 'wall-west')).toBeNull();
  });

  it('keeps the survivor weak at a site from being trapped: tired at each spot says the usual line', () => {
    for (const site of ['wall-north', 'tower-nw']) {
      const state = standAt(site.startsWith('wall') ? framesUp({}, { inventory: { ...game.inventory, stone: 1 } }) : wallsUp({}, { inventory: { ...game.inventory, stone: 1 } }), site);
      expect(doWork({ ...state, player: { ...state.player, energy: 0 } }, site).message).toBe(TOO_TIRED_MESSAGE);
    }
  });
});

describe('the view from the keep, with the wall and towers', () => {
  it('counts the sides and the towers done', () => {
    expect(castleView(revealed())).toEqual({ line: true, walls: 0, towers: 0, gatehouse: false, moat: false, hall: false });
    expect(castleView(framesUp({ wall: { north: 30, east: 29, south: 30, west: 0 } }))).toEqual({ line: true, walls: 2, towers: 0, gatehouse: false, moat: false, hall: false });
    expect(castleView(wallsUp({ towers: { ...emptyCastle().towers, nw: FULL_TOWER, se: { ...FULL_TOWER, fittings: 1 } } }))).toEqual({ line: true, walls: 4, towers: 1, gatehouse: false, moat: false, hall: false });
    expect(castleView(finishedKeep())).toEqual({ line: false, walls: 0, towers: 0, gatehouse: false, moat: false, hall: false });
    expect(castleView(wallsUp({ gatehouse: 29 })).gatehouse).toBe(false);
    expect(castleView(wallsUp({ gatehouse: 30 })).gatehouse).toBe(true);
  });
});

// ---- Portcullis and gatehouse ----

const withPortcullis = (state: GameState): GameState => ({ ...state, progress: { ...state.progress, workshop: { ...state.progress.workshop, portcullis: true } } });
const gateOpen = (castle: Partial<GameState['castle']> = {}, changes: Partial<GameState> = {}): GameState => withPortcullis(wallsUp(castle, { inventory: { ...game.inventory, stone: 3 }, ...changes }));
const GATE_LINES = { half: 'The gatehouse is halfway.', last: 'You lay the last stone. The portcullis dropped and rose again, and the gatehouse is finished.' };

describe('the portcullis at the forge', () => {
  const forgeCamp = (castle: Partial<GameState['castle']> = {}): GameState => {
    const base = wallsUp(castle);
    return {
      ...base, area: 'camp', player: { ...base.player, x: BALANCE.campX, y: BALANCE.campY }, storedWood: 10, structures: { ...base.structures, workshop: true },
      inventory: { ...base.inventory, ore: 6 }, progress: { ...base.progress, workshop: { ...base.progress.workshop, forge: true } }
    };
  };

  it('shows its row once the wall is done, with its copy and its price', () => {
    const row = workshopView(forgeCamp()).rows.portcullis;
    expect(row).toMatchObject({ shown: true, title: 'Portcullis', copy: 'Heavy iron and oak for the gatehouse.', cost: '4 wood · 4 ore', ready: true });
    expect(workshopView(forgeCamp({ wall: { ...ALL_WALL, west: 29 } })).rows.portcullis.shown).toBe(false);
  });

  it('is made once, and its row then goes', () => {
    const made = applyAction(forgeCamp(), { type: 'makeUpgrade', upgrade: 'portcullis' });
    expect(made.state.progress.workshop.portcullis).toBe(true);
    expect(made.message).toBe('You made a portcullis.');
    expect(workshopView(made.state).rows.portcullis.shown).toBe(false);
    expect(workshopView(made.state).rows.portcullis.copy).toBe('It waits for the gatehouse.');
  });
});

describe('the gatehouse: when it opens and what it asks for', () => {
  it('opens once the wall is done, asking for the portcullis first', () => {
    expect(siteNeed(framesUp({ wall: { ...ALL_WALL, west: 29 } }), 'gatehouse')).toBeNull();
    expect(siteNeed(wallsUp(), 'gatehouse')).toEqual({ kind: 'portcullis' });
    expect(siteNeed(gateOpen(), 'gatehouse')).toEqual({ kind: 'stone' });
    expect(siteNeed(gateOpen({ gatehouse: 29 }), 'gatehouse')).toEqual({ kind: 'stone' });
    expect(siteNeed(gateOpen({ gatehouse: 30 }), 'gatehouse')).toBeNull();
  });

  it('shows nothing before the reveal', () => {
    expect(castleSpots({ ...gateOpen(), castle: { ...gateOpen().castle, revealedDay: null } }).map(spot => spot.site)).toEqual([]);
  });

  it('refuses stone until the portcullis is made, and says to make one at the forge', () => {
    const state = standAt(wallsUp({}, { inventory: { ...game.inventory, stone: 3 } }), 'gatehouse');
    expect(castleWorkBlocker(state, 'gatehouse')).toBe('Make a portcullis at the forge first.');
    expect(promptFor(state)).toBe('Gatehouse · make a portcullis at the forge');
    expect(useKeyAction(state)).toBeUndefined();
    const refused = doWork(state, 'gatehouse');
    expect(refused.state).toEqual(state);
    expect(refused.message).toBe('Make a portcullis at the forge first.');
  });

  it('lays stones once the portcullis is made, from the cart first and then the bag', () => {
    const state = standAt(gateOpen({ cart: { stone: 1, at: 'hills' } }), 'gatehouse');
    expect(promptFor(state)).toMatch(/^E  Lay a gatehouse stone \(0\/30\)/);
    const first = doWork(state, 'gatehouse');
    expect(first.state.castle.gatehouse).toBe(1);
    expect(first.state.castle.cart.stone).toBe(0);
    expect(first.state.inventory.stone).toBe(3);
    expect(first.state.player.energy).toBeLessThan(state.player.energy);
    expect(castleWorkLine(state, first.state)).toBe('You lay the first stone of the gatehouse.');
    expect(doWork(first.state, 'gatehouse').state.castle.gatehouse).toBe(2);
  });

  it('asks for stone when the bag is empty, and refuses a tired survivor with the usual line', () => {
    const empty = standAt(gateOpen({}, { inventory: { ...game.inventory, stone: 0 } }), 'gatehouse');
    expect(castleWorkBlocker(empty, 'gatehouse')).toBe('Bring stone to build the gatehouse.');
    expect(promptFor(empty)).toMatch(/^Gatehouse · bring stone to build it/);
    const tired = standAt(gateOpen(), 'gatehouse');
    expect(doWork({ ...tired, player: { ...tired.player, energy: 0 } }, 'gatehouse').message).toBe(TOO_TIRED_MESSAGE);
    const unmade = standAt(wallsUp({}, { inventory: { ...game.inventory, stone: 3 } }), 'gatehouse');
    expect(doWork({ ...unmade, player: { ...unmade.player, energy: 0 } }, 'gatehouse').message).toBe('Make a portcullis at the forge first.');
  });

  it('finishes on the thirtieth stone, with the day marked, a line that says the portcullis dropped and rose, and a morning note', () => {
    const before = standAt(gateOpen({ gatehouse: 29 }), 'gatehouse');
    const after = doWork(before, 'gatehouse').state;
    expect(after.castle.gatehouse).toBe(30);
    expect(after.castle.doneDays.gatehouse).toBe(before.day);
    expect(castleWorkLine(before, after)).toBe(GATE_LINES.last);
    expect(castleNews(after, { ...after, day: after.day + 1 })).toEqual(['The gatehouse stands finished.']);
    expect(siteNeed(after, 'gatehouse')).toBeNull();
    expect(doWork(after, 'gatehouse').state).toEqual(after);
    expect(doWork(after, 'gatehouse').message).toBe('The gatehouse is finished.');
  });

  it('has no fitting step and no new saved field: the castle keeps its shape', () => {
    const before = standAt(gateOpen({ gatehouse: 29 }), 'gatehouse');
    const after = doWork(before, 'gatehouse').state;
    expect(Object.keys(after.castle).sort()).toEqual(Object.keys(emptyCastle()).sort());
    expect(after.progress.workshop.portcullis).toBe(true);
  });

  it('says its first stone, its halfway and a plain stone, with no exclamation marks', () => {
    const line = (laid: number) => {
      const before = standAt(gateOpen({ gatehouse: laid }), 'gatehouse');
      return castleWorkLine(before, doWork(before, 'gatehouse').state);
    };
    expect(line(0)).toBe('You lay the first stone of the gatehouse.');
    expect(line(14)).toBe(GATE_LINES.half);
    expect(line(5)).toBe('You lay another stone of the gatehouse.');
    for (const laid of [0, 5, 14, 29]) expect(line(laid)).not.toContain('!');
  });

  it('is told apart from a tower stone when both are open', () => {
    const state = gateOpen({ gatehouse: 4, towers: { ...emptyCastle().towers, se: { stones: 3, beams: 0, fittings: 0 } } });
    const at = standAt(state, 'gatehouse');
    const after = doWork(at, 'gatehouse').state;
    expect(castleWorkLine(at, after)).toBe('You lay another stone of the gatehouse.');
    expect(after.castle.towers.se.stones).toBe(3);
  });
});

describe('the gatehouse: where it stands', () => {
  const gate = (): { site: string; x: number; y: number } => spotOf(gateOpen(), 'gatehouse');
  const near = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

  it('stands just east of the wall line where the hills path comes in', () => {
    expect(gate()).toMatchObject({ area: 'hills', x: 26.5, y: 13 });
    expect(gate().x).toBeGreaterThan(WALLS.right);
  });

  it('keeps clear of the keep, the outcrop, the exit and the cart, and never hides the east wall spot', () => {
    for (const other of [KEEP_SITE, OUTCROP_SITE, HILLS_EXIT, CART_SPOTS.hills]) expect(near(gate(), other)).toBeGreaterThan(BALANCE.interactionRadius * 2);
    expect(siteNeed(gateOpen(), 'wall-east')).toBeNull();
  });

  it('is reachable from the path, outside the wall, and from the yard inside it', () => {
    const state = gateOpen();
    for (const [x, y] of [[25.5, 12.5], [27.5, 13.5]]) {
      const there = { ...state, player: { ...state.player, x, y } };
      expect(castleWorkBlocker(there, 'gatehouse')).toBeNull();
    }
  });

  it('leaves a place to stand where only the south-east tower is the nearest', () => {
    const state = gateOpen();
    const tower = spotOf(state, 'tower-se');
    for (const [dx, dy] of [[0, 0], [-0.5, 0.3], [0.5, 0], [0, 0.8]]) {
      const there = { ...state, player: { ...state.player, x: tower.x + dx, y: tower.y + dy } };
      expect(nearestCastleSpot(there)?.site, `${dx},${dy}`).toBe('tower-se');
      expect(useKeyAction(there), `${dx},${dy}`).toEqual({ type: 'castleWork', site: 'tower-se' });
      expect(promptFor(there)).toContain('Lay a tower stone, south-east');
    }
  });

  it('gives the prompt, E and a tap the same site wherever both are in reach', () => {
    const state = gateOpen();
    const both: [number, number][] = [];
    for (let x = 21; x <= 28; x += 0.25) for (let y = 11; y <= 15; y += 0.25) both.push([x, y]);
    const sites = new Set<string>();
    for (const [x, y] of both) {
      const there = { ...state, player: { ...state.player, x, y } };
      const nearest = nearestCastleSpot(there);
      if (!nearest || near(there.player, nearest) > BALANCE.interactionRadius) {
        expect(useKeyAction(there)?.type, `${x},${y}`).not.toBe('castleWork');
        continue;
      }
      sites.add(nearest.site);
      expect(useKeyAction(there), `${x},${y}`).toEqual({ type: 'castleWork', site: nearest.site });
      expect(promptFor(there).startsWith(`E  ${castlePrompt(there, nearest)}`), `${x},${y}: ${promptFor(there)}`).toBe(true);
      expect(targetAction(pickTapTarget(there, nearest.x, nearest.y)), `${x},${y}`).toEqual({ type: 'castleWork', site: nearest.site });
    }
    expect(sites).toEqual(new Set(['gatehouse', 'tower-se', 'moat', 'hall']));
    const straddle = { ...state, player: { ...state.player, x: 24.9, y: 13.5 } };
    expect(near(straddle.player, spotOf(state, 'gatehouse'))).toBeLessThanOrEqual(BALANCE.interactionRadius);
    expect(near(straddle.player, spotOf(state, 'tower-se'))).toBeLessThanOrEqual(BALANCE.interactionRadius);
  });

  it('is tapped at its own place and not the tower\'s', () => {
    const state = gateOpen();
    expect(targetAction(pickTapTarget(state, 26.5, 13))).toEqual({ type: 'castleWork', site: 'gatehouse' });
    expect(targetAction(pickTapTarget(state, 23, 14))).toEqual({ type: 'castleWork', site: 'tower-se' });
  });
});

describe('the gatehouse: the drop and rise of the portcullis', () => {
  const finishing = () => {
    const before = standAt(gateOpen({ gatehouse: 29 }), 'gatehouse');
    return { before, after: doWork(before, 'gatehouse').state };
  };

  it('plays on the finishing stone only, at the gatehouse', () => {
    const { before, after } = finishing();
    expect(actionEffect({ type: 'castleWork', site: 'gatehouse' }, after)).toEqual({ kind: 'portcullis', x: 26.5, y: 13 });
    const middle = doWork(standAt(gateOpen({ gatehouse: 10 }), 'gatehouse'), 'gatehouse').state;
    expect(actionEffect({ type: 'castleWork', site: 'gatehouse' }, middle)).toEqual({ kind: 'dust', x: middle.player.x, y: middle.player.y });
    expect(actionEffect({ type: 'castleWork', site: 'tower-se' }, after)?.kind).toBe('dust');
    expect(actionEffect({ type: 'castleWork', site: 'gatehouse' }, before)?.kind).toBe('dust');
  });

  it('drops, holds, rises and is gone, over a few seconds', () => {
    const { after } = finishing();
    const event = { kind: 'portcullis' as const, startedAtMs: 1000, x: 24, y: 12 };
    const gateAt = (ms: number) => effectVisuals(after, ms, [event]).filter(visual => visual.texture.startsWith('castlePortcullis'));
    expect(gateAt(900)).toEqual([]);
    const down = [1000, 1400, 1800, 2200, 2900, 3500].map(ms => Number(gateAt(ms)[0].texture.split(':')[1]));
    expect(down[1]).toBeGreaterThan(down[0]);
    expect(down[2]).toBe(castleSprites.castlePortcullis.frames ? Object.keys(castleSprites.castlePortcullis.frames).length : 0);
    expect(down[3]).toBe(down[2]);
    expect(down[4]).toBeLessThan(down[3]);
    expect(down[5]).toBeLessThan(down[4]);
    expect(gateAt(1500)[0].y).toBe(gateAt(2000)[0].y);
    expect(gateAt(5000)).toEqual([]);
    for (const visual of gateAt(1500)) expect(castleSprites.castlePortcullis.frames[visual.texture.split(':')[1]]).toBeDefined();
  });

  it('is only a scene effect: nothing saved, and a reload mid-effect changes nothing', () => {
    const { before, after } = finishing();
    expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
    const reloaded: GameState = JSON.parse(JSON.stringify(after));
    expect(sceneVisuals(reloaded, 0)).toEqual(sceneVisuals(after, 0));
    expect(sceneVisuals(after, 2000)).toEqual(sceneVisuals(after, 0));
    expect(effectVisuals(reloaded, 2000, []).filter(visual => visual.texture.startsWith('castlePortcullis'))).toEqual([]);
  });
});

describe('the gatehouse: drawn on the east wall', () => {
  const gateVisual = (state: GameState) => sceneVisuals(state, 0).find(visual => visual.id === 'castle-gatehouse');
  const texture = (laid: number, day = 5) => gateVisual(gateOpen({ gatehouse: laid }, { day }))?.texture;

  it('shows nothing before a stone is laid, then a picture that changes as it rises', () => {
    expect(texture(0)).toBeUndefined();
    const steps = [1, 7, 13, 19, 25, 30].map(laid => texture(laid));
    expect(new Set(steps).size).toBe(6);
    for (let laid = 0; laid < 30; laid += 6) expect(texture(laid + 1)).not.toBe(texture(laid + 7));
    expect(gateVisual(gateOpen({ gatehouse: 3 }))).toMatchObject({ x: expect.any(Number) });
  });

  it('has a sprite for every picture, in both seasons, and snow on its top in winter', () => {
    for (const laid of [1, 6, 7, 12, 13, 18, 19, 24, 25, 30]) {
      for (const day of [5, 12]) expect(castleSprites.castleGatehouse.frames[texture(laid, day)!.split(':')[1]], `${laid} on ${day}`).toBeDefined();
    }
    expect(texture(30, 12)).toBe(`${texture(30)}s`);
  });

  it('draws only on the hills', () => {
    expect(sceneVisuals({ ...gateOpen({ gatehouse: 10 }), area: 'camp' }, 0).some(visual => visual.id === 'castle-gatehouse')).toBe(false);
  });

  it('leaves the east wall whole once it is begun', () => {
    const ids = (laid: number) => sceneVisuals(gateOpen({ gatehouse: laid }), 0).map(visual => visual.id);
    for (const laid of [0, 1]) for (let i = 0; i < 9; i++) expect(ids(laid)).toContain(`castle-wall-east-${i}`);
  });

  it('sorts the survivor against the gatehouse in front and behind', () => {
    const state = gateOpen({ gatehouse: 30 });
    const { depth } = gateVisual(state)!;
    expect(playerVisualDepth({ ...state, player: { ...state.player, x: 26.5, y: 12 } })).toBeLessThan(depth);
    expect(playerVisualDepth({ ...state, player: { ...state.player, x: 26.5, y: 14 } })).toBeGreaterThan(depth);
  });

  it('works whatever season it is', () => {
    for (const day of [2, 12, 22, 32]) {
      const state = standAt(gateOpen({ gatehouse: 29 }, { day }), 'gatehouse');
      expect(doWork(state, 'gatehouse').state.castle.gatehouse).toBe(30);
    }
  });
});

// ---- The moat ----

const FROZEN = 'The ground is frozen. The moat can wait for spring.';
const DUG_TODAY = 'You have dug enough for today. The moat can wait until tomorrow.';
/** The wall is up and the gatehouse is done, with the survivor on a summer day (day 33) at the next stretch. */
const moatOpen = (castle: Partial<GameState['castle']> = {}, changes: Partial<GameState> = {}): GameState =>
  wallsUp(castle, { day: 33, ...changes });
const dug = (stretches: number, lastDugDay: number | null, castle: Partial<GameState['castle']> = {}, changes: Partial<GameState> = {}): GameState =>
  moatOpen({ moat: { stretches, lastDugDay, dugDay: stretches === NEEDS.moat ? lastDugDay : null }, ...castle }, changes);
const MOAT_DONE_DAYS = { road: 3, frames: 2, 'wall-north': 2, 'wall-east': 2, 'wall-south': 2, 'wall-west': 2 };
const finishedMoat = (dugDay: number, day: number): GameState => ({
  ...moatOpen({ moat: { stretches: NEEDS.moat, lastDugDay: dugDay, dugDay }, doneDays: { ...MOAT_DONE_DAYS, moat: dugDay } }), day
});
const rainy = (from: number, to: number): number => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i).filter(day => rainWindow(day) !== null).length;

describe('the moat: when it opens and what a go costs', () => {
  it('opens once all four sides are done, and not before', () => {
    expect(siteNeed(wallsUp(), 'moat')).toEqual({ kind: 'dig' });
    expect(siteNeed(framesUp({ wall: { ...ALL_WALL, west: 29 } }), 'moat')).toBeNull();
    expect(castleSpots(wallsUp()).map(spot => spot.site)).toContain('moat');
    expect(castleSpots(framesUp()).map(spot => spot.site)).not.toContain('moat');
  });

  it('is dug a stretch at a time, at a dig\'s time and energy, with no stone spent', () => {
    const before = standAt(moatOpen({}, { inventory: { ...game.inventory, stone: 2 } }), 'moat');
    expect(promptFor(before)).toBe('E  Dig the moat (0/16)');
    const { state, message } = doWork(before, 'moat');
    expect(state.castle.moat).toEqual({ stretches: 1, lastDugDay: before.day, dugDay: null });
    expect(state.inventory.stone).toBe(2);
    expect(state.player.energy).toBeCloseTo(before.player.energy - BALANCE.digEnergyCost);
    expect(state.timeOfDay).toBeCloseTo(before.timeOfDay + workSeconds(before, BALANCE.digSeconds));
    expect(message).toBe('You dig the first stretch of the moat.');
  });

  it('keeps every other piece of castle work at half a dig', () => {
    const before = standAt(gateOpen(), 'gatehouse');
    const { state } = doWork(before, 'gatehouse');
    expect(state.player.energy).toBeCloseTo(before.player.energy - BALANCE.digEnergyCost / 2);
    expect(state.timeOfDay).toBeCloseTo(before.timeOfDay + workSeconds(before, BALANCE.digSeconds / 2));
  });

  it('allows one go a day, and the next on the day after', () => {
    const first = doWork(standAt(moatOpen(), 'moat'), 'moat').state;
    const again = standAt(first, 'moat');
    expect(castleWorkBlocker(again, 'moat')).toBe(DUG_TODAY);
    const refused = doWork(again, 'moat');
    expect(refused.message).toBe(DUG_TODAY);
    expect(refused.state).toEqual(again);
    const morning = standAt({ ...first, day: first.day + 1, timeOfDay: 40 }, 'moat');
    expect(castleWorkBlocker(morning, 'moat')).toBeNull();
    expect(doWork(morning, 'moat').state.castle.moat.stretches).toBe(2);
  });

  it('is refused while the ground is frozen, in every winter day, and says so', () => {
    for (const day of [11, 15, 20, 51, 60]) {
      const state = standAt(moatOpen({}, { day }), 'moat');
      expect(season(day)).toBe('winter');
      expect(castleWorkBlocker(state, 'moat')).toBe(FROZEN);
      const refused = doWork(state, 'moat');
      expect(refused.message).toBe(FROZEN);
      expect(refused.state).toEqual(state);
    }
    for (const day of [10, 21, 33, 41]) expect(castleWorkBlocker(standAt(moatOpen({}, { day }), 'moat'), 'moat'), `day ${day}`).toBeNull();
  });

  it('gives a tired survivor the usual line, never a trap, and digs again after rest', () => {
    const tired = standAt(moatOpen(), 'moat');
    const weak = { ...tired, player: { ...tired.player, energy: 0 } };
    expect(doWork(weak, 'moat').message).toBe(TOO_TIRED_MESSAGE);
    expect(doWork(weak, 'moat').state).toEqual(weak);
    expect(castleWorkBlocker({ ...weak, player: { ...weak.player, energy: 100 } }, 'moat')).toBeNull();
  });

  it('is refused from afar', () => {
    const state = { ...moatOpen(), player: { ...game.player, x: 18, y: 10 } };
    expect(castleWorkBlocker(state, 'moat')).toBe('Move closer to the moat.');
  });

  it('works clockwise from the gatehouse, sixteen stretches round', () => {
    const centre = { x: (WALLS.left + WALLS.right) / 2, y: (WALLS.top + WALLS.bottom) / 2 };
    const turn = (spot: { x: number; y: number }) => (Math.atan2(spot.y - centre.y, spot.x - centre.x) - Math.atan2(GATE_AT.y - centre.y, GATE_AT.x - centre.x) + 4 * Math.PI) % (2 * Math.PI);
    const turns = Array.from({ length: NEEDS.moat }, (_, n) => turn(spotOf(dug(n, n === 0 ? null : 32), 'moat')));
    expect(spotOf(moatOpen(), 'moat').y).toBeGreaterThan(GATE_AT.y);
    expect(spotOf(moatOpen(), 'moat').x).toBeGreaterThan(WALLS.right);
    for (let n = 1; n < turns.length; n++) expect(turns[n], `stretch ${n}`).toBeGreaterThan(turns[n - 1]);
    expect(turns[NEEDS.moat - 1]).toBeLessThan(2 * Math.PI);
  });

  it('digs sixteen stretches on sixteen days, then is done with a day set and a line', () => {
    let state = standAt(moatOpen(), 'moat');
    const lines: string[] = [];
    for (let n = 1; n <= NEEDS.moat; n++) {
      const result = doWork(standAt(state, 'moat'), 'moat');
      expect(result.state.castle.moat.stretches).toBe(n);
      lines.push(result.message);
      state = { ...result.state, player: { ...result.state.player, energy: 100 }, day: result.state.day + (season(result.state.day + 1) === 'winter' ? 11 : 1), timeOfDay: 40 };
    }
    expect(lines[0]).toBe('You dig the first stretch of the moat.');
    expect(lines[1]).toBe('You dig another stretch of the moat.');
    expect(lines[7]).toBe('The moat is halfway round.');
    expect(lines[15]).toBe('You dig the last stretch. The moat is dug, and the spring rain will fill it.');
    expect(state.castle.moat.dugDay).toBe(state.castle.moat.lastDugDay);
    expect(state.castle.doneDays.moat).toBe(state.castle.moat.dugDay);
    expect(siteNeed(state, 'moat')).toBeNull();
    expect(castleSpots(state).map(spot => spot.site)).not.toContain('moat');
    expect(doWork(state, 'moat').message).toBe('The moat is finished.');
  });

  it('leaves a note the morning after the last stretch, once', () => {
    const before = dug(15, 32, {}, { day: 33 });
    const after = doWork(standAt(before, 'moat'), 'moat').state;
    expect(castleNews(after, { ...after, day: after.day + 1 })).toEqual(['The moat is dug. The spring rain will fill it.']);
    expect(castleNews({ ...after, day: after.day + 1 }, { ...after, day: after.day + 2 })).toEqual([]);
  });
});

const GATE_AT = { x: WALLS.right, y: 12 };

describe('the moat: how full it is', () => {
  it('is empty until it is finished', () => {
    expect(moatFill(moatOpen())).toBe(0);
    expect(moatFill(dug(15, 32, {}, { day: 63 }))).toBe(0);
  });

  it('rises on the rainy days of the next spring when finished in autumn, winter or the first days of spring, and is full from summer', () => {
    for (const dugDay of [5, 15, 21]) {
      const total = rainy(21, 30) - (dugDay === 21 && rainWindow(21) ? 1 : 0);
      expect(total).toBeGreaterThan(0);
      for (let day = dugDay; day <= 30; day++) {
        const counted = rainy(Math.max(21, dugDay + 1), day);
        expect(moatFill(finishedMoat(dugDay, day)), `dug ${dugDay}, day ${day}`).toBeCloseTo(counted / total);
      }
      expect(moatFill(finishedMoat(dugDay, 30))).toBe(1);
      expect(moatFill(finishedMoat(dugDay, 31))).toBe(1);
      expect(moatFill(finishedMoat(dugDay, 100))).toBe(1);
    }
  });

  it('is empty until the next spring when finished in summer, then fills across it', () => {
    for (const day of [32, 40, 41, 55, 60]) expect(moatFill(finishedMoat(32, day)), `day ${day}`).toBe(0);
    const total = rainy(61, 70);
    for (let day = 61; day <= 70; day++) expect(moatFill(finishedMoat(32, day)), `day ${day}`).toBeCloseTo(rainy(61, day) / total);
    expect(moatFill(finishedMoat(32, 71))).toBe(1);
    expect(moatFill(finishedMoat(32, 400))).toBe(1);
  });

  it('rises from the day it was finished when finished mid-spring, and is full by summer', () => {
    const dugDay = 25;
    const total = rainy(26, 30);
    expect(total).toBeGreaterThan(0);
    expect(moatFill(finishedMoat(dugDay, dugDay))).toBe(0);
    for (let day = 26; day <= 30; day++) expect(moatFill(finishedMoat(dugDay, day)), `day ${day}`).toBeCloseTo(rainy(26, day) / total);
    expect(moatFill(finishedMoat(dugDay, 31))).toBe(1);
  });

  it('stays empty through a spring with no rain after it was finished, then is full in summer', () => {
    const lastRain = [...Array(10).keys()].map(i => 21 + i).filter(day => rainWindow(day)).pop()!;
    const dugDay = lastRain;
    expect(rainy(dugDay + 1, 30)).toBe(0);
    for (let day = dugDay; day <= 30; day++) expect(moatFill(finishedMoat(dugDay, day))).toBe(0);
    expect(moatFill(finishedMoat(dugDay, 31))).toBe(1);
  });

  it('is never less on a later day, for any finishing day, over several years', () => {
    for (let dugDay = 1; dugDay <= 160; dugDay += 3) {
      let last = 0;
      for (let day = dugDay; day <= dugDay + 130; day++) {
        const fill = moatFill(finishedMoat(dugDay, day));
        expect(fill, `dug ${dugDay}, day ${day}`).toBeGreaterThanOrEqual(last);
        expect(fill).toBeLessThanOrEqual(1);
        last = fill;
      }
      expect(last).toBe(1);
    }
  });

  it('rises on a rainy day and holds on a dry one', () => {
    for (let day = 101; day <= 110; day++) {
      const change = moatFill(finishedMoat(85, day)) - moatFill(finishedMoat(85, day - 1));
      expect(season(day)).toBe('spring');
      if (rainWindow(day)) expect(change, `day ${day}`).toBeGreaterThan(0);
      else expect(change, `day ${day}`).toBe(0);
    }
  });

  it('follows each year\'s own rain: the springs have different totals, and each fills', () => {
    const totals = [0, 1, 2, 3, 4, 5, 6, 7].map(year => rainy(21 + 40 * year, 30 + 40 * year));
    expect(new Set(totals).size).toBeGreaterThan(1);
    for (const year of [1, 2, 3, 4]) {
      const dugDay = 5 + 40 * year;
      expect(moatFill(finishedMoat(dugDay, 29 + 40 * year))).toBeGreaterThan(0);
      expect(moatFill(finishedMoat(dugDay, 31 + 40 * year))).toBe(1);
    }
  });

  it('works from the day and the dug day alone, so a state read back later gives the same fill', () => {
    const state = finishedMoat(5, 25);
    const again = JSON.parse(JSON.stringify(state)) as GameState;
    expect(moatFill(again)).toBe(moatFill(state));
    expect(moatFill(again)).toBeGreaterThanOrEqual(0);
  });

  it('draws a small fixed set of levels, each rain showing at least one', () => {
    const levels = new Set([0, 0.001, 0.2, 0.34, 0.5, 0.74, 0.99, 1].map(moatLevel));
    expect([...levels].sort()).toEqual([0, 1, 2, 3, 4]);
    expect(moatLevel(0)).toBe(0);
    expect(moatLevel(1)).toBe(4);
    expect(moatLevel(0.01)).toBe(1);
    expect(moatLevel(0.99)).toBe(3);
  });
});

describe('the moat: where it lies', () => {
  const near = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

  it('is a ring one tile outside the wall, within the map, with sixteen stretches that tile it', () => {
    expect(MOAT_TILES.length).toBeGreaterThan(40);
    for (const tile of MOAT_TILES) {
      expect(Math.max(WALLS.left - tile.x, tile.x - WALLS.right, WALLS.top - tile.y, tile.y - WALLS.bottom)).toBe(1);
      expect(tile.x).toBeGreaterThan(0);
      expect(tile.y).toBeGreaterThan(0);
      expect(tile.stretch).toBeGreaterThanOrEqual(0);
      expect(tile.stretch).toBeLessThan(NEEDS.moat);
    }
    expect(new Set(MOAT_TILES.map(tile => `${tile.x},${tile.y}`)).size).toBe(MOAT_TILES.length);
    expect(new Set(MOAT_TILES.map(tile => tile.stretch)).size).toBe(NEEDS.moat);
    expect(MOAT_TILES.map(tile => tile.stretch)).toEqual(MOAT_TILES.map(tile => tile.stretch).sort((a, b) => a - b));
  });

  it('keeps clear of the outcrop, the keep, the exit and the cart', () => {
    for (const tile of MOAT_TILES) for (const other of [OUTCROP_SITE, KEEP_SITE, HILLS_EXIT, CART_SPOTS.hills]) expect(near(tile, other), `${tile.x},${tile.y}`).toBeGreaterThan(1.9);
    expect(moatAt(OUTCROP_SITE.x, OUTCROP_SITE.y)).toBe(false);
  });

  it('leaves a bank of land where the road and the path cross it', () => {
    for (let stone = 11; stone <= NEEDS.road; stone++) {
      const at = roadStone(stone);
      for (const tile of MOAT_TILES) expect(near(tile, at), `road stone ${stone}`).toBeGreaterThan(1.2);
    }
    for (const [x, y] of [[25, 12], [25, 13], [12, 9], [13, 9.2], [25, 12.75]]) expect(moatAt(x, y), `${x},${y}`).toBe(false);
    for (const tile of MOAT_TILES) expect(moatAt(tile.x, tile.y)).toBe(true);
  });

  it('has no plants on it, in any season', () => {
    for (const time of ['autumn', 'winter', 'spring', 'summer'] as const) {
      const map = buildMap([], 'hills', time);
      for (const item of map.decorations) expect(moatAt(Math.round(item.x), Math.round(item.y)), `${time} ${item.x},${item.y}`).toBe(false);
    }
  });
});

describe('the moat: prompts, keys and taps beside the towers and the gatehouse', () => {
  const near = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
  const sweep = (state: GameState, check: (there: GameState, nearest: NonNullable<ReturnType<typeof nearestCastleSpot>>) => void): Set<string> => {
    const sites = new Set<string>();
    for (let x = 10; x <= 27; x += 0.25) for (let y = 3; y <= 18; y += 0.25) {
      const there = { ...state, player: { ...state.player, x, y } };
      const nearest = nearestCastleSpot(there);
      if (!nearest || near(there.player, nearest) > BALANCE.interactionRadius) {
        expect(useKeyAction(there)?.type, `${x},${y}`).not.toBe('castleWork');
        continue;
      }
      sites.add(nearest.site);
      // Where the keep's door is in reach too, E is the door's, as it always was.
      if (near(there.player, KEEP_SITE) <= BALANCE.interactionRadius) {
        expect(useKeyAction(there), `${x},${y}`).toEqual({ type: 'enterKeep' });
        expect(targetAction(pickTapTarget(there, nearest.x, nearest.y)), `${x},${y}`).toEqual({ type: 'castleWork', site: nearest.site });
        continue;
      }
      check(there, nearest);
    }
    return sites;
  };
  const agree = (there: GameState, nearest: NonNullable<ReturnType<typeof nearestCastleSpot>>): void => {
    const where = `${there.player.x},${there.player.y}`;
    expect(targetAction(pickTapTarget(there, nearest.x, nearest.y)), where).toEqual({ type: 'castleWork', site: nearest.site });
    const prompt = promptFor(there);
    if (castleWorkBlocker(there, nearest.site) === null) {
      expect(useKeyAction(there), where).toEqual({ type: 'castleWork', site: nearest.site });
      expect(prompt, where).toContain(castlePrompt(there, nearest as never));
    } else {
      expect(useKeyAction(there)?.type, where).not.toBe('castleWork');
      expect(prompt, where).not.toMatch(/E  Dig/);
    }
  };
  const all = (castle: Partial<GameState['castle']> = {}, changes: Partial<GameState> = {}): GameState =>
    gateOpen(castle, { day: 33, ...changes });

  it('keeps each stretch\'s spot clear of every tower and the gatehouse', () => {
    for (let n = 0; n < NEEDS.moat; n++) {
      const moat = spotOf(all({ moat: { stretches: n, lastDugDay: n ? 32 : null, dugDay: null } }), 'moat');
      for (const other of [...TOWER_LIST.map(id => spotOf(all(), `tower-${id}`)), spotOf(all(), 'gatehouse')]) {
        expect(near(moat, other), `stretch ${n} and ${other.site}`).toBeGreaterThan(1);
      }
    }
  });

  it('gives the prompt, E and a tap the same site wherever stretches, towers and the gatehouse are in reach', () => {
    for (let n = 0; n < NEEDS.moat; n++) {
      const state = all({ moat: { stretches: n, lastDugDay: n ? 32 : null, dugDay: null } });
      const sites = sweep(state, agree);
      expect(sites.has('moat'), `stretch ${n}`).toBe(true);
    }
  }, 30000); // Thousands of positions for each of sixteen stretches: slow on a busy machine.

  it('never loses a tower or the gatehouse: each is E\'s choice on its own spot, however the moat stands', () => {
    for (let n = 0; n < NEEDS.moat; n++) for (const lastDugDay of [32, 33]) {
      const state = all({ moat: { stretches: Math.max(n, 1), lastDugDay, dugDay: null } });
      for (const site of [...TOWER_LIST.map(id => `tower-${id}`), 'gatehouse']) {
        const spot = spotOf(state, site);
        const there = { ...state, player: { ...state.player, x: spot.x, y: spot.y } };
        expect(nearestCastleSpot(there)?.site, `${site} with stretch ${n} (${lastDugDay})`).toBe(site);
        expect(useKeyAction(there), `${site} with stretch ${n}`).toEqual({ type: 'castleWork', site });
      }
    }
  });

  it('does the tower where a stretch dug today is nearer and the tower is in reach', () => {
    let testedAny = 0;
    for (let n = 1; n < NEEDS.moat; n++) {
      const state = all({ moat: { stretches: n, lastDugDay: 33, dugDay: null } });
      const moat = spotOf(state, 'moat');
      let tested = 0;
      for (const id of TOWER_LIST) {
        const tower = spotOf(state, `tower-${id}`);
        const mid = { x: (moat.x * 3 + tower.x) / 4, y: (moat.y * 3 + tower.y) / 4 };
        const there = { ...state, player: { ...state.player, ...mid } };
        if (near(there.player, tower) > BALANCE.interactionRadius || near(there.player, moat) >= near(there.player, tower)) continue;
        tested++;
        expect(nearestCastleSpot(there)?.site).toBe(`tower-${id}`);
        expect(useKeyAction(there)).toEqual({ type: 'castleWork', site: `tower-${id}` });
        expect(promptFor(there)).toContain('E  Lay a tower stone');
      }
      testedAny += tested;
    }
    expect(testedAny).toBeGreaterThan(0);
    const sweepState = all({ moat: { stretches: 3, lastDugDay: 33, dugDay: null } });
    const sites = sweep(sweepState, agree);
    expect(sites.has('moat')).toBe(true);
  });

  it('says plainly, with no action, that a stretch dug today can wait until tomorrow', () => {
    const state = standAt(all({ moat: { stretches: 2, lastDugDay: 33, dugDay: null } }), 'moat');
    expect(castlePrompt(state, spotOf(state, 'moat'))).toBe('Moat · today\'s stretch is dug, the next can wait until tomorrow');
    expect(promptFor(state)).toContain('Moat · today\'s stretch is dug, the next can wait until tomorrow');
    expect(promptFor(state)).not.toContain('E  Moat');
    expect(useKeyAction(state)?.type).not.toBe('castleWork');
    expect(targetAction(pickTapTarget(state, spotOf(state, 'moat').x, spotOf(state, 'moat').y))).toEqual({ type: 'castleWork', site: 'moat' });
    expect(applyAction(state, { type: 'castleWork', site: 'moat' }).message).toBe(DUG_TODAY);
  });

  it('says plainly that the ground is frozen in winter, with no action', () => {
    const state = standAt(all({}, { day: 15 }), 'moat');
    expect(promptFor(state)).toContain('Moat · the ground is frozen, it can wait for spring');
    expect(promptFor(state)).not.toContain('E  Moat');
    expect(useKeyAction(state)?.type).not.toBe('castleWork');
    expect(applyAction(state, { type: 'castleWork', site: 'moat' }).message).toBe(FROZEN);
  });

  it('keeps a frozen moat from taking the tower\'s E, and sweeps clean in winter', () => {
    const state = all({}, { day: 15 });
    const sites = sweep(state, agree);
    expect(sites).toEqual(new Set(['moat', 'gatehouse', 'tower-nw', 'tower-ne', 'tower-se', 'tower-sw', 'hall']));
  });

  it('digs by key and by tap, from a place reached on foot, in every season but winter', () => {
    for (const day of [5, 25, 33, 45]) {
      const state = standAt(moatOpen({}, { day }), 'moat');
      expect(useKeyAction(state), `day ${day}`).toEqual({ type: 'castleWork', site: 'moat' });
      expect(targetAction(pickTapTarget(state, spotOf(state, 'moat').x, spotOf(state, 'moat').y))).toEqual({ type: 'castleWork', site: 'moat' });
    }
  });

  it('plays dust where the survivor dug', () => {
    const after = doWork(standAt(moatOpen(), 'moat'), 'moat').state;
    expect(actionEffect({ type: 'castleWork', site: 'moat' }, after)).toEqual({ kind: 'dust', x: after.player.x, y: after.player.y });
  });
});

describe('the moat: drawn on the hills', () => {
  const moatVisuals = (state: GameState) => sceneVisuals(state, 0).filter(visual => visual.id.startsWith('castle-moat'));
  const filled = (day: number, dugDay = 5): GameState => ({ ...finishedMoat(dugDay, day), day });

  it('draws nothing before the first stretch, then only the stretches dug', () => {
    expect(moatVisuals(moatOpen())).toEqual([]);
    const one = moatVisuals(dug(1, 33));
    expect(one).toHaveLength(MOAT_TILES.filter(tile => tile.stretch === 0).length);
    const eight = moatVisuals(dug(8, 33));
    expect(eight).toHaveLength(MOAT_TILES.filter(tile => tile.stretch < 8).length);
    expect(moatVisuals(dug(16, 33))).toHaveLength(MOAT_TILES.length);
  });

  it('draws only on the hills, on the ground under everything else', () => {
    expect(sceneVisuals({ ...dug(8, 33), area: 'camp' }, 0).some(visual => visual.id.startsWith('castle-moat'))).toBe(false);
    for (const visual of moatVisuals(dug(16, 33))) expect(visual.depth).toBeLessThan(0);
  });

  it('shows a dry ditch while it is empty, rising as the rain falls, and full by summer', () => {
    const texture = (day: number) => moatVisuals(filled(day))[0].texture.split(':')[1].replace(/[hvs]/g, '');
    expect(texture(8)).toBe('0');
    expect(texture(20)).toBe('0');
    expect(texture(21)).toBe(rainWindow(21) ? texture(21) : '0');
    const rainDay = [...Array(10).keys()].map(i => 21 + i).find(day => rainWindow(day))!;
    expect(texture(rainDay)).not.toBe('0');
    expect(texture(31)).toBe('4');
    expect(texture(33)).toBe('4');
  });

  it('is frozen in winter frames, and dry ditches wear snow', () => {
    const summer = moatVisuals(filled(33))[0].texture;
    const winter = moatVisuals(filled(55))[0].texture;
    expect(winter).toBe(`${summer}s`);
    expect(moatVisuals(dug(3, 33, {}, { day: 15 }))[0].texture.endsWith('s')).toBe(true);
  });

  it('keeps textures to a small fixed set that exist as sprites', () => {
    const seen = new Set<string>();
    for (const day of [1, 5, 12, 22, 24, 26, 28, 33, 55, 63, 66, 70, 75, 100]) {
      for (const dugDay of [5, 25, 35]) for (const visual of moatVisuals(filled(day, dugDay))) seen.add(visual.texture);
    }
    // Six pieces (two runs and four corners), at five levels, with and without snow.
    expect(seen.size).toBeLessThanOrEqual(60);
    for (const texture of seen) expect(castleSprites.castleMoat.frames[texture.split(':')[1]], texture).toBeDefined();
  });

  it('shows the view from the keep a dug moat, and not one still being dug', () => {
    expect(castleView(dug(16, 33)).moat).toBe(true);
    expect(castleView(dug(15, 33)).moat).toBe(false);
    expect(castleView(moatOpen()).moat).toBe(false);
  });
});

// ---- Fix round: the gatehouse stands clear of the tower, and the moat's corners join ----

describe('the gatehouse stands east of the wall line, clear of the south-east tower', () => {
  const sprite = castleSprites.castleGatehouse;
  const towerSprite = castleSprites.castleTower;
  const pixelLeft = (tileX: number, def: { size: number[]; anchor: number[] }) => Math.round((tileX + 0.5) * 16) - def.anchor[0];
  const gateState = () => gateOpen({ gatehouse: 30, towers: { nw: FULL_TOWER, ne: FULL_TOWER, se: FULL_TOWER, sw: FULL_TOWER } });

  it('has its picture start where the tower\'s ends, and stand lower than the tower', () => {
    const spot = GATE_SPOT;
    const towerRight = pixelLeft(WALLS.right, towerSprite) + towerSprite.size[0];
    expect(pixelLeft(spot.x, sprite)).toBeGreaterThanOrEqual(towerRight);
    expect(sprite.anchor[1]).toBeLessThan(towerSprite.anchor[1] - 20);
    expect(spot.x).toBeGreaterThan(WALLS.right + 1);
    expect(spot.x).toBeLessThanOrEqual(27);
    expect(spot.y).toBeGreaterThanOrEqual(12.5);
    expect(spot.y).toBeLessThanOrEqual(13.5);
  });

  it('leaves the east wall whole under it, and draws the block beside the tower', () => {
    const ids = sceneVisuals(gateState(), 0).map(visual => visual.id);
    for (let i = 0; i < 9; i++) expect(ids).toContain(`castle-wall-east-${i}`);
    const gate = sceneVisuals(gateState(), 0).find(visual => visual.id === 'castle-gatehouse')!;
    const tower = sceneVisuals(gateState(), 0).find(visual => visual.id === 'castle-tower-se')!;
    expect(gate.x - sprite.anchor[0]).toBeGreaterThanOrEqual(tower.x - towerSprite.anchor[0] + towerSprite.size[0]);
    expect(gate.y).toBeLessThan(tower.y);
  });

  it('plays the drop and rise in the block\'s arch, away from the tower', () => {
    const gate = sceneVisuals(gateState(), 0).find(visual => visual.id === 'castle-gatehouse')!;
    const tower = sceneVisuals(gateState(), 0).find(visual => visual.id === 'castle-tower-se')!;
    const before = standAt(gateOpen({ gatehouse: 29 }), 'gatehouse');
    const effect = actionEffect({ type: 'castleWork', site: 'gatehouse' }, doWork(before, 'gatehouse').state)!;
    const grate = effectVisuals(gateState(), 1500, [{ kind: 'portcullis', startedAtMs: 1000, x: effect.x, y: effect.y }])[0];
    expect(grate.x).toBe(gate.x);
    expect(grate.y).toBeLessThan(gate.y);
    expect(grate.y).toBeGreaterThan(gate.y - PASSAGE_H - 2);
    expect(Math.abs(grate.x - tower.x)).toBeGreaterThan(towerSprite.size[0] / 2);
  });

  it('is worked from the block\'s own front, and the survivor sorts against it by y', () => {
    const state = { ...gateState(), player: { ...gateState().player, ...GATE_SPOT } };
    expect(spotOf(gateOpen(), 'gatehouse')).toMatchObject({ x: GATE_SPOT.x, y: GATE_SPOT.y });
    const { depth } = sceneVisuals(state, 0).find(visual => visual.id === 'castle-gatehouse')!;
    expect(playerVisualDepth({ ...state, player: { ...state.player, y: GATE_SPOT.y - 1 } })).toBeLessThan(depth);
    expect(playerVisualDepth({ ...state, player: { ...state.player, y: GATE_SPOT.y + 1 } })).toBeGreaterThan(depth);
  });
});

describe('the moat\'s corners join the runs', () => {
  const frames = castleSprites.castleMoat.frames;
  const at = (name: string, x: number, y: number): string => frames[name][y][x];
  const ring = MOAT_TILES;
  const side = (from: { x: number; y: number }, to: { x: number; y: number }): [string, string] | null => {
    if (to.x === from.x + 1 && to.y === from.y) return ['e', 'w'];
    if (to.x === from.x - 1 && to.y === from.y) return ['w', 'e'];
    if (to.y === from.y + 1 && to.x === from.x) return ['s', 'n'];
    if (to.y === from.y - 1 && to.x === from.x) return ['n', 's'];
    return null;
  };
  const edge = (name: string, dir: string): string => {
    const cells = Array.from({ length: 16 }, (_, i) => ({ e: [15, i], w: [0, i], s: [i, 15], n: [i, 0] }[dir] as number[]));
    return cells.map(([x, y]) => at(name, x, y)).join('');
  };
  const name = (tile: (typeof MOAT_TILES)[number], level: number, snow: string): string => `${moatPiece(tile)}${level}${snow}`;

  it('names a corner piece for each of the four corners, and straight pieces elsewhere', () => {
    const pieces = ring.map(tile => [tile.x, tile.y, moatPiece(tile)]);
    expect(pieces.filter(piece => !['h', 'v'].includes(piece[2] as string))).toEqual([[25, 16, 'se'], [12, 16, 'sw'], [12, 4, 'nw'], [25, 4, 'ne']]);
  });

  it.each([0, 1, 2, 3, 4])('meets its neighbour edge to edge all round the ring at level %i, in summer and winter', (level) => {
    for (const snow of ['', 's']) {
      ring.forEach((tile, i) => {
        const next = ring[i + 1];
        const dirs = next && side(tile, next);
        if (!dirs) return;
        expect(edge(name(tile, level, snow), dirs[0]), `${tile.x},${tile.y} to ${next.x},${next.y} level ${level}${snow}`).toBe(edge(name(next, level, snow), dirs[1]));
      });
    }
  });

  it('has a picture for every corner at every level, with the water running round the bend', () => {
    for (const corner of ['nw', 'ne', 'sw', 'se']) {
      for (const level of [0, 1, 2, 3, 4]) for (const snow of ['', 's']) expect(frames[`${corner}${level}${snow}`], `${corner}${level}${snow}`).toBeDefined();
    }
    expect(at('sw4', 7, 7)).toBe('s');
    expect(at('sw4', 12, 7)).toBe('s');
    expect(at('sw4', 7, 0)).toBe('s');
    expect(at('sw4', 1, 15)).not.toBe('s');
  });
});

// ---- The hall and its hangings ----

const FULL_HALL = { stones: NEEDS.hallStones, beams: NEEDS.hallBeams, fittings: NEEDS.hallFittings, hangings: NEEDS.hallHangings };
const hallOpen = (hall: Partial<GameState['castle']['hall']> = {}, castle: Partial<GameState['castle']> = {}, changes: Partial<GameState> = {}): GameState =>
  framesUp({ hall: { ...emptyCastle().hall, ...hall }, ...castle }, { inventory: { ...game.inventory, stone: 3 }, ...changes });

describe('the hall: when it opens and what it asks for', () => {
  it('opens once the frames are done, with the wall untouched, and not before', () => {
    expect(siteNeed(built({ frames: 10 }), 'hall')).toBeNull();
    expect(siteNeed(hallOpen(), 'hall')).toEqual({ kind: 'stone' });
    expect(castleSpots(hallOpen()).map(spot => spot.site)).toEqual([...SIDE_LIST.map(side => `wall-${side}`), 'hall']);
    expect(siteNeed(wallsUp(), 'hall')).toEqual({ kind: 'stone' });
  });

  it('asks for forty stones, then twelve beams, six fittings and two hangings, in that order', () => {
    const need = (hall: Partial<GameState['castle']['hall']>) => siteNeed(hallOpen({ ...FULL_HALL, ...hall }), 'hall');
    expect(need({ stones: 0, beams: 0, fittings: 0, hangings: 0 })).toEqual({ kind: 'stone' });
    expect(need({ stones: 39, beams: 0, fittings: 0, hangings: 0 })).toEqual({ kind: 'stone' });
    expect(need({ beams: 0, fittings: 0, hangings: 0 })).toEqual({ kind: 'good', good: 'beams' });
    expect(need({ beams: 11, fittings: 0, hangings: 0 })).toEqual({ kind: 'good', good: 'beams' });
    expect(need({ fittings: 0, hangings: 0 })).toEqual({ kind: 'good', good: 'fittings' });
    expect(need({ fittings: 5, hangings: 0 })).toEqual({ kind: 'good', good: 'fittings' });
    expect(need({ hangings: 0 })).toEqual({ kind: 'good', good: 'hangings' });
    expect(need({ hangings: 1 })).toEqual({ kind: 'good', good: 'hangings' });
    expect(need({})).toBeNull();
    expect(hallFinished(FULL_HALL)).toBe(true);
    expect(hallFinished({ ...FULL_HALL, hangings: 1 })).toBe(false);
  });

  it('lays a stone from the cart first, then the bag, and says so', () => {
    const state = standAt(hallOpen({}, { cart: { stone: 1, at: 'hills' } }, { inventory: { ...game.inventory, stone: 1 } }), 'hall');
    expect(promptFor(state)).toMatch(/^E  Lay a hall stone \(0\/40\)( ·|$)/);
    const first = doWork(state, 'hall');
    expect(first.state.castle.hall.stones).toBe(1);
    expect(first.state.castle.cart.stone).toBe(0);
    expect(first.state.inventory.stone).toBe(1);
    expect(first.message).toBe('You lay the first stone of the great hall.');
    expect(first.state.player.energy).toBeLessThan(state.player.energy);
    const half = standAt(hallOpen({ stones: 19 }), 'hall');
    expect(doWork(half, 'hall').message).toBe('The hall walls are halfway.');
    const last = standAt(hallOpen({ stones: 39 }), 'hall');
    expect(doWork(last, 'hall').message).toBe('You lay the last stone of the hall. It wants a roof.');
  });

  it('moves a beam, a fitting and a hanging from the goods into the hall', () => {
    const goods = { beams: 3, fittings: 3, hangings: 1 };
    const beam = standAt(hallOpen({ stones: 40, beams: 5 }, { goods }), 'hall');
    expect(promptFor(beam)).toMatch(/^E  Set a hall beam \(5\/12\)( ·|$)/);
    const beamed = doWork(beam, 'hall');
    expect(beamed.state.castle.hall.beams).toBe(6);
    expect(beamed.state.castle.goods.beams).toBe(2);
    expect(beamed.message).toBe('You set a beam in the hall roof.');
    const fit = standAt(hallOpen({ stones: 40, beams: 12, fittings: 2 }, { goods }), 'hall');
    expect(promptFor(fit)).toMatch(/^E  Fit iron to the hall \(2\/6\)( ·|$)/);
    const fitted = doWork(fit, 'hall');
    expect(fitted.state.castle.hall.fittings).toBe(3);
    expect(fitted.state.castle.goods.fittings).toBe(2);
    expect(fitted.message).toBe('You fit iron to the hall.');
    const hang = standAt(hallOpen({ stones: 40, beams: 12, fittings: 6, hangings: 0 }, { goods }), 'hall');
    expect(promptFor(hang)).toMatch(/^E  Hang a hall hanging \(0\/2\)( ·|$)/);
    const hung = doWork(hang, 'hall');
    expect(hung.state.castle.hall.hangings).toBe(1);
    expect(hung.state.castle.goods.hangings).toBe(0);
    expect(hung.message).toBe('You hang a wool hanging on the hall wall.');
  });

  it('refuses what has not been made, saying where to make it, and spends nothing', () => {
    const ask = (hall: Partial<GameState['castle']['hall']>) => standAt(hallOpen(hall), 'hall');
    const beams = ask({ stones: 40 });
    expect(castleWorkBlocker(beams, 'hall')).toBe('Make oak beams at the workshop for the hall. Hall beams 0/12.');
    expect(promptFor(beams)).toMatch(/^Hall beams 0\/12 · make oak beams at workshop( ·|$)/);
    expect(useKeyAction(beams)).toBeUndefined();
    expect(doWork(beams, 'hall').state).toBe(beams);
    expect(castleWorkBlocker(ask({ stones: 40, beams: 12 }), 'hall')).toBe('Make iron fittings at the forge for the hall. Hall fittings 0/6.');
    const hangings = ask({ stones: 40, beams: 12, fittings: 6 });
    expect(castleWorkBlocker(hangings, 'hall')).toBe('Weave a hanging at the loom for the hall. Hall hangings 0/2; wool 0/3.');
    expect(promptFor(hangings)).toMatch(/^Hall hangings 0\/2 · wool 0\/3 · weave at loom( ·|$)/);
    expect(castleWorkBlocker(ask({}), 'hall')).toBeNull();
    const noStone = standAt(hallOpen({}, {}, { inventory: { ...game.inventory, stone: 0 } }), 'hall');
    expect(castleWorkBlocker(noStone, 'hall')).toBe('Bring stone to build the hall. Hall stones 0/40.');
    expect(promptFor(noStone)).toMatch(/^Hall stones 0\/40 · bring stone( ·|$)/);
  });

  it('keeps the current hall stage count visible while materials are missing', () => {
    const missing = (hall: Partial<GameState['castle']['hall']>, stone = 3) => {
      const state = standAt(hallOpen(hall, {}, { inventory: { ...game.inventory, stone } }), 'hall');
      return castlePrompt(state, spotOf(state, 'hall'));
    };
    expect(missing({ stones: 19 }, 0)).toBe('Hall stones 19/40 · bring stone');
    expect(missing({ stones: 40, beams: 2 })).toBe('Hall beams 2/12 · make oak beams at workshop');
    expect(missing({ stones: 40, beams: 12, fittings: 4 })).toBe('Hall fittings 4/6 · make iron fittings at forge');
    expect(castleSpots(hallOpen(FULL_HALL)).some(spot => spot.site === 'hall')).toBe(false);
  });

  it('updates the hanging shortage with basket wool and returns to the ready prompt for a made hanging', () => {
    const base = standAt(hallOpen({ stones: 40, beams: 12, fittings: 6, hangings: 1 }), 'hall');
    const short = { ...base, sheep: { ...base.sheep, wool: 2 } };
    expect(castlePrompt(short, spotOf(short, 'hall'))).toBe('Hall hangings 1/2 · wool 2/3 · weave at loom');
    expect(castleWorkBlocker(short, 'hall')).toBe('Weave a hanging at the loom for the hall. Hall hangings 1/2; wool 2/3.');
    const full = { ...short, sheep: { ...short.sheep, wool: 3 } };
    expect(castlePrompt(full, spotOf(full, 'hall'))).toBe('Hall hangings 1/2 · wool 3/3 · weave at loom');

    const stocked = { ...short, castle: { ...short.castle, goods: { ...short.castle.goods, hangings: 1 } } };
    expect(castlePrompt(stocked, spotOf(stocked, 'hall'))).toBe('Hang a hall hanging (1/2)');
    expect(castleWorkBlocker(stocked, 'hall')).toBeNull();
  });

  it('refuses a tired survivor with the usual line at every stage, with the goods in hand', () => {
    const goods = { beams: 2, fittings: 2, hangings: 2 };
    for (const hall of [{}, { stones: 40 }, { stones: 40, beams: 12 }, { stones: 40, beams: 12, fittings: 6 }]) {
      const state = standAt(hallOpen(hall, { goods }), 'hall');
      const tired = { ...state, player: { ...state.player, energy: 0 } };
      expect(doWork(tired, 'hall').message).toBe(TOO_TIRED_MESSAGE);
      expect(doWork(tired, 'hall').state).toBe(tired);
    }
  });

  it('can stop at any point: nothing else waits on the hall, and finishing it leaves the castle unfinished', () => {
    const half = hallOpen({ stones: 20, beams: 0 });
    expect(siteNeed(wallsUp({ hall: { ...emptyCastle().hall, stones: 20 } }), 'wall-north')).toBeNull();
    expect(siteNeed(half, 'wall-north')).toEqual({ kind: 'stone' });
    expect(siteNeed(wallsUp({ hall: { stones: 20, beams: 0, fittings: 0, hangings: 0 } }), 'moat')).toEqual({ kind: 'dig' });
    const before = standAt(hallOpen({ ...FULL_HALL, hangings: 1 }, { goods: { beams: 0, fittings: 0, hangings: 1 } }), 'hall');
    const after = doWork(before, 'hall');
    expect(hallFinished(after.state.castle.hall)).toBe(true);
    expect(after.state.castle.doneDays.hall).toBe(before.day);
    expect(after.state.castle.finishedDay).toBeNull();
    expect(castleWorkLine(before, after.state)).toBe('The great hall is roofed, fitted and hung. It wants a feast.');
    expect(siteNeed(after.state, 'hall')).toBeNull();
    expect(castleNews(after.state, { ...after.state, day: after.state.day + 1 })).toEqual(['The great hall stands finished.']);
    expect(castleNews(before, { ...before, day: before.day + 1 })).toEqual([]);
    expect(doWork(after.state, 'hall').message).toBe('The great hall is finished.');
  });
});

describe('the hall: where it stands and how it is drawn', () => {
  const px = (spot: { x: number; y: number }, def: { anchor: number[]; size: number[] }) => {
    const left = Math.round((spot.x + 0.5) * 16) - def.anchor[0];
    const top = Math.round((spot.y + 0.5) * 16) - def.anchor[1];
    return { left, top, right: left + def.size[0], bottom: top + def.size[1] };
  };
  const overlap = (a: ReturnType<typeof px>, b: ReturnType<typeof px>) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const hall = castleSprites.castleHall;

  it('stands in the yard at (21, 9), inside the wall, between the keep and the east wall', () => {
    expect(spotOf(hallOpen(), 'hall')).toMatchObject({ area: 'hills', x: 21, y: 9 });
    expect(HALL_SPOT).toMatchObject({ x: 21, y: 9 });
    expect(HALL_SPOT.x).toBeGreaterThan(KEEP_SITE.x);
    expect(HALL_SPOT.x).toBeLessThan(WALLS.right);
  });

  it('keeps its picture off the keep, the east wall, the frames, the outcrop and the towers', () => {
    const box = px(HALL_SPOT, hall);
    expect(overlap(box, px(KEEP_SITE, keepSprites.keep))).toBe(false);
    expect(box.left).toBeGreaterThanOrEqual(px(KEEP_SITE, keepSprites.keep).right);
    expect(overlap(box, px({ x: FRAMES_SPOT.x, y: FRAMES_SPOT.y }, castleSprites.castleFrames))).toBe(false);
    expect(overlap(box, px(OUTCROP_SITE, { anchor: [8, 15], size: [16, 16] }))).toBe(false);
    for (let y = WALLS.top; y <= WALLS.bottom; y++) expect(overlap(box, px({ x: WALLS.right, y }, castleSprites.castleWall)), `east wall ${y}`).toBe(false);
    for (const [x, y] of [[WALLS.right, WALLS.top], [WALLS.left, WALLS.top]]) expect(overlap(box, px({ x, y }, castleSprites.castleTower))).toBe(false);
    for (let x = WALLS.left + 1; x < WALLS.right; x++) expect(overlap(box, px({ x, y: WALLS.top }, castleSprites.castleWall)), `north wall ${x}`).toBe(false);
  });

  it('leaves its door clear of the frames and the south wall, and the survivor at the spot stands at the door', () => {
    const box = px(HALL_SPOT, hall);
    const door = { left: box.left + HALL_DOOR.x, top: box.top + HALL_DOOR.y, right: box.left + HALL_DOOR.x + HALL_DOOR.w, bottom: box.top + HALL_DOOR.y + HALL_DOOR.h };
    expect(door.left).toBeLessThanOrEqual(Math.round((HALL_SPOT.x + 0.5) * 16));
    expect(door.right).toBeGreaterThanOrEqual(Math.round((HALL_SPOT.x + 0.5) * 16));
    expect(door.bottom).toBeLessThanOrEqual(Math.round((HALL_SPOT.y + 0.5) * 16) + 1);
    expect(overlap(door, px({ x: FRAMES_SPOT.x, y: FRAMES_SPOT.y }, castleSprites.castleFrames))).toBe(false);
    for (let x = WALLS.left; x <= WALLS.right; x++) expect(overlap(door, px({ x, y: WALLS.bottom }, castleSprites.castleWall)), `south wall ${x}`).toBe(false);
    for (const [x, y] of [[WALLS.right, WALLS.bottom], [WALLS.left, WALLS.bottom]]) expect(overlap(door, px({ x, y }, castleSprites.castleTower))).toBe(false);
    expect(overlap(door, px(GATE_SPOT, castleSprites.castleGatehouse))).toBe(false);
  });

  it('sorts by its own foot against the survivor, and the frames sort after it', () => {
    const state = hallOpen({ stones: 5 });
    const visual = sceneVisuals(state, 0).find(each => each.id === 'castle-hall')!;
    const frames = sceneVisuals(framesUp({ hall: { ...emptyCastle().hall, stones: 5 } }), 0).find(each => each.id === 'castle-frames')!;
    expect(playerVisualDepth({ ...state, player: { ...state.player, y: HALL_SPOT.y - 1 } })).toBeLessThan(visual.depth);
    expect(playerVisualDepth({ ...state, player: { ...state.player, y: HALL_SPOT.y + 1 } })).toBeGreaterThan(visual.depth);
    expect(frames.depth).toBeGreaterThan(visual.depth);
  });

  it('is not drawn before the first stone, then rises through its stones, roof, iron and hangings, with snow in winter', () => {
    const texture = (hall: Partial<GameState['castle']['hall']>, day = 5) => sceneVisuals(hallOpen(hall, {}, { day }), 0).find(visual => visual.id === 'castle-hall')?.texture;
    expect(texture({})).toBeUndefined();
    const steps = [
      { stones: 1 }, { stones: 9 }, { stones: 17 }, { stones: 25 }, { stones: 33 }, { stones: 40 },
      { stones: 40, beams: 4 }, { stones: 40, beams: 8 }, { stones: 40, beams: 12 },
      { stones: 40, beams: 12, fittings: 3 }, { stones: 40, beams: 12, fittings: 6 },
      { stones: 40, beams: 12, fittings: 6, hangings: 1 }, FULL_HALL
    ];
    const names = steps.map(step => texture(step));
    expect(new Set(names).size).toBe(steps.length);
    expect(steps.map(step => hallStep({ ...emptyCastle().hall, ...step }))).toEqual(Array.from({ length: steps.length }, (_, i) => i + 1));
    expect(HALL_STEPS).toBe(steps.length);
    expect(texture({ stones: 9 }, 12)).toBe(`${names[1]}s`);
    for (const name of names.concat(texture(FULL_HALL, 12))) expect(hall.frames[name!.split(':')[1]], name).toBeDefined();
    expect(sceneVisuals(hallOpen({ stones: 3 }), 0).find(visual => visual.id === 'castle-hall')).toMatchObject({ x: Math.round((HALL_SPOT.x + 0.5) * 16), y: Math.round((HALL_SPOT.y + 0.5) * 16) });
  });

  it('shows in the keep\'s view only once the hall has everything', () => {
    expect(castleView(hallOpen()).hall).toBe(false);
    expect(castleView(hallOpen({ ...FULL_HALL, hangings: 1 })).hall).toBe(false);
    expect(castleView(hallOpen(FULL_HALL)).hall).toBe(true);
    expect(castleView(finishedKeep()).hall).toBe(false);
  });
});

describe('the hall: prompt, key and tap agree beside the keep and the east wall', () => {
  const near = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
  const stages: [string, Partial<GameState['castle']['hall']>][] = [['stones', {}], ['beams', { stones: 40 }], ['hangings', { stones: 40, beams: 12, fittings: 6 }]];

  it('has the keep\'s door first where both are in reach, and the hall where only it is', () => {
    for (const [name, hall] of stages) {
      const state = hallOpen(hall, { goods: { beams: 12, fittings: 6, hangings: 2 } }, { day: 33 });
      let both = 0, hallOnly = 0;
      for (let x = 16; x <= 25; x += 0.25) for (let y = 6; y <= 13; y += 0.25) {
        const there = { ...state, player: { ...state.player, x, y } };
        const nearest = nearestCastleSpot(there);
        const inKeep = near(there.player, KEEP_SITE) <= BALANCE.interactionRadius;
        const where = `${name} ${x},${y}`;
        if (inKeep) {
          expect(useKeyAction(there), where).toEqual({ type: 'enterKeep' });
          if (nearest && near(there.player, nearest) <= BALANCE.interactionRadius) both++;
        } else if (nearest && near(there.player, nearest) <= BALANCE.interactionRadius) {
          if (nearest.site === 'hall') hallOnly++;
          expect(useKeyAction(there), where).toEqual({ type: 'castleWork', site: nearest.site });
          expect(promptFor(there).startsWith(`E  ${castlePrompt(there, nearest)}`), `${where}: ${promptFor(there)}`).toBe(true);
        } else {
          expect(useKeyAction(there)?.type, where).not.toBe('castleWork');
        }
        if (nearest) expect(targetAction(pickTapTarget(there, nearest.x, nearest.y)), where).toEqual({ type: 'castleWork', site: nearest.site });
      }
      expect(both, name).toBeGreaterThan(0);
      expect(hallOnly, name).toBeGreaterThan(0);
    }
  });

  it('is the survivor\'s only choice at its own spot, by key and by tap, in every season', () => {
    for (const day of [5, 25, 33, 45]) for (const [name, hall] of stages) {
      const state = standAt(hallOpen(hall, { goods: { beams: 12, fittings: 6, hangings: 2 } }, { day }), 'hall');
      expect(nearestCastleSpot(state)?.site, `${name} ${day}`).toBe('hall');
      expect(useKeyAction(state), `${name} ${day}`).toEqual({ type: 'castleWork', site: 'hall' });
      expect(targetAction(pickTapTarget(state, HALL_SPOT.x, HALL_SPOT.y)), `${name} ${day}`).toEqual({ type: 'castleWork', site: 'hall' });
    }
  });

  it('leaves every other open site reachable at its own spot, with the hall open', () => {
    const state = wallsUp({ hall: { ...emptyCastle().hall, stones: 3 } }, { inventory: { ...game.inventory, stone: 3 } });
    for (const spot of castleSpots(state)) {
      const there = { ...state, player: { ...state.player, x: spot.x, y: spot.y } };
      expect(nearestCastleSpot(there)?.site, spot.site).toBe(spot.site);
      expect(targetAction(pickTapTarget(there, spot.x, spot.y)), spot.site).toEqual({ type: 'castleWork', site: spot.site });
    }
  });

  it('plays dust where the survivor laid', () => {
    const after = doWork(standAt(hallOpen(), 'hall'), 'hall').state;
    expect(actionEffect({ type: 'castleWork', site: 'hall' }, after)).toEqual({ kind: 'dust', x: after.player.x, y: after.player.y });
  });
});

describe('hangings: made at the loom from wool', () => {
  const atLoom = (wool: number, castle: Partial<GameState['castle']> = {}, changes: Partial<GameState> = {}): GameState => {
    const base = revealed();
    return {
      ...base, area: 'camp', player: { ...base.player, x: BALANCE.campX, y: BALANCE.campY, energy: 100 },
      structures: { ...base.structures, loom: true },
      sheep: { ...base.sheep, lastShornYear: 1, wool },
      castle: { ...base.castle, frames: 1, ...castle }, ...changes
    };
  };
  const make = (state: GameState) => applyAction(state, { type: 'makeCastleGood', good: 'hangings' });

  it('costs three wool a hanging, one at a time, from the basket', () => {
    expect(GOODS.hangings).toEqual({ batch: 1, wool: 3 });
    const { state: after, message } = make(atLoom(4));
    expect(after.castle.goods.hangings).toBe(1);
    expect(after.sheep.wool).toBe(1);
    expect(message).toBe('You wove a hanging for the hall.');
    expect(after.player.energy).toBeLessThan(100);
  });

  it('needs the loom, the frames begun and the clearing, and says so plainly', () => {
    expect(goodBlocker(atLoom(8), 'hangings')).toBeNull();
    const noLoom = atLoom(8);
    expect(goodBlocker({ ...noLoom, structures: { ...noLoom.structures, loom: false } }, 'hangings')).toBe('Build the loom first.');
    expect(goodBlocker(atLoom(8, { frames: 0 }), 'hangings')).toMatch(/frames/);
    expect(goodBlocker({ ...atLoom(8), area: 'hills' }, 'hangings')).toBe('Return to camp to use the loom.');
    expect(goodBlocker({ ...atLoom(8), castle: { ...revealed().castle, revealedDay: null, frames: 1 } }, 'hangings')).not.toBeNull();
  });

  it('can be made anywhere in the clearing, not only beside the loom', () => {
    const state = atLoom(8);
    for (const [dx, dy] of [[0, 0], [3, 0], [-3, 2]]) expect(goodBlocker({ ...state, player: { ...state.player, x: BALANCE.campX + dx, y: BALANCE.campY + dy } }, 'hangings'), `${dx},${dy}`).toBeNull();
  });

  it('says exactly how much wool is missing, and spends nothing', () => {
    expect(goodBlocker(atLoom(2), 'hangings')).toBe('You need 3 wool for the hanging.');
    const poor = atLoom(2);
    const result = make(poor);
    expect(result.message).toBe('You need 3 wool for the hanging.');
    expect(result.state).toBe(poor);
    expect(goodBlocker(atLoom(3), 'hangings')).toBeNull();
  });

  it('refuses a tired survivor with the usual line', () => {
    const state = atLoom(8);
    const tired = { ...state, player: { ...state.player, energy: 0 } };
    expect(make(tired).message).toBe(TOO_TIRED_MESSAGE);
    expect(make(tired).state).toBe(tired);
  });

  it('takes a second shearing for the second hanging when one shearing gives four wool', () => {
    expect(BALANCE.woolPerShearing).toBe(4);
    const first = make(atLoom(BALANCE.woolPerShearing)).state;
    expect(first.castle.goods.hangings).toBe(1);
    expect(goodBlocker(first, 'hangings')).toBe('You need 3 wool for the hanging.');
    const second = make({ ...first, sheep: { ...first.sheep, wool: first.sheep.wool + BALANCE.woolPerShearing } }).state;
    expect(second.castle.goods.hangings).toBe(2);
    expect(second.sheep.wool).toBe(2);
  });

  it('stops at two in all, counting what is already hung in the hall', () => {
    expect(goodRoom(atLoom(8), 'hangings')).toBe(2);
    expect(goodBatch(atLoom(8), 'hangings')).toBe(1);
    expect(goodBlocker(atLoom(8, { goods: { beams: 0, fittings: 0, hangings: 2 } }), 'hangings')).toBe('The castle has enough hangings now.');
    expect(goodBlocker(atLoom(8, { goods: { beams: 0, fittings: 0, hangings: 1 }, hall: { ...emptyCastle().hall, hangings: 1 } }), 'hangings')).toBe('The castle has enough hangings now.');
    expect(goodBlocker(atLoom(8, { goods: { beams: 0, fittings: 0, hangings: 1 } }), 'hangings')).toBeNull();
    const hung = atLoom(8, { goods: { beams: 0, fittings: 0, hangings: 0 }, hall: { ...emptyCastle().hall, hangings: 2 } });
    expect(goodBlocker(hung, 'hangings')).toBe('The castle has enough hangings now.');
  });

  it('leaves the cap unchanged when a hanging moves from the goods into the hall', () => {
    const state = standAt(hallOpen({ stones: 40, beams: 12, fittings: 6 }, { goods: { beams: 0, fittings: 0, hangings: 2 } }), 'hall');
    const hung = doWork(state, 'hall').state;
    expect(goodRoom(hung, 'hangings')).toBe(goodRoom(state, 'hangings'));
    expect(goodRoom(hung, 'beams')).toBe(goodRoom(state, 'beams'));
  });

  it('counts the hall\'s beams and fittings in the cap too', () => {
    // 4 per tower and 12 for the hall is 28 beams, and 14 fittings: a hall that has them all has room for none.
    const full = atLoom(8, { hall: { ...emptyCastle().hall, beams: 12, fittings: 6 }, goods: { beams: 16, fittings: 8, hangings: 0 } });
    expect(goodRoom(full, 'beams')).toBe(0);
    expect(goodRoom(full, 'fittings')).toBe(0);
  });
});

// ---- The feast and the finish ----

const gap = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);
const ALL_TOWERS = { nw: FULL_TOWER, ne: FULL_TOWER, se: FULL_TOWER, sw: FULL_TOWER };
const ALL_DONE_DAYS = { road: 3, frames: 2, 'wall-north': 2, 'wall-east': 2, 'wall-south': 2, 'wall-west': 2, 'tower-nw': 4, 'tower-ne': 4, 'tower-se': 4, 'tower-sw': 4, gatehouse: 5, moat: 20, hall: 6 };
const WHOLE_FEAST = { ...NEEDS.feast };
/** Every section built, the moat dug on day 20, and the survivor on the hills with the bag holding the food given. */
const feastReady = (castle: Partial<GameState['castle']> = {}, food: Partial<ReturnType<typeof emptyFood>> = {}, changes: Partial<GameState> = {}): GameState =>
  built({
    frames: NEEDS.frames, wall: ALL_WALL, towers: ALL_TOWERS, gatehouse: NEEDS.gatehouse, moat: { stretches: NEEDS.moat, lastDugDay: 20, dugDay: 20 },
    hall: FULL_HALL, doneDays: ALL_DONE_DAYS, ...castle
  }, { day: 34, progress: { ...built().progress, workshop: { ...built().progress.workshop, stoneCart: true, portcullis: true } }, inventory: { ...game.inventory, stone: 0, wood: 0, food: { ...emptyFood(), ...food } }, ...changes });
const atTable = (state: GameState): GameState => standAt(state, 'table');
const setDown = (state: GameState) => applyAction(state, { type: 'castleWork', site: 'table' });

describe('the feast: when the table opens', () => {
  it('names the sections, finished and unfinished, and says when every other one is done', () => {
    expect(everyOtherSectionDone(feastReady())).toBe(true);
    expect(everyOtherSectionDone(feastReady({ gatehouse: 29 }))).toBe(false);
    expect(everyOtherSectionDone(feastReady({ hall: { ...FULL_HALL, hangings: 1 } }))).toBe(false);
    expect(everyOtherSectionDone(feastReady({ towers: { ...ALL_TOWERS, se: { ...FULL_TOWER, fittings: 1 } } }))).toBe(false);
    expect(everyOtherSectionDone(feastReady({ moat: { stretches: 15, lastDugDay: 20, dugDay: null } }))).toBe(false);
    expect(everyOtherSectionDone(feastReady({ wall: { ...ALL_WALL, west: 29 } }))).toBe(false);
    expect(everyOtherSectionDone(feastReady({ road: 29 }))).toBe(false);
    const noCart = feastReady();
    expect(everyOtherSectionDone({ ...noCart, progress: { ...noCart.progress, workshop: { ...noCart.progress.workshop, stoneCart: false } } })).toBe(false);
  });

  it('opens the table only then, and the table asks for the first food that is still wanted', () => {
    expect(siteNeed(feastReady({ gatehouse: 29 }), 'table')).toBeNull();
    expect(castleSpots(feastReady({ gatehouse: 29 })).map(spot => spot.site)).not.toContain('table');
    expect(siteNeed(feastReady(), 'table')).toEqual({ kind: 'food', item: 'bread' });
    expect(castleSpots(feastReady()).map(spot => spot.site)).toEqual(['table']);
  });

  it('counts a moat fully dug and still empty as done', () => {
    const dry = feastReady({ moat: { stretches: NEEDS.moat, lastDugDay: 34, dugDay: 34 } });
    expect(moatFill(dry)).toBe(0);
    expect(everyOtherSectionDone(dry)).toBe(true);
    expect(siteNeed(dry, 'table')).not.toBeNull();
  });

  it('stays hidden until the line of stones has shown', () => {
    const hidden = feastReady({ revealedDay: null });
    expect(castleSpots(hidden)).toEqual([]);
    expect(castleWorkBlocker(atTable(feastReady()), 'table')).not.toBeNull();
    expect(castleWorkBlocker({ ...atTable(feastReady()), castle: { ...feastReady().castle, revealedDay: null } }, 'table')).toBe('There is nothing to build here yet.');
  });

  it('is open no longer once the castle is finished', () => {
    const finished = feastReady({ feast: WHOLE_FEAST, finishedDay: 34 });
    expect(castleFinished(finished)).toBe(true);
    expect(castleFinished(feastReady())).toBe(false);
    expect(siteNeed(finished, 'table')).toBeNull();
    expect(castleSpots(finished)).toEqual([]);
  });
});

describe('the feast: setting food down', () => {
  const stocked = (extra: Partial<ReturnType<typeof emptyFood>> = {}, castle: Partial<GameState['castle']> = {}, changes: Partial<GameState> = {}): GameState =>
    atTable(feastReady(castle, { bread: [30, 31], roastedHazelnuts: 1, honey: 2, apple: [33], vegetables: 5, ...extra }, changes));

  it('sets down one of the first food the table wants that the bag holds, in the order of the feast', () => {
    let state = stocked();
    const seen: string[] = [];
    for (let go = 0; go < 4; go++) {
      const before = state;
      const result = setDown(state);
      state = result.state;
      seen.push(Object.entries(NEEDS.feast).filter(([item]) => state.castle.feast[item as keyof typeof NEEDS.feast] > before.castle.feast[item as keyof typeof NEEDS.feast]).map(([item]) => item).join());
    }
    expect(seen).toEqual(['bread', 'bread', 'roastedHazelnuts', 'honey']);
    expect(state.castle.feast).toEqual({ bread: 2, roastedHazelnuts: 1, honey: 1, apple: 0, vegetables: 0 });
  });

  it('spends the food from the bag only, and not from the larder', () => {
    const state = stocked({ bread: [31] }, {}, { larder: { ...emptyFood(), bread: [30, 30, 30], honey: 4 }, structures: { ...feastReady().structures, larder: true } });
    const first = setDown(state).state;
    expect(first.inventory.food.bread).toEqual([]);
    expect(first.larder.bread).toEqual([30, 30, 30]);
    const second = setDown(first).state;
    expect(second.castle.feast).toMatchObject({ bread: 1, roastedHazelnuts: 1 });
    expect(second.larder).toEqual(first.larder);
    expect(foodCount(second.inventory.food, 'roastedHazelnuts')).toBe(0);
  });

  it('spends the oldest fresh piece first, and takes a go of time and a little energy', () => {
    const state = stocked();
    const result = setDown(state);
    expect(result.state.inventory.food.bread).toEqual([31]);
    expect(result.state.player.energy).toBeLessThan(state.player.energy);
    expect(result.state.timeOfDay).toBeGreaterThan(state.timeOfDay);
  });

  it('leaves a food the table has all it wants of in the bag', () => {
    const state = stocked({ bread: [31], roastedHazelnuts: 0, honey: 0, vegetables: 0, apple: [33] }, { feast: { ...NEEDS.feast, roastedHazelnuts: 0, honey: 0, vegetables: 0, bread: NEEDS.feast.bread - 1 } });
    const result = setDown(state);
    expect(result.state.castle.feast.bread).toBe(NEEDS.feast.bread);
    expect(result.state.inventory.food.apple).toEqual([33]);
    const again = setDown(result.state);
    expect(again.message).toBe(`The table still wants roasted hazelnuts, honey and vegetables.`);
  });

  it('names what the table still wants in the prompt, whether it can be fed or not', () => {
    const fed = stocked();
    expect(castlePrompt(fed, spotOf(fed, 'table'))).toBe('Set down a loaf (the table still wants bread, roasted hazelnuts, honey, apples and vegetables)');
    const short = stocked({ bread: [], roastedHazelnuts: 0, honey: 0, apple: [], vegetables: 0 }, { feast: { ...NEEDS.feast, bread: 1, honey: 1 } });
    expect(castlePrompt(short, spotOf(short, 'table'))).toBe('Table · bring bread and honey');
  });

  it('is the survivor\'s choice at the table, by key and by tap, with the keep\'s door out of reach', () => {
    const state = stocked();
    expect(gap(state.player, KEEP_SITE)).toBeGreaterThan(BALANCE.interactionRadius);
    expect(nearestCastleSpot(state)?.site).toBe('table');
    expect(useKeyAction(state)).toEqual({ type: 'castleWork', site: 'table' });
    expect(promptFor(state).startsWith('E  Set down a loaf')).toBe(true);
    expect(targetAction(pickTapTarget(state, state.player.x, state.player.y))).toEqual({ type: 'castleWork', site: 'table' });
  });

  it('says which food is short, and spends nothing, when none that is wanted is in the bag', () => {
    const state = stocked({ bread: [], roastedHazelnuts: 0, honey: 0, apple: [33], vegetables: 5 }, { feast: { ...NEEDS.feast, bread: 0, honey: 0 } });
    expect(castleWorkBlocker(state, 'table')).toBe('The table still wants bread and honey.');
    const refused = setDown(state);
    expect(refused.message).toBe('The table still wants bread and honey.');
    expect(refused.state).toBe(state);
    expect(useKeyAction(state)?.type).not.toBe('castleWork');
  });

  it('names every food when the table has none yet and the bag is empty', () => {
    const bare = atTable(feastReady());
    expect(setDown(bare).message).toBe('The table still wants bread, roasted hazelnuts, honey, apples and vegetables.');
  });

  it('refuses a tired survivor with the usual line and spends nothing', () => {
    const state = stocked();
    const tired = { ...state, player: { ...state.player, energy: 0 } };
    expect(setDown(tired).message).toBe(TOO_TIRED_MESSAGE);
    expect(setDown(tired).state).toBe(tired);
  });

  it('refuses from afar, in the usual way', () => {
    const state = { ...stocked(), player: { ...stocked().player, x: 15, y: 12 } };
    expect(setDown(state).message).toBe('Move closer to the table.');
    expect(setDown(state).state).toBe(state);
  });

  it('keeps set-down food counted on the castle, safe from spoiling and not to be taken back', () => {
    let state = stocked({ bread: [30, 31, 32, 33], apple: [33] });
    for (let go = 0; go < 4; go++) state = setDown(state).state;
    expect(state.castle.feast.bread).toBe(4);
    expect(state.inventory.food.bread).toEqual([]);
    expect(spoil(state.inventory.food, state.day + 100, BALANCE.larderFreshDays).lost.bread).toBe(0);
    const later = { ...state, day: state.day + 100 };
    expect(later.castle.feast.bread).toBe(4);
    expect(applyAction(state, { type: 'takeFood', item: 'bread' }).state.castle.feast).toEqual(state.castle.feast);
    expect(applyAction(state, { type: 'eat', item: 'bread' }).state.castle.feast).toEqual(state.castle.feast);
  });

  it('plays dust where the survivor laid', () => {
    const state = stocked();
    expect(actionEffect({ type: 'castleWork', site: 'table' }, setDown(state).state)).toEqual({ kind: 'dust', x: state.player.x, y: state.player.y });
  });

  it('sits at the hall, clear of the keep door and every other site\'s reach', () => {
    const table = spotOf(feastReady(), 'table');
    expect(table.area).toBe('hills');
    expect(table.x).toBeGreaterThan(HALL_SPOT.x - 1);
    expect(table.x).toBeLessThan(HALL_SPOT.x + 3);
    expect(table.y).toBeGreaterThan(HALL_SPOT.y - 2);
    expect(table.y).toBeLessThan(HALL_SPOT.y + 2);
    expect(gap(table, KEEP_SITE)).toBeGreaterThan(BALANCE.interactionRadius * 2);
    expect(gap(table, OUTCROP_SITE)).toBeGreaterThan(BALANCE.interactionRadius * 2);
    expect(gap(table, HILLS_EXIT)).toBeGreaterThan(BALANCE.interactionRadius * 2);
  });
});

describe('the feast: prompt, key and tap agree around the table, the hall and the keep', () => {
  const sweepTable = (state: GameState): { table: number; keep: number } => {
    const count = { table: 0, keep: 0 };
    for (let x = 14; x <= 27; x += 0.25) for (let y = 4; y <= 14; y += 0.25) {
      const there = { ...state, player: { ...state.player, x, y } };
      const nearest = nearestCastleSpot(there);
      const where = `${x},${y}`;
      const reach = nearest !== null && gap(there.player, nearest) <= BALANCE.interactionRadius;
      if (gap(there.player, KEEP_SITE) <= BALANCE.interactionRadius) {
        expect(useKeyAction(there), where).toEqual({ type: 'enterKeep' });
        count.keep++;
        continue;
      }
      if (!reach) {
        expect(useKeyAction(there)?.type, where).not.toBe('castleWork');
        continue;
      }
      count.table++;
      expect(nearest.site, where).toBe('table');
      expect(targetAction(pickTapTarget(there, nearest.x, nearest.y)), where).toEqual({ type: 'castleWork', site: 'table' });
      expect(promptFor(there), where).toContain(castlePrompt(there, nearest));
      if (castleWorkBlocker(there, 'table') === null) expect(useKeyAction(there), where).toEqual({ type: 'castleWork', site: 'table' });
      else expect(useKeyAction(there)?.type, where).not.toBe('castleWork');
    }
    return count;
  };

  it('agrees with food in the bag, with none, and with a tired survivor, in summer and in winter', () => {
    for (const day of [34, 44]) {
      for (const food of [{ bread: [day - 1], honey: 1 }, {}]) {
        const count = sweepTable(feastReady({}, food, { day }));
        expect(count.table, `day ${day}`).toBeGreaterThan(0);
        expect(count.keep).toBeGreaterThan(0);
      }
      const tired = feastReady({}, { bread: [day - 1] }, { day });
      sweepTable({ ...tired, player: { ...tired.player, energy: 0 } });
    }
  }, 30000);

  it('lets the survivor reach the table from the hall\'s own doorstep', () => {
    const state = { ...feastReady({}, { bread: [33] }), player: { ...feastReady().player, x: HALL_SPOT.x, y: HALL_SPOT.y } };
    expect(nearestCastleSpot(state)?.site).toBe('table');
    expect(useKeyAction(state)).toEqual({ type: 'castleWork', site: 'table' });
  });
});

describe('the finish', () => {
  const almost = (): GameState => atTable(feastReady({ feast: { ...NEEDS.feast, vegetables: NEEDS.feast.vegetables - 1 } }, { vegetables: 2 }));

  it('sets finishedDay with the last dish, and says so plainly', () => {
    const before = almost();
    const result = setDown(before);
    expect(result.message).toBe('You set down the last dish. The castle is finished.');
    expect(result.state.castle.finishedDay).toBe(before.day);
    expect(result.state.castle.feast).toEqual(WHOLE_FEAST);
    expect(castleFinished(result.state)).toBe(true);
    expect(foodCount(result.state.inventory.food, 'vegetables')).toBe(1);
  });

  it('does not finish on any dish before the last', () => {
    let state = atTable(feastReady({}, { bread: [30, 31, 32, 33], roastedHazelnuts: 4, honey: 3, apple: [31, 32, 33], vegetables: 4 }));
    const total = Object.values(NEEDS.feast).reduce((sum, count) => sum + count, 0);
    for (let go = 1; go < total; go++) {
      state = setDown(state).state;
      expect(state.castle.finishedDay, `dish ${go}`).toBeNull();
    }
    const last = setDown(state);
    expect(last.state.castle.finishedDay).toBe(state.day);
    expect(last.message).toBe('You set down the last dish. The castle is finished.');
  });

  it('is a plain finished table afterwards, taking nothing', () => {
    const done = setDown(almost()).state;
    expect(castleWorkBlocker(done, 'table')).toBe('The castle is finished.');
    expect(setDown(done).state).toBe(done);
  });

  it('leaves a morning note once, the day after', () => {
    const done = setDown(almost()).state;
    const morning = { ...done, day: done.day + 1 };
    expect(castleNews(done, morning)).toEqual(['The castle stands finished. At night the hall windows glow.']);
    expect(castleNews(morning, { ...morning, day: morning.day + 1 })).toEqual([]);
    expect(castleNews(done, done)).toEqual([]);
    expect(newsBetween(done, morning)).toContain('The castle stands finished. At night the hall windows glow.');
    expect(castleNews(almost(), { ...almost(), day: almost().day + 1 })).toEqual([]);
  });

  it('writes nothing about anything after it, in any line it can show', () => {
    const lines = [
      ...Object.values(JOURNAL_PAGES).flat().filter(entry => entry.id.startsWith('castle')).flatMap(entry => entry.lines),
      setDown(almost()).message, 'The castle stands finished. At night the hall windows glow.', setDown(atTable(feastReady())).message
    ];
    for (const line of lines) {
      expect(line, line).not.toMatch(/town|palace|village|next|another|more to|begin again|beyond|ahead|new goal/i);
      expect(line, line).not.toContain('!');
    }
  });
});

describe('the hall at night once the castle is finished', () => {
  const NIGHT = 190;
  const finished = (changes: Partial<GameState> = {}): GameState => feastReady({ feast: WHOLE_FEAST, finishedDay: 34 }, {}, { timeOfDay: NIGHT, ...changes });
  const glow = (state: GameState) => sceneVisuals(state, 0).find(visual => visual.id === 'castle-hall-glow');

  it('is lit whether or not anyone is in, wherever on the hills the survivor stands', () => {
    expect(hallWindowGlow(finished())).not.toBeNull();
    expect(hallWindowGlow(finished({ player: { ...finished().player, x: 14, y: 14 } }))).not.toBeNull();
    expect(hallWindowGlow(finished({ player: { ...finished().player, x: 21, y: 9 } }))).not.toBeNull();
    expect(glow(finished())?.texture).toBe('castleHallGlow:lit');
    expect(glow(finished({ player: { ...finished().player, x: 30, y: 15 } }))?.texture).toBe('castleHallGlow:lit');
  });

  it('is dark by day, before the finish, in winter snow too, and away from the hills', () => {
    expect(hallWindowGlow(finished({ timeOfDay: 40 }))).toBeNull();
    expect(glow(finished({ timeOfDay: 40 }))).toBeUndefined();
    const unfinished = feastReady({ feast: { ...NEEDS.feast, vegetables: 0 } }, {}, { timeOfDay: NIGHT });
    expect(hallWindowGlow(unfinished)).toBeNull();
    expect(glow(unfinished)).toBeUndefined();
    expect(hallWindowGlow({ ...finished(), area: 'quarry' })).toBeNull();
    expect(glow({ ...finished(), area: 'camp' })).toBeUndefined();
    expect(glow(finished({ day: 44 }))?.texture).toBe('castleHallGlow:lit');
  });

  it('draws its light inside the hall\'s picture, over the window between the iron bars and the lantern by the door', () => {
    const def = castleSprites.castleHallGlow;
    expect(def.size).toEqual(castleSprites.castleHall.size);
    expect(def.anchor).toEqual(castleSprites.castleHall.anchor);
    expect(def.frames.lit.some(row => row.trim() !== '' && /[^.\s]/.test(row))).toBe(true);
    const lit = def.frames.lit.flatMap((row, y) => [...row].map((pixel, x) => ({ pixel, x, y }))).filter(({ pixel }) => pixel !== '.' && pixel !== ' ');
    expect(lit.length).toBeGreaterThan(0);
    const inLantern = ({ x, y }: { x: number; y: number }) => x >= HALL_LANTERN.x && x < HALL_LANTERN.x + HALL_LANTERN.w && y >= HALL_LANTERN.y && y < HALL_LANTERN.y + HALL_LANTERN.h;
    for (const { x, y } of lit.filter(pixel => !inLantern(pixel))) {
      expect(x).toBeGreaterThanOrEqual(36);
      expect(x).toBeLessThanOrEqual(41);
      expect(y).toBeGreaterThanOrEqual(34);
      expect(y).toBeLessThanOrEqual(43);
    }
    expect(HALL_WINDOW_OFFSET.x).toBeGreaterThan(0);
    expect(HALL_WINDOW_OFFSET.y).toBeLessThan(0);
  });
});

describe('the journal: each castle moment appears only once it happens', () => {
  const doneIds = (before: GameState, after: GameState, action?: GameAction): string[] =>
    recordJournal(before, after, action).state.journal.filter(entry => entry.id.startsWith('castle') && !entry.id.startsWith('castleLine')).map(entry => entry.id);
  const lineOf = (before: GameState, after: GameState, action?: GameAction): string | undefined => {
    const written = recordJournal(before, after, action).state.journal.find(entry => entry.id.startsWith('castle') && !entry.id.startsWith('castleLine'));
    return written && journalEntry(written.id)?.lines[written.variant];
  };
  const spring = { day: 22 };
  const lay = (state: GameState, site: string): GameState => doWork(standAt(state, site), site).state;

  it('writes the road\'s on the last road stone, and not on any before', () => {
    const before = standAt(built({ road: 29, doneDays: {} }, { ...spring, inventory: { ...game.inventory, stone: 2 } }), 'road');
    const after = lay(before, 'road');
    expect(after.castle.road).toBe(30);
    expect(doneIds(before, after, { type: 'castleWork', site: 'road' })).toEqual(['castleRoadSpring']);
    expect(lineOf(before, after, { type: 'castleWork', site: 'road' })).toBe('Laid the last stone of the road from the quarry to the keep.');
    const early = standAt(built({ road: 10, doneDays: {} }, { ...spring, inventory: { ...game.inventory, stone: 2 } }), 'road');
    expect(doneIds(early, lay(early, 'road'), { type: 'castleWork', site: 'road' })).toEqual([]);
  });

  it('writes the wall\'s when the fourth side is done, not the first', () => {
    const state = (west: number, east: number) => standAt(framesUp({ wall: { north: 30, south: 30, east, west } }, { ...spring, inventory: { ...game.inventory, stone: 3 } }), 'wall-west');
    const first = state(29, 29);
    expect(doneIds(first, lay(first, 'wall-west'), { type: 'castleWork', site: 'wall-west' })).toEqual([]);
    const last = state(29, 30);
    expect(doneIds(last, lay(last, 'wall-west'), { type: 'castleWork', site: 'wall-west' })).toEqual(['castleWallSpring']);
    expect(lineOf(last, lay(last, 'wall-west'), { type: 'castleWork', site: 'wall-west' })).toBe('The curtain wall is closed all the way round.');
  });

  it('writes the towers\' when the fourth is finished, not the first', () => {
    const almostTower = { ...FULL_TOWER, fittings: NEEDS.towerFittings - 1 };
    const goods = { beams: 0, fittings: 1, hangings: 0 };
    const state = (others: Tower) => standAt(wallsUp({ towers: { nw: others, ne: others, se: FULL_TOWER, sw: almostTower }, goods }, { ...spring }), 'tower-sw');
    const notYet = state({ ...FULL_TOWER, fittings: 0 });
    expect(doneIds(notYet, lay(notYet, 'tower-sw'), { type: 'castleWork', site: 'tower-sw' })).toEqual([]);
    const last = state(FULL_TOWER);
    expect(doneIds(last, lay(last, 'tower-sw'), { type: 'castleWork', site: 'tower-sw' })).toEqual(['castleTowersSpring']);
    expect(lineOf(last, lay(last, 'tower-sw'), { type: 'castleWork', site: 'tower-sw' })).toBe('All four towers have their roofs.');
  });

  it('writes the gatehouse\'s on its last stone', () => {
    const state = standAt(wallsUp({ gatehouse: 29 }, { ...spring, inventory: { ...game.inventory, stone: 2 }, progress: { ...wallsUp().progress, workshop: { ...wallsUp().progress.workshop, portcullis: true } } }), 'gatehouse');
    const mid = standAt(wallsUp({ gatehouse: 10 }, { ...spring, inventory: { ...game.inventory, stone: 2 }, progress: state.progress }), 'gatehouse');
    expect(doneIds(mid, lay(mid, 'gatehouse'), { type: 'castleWork', site: 'gatehouse' })).toEqual([]);
    expect(doneIds(state, lay(state, 'gatehouse'), { type: 'castleWork', site: 'gatehouse' })).toEqual(['castleGatehouseSpring']);
    expect(lineOf(state, lay(state, 'gatehouse'), { type: 'castleWork', site: 'gatehouse' })).toBe('The gatehouse is up, and the portcullis works.');
  });

  it('writes the moat full on the dawn the rain has filled it, never on the day it was dug', () => {
    const dug = feastReady({ moat: { stretches: NEEDS.moat, lastDugDay: 5, dugDay: 5 } }, {}, { day: 22 });
    const full = { ...dug, day: 31 };
    expect(moatFill(dug)).toBeLessThan(1);
    expect(moatFill(full)).toBe(1);
    expect(doneIds(dug, full)).toEqual(['castleMoatFullSummer']);
    expect(lineOf(dug, full)).toBe('Rain filled the moat. There is water all the way round.');
    expect(doneIds(dug, { ...dug, day: 25 })).toEqual([]);
    expect(doneIds(full, { ...full, day: 32 })).toEqual([]);
    const justDug = feastReady({ moat: { stretches: NEEDS.moat, lastDugDay: 5, dugDay: 5 } }, {}, { day: 5 });
    expect(doneIds({ ...justDug, castle: { ...justDug.castle, moat: { stretches: 15, lastDugDay: 4, dugDay: null } } }, justDug)).toEqual([]);
    const notDug = feastReady({ moat: { stretches: 3, lastDugDay: 20, dugDay: null } }, {}, { day: 30 });
    expect(doneIds(notDug, { ...notDug, day: 31 })).toEqual([]);
  });

  it('writes the feast\'s on the first dish and the finish\'s on the last, each once', () => {
    const first = atTable(feastReady({}, { bread: [33] }, spring));
    const laid = setDown(first).state;
    expect(doneIds(first, laid, { type: 'castleWork', site: 'table' })).toEqual(['castleFeastSpring']);
    expect(lineOf(first, laid, { type: 'castleWork', site: 'table' })).toBe('Set the first dish on the table in the great hall.');
    const second = setDown({ ...laid, inventory: { ...laid.inventory, food: { ...laid.inventory.food, bread: [33] } } }).state;
    expect(doneIds(laid, second, { type: 'castleWork', site: 'table' })).toEqual([]);
    const almost = atTable(feastReady({ feast: { ...NEEDS.feast, honey: 2 } }, { honey: 1 }, spring));
    const done = setDown(almost).state;
    expect(done.castle.finishedDay).toBe(22);
    expect(doneIds(almost, done, { type: 'castleWork', site: 'table' })).toEqual(['castleFinishedSpring']);
    expect(lineOf(almost, done, { type: 'castleWork', site: 'table' })).toBe('Set down the last dish. The castle is finished.');
    const [twice] = [recordJournal(almost, done, { type: 'castleWork', site: 'table' }).state];
    expect(recordJournal(almost, done, { type: 'castleWork', site: 'table' }).state.journal).toEqual(twice.journal);
  });

  it.each([[2, 'Autumn'], [12, 'Winter'], [22, 'Spring'], [32, 'Summer']])('writes each on its own season\'s page, day %i', (day, name) => {
    const state = atTable(feastReady({}, { bread: [day] }, { day }));
    expect(doneIds(state, setDown(state).state, { type: 'castleWork', site: 'table' })).toEqual([`castleFeast${name}`]);
  });

  it('never shows a blank for any of them before it happens, and a line once it is written', () => {
    for (const day of [2, 12, 22, 32]) {
      const page = Math.floor((day - 1) / 10);
      const ready = feastReady({}, {}, { day });
      const plain = { ...ready, castle: emptyCastle() };
      expect(journalPageView(ready, page).blanks, `day ${day}`).toBe(journalPageView(plain, page).blanks);
      expect(journalPageView(ready, page).entries).toHaveLength(journalPageView(plain, page).entries.length);
    }
    const state = atTable(feastReady({}, { bread: [22] }, spring));
    const written = recordJournal(state, setDown(state).state, { type: 'castleWork', site: 'table' }).state;
    const view = journalPageView(written, 2);
    expect(view.entries.map(entry => entry.line)).toContain('Set the first dish on the table in the great hall.');
    expect(view.blanks).toBe(journalPageView({ ...written, castle: emptyCastle(), journal: written.journal.filter(entry => !entry.id.startsWith('castle')) }, 2).blanks);
  });

  it('gives every one a picture and a line, with no mention of anything after the castle', () => {
    const ids = Object.values(JOURNAL_PAGES).flat().map(entry => entry.id).filter(id => /^castle(Road|Wall|Towers|Gatehouse|MoatFull|Feast|Finished)/.test(id));
    expect(ids).toHaveLength(28);
    for (const id of ids) {
      expect(JOURNAL_ICONS[id], id).toBeDefined();
      expect(journalEntry(id)?.lines[0], id).toBeTruthy();
    }
  });
});

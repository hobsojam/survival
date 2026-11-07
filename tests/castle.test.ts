import { describe, expect, it } from 'vitest';
import type { Season } from '../src/game/calendar';
import { NEEDS, WALLS, emptyCastle, isRevealed, treeUnderWall, type Tower } from '../src/game/castle';
import { castleSprites } from '../src/art/castleSprites';
import { castleView } from '../src/scene/keepViewCamp';
import { CART_SPOTS, cartFollows, cartRoom, castleNews, castlePrompt, castleSpots, castleWorkBlocker, castleWorkLine, nearestCastleSpot, siteNeed, spendCastleStone } from '../src/game/castleSites';
import { availableStone, availableWood } from '../src/game/camp';
import { pickTapTarget, targetAction } from '../src/scene/tapTarget';
import { HILLS_EXIT, OUTCROP_SITE, QUARRY_HILLS_EXIT } from '../src/game/hills';
import { QUARRY_SITE, RUBBLE_SITE } from '../src/game/areas';
import { TOO_TIRED_MESSAGE, workSeconds } from '../src/game/needs';
import { newsBetween } from '../src/game/news';
import { upgradeBlocker } from '../src/game/workshop';
import { GOODS, goodBlocker, goodRoom } from '../src/game/castleSites';
import { recordJournal } from '../src/game/journalEntries';
import { KEEP_SITE, KEEP_STONES } from '../src/game/keep';
import { FULL_BAG_MESSAGE, applyAction } from '../src/game/rules';
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
    const state = cartAt(withCart(2, { inventory: { ...game.inventory, stone: 3 } }), 'hills');
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

  it('cannot yet make hangings', () => {
    expect(goodBlocker(atCamp(), 'hangings')).not.toBeNull();
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
    expect(castleSpots(open).map(spot => spot.site)).toEqual(SIDE_LIST.map(side => `wall-${side}`));
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
    expect(castleWorkBlocker(state, 'wall-north')).toBe('Bring stone to build the wall.');
    expect(promptFor(state)).toBe('Wall · bring stone to build it · Cart 0/40');
    const stocked = { ...state, inventory: { ...state.inventory, stone: 1 } };
    expect(castleWorkBlocker({ ...stocked, player: { ...stocked.player, x: 30, y: 12 } }, 'wall-north')).toBe('Move closer to the wall.');
    expect(castleWorkBlocker({ ...stocked, player: { ...stocked.player, energy: 0 } }, 'wall-north')).toBe(TOO_TIRED_MESSAGE);
    expect(promptFor(stocked)).toBe('E  Lay a wall stone, north side (0/30) · Cart 0/40');
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
    expect(castleSpots(wallsUp()).map(spot => spot.site)).toEqual([...TOWER_LIST.map(id => `tower-${id}`), 'gatehouse']);
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
    const roomBefore = [goodRoom(state.castle, 'beams'), goodRoom(state.castle, 'fittings')];
    const beamed = doWork(state, 'tower-ne').state;
    expect([goodRoom(beamed.castle, 'beams'), goodRoom(beamed.castle, 'fittings')]).toEqual(roomBefore);
    const done = { ...state, castle: { ...state.castle, towers: { ...state.castle.towers, ne: { stones: 20, beams: 4, fittings: 0 } } } };
    const fitted = doWork(done, 'tower-ne').state;
    expect(fitted.castle.towers.ne.fittings).toBe(1);
    expect(fitted.castle.goods.fittings).toBe(2);
    expect([goodRoom(fitted.castle, 'beams'), goodRoom(fitted.castle, 'fittings')]).toEqual([goodRoom(done.castle, 'beams'), goodRoom(done.castle, 'fittings')]);
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
      for (const other of OTHERS) expect(Math.hypot(spot.x - other.x, spot.y - other.y), `${spot.site} from ${other.x},${other.y}`).toBeGreaterThan(BALANCE.interactionRadius * 2);
    }
  });

  it('keeps each side and each corner out of reach of the others, so E takes the one the prompt names', () => {
    const spots = [...castleSpots(framesUp()), ...castleSpots(wallsUp()).filter(spot => spot.site !== 'gatehouse')];
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
    expect(castleView(revealed())).toEqual({ line: true, walls: 0, towers: 0, gatehouse: false });
    expect(castleView(framesUp({ wall: { north: 30, east: 29, south: 30, west: 0 } }))).toEqual({ line: true, walls: 2, towers: 0, gatehouse: false });
    expect(castleView(wallsUp({ towers: { ...emptyCastle().towers, nw: FULL_TOWER, se: { ...FULL_TOWER, fittings: 1 } } }))).toEqual({ line: true, walls: 4, towers: 1, gatehouse: false });
    expect(castleView(finishedKeep())).toEqual({ line: false, walls: 0, towers: 0, gatehouse: false });
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

  it('stands on the east wall where the hills path crosses it', () => {
    expect(gate()).toMatchObject({ area: 'hills', x: 24, y: 12 });
    expect(gate().x).toBe(WALLS.right);
  });

  it('keeps clear of the keep, the outcrop, the exit and the cart, and never hides the east wall spot', () => {
    for (const other of [KEEP_SITE, OUTCROP_SITE, HILLS_EXIT, CART_SPOTS.hills]) expect(near(gate(), other)).toBeGreaterThan(BALANCE.interactionRadius * 2);
    expect(siteNeed(gateOpen(), 'wall-east')).toBeNull();
  });

  it('is reachable from the path, outside the wall, and from the yard inside it', () => {
    const state = gateOpen();
    for (const [x, y] of [[25.5, 12.5], [22.5, 12]]) {
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
    for (let x = 21; x <= 26; x += 0.25) for (let y = 11; y <= 15; y += 0.25) both.push([x, y]);
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
      expect(promptFor(there), `${x},${y}`).toMatch(new RegExp(`^E  ${castlePrompt(there, nearest).replace(/[()/]/g, '\\$&')}`));
      expect(targetAction(pickTapTarget(there, nearest.x, nearest.y)), `${x},${y}`).toEqual({ type: 'castleWork', site: nearest.site });
    }
    expect(sites).toEqual(new Set(['gatehouse', 'tower-se']));
    const straddle = { ...state, player: { ...state.player, x: 23.4, y: 12.9 } };
    expect(near(straddle.player, spotOf(state, 'gatehouse'))).toBeLessThanOrEqual(BALANCE.interactionRadius);
    expect(near(straddle.player, spotOf(state, 'tower-se'))).toBeLessThanOrEqual(BALANCE.interactionRadius);
  });

  it('is tapped at its own place and not the tower\'s', () => {
    const state = gateOpen();
    expect(targetAction(pickTapTarget(state, 24, 12))).toEqual({ type: 'castleWork', site: 'gatehouse' });
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
    expect(actionEffect({ type: 'castleWork', site: 'gatehouse' }, after)).toEqual({ kind: 'portcullis', x: 24, y: 12 });
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

  it('stands in the place of the wall stretch at the gate, once begun', () => {
    const ids = (laid: number) => sceneVisuals(gateOpen({ gatehouse: laid }), 0).map(visual => visual.id);
    expect(ids(0)).toContain('castle-wall-east-6');
    expect(ids(1)).not.toContain('castle-wall-east-6');
    expect(ids(1)).toContain('castle-wall-east-5');
    expect(ids(1)).toContain('castle-wall-east-7');
  });

  it('sorts the survivor against the gatehouse in front and behind', () => {
    const state = gateOpen({ gatehouse: 30 });
    const { depth } = gateVisual(state)!;
    expect(playerVisualDepth({ ...state, player: { ...state.player, x: 24, y: 11 } })).toBeLessThan(depth);
    expect(playerVisualDepth({ ...state, player: { ...state.player, x: 24, y: 13 } })).toBeGreaterThan(depth);
  });

  it('works whatever season it is', () => {
    for (const day of [2, 12, 22, 32]) {
      const state = standAt(gateOpen({ gatehouse: 29 }, { day }), 'gatehouse');
      expect(doWork(state, 'gatehouse').state.castle.gatehouse).toBe(30);
    }
  });
});

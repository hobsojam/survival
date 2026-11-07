import { describe, expect, it } from 'vitest';
import type { Season } from '../src/game/calendar';
import { NEEDS, WALLS, emptyCastle, isRevealed, treeUnderWall } from '../src/game/castle';
import { CART_SPOTS, cartFollows, cartRoom, castleNews, castlePrompt, castleSpots, castleWorkBlocker, castleWorkLine, nearestCastleSpot, siteNeed, spendCastleStone } from '../src/game/castleSites';
import { availableStone } from '../src/game/camp';
import { pickTapTarget, targetAction } from '../src/scene/tapTarget';
import { HILLS_EXIT, QUARRY_HILLS_EXIT } from '../src/game/hills';
import { QUARRY_SITE, RUBBLE_SITE } from '../src/game/areas';
import { TOO_TIRED_MESSAGE, workSeconds } from '../src/game/needs';
import { newsBetween } from '../src/game/news';
import { upgradeBlocker } from '../src/game/workshop';
import { recordJournal } from '../src/game/journalEntries';
import { KEEP_SITE, KEEP_STONES } from '../src/game/keep';
import { FULL_BAG_MESSAGE, applyAction } from '../src/game/rules';
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

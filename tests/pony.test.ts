import { describe, expect, it } from 'vitest';
import { nightStart } from '../src/game/calendar';
import { CLEARING_STEPS, STEP_IDS, placeBranches } from '../src/game/clearing';
import { addFood } from '../src/game/food';
import { HILLS_EXIT, QUARRY_HILLS_EXIT } from '../src/game/hills';
import { OFFER_RANGE, PONY_SPOTS, SPOOK_RADIUS, emptyPony, ponyWith, wildPonyAt, type PonyState } from '../src/game/pony';
import { FULL_BAG_MESSAGE, advanceTime, applyAction, bagCapacity, freeSpaces } from '../src/game/rules';
import { saveGame } from '../src/game/save';
import { BALANCE, createGame, type AreaId, type GameState } from '../src/game/state';
import { anyNamed, nameBlocker, nameOf, named, namedNote, newlyWon } from '../src/game/names';
import { sprites } from '../src/art/sprites';
import { unnamedAnimalAt } from '../src/scene/animalTap';
import { hillRockAt } from '../src/scene/hillsGeometry';
import { HILLS_PATHS, pathDistance } from '../src/scene/mapGeometry';
import { PONY_HOME, ponyPoseFor } from '../src/scene/ponyPose';
import { useKeyAction, promptFor } from '../src/scene/prompts';
import { WALK_SPEED, hasArrived, pickTapTarget, targetAction } from '../src/scene/tapTarget';
import { CAMP_STRUCTURES } from '../src/scene/visuals';
import { bagView } from '../src/ui/panels';

const game = createGame();
const placed = placeBranches(game.nodes, [...STEP_IDS]);
const AUTUMN = 2;
const WINTER = 12;
const SPRING = 22;
const SUMMER = 32;
const saves = (state: GameState): boolean => {
  const items = new Map<string, string>();
  return saveGame({ getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) } as unknown as Storage, state).ok;
};
function base(changes: Partial<GameState> = {}): GameState {
  return {
    ...game,
    day: AUTUMN,
    nodes: game.nodes.map((node, i) => ({ ...node, x: placed[i].x, y: placed[i].y })),
    clearing: { cleared: [...STEP_IDS], marked: null, felled: [] },
    structures: { ...game.structures, shelter: true, toolshed: true, workshop: true },
    progress: { ...game.progress, nextStormDay: null, hearthUnlocked: true, quarryFound: true, hillsFound: true },
    ...changes
  };
}
const standing = (state: GameState, area: AreaId, x: number, y: number): GameState => ({ ...state, area, player: { ...state.player, x, y } });
const ponyAt = PONY_SPOTS[0];
/** On the hills, in offering range of the wild pony and out of its startling distance. */
const nearPony = (changes: Partial<GameState> = {}, pony: Partial<PonyState> = {}): GameState =>
  standing(base({ pony: { ...emptyPony(), ...pony }, ...changes }), 'hills', ponyAt.x + 2, ponyAt.y);
const apples = (state: GameState, count = 1): GameState => ({ ...state, inventory: { ...state.inventory, food: addFood(state.inventory.food, 'apple', count, state.day) } });
const vegetables = (state: GameState, count = 1): GameState => ({ ...state, inventory: { ...state.inventory, food: addFood(state.inventory.food, 'vegetables', count, state.day) } });
const offer = (state: GameState) => applyAction(state, { type: 'offerPony' });
const WON = { ...emptyPony(), trust: BALANCE.ponyTrustTarget, won: 1 };
const HOME = { ...WON, home: true };
const SHOD = { ...HOME, shod: 1 };
const shodProgress = (state: GameState): GameState['progress'] => ({ ...state.progress, oreFoundDay: 1, workshop: { ...state.progress.workshop, forge: true, horseshoes: true } });
const shod = (area: AreaId, day: number, changes: Partial<GameState> = {}): GameState => {
  const start = base({ day, pony: SHOD, ...changes });
  return standing({ ...start, progress: shodProgress(start) }, area, 20, 20);
};

describe('the wild pony', () => {
  it('is there every day, and away at night', () => {
    for (const day of [1, 5, 12, 22, 33]) expect(wildPonyAt(nearPony({ day }))).toEqual(ponyAt);
    expect(wildPonyAt(nearPony({ day: 5, timeOfDay: nightStart(5) }))).toBeNull();
    expect(wildPonyAt(nearPony({}, WON))).toBeNull();
  });

  it('ambles to its next spot when you come too close, keeping the day open', () => {
    const start = apples(standing(base({ timeOfDay: 10 }), 'hills', ponyAt.x + 1.6, ponyAt.y));
    const moved = applyAction(start, { type: 'move', dx: -0.5, dy: 0 }).state;
    expect(moved.pony.spot).toBe(1);
    expect(moved.pony.lastOffer).toBeNull();
    const there = PONY_SPOTS[1];
    expect(offer(standing(moved, 'hills', there.x + 2, there.y)).state.pony.trust).toBe(1);
  });

  it('startles as time passes too, if it is reached while the survivor stands still', () => {
    const start = standing(base({ timeOfDay: 10 }), 'hills', ponyAt.x + 1, ponyAt.y);
    expect(advanceTime(start, 2).pony.spot).toBe(1);
  });

  it('never ambles to a spot within the startling distance', () => {
    for (const spot of PONY_SPOTS.keys()) for (const here of PONY_SPOTS) {
      const start = standing(base({ pony: { ...emptyPony(), spot } }), 'hills', here.x, here.y);
      const after = advanceTime(start, 1).pony.spot;
      expect(Math.hypot(PONY_SPOTS[after].x - here.x, PONY_SPOTS[after].y - here.y)).toBeGreaterThan(SPOOK_RADIUS);
    }
  });

  it('has room to stand between startling it and being out of reach', () => {
    expect(OFFER_RANGE).toBeGreaterThan(SPOOK_RADIUS);
    for (const [i, a] of PONY_SPOTS.entries()) for (const b of PONY_SPOTS.slice(i + 1)) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(OFFER_RANGE);
  });

  it('takes an apple first, then vegetables', () => {
    const { state, message } = offer(vegetables(apples(nearPony())));
    expect(message).toBe('The pony takes the apple, and lets you stand a little nearer.');
    expect(state.inventory.food.apple).toEqual([]);
    expect(state.inventory.food.vegetables).toBe(1);
    expect(state.pony.trust).toBe(1);
    expect(state.pony.lastOffer).toBe(state.day);
    expect(state.timeOfDay).toBeGreaterThan(nearPony().timeOfDay);
  });

  it('takes vegetables in any season when there are no apples', () => {
    for (const day of [AUTUMN, WINTER, SPRING, SUMMER]) {
      const { state, message } = offer(vegetables(nearPony({ day })));
      expect(message).toBe('The pony takes the vegetables, and lets you stand a little nearer.');
      expect(state.inventory.food.vegetables).toBe(0);
    }
  });

  it('takes one offer a day', () => {
    const once = offer(apples(nearPony(), 2)).state;
    const twice = offer(once);
    expect(twice.message).toBe('You have already offered the pony something today.');
    expect(twice.state.inventory.food.apple).toHaveLength(1);
  });

  it('wants you in range', () => {
    const far = standing(apples(nearPony()), 'hills', ponyAt.x + 4, ponyAt.y);
    expect(offer(far).message).toBe('Walk a little closer to the pony.');
  });

  it('wants you on the hills', () => {
    expect(offer(standing(apples(nearPony()), 'quarry', ponyAt.x + 2, ponyAt.y)).message).toBe('The pony is up on the hills.');
  });

  it('says what it would like', () => {
    expect(offer(nearPony()).message).toBe('The pony would take an apple or vegetables.');
  });

  it('is away at night', () => {
    expect(offer(apples(nearPony({ day: 2, timeOfDay: nightStart(2) + 1 }))).message).toBe('The pony has gone off for the night.');
  });

  it('is won over on the fourth offer, and the offers can be saved', () => {
    let state = apples(nearPony({}), 4);
    let message = '';
    for (let day = 2; day < 6; day++) {
      ({ state, message } = offer({ ...state, day }));
      if (day < 5) { expect(state.pony.won).toBeNull(); expect(saves(state)).toBe(true); }
    }
    expect(state.pony.trust).toBe(4);
    expect(state.pony.won).toBe(5);
    expect(state.pony.home).toBe(false);
    expect(message).toBe('The pony pushes its nose into your hand. It follows when you walk on.');
    expect(saves(state)).toBe(true);
  });

  it('refuses another offer once won', () => {
    expect(offer(apples(standing(base({ pony: HOME }), 'hills', ponyAt.x + 2, ponyAt.y))).message).toBe('The pony is yours already.');
  });

  it('gives no gifts or keepsakes', () => {
    let state = standing(base({ pony: SHOD }), 'camp', BALANCE.campX + 1, BALANCE.campY);
    state = { ...state, progress: shodProgress(state) };
    const before = state.companion;
    const food = state.inventory.food;
    for (let i = 0; i < 12; i++) state = advanceTime(state, BALANCE.daySeconds, 'resting');
    expect(state.companion.lastGiftByFriend).toEqual(before.lastGiftByFriend);
    expect(state.companion.friends).toEqual(before.friends);
    expect(state.inventory.food.berry).toEqual(food.berry);
  });

  it('is offered by E and named in the prompt', () => {
    const state = apples(nearPony());
    expect(useKeyAction(state)).toEqual({ type: 'offerPony' });
    expect(promptFor(state)).toContain('Offer the pony an apple');
    expect(promptFor(vegetables(nearPony()))).toContain('Offer the pony vegetables');
    expect(useKeyAction(nearPony())).toBeUndefined();
    expect(useKeyAction(offer(apples(nearPony())).state)).toBeUndefined();
  });
});

it('grazes on grass, off the rock and the path', () => {
  for (const spot of PONY_SPOTS) {
    expect(hillRockAt(spot.x, spot.y)).toBe(false);
    expect(pathDistance(spot.x, spot.y, HILLS_PATHS)).toBeGreaterThan(1);
  }
});

describe('after it is won', () => {
  const quarryEnd = standing(base({ pony: WON }), 'quarry', 38.9, 15);
  const leavingCamp = (pony: PonyState) => standing(base({ pony }), 'camp', 0.2, 15);

  it('reaches home by walking', () => {
    expect(applyAction(quarryEnd, { type: 'move', dx: 1, dy: 0 }).state.pony.home).toBe(true);
  });

  it('reaches home by crossing', () => {
    expect(applyAction(standing(base({ pony: WON }), 'quarry', 39, 15), { type: 'cross' }).state.pony.home).toBe(true);
  });

  it('is not home yet from the hills down to the quarry', () => {
    const down = applyAction(standing(base({ pony: WON }), 'hills', HILLS_EXIT.x, HILLS_EXIT.y), { type: 'cross' }).state;
    expect(down.pony.home).toBe(false);
  });

  it('stays at camp while unshod, and says why once, by walking', () => {
    const first = applyAction(leavingCamp(HOME), { type: 'move', dx: -1, dy: 0 });
    expect(first.state.area).toBe('quarry');
    expect(first.message).toBe("The pony stops at the edge of camp. Its hooves can't take the stony path yet.");
    expect(first.state.pony.toldHooves).toBe(true);
    expect(applyAction(leavingCamp({ ...HOME, toldHooves: true }), { type: 'move', dx: -1, dy: 0 }).message).toBe('');
  });

  it('says why by crossing too, on the way to the homestead as well', () => {
    const west = applyAction(standing(base({ pony: HOME }), 'camp', 0, 15), { type: 'cross' });
    expect(west.message).toContain('The pony stops at the edge of camp.');
    const east = applyAction(standing(base({ pony: HOME, progress: { ...base().progress, homesteadFound: true } }), 'camp', 39, 15), { type: 'cross' });
    expect(east.message).toContain('The pony stops at the edge of camp.');
  });

  it('says nothing once shod', () => {
    const start = shod('camp', AUTUMN);
    expect(applyAction(standing(start, 'camp', 0.2, 15), { type: 'move', dx: -1, dy: 0 }).message).toBe('');
  });

  it('adds no spaces while unshod', () => {
    expect(bagCapacity(standing(base({ pony: HOME }), 'camp', 20, 20))).toBe(BALANCE.baseCapacity);
    expect(ponyWith(standing(base({ pony: WON }), 'hills', 20, 10))).toBe(false);
  });
});

describe('a shod pony', () => {
  it.each<AreaId>(['camp', 'quarry', 'homestead', 'hills'])('adds eight spaces by day at the %s', area => {
    expect(bagCapacity(shod(area, AUTUMN))).toBe(BALANCE.baseCapacity + BALANCE.ponySpaces);
  });

  it('adds them on the hills in autumn, spring and summer, but not in winter', () => {
    for (const day of [AUTUMN, SPRING, SUMMER]) expect(ponyWith(shod('hills', day))).toBe(true);
    expect(ponyWith(shod('hills', WINTER))).toBe(false);
    expect(ponyWith(shod('quarry', WINTER))).toBe(true);
    expect(ponyWith(shod('camp', WINTER))).toBe(true);
  });

  it('says it will wait when you go up in the snow, by walking and by crossing', () => {
    const line = "The pony won't go up in the snow. It waits at the foot of the path.";
    expect(applyAction(standing(shod('quarry', WINTER), 'quarry', 0.2, 15), { type: 'move', dx: -1, dy: 0 }).message).toBe(line);
    expect(applyAction(standing(shod('quarry', WINTER), 'quarry', QUARRY_HILLS_EXIT.x, QUARRY_HILLS_EXIT.y), { type: 'cross' }).message).toBe(line);
    expect(applyAction(standing(shod('quarry', SPRING), 'quarry', 0.2, 15), { type: 'move', dx: -1, dy: 0 }).message).toBe('');
  });

  it('adds none away from camp at night, and is back next morning', () => {
    const dark = { timeOfDay: nightStart(AUTUMN) + 1 };
    expect(ponyWith(shod('quarry', AUTUMN, dark))).toBe(false);
    expect(ponyWith(shod('camp', AUTUMN, dark))).toBe(true);
    expect(ponyWith(shod('quarry', AUTUMN + 1, { timeOfDay: 5 }))).toBe(true);
  });

  /** A loaded walk that ended up on the snowy hills, with fourteen spaces full. */
  const overfull = (): GameState => shod('hills', WINTER, { inventory: { ...game.inventory, wood: 14 } });

  it('loses nothing if the bag is over its limit, and refuses more', () => {
    const state = overfull();
    expect(freeSpaces(state)).toBeLessThan(0);
    const after = advanceTime(state, 30);
    expect(after.inventory.wood).toBe(14);
    const near = { ...state, stonePiles: [{ id: 'p', x: 20, y: 20, count: 1, area: 'hills' as const, item: 'stone' as const }] };
    const picked = applyAction(near, { type: 'pickUpStone', pileId: 'p' });
    expect(picked.message).toBe(FULL_BAG_MESSAGE);
    expect(picked.state.inventory.stone).toBe(0);
  });

  it('leaves such a game able to save', () => {
    expect(saves(overfull())).toBe(true);
  });

  it('still refuses a bag too full for any pony', () => {
    expect(saves(shod('camp', AUTUMN, { inventory: { ...game.inventory, wood: 17 } }))).toBe(false);
    expect(saves(base({ inventory: { ...game.inventory, wood: 9 } }))).toBe(false);
  });

  it('adds to the woven pack', () => {
    const state = shod('camp', AUTUMN);
    expect(bagCapacity({ ...state, progress: { ...state.progress, packWoven: true } })).toBe(BALANCE.packCapacity + BALANCE.ponySpaces);
  });

  it('shows in the bag label', () => {
    expect(bagView(shod('camp', AUTUMN)).spacesLabel).toBe('Carried · the pony');
    const state = shod('camp', AUTUMN);
    expect(bagView({ ...state, progress: { ...state.progress, packWoven: true } }).spacesLabel).toBe('Carried · woven pack · the pony');
    expect(bagView(shod('hills', WINTER)).spacesLabel).toBe('Carried');
  });
});

describe('where the pony is drawn', () => {
  const pose = (state: GameState, moving = false, timeMs = 0) => ponyPoseFor(state, timeMs, 1, moving);

  it('grazes on the hills while wild', () => {
    const drawn = pose(nearPony())!;
    expect([drawn.x, drawn.y]).toEqual([ponyAt.x, ponyAt.y]);
    expect(drawn.frame).toMatch(/^pony:graze/);
    expect(sprites.pony.frames[drawn.frame.split(':')[1]]).toBeDefined();
    expect(pose(nearPony({ day: 2, timeOfDay: nightStart(2) + 1 }))).toBeNull();
    expect(pose(standing(base(), 'quarry', 5, 5))).toBeNull();
  });

  it('trails the survivor on the way home after it is won', () => {
    for (const area of ['hills', 'quarry'] as const) {
      const drawn = pose(standing(base({ pony: WON }), area, 20, 12), true)!;
      expect(Math.hypot(drawn.x - 20, drawn.y - 12)).toBeLessThan(2);
      expect(drawn.frame).toMatch(/^pony:walk/);
    }
  });

  it('grazes at home while unshod, and is not drawn elsewhere', () => {
    const drawn = pose(standing(base({ pony: HOME }), 'camp', 5, 5))!;
    expect([drawn.x, drawn.y]).toEqual([PONY_HOME.x, PONY_HOME.y]);
    expect(pose(standing(base({ pony: HOME }), 'quarry', 5, 5))).toBeNull();
    expect(pose(standing(base({ pony: HOME }), 'hills', 5, 5))).toBeNull();
  });

  it('wears its packs once shod', () => {
    expect(pose(shod('camp', AUTUMN), true)!.frame).toMatch(/^pony:loadWalk/);
    expect(pose(shod('camp', AUTUMN))!.frame).toBe('pony:loadStand');
    for (const frame of ['loadStand', 'loadWalk0', 'loadWalk1', 'stand', 'walk0', 'walk1', 'graze0', 'graze1']) expect(sprites.pony.frames[frame], frame).toBeDefined();
  });

  it('walks beside a shod survivor by day in any area', () => {
    for (const area of ['camp', 'quarry', 'homestead', 'hills'] as const) {
      const drawn = pose(shod(area, AUTUMN))!;
      expect(Math.hypot(drawn.x - 20, drawn.y - 20)).toBeLessThan(2);
    }
  });

  it('stays off the hills in winter', () => {
    expect(pose(shod('hills', WINTER))).toBeNull();
    expect(pose(shod('quarry', WINTER))).not.toBeNull();
  });

  it('is at home at night, and not drawn away from camp', () => {
    const dark = { timeOfDay: nightStart(AUTUMN) + 1 };
    const drawn = pose(shod('camp', AUTUMN, dark))!;
    expect([drawn.x, drawn.y]).toEqual([PONY_HOME.x, PONY_HOME.y]);
    expect(pose(shod('quarry', AUTUMN, dark))).toBeNull();
  });

  it('has a home spot clear of every building and tree', () => {
    const clear = (x: number, y: number) => Math.hypot(x - PONY_HOME.x, y - PONY_HOME.y);
    for (const [id, dx, dy] of CAMP_STRUCTURES) expect(clear(BALANCE.campX + dx, BALANCE.campY + dy), id).toBeGreaterThanOrEqual(2);
    for (const tree of [...game.trees, ...STEP_IDS.flatMap(id => CLEARING_STEPS[id].trees)]) expect(clear(tree.x, tree.y)).toBeGreaterThanOrEqual(1.5);
    for (const node of placed) expect(clear(node.x, node.y)).toBeGreaterThanOrEqual(1.5);
  });
});

describe('tapping the wild pony', () => {
  it('points at the pony, not the ground', () => {
    const target = pickTapTarget(nearPony(), ponyAt.x, ponyAt.y);
    expect(target.kind).toBe('pony');
    expect(targetAction(target)).toEqual({ type: 'offerPony' });
    expect(pickTapTarget(standing(base({ pony: HOME }), 'hills', 30, 25), ponyAt.x, ponyAt.y).kind).toBe('ground');
  });

  /** Follows a tap the way the scene does: a step at walking pace until arrived, running the rules on each step. */
  function walkTo(start: GameState, x: number, y: number): GameState {
    let state = start;
    const target = pickTapTarget(state, x, y);
    for (let i = 0; i < 400 && !hasArrived(state, target); i++) {
      const away = Math.hypot(target.x - state.player.x, target.y - state.player.y);
      const step = Math.min(WALK_SPEED / 60, away);
      state = applyAction(state, { type: 'move', dx: (target.x - state.player.x) / away * step, dy: (target.y - state.player.y) / away * step }).state;
    }
    return state;
  }

  it.each([[0, 0], [8, 3], [-6, 5], [3, -8], [10, 10]])('walks into offering range and stops without startling it, from %i, %i', (dx, dy) => {
    const start = apples(standing(base({ timeOfDay: 10 }), 'hills', ponyAt.x + 4 + dx, ponyAt.y + 1 + dy));
    const state = walkTo(start, ponyAt.x, ponyAt.y);
    expect(state.pony.spot).toBe(0);
    const away = Math.hypot(state.player.x - ponyAt.x, state.player.y - ponyAt.y);
    expect(away).toBeLessThanOrEqual(OFFER_RANGE);
    expect(away).toBeGreaterThan(SPOOK_RADIUS);
    expect(offer(state).state.pony.trust).toBe(1);
  });

  it('still works after it has ambled to a new spot', () => {
    const start = apples(standing(base({ timeOfDay: 10, pony: { ...emptyPony(), spot: 2 } }), 'hills', 30, 25));
    const there = PONY_SPOTS[2];
    const state = walkTo(start, there.x, there.y);
    expect(state.pony.spot).toBe(2);
    expect(offer(state).state.pony.trust).toBe(1);
  });
});

describe('naming the pony', () => {
  const home = (changes: Partial<GameState> = {}) => standing(base({ pony: HOME, timeOfDay: 10, ...changes }), 'camp', 5, 5);
  const middle = (state: GameState) => {
    const drawn = ponyPoseFor(state, 0, 1, false)!;
    return { x: drawn.x, y: drawn.y - 0.4, scene: { friends: [], stillSeconds: 5, replaying: false, pony: drawn } };
  };

  it('asks when it is won over', () => {
    const before = apples(nearPony({}, { trust: 3 }));
    const after = offer(before).state;
    expect(newlyWon(before, after)).toBe(true);
    expect(newlyWon(after, offer(after).state)).toBe(false);
    expect(nameBlocker(after, { kind: 'pony' }, 'Bramble')).toBeNull();
    expect(nameBlocker(before, { kind: 'pony' }, 'Bramble')).toBe("That animal isn't here.");
  });

  it('asks when an unnamed pony is tapped at camp', () => {
    const state = home();
    const { x, y, scene } = middle(state);
    expect(unnamedAnimalAt(state, 0, x, y, scene)).toEqual({ kind: 'pony' });
  });

  it('does not ask about a walking one, or a named one', () => {
    const state = home();
    const { x, y, scene } = middle(state);
    expect(unnamedAnimalAt(state, 0, x, y, { ...scene, stillSeconds: 0 })).toBeNull();
    const called = named(state, { kind: 'pony' }, 'Bramble');
    expect(unnamedAnimalAt(called, 0, x, y, scene)).toBeNull();
  });

  it('keeps its name, and uses it in morning notes', () => {
    const called = named(home(), { kind: 'pony' }, 'Bramble');
    expect(nameOf(called, { kind: 'pony' })).toBe('Bramble');
    expect(anyNamed(called)).toBe(true);
    expect(nameBlocker(called, { kind: 'pony' }, 'Other')).toBe('Bramble already has a name.');
    const notes = Array.from({ length: 400 }, (_, day) => namedNote(called, day + 1)).filter(Boolean);
    expect(notes.length).toBeGreaterThan(0);
    for (const note of notes) expect(note).toContain('Bramble');
  });

  it('saves the name only once it is won', () => {
    expect(saves(named(home(), { kind: 'pony' }, 'Bramble'))).toBe(true);
    const start = home();
    expect(saves({ ...start, names: { ...start.names, pony: 'x'.repeat(40) } })).toBe(false);
    expect(saves({ ...start, pony: emptyPony(), names: { ...start.names, pony: 'Bramble' } })).toBe(false);
  });
});

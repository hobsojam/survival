import { describe, expect, it } from 'vitest';
import { hillsPathOpen, QUARRY_EXIT } from '../src/game/areas';
import { STEP_IDS, placeBranches } from '../src/game/clearing';
import { HILLS_EXIT, OUTCROP_SITE, QUARRY_HILLS_EXIT, availableOre, spendOre } from '../src/game/hills';
import { emptyPony, type PonyState } from '../src/game/pony';
import { FULL_BAG_MESSAGE, applyAction, carriedCount, freeSpaces } from '../src/game/rules';
import { TOO_TIRED_MESSAGE } from '../src/game/needs';
import { settleStores } from '../src/game/stores';
import { sprites } from '../src/art/sprites';
import { useKeyAction } from '../src/scene/prompts';
import { HILL_TREES, sceneVisuals } from '../src/scene/visuals';
import { bagView, campStoresView } from '../src/ui/panels';
import { saveGame } from '../src/game/save';
import { SAVE_VERSION, upgradeSave } from '../src/game/saveUpgrades';
import { BALANCE, createGame, type GameState } from '../src/game/state';
import { HILL_RABBIT_HOMES, RABBIT_HOMES, rabbitHomes } from '../src/game/wildlife';
import { rabbitAt } from '../src/scene/ambient';
import { buildMap, terrainKey } from '../src/scene/map';
import { hillRockAt } from '../src/scene/hillsGeometry';
import { HILLS_PATHS, pathDistance } from '../src/scene/mapGeometry';
import { closestGatherable, pickTapTarget, targetAction } from '../src/scene/tapTarget';

const game = createGame();
const fakeStorage = (): Storage => {
  const items = new Map<string, string>();
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) } as unknown as Storage;
};
const saves = (state: GameState): boolean => saveGame(fakeStorage(), state).ok;
const placed = placeBranches(game.nodes, [...STEP_IDS]);

/** A camp with the shelter up and the quarry found, that saves unless a change makes it impossible. */
function foundQuarry(changes: Partial<GameState> = {}): GameState {
  return {
    ...game,
    nodes: game.nodes.map((node, i) => ({ ...node, x: placed[i].x, y: placed[i].y })),
    clearing: { cleared: [...STEP_IDS], marked: null, felled: [] },
    structures: { ...game.structures, shelter: true },
    progress: { ...game.progress, quarryFound: true, nextStormDay: null, hearthUnlocked: true },
    ...changes
  };
}
const at = (state: GameState, area: GameState['area'], x: number, y: number): GameState => ({ ...state, area, player: { ...state.player, x, y } });
const WALK = { type: 'move', dx: -1, dy: 0 } as const;
const WALK_EAST = { type: 'move', dx: 1, dy: 0 } as const;
const onHills = (changes: Partial<GameState> = {}): GameState => {
  const base = foundQuarry(changes);
  return { ...base, area: 'hills', progress: { ...base.progress, hillsFound: true } };
};

describe('the way to the hills', () => {
  it('stays shut until the quarry is found', () => {
    const state = at(foundQuarry({ progress: { ...game.progress, nextStormDay: null, hearthUnlocked: true } }), 'quarry', 0.2, 15);
    expect(hillsPathOpen(state)).toBe(false);
    expect(applyAction(state, WALK).state.area).toBe('quarry');
  });

  it('opens from the quarry west edge, by walking', () => {
    const { state, message } = applyAction(at(foundQuarry(), 'quarry', 0.2, 15), WALK);
    expect(state.area).toBe('hills');
    expect(state.player.x).toBe(38.5);
    expect(state.player.y).toBe(15);
    expect(state.progress.hillsFound).toBe(true);
    expect(message).toBe('You came out on the hills. There is rust-red in the rock near the top.');
  });

  it('opens from the quarry west edge, by the cross action', () => {
    const { state, message } = applyAction(at(foundQuarry(), 'quarry', QUARRY_HILLS_EXIT.x, QUARRY_HILLS_EXIT.y), { type: 'cross' });
    expect(state.area).toBe('hills');
    expect(state.player.x).toBe(38.5);
    expect(state.progress.hillsFound).toBe(true);
    expect(message).toContain('You came out on the hills');
  });

  it('is shut to the cross action until the quarry is found', () => {
    const state = at(foundQuarry({ progress: { ...game.progress, nextStormDay: null, hearthUnlocked: true } }), 'quarry', QUARRY_HILLS_EXIT.x, QUARRY_HILLS_EXIT.y);
    expect(applyAction(state, { type: 'cross' }).state.area).toBe('quarry');
  });

  it('leaves the quarry east exit going home', () => {
    expect(applyAction(at(foundQuarry(), 'quarry', QUARRY_EXIT.x, QUARRY_EXIT.y), { type: 'cross' }).state.area).toBe('camp');
    expect(applyAction(at(foundQuarry(), 'quarry', 38.9, 15), WALK_EAST).state.area).toBe('camp');
  });

  it('comes back down into the quarry, by walking and by crossing', () => {
    const walked = applyAction(at(onHills(), 'hills', 38.9, 15.5), WALK_EAST).state;
    expect([walked.area, walked.player.x, walked.player.y]).toEqual(['quarry', 0.5, 15.5]);
    const crossed = applyAction(at(onHills(), 'hills', HILLS_EXIT.x, HILLS_EXIT.y), { type: 'cross' }).state;
    expect([crossed.area, crossed.player.x, crossed.player.y]).toEqual(['quarry', 0.5, 15]);
  });

  it('asks you to walk to a path when you are at neither end of the quarry', () => {
    expect(applyAction(at(foundQuarry(), 'quarry', 20, 15), { type: 'cross' }).message).toBe('Walk to the end of a path to cross.');
    expect(applyAction(at(onHills(), 'hills', 20, 15), { type: 'cross' }).message).toBe('Walk to the path down.');
  });

  it('says the found line only once', () => {
    const { message } = applyAction(at(onHills(), 'quarry', 0.2, 15), WALK);
    expect(message).toBe('');
  });

  it('shows the path on the map and takes a tap only once it is open', () => {
    const shut = at(foundQuarry({ progress: { ...game.progress, nextStormDay: null, hearthUnlocked: true } }), 'quarry', 10, 20);
    const open = at(foundQuarry(), 'quarry', 10, 20);
    expect(terrainKey(shut)).toBe('quarry');
    expect(terrainKey(open)).toBe('quarry-hills-open');
    expect(terrainKey(at(onHills(), 'hills', 10, 10))).toBe('hills');
    expect(pickTapTarget(shut, QUARRY_HILLS_EXIT.x, QUARRY_HILLS_EXIT.y).kind).toBe('ground');
    expect(pickTapTarget(open, QUARRY_HILLS_EXIT.x, QUARRY_HILLS_EXIT.y).kind).toBe('crossing');
    expect(pickTapTarget(at(onHills(), 'hills', 10, 10), HILLS_EXIT.x, HILLS_EXIT.y).kind).toBe('crossing');
  });
});

describe('a save upgraded to version 37', () => {
  /** A version 36 save: today's new game without anything the hills added. */
  const version36 = (): Record<string, unknown> => {
    const old = structuredClone(foundQuarry()) as unknown as Record<string, Record<string, unknown>> & Record<string, unknown>;
    delete old.outcrop; delete old.storedOre; delete old.pony;
    delete old.inventory.ore; delete old.progress.hillsFound; delete old.progress.oreFoundDay; delete old.names.pony;
    const workshop = old.progress.workshop as Record<string, unknown>;
    delete workshop.forge; delete workshop.horseshoes; delete workshop.ironPickaxe;
    return old;
  };

  it('is the next version', () => {
    expect(SAVE_VERSION).toBe(37);
  });

  it('has no hills, ore, forge or pony, and passes validation', () => {
    const result = upgradeSave(36, version36());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const state = result.state as GameState;
    expect(state.pony).toEqual(emptyPony());
    expect(state.inventory.ore).toBe(0);
    expect(state.storedOre).toBe(0);
    expect(state.outcrop).toEqual({ day: 0, dug: 0 });
    expect(state.progress.hillsFound).toBe(false);
    expect(state.progress.oreFoundDay).toBeNull();
    expect(state.progress.workshop.forge).toBe(false);
    expect(state.names.pony).toBeNull();
    expect(saves(state)).toBe(true);
  });

  it('keeps stone piles, marking them as stone', () => {
    const old = version36();
    old.stonePiles = [{ id: 'pile-1', x: 3, y: 3, count: 2, area: 'quarry' }];
    old.area = 'quarry';
    const result = upgradeSave(36, old);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const state = result.state as GameState;
    expect(state.stonePiles).toEqual([{ id: 'pile-1', x: 3, y: 3, count: 2, area: 'quarry', item: 'stone' }]);
    expect(state.area).toBe('quarry');
    expect(saves(state)).toBe(true);
  });
});

describe('saves the hills can really reach', () => {
  const pony = (changes: Partial<PonyState>): PonyState => ({ ...emptyPony(), ...changes });
  const workshop = (changes: Partial<GameState['progress']['workshop']>) => ({ ...game.progress.workshop, ...changes });
  const found = foundQuarry();
  const madeForge = { ...found.progress, hillsFound: true, oreFoundDay: 1, workshop: workshop({ forge: true }) };
  const withWorkshop = { ...found.structures, toolshed: true, workshop: true };

  it('accepts the plain ones', () => {
    expect(saves(found)).toBe(true);
    expect(saves(onHills())).toBe(true);
    expect(saves(foundQuarry({ progress: madeForge, structures: withWorkshop, storedOre: 12 }))).toBe(true);
    expect(saves(foundQuarry({ pony: pony({ trust: 4, won: 1, lastOffer: 1 }) }))).toBe(true);
  });

  it.each<[string, GameState]>([
    ['standing on undiscovered hills', foundQuarry({ area: 'hills' })],
    ['hills found before the quarry', foundQuarry({ progress: { ...found.progress, quarryFound: false, hillsFound: true } })],
    ['too much ore at the forge', foundQuarry({ progress: madeForge, structures: withWorkshop, storedOre: 13 })],
    ['ore at a forge that does not exist', foundQuarry({ storedOre: 1 })],
    ['ore carried with no ore found', foundQuarry({ inventory: { ...game.inventory, ore: 1 } })],
    ['a forge without found ore', foundQuarry({ progress: { ...found.progress, workshop: workshop({ forge: true }) }, structures: withWorkshop })],
    ['a forge without a workshop', foundQuarry({ progress: madeForge })],
    ['horseshoes without a forge', foundQuarry({ progress: { ...found.progress, hillsFound: true, oreFoundDay: 1, workshop: workshop({ horseshoes: true }) }, structures: withWorkshop, pony: pony({ trust: 4, won: 1, shod: 1 }) })],
    ['an iron pickaxe without a forge', foundQuarry({ progress: { ...found.progress, hillsFound: true, oreFoundDay: 1, pickaxeCrafted: true, workshop: workshop({ ironPickaxe: true }) }, structures: withWorkshop })],
    ['an iron pickaxe without the first pickaxe', foundQuarry({ progress: { ...madeForge, workshop: workshop({ forge: true, ironPickaxe: true }) }, structures: withWorkshop })],
    ['a shod pony not won over', foundQuarry({ progress: { ...madeForge, workshop: workshop({ forge: true, horseshoes: true }) }, structures: withWorkshop, pony: pony({ shod: 1 }) })],
    ['horseshoes on no pony', foundQuarry({ progress: { ...madeForge, workshop: workshop({ forge: true, horseshoes: true }) }, structures: withWorkshop, pony: pony({ trust: 4, won: 1 }) })],
    ['a pony won with too little trust', foundQuarry({ pony: pony({ trust: 2, won: 1 }) })],
    ['a pony spot that does not exist', foundQuarry({ pony: pony({ spot: 99 }) })],
    ['a stone pile of something unknown', foundQuarry({ stonePiles: [{ id: 'p', x: 1, y: 1, count: 1, area: 'camp', item: 'gold' as 'ore' }] })],
    ['an ore pile with no ore found', foundQuarry({ stonePiles: [{ id: 'p', x: 1, y: 1, count: 1, area: 'camp', item: 'ore' }] })],
    ['more digs than the outcrop gives', foundQuarry({ outcrop: { day: 1, dug: 4 } })]
  ])('refuses %s', (_, state) => {
    expect(saves(state)).toBe(false);
  });
});

/** At the outcrop with the pickaxe and an empty bag. */
const atOutcrop = (changes: Partial<GameState> = {}): GameState => {
  const base = onHills({ structures: { ...foundQuarry().structures, toolshed: true } });
  return at({ ...base, progress: { ...base.progress, pickaxeCrafted: true }, ...changes }, 'hills', OUTCROP_SITE.x + 1, OUTCROP_SITE.y);
};
const dig = (state: GameState) => applyAction(state, { type: 'digOre' });

describe('digging ore', () => {
  it('gives one ore, for the same time and energy as the quarry', () => {
    const before = atOutcrop();
    const { state } = dig(before);
    expect(state.inventory.ore).toBe(1);
    expect(state.player.energy).toBeLessThan(before.player.energy);
    expect(state.timeOfDay - before.timeOfDay).toBeCloseTo(BALANCE.digSeconds);
  });

  it('says the first time that it has no use yet, and marks the day', () => {
    const { state, message } = dig(atOutcrop());
    expect(message).toBe('You chip out a heavy lump of ore. There is nothing to do with it yet.');
    expect(state.progress.oreFoundDay).toBe(state.day);
  });

  it('uses a plainer line afterwards', () => {
    const first = dig(atOutcrop()).state;
    const second = dig(first);
    expect(second.message).toBe('You chip out a lump of ore.');
    expect(second.state.progress.oreFoundDay).toBe(first.progress.oreFoundDay);
  });

  it('gives three a day, then waits for morning', () => {
    let state = atOutcrop({ inventory: { ...game.inventory } });
    state = { ...state, progress: { ...state.progress, packWoven: true } };
    for (let i = 0; i < 3; i++) state = dig(state).state;
    expect(state.inventory.ore).toBe(3);
    const spent = dig(state);
    expect(spent.message).toBe('The outcrop is worked out until morning.');
    expect(spent.state.inventory.ore).toBe(3);
    expect(dig({ ...state, day: state.day + 1 }).state.inventory.ore).toBe(4);
  });

  it('needs the pickaxe', () => {
    const state = atOutcrop();
    expect(dig({ ...state, progress: { ...state.progress, pickaxeCrafted: false } }).message).toBe('You need a pickaxe to work the outcrop.');
  });

  it('needs you to be there', () => {
    expect(dig(at(atOutcrop(), 'hills', 30, 25)).message).toBe('Move closer to the outcrop.');
    expect(dig(at(atOutcrop(), 'quarry', OUTCROP_SITE.x, OUTCROP_SITE.y)).message).toBe('Move closer to the outcrop.');
  });

  it('needs two free spaces', () => {
    const { message, state } = dig(atOutcrop({ inventory: { ...game.inventory, wood: 7 } }));
    expect(message).toBe(FULL_BAG_MESSAGE);
    expect(state.inventory.ore).toBe(0);
  });

  it('refuses when exhausted', () => {
    const tired = atOutcrop();
    expect(dig({ ...tired, player: { ...tired.player, energy: 0 } }).message).toBe(TOO_TIRED_MESSAGE);
  });
});

describe('carrying ore', () => {
  const carrying = (ore: number, changes: Partial<GameState> = {}): GameState => {
    const base = atOutcrop(changes);
    return { ...base, inventory: { ...base.inventory, ore }, progress: { ...base.progress, oreFoundDay: 1 } };
  };

  it('weighs the same as stone', () => {
    expect(carriedCount(carrying(3))).toBe(6);
    expect(freeSpaces(carrying(3))).toBe(2);
  });

  it('can be dropped and picked up again with nothing lost, even with the bag full', () => {
    const full = carrying(4);
    expect(freeSpaces(full)).toBe(0);
    const { state, message } = applyAction(full, { type: 'dropOre' });
    expect(message).toBe('Set down one ore.');
    expect(state.inventory.ore).toBe(3);
    expect(state.stonePiles).toEqual([expect.objectContaining({ count: 1, area: 'hills', item: 'ore' })]);
    const back = applyAction(state, { type: 'pickUpStone', pileId: state.stonePiles[0].id });
    expect(back.message).toBe('Picked up the ore.');
    expect(back.state.inventory.ore).toBe(4);
    expect(back.state.inventory.stone).toBe(0);
    expect(back.state.stonePiles).toEqual([]);
    expect(saves(state)).toBe(true);
  });

  it('refuses to drop ore it does not have', () => {
    const state = carrying(0);
    expect(applyAction(state, { type: 'dropOre' }).message).toBe('You have no ore to set down.');
  });

  it('keeps ore and stone in separate piles at the same spot', () => {
    const start = carrying(1);
    const bag = { ...start, inventory: { ...start.inventory, stone: 1 } };
    const stone = applyAction(bag, { type: 'dropStone' }).state;
    const both = applyAction(stone, { type: 'dropOre' }).state;
    expect(both.stonePiles.map(pile => pile.item).sort()).toEqual(['ore', 'stone']);
    const stonePile = both.stonePiles.find(pile => pile.item === 'stone')!;
    expect(applyAction(both, { type: 'pickUpStone', pileId: stonePile.id }).state.inventory.stone).toBe(1);
  });

  it('draws an ore pile differently, and names it in the prompt', () => {
    const dropped = applyAction(carrying(1), { type: 'dropOre' }).state;
    const pile = dropped.stonePiles[0];
    expect(sceneVisuals(dropped, 0).find(visual => visual.id === pile.id)?.texture).toMatch(/^orePile:/);
    const found = closestGatherable(dropped);
    expect(found?.kind).toBe('pile');
    expect(useKeyAction(at(dropped, 'hills', pile.x, pile.y))).toEqual({ type: 'pickUpStone', pileId: pile.id });
  });

  const camped = (ore: number, storedOre: number, forge: boolean): GameState => {
    const base = foundQuarry();
    return { ...at(base, 'camp', BALANCE.campX + 1, BALANCE.campY), inventory: { ...base.inventory, ore }, storedOre,
      structures: { ...base.structures, toolshed: true, workshop: forge },
      progress: { ...base.progress, hillsFound: true, oreFoundDay: 1, workshop: { ...base.progress.workshop, forge } } };
  };

  it('stays in the bag before there is a forge', () => {
    expect(settleStores(camped(3, 0, false)).inventory.ore).toBe(3);
  });

  it('moves to the forge in the clearing, up to twelve', () => {
    const settled = settleStores(camped(3, 11, true));
    expect([settled.storedOre, settled.inventory.ore]).toEqual([12, 2]);
  });

  it('does not move outside the clearing', () => {
    expect(settleStores(at(camped(3, 0, true), 'hills', 20, 10)).inventory.ore).toBe(3);
  });

  it('counts the forge and the bag together, spending the bag first', () => {
    const state = camped(1, 2, true);
    expect(availableOre(state)).toBe(3);
    const spent = spendOre(state, 2);
    expect([spent.inventory.ore, spent.storedOre]).toEqual([0, 1]);
  });

  it('shows in the bag and at the forge', () => {
    const state = camped(1, 2, true);
    expect(bagView(state).oreAtForge).toBe('+2 at the forge');
    expect(bagView(camped(1, 0, false)).oreAtForge).toBe('');
    expect(campStoresView(state).lines).toContainEqual({ id: 'ore', text: 'Ore 2/12', shown: true });
    expect(campStoresView(camped(1, 0, false)).lines).toContainEqual({ id: 'ore', text: 'Ore 0/12', shown: false });
  });
});

describe('reaching the outcrop', () => {
  it('E and a tap dig there', () => {
    const state = atOutcrop();
    expect(closestGatherable(state)).toEqual({ kind: 'outcrop' });
    expect(useKeyAction(state)).toEqual({ type: 'digOre' });
    const target = pickTapTarget(state, OUTCROP_SITE.x, OUTCROP_SITE.y);
    expect(target.kind).toBe('outcrop');
    expect(targetAction(target)).toEqual({ type: 'digOre' });
  });

  it('E leaves it alone once it is worked out', () => {
    const state = { ...atOutcrop(), outcrop: { day: 1, dug: 3 } };
    expect(closestGatherable(state)).toBeUndefined();
    expect(useKeyAction(state)).toBeUndefined();
  });

  it('draws the outcrop by what is left', () => {
    const texture = (state: GameState) => sceneVisuals(state, 0).find(visual => visual.id === 'outcrop')?.texture;
    expect(texture(atOutcrop())).toBe('outcrop:ready');
    expect(texture({ ...atOutcrop(), outcrop: { day: 1, dug: 3 } })).toBe('outcrop:spent');
    expect(texture({ ...atOutcrop(), day: 2, outcrop: { day: 1, dug: 3 } })).toBe('outcrop:ready');
    expect(sprites.outcrop.frames.ready).toBeDefined();
  });
});

describe('how the hills look', () => {
  const SEASONS = ['autumn', 'winter', 'spring', 'summer'] as const;
  const map = (time: typeof SEASONS[number]) => buildMap([], 'hills', time);
  const signature = (time: typeof SEASONS[number]) => JSON.stringify([map(time).ground, map(time).decorations]);

  it('shows a different hillside in each season', () => {
    expect(new Set(SEASONS.map(signature)).size).toBe(4);
  });

  it('flowers in the right season', () => {
    const plants = (time: typeof SEASONS[number]) => new Set(map(time).decorations.map(item => item.sprite));
    expect(plants('spring')).toContain('hillGorseBloom');
    expect(plants('summer')).toContain('hillHeatherBloom');
    expect(plants('autumn')).toContain('hillBrackenRust');
    expect(plants('summer')).not.toContain('hillGorseBloom');
    expect(plants('winter').size).toBe(0);
  });

  it('every sprite it asks for exists', () => {
    for (const time of SEASONS) {
      const { ground, decorations, pathTiles } = map(time);
      for (const name of [...new Set(ground.flat()), ...decorations.map(item => item.sprite)]) expect(sprites[name]?.frames.still, name).toBeDefined();
      expect(pathTiles.length).toBeGreaterThan(0);
    }
  });

  it('has bare rock only near the top', () => {
    const spots = Array.from({ length: 30 }, (_, y) => Array.from({ length: 40 }, (_, x) => ({ x, y }))).flat();
    const rocks = spots.filter(({ x, y }) => hillRockAt(x, y));
    expect(rocks.length).toBeGreaterThan(20);
    for (const { x, y } of rocks) expect(Math.hypot(x - OUTCROP_SITE.x, y - OUTCROP_SITE.y)).toBeLessThan(10);
    expect(hillRockAt(OUTCROP_SITE.x, OUTCROP_SITE.y)).toBe(true);
  });

  it('keeps plants off the rock', () => {
    for (const item of map('summer').decorations) expect(hillRockAt(item.x, item.y)).toBe(false);
  });

  it('keeps a clear walk from the exit to the outcrop', () => {
    for (const time of SEASONS) for (const item of map(time).decorations) expect(pathDistance(item.x + 0.5, item.y + 0.5, HILLS_PATHS), item.sprite).toBeGreaterThanOrEqual(1);
    for (const tree of HILL_TREES) expect(pathDistance(tree.x + 0.5, tree.y + 0.5, HILLS_PATHS)).toBeGreaterThanOrEqual(1.5);
  });

  it('grows trees only low down', () => {
    expect(HILL_TREES.length).toBeGreaterThanOrEqual(3);
    for (const tree of HILL_TREES) expect(tree.x).toBeGreaterThanOrEqual(28);
  });

  it('shows each tree by season', () => {
    const frames = (day: number) => sceneVisuals({ ...onHills(), day }, 0).filter(visual => visual.id.startsWith('hill-tree-')).map(visual => visual.texture.split(':')[1]);
    expect(frames(12).every(frame => frame === 'snow')).toBe(true);
    expect(new Set([2, 12, 22, 32].map(day => frames(day)[0])).size).toBe(4);
    for (const visual of sceneVisuals(onHills(), 0).filter(item => item.id.startsWith('hill-tree-'))) {
      const [name, frame] = visual.texture.split(':');
      expect(sprites[name].frames[frame]).toBeDefined();
    }
  });

  it('lets nothing on the hillside be gathered but ore', () => {
    const state = atOutcrop();
    for (const item of map('summer').decorations) {
      expect(['ground', 'outcrop', 'crossing', 'pony']).toContain(pickTapTarget(state, item.x, item.y).kind);
      const standing = at(state, 'hills', item.x, item.y);
      expect(['outcrop', undefined]).toContain(closestGatherable(standing)?.kind);
    }
    for (const tree of HILL_TREES) expect(pickTapTarget(state, tree.x, tree.y).kind).toBe('ground');
  });

  it('reuses the meadow rabbits', () => {
    expect(rabbitHomes('hills')).toBe(HILL_RABBIT_HOMES);
    expect(rabbitHomes('camp')).toBe(RABBIT_HOMES);
    expect(HILL_RABBIT_HOMES).toHaveLength(RABBIT_HOMES.length);
    const onSlope = rabbitAt(0, 0, HILL_RABBIT_HOMES);
    expect(Math.hypot(onSlope.x - HILL_RABBIT_HOMES[0].x, onSlope.y - HILL_RABBIT_HOMES[0].y)).toBeLessThan(1);
    expect(onSlope.frame).toMatch(/^rabbit:/);
    expect(rabbitAt(1, 500)).toEqual(rabbitAt(1, 500, RABBIT_HOMES));
  });
});

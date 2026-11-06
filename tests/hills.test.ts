import { describe, expect, it } from 'vitest';
import { hillsPathOpen, QUARRY_EXIT } from '../src/game/areas';
import { STEP_IDS, placeBranches } from '../src/game/clearing';
import { HILLS_EXIT, QUARRY_HILLS_EXIT } from '../src/game/hills';
import { emptyPony, type PonyState } from '../src/game/pony';
import { applyAction } from '../src/game/rules';
import { saveGame } from '../src/game/save';
import { SAVE_VERSION, upgradeSave } from '../src/game/saveUpgrades';
import { createGame, type GameState } from '../src/game/state';
import { terrainKey } from '../src/scene/map';
import { pickTapTarget } from '../src/scene/tapTarget';

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

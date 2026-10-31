import { describe, expect, it } from 'vitest';
import { BALANCE, BUILDINGS, createGame, type GameState } from '../src/game/state';
import { CLEARING_STEPS, placeBranches } from '../src/game/clearing';
import { TOO_TIRED_MESSAGE } from '../src/game/needs';
import { advanceTime, applyAction, buildStatus, groundBlocker } from '../src/game/rules';
import { nightStart } from '../src/game/calendar';
import { HOUSE_SPOT, fuelLeft } from '../src/game/home';
import { availableWood, logsInStore, spendWood } from '../src/game/wood';
import { SLEEP_REPLAY_MS, replayFrame } from '../src/scene/sleepReplay';
import { WORKSHOP_UPGRADES, cartSpace, fellingWood, upgradeBlocker, type UpgradeId } from '../src/game/workshop';
import { loadGame, saveGame, SAVE_KEY } from '../src/game/save';

const { campX, campY } = BALANCE;

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
}

type Cleared = GameState['clearing']['cleared'];
type Structures = Partial<GameState['structures']>;

/** A camp with the toolshed and workshop up on cleared east ground, standing at the fire, with the given supplies in the bag. */
export function workshopCamp(structures: Structures = {}, changes: Partial<GameState> = {}, cleared: Cleared = ['east-near', 'east-far']): GameState {
  const base = createGame();
  const placed = placeBranches(base.nodes, cleared);
  return {
    ...base,
    day: 6,
    nodes: base.nodes.map((node, i) => ({ ...node, x: placed[i].x, y: placed[i].y })),
    clearing: { cleared, marked: null, felled: [] },
    progress: { ...base.progress, nextStormDay: null, hearthUnlocked: true, axeCrafted: true },
    structures: { ...base.structures, shelter: true, toolshed: true, workshop: true, ...structures },
    inventory: { ...base.inventory, wood: 0, fiber: 0, stone: 0 },
    player: { ...base.player, x: campX, y: campY },
    ...changes
  };
}

export const made = (state: GameState, ...ids: UpgradeId[]): GameState =>
  ({ ...state, progress: { ...state.progress, workshop: { ...state.progress.workshop, ...Object.fromEntries(ids.map(id => [id, true])) } } });

export const withBag = (state: GameState, bag: Partial<GameState['inventory']>): GameState => ({ ...state, inventory: { ...state.inventory, ...bag } });

/** Stands the survivor by the first mature camp tree. */
export function byTree(state: GameState): { state: GameState; treeId: string } {
  const tree = state.trees[0];
  return { state: { ...state, player: { ...state.player, x: tree.x, y: tree.y } }, treeId: tree.id };
}

describe('the workshop', () => {
  it('is defined as asked', () => {
    expect(BUILDINGS.workshop).toEqual({ name: 'Workshop', description: 'Make a saw, a handcart and bed tools', symbol: '⚒',
      cost: { wood: 10, fiber: 4, stone: 6 }, prerequisite: 'toolshed', ground: 'east-far' });
    expect(createGame().structures.workshop).toBe(false);
    expect(createGame().progress.workshop).toEqual({ saw: false, handcart: false, bedTools: false });
    expect(WORKSHOP_UPGRADES).toEqual({
      saw: { name: 'saw', cost: { wood: 3, fiber: 0, stone: 3 } },
      handcart: { name: 'handcart', cost: { wood: 8, fiber: 2, stone: 1 } },
      bedTools: { name: 'bed tools', cost: { wood: 3, fiber: 1, stone: 1 } }
    });
    expect(Object.keys(WORKSHOP_UPGRADES)).toEqual(['saw', 'handcart', 'bedTools']);
    expect(BALANCE.sawWood).toBe(4);
  });

  it('needs the toolshed and the cleared east far ground', () => {
    const none = workshopCamp({ toolshed: false, workshop: false });
    expect(buildStatus(none, 'workshop')).toBe('needsPrerequisite');
    const uncleared = workshopCamp({ workshop: false }, {}, ['east-near']);
    expect(groundBlocker(uncleared, 'workshop')).not.toBeNull();
    expect(groundBlocker(workshopCamp({ workshop: false }), 'workshop')).toBeNull();
  });
});

describe('making an upgrade', () => {
  const stocked = (changes: Partial<GameState> = {}, structures: Structures = {}) =>
    withBag(workshopCamp(structures, changes), { wood: 8, fiber: 2, stone: 3 });

  it('says why it can\'t be made, in order', () => {
    const away = { player: { ...createGame().player, x: 1, y: 1, energy: 5 } };
    expect(upgradeBlocker(made(stocked(away, { workshop: false }), 'saw'), 'saw')).toBe('You already made the saw.');
    expect(upgradeBlocker(stocked(away, { workshop: false }), 'saw')).toBe('Build a workshop first.');
    expect(upgradeBlocker(stocked(away), 'bedTools')).toBe('Build the vegetable beds first.');
    expect(upgradeBlocker(stocked(away), 'saw')).toBe('Return to camp to work at the workshop.');
    expect(upgradeBlocker(stocked({ player: { ...stocked().player, energy: 5 } }), 'saw')).toBe(TOO_TIRED_MESSAGE);
    expect(upgradeBlocker(workshopCamp(), 'saw')).toBe('Need 3 wood and 3 stone for the saw.');
    expect(upgradeBlocker(workshopCamp(), 'handcart')).toBe('Need 8 wood, 2 fiber, and 1 stone for the handcart.');
    expect(upgradeBlocker(workshopCamp({ vegetableBeds: true }, {}, ['east-near', 'east-far', 'west-near']), 'bedTools')).toBe('Need 3 wood, 1 fiber, and 1 stone for the bed tools.');
    expect(upgradeBlocker(stocked(), 'saw')).toBeNull();
  });

  it('pays from the bag and the stores, takes build time and energy, and remembers the saw', () => {
    const state = workshopCamp({ woodpile: true, stonePile: true }, { storedWood: 2, storedStone: 3 });
    const result = applyAction(withBag(state, { wood: 1 }), { type: 'makeUpgrade', upgrade: 'saw' });
    expect(result.message).toBe('You made a saw. A felled tree gives twice the wood now.');
    expect(result.state.progress.workshop).toEqual({ saw: true, handcart: false, bedTools: false });
    expect(result.state).toMatchObject({ storedWood: 0, storedStone: 0, inventory: { wood: 0, stone: 0 } });
    expect(result.state.timeOfDay).toBe(state.timeOfDay + BALANCE.buildSeconds);
    expect(result.state.player.energy).toBe(state.player.energy - BALANCE.buildEnergyCost);
  });

  it('refuses without changing anything', () => {
    const state = workshopCamp();
    const result = applyAction(state, { type: 'makeUpgrade', upgrade: 'saw' });
    expect(result.state).toBe(state);
    expect(result.message).toBe('Need 3 wood and 3 stone for the saw.');
  });
});

describe('felling with the saw', () => {
  it('gives two wood without the saw and four with it', () => {
    expect(fellingWood(workshopCamp())).toBe(2);
    expect(fellingWood(made(workshopCamp(), 'saw'))).toBe(4);
  });

  it('collects four wood from a mature tree', () => {
    const { state, treeId } = byTree(made(workshopCamp(), 'saw'));
    const result = applyAction(state, { type: 'chopTree', treeId });
    expect(result.message).toBe('Chopped the tree and collected four wood. A stump remains.');
    expect(result.state.inventory.wood).toBe(4);
  });

  it('keeps the old message without the saw', () => {
    const { state, treeId } = byTree(workshopCamp());
    expect(applyAction(state, { type: 'chopTree', treeId }).message).toBe('Chopped the tree and collected two wood. A stump remains.');
  });

  it('refuses when the bag has room for only part of the wood, changing nothing', () => {
    const { state, treeId } = byTree(withBag(made(workshopCamp(), 'saw'), { wood: BALANCE.baseCapacity - 3 }));
    const result = applyAction(state, { type: 'chopTree', treeId });
    expect(result.state).toBe(state);
    expect(result.message).toBe('Your bag needs four free spaces for wood.');
  });

  it('gives four from a tree marked for clearing too', () => {
    const base = made(workshopCamp({}, {}, []), 'saw');
    const tree = CLEARING_STEPS['east-near'].trees[2];
    const state = { ...base, clearing: { cleared: [], marked: 'east-near' as const, felled: [] }, player: { ...base.player, x: tree.x, y: tree.y } };
    const cut = applyAction(state, { type: 'chopTree', treeId: 'mark-east-near-2' }).state;
    expect(cut.inventory.wood).toBe(4);
    expect(cut.clearing.felled).toEqual([2]);
  });
});

describe('saving the workshop', () => {
  const roundTrip = (state: GameState) => {
    const storage = new MemoryStorage();
    expect(saveGame(storage, state).ok).toBe(true);
    return loadGame(storage);
  };

  it('keeps the upgrades made', () => {
    const loaded = roundTrip(made(workshopCamp(), 'saw'));
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind === 'loaded') expect(loaded.state.progress.workshop).toEqual({ saw: true, handcart: false, bedTools: false });
  });

  const tampered = (edit: (data: Record<string, any>) => void): string => {
    const storage = new MemoryStorage();
    saveGame(storage, made(workshopCamp(), 'saw'));
    const data = JSON.parse(storage.getItem(SAVE_KEY) ?? '{}');
    edit(data);
    storage.setItem(SAVE_KEY, JSON.stringify(data));
    return loadGame(storage).kind;
  };

  it('rejects an upgrade without the workshop, a missing key, and the old version', () => {
    expect(tampered(() => {})).toBe('loaded');
    expect(tampered(data => { (data.state ?? data).structures.workshop = false; })).toBe('invalid');
    expect(tampered(data => { delete (data.state ?? data).progress.workshop.handcart; })).toBe('invalid');
    expect(tampered(data => { (data.state ?? data).progress.workshop.saw = 'yes'; })).toBe('invalid');
    expect(tampered(data => { data.version = 22; })).toBe('invalid');
  });
});

describe('the handcart', () => {
  const carted = (changes: Partial<GameState> = {}, structures: Structures = { woodpile: true }) =>
    made(workshopCamp(structures, changes), 'handcart');

  it('holds twelve wood, and starts empty', () => {
    expect(BALANCE.handcartCapacity).toBe(12);
    expect(createGame().cartWood).toBe(0);
    expect(cartSpace(workshopCamp())).toBe(0);
    expect(cartSpace(carted({ cartWood: 5 }))).toBe(7);
  });

  it('is built at the workshop', () => {
    const state = withBag(workshopCamp(), { wood: 8, fiber: 2, stone: 1 });
    const result = applyAction(state, { type: 'makeUpgrade', upgrade: 'handcart' });
    expect(result.message).toBe('You built a handcart. Felled wood goes into the cart now.');
    expect(result.state.progress.workshop.handcart).toBe(true);
  });

  it('catches all of a felled tree\'s wood while it has room', () => {
    const { state, treeId } = byTree(carted());
    const two = applyAction(state, { type: 'chopTree', treeId });
    expect(two.message).toBe('Chopped the tree. Two wood went into the cart.');
    expect(two.state).toMatchObject({ cartWood: 2, inventory: { wood: 0 } });
    const sawn = byTree(made(carted(), 'saw'));
    const four = applyAction(sawn.state, { type: 'chopTree', treeId: sawn.treeId });
    expect(four.message).toBe('Chopped the tree. Four wood went into the cart.');
    expect(four.state).toMatchObject({ cartWood: 4, inventory: { wood: 0 } });
  });

  it('fills the cart first, then the bag', () => {
    const { state, treeId } = byTree(made(carted({ cartWood: 11 }), 'saw'));
    const result = applyAction(state, { type: 'chopTree', treeId });
    expect(result.message).toBe('Chopped the tree. One wood went into the cart and three into your bag.');
    expect(result.state).toMatchObject({ cartWood: 12, inventory: { wood: 3 } });
  });

  it('goes to the bag as before once the cart is full', () => {
    const { state, treeId } = byTree(carted({ cartWood: 12 }));
    const result = applyAction(state, { type: 'chopTree', treeId });
    expect(result.message).toBe('Chopped the tree and collected two wood. A stump remains.');
    expect(result.state).toMatchObject({ cartWood: 12, inventory: { wood: 2 } });
  });

  it('refuses when the bag and cart together lack room, changing nothing', () => {
    const { state, treeId } = byTree(withBag(made(carted({ cartWood: 12 }), 'saw'), { wood: BALANCE.baseCapacity - 3 }));
    const result = applyAction(state, { type: 'chopTree', treeId });
    expect(result.state).toBe(state);
    expect(result.message).toBe('Your bag and cart need four free spaces for wood.');
  });

  it('counts as stored wood, spent after the bag and before the woodpile', () => {
    const state = withBag(carted({ cartWood: 2, storedWood: 4 }), { wood: 2 });
    expect(availableWood(state)).toBe(8);
    expect(logsInStore(state)).toBe(6);
    expect(spendWood(state, 5)).toMatchObject({ inventory: { wood: 0 }, cartWood: 0, storedWood: 3 });
  });

  it('says why it can\'t be unloaded, in order', () => {
    const unload = (state: GameState) => applyAction(state, { type: 'unloadCart' }).message;
    const away = { player: { ...createGame().player, x: 1, y: 1 } };
    expect(unload(workshopCamp({ woodpile: true }, away))).toBe('Make a handcart first.');
    expect(unload(carted({ ...away, cartWood: 3 }))).toBe('Return to camp to unload the cart.');
    expect(unload(carted())).toBe('The cart is empty.');
    expect(unload(carted({ cartWood: 3 }, {}))).toBe('Build a woodpile to unload the cart into.');
    expect(unload(carted({ cartWood: 3, storedWood: BALANCE.woodpileCapacity }))).toBe('The wood store is full.');
  });

  it('unloads everything that fits onto the woodpile, at once', () => {
    const state = carted({ cartWood: 5 });
    const result = applyAction(state, { type: 'unloadCart' });
    expect(result.message).toBe('Unloaded 5 wood onto the woodpile.');
    expect(result.state).toMatchObject({ cartWood: 0, storedWood: 5, timeOfDay: state.timeOfDay });
  });

  it('leaves what doesn\'t fit in the cart', () => {
    const result = applyAction(carted({ cartWood: 5, storedWood: BALANCE.woodpileCapacity - 2 }), { type: 'unloadCart' });
    expect(result.message).toBe('Unloaded 2 wood. The wood store is full, so 3 stays in the cart.');
    expect(result.state).toMatchObject({ cartWood: 3, storedWood: BALANCE.woodpileCapacity });
  });
});

describe('the fireplace and the cart', () => {
  const FINISHED: Structures = { shelterThatched: true, shelterStonework: true, shelterPorch: true, shelterFinished: true, hearth: true, bed: true, house: true };
  const home = (changes: Partial<GameState>): GameState => {
    const state = made(workshopCamp(FINISHED, changes, ['north-near', 'north-far', 'east-near', 'east-far']), 'handcart');
    return { ...state, player: { ...state.player, x: HOUSE_SPOT.x, y: HOUSE_SPOT.y } };
  };

  it('draws from the cart once the store is empty', () => {
    const state = home({ storedWood: 0, cartWood: 3, fireplaceFuel: 0, timeOfDay: nightStart(6) });
    expect(fuelLeft(state)).toBe(3 * BALANCE.fireplaceSecondsPerWood);
    const later = advanceTime(state, 1, 'resting');
    expect(later.cartWood).toBe(2);
    expect(later.fireplaceFuel).toBeGreaterThan(0);
  });

  it('draws from the store before the cart', () => {
    const later = advanceTime(home({ storedWood: 1, cartWood: 3, fireplaceFuel: 0, timeOfDay: nightStart(6) }), 1, 'resting');
    expect(later).toMatchObject({ storedWood: 0, cartWood: 3 });
  });

  it('doesn\'t say the fireplace went out while the cart still has wood', () => {
    const result = applyAction(home({ storedWood: 0, cartWood: 12, fireplaceFuel: 0, timeOfDay: nightStart(6) }), { type: 'sleep' });
    expect(result.message).not.toContain('The fireplace went out in the night.');
    expect(result.state.cartWood).toBeLessThan(12);
    expect(result.state.cartWood).toBeGreaterThan(0);
  });

  it('shows the store emptied before the cart while a cold night plays out', () => {
    const before = home({ storedWood: 1, cartWood: 2, fireplaceFuel: 0, timeOfDay: nightStart(6) });
    const after = { ...before, storedWood: 0, cartWood: 2, day: 7, timeOfDay: 0 };
    expect(replayFrame(before, after, 1)).toMatchObject({ storedWood: 0, cartWood: 2 });
    // With the store already empty, the night's log comes out of the cart.
    const fromCart = { ...before, storedWood: 0 };
    expect(replayFrame(fromCart, { ...after, cartWood: 1 }, SLEEP_REPLAY_MS)).toMatchObject({ storedWood: 0, cartWood: 1 });
  });
});

describe('saving the cart', () => {
  const load = (state: GameState, edit: (saved: Record<string, any>) => void = () => {}): string => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 23, state }));
    const data = JSON.parse(storage.getItem(SAVE_KEY) ?? '{}');
    edit(data.state);
    storage.setItem(SAVE_KEY, JSON.stringify(data));
    return loadGame(storage).kind;
  };
  const carted = made(workshopCamp({ woodpile: true }, { cartWood: 12 }), 'handcart');

  it('holds up to twelve, and none without the handcart', () => {
    expect(load(carted)).toBe('loaded');
    expect(load(carted, saved => { saved.cartWood = 13; })).toBe('invalid');
    expect(load(carted, saved => { saved.cartWood = -1; })).toBe('invalid');
    expect(load(carted, saved => { saved.progress.workshop.handcart = false; saved.cartWood = 1; })).toBe('invalid');
    expect(load(carted, saved => { delete saved.cartWood; })).toBe('invalid');
  });
});

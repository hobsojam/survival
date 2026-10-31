import { describe, expect, it } from 'vitest';
import { BALANCE, BUILDINGS, createGame, type GameState } from '../src/game/state';
import { CLEARING_STEPS, STEP_IDS, clearingReach, inClearing, placeBranches } from '../src/game/clearing';
import { applyAction, buildStatus, groundBlocker } from '../src/game/rules';
import { workSeconds } from '../src/game/needs';
import { HOUSE_SPOT, livesInHouse, woodStoreCapacity } from '../src/game/home';
import { loadGame, saveGame, SAVE_KEY } from '../src/game/save';
import { bagView } from '../src/ui/panels';
import { CAMP_STRUCTURES, sceneVisuals, stockFrame } from '../src/scene/visuals';
import { PATH_DESTINATIONS, segmentDistance } from './placement';

const { campX, campY } = BALANCE;
const MOVING_IN = 'You carry your bed into the house. The fireplace inside will keep you warm now, and the campfire is yours to light whenever you like.';
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

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

const FINISHED_SHELTER: Structures = {
  shelter: true, shelterThatched: true, shelterStonework: true, shelterPorch: true, shelterFinished: true, hearth: true, bed: true
};

/** A camp past its first cold night, standing at the fire, with the given ground cleared and buildings up. */
function camp(cleared: Cleared = ['north-near', 'north-far', 'east-near'], structures: Structures = FINISHED_SHELTER, changes: Partial<GameState> = {}): GameState {
  const base = createGame();
  const placed = placeBranches(base.nodes, cleared);
  return {
    ...base,
    day: 6,
    nodes: base.nodes.map((node, i) => ({ ...node, x: placed[i].x, y: placed[i].y })),
    clearing: { cleared, marked: null, felled: [] },
    progress: { ...base.progress, nextStormDay: null, hearthUnlocked: true },
    structures: { ...base.structures, ...structures },
    player: { ...base.player, x: campX, y: campY },
    ...changes
  };
}
const withBag = (state: GameState, bag: Partial<GameState['inventory']>): GameState => ({ ...state, inventory: { ...state.inventory, ...bag } });
const housed = (structures: Structures = {}, changes: Partial<GameState> = {}): GameState =>
  camp(undefined, { ...FINISHED_SHELTER, house: true, ...structures }, changes);
const shelterTexture = (state: GameState): string | undefined => sceneVisuals(state, 0).find(visual => visual.id === 'shelter')?.texture;

describe('the house', () => {
  it('is defined as asked', () => {
    expect(BUILDINGS.house).toEqual({ name: 'House', description: 'A home with a fireplace of its own', symbol: '⌂',
      cost: { wood: 12, fiber: 6, stone: 8 }, prerequisite: 'shelterFinished', alsoRequires: 'bed', ground: 'north-far' });
    expect(BALANCE).toMatchObject({ houseBuildSeconds: 24, woodshedCapacity: 24, fireplaceSecondsPerWood: 200, homeRadius: 2.5 });
    expect(createGame().fireplaceFuel).toBe(0);
    expect(createGame().structures.house).toBe(false);
    expect(HOUSE_SPOT).toEqual({ x: campX - 0.5, y: campY - 6.5 });
  });

  it("waits for the north side's far ground", () => {
    const state = withBag(camp(['north-near']), { wood: 12, fiber: 6, stone: 8 });
    expect(buildStatus(state, 'house')).toBe('needsGround');
    expect(groundBlocker(state, 'house')).toBe("Clear the north side's far ground first.");
    expect(applyAction(state, { type: 'build', structureId: 'house' })).toEqual({ state, message: "Clear the north side's far ground first." });
  });

  it('waits for the finished shelter and the bed', () => {
    const unfinished = camp(undefined, { ...FINISHED_SHELTER, shelterFinished: false });
    expect(buildStatus(unfinished, 'house')).toBe('needsPrerequisite');
    expect(applyAction(unfinished, { type: 'build', structureId: 'house' }).message).toBe('Build the door and shutters first.');
    const bedless = camp(undefined, { ...FINISHED_SHELTER, bed: false });
    expect(buildStatus(bedless, 'house')).toBe('needsPrerequisite');
    expect(applyAction(bedless, { type: 'build', structureId: 'house' }).message).toBe('Build the bed first.');
  });

  it('is built from the bag first and then the stores, taking twice the build time, and the survivor moves in', () => {
    const state = withBag(housed({ house: false, woodpile: true, fibreStack: true, stonePile: true }, { storedWood: 10, storedFiber: 5, storedStone: 6 }),
      { wood: 2, fiber: 1, stone: 2 });
    expect(buildStatus(state, 'house')).toBe('ready');
    expect(livesInHouse(state)).toBe(false);
    const built = applyAction(state, { type: 'build', structureId: 'house' });
    expect(built.message).toBe(MOVING_IN);
    expect(built.state.structures.house).toBe(true);
    expect(livesInHouse(built.state)).toBe(true);
    expect(built.state.inventory).toMatchObject({ wood: 0, fiber: 0, stone: 0 });
    expect(built.state).toMatchObject({ storedWood: 0, storedFiber: 0, storedStone: 0 });
    expect(built.state.timeOfDay - state.timeOfDay).toBe(workSeconds(state, BALANCE.houseBuildSeconds));
  });

  it('takes the tired build time when tired', () => {
    const base = withBag(camp(), { wood: 12, fiber: 6, stone: 8 });
    const tired = { ...base, player: { ...base.player, energy: 15 } };
    const built = applyAction(tired, { type: 'build', structureId: 'house' });
    expect(built.message).toBe(MOVING_IN);
    expect(built.state.timeOfDay - tired.timeOfDay).toBe(workSeconds(tired, 24));
    expect(workSeconds(tired, 24)).toBe(36);
  });
});

describe('where the house stands', () => {
  const SPOT = { x: 19.5, y: 8.5 };
  const NORTH: Cleared = ['north-near', 'north-far'];

  it("stands on the north side's far ground, beyond the near ground", () => {
    expect(HOUSE_SPOT).toEqual(SPOT);
    expect(CAMP_STRUCTURES).toContainEqual(['house', -0.5, -6.5]);
    expect(inClearing(SPOT.x, SPOT.y, NORTH)).toBe(true);
    expect(inClearing(SPOT.x, SPOT.y, ['north-near'])).toBe(false);
  });

  it('sits wholly on cleared earth, every corner of its footprint well inside the north ground', () => {
    // The 40x32 sprite, anchored at [20, 30], spans 1.25 tiles either side of the tile centre, 1.9 above it and 0.2 below.
    const cx = SPOT.x + 0.5, cy = SPOT.y + 0.5;
    const corners = [[cx - 1.25, cy - 1.9], [cx + 1.25, cy - 1.9], [cx - 1.25, cy + 0.2], [cx + 1.25, cy + 0.2]];
    for (const [x, y] of corners) {
      const spare = clearingReach(x, y, NORTH) - Math.hypot(x - campX, y - campY);
      expect(spare, `corner at ${x},${y}`).toBeGreaterThanOrEqual(0.4);
    }
  });

  it('keeps clear of nodes, trees and paths', () => {
    for (const node of placeBranches(createGame().nodes, NORTH)) expect(distance(SPOT, node), node.id).toBeGreaterThanOrEqual(2);
    for (const tree of createGame().trees) expect(distance(SPOT, tree), tree.id).toBeGreaterThanOrEqual(2);
    for (const id of STEP_IDS.filter(step => step !== 'north-near' && step !== 'north-far')) {
      for (const tree of CLEARING_STEPS[id].trees) expect(distance(SPOT, tree), id).toBeGreaterThanOrEqual(2);
    }
    for (const [dx, dy] of PATH_DESTINATIONS) expect(segmentDistance(SPOT.x + 0.5, SPOT.y + 0.5, dx, dy)).toBeGreaterThanOrEqual(1.6);
  });

  it('keeps 2.5 tiles from the shelter and the other camp buildings', () => {
    const others = [{ x: campX - 3, y: campY - 2 }, ...CAMP_STRUCTURES.filter(([id]) => id !== 'house').map(([, dx, dy]) => ({ x: campX + dx, y: campY + dy }))];
    for (const other of others) expect(distance(SPOT, other)).toBeGreaterThanOrEqual(2.5);
  });

  it('shows a staked site once the ground is clear, and the house once built', () => {
    const house = (state: GameState) => sceneVisuals(state, 0).find(visual => visual.id === 'house')?.texture;
    expect(house(camp(['north-near']))).toBeUndefined();
    expect(house(camp())).toBe('houseSite:still');
    expect(house(housed())).toMatch(/^house:(dark|lit)$/);
  });
});

describe('the wood store', () => {
  it('holds the woodpile and the woodshed together', () => {
    expect(woodStoreCapacity(camp())).toBe(0);
    expect(woodStoreCapacity(camp(undefined, { ...FINISHED_SHELTER, woodpile: true }))).toBe(12);
    expect(woodStoreCapacity(housed())).toBe(24);
    expect(woodStoreCapacity(housed({ woodpile: true }))).toBe(36);
  });

  it('refuses a full store', () => {
    const full = withBag(housed({ woodpile: true }, { storedWood: 36 }), { wood: 1 });
    expect(applyAction(full, { type: 'storeWood' })).toEqual({ state: full, message: 'The wood store is full.' });
    const shed = withBag(housed({}, { storedWood: 24 }), { wood: 1 });
    expect(applyAction(shed, { type: 'storeWood' })).toEqual({ state: shed, message: 'The wood store is full.' });
    const room = withBag(housed({ woodpile: true }, { storedWood: 12 }), { wood: 1 });
    expect(applyAction(room, { type: 'storeWood' }).state.storedWood).toBe(13);
  });

  it('stores and takes wood with only the house built', () => {
    const stored = applyAction(withBag(housed(), { wood: 2 }), { type: 'storeWood' });
    expect(stored.state).toMatchObject({ storedWood: 1, inventory: { wood: 1 } });
    expect(stored.message).toBe('Stacked a log on the woodshed.');
    const taken = applyAction(stored.state, { type: 'takeWood' });
    expect(taken.state).toMatchObject({ storedWood: 0, inventory: { wood: 2 } });
    expect(taken.message).toBe('Took a log from the woodshed.');
    expect(applyAction(taken.state, { type: 'takeWood' }).message).toBe('The woodshed is empty.');
  });

  it('names the woodshed when the survivor is away from camp', () => {
    const away = withBag(housed({}, { area: 'quarry', storedWood: 3 }), { wood: 2 });
    for (const type of ['storeWood', 'takeWood'] as const) expect(applyAction(away, { type })).toEqual({ state: away, message: 'Return to camp to use the woodshed.' });
  });

  it('keeps naming the woodpile while it stands beside the woodshed', () => {
    const both = withBag(housed({ woodpile: true }), { wood: 2 });
    expect(applyAction(both, { type: 'storeWood' }).message).toBe('Stacked a log on the woodpile.');
    expect(applyAction(both, { type: 'takeWood' }).message).toBe('The woodpile is empty.');
  });

  it('still asks for a woodpile with neither built', () => {
    const state = withBag(camp(), { wood: 2 });
    for (const type of ['storeWood', 'takeWood'] as const) expect(applyAction(state, { type })).toEqual({ state, message: 'Build a woodpile first.' });
  });

  it('shows the wood store in the bag with its whole capacity', () => {
    expect(bagView(housed({}, { storedWood: 5 }))).toMatchObject({ woodShown: true, woodAtCamp: '+5 at camp', woodStored: 'Stored wood 5/24' });
    expect(bagView(housed({ woodpile: true }, { storedWood: 20 }))).toMatchObject({ woodStored: 'Stored wood 20/36' });
  });
});

describe('the woodshed', () => {
  it('draws the shelter as a woodshed once the house stands, showing its logs', () => {
    expect(shelterTexture(housed({}, { storedWood: 0 }))).toBe('woodshed:empty');
    expect(shelterTexture(housed({}, { storedWood: 11 }))).toBe('woodshed:some');
    expect(shelterTexture(housed({}, { storedWood: 12 }))).toBe('woodshed:full');
    expect(shelterTexture(housed({}, { storedWood: 24 }))).toBe('woodshed:full');
  });

  it('fills the woodshed by its share of the whole store, woodpile included', () => {
    expect(shelterTexture(housed({ woodpile: true }, { storedWood: 17 }))).toBe('woodshed:some');
    expect(shelterTexture(housed({ woodpile: true }, { storedWood: 18 }))).toBe('woodshed:full');
    expect(sceneVisuals(housed({ woodpile: true }, { storedWood: 7 }), 0).find(visual => visual.id === 'woodpile')?.texture).toBe(`woodpile:${stockFrame(7)}`);
  });

  it('keeps the shelter as it was without the house', () => {
    expect(shelterTexture(camp())).toBe('shelter:finishedBed');
    expect(shelterTexture(camp(undefined, { ...FINISHED_SHELTER, woodpile: true }, { storedWood: 7 }))).toBe('shelter:finishedBed');
  });
});

describe('the house in the save', () => {
  const save = (state: GameState, version = 22): string => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ version, state }));
    return loadGame(storage).kind;
  };

  it('accepts version 22 and rejects 21', () => {
    expect(save(housed())).toBe('loaded');
    expect(save(housed(), 21)).toBe('invalid');
    const storage = new MemoryStorage();
    expect(saveGame(storage, housed({ woodpile: true }, { storedWood: 30, fireplaceFuel: 120 })).ok).toBe(true);
    expect(JSON.parse(storage.getItem(SAVE_KEY)!).version).toBe(22);
  });

  it('holds up to the whole wood store', () => {
    expect(save(housed({ woodpile: true }, { storedWood: 36 }))).toBe('loaded');
    expect(save(housed({ woodpile: true }, { storedWood: 37 }))).toBe('invalid');
    expect(save(housed({}, { storedWood: 24 }))).toBe('loaded');
    expect(save(housed({}, { storedWood: 25 }))).toBe('invalid');
    expect(save(camp(undefined, { ...FINISHED_SHELTER, woodpile: true }, { storedWood: 12 }))).toBe('loaded');
    expect(save(camp(undefined, { ...FINISHED_SHELTER, woodpile: true }, { storedWood: 13 }))).toBe('invalid');
  });

  it('keeps fireplace fuel to a lived-in house', () => {
    expect(save(housed({}, { fireplaceFuel: 150.5 }))).toBe('loaded');
    expect(save(housed({}, { fireplaceFuel: -1 }))).toBe('invalid');
    expect(save(housed({}, { fireplaceFuel: Number.NaN }))).toBe('invalid');
    expect(save({ ...housed(), fireplaceFuel: 'warm' as unknown as number })).toBe('invalid');
    const { fireplaceFuel: _, ...missing } = housed();
    expect(save(missing as GameState)).toBe('invalid');
    expect(save(camp(undefined, FINISHED_SHELTER, { fireplaceFuel: 0 }))).toBe('loaded');
    expect(save(camp(undefined, FINISHED_SHELTER, { fireplaceFuel: 10 }))).toBe('invalid');
  });

  it('stands only on cleared north ground', () => {
    const base = housed();
    const placed = placeBranches(createGame().nodes, ['north-near', 'east-near']);
    const unclearedFar = { ...base, clearing: { cleared: ['north-near', 'east-near'] as Cleared, marked: null, felled: [] }, nodes: base.nodes.map((node, i) => ({ ...node, x: placed[i].x, y: placed[i].y })) };
    expect(save(unclearedFar)).toBe('invalid');
    expect(save({ ...unclearedFar, structures: { ...unclearedFar.structures, house: false } })).toBe('loaded');
  });
});

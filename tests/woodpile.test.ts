import { describe, expect, it } from 'vitest';
import { BALANCE, BUILDINGS, LOOKOUT, createGame, type GameState } from '../src/game/state';
import { CLEARING_STEPS, STEP_IDS, clearGroundBlocker, inClearing, placeBranches } from '../src/game/clearing';
import { potBlocker } from '../src/game/cooking';
import { stormReadiness } from '../src/game/forecast';
import { applyAction, availableWood, buildStatus, groundBlocker, lookoutRepairBlocker, spendWood } from '../src/game/rules';
import { bagView, buildButtonView } from '../src/ui/panels';
import { CAMP_STRUCTURES, stockFrame } from '../src/scene/visuals';
import { PATH_DESTINATIONS, segmentDistance } from './placement';

const { campX, campY } = BALANCE;
const SPOT = { x: campX + 5.5, y: campY - 1.5 };
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** A camp with the east side's near ground cleared, standing at the fire, with the woodpile built or not. */
function camp(built = true, changes: Partial<GameState> = {}): GameState {
  const base = createGame();
  const cleared: GameState['clearing']['cleared'] = ['east-near'];
  const placed = placeBranches(base.nodes, cleared);
  return {
    ...base,
    day: 6,
    nodes: base.nodes.map((node, i) => ({ ...node, x: placed[i].x, y: placed[i].y })),
    clearing: { cleared, marked: null, felled: [] },
    structures: { ...base.structures, woodpile: built },
    player: { ...base.player, x: campX, y: campY },
    ...changes
  };
}
const stocked = (bag: number, pile: number, changes: Partial<GameState> = {}): GameState => {
  const state = camp(true, { storedWood: pile, ...changes });
  return { ...state, inventory: { ...state.inventory, wood: bag } };
};

describe('building the woodpile', () => {
  it('is defined as asked', () => {
    expect(BUILDINGS.woodpile).toEqual({ name: 'Woodpile', description: 'Keep up to 12 wood split and dry', symbol: '▤',
      cost: { wood: 3, fiber: 1 }, prerequisite: null, ground: 'east-near' });
    expect(BALANCE.woodpileCapacity).toBe(12);
    expect(createGame().storedWood).toBe(0);
  });

  it("waits for the east side's near ground", () => {
    const base = createGame();
    const state = { ...base, inventory: { ...base.inventory, wood: 3, fiber: 1 }, player: { ...base.player, x: campX, y: campY } };
    expect(buildStatus(state, 'woodpile')).toBe('needsGround');
    expect(groundBlocker(state, 'woodpile')).toBe("Clear the east side's near ground first.");
    expect(applyAction(state, { type: 'build', structureId: 'woodpile' })).toEqual({ state, message: "Clear the east side's near ground first." });
    expect(buildButtonView(state, 'woodpile')).toMatchObject({ verb: 'Blocked', description: "Clear the east side's near ground first", disabled: true });
  });

  it('builds for 3 wood and 1 fiber once the ground is clear', () => {
    const base = camp(false);
    const state = { ...base, inventory: { ...base.inventory, wood: 3, fiber: 1 } };
    expect(buildStatus(state, 'woodpile')).toBe('ready');
    const built = applyAction(state, { type: 'build', structureId: 'woodpile' });
    expect(built.message).toBe('Built the woodpile.');
    expect(built.state.structures.woodpile).toBe(true);
    expect(built.state.inventory).toMatchObject({ wood: 0, fiber: 0 });
  });
});

describe('where the woodpile stands', () => {
  it("stands on the east side's near ground, outside the starting ring", () => {
    expect(CAMP_STRUCTURES).toContainEqual(['woodpile', 5.5, -1.5]);
    expect(inClearing(SPOT.x, SPOT.y, ['east-near'])).toBe(true);
    expect(inClearing(SPOT.x, SPOT.y, [])).toBe(false);
  });

  it('keeps clear of nodes, trees and paths', () => {
    for (const node of placeBranches(createGame().nodes, ['east-near'])) expect(distance(SPOT, node), node.id).toBeGreaterThanOrEqual(1.5);
    for (const tree of createGame().trees) expect(distance(SPOT, tree), tree.id).toBeGreaterThanOrEqual(1.5);
    for (const id of STEP_IDS.filter(step => step !== 'east-near')) {
      for (const tree of CLEARING_STEPS[id].trees) expect(distance(SPOT, tree), id).toBeGreaterThanOrEqual(1.5);
    }
    for (const [dx, dy] of PATH_DESTINATIONS) expect(segmentDistance(SPOT.x + 0.5, SPOT.y + 0.5, dx, dy)).toBeGreaterThanOrEqual(1.35);
  });

  it('keeps 2 tiles from the other camp buildings and the shelter', () => {
    const others = [{ x: campX - 3, y: campY - 2 }, ...CAMP_STRUCTURES.filter(([id]) => id !== 'woodpile').map(([, dx, dy]) => ({ x: campX + dx, y: campY + dy }))];
    for (const other of others) expect(distance(SPOT, other)).toBeGreaterThanOrEqual(2);
  });

  it('shows how much it holds', () => {
    expect([0, 1, 6, 7, 12].map(stockFrame)).toEqual(['empty', 'some', 'some', 'full', 'full']);
  });
});

describe('using stored wood', () => {
  it('counts the bag and the pile, spending the bag first', () => {
    expect(availableWood(stocked(2, 3))).toBe(5);
    const spent = spendWood(stocked(2, 3), 3);
    expect(spent.inventory.wood).toBe(0);
    expect(spent.storedWood).toBe(2);
  });

  it('feeds the fire from the pile at camp, and not away from it', () => {
    const state = stocked(0, 3);
    const stoked = applyAction(state, { type: 'stokeFire' });
    expect(stoked.state).toMatchObject({ storedWood: 2, inventory: { wood: 0 } });
    expect(stoked.state.fireFuel).toBeGreaterThan(state.fireFuel);
    const away = { ...state, player: { ...state.player, x: 5, y: 5 } };
    expect(applyAction(away, { type: 'stokeFire' }).message).toBe('Move closer to the fire to tend it.');
    expect(applyAction(stocked(1, 3), { type: 'stokeFire' }).state).toMatchObject({ storedWood: 3, inventory: { wood: 0 } });
  });

  it('pays for a build that costs 3 wood', () => {
    const base = stocked(0, 3);
    const state = { ...base, inventory: { ...base.inventory, fiber: 4 } };
    expect(buildStatus({ ...state, structures: { ...state.structures, windbreak: false } }, 'stonePile')).toBe('ready');
    const built = applyAction(state, { type: 'build', structureId: 'stonePile' }).state;
    expect(built.structures.stonePile).toBe(true);
    expect(built.storedWood).toBe(0);
    const mixed = applyAction({ ...stocked(1, 3), inventory: { ...base.inventory, wood: 1, fiber: 4 } }, { type: 'build', structureId: 'stonePile' }).state;
    expect(mixed).toMatchObject({ storedWood: 1, inventory: { wood: 0 } });
  });

  it('counts for the lookout, the cooking pot and clearing the ground', () => {
    const lookout = { ...stocked(0, 4), progress: { ...createGame().progress, hearthUnlocked: true },
      player: { ...createGame().player, x: LOOKOUT.x, y: LOOKOUT.y + 1 }, inventory: { wood: 0, fiber: 2, stone: 2, food: createGame().inventory.food } };
    expect(lookoutRepairBlocker(lookout)).toBeNull();
    expect(lookoutRepairBlocker({ ...lookout, storedWood: 3 })).toBe('Need 4 wood to repair the lookout.');

    const pot = stocked(0, 1, { progress: { ...createGame().progress, potCrafted: false }, structures: { ...camp().structures, toolshed: true } });
    expect(potBlocker({ ...pot, inventory: { ...pot.inventory, stone: 2 } })).toBeNull();
    expect(potBlocker({ ...pot, storedWood: 0, inventory: { ...pot.inventory, stone: 2 } })).toBe('Need 1 wood and 2 stone for the pot.');

    const base = createGame();
    const ground = { ...base, progress: { ...base.progress, axeCrafted: true }, storedWood: 4, structures: { ...base.structures, woodpile: true },
      clearing: { cleared: [], marked: 'north-near' as const, felled: [0, 1, 2, 3] }, inventory: { ...base.inventory, fiber: 2 } };
    expect(clearGroundBlocker(ground)).toBeNull();
    const cleared = applyAction(ground, { type: 'clearGround' }).state;
    expect(cleared.storedWood).toBe(0);
    expect(clearGroundBlocker({ ...ground, storedWood: 3 })).toBe('Need 4 wood and 2 fiber to clear this.');
  });

  it('counts toward the cold night forecast', () => {
    const state = { ...createGame(), day: 3, timeOfDay: 100, structures: { ...createGame().structures, woodpile: true } };
    const empty = stormReadiness(state);
    const piled = stormReadiness({ ...state, storedWood: 2 });
    const carried = stormReadiness({ ...state, inventory: { ...state.inventory, wood: 2 } });
    expect(empty.logsShort).toBeGreaterThan(0);
    expect(piled.logsShort).toBe(carried.logsShort);
    expect(piled.logsShort).toBe(empty.logsShort - 2);
  });
});

describe('the bag panel and the woodpile', () => {
  it('shows what the pile holds once built', () => {
    expect(bagView(camp(false))).toMatchObject({ woodAtCamp: '' });
    expect(bagView(stocked(1, 5))).toMatchObject({ woodAtCamp: '+5 at camp' });
  });
});

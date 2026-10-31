import { describe, expect, it } from 'vitest';
import { BALANCE, BUILDINGS, LOOKOUT, createGame, type GameState } from '../src/game/state';
import { CLEARING_STEPS, STEP_IDS, clearGroundBlocker, inClearing, placeBranches } from '../src/game/clearing';
import { applyAction, availableFiber, buildStatus, groundBlocker, lookoutRepairBlocker, spendFiber } from '../src/game/rules';
import { bagView, buildButtonView } from '../src/ui/panels';
import { CAMP_STRUCTURES, stockFrame } from '../src/scene/visuals';
import { PATH_DESTINATIONS, segmentDistance } from './placement';

const { campX, campY } = BALANCE;
const SPOT = { x: campX + 5.5, y: campY + 1.5 };
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** A camp with the east side's near ground cleared, standing at the fire, with the fibre stack built or not. */
function camp(built = true, changes: Partial<GameState> = {}): GameState {
  const base = createGame();
  const cleared: GameState['clearing']['cleared'] = ['east-near'];
  const placed = placeBranches(base.nodes, cleared);
  return {
    ...base,
    day: 6,
    nodes: base.nodes.map((node, i) => ({ ...node, x: placed[i].x, y: placed[i].y })),
    clearing: { cleared, marked: null, felled: [] },
    progress: { ...base.progress, nextStormDay: null, hearthUnlocked: true },
    structures: { ...base.structures, fibreStack: built },
    player: { ...base.player, x: campX, y: campY },
    ...changes
  };
}
const stocked = (bag: number, stack: number, changes: Partial<GameState> = {}): GameState => {
  const state = camp(true, { storedFiber: stack, ...changes });
  return { ...state, inventory: { ...state.inventory, fiber: bag } };
};

describe('building the fibre stack', () => {
  it('is defined as asked', () => {
    expect(BUILDINGS.fibreStack).toEqual({ name: 'Fibre stack', description: 'Keep up to 12 fiber dry under thatch', symbol: '≋',
      cost: { wood: 2, fiber: 3 }, prerequisite: null, ground: 'east-near' });
    expect(BALANCE.fibreStackCapacity).toBe(12);
    expect(createGame().storedFiber).toBe(0);
  });

  it("waits for the east side's near ground", () => {
    const base = createGame();
    const state = { ...base, inventory: { ...base.inventory, wood: 2, fiber: 3 }, player: { ...base.player, x: campX, y: campY } };
    expect(buildStatus(state, 'fibreStack')).toBe('needsGround');
    expect(groundBlocker(state, 'fibreStack')).toBe("Clear the east side's near ground first.");
    expect(applyAction(state, { type: 'build', structureId: 'fibreStack' })).toEqual({ state, message: "Clear the east side's near ground first." });
    expect(buildButtonView(state, 'fibreStack')).toMatchObject({ verb: 'Blocked', description: "Clear the east side's near ground first", disabled: true });
  });

  it('builds for 2 wood and 3 fiber once the ground is clear', () => {
    const base = camp(false);
    const state = { ...base, inventory: { ...base.inventory, wood: 2, fiber: 3 } };
    expect(buildStatus(state, 'fibreStack')).toBe('ready');
    const built = applyAction(state, { type: 'build', structureId: 'fibreStack' });
    expect(built.message).toBe('Built the fibre stack.');
    expect(built.state.structures.fibreStack).toBe(true);
    expect(built.state.inventory).toMatchObject({ wood: 0, fiber: 0 });
  });
});

describe('where the fibre stack stands', () => {
  it("stands on the east side's near ground, outside the starting ring", () => {
    expect(CAMP_STRUCTURES).toContainEqual(['fibreStack', 5.5, 1.5]);
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
    const others = [{ x: campX - 3, y: campY - 2 }, ...CAMP_STRUCTURES.filter(([id]) => id !== 'fibreStack').map(([, dx, dy]) => ({ x: campX + dx, y: campY + dy }))];
    for (const other of others) expect(distance(SPOT, other)).toBeGreaterThanOrEqual(2);
  });

  it('shows how much it holds', () => {
    expect([0, 1, 6, 7, 12].map(stockFrame)).toEqual(['empty', 'some', 'some', 'full', 'full']);
  });
});

describe('using stored fiber', () => {
  it('counts the bag and the stack, spending the bag first', () => {
    expect(availableFiber(stocked(2, 3))).toBe(5);
    const spent = spendFiber(stocked(2, 3), 3);
    expect(spent.inventory.fiber).toBe(0);
    expect(spent.storedFiber).toBe(2);
  });

  it('pays for a build from the stack, bag fiber first', () => {
    const base = stocked(0, 4);
    const state = { ...base, inventory: { ...base.inventory, wood: 4 } };
    expect(buildStatus(state, 'garden')).toBe('ready');
    const built = applyAction(state, { type: 'build', structureId: 'garden' }).state;
    expect(built.structures.garden).toBe(true);
    expect(built).toMatchObject({ storedFiber: 2, inventory: { fiber: 0 } });
    const mixed = applyAction({ ...state, inventory: { ...state.inventory, fiber: 1 } }, { type: 'build', structureId: 'garden' }).state;
    expect(mixed).toMatchObject({ storedFiber: 3, inventory: { fiber: 0 } });
    expect(applyAction({ ...state, storedFiber: 1 }, { type: 'build', structureId: 'garden' }).message).toBe('Need 2 fiber to build this.');
  });

  it('pays for clearing the ground', () => {
    const base = stocked(0, 2, { progress: { ...camp().progress, axeCrafted: true }, structures: { ...camp().structures, toolshed: true, shelter: true },
      clearing: { cleared: ['east-near'], marked: 'north-near', felled: [0, 1, 2, 3] } });
    const ground = { ...base, inventory: { ...base.inventory, wood: 4 } };
    expect(clearGroundBlocker(ground)).toBeNull();
    const cleared = applyAction(ground, { type: 'clearGround' }).state;
    expect(cleared.clearing.cleared).toContain('north-near');
    expect(cleared).toMatchObject({ storedFiber: 0, inventory: { fiber: 0 } });
    expect(clearGroundBlocker({ ...ground, storedFiber: 1 })).toBe('Need 4 wood and 2 fiber to clear this.');
  });

  it('pays for the axe and the pickaxe', () => {
    const base = stocked(0, 1, { structures: { ...camp().structures, shelter: true, toolshed: true } });
    const tools = { ...base, inventory: { ...base.inventory, wood: 2, stone: 2 } };
    const axe = applyAction(tools, { type: 'craftAxe' }).state;
    expect(axe.progress.axeCrafted).toBe(true);
    expect(axe).toMatchObject({ storedFiber: 0, inventory: { fiber: 0 } });
    expect(applyAction({ ...tools, storedFiber: 0 }, { type: 'craftAxe' }).message).toBe('Need 1 wood, 1 fiber, and 1 stone for the axe.');

    const quarry = { ...tools, progress: { ...tools.progress, axeCrafted: true, quarryFound: true } };
    const pickaxe = applyAction(quarry, { type: 'craftPickaxe' }).state;
    expect(pickaxe.progress.pickaxeCrafted).toBe(true);
    expect(pickaxe).toMatchObject({ storedFiber: 0, inventory: { fiber: 0 } });
    expect(applyAction({ ...quarry, storedFiber: 0 }, { type: 'craftPickaxe' }).message).toBe('Need 2 wood, 1 fiber, and 2 stone for the pickaxe.');
  });

  it('pays for the lookout repair', () => {
    const base = stocked(0, 2, { player: { ...createGame().player, x: LOOKOUT.x, y: LOOKOUT.y + 1 } });
    const lookout = { ...base, inventory: { ...base.inventory, wood: 4, stone: 2 } };
    expect(lookoutRepairBlocker(lookout)).toBeNull();
    const repaired = applyAction(lookout, { type: 'repairLookout' }).state;
    expect(repaired.progress.lookoutRepaired).toBe(true);
    expect(repaired).toMatchObject({ storedFiber: 0, inventory: { fiber: 0 } });
    expect(lookoutRepairBlocker({ ...lookout, storedFiber: 1 })).toBe('Need 2 fiber to repair the lookout.');
  });

  it('burns fiber from the stack at camp, bag fiber first', () => {
    const state = stocked(0, 2);
    const burned = applyAction(state, { type: 'burnFiber' });
    expect(burned.message).toBe('The kindling flares up.');
    expect(burned.state).toMatchObject({ storedFiber: 1, inventory: { fiber: 0 }, fireFuel: state.fireFuel + BALANCE.fiberFireSeconds });
    expect(applyAction(stocked(1, 2), { type: 'burnFiber' }).state).toMatchObject({ storedFiber: 2, inventory: { fiber: 0 } });
    expect(applyAction(stocked(0, 0), { type: 'burnFiber' }).message).toBe('You have no fiber to burn.');
  });
});

describe('the bag panel and the fibre stack', () => {
  it('shows what the stack holds once built', () => {
    expect(bagView(camp(false))).toMatchObject({ fiberAtCamp: '' });
    expect(bagView(stocked(1, 5))).toMatchObject({ fiberAtCamp: '+5 at camp' });
  });
});

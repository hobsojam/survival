import { describe, expect, it } from 'vitest';
import { BALANCE, createGame, type GameState } from '../src/game/state';
import { inClearing, placeBranches } from '../src/game/clearing';
import { applyAction } from '../src/game/rules';
import { settleStores } from '../src/game/stores';
import { loadGame, SAVE_KEY } from '../src/game/save';
import { stock } from './stock';
import FIXTURE from './fixtures/save-v23.json?raw';

const { campX, campY } = BALANCE;
type Structures = Partial<GameState['structures']>;

/** A camp with the east near ground cleared, standing at the fire, with the stores asked for and the bag as given. */
function camp(structures: Structures = { woodpile: true, fibreStack: true, stonePile: true }, changes: Partial<GameState> = {}): GameState {
  const base = createGame();
  const cleared: GameState['clearing']['cleared'] = ['east-near'];
  const placed = placeBranches(base.nodes, cleared);
  return {
    ...base,
    day: 6,
    nodes: base.nodes.map((node, i) => ({ ...node, x: placed[i].x, y: placed[i].y })),
    clearing: { cleared, marked: null, felled: [] },
    structures: { ...base.structures, ...structures },
    player: { ...base.player, x: campX, y: campY },
    ...changes
  };
}
const withBag = (state: GameState, bag: Partial<GameState['inventory']>): GameState => ({ ...state, inventory: { ...state.inventory, ...bag } });
const carted = (state: GameState, cartWood: number): GameState =>
  ({ ...state, cartWood, progress: { ...state.progress, workshop: { ...state.progress.workshop, handcart: true } } });

describe('materials storing themselves', () => {
  it('moves the bag\'s wood, fiber and stone into their stores, and leaves food alone', () => {
    const food = stock(2);
    const settled = settleStores(withBag(camp(), { wood: 3, fiber: 2, stone: 1, food }));
    expect(settled.inventory).toEqual({ wood: 0, fiber: 0, stone: 0, food });
    expect(settled).toMatchObject({ storedWood: 3, storedFiber: 2, storedStone: 1 });
  });

  it('fills a store only as far as it has room, and changes nothing when it is full', () => {
    const settled = settleStores(withBag(camp(undefined, { storedWood: BALANCE.woodpileCapacity - 2 }), { wood: 5 }));
    expect(settled).toMatchObject({ storedWood: BALANCE.woodpileCapacity, inventory: { wood: 3 } });
    const full = withBag(camp(undefined, { storedWood: BALANCE.woodpileCapacity }), { wood: 5 });
    expect(settleStores(full)).toBe(full);
  });

  it('keeps a supply in the bag until its store is built', () => {
    const settled = settleStores(withBag(camp({ woodpile: true }), { wood: 1, fiber: 2, stone: 1 }));
    expect(settled.inventory).toMatchObject({ wood: 0, fiber: 2, stone: 1 });
    const none = withBag(camp({}), { wood: 2 });
    expect(settleStores(none)).toBe(none);
  });

  it('empties the handcart into the wood store after the bag', () => {
    expect(settleStores(carted(camp(undefined, { storedWood: BALANCE.woodpileCapacity - 4 }), 7))).toMatchObject({ cartWood: 3, storedWood: BALANCE.woodpileCapacity });
    const both = settleStores(withBag(carted(camp(undefined, { storedWood: BALANCE.woodpileCapacity - 5 }), 7), { wood: 3 }));
    expect(both).toMatchObject({ inventory: { wood: 0 }, cartWood: 5, storedWood: BALANCE.woodpileCapacity });
  });

  it('moves nothing outside the clearing', () => {
    const quarry = withBag(camp(undefined, { area: 'quarry' }), { wood: 3 });
    expect(settleStores(quarry)).toBe(quarry);
    const outside = withBag(camp(undefined, { player: { ...createGame().player, x: 1, y: 1 } }), { wood: 3 });
    expect(inClearing(1, 1, outside.clearing.cleared)).toBe(false);
    expect(settleStores(outside)).toBe(outside);
  });
});

describe('storing after an action', () => {
  it('stores fiber picked in the clearing, keeping the action\'s own message', () => {
    const base = camp();
    const patch = base.nodes.find(node => node.kind === 'fiber' && node.amount > 0 && inClearing(node.x, node.y, base.clearing.cleared));
    expect(patch, 'a fiber patch inside the clearing').toBeDefined();
    const state = { ...base, player: { ...base.player, x: patch!.x, y: patch!.y } };
    const plain = applyAction({ ...state, structures: { ...state.structures, fibreStack: false } }, { type: 'gather', nodeId: patch!.id });
    const result = applyAction(state, { type: 'gather', nodeId: patch!.id });
    expect(result.message).toBe(plain.message);
    expect(result.state).toMatchObject({ storedFiber: 1, inventory: { fiber: 0 } });
  });

  it('stores the bag on walking back into the clearing', () => {
    const outside = withBag(camp(undefined, { player: { ...createGame().player, x: campX + 4.4, y: campY } }), { wood: 2 });
    const walked = applyAction(outside, { type: 'move', dx: -1, dy: 0 });
    expect(walked.state).toMatchObject({ storedWood: 2, inventory: { wood: 0 } });
  });

  it('stores a full bag, then the cart, on stepping in, never losing wood or overfilling the store', () => {
    const at = { player: { ...createGame().player, x: campX + 4.4, y: campY }, storedWood: BALANCE.woodpileCapacity - 6 };
    const outside = withBag(carted(camp(undefined, at), 9), { wood: 4 });
    const walked = applyAction(outside, { type: 'move', dx: -1, dy: 0 }).state;
    expect(walked).toMatchObject({ inventory: { wood: 0 }, cartWood: 7, storedWood: BALANCE.woodpileCapacity });
    expect(walked.inventory.wood + walked.cartWood + walked.storedWood).toBe(4 + 9 + BALANCE.woodpileCapacity - 6);
  });

  it('changes nothing when the action is refused', () => {
    const state = withBag(camp(), { wood: 1 });
    const refused = applyAction(state, { type: 'build', structureId: 'windbreak' });
    expect(refused.state).toBe(state);
  });

  it('no longer offers the old store and take actions', () => {
    for (const type of ['storeWood', 'takeWood', 'storeStone', 'takeStone', 'storeFiber', 'takeFiber', 'unloadCart']) {
      expect(applyAction(camp(), { type } as never).message, type).toBe('That action is not available yet.');
    }
  });

  it('moves nothing as the frozen save loads', () => {
    const storage = new Map<string, string>([[SAVE_KEY, FIXTURE]]);
    const result = loadGame({ getItem: (key: string) => storage.get(key) ?? null } as unknown as Storage);
    expect(result.kind).toBe('loaded');
    const was = JSON.parse(FIXTURE).state.inventory;
    if (result.kind === 'loaded') expect(result.state.inventory).toEqual({ ...was, food: { ...was.food, fish: 0 } });
  });
});

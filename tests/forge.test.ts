import { describe, expect, it } from 'vitest';
import { QUARRY_SITE, RUBBLE_SITE } from '../src/game/areas';
import { CLEARING_STEPS, STEP_IDS, placeBranches, type StepId } from '../src/game/clearing';
import { OUTCROP_SITE } from '../src/game/hills';
import { emptyPony } from '../src/game/pony';
import { FULL_BAG_MESSAGE, applyAction } from '../src/game/rules';
import { saveGame } from '../src/game/save';
import { BALANCE, createGame, type GameState } from '../src/game/state';
import { upgradeBlocker } from '../src/game/workshop';
import { CAMP_STRUCTURES, CART_SPOT, FORGE_SPOT, sceneVisuals } from '../src/scene/visuals';
import { workshopView } from '../src/ui/panels';

const game = createGame();
const placed = placeBranches(game.nodes, [...STEP_IDS]);
const saves = (state: GameState): boolean => {
  const items = new Map<string, string>();
  return saveGame({ getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) } as unknown as Storage, state).ok;
};

/** At camp with the workshop up and ore found, holding `ore` and plenty of wood and stone in the stores. */
function camp(changes: Partial<GameState['progress']['workshop']> = {}, more: Partial<GameState> = {}): GameState {
  return {
    ...game,
    nodes: game.nodes.map((node, i) => ({ ...node, x: placed[i].x, y: placed[i].y })),
    clearing: { cleared: [...STEP_IDS], marked: null, felled: [] },
    structures: { ...game.structures, shelter: true, toolshed: true, workshop: true },
    progress: { ...game.progress, nextStormDay: null, hearthUnlocked: true, quarryFound: true, hillsFound: true, oreFoundDay: 1, pickaxeCrafted: true, workshop: { ...game.progress.workshop, ...changes } },
    inventory: { ...game.inventory, wood: 4, stone: 1 },
    player: { ...game.player, x: BALANCE.campX + 1, y: BALANCE.campY },
    ...more
  };
}
const withStone = (state: GameState): GameState => ({ ...state, structures: { ...state.structures, stonePile: true }, storedStone: 10 });
const won = { ...emptyPony(), trust: BALANCE.ponyTrustTarget, won: 1, home: true };
const make = (state: GameState, upgrade: 'forge' | 'horseshoes' | 'ironPickaxe') => applyAction(state, { type: 'makeUpgrade', upgrade });

describe('adding the forge', () => {
  it('is hidden from the panel until ore is found', () => {
    const before = camp();
    expect(workshopView({ ...before, progress: { ...before.progress, oreFoundDay: null } }).rows.forge.shown).toBe(false);
    expect(workshopView(before).rows.forge.shown).toBe(true);
  });

  it('needs ore found and a workshop', () => {
    const base = camp();
    expect(upgradeBlocker({ ...base, structures: { ...base.structures, workshop: false } }, 'forge')).toBe('Build a workshop first.');
    expect(upgradeBlocker({ ...base, progress: { ...base.progress, oreFoundDay: null } }, 'forge')).toBe('Find some ore first.');
  });

  it('costs 2 wood and 6 stone', () => {
    const { state, message } = make(withStone(camp()), 'forge');
    expect(message).toBe('You added a forge to the workshop.');
    expect(state.progress.workshop.forge).toBe(true);
    expect(state.inventory.wood).toBe(2);
    expect(state.storedStone + state.inventory.stone).toBe(11 - 6);
    expect(saves(state)).toBe(true);
  });

  it('says what is short', () => {
    expect(make(camp(), 'forge').message).toBe('Need 2 wood and 6 stone for the forge.');
  });

  it('stands clear of the handcart, the other buildings and every tree', () => {
    const spot = { x: BALANCE.campX + FORGE_SPOT.dx, y: BALANCE.campY + FORGE_SPOT.dy };
    const clear = (x: number, y: number) => Math.hypot(x - spot.x, y - spot.y);
    expect(clear(BALANCE.campX + CART_SPOT.dx, BALANCE.campY + CART_SPOT.dy)).toBeGreaterThanOrEqual(1.5);
    for (const [id, dx, dy] of CAMP_STRUCTURES) if (id !== 'workshop') expect(clear(BALANCE.campX + dx, BALANCE.campY + dy), id).toBeGreaterThanOrEqual(1.5);
    for (const tree of game.trees) expect(clear(tree.x, tree.y), tree.id).toBeGreaterThanOrEqual(1.5);
    const stillStanding: StepId[] = STEP_IDS.filter(id => id !== 'east-near' && id !== 'east-far');
    for (const id of stillStanding) for (const tree of CLEARING_STEPS[id].trees) expect(clear(tree.x, tree.y), id).toBeGreaterThanOrEqual(1.5);
  });

  it('shows the forge only once it is added, with its coals glowing', () => {
    const forge = (state: GameState, timeMs = 0) => sceneVisuals(state, timeMs).find(visual => visual.id === 'forge')?.texture;
    expect(forge(camp())).toBeUndefined();
    const added = camp({ forge: true });
    expect(forge(added)).toMatch(/^forge:[ab]$/);
    expect(new Set([0, 200, 400, 600].map(time => forge(added, time))).size).toBe(2);
    expect(forge({ ...added, area: 'quarry' })).toBeUndefined();
  });
});

describe('horseshoes', () => {
  it('need the forge and a pony won over', () => {
    expect(upgradeBlocker(camp({}, { pony: won }), 'horseshoes')).toBe('Add a forge to the workshop first.');
    expect(upgradeBlocker(camp({ forge: true }), 'horseshoes')).toBe('You have no pony to shoe.');
  });

  it('stay out of the panel until they can be wanted', () => {
    expect(workshopView(camp({ forge: true })).rows.horseshoes.shown).toBe(false);
    expect(workshopView(camp({}, { pony: won })).rows.horseshoes.shown).toBe(false);
    expect(workshopView(camp({ forge: true }, { pony: won })).rows.horseshoes.shown).toBe(true);
  });

  it('cost 2 ore and 1 wood, from the bag and the forge', () => {
    const base = camp({ forge: true }, { pony: won, storedOre: 1 });
    const ready = { ...base, inventory: { ...base.inventory, ore: 1 } };
    const { state } = make(ready, 'horseshoes');
    expect(state.progress.workshop.horseshoes).toBe(true);
    expect([state.inventory.ore, state.storedOre]).toEqual([0, 0]);
    expect(state.inventory.wood).toBe(3);
    expect(saves(state)).toBe(true);
  });

  it('say when ore is short', () => {
    expect(make(camp({ forge: true }, { pony: won, storedOre: 1 }), 'horseshoes').message).toBe('Need 1 wood and 2 ore for the horseshoes.');
  });

  it('mark the pony shod today', () => {
    const { state, message } = make(camp({ forge: true }, { pony: won, storedOre: 2, day: 9 }), 'horseshoes');
    expect(state.pony.shod).toBe(9);
    expect(message).toBe('You made a set of horseshoes, and the pony stands for them. It can come with you now.');
  });

  it('are made once', () => {
    const { state } = make(camp({ forge: true }, { pony: won, storedOre: 4 }), 'horseshoes');
    expect(make(state, 'horseshoes').message).toBe('You already made the horseshoes.');
  });

  it('show their ore in the panel', () => {
    expect(workshopView(camp({ forge: true }, { pony: won })).rows.horseshoes.cost).toBe('1 wood · 2 ore');
  });
});

describe('the iron pickaxe', () => {
  const quarry = (changes: Partial<GameState['progress']['workshop']> = { forge: true, ironPickaxe: true }, inventory: Partial<GameState['inventory']> = {}): GameState => {
    const base = camp(changes);
    return { ...base, area: 'quarry', player: { ...base.player, x: QUARRY_SITE.x + 1, y: QUARRY_SITE.y }, inventory: { ...base.inventory, wood: 0, stone: 0, ...inventory } };
  };
  const dig = (state: GameState) => applyAction(state, { type: 'digQuarry' });

  it('needs the forge, the first pickaxe and 3 ore', () => {
    const base = camp({ forge: true }, { storedOre: 3 });
    expect(upgradeBlocker(camp({}, { storedOre: 3 }), 'ironPickaxe')).toBe('Add a forge to the workshop first.');
    expect(upgradeBlocker({ ...base, progress: { ...base.progress, pickaxeCrafted: false } }, 'ironPickaxe')).toBe('Craft a pickaxe first.');
    expect(upgradeBlocker(camp({ forge: true }, { storedOre: 2 }), 'ironPickaxe')).toBe('Need 1 wood and 3 ore for the iron pickaxe.');
    const { state, message } = make(base, 'ironPickaxe');
    expect(state.progress.workshop.ironPickaxe).toBe(true);
    expect(state.storedOre).toBe(0);
    expect(message).toBe('You made an iron pickaxe. The quarry face gives more for the work now.');
    expect(saves(state)).toBe(true);
  });

  it('digs two stones at the quarry face', () => {
    const { state, message } = dig(quarry());
    expect(state.inventory.stone).toBe(2);
    expect(message).toBe('Broke two good stones from the quarry face.');
  });

  it('digs one if there is only room for one', () => {
    const { state, message } = dig(quarry(undefined, { wood: 6 }));
    expect(state.inventory.stone).toBe(1);
    expect(state.quarryReadyDay).toBe(state.day + 1);
    expect(message).toBe('Broke a good stone from the quarry face.');
  });

  it('still refuses with no room for even one', () => {
    const start = quarry(undefined, { wood: 7 });
    const { state, message } = dig(start);
    expect(message).toBe(FULL_BAG_MESSAGE);
    expect(state.quarryReadyDay).toBe(start.quarryReadyDay);
  });

  it('gives two on the mine dig too, with the same daily limit', () => {
    let state = quarry();
    state = { ...state, progress: { ...state.progress, mineBuilt: true, packWoven: true } };
    state = dig(state).state;
    state = dig(state).state;
    expect(state.inventory.stone).toBe(4);
    const third = dig(state);
    expect(third.message).toBe('The quarry face is worked out until morning.');
    expect(third.state.inventory.stone).toBe(4);
  });

  it('still digs one with the first pickaxe', () => {
    const { state, message } = dig(quarry({}));
    expect(state.inventory.stone).toBe(1);
    expect(message).toBe('Broke a good stone from the quarry face.');
  });

  it('changes neither ore nor rubble', () => {
    const base = quarry();
    const ore = applyAction({ ...base, area: 'hills', player: { ...base.player, x: OUTCROP_SITE.x + 1, y: OUTCROP_SITE.y } }, { type: 'digOre' }).state;
    expect(ore.inventory.ore).toBe(1);
    const rubble = applyAction({ ...base, player: { ...base.player, x: RUBBLE_SITE.x, y: RUBBLE_SITE.y } }, { type: 'gatherRubble' }).state;
    expect(rubble.inventory.stone).toBe(1);
  });
});

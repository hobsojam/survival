import { describe, expect, it } from 'vitest';
import { BALANCE, BUILDINGS, PACK, createGame, type GameState } from '../src/game/state';
import { TOO_TIRED_MESSAGE } from '../src/game/needs';
import { applyAction, bagCapacity, packBlocker } from '../src/game/rules';
import { loadGame, SAVE_KEY } from '../src/game/save';
import { bagView } from '../src/ui/panels';
import { CAMP_STRUCTURES } from '../src/scene/visuals';
import { sprites } from '../src/art/sprites';
import { selectSurvivorVisual, type Facing, type SurvivorAction, type SurvivorVisualState } from '../src/scene/survivorVisual';

const { campX, campY } = BALANCE;

/** A camp with the toolshed built, standing at the fire, with the given supplies in the bag. */
function shed(wood = 2, fiber = 4, changes: Partial<GameState> = {}): GameState {
  const base = createGame();
  return {
    ...base,
    structures: { ...base.structures, shelter: true, toolshed: true },
    inventory: { ...base.inventory, wood, fiber },
    player: { ...base.player, x: campX, y: campY },
    ...changes
  };
}
const packed = (state: GameState): GameState => ({ ...state, progress: { ...state.progress, packWoven: true } });

describe('the woven pack', () => {
  it('costs 2 wood and 4 fiber, and starts unmade', () => {
    expect(PACK).toEqual({ cost: { wood: 2, fiber: 4, stone: 0 } });
    expect(createGame().progress.packWoven).toBe(false);
    expect(BALANCE.packCapacity).toBe(16);
  });

  it('says why it can\'t be made, in order', () => {
    expect(packBlocker(packed({ ...shed(), structures: createGame().structures, player: { ...shed().player, x: 0, y: 0 } }))).toBe('You already have a woven pack.');
    expect(packBlocker({ ...shed(0, 0), structures: createGame().structures, player: { ...shed().player, x: 0, y: 0 } })).toBe('Build a toolshed first.');
    expect(packBlocker(shed(0, 0, { player: { ...createGame().player, x: 0, y: 0, energy: 5 } }))).toBe('Return to camp to weave the pack.');
    expect(packBlocker(shed(0, 0, { player: { ...shed().player, energy: 5 } }))).toBe(TOO_TIRED_MESSAGE);
    expect(packBlocker(shed(1, 4))).toBe('Need 2 wood and 4 fiber for the pack.');
    expect(packBlocker(shed(2, 3))).toBe('Need 2 wood and 4 fiber for the pack.');
    expect(packBlocker(shed())).toBeNull();
  });

  it('counts the woodpile and the fibre stack', () => {
    const state = shed(0, 0, { storedWood: 2, storedFiber: 4 });
    const stores = { ...state, structures: { ...state.structures, woodpile: true, fibreStack: true } };
    expect(packBlocker(stores)).toBeNull();
    const made = applyAction(stores, { type: 'craftPack' }).state;
    expect(made.progress.packWoven).toBe(true);
    expect(made).toMatchObject({ storedWood: 0, storedFiber: 0, inventory: { wood: 0, fiber: 0 } });
  });

  it('is woven at the toolshed with build time and energy, without the axe or the cold night', () => {
    const state = shed();
    expect(state.progress).toMatchObject({ axeCrafted: false, hearthUnlocked: false });
    const made = applyAction(state, { type: 'craftPack' });
    expect(made.message).toBe('You wove a pack. There\'s room for twice as much now.');
    expect(made.state.progress.packWoven).toBe(true);
    expect(made.state.inventory).toMatchObject({ wood: 0, fiber: 0 });
    expect(made.state.timeOfDay).toBe(BALANCE.buildSeconds);
    expect(made.state.player.energy).toBe(state.player.energy - BALANCE.buildEnergyCost);
    expect(packBlocker(made.state)).toBe('You already have a woven pack.');
    expect(applyAction(made.state, { type: 'craftPack' }).state).toBe(made.state);
  });

  it('carries 16 instead of 8', () => {
    expect(bagCapacity(shed())).toBe(8);
    expect(bagCapacity(packed(shed()))).toBe(16);
  });
});

describe('no storage crate', () => {
  it('is gone from the buildings, the camp and the sprites', () => {
    expect('crate' in BUILDINGS).toBe(false);
    expect(CAMP_STRUCTURES.some(([id]) => (id as string) === 'crate')).toBe(false);
    expect(sprites.crate).toBeUndefined();
    expect(sprites.crateSite).toBeUndefined();
  });
});

describe('the bag line', () => {
  it('names the pack once woven, and hints at it before', () => {
    expect(bagView(packed(shed(2, 4))).spaces).toBe('6/16');
    expect(bagView(packed(shed(2, 4))).spacesLabel).toBe('Carried · woven pack');
    expect(bagView(packed(shed(2, 4))).packHint).toBe('');
    expect(bagView(shed(2, 4)).spaces).toBe('6/8');
    expect(bagView(shed(2, 4)).spacesLabel).toBe('Carried');
    expect(bagView(shed(2, 4)).packHint).toBe('Weave a pack at the toolshed to carry 16.');
  });
});

describe('the survivor wearing the pack', () => {
  const survivor = sprites.survivor;
  const names = Object.keys(survivor.frames).filter(name => !name.endsWith('Pack'));

  it('leaves no floating pack rim beside the hungry arm', () => {
    for (const name of ['hungry0Pack', 'hungry1Pack']) {
      const rows = survivor.frames[name];
      expect(rows[13][13], name).not.toBe('q');
      expect(rows[13][14], name).not.toBe('q');
    }
  });

  it('has a same-sized Pack twin for every frame', () => {
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      const twin = survivor.frames[`${name}Pack`];
      expect(twin, name).toBeDefined();
      expect(twin.length, name).toBe(survivor.frames[name].length);
      twin.forEach((row, y) => expect(row.length, `${name} row ${y}`).toBe(survivor.frames[name][y].length));
      expect(twin.join(''), name).not.toBe(survivor.frames[name].join(''));
    }
  });

  it('only ever picks pack frames that exist once the pack is woven', () => {
    const facings: Facing[] = ['down', 'up', 'left', 'right'];
    const actions: (SurvivorAction | undefined)[] = [undefined, 'gather', 'rest', 'cook', 'stargaze'];
    const meters = [80, 10];
    for (const facing of facings) for (const moving of [false, true]) for (const kind of actions)
      for (const warmth of meters) for (const energy of meters) for (const hunger of meters) for (const nowMs of [0, 260, 510, 760, 1100]) {
        const state: SurvivorVisualState = { facing, moving, warmth, energy, hunger, nowMs, packed: true,
          action: kind ? { kind, startedAtMs: 0 } : undefined };
        const { texture } = selectSurvivorVisual(state);
        expect(texture).toMatch(/Pack$/);
        expect(survivor.frames[texture.replace('survivor:', '')], texture).toBeDefined();
        expect(selectSurvivorVisual({ ...state, packed: false }).texture).toBe(texture.replace(/Pack$/, ''));
      }
  });
});

describe('the woven pack in the save', () => {
  const load = (change: (state: GameState) => void): string => {
    const data = new Map<string, string>();
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); },
      removeItem: (key: string) => { data.delete(key); } } as unknown as Storage;
    const state = createGame();
    change(state);
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 22, state }));
    return loadGame(storage).kind;
  };
  const withShed = (state: GameState): void => { state.structures.shelter = true; state.structures.toolshed = true; };

  it('needs a boolean, and the toolshed', () => {
    expect(load(state => { withShed(state); state.progress.packWoven = true; })).toBe('loaded');
    expect(load(state => { state.progress.packWoven = true; })).toBe('invalid');
    expect(load(state => { (state.progress as any).packWoven = 'yes'; })).toBe('invalid');
    expect(load(state => { delete (state.progress as any).packWoven; })).toBe('invalid');
  });

  it('refuses a save with a crate in it', () => {
    expect(load(state => { (state.structures as any).crate = false; })).toBe('invalid');
    expect(load(state => { (state.structures as any).crate = true; })).toBe('invalid');
  });

  it('loads 12 spaces with the pack, and not without', () => {
    expect(load(state => { withShed(state); state.progress.packWoven = true; state.inventory.wood = 12; })).toBe('loaded');
    expect(load(state => { withShed(state); state.inventory.wood = 12; })).toBe('invalid');
  });
});

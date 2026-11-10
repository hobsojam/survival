import { describe, expect, it } from 'vitest';
import { HILLS_BRIDGE_EXIT, MEADOW_ENTRY } from '../src/game/areas';
import { duskLength, nightStart } from '../src/game/calendar';
import { NEEDS } from '../src/game/castle';
import { CART_SPOTS, GOODS, goodRoom } from '../src/game/castleSites';
import { PLOT_DAYS, houseOpen } from '../src/game/houseOpen';
import { CARTER_STONE, JOBS, JOB_ORDER, JOINER_WOOD_RESERVE, jobsDawn, openJobs } from '../src/game/jobs';
import { applyAction } from '../src/game/rules';
import { saveGame } from '../src/game/save';
import { BALANCE, type GameState } from '../src/game/state';
import { CAMP_BOTH_OPEN_PATHS, pathDistance } from '../src/scene/mapGeometry';
import { CAMP_STRUCTURES } from '../src/scene/visuals';
import { TOWN_NAMES, type JobId, type Person } from '../src/game/town';
import { HOUSE_PLOTS } from '../src/game/townSites';
import { personSpot } from '../src/game/townsfolk';
import { finishedCastleCamp, street } from './townStreet';

// EASTER EGG: the town, see src/game/town.ts. The meadow's three houses, and the carter and the joiner who fill them.

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
}

const built = (doneDay: number) => ({ stone: 30, beams: 4, fittings: 1, doneDay });
const BRIDGE = { stone: 50, beams: 4, fittings: 2, doneDays: { piers: 40, arch: 45, parapet: 50 } };
const HELD: JobId[] = ['hens', 'honey', 'loaves', 'wood', 'beds', 'field', 'sheep', 'orchard', 'breadStall', 'honeyStall', 'woolStall', 'appleStall', 'eggStall'];

/** All twelve hills houses finished and lived in, the bridge finished or not, with the given jobs held (the first twelve housed). */
const town = (jobs: JobId[], bridgeDone = true, change: (state: GameState) => void = () => {}): GameState => {
  const state = finishedCastleCamp();
  state.day = 70;
  state.structures.woodpile = true;
  const people: Person[] = jobs.map((job, index) => ({ name: TOWN_NAMES[index], job, house: index < 12 ? index : null, arrivedDay: 10 + index }));
  state.town = { ...state.town, namesUsed: people.length, people,
    houses: street(...Array.from({ length: 12 }, (_, i) => built(20 + i * 2))),
    ...(bridgeDone ? { bridge: { ...BRIDGE, doneDays: { ...BRIDGE.doneDays } } } : {}) };
  change(state);
  return state;
};
const dawn = (state: GameState): GameState => {
  const next = structuredClone(state);
  jobsDawn(next);
  return next;
};

describe('the meadow\'s plots', () => {
  it('stay shut until the bridge is finished, then open a few days after the last hills house', () => {
    const waiting = HELD.slice(0, 12);
    expect(houseOpen(town(waiting, false, state => { state.town.square.doneDays = {}; }), 12)).toBe(false);
    const someone = [...HELD.slice(0, 12), 'breadStall' as JobId];
    expect(houseOpen(town(someone, false), 12)).toBe(false);
    expect(houseOpen(town(someone), 12)).toBe(true);
    expect(houseOpen(town(someone, true, state => { state.day = state.town.houses[11].doneDay! + PLOT_DAYS - 1; }), 12)).toBe(false);
  });

  it('are built from stone carried over in the bag, not from the cart left on the hills', () => {
    const state = town([...HELD.slice(0, 12), 'breadStall'], true, state => {
      state.area = 'meadow';
      state.progress.meadowFound = true;
      state.player = { ...state.player, ...HOUSE_PLOTS[12], energy: 100 };
      state.castle.cart = { ...state.castle.cart, at: 'hills', stone: 20 };
      state.inventory.stone = 0;
    });
    expect(applyAction(state, { type: 'townWork', plot: 12 }).message).toBe('Bring stone up from the quarry.');
    const carried = applyAction({ ...state, inventory: { ...state.inventory, stone: 2 } }, { type: 'townWork', plot: 12 }).state;
    expect(carried.castle.cart.stone).toBe(20);
    expect(carried.inventory.stone).toBe(1);
  });
});

describe('the carter and the joiner', () => {
  it('are offered once every camp job and stall is held and the bridge is finished, after everything else', () => {
    expect(JOB_ORDER).toEqual([...HELD, 'carter', 'joiner']);
    expect(openJobs(town(HELD))).toEqual(['carter', 'joiner']);
    expect(openJobs(town(HELD, false))).toEqual([]);
    expect(JOBS.carter.offer).toBe('drive the stone cart');
    expect(JOBS.joiner.offer).toBe('make beams at the workshop');
    expect(JOBS.carter.spot).toEqual({ area: 'quarry', x: CART_SPOTS.quarry.x, y: CART_SPOTS.quarry.y + 1 });
    expect(JOBS.joiner.spot.area).toBe('camp');
  });

  it('puts the joiner by the workshop, clear of the camp\'s buildings, its paths and the other workers', () => {
    const spot = JOBS.joiner.spot;
    const camp = { x: BALANCE.campX, y: BALANCE.campY };
    const workshop = CAMP_STRUCTURES.find(([id]) => id === 'workshop')!;
    expect(Math.hypot(spot.x - (camp.x + workshop[1]), spot.y - (camp.y + workshop[2]))).toBeLessThanOrEqual(2.5);
    for (const [id, dx, dy] of CAMP_STRUCTURES) expect(Math.hypot(spot.x - (camp.x + dx), spot.y - (camp.y + dy)), id).toBeGreaterThanOrEqual(1.5);
    for (const [route, routes] of [['camp', CAMP_BOTH_OPEN_PATHS]] as const) expect(pathDistance(spot.x + 0.5, spot.y + 0.5, routes), route).toBeGreaterThanOrEqual(1);
    for (const job of JOB_ORDER.filter(each => each !== 'joiner' && JOBS[each].spot.area === 'camp')) {
      expect(Math.hypot(spot.x - JOBS[job].spot.x, spot.y - JOBS[job].spot.y), job).toBeGreaterThanOrEqual(1.5);
    }
  });

  it('wait while a camp job is free', () => {
    const state = town(HELD.filter(job => job !== 'wood'));
    expect(openJobs(state)).toEqual(['wood']);
  });

  it('has the carter bring four stone to the cart each dawn, never past its load', () => {
    expect(CARTER_STONE).toBe(4);
    const carting = town([...HELD, 'carter'], true, state => { state.castle.cart = { ...state.castle.cart, stone: 10 }; });
    expect(dawn(carting).castle.cart.stone).toBe(14);
    const full = town([...HELD, 'carter'], true, state => { state.castle.cart = { ...state.castle.cart, stone: NEEDS.cartStone - 1 }; });
    expect(dawn(full).castle.cart.stone).toBe(NEEDS.cartStone);
  });

  it('has the joiner make a batch of beams from the wood store while the town wants them, keeping some wood back', () => {
    expect(JOINER_WOOD_RESERVE).toBe(10);
    // Someone waits in the hall for the first meadow house, which wants beams. No one brings in wood, so the store holds what it is given.
    const joining = (wood: number, change: (state: GameState) => void = () => {}) => town([...HELD.filter(job => job !== 'wood'), 'joiner'], true, state => {
      state.storedWood = wood;
      state.castle.goods = { beams: 0, fittings: 0, hangings: 0 };
      change(state);
    });
    expect(goodRoom(joining(18), 'beams')).toBeGreaterThan(0);
    const made = dawn(joining(18));
    expect(made.castle.goods.beams).toBe(GOODS.beams.batch);
    expect(made.storedWood).toBe(18 - GOODS.beams.cost.wood);
    expect(dawn(joining(17)).castle.goods.beams).toBe(0);
    const enough = joining(30, state => { state.castle.goods.beams = goodRoom(state, 'beams'); });
    expect(goodRoom(enough, 'beams')).toBe(0);
    expect(dawn(enough).storedWood).toBe(30);
  });

  it('can\'t be held in a save before the bridge is finished', () => {
    expect(saveGame(new MemoryStorage(), town([...HELD.slice(0, 12), 'carter'], false)).ok).toBe(false);
    expect(saveGame(new MemoryStorage(), town([...HELD.slice(0, 12), 'carter'])).ok).toBe(true);
  });
});

describe('walking home to the meadow', () => {
  const dusk = (state: GameState) => nightStart(state.day) - duskLength(state.day);
  const housed = (job: JobId, at: number) => town([...HELD.slice(0, 12), job], true, state => {
    state.town.houses[12] = built(60);
    state.town.people[12].house = 12;
    state.timeOfDay = dusk(state) + at * duskLength(state.day);
  });

  it('crosses the hills to the bridge, then walks down the meadow to their door', () => {
    const plot = HOUSE_PLOTS[12];
    for (const job of ['carter', 'breadStall'] as const) {
      const late = personSpot(housed(job, 0.95), 12)!;
      expect(late.area).toBe('meadow');
      expect(Math.hypot(late.x - plot.x, late.y - plot.y)).toBeLessThan(Math.hypot(MEADOW_ENTRY.x - plot.x, MEADOW_ENTRY.y - plot.y));
    }
    // From the quarry it is three stretches: out of the quarry, across the hills, down the meadow. From the square, two.
    expect(personSpot(housed('carter', 0.6), 12)!.area).toBe('hills');
    expect(personSpot(housed('breadStall', 0.4), 12)!.area).toBe('hills');
    const start = personSpot(housed('carter', 0.01), 12)!;
    expect(start.area).toBe('quarry');
    const atBridge = personSpot(housed('breadStall', 0.49), 12)!;
    expect(Math.hypot(atBridge.x - HILLS_BRIDGE_EXIT.x, atBridge.y - HILLS_BRIDGE_EXIT.y)).toBeLessThan(2);
  });
});

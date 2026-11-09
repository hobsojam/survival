import { describe, expect, it } from 'vitest';
import { goodRoom } from '../src/game/castleSites';
import { goodCopy } from '../src/ui/panels';
import { emptyBridge, type BridgeState } from '../src/game/bridge';
import { BRIDGE_SITE, bridgeSpot, bridgeWorkBlocker } from '../src/game/bridgeSites';
import { applyAction } from '../src/game/rules';
import { SQUARE_CENTRE } from '../src/game/squareSites';
import type { GameState } from '../src/game/state';
import { HOUSE_PLOTS } from '../src/game/townSites';
import { promptFor, useKeyAction } from '../src/scene/prompts';
import { pickTapTarget, targetAction } from '../src/scene/tapTarget';
import { finishedCastleCamp, street } from './townStreet';

// EASTER EGG: the town, see src/game/town.ts. Building the bridge over the stream, from the hills.

const built = (doneDay: number) => ({ stone: 30, beams: 4, fittings: 1, doneDay });

/** Eight houses finished, and the survivor rested at the bridge on the hills with stone and goods to hand. */
const atBridge = (bridge: Partial<BridgeState> = {}, change: (state: GameState) => void = () => {}): GameState => {
  const state = finishedCastleCamp();
  state.town = { ...state.town, houses: street(...Array.from({ length: 8 }, (_, i) => built(20 + i))), bridge: { ...emptyBridge(), ...bridge } };
  state.area = 'hills';
  state.inventory = { ...state.inventory, stone: 5 };
  state.castle.goods = { beams: 4, fittings: 1, hangings: 0 };
  state.player = { ...state.player, energy: 100, x: BRIDGE_SITE.x, y: BRIDGE_SITE.y - 0.6 };
  change(state);
  return state;
};
const work = (state: GameState) => applyAction(state, { type: 'bridgeWork' });

describe('where the bridge stands', () => {
  it('spans the stream on the hills\' south edge, clear of the house plots and the square', () => {
    expect(BRIDGE_SITE).toEqual({ x: 25, y: 28.6 });
    expect(Math.floor(BRIDGE_SITE.y + 0.5)).toBe(29);
    for (const plot of HOUSE_PLOTS.filter(each => each.area === 'hills')) expect(Math.hypot(plot.x - BRIDGE_SITE.x, plot.y - BRIDGE_SITE.y)).toBeGreaterThan(1.5);
    expect(Math.hypot(SQUARE_CENTRE.x - BRIDGE_SITE.x, SQUARE_CENTRE.y - BRIDGE_SITE.y)).toBeGreaterThan(1.5);
  });

  it('opens once the eighth house is finished, and shuts once the bridge is done', () => {
    expect(bridgeSpot(atBridge())).toEqual({ area: 'hills', ...BRIDGE_SITE });
    expect(bridgeSpot(atBridge({}, state => { state.town.houses = street(...Array.from({ length: 7 }, (_, i) => built(20 + i))); }))).toBeNull();
    expect(bridgeSpot(atBridge({ stone: 50, beams: 4, fittings: 2, doneDays: { piers: 30, arch: 31, parapet: 32 } }))).toBeNull();
  });

  it('gives the same work from the prompt, the E key and a tap', () => {
    const state = atBridge();
    expect(promptFor(state)).toContain('Lay a pier stone (0/24)');
    expect(useKeyAction(state)).toEqual({ type: 'bridgeWork' });
    expect(targetAction(pickTapTarget(state, BRIDGE_SITE.x, BRIDGE_SITE.y))).toEqual({ type: 'bridgeWork' });
  });
});

describe('building the bridge', () => {
  it('lays the piers stone by stone, and they stand on the day the last goes in', () => {
    expect(work(atBridge()).message).toBe('You lay another stone on the bridge.');
    const last = work(atBridge({ stone: 23 }));
    expect(last.message).toBe('The piers stand in the stream.');
    expect(last.state.town.bridge.doneDays.piers).toBe(last.state.day);
  });

  it('sets the arch\'s beams, then its stone', () => {
    const beams = atBridge({ stone: 24, doneDays: { piers: 30 } });
    expect(promptFor(beams)).toContain('Set an arch beam (0/4)');
    const set = work(beams);
    expect(set.state.town.bridge.beams).toBe(1);
    expect(set.state.castle.goods.beams).toBe(3);
    expect(promptFor(atBridge({ stone: 24, beams: 4, doneDays: { piers: 30 } }))).toContain('Lay an arch stone (0/16)');
    const closed = work(atBridge({ stone: 39, beams: 4, doneDays: { piers: 30 } }));
    expect(closed.message).toBe('The arch is closed. It holds.');
    expect(closed.state.town.bridge.doneDays.arch).toBe(closed.state.day);
  });

  it('lays the parapet\'s stone, then fits its cramps, and the far bank opens', () => {
    const arch = { beams: 4, doneDays: { piers: 30, arch: 31 } };
    expect(promptFor(atBridge({ stone: 40, ...arch }))).toContain('Lay a parapet stone (0/10)');
    expect(promptFor(atBridge({ stone: 50, ...arch }))).toContain('Fit an iron cramp (0/2)');
    const done = work(atBridge({ stone: 50, fittings: 1, ...arch }));
    expect(done.message).toBe('The bridge is finished. The far bank is open.');
    expect(done.state.castle.goods.fittings).toBe(0);
    expect(done.state.town.bridge.doneDays.parapet).toBe(done.state.day);
  });

  it('says what is missing, and refuses from too far away or before it is open', () => {
    const noStone = atBridge({}, state => { state.inventory.stone = 0; });
    expect(promptFor(noStone)).toContain('Bridge · bring stone up from the quarry');
    expect(work(noStone).message).toBe('Bring stone up from the quarry.');
    const noBeams = atBridge({ stone: 24, doneDays: { piers: 30 } }, state => { state.castle.goods.beams = 0; });
    expect(promptFor(noBeams)).toContain('Bridge · make beams at the workshop');
    expect(work(noBeams).message).toBe('Make beams at the workshop.');
    const noIron = atBridge({ stone: 50, beams: 4, doneDays: { piers: 30, arch: 31 } }, state => { state.castle.goods.fittings = 0; });
    expect(promptFor(noIron)).toContain('Bridge · make an iron fitting at the forge');
    const far = atBridge();
    expect(work({ ...far, player: { ...far.player, y: far.player.y - 4 } }).message).toBe('Move closer to the bridge.');
    expect(bridgeWorkBlocker(atBridge({}, state => { state.town.houses = street(); }))).toBe('There is nothing to build here yet.');
  });

  it('is too much for a survivor with no energy left', () => {
    expect(work(atBridge({}, state => { state.player.energy = 0; })).message).toMatch(/tired/i);
  });

  it('takes the cart\'s stone before the bag\'s', () => {
    const after = work(atBridge({}, state => { state.castle.cart = { ...state.castle.cart, at: 'hills', stone: 2 }; })).state;
    expect(after.castle.cart.stone).toBe(1);
    expect(after.inventory.stone).toBe(5);
  });
});

describe('the goods the bridge needs', () => {
  const none = (state: GameState) => { state.castle.goods = { beams: 0, fittings: 0, hangings: 0 }; };

  it('asks the workshop for the arch\'s beams and the forge for the parapet\'s cramps while the bridge is open', () => {
    const shut = atBridge({}, state => { none(state); state.town.houses = street(...Array.from({ length: 7 }, (_, i) => built(20 + i))); });
    const open = atBridge({}, none);
    expect(goodRoom(open, 'beams')).toBe(goodRoom(shut, 'beams') + 4);
    expect(goodRoom(open, 'fittings')).toBe(goodRoom(shut, 'fittings') + 2);
    expect(goodRoom(atBridge({ stone: 24, beams: 3, doneDays: { piers: 30 } }, none), 'beams')).toBe(goodRoom(shut, 'beams') + 1);
  });

  it('words the beams for the bridge too', () => {
    expect(goodCopy(atBridge(), 'beams')).toBe('Four at a time, cut and dressed for the town\'s houses, stalls and bridge.');
  });
});

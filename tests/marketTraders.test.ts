// EASTER EGG: the town, see src/game/town.ts. The traders who come over the bridge on market day, and the lens.
import { describe, expect, it } from 'vitest';
import { HILLS_BRIDGE_EXIT, MEADOW_ENTRY } from '../src/game/areas';
import { duskLength, nightStart } from '../src/game/calendar';
import { lensHandover } from '../src/game/lens';
import { MARKET_CROWD_SPOTS, SIGN_SPOT, TRADERS, TRADER_ARRIVE, TRADER_CART_SPOTS, traderSpot } from '../src/game/market';
import { applyAction } from '../src/game/rules';
import { STALL_JOBS } from '../src/game/square';
import { STALL_SPOTS, WELL_SPOT } from '../src/game/squareSites';
import { BALANCE, type GameState } from '../src/game/state';
import { HOUSE_PLOTS } from '../src/game/townSites';
import { personSpot } from '../src/game/townsfolk';
import { lineToSay } from '../src/scene/prompts';
import { sceneVisuals } from '../src/scene/visuals';
import { fullTown, opened } from './marketTown';

const away = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const on = (day: number, timeOfDay = 60, change: (state: GameState) => void = () => {}) =>
  opened(100, state => { state.day = day; state.timeOfDay = timeOfDay; state.area = 'hills'; change(state); });
const dusk = (day: number) => nightStart(day) - duskLength(day);

describe('the traders\' carts', () => {
  it('stand on the street east of the square, clear of the houses, the stalls, the well, the sign and the crowd', () => {
    for (const trader of TRADERS) {
      const spot = TRADER_CART_SPOTS[trader];
      for (const plot of HOUSE_PLOTS.filter(each => each.area === 'hills')) expect(away(spot, plot)).toBeGreaterThanOrEqual(1.5);
      for (const other of [...Object.values(STALL_SPOTS), WELL_SPOT, SIGN_SPOT, ...MARKET_CROWD_SPOTS]) expect(away(spot, other)).toBeGreaterThanOrEqual(1.5);
    }
  });
});

describe('where the traders are', () => {
  it('are nowhere off market days, at night, or before the square opens', () => {
    expect(traderSpot(on(101), 'glass')).toBeNull();
    expect(traderSpot(on(102, nightStart(102) + 1), 'glass')).toBeNull();
    expect(traderSpot(fullTown(state => { state.timeOfDay = 60; }), 'glass')).toBeNull();
  });

  it('come in along the meadow\'s road from its east edge, over the bridge and up to their carts', () => {
    expect(traderSpot(on(102, 0), 'glass')).toEqual({ area: 'meadow', x: BALANCE.mapWidth - 0.5, y: 18, walking: true });
    const inMeadow = traderSpot(on(102, TRADER_ARRIVE * 0.3), 'glass')!;
    expect(inMeadow.area).toBe('meadow');
    expect(inMeadow.y === 18 || inMeadow.x === MEADOW_ENTRY.x).toBe(true);
    const onHills = traderSpot(on(102, TRADER_ARRIVE * 0.8), 'glass')!;
    expect(onHills.area).toBe('hills');
    expect(onHills.y).toBeLessThanOrEqual(HILLS_BRIDGE_EXIT.y);
    expect(traderSpot(on(102, TRADER_ARRIVE + 20), 'glass')).toEqual({ area: 'hills', ...TRADER_CART_SPOTS.glass, y: TRADER_CART_SPOTS.glass.y + 1, walking: false });
    expect(traderSpot(on(102, dusk(102) - 1), 'spice')).toMatchObject({ walking: false });
  });

  it('go back the same way over the dusk', () => {
    const leaving = traderSpot(on(102, dusk(102) + duskLength(102) * 0.9), 'glass')!;
    expect(leaving).toMatchObject({ area: 'meadow', walking: true });
  });

  it('are drawn with their carts, wherever they are', () => {
    const drawn = (state: GameState) => sceneVisuals(state, 0).filter(visual => visual.id.startsWith('trader')).map(visual => visual.texture).sort();
    expect(drawn(on(102, TRADER_ARRIVE + 20))).toEqual(['traderCart:glass', 'traderCart:spice', 'traderglass:stand', 'traderspice:stand']);
    expect(drawn(on(103))).toEqual([]);
    expect(drawn(on(102, 0, state => { state.area = 'meadow'; }))).toContain('traderglass:walk0');
  });
});

describe('the lens', () => {
  const byTrader = (day: number, change: (state: GameState) => void = () => {}) => on(day, TRADER_ARRIVE + 20, state => {
    state.player = { ...state.player, x: TRADER_CART_SPOTS.glass.x, y: TRADER_CART_SPOTS.glass.y + 1.5 };
    change(state);
  });

  it('is handed over by the glass trader on the first market day', () => {
    const given = lensHandover(byTrader(102));
    expect(given.state.town.market.lensDay).toBe(102);
    expect(given.message).toBe('A trader from beyond the hills hands you a glass lens. No one here could have made it.');
    expect(lensHandover(given.state).message).toBe('');
    expect(lensHandover(byTrader(107)).state.town.market.lensDay).toBeNull();
    expect(lensHandover(byTrader(102, state => { state.player = { ...state.player, x: 30, y: 10 }; })).state.town.market.lensDay).toBeNull();
  });

  it('is left with a stallholder for a survivor who missed the first market, and given the next time they pass', () => {
    const atStall = (day: number, timeOfDay = 60) => on(day, timeOfDay, state => { state.player = { ...state.player, x: STALL_SPOTS.bread.x, y: STALL_SPOTS.bread.y + 1.5 }; });
    const given = lensHandover(atStall(104));
    const keeper = given.state.town.people.find(person => person.job === STALL_JOBS.bread)!.name;
    expect(given.state.town.market.lensDay).toBe(104);
    expect(given.message).toBe(`${keeper} hands you a glass lens a trader left for you.`);
    expect(lensHandover(atStall(101)).state.town.market.lensDay).toBeNull();
    expect(lensHandover(atStall(104, nightStart(104) + 1)).state.town.market.lensDay).toBeNull();
    const already = atStall(104, 60);
    already.town.market.lensDay = 102;
    expect(lensHandover(already).message).toBe('');
    expect(personSpot(atStall(104), already.town.people.findIndex(person => person.name === keeper))).toMatchObject({ walking: false });
  });

  it('is said aloud when a step brings the survivor to it', () => {
    const before = byTrader(102, state => { state.player = { ...state.player, y: state.player.y + 0.2 }; });
    const after = applyAction(before, { type: 'move', dx: 0, dy: -0.2 });
    expect(after.state.town.market.lensDay).toBe(102);
    expect(after.message).toContain('glass lens');
    expect(lineToSay(before, after.state, after.message, false)).toContain('glass lens');
    expect(lineToSay(before, before, 'a step', false)).toBe('');
  });
});

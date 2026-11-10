// EASTER EGG: the town, see src/game/town.ts. The market sign, and the traders and their carts, as drawn.
import { describe, expect, it } from 'vitest';
import { marketSprites } from '../src/art/marketSprites';
import { sprites } from '../src/art/sprites';
import { SIGN_SPOT } from '../src/game/market';
import { STALL_SPOTS, WELL_SPOT } from '../src/game/squareSites';
import { sceneVisuals } from '../src/scene/visuals';
import { fullTown } from './marketTown';

const away = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('the market sign', () => {
  it('has a painted face for the eve and another for the day, in summer and under snow', () => {
    const sign = marketSprites.marketSign;
    expect(sprites.marketSign).toBe(sign);
    expect(Object.keys(sign.frames).sort()).toEqual(['day', 'days', 'eve', 'eves']);
    expect(sign.size[0]).toBeLessThanOrEqual(16);
    expect(sign.size[1]).toBeLessThanOrEqual(20);
    expect(sign.frames.eve).not.toEqual(sign.frames.day);
    expect(sign.frames.eve).not.toEqual(sign.frames.eves);
  });

  it('stands by the well, clear of it and of every stall', () => {
    expect(away(SIGN_SPOT, WELL_SPOT)).toBeGreaterThanOrEqual(1);
    for (const spot of Object.values(STALL_SPOTS)) expect(away(SIGN_SPOT, spot)).toBeGreaterThanOrEqual(1);
  });

  it('is drawn on the eve and the day of a market, and not otherwise', () => {
    const sign = (day: number) => sceneVisuals(fullTown(state => { state.area = 'hills'; state.day = day; state.town.market.openDay = 100; }), 0)
      .find(visual => visual.id === 'market-sign')?.texture;
    expect([100, 101, 102, 103].map(sign)).toEqual([undefined, 'marketSign:eve', 'marketSign:day', undefined]);
    expect(sign(111)).toBe('marketSign:eve');
  });
});

describe('the traders and their carts', () => {
  it('has a trader for each cart, standing and walking, and two carts that differ', () => {
    for (const trader of ['glass', 'spice']) {
      expect(Object.keys(sprites[`trader${trader}`].frames).sort()).toEqual(['stand', 'walk0', 'walk1']);
    }
    expect(Object.keys(sprites.traderCart.frames).sort()).toEqual(['glass', 'spice']);
    expect(sprites.traderCart.frames.glass).not.toEqual(sprites.traderCart.frames.spice);
    expect(sprites.traderglass.legend).not.toEqual(sprites.traderspice.legend);
  });
});

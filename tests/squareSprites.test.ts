import { describe, expect, it } from 'vitest';
import { squareSprites } from '../src/art/squareSprites';
import { sprites } from '../src/art/sprites';
import { townSprites } from '../src/art/townSprites';
import { STALL_IDS } from '../src/game/square';
import { STALL_SPOTS, WELL_SPOT } from '../src/game/squareSites';
import type { GameState } from '../src/game/state';
import { HOUSE_PLOTS } from '../src/game/townSites';
import { sceneVisuals } from '../src/scene/visuals';
import { finishedCastleCamp, street } from './townStreet';

// EASTER EGG: the town, see src/game/town.ts. The square as it is drawn.

const built = (doneDay: number) => ({ stone: 30, beams: 4, fittings: 1, doneDay });
/** A finished castle on a summer day on the hills, with the given houses finished and the square changed as given. */
const hills = (houses: number, change: (state: GameState) => void = () => {}): GameState => {
  const state = finishedCastleCamp();
  state.area = 'hills';
  state.day = 75;
  state.town.houses = street(...Array.from({ length: houses }, (_, i) => built(20 + i)));
  change(state);
  return state;
};
const squareVisuals = (state: GameState) => Object.fromEntries(sceneVisuals(state, 0).filter(visual => visual.id.startsWith('square-')).map(visual => [visual.id, visual.texture]));
const paved = (state: GameState) => { state.town.square.paving = 40; state.town.square.doneDays = { paving: 45 }; };

describe('drawing the square', () => {
  it('draws nothing before the square is marked out, then its marked ground', () => {
    expect(squareVisuals(hills(1))).toEqual({});
    expect(squareVisuals(hills(2))).toEqual({ 'square-ground': 'squareGround:marked' });
    expect(squareVisuals({ ...hills(2), area: 'camp' })).toEqual({});
  });

  it('lays the paving a quarter at a time', () => {
    const half = squareVisuals(hills(2, state => { state.town.square.paving = 15; }));
    expect(half).toMatchObject({ 'square-paving-0': 'squarePaving:done', 'square-paving-1': 'squarePaving:half' });
    expect(half['square-paving-2']).toBeUndefined();
  });

  it('raises the well and the stalls through their stages, with stock on the counter', () => {
    const state = hills(2, state => {
      paved(state);
      state.town.square.well = { stone: 5, fittings: 0 };
      state.town.square.stalls.bread = { beams: 1, hangings: 0 };
      state.town.square.stalls.honey = { beams: 2, hangings: 1 };
      state.town.square.stalls.wool = { beams: 2, hangings: 1 };
      state.town.square.stalls.eggs = { beams: 2, hangings: 1 };
      state.town.square.stock = { bread: 0, honey: 0, wool: 3, apples: 0, eggs: 9 };
    });
    expect(squareVisuals(state)).toMatchObject({
      'square-well': 'townWell:low', 'square-stall-bread': 'townStall:frame', 'square-stall-honey': 'townStall:honey',
      'square-stall-wool': 'townStall:wool-some', 'square-stall-eggs': 'townStall:eggs-full'
    });
    expect(squareVisuals(state)['square-stall-apples']).toBeUndefined();
    const walls = hills(2, state => { paved(state); state.town.square.well = { stone: 12, fittings: 0 }; });
    expect(squareVisuals(walls)['square-well']).toBe('townWell:walls');
    const done = hills(2, state => { paved(state); state.town.square.well = { stone: 12, fittings: 1 }; });
    expect(squareVisuals(done)['square-well']).toBe('townWell:done');
    const winter = hills(2, state => { paved(state); state.day = 53; state.town.square.well = { stone: 12, fittings: 1 }; });
    expect(squareVisuals(winter)['square-well']).toBe('townWell:dones');
  });

  it('has every frame it draws, at its size, and registered with the rest', () => {
    expect(squareSprites.squareGround.size).toEqual([96, 80]);
    expect(squareSprites.squarePaving.size).toEqual([48, 40]);
    expect(squareSprites.townWell.size).toEqual([24, 28]);
    expect(squareSprites.townStall.size).toEqual([24, 26]);
    for (const frame of ['frame', ...STALL_IDS.flatMap(id => [id, `${id}-some`, `${id}-full`])]) {
      expect(squareSprites.townStall.frames).toHaveProperty(frame);
      expect(squareSprites.townStall.frames).toHaveProperty(`${frame}s`);
    }
    for (const frame of ['low', 'walls', 'done', 'lows', 'wallss', 'dones']) expect(squareSprites.townWell.frames).toHaveProperty(frame);
    expect(sprites.townStall).toBe(squareSprites.townStall);
  });

  it('gives each stall its own awning', () => {
    const awning = (id: string) => squareSprites.townStall.frames[id][1];
    expect(new Set(STALL_IDS.map(awning)).size).toBe(STALL_IDS.length);
  });

  it('keeps the well and the stalls off each other and off the houses', () => {
    const box = (spot: { x: number; y: number }, def: { anchor: number[]; size: number[] }) => {
      const left = Math.round((spot.x + 0.5) * 16) - def.anchor[0];
      const top = Math.round((spot.y + 0.5) * 16) - def.anchor[1];
      return { left, top, right: left + def.size[0], bottom: top + def.size[1] };
    };
    const overlap = (a: ReturnType<typeof box>, b: ReturnType<typeof box>) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const pieces = [box(WELL_SPOT, squareSprites.townWell), ...STALL_IDS.map(id => box(STALL_SPOTS[id], squareSprites.townStall))];
    pieces.forEach((a, i) => pieces.forEach((b, j) => { if (i < j) expect(overlap(a, b), `${i} ${j}`).toBe(false); }));
    for (const piece of pieces) for (const plot of HOUSE_PLOTS) expect(overlap(piece, box(plot, townSprites.townHouse))).toBe(false);
  });
});

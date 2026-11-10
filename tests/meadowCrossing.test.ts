import { describe, expect, it } from 'vitest';
import { nightStart } from '../src/game/calendar';
import { HILLS_BRIDGE_EXIT, MEADOW_ENTRY, crossing } from '../src/game/areas';
import { MEADOW_FOUND_MESSAGE } from '../src/game/meadow';
import { ponyWith } from '../src/game/pony';
import { applyAction, sleepBlocker } from '../src/game/rules';
import { loadGame, saveGame } from '../src/game/save';
import type { GameState } from '../src/game/state';
import { buildMap, terrainKey } from '../src/scene/map';
import { HILLS_BRIDGE_PATHS, MEADOW_PATHS, pathDistance } from '../src/scene/mapGeometry';
import { promptFor, useKeyAction } from '../src/scene/prompts';
import { pickTapTarget, targetAction } from '../src/scene/tapTarget';
import { sceneVisuals } from '../src/scene/visuals';
import { finishedCastleCamp, street } from './townStreet';

// EASTER EGG: the town, see src/game/town.ts. Over the finished bridge to the meadow, and back.

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
const DONE = { stone: 50, beams: 4, fittings: 2, doneDays: { piers: 40, arch: 45, parapet: 50 } };

/** Eight houses, the bridge finished or not, and the survivor on the hills at the given spot. */
const onHills = (x: number, y: number, bridgeDone = true): GameState => {
  const state = finishedCastleCamp();
  state.town = { ...state.town, houses: street(...Array.from({ length: 8 }, (_, i) => built(20 + i))) };
  if (bridgeDone) state.town.bridge = { ...DONE, doneDays: { ...DONE.doneDays } };
  state.area = 'hills';
  state.player = { ...state.player, x, y, energy: 100 };
  return state;
};
const south = { type: 'move', dx: 0, dy: 1 } as const;
const north = { type: 'move', dx: 0, dy: -1 } as const;

describe('crossing the bridge', () => {
  it('goes nowhere before the bridge is finished', () => {
    const state = onHills(25, 28.6, false);
    expect(crossing(state, 25, 30)).toBeNull();
    const after = applyAction(state, south).state;
    expect(after.area).toBe('hills');
  });

  it('comes out in the meadow, found once, and goes back up onto the hills', () => {
    expect(MEADOW_ENTRY).toEqual({ x: 25, y: 0.5 });
    expect(HILLS_BRIDGE_EXIT).toEqual({ x: 25, y: 29 });
    const first = applyAction(onHills(25, 28.9), south);
    expect(first.state.area).toBe('meadow');
    expect(first.state.player).toMatchObject({ x: 25, y: 0.5 });
    expect(first.state.progress.meadowFound).toBe(true);
    expect(first.message).toContain(MEADOW_FOUND_MESSAGE);
    const again = applyAction({ ...first.state, area: 'hills', player: { ...first.state.player, x: 25, y: 28.9 } }, south);
    expect(again.message).not.toContain(MEADOW_FOUND_MESSAGE);
    const back = applyAction({ ...first.state, player: { ...first.state.player, y: 0.2 } }, north).state;
    expect(back.area).toBe('hills');
    expect(back.player).toMatchObject({ x: 25, y: 28.5 });
  });

  it('crosses only on the bridge, not anywhere along the stream', () => {
    expect(crossing(onHills(30, 28.9), 30, 30)).toBeNull();
    expect(crossing(onHills(26, 28.9), 26, 30)).toEqual({ area: 'meadow', x: 26, y: 0.5 });
    const meadow = { ...onHills(30, 0.2), area: 'meadow' as const };
    expect(crossing(meadow, 30, -0.5)).toBeNull();
    expect(crossing(meadow, 40, 15)).toBeNull();
    expect(crossing(meadow, -1, 15)).toBeNull();
  });

  it('keeps the survivor out of the stream off the bridge, with their feet on the bank', () => {
    const after = applyAction(onHills(30, 27.6), south).state;
    expect(after.area).toBe('hills');
    // Feet stand half a tile below the middle; the water starts halfway down row 28.
    expect(after.player.y + 0.5).toBeLessThanOrEqual(28.5);
  });

  it('never jerks a survivor already standing lower, from an older save, up the bank', () => {
    const low = onHills(30, 29);
    const east = applyAction(low, { type: 'move', dx: 0.5, dy: 0 }).state;
    expect(east.player.y).toBe(29);
    expect(applyAction(low, south).state.player.y).toBe(29);
    expect(applyAction(low, north).state.player.y).toBeLessThan(29);
  });

  it('crosses with the cross key at the bridge\'s end, both ways', () => {
    const over = applyAction(onHills(HILLS_BRIDGE_EXIT.x, HILLS_BRIDGE_EXIT.y - 0.3), { type: 'cross' }).state;
    expect(over.area).toBe('meadow');
    const back = applyAction({ ...over, player: { ...over.player, ...MEADOW_ENTRY } }, { type: 'cross' }).state;
    expect(back.area).toBe('hills');
  });

  it('leaves the pony on the hills', () => {
    const state = { ...onHills(25, 1), area: 'meadow' as const };
    state.pony = { ...state.pony, won: 3, shod: 4, home: true };
    expect(ponyWith(state)).toBe(false);
  });

  it('saves and loads a survivor in the meadow', () => {
    const state = { ...onHills(25, 5), area: 'meadow' as const };
    state.progress = { ...state.progress, meadowFound: true };
    const storage = new MemoryStorage();
    expect(saveGame(storage, state).ok).toBe(true);
    const loaded = loadGame(storage);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind === 'loaded') expect(loaded.state.area).toBe('meadow');
  });

  it('sends the survivor back over the bridge to sleep', () => {
    const state = { ...onHills(25, 5), area: 'meadow' as const };
    state.timeOfDay = nightStart(state.day) + 1;
    expect(sleepBlocker(state)).toBe('Cross back to the hills to sleep.');
  });
});

describe('in the meadow', () => {
  const meadow = (x: number, y: number) => ({ ...onHills(x, y), area: 'meadow' as const });

  it('offers nothing of the camp\'s: no fire, no rest, no camp sites', () => {
    const state = meadow(20, 20);
    expect(useKeyAction(state)).toBeUndefined();
    expect(promptFor(state)).toBe('WASD / arrows  Move');
    expect(sceneVisuals(state, 0).some(visual => /fire|shelter|lookout/i.test(visual.texture))).toBe(false);
    expect(pickTapTarget(state, 20, 15).kind).toBe('ground');
  });

  it('points the way back over the bridge, and a tap there crosses', () => {
    const state = meadow(MEADOW_ENTRY.x, MEADOW_ENTRY.y);
    expect(promptFor(state)).toBe('Walk north to cross back over the bridge');
    expect(targetAction(pickTapTarget(state, MEADOW_ENTRY.x, MEADOW_ENTRY.y))).toEqual({ type: 'cross' });
  });

  it('points the way over from the hills once the bridge is finished', () => {
    const state = onHills(HILLS_BRIDGE_EXIT.x, HILLS_BRIDGE_EXIT.y - 0.3);
    expect(promptFor(state)).toBe('Walk south to cross the bridge');
    expect(targetAction(pickTapTarget(state, HILLS_BRIDGE_EXIT.x, HILLS_BRIDGE_EXIT.y))).toEqual({ type: 'cross' });
    expect(pickTapTarget(onHills(HILLS_BRIDGE_EXIT.x, 20, false), HILLS_BRIDGE_EXIT.x, HILLS_BRIDGE_EXIT.y).kind).not.toBe('crossing');
  });
});

describe('the meadow\'s ground', () => {
  it('has its own terrain, with a lane from the bridge down to the old road kept clear', () => {
    const state = { ...onHills(25, 5), area: 'meadow' as const };
    expect(terrainKey(state)).toBe('meadow');
    expect(MEADOW_PATHS[0]).toEqual([25, 0, 25, 18]);
    for (const time of ['spring', 'summer', 'autumn', 'winter'] as const) {
      const map = buildMap([], 'meadow', time);
      expect(map.ground).toHaveLength(30);
      for (const item of [...map.decorations, ...map.trees]) expect(pathDistance(item.x + 0.5, item.y + 0.5, [MEADOW_PATHS[0]]), item.sprite).toBeGreaterThanOrEqual(1.2);
    }
  });

  it('runs the stream along the hills\' last row, with a lane down to the bridge once it is begun', () => {
    for (const time of ['summer', 'winter'] as const) {
      const map = buildMap([], 'hills', time);
      expect(map.ground[28].every(tile => tile.startsWith(time === 'winter' ? 'streamIceBank' : 'streamBank'))).toBe(true);
      expect(map.ground[29].every(tile => /^stream(Ice)?\d$/.test(tile))).toBe(true);
      expect(map.decorations.some(item => item.y + 0.5 > 28)).toBe(false);
    }
    expect(terrainKey(onHills(25, 20, false))).toBe('hills-bridge');
    expect(HILLS_BRIDGE_PATHS.at(-1)).toEqual([25, 23, 25, 29]);
    const lane = buildMap([], 'hills-bridge', 'summer');
    expect(lane.pathTiles.some(tile => tile.x === 25 && tile.y === 27)).toBe(true);
    expect(buildMap([], 'hills', 'summer').pathTiles.some(tile => tile.x === 25 && tile.y === 27)).toBe(false);
  });
});

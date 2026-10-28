import { describe, expect, it } from 'vitest';
import { BALANCE, BUILDINGS, createGame, type GameState, type StructureId } from '../src/game/state';
import { advanceTime, applyAction, isColdNight, type Activity, type GameAction } from '../src/game/rules';
import { CAMP_EXIT, QUARRY_EXIT, QUARRY_SITE, RUBBLE_SITE } from '../src/game/areas';
import { loadGame, saveGame } from '../src/game/save';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
}

/** mulberry32: a small seeded generator, so a failure always replays the same way. */
function seeded(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const structures = Object.keys(BUILDINGS) as StructureId[];
const simple = ['eat', 'stokeFire', 'rest', 'sleep', 'cook', 'stargaze', 'burnFiber', 'dropStone', 'storeStone', 'takeStone', 'craftAxe', 'craftPickaxe'] as const;
const activities: Activity[] = ['awake', 'working', 'resting'];

const SEEDS = [1, 2, 3, 4, 5];

/** Plays one seeded run through the rules, handing each state reached to `each`, and returns the last one. */
function play(seed: number, each: (state: GameState, step: number) => void): GameState {
  const random = seeded(seed);
  const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)];
  let state = createGame();
  const act = (action: GameAction) => { state = applyAction(state, action).state; };
  const goTo = (x: number, y: number) => act({ type: 'move', dx: x - state.player.x, dy: y - state.player.y });
  for (let step = 0; step < 10000 && state.day <= 12; step++) {
    const roll = random();
    const goal = structures.find(id => {
      if (state.structures[id]) return false;
      const definition = BUILDINGS[id];
      const prerequisite = definition.prerequisite;
      if (prerequisite === 'coldNight') return state.progress.hearthUnlocked;
      if (prerequisite && !state.structures[prerequisite]) return false;
      return !('alsoRequires' in definition) || state.structures[definition.alsoRequires];
    });
    if (isColdNight(state) && roll < 0.8) {
      // Mostly hold camp through the storm, so some runs weather it and unlock the hearth.
      goTo(BALANCE.campX + 1, BALANCE.campY + 1);
      act({ type: pick(['stokeFire', 'rest', 'cook', 'stargaze'] as const) });
    } else if (state.area === 'quarry' && roll < 0.6) {
      // In the quarry: look over the face, work it or the rubble, and sometimes walk home.
      const site = pick([QUARRY_SITE, RUBBLE_SITE, QUARRY_EXIT]);
      goTo(site.x, site.y);
      act({ type: site === QUARRY_SITE ? pick(['digQuarry', 'craftPickaxe'] as const) : site === RUBBLE_SITE ? 'gatherRubble' : 'cross' });
    } else if (state.area === 'camp' && state.structures.shelter && roll < 0.3) {
      goTo(CAMP_EXIT.x, CAMP_EXIT.y);
      act({ type: 'cross' });
    } else if (roll < 0.2) state = advanceTime(state, random() * 40, pick(activities));
    else if (roll < 0.55) {
      // Mostly gather what the next structure still needs, so runs build and reach the storm prepared.
      const cost: Record<string, number> = goal ? { ...BUILDINGS[goal].cost } : {};
      const wanted = (['branch', 'fiber', 'stone'] as const).filter(kind =>
        state.inventory[kind === 'branch' ? 'wood' : kind] < (cost[kind === 'branch' ? 'wood' : kind] ?? 0));
      const ready = state.nodes.filter(node => node.amount > 0 && (random() < 0.2 || wanted.includes(node.kind as typeof wanted[number])));
      const node = ready.length ? pick(ready) : pick(state.nodes);
      goTo(node.x, node.y);
      act({ type: 'gather', nodeId: node.id });
    } else if (roll < 0.75) {
      goTo(BALANCE.campX + random() * 2 - 1, BALANCE.campY + random() * 2 - 1);
      act({ type: 'build', structureId: random() < 0.7 && goal ? goal : pick(structures) });
    } else if (roll < 0.97) act({ type: pick(simple) });
    else if (roll < 0.985 && state.stonePiles.length) {
      const pile = pick(state.stonePiles);
      goTo(pile.x, pile.y);
      act({ type: 'pickUpStone', pileId: pile.id });
    } else if (roll < 0.99) {
      // Walk the west path, so runs cross between the areas.
      const exit = state.area === 'camp' ? CAMP_EXIT : QUARRY_EXIT;
      goTo(exit.x, exit.y);
      act({ type: 'cross' });
    } else if (roll < 0.995) {
      // Work the quarry: walk to the face or the rubble and take stone.
      if (state.area === 'quarry') {
        const site = random() < 0.5 ? QUARRY_SITE : RUBBLE_SITE;
        goTo(site.x, site.y);
        act({ type: site === QUARRY_SITE ? 'digQuarry' : 'gatherRubble' });
      } else act({ type: 'craftPickaxe' });
    } else act({ type: 'move', dx: (random() - 0.5) * 80, dy: (random() - 0.5) * 60 });
    each(state, step);
  }
  return state;
}

describe('saving during long random play', () => {
  for (const seed of SEEDS) {
    it(`every state reached by the rules can be saved and loaded (seed ${seed})`, () => {
      const storage = new MemoryStorage();
      const state = play(seed, (reached, step) => {
        expect(saveGame(storage, reached), `step ${step}, day ${reached.day}`).toEqual({ ok: true });
      });
      expect(state.day).toBeGreaterThan(BALANCE.coldNightStartDay);
      const loaded = loadGame(storage);
      expect(loaded).toEqual({ kind: 'loaded', state });
    });
  }
});

describe('random play coverage', () => {
  it('reaches the quarry area and finds the quarry in at least one seed', () => {
    let reachedQuarry = false;
    let foundQuarry = false;
    for (const seed of SEEDS) play(seed, state => {
      reachedQuarry ||= state.area === 'quarry';
      foundQuarry ||= state.progress.quarryFound;
    });
    expect(reachedQuarry).toBe(true);
    expect(foundQuarry).toBe(true);
  });
});

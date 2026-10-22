import { describe, expect, it } from 'vitest';
import { BALANCE, BUILDINGS, createGame, type StructureId } from '../src/game/state';
import { advanceTime, applyAction, isColdNight, type Activity, type GameAction } from '../src/game/rules';
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
const simple = ['eat', 'stokeFire', 'rest', 'sleep', 'cook', 'stargaze'] as const;
const activities: Activity[] = ['awake', 'working', 'resting'];

describe('saving during long random play', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    it(`every state reached by the rules can be saved and loaded (seed ${seed})`, () => {
      const random = seeded(seed);
      const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)];
      const storage = new MemoryStorage();
      let state = createGame();
      const act = (action: GameAction) => { state = applyAction(state, action).state; };
      const goTo = (x: number, y: number) => act({ type: 'move', dx: x - state.player.x, dy: y - state.player.y });
      for (let step = 0; step < 6000 && state.day <= 12; step++) {
        const roll = random();
        const goal = structures.find(id => !state.structures[id] && (id !== 'hearth' || state.progress.hearthUnlocked));
        if (isColdNight(state) && roll < 0.8) {
          // Mostly hold camp through the storm, so some runs weather it and unlock the hearth.
          goTo(BALANCE.campX + 1, BALANCE.campY + 1);
          act({ type: pick(['stokeFire', 'rest', 'cook', 'stargaze'] as const) });
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
        else act({ type: 'move', dx: (random() - 0.5) * 80, dy: (random() - 0.5) * 60 });
        const saved = saveGame(storage, state);
        expect(saved, `step ${step}, day ${state.day}`).toEqual({ ok: true });
      }
      expect(state.day).toBeGreaterThan(BALANCE.coldNightStartDay);
      const loaded = loadGame(storage);
      expect(loaded).toEqual({ kind: 'loaded', state });
    });
  }
});

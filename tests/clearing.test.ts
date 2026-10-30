import { describe, expect, it } from 'vitest';
import { CLEARING_STEPS, STEP_IDS, clearingKey, clearingReach, inClearing, sideAt, type StepId } from '../src/game/clearing';
import { BALANCE, LOOKOUT, SITES, createGame } from '../src/game/state';

const FIRE = { x: BALANCE.campX, y: BALANCE.campY };
const PATH_DESTINATIONS = [[9, 9], [30, 9], [10, 21], [30, 21]];

/** A point `distance` tiles from the fire at `degrees` (y points down, so north is -90). */
function at(degrees: number, distance = 5): [number, number] {
  const radians = degrees * Math.PI / 180;
  return [FIRE.x + Math.cos(radians) * distance, FIRE.y + Math.sin(radians) * distance];
}

function segmentDistance(px: number, py: number, bx: number, by: number): number {
  const dx = bx - FIRE.x, dy = by - FIRE.y;
  const t = Math.max(0, Math.min(1, ((px - FIRE.x) * dx + (py - FIRE.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - FIRE.x - t * dx, py - FIRE.y - t * dy);
}

describe('sideAt', () => {
  it('names the side of the fire a tile lies on', () => {
    expect(sideAt(20, 10)).toBe('north');
    expect(sideAt(26, 15)).toBe('east');
    expect(sideAt(20, 20)).toBe('south');
    expect(sideAt(14, 15)).toBe('west');
  });
});

describe('clearingReach', () => {
  it('is the camp radius everywhere when nothing is cleared', () => {
    for (let x = 0; x < BALANCE.mapWidth; x++) {
      for (let y = 0; y < BALANCE.mapHeight; y++) {
        expect(clearingReach(x, y, [])).toBe(4);
        expect(inClearing(x, y, [])).toBe(Math.hypot(x - FIRE.x, y - FIRE.y) <= 4);
      }
    }
  });

  it('widens only the side that was cleared', () => {
    const cleared: StepId[] = ['north-near'];
    expect(clearingReach(...at(-90), cleared)).toBe(6.5);
    expect(clearingReach(...at(0), cleared)).toBe(4);
    expect(clearingReach(...at(90), cleared)).toBe(4);
    expect(clearingReach(...at(180), cleared)).toBe(4);
  });

  it('reaches furthest east and west once every step is done', () => {
    expect(clearingReach(...at(0), STEP_IDS)).toBe(9);
    expect(clearingReach(...at(180), STEP_IDS)).toBe(9);
    expect(clearingReach(...at(-90), STEP_IDS)).toBe(8);
    expect(clearingReach(...at(90), STEP_IDS)).toBe(8);
  });

  it('averages the two sides at a boundary and takes one side well clear of it', () => {
    const cleared: StepId[] = ['north-near', 'east-far'];
    expect(clearingReach(...at(-30), cleared)).toBeCloseTo((6.5 + 9) / 2);
    expect(clearingReach(...at(30), cleared)).toBeCloseTo((9 + 4) / 2);
    expect(clearingReach(...at(150), cleared)).toBeCloseTo(4);
    expect(clearingReach(...at(-150), cleared)).toBeCloseTo((6.5 + 4) / 2);
    expect(clearingReach(...at(-50), cleared)).toBe(6.5);
    expect(clearingReach(...at(-10), cleared)).toBe(9);
    expect(clearingReach(...at(50), cleared)).toBe(4);
  });
});

describe('clearing steps', () => {
  const game = createGame();
  const previousReach = (id: StepId): number => (id.endsWith('far') ? CLEARING_STEPS[`${CLEARING_STEPS[id].side}-near`].reach : 4);

  it('keeps each marked tree on its side, just past the old edge and within the new one', () => {
    for (const id of STEP_IDS) {
      const step = CLEARING_STEPS[id];
      for (const tree of step.trees) {
        const distance = Math.hypot(tree.x - FIRE.x, tree.y - FIRE.y);
        expect(sideAt(tree.x, tree.y), id).toBe(step.side);
        expect(distance, id).toBeGreaterThan(previousReach(id));
        expect(distance, id).toBeLessThanOrEqual(step.reach + 0.5);
      }
    }
  });

  it('spaces the trees apart and keeps them off nodes and the diagonal paths', () => {
    const trees = STEP_IDS.flatMap(id => CLEARING_STEPS[id].trees);
    trees.forEach((a, i) => {
      for (const b of trees.slice(i + 1)) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(1.2);
      for (const node of game.nodes.filter(n => n.kind !== 'branch')) expect(Math.hypot(a.x - node.x, a.y - node.y)).toBeGreaterThanOrEqual(1.5);
      for (const [dx, dy] of PATH_DESTINATIONS) expect(segmentDistance(a.x + 0.5, a.y + 0.5, dx, dy)).toBeGreaterThanOrEqual(1.35);
    });
  });

  it('prices near and far steps', () => {
    for (const id of STEP_IDS) {
      const far = id.endsWith('far');
      expect(CLEARING_STEPS[id].trees).toHaveLength(far ? 6 : 4);
      expect(CLEARING_STEPS[id].cost).toEqual(far ? { wood: 6, fiber: 3, stone: 0 } : { wood: 4, fiber: 2, stone: 0 });
    }
  });

  it('makes room for the buildings', () => {
    const room = Object.fromEntries(STEP_IDS.map(id => [id, CLEARING_STEPS[id].room]));
    expect(room).toEqual({
      'north-near': ['larder'], 'north-far': ['house'],
      'east-near': ['woodpile', 'fibreStack'], 'east-far': ['workshop'],
      'south-near': [], 'south-far': [],
      'west-near': ['vegetableBeds'], 'west-far': ['well']
    });
  });

  it('leaves the finds and the map edge outside even the fullest clearing', () => {
    for (const spot of [SITES.basket, SITES.spring, SITES.cairn, LOOKOUT]) expect(inClearing(spot.x, spot.y, STEP_IDS)).toBe(false);
    for (let x = 0; x < BALANCE.mapWidth; x++) {
      for (let y = 0; y < BALANCE.mapHeight; y++) {
        const edge = Math.min(x, y, BALANCE.mapWidth - 1 - x, BALANCE.mapHeight - 1 - y);
        if (edge < 2) expect(inClearing(x, y, STEP_IDS), `${x},${y}`).toBe(false);
      }
    }
  });
});

describe('clearing state', () => {
  it('starts with nothing cleared, marked or felled', () => {
    expect(createGame().clearing).toEqual({ cleared: [], marked: null, felled: [] });
  });

  it('labels a set of cleared steps in a fixed order', () => {
    expect(clearingKey([])).toBe('none');
    expect(clearingKey(['west-near', 'north-near'])).toBe('north-near+west-near');
  });
});

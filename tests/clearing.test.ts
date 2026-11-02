import { describe, expect, it } from 'vitest';
import { CLEARING_STEPS, STEP_IDS, previousStep, stepDepth, choppableTrees, clearGroundBlocker, placeBranches, roomLine, clearingKey, clearingReach, inClearing, markBlocker, markedTrees, nextStep, sideAt, type StepId } from '../src/game/clearing';
import { BALANCE, LOOKOUT, SITES, createGame } from '../src/game/state';
import { applyAction } from '../src/game/rules';
import { TOO_TIRED_MESSAGE } from '../src/game/needs';
import { PATH_DESTINATIONS, segmentDistance } from './placement';

const FIRE = { x: BALANCE.campX, y: BALANCE.campY };

/** A point `distance` tiles from the fire at `degrees` (y points down, so north is -90). */
function at(degrees: number, distance = 5): [number, number] {
  const radians = degrees * Math.PI / 180;
  return [FIRE.x + Math.cos(radians) * distance, FIRE.y + Math.sin(radians) * distance];
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

  it('reaches furthest north, east and west once every step is done, outside the nooks', () => {
    expect(clearingReach(...at(0), STEP_IDS)).toBe(9);
    expect(clearingReach(...at(180), STEP_IDS)).toBe(9);
    expect(clearingReach(...at(-90), STEP_IDS)).toBe(9);
    expect(clearingReach(...at(90), STEP_IDS)).toBe(8);
  });

  it('reaches into each nook only within its arc, blending back over a few degrees', () => {
    const north: StepId[] = ['north-near', 'north-far', 'north-outer'];
    expect(clearingReach(...at(-103), north)).toBe(11);
    expect(clearingReach(...at(-103), ['north-near', 'north-far'])).toBe(9);
    expect(clearingReach(...at(-93), north)).toBeCloseTo(10);
    expect(clearingReach(...at(-91), north)).toBe(9);
    expect(clearingReach(...at(106), STEP_IDS)).toBe(11.5);
    expect(clearingReach(...at(120), STEP_IDS)).toBe(8);
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
  const previousReach = (id: StepId): number => {
    const before = previousStep(id);
    return before ? CLEARING_STEPS[before].reach : 4;
  };

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

  it('keeps the marked trees off the wild trees', () => {
    for (const id of STEP_IDS) for (const tree of CLEARING_STEPS[id].trees) {
      for (const wild of game.trees) expect(Math.hypot(tree.x - wild.x, tree.y - wild.y), `${id} tree at ${tree.x},${tree.y} by ${wild.id}`).toBeGreaterThanOrEqual(1.2);
    }
  });

  it('prices near, far and outer steps', () => {
    const COSTS = { near: { wood: 4, fiber: 2, stone: 0 }, far: { wood: 6, fiber: 3, stone: 0 }, outer: { wood: 8, fiber: 4, stone: 2 } };
    for (const id of STEP_IDS) {
      const depth = stepDepth(id);
      // The west wedge is narrow and split by the quarry path, so west-near has room for only two.
      if (depth === 'outer') expect(CLEARING_STEPS[id].trees).toHaveLength(3);
      else expect(CLEARING_STEPS[id].trees).toHaveLength(id === 'west-near' ? 2 : depth === 'far' ? 6 : 4);
      expect(CLEARING_STEPS[id].cost).toEqual(COSTS[depth]);
    }
  });

  it('makes room for the buildings', () => {
    const room = Object.fromEntries(STEP_IDS.map(id => [id, CLEARING_STEPS[id].room]));
    expect(room).toEqual({
      'north-near': ['larder'], 'north-far': ['house', 'beehive'], 'north-outer': ['bakery'],
      'east-near': ['woodpile', 'fibreStack'], 'east-far': ['workshop'],
      'south-near': ['granary'], 'south-far': ['field'], 'south-outer': ['windmill'],
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

describe('the outer ground', () => {
  it('opens a third step on the north and south sides only', () => {
    expect(STEP_IDS).toEqual(['north-near', 'north-far', 'north-outer', 'east-near', 'east-far', 'south-near', 'south-far', 'south-outer', 'west-near', 'west-far']);
    expect(previousStep('north-outer')).toBe('north-far');
    expect(previousStep('south-far')).toBe('south-near');
    expect(previousStep('east-near')).toBeNull();
    expect(stepDepth('south-outer')).toBe('outer');
    expect(stepDepth('west-far')).toBe('far');
    expect(stepDepth('east-near')).toBe('near');
    expect(CLEARING_STEPS['north-outer']).toMatchObject({ side: 'north', reach: 11, cost: { wood: 8, fiber: 4, stone: 2 }, room: ['bakery'], arc: { from: -107, to: -95 } });
    expect(CLEARING_STEPS['south-outer']).toMatchObject({ side: 'south', reach: 11.5, cost: { wood: 8, fiber: 4, stone: 2 }, room: ['windmill'], arc: { from: 98, to: 114 } });
  });

  it('takes no wild tree into camp', () => {
    for (const tree of createGame().trees) expect(inClearing(tree.x, tree.y, STEP_IDS), tree.id).toBe(false);
  });

  it('keeps the outer trees clear of the field and the wild grain', () => {
    const field = { x: FIRE.x - 1.5, y: FIRE.y + 7 };
    for (const tree of CLEARING_STEPS['south-outer'].trees) {
      expect(Math.abs(tree.x - field.x) > 3 || Math.abs(tree.y - field.y) > 1.5, `${tree.x},${tree.y}`).toBe(true);
      expect(Math.hypot(tree.x - 25, tree.y - 23)).toBeGreaterThanOrEqual(1.5);
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

describe('marking a side and felling its trees', () => {
  function ready() {
    const state = createGame();
    state.progress.axeCrafted = true;
    return state;
  }

  it('says why a step cannot be marked, in order', () => {
    const state = ready();
    const noAxe = createGame();
    expect(markBlocker(noAxe, 'east-near')).toBe('Craft a stone axe to clear land.');
    const away = ready();
    away.player.x = 5;
    away.player.y = 5;
    expect(markBlocker(away, 'east-near')).toBe('Return to camp to clear land.');
    expect(markBlocker(state, 'east-far')).toBe('Clear the near ground on that side first.');
    state.clearing.cleared = ['north-near'];
    expect(markBlocker(state, 'north-outer')).toBe('Clear the far ground on that side first.');
    state.clearing.cleared = ['north-near', 'north-far'];
    expect(markBlocker(state, 'north-outer')).toBeNull();
    state.clearing.cleared = ['east-near'];
    expect(markBlocker(state, 'east-near')).toBe('That ground is already clear.');
    state.clearing = { cleared: [], marked: 'north-near', felled: [0] };
    expect(markBlocker(state, 'east-near')).toBe('Finish clearing the north side first.');
    state.clearing = { cleared: [], marked: null, felled: [] };
    expect(markBlocker(state, 'east-near')).toBeNull();
  });

  it('marks a step for free and without taking time', () => {
    const state = ready();
    const result = applyAction(state, { type: 'markClearing', step: 'east-near' });
    expect(result.state.clearing).toEqual({ cleared: [], marked: 'east-near', felled: [] });
    expect(result.state.timeOfDay).toBe(state.timeOfDay);
    expect(result.state.inventory).toEqual(state.inventory);
    expect(result.message).toBe('Tied pale fibre round 4 trees on the east side.');
  });

  it('counts the two west-near trees in the mark message', () => {
    expect(applyAction(ready(), { type: 'markClearing', step: 'west-near' }).message).toBe('Tied pale fibre round 2 trees on the west side.');
  });

  it('replaces a mark that has no trees down, but not one that has', () => {
    const state = ready();
    state.clearing = { cleared: [], marked: 'north-near', felled: [] };
    const swapped = applyAction(state, { type: 'markClearing', step: 'east-near' }).state;
    expect(markedTrees(swapped).every(tree => tree.id.startsWith('mark-east-near-'))).toBe(true);
    expect(markedTrees(swapped)).toHaveLength(4);
    state.clearing = { cleared: [], marked: 'north-near', felled: [0] };
    expect(applyAction(state, { type: 'markClearing', step: 'east-near' }).state).toBe(state);
  });

  it('lists marked trees after the ordinary ones', () => {
    const state = ready();
    expect(markedTrees(state)).toEqual([]);
    expect(choppableTrees(state)).toEqual(state.trees);
    state.clearing = { cleared: [], marked: 'east-near', felled: [1] };
    const marked = markedTrees(state);
    expect(marked.map(tree => tree.id)).toEqual([0, 1, 2, 3].map(i => `mark-east-near-${i}`));
    expect(marked.map(tree => tree.readyDay)).toEqual([1, Number.MAX_SAFE_INTEGER, 1, 1]);
    expect(marked[0].sprite).toBe(CLEARING_STEPS['east-near'].trees[0].sprite);
    expect(choppableTrees(state)).toHaveLength(state.trees.length + 4);
  });

  it('finds the next uncleared step on a side', () => {
    const state = ready();
    expect(nextStep(state, 'east')).toBe('east-near');
    state.clearing.cleared = ['east-near'];
    expect(nextStep(state, 'east')).toBe('east-far');
    state.clearing.cleared = ['east-near', 'east-far'];
    expect(nextStep(state, 'east')).toBeNull();
  });

  it('fells a marked tree for wood without touching the ordinary trees', () => {
    const state = ready();
    state.clearing = { cleared: [], marked: 'east-near', felled: [] };
    const tree = CLEARING_STEPS['east-near'].trees[2];
    state.player.x = tree.x;
    state.player.y = tree.y;
    const cut = applyAction(state, { type: 'chopTree', treeId: 'mark-east-near-2' }).state;
    expect(cut.inventory.wood).toBe(state.inventory.wood + 2);
    expect(cut.player.energy).toBe(state.player.energy - 8);
    expect(cut.timeOfDay).toBe(state.timeOfDay + 10);
    expect(cut.clearing.felled).toEqual([2]);
    expect(cut.trees).toEqual(state.trees);
    const again = applyAction(cut, { type: 'chopTree', treeId: 'mark-east-near-2' });
    expect(again.state).toBe(cut);
    expect(again.message).toBe('This stump stays until the ground is cleared.');
    const later = { ...cut, day: cut.day + 1000 };
    expect(markedTrees(later)[2].readyDay).toBeGreaterThan(later.day);
  });

  it('refuses a marked tree from afar or with a nearly full bag', () => {
    const state = ready();
    state.clearing = { cleared: [], marked: 'east-near', felled: [] };
    const far = applyAction(state, { type: 'chopTree', treeId: 'mark-east-near-0' });
    expect(far.state).toBe(state);
    expect(far.message).toBe('Move closer to a mature tree.');
    const tree = CLEARING_STEPS['east-near'].trees[0];
    state.player.x = tree.x;
    state.player.y = tree.y;
    state.inventory.wood = 7;
    const full = applyAction(state, { type: 'chopTree', treeId: 'mark-east-near-0' });
    expect(full.state).toBe(state);
    expect(full.message).toBe('Your bag needs two free spaces for wood.');
  });
});

describe('clearing the ground', () => {
  function felledState(step: StepId = 'north-near') {
    const state = createGame();
    state.progress.axeCrafted = true;
    state.clearing = { cleared: [], marked: step, felled: [0, 1, 2, 3] };
    state.inventory.wood = 4;
    state.inventory.fiber = 2;
    return state;
  }

  it('says why the ground cannot be cleared, in order', () => {
    const state = createGame();
    expect(clearGroundBlocker(state)).toBe('Choose a side to clear first.');
    state.clearing = { cleared: [], marked: 'north-near', felled: [0] };
    expect(clearGroundBlocker(state)).toBe('Fell the 3 marked trees left first.');
    const ready = felledState();
    const away = { ...ready, player: { ...ready.player, x: 5, y: 5 } };
    expect(clearGroundBlocker(away)).toBe('Return to camp to clear land.');
    const tired = { ...ready, player: { ...ready.player, energy: 0 } };
    expect(clearGroundBlocker(tired)).toBe(TOO_TIRED_MESSAGE);
    const short = { ...ready, inventory: { ...ready.inventory, wood: 3 } };
    expect(clearGroundBlocker(short)).toBe('Need 4 wood and 2 fiber to clear this.');
    expect(clearGroundBlocker(ready)).toBeNull();
  });

  it('opens the side, pays for it and moves the edge branches', () => {
    const state = felledState();
    const result = applyAction(state, { type: 'clearGround' });
    const next = result.state;
    expect(next.clearing).toEqual({ cleared: ['north-near'], marked: null, felled: [] });
    expect(next.inventory.wood).toBe(0);
    expect(next.inventory.fiber).toBe(0);
    expect(next.timeOfDay).toBeGreaterThan(state.timeOfDay);
    expect(next.player.energy).toBeLessThan(state.player.energy);
    expect(result.message).toBe("The north side is open now. There's room for a larder now.");
    const placed = placeBranches(createGame().nodes, ['north-near']);
    next.nodes.forEach((node, index) => {
      expect(node.x).toBe(placed[index].x);
      expect(node.y).toBe(placed[index].y);
      expect(node.amount).toBe(state.nodes[index].amount);
      expect(node.readyDay).toBe(state.nodes[index].readyDay);
    });
    expect(next.nodes.some((node, index) => node.x !== state.nodes[index].x || node.y !== state.nodes[index].y)).toBe(true);
  });

  it('asks for stone as well as wood and fiber on the outer ground, and spends it', () => {
    const outer = (stone: number) => {
      const state = createGame();
      state.progress.axeCrafted = true;
      state.clearing = { cleared: ['north-near', 'north-far'], marked: 'north-outer', felled: CLEARING_STEPS['north-outer'].trees.map((_, i) => i) };
      state.inventory.wood = 8;
      state.inventory.fiber = 4;
      state.inventory.stone = stone;
      return state;
    };
    expect(clearGroundBlocker(outer(1))).toBe('Need 8 wood, 4 fiber and 2 stone to clear this.');
    const after = applyAction(outer(2), { type: 'clearGround' }).state;
    expect(after.clearing.cleared).toContain('north-outer');
    expect(after.inventory).toMatchObject({ wood: 0, fiber: 0, stone: 0 });
  });

  it('refuses when blocked', () => {
    const state = createGame();
    const result = applyAction(state, { type: 'clearGround' });
    expect(result.state).toBe(state);
    expect(result.message).toBe('Choose a side to clear first.');
  });

  it('names the room a cleared step makes', () => {
    expect(roomLine('north-near', {}, id => id === 'larder')).toBe(" There's room for a larder now.");
    expect(roomLine('east-near', {}, () => true)).toBe(" There's room for a woodpile and a fibre stack now.");
    expect(roomLine('north-near', { larder: true }, () => true)).toBe('');
    expect(roomLine('south-near', {}, () => true)).toBe(" There's room for a granary now.");
    expect(roomLine('south-far', { field: true }, () => true)).toBe('');
    expect(roomLine('north-near', {}, () => false)).toBe('');
  });
});

describe('moving the branches', () => {
  const subsets = (): StepId[][] => {
    const all: StepId[][] = [];
    for (let mask = 0; mask < 1 << STEP_IDS.length; mask++) {
      const set = STEP_IDS.filter((_, i) => mask & (1 << i));
      if (set.every(id => { const before = previousStep(id); return !before || set.includes(before); })) all.push(set);
    }
    return all;
  };

  it('keeps every branch on the map, outside the clearing and near its edge', () => {
    const base = createGame().nodes;
    for (const cleared of subsets()) {
      const placed = placeBranches(base, cleared);
      expect(placed).toHaveLength(base.length);
      placed.forEach((node, index) => {
        if (node.kind !== 'branch') return;
        expect(node.x).toBeGreaterThanOrEqual(0);
        expect(node.x).toBeLessThanOrEqual(BALANCE.mapWidth - 1);
        expect(node.y).toBeGreaterThanOrEqual(0);
        expect(node.y).toBeLessThanOrEqual(BALANCE.mapHeight - 1);
        if (!inClearing(base[index].x, base[index].y, cleared)) {
          expect([node.x, node.y]).toEqual([base[index].x, base[index].y]);
          return;
        }
        expect(inClearing(node.x, node.y, cleared), `${cleared.join()} ${node.id}`).toBe(false);
        const out = Math.hypot(node.x - FIRE.x, node.y - FIRE.y) - clearingReach(node.x, node.y, cleared);
        expect(out).toBeLessThanOrEqual(3.25);
      });
    }
  });

  it('leaves every unchosen step tree outside the ground its neighbours clear', () => {
    for (const cleared of subsets()) {
      for (const id of STEP_IDS.filter(step => !cleared.includes(step))) {
        CLEARING_STEPS[id].trees.forEach((tree, index) => {
          const distance = Math.hypot(tree.x - FIRE.x, tree.y - FIRE.y);
          expect(distance, `${id} tree ${index} with [${cleared.join()}]`).toBeGreaterThan(clearingReach(tree.x, tree.y, cleared) + 0.5);
        });
      }
    }
  });

  it('never stacks two nodes on one tile', () => {
    for (const cleared of subsets()) {
      const keys = placeBranches(createGame().nodes, cleared).map(node => `${node.x},${node.y}`);
      expect(new Set(keys).size, cleared.join()).toBe(keys.length);
    }
  });
});

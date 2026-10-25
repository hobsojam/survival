import { describe, expect, it } from 'vitest';
import { BALANCE, LOOKOUT, SITES, createGame } from '../src/game/state';
import { CAMP_EXIT, QUARRY_EXIT, QUARRY_SITE, RUBBLE_SITE } from '../src/game/areas';
import { closestGatherable, hasArrived, moveStep, nextWalk, pickTapTarget, targetAction, type TapTarget } from '../src/scene/tapTarget';

describe('tap targets', () => {
  it('picks a node within one tile of the tap', () => {
    const state = createGame();
    const node = state.nodes.find(item => item.id === 'branch-0')!;
    expect(pickTapTarget(state, node.x + 0.8, node.y)).toMatchObject({ kind: 'node', id: 'branch-0' });
  });

  it('ignores depleted nodes', () => {
    const state = createGame();
    const node = state.nodes.find(item => item.id === 'branch-0')!;
    node.amount = 0;
    state.trees = [];
    expect(pickTapTarget(state, node.x, node.y).kind).toBe('ground');
  });

  it('prefers the object closest to the tap', () => {
    const state = createGame();
    state.trees = [];
    const [first, second] = state.nodes;
    first.x = 5; first.y = 5;
    second.x = 5.8; second.y = 5;
    expect(pickTapTarget(state, 5.5, 5)).toMatchObject({ id: second.id });
    expect(pickTapTarget(state, 5.3, 5)).toMatchObject({ id: first.id });
  });

  it('picks trees, sites, the lookout and the campfire', () => {
    const state = createGame();
    const tree = state.trees[0];
    state.nodes = [];
    expect(pickTapTarget(state, tree.x, tree.y)).toMatchObject({ kind: 'tree', id: tree.id });
    state.trees = [];
    expect(pickTapTarget(state, SITES.spring.x, SITES.spring.y)).toMatchObject({ kind: 'site', id: 'spring' });
    expect(pickTapTarget(state, LOOKOUT.x, LOOKOUT.y).kind).toBe('lookout');
    expect(pickTapTarget(state, BALANCE.campX, BALANCE.campY).kind).toBe('fire');
  });

  it('falls back to ground clamped to the map', () => {
    const state = createGame();
    expect(pickTapTarget(state, -5, 99)).toEqual({ kind: 'ground', x: 0, y: BALANCE.mapHeight - 1 });
  });

  it('arrives within interaction radius for objects and camp radius for the fire', () => {
    const state = createGame();
    const node = { kind: 'node' as const, id: 'n', x: 10, y: 10 };
    state.player.x = 11.9; state.player.y = 10;
    expect(hasArrived(state, node)).toBe(true);
    state.player.x = 12.1;
    expect(hasArrived(state, node)).toBe(false);
    state.player.x = BALANCE.campX + 3.9; state.player.y = BALANCE.campY;
    expect(hasArrived(state, { kind: 'fire', x: BALANCE.campX, y: BALANCE.campY })).toBe(true);
  });

  it('arrives at ground within 0.1 tile', () => {
    const state = createGame();
    state.player.x = 5.05; state.player.y = 5;
    expect(hasArrived(state, { kind: 'ground', x: 5, y: 5 })).toBe(true);
    state.player.x = 5.2;
    expect(hasArrived(state, { kind: 'ground', x: 5, y: 5 })).toBe(false);
  });

  it('steps toward the target at walking speed without overshooting', () => {
    const state = createGame();
    state.player.x = 0; state.player.y = 0;
    const far = moveStep(state, { kind: 'ground', x: 10, y: 0 }, 0.1);
    expect(far.dx).toBeCloseTo(0.35);
    expect(far.dy).toBeCloseTo(0);
    expect(moveStep(state, { kind: 'ground', x: 0.2, y: 0 }, 0.1).dx).toBeCloseTo(0.2);
  });

  it('maps targets to actions', () => {
    expect(targetAction({ kind: 'node', id: 'branch-0', x: 0, y: 0 })).toEqual({ type: 'gather', nodeId: 'branch-0' });
    expect(targetAction({ kind: 'tree', id: 'tree-0', x: 0, y: 0 })).toEqual({ type: 'chopTree', treeId: 'tree-0' });
    expect(targetAction({ kind: 'site', id: 'cairn', x: 0, y: 0 })).toEqual({ type: 'visitSite', siteId: 'cairn' });
    expect(targetAction({ kind: 'lookout', x: 0, y: 0 })).toEqual({ type: 'repairLookout' });
    expect(targetAction({ kind: 'fire', x: 0, y: 0 })).toEqual({ type: 'stokeFire' });
    expect(targetAction({ kind: 'ground', x: 0, y: 0 })).toBeNull();
  });

  it('picks a tree when its canopy is tapped', () => {
    const state = createGame();
    state.nodes = [];
    const tree = state.trees[0];
    state.trees = [tree];
    expect(pickTapTarget(state, tree.x, tree.y - 1.8)).toMatchObject({ kind: 'tree', id: tree.id });
  });

  it('picks the lookout when its roof is tapped', () => {
    const state = createGame();
    state.nodes = [];
    state.trees = [];
    expect(pickTapTarget(state, LOOKOUT.x, LOOKOUT.y - 1.4).kind).toBe('lookout');
  });

  it('still prefers a branch pile tapped at the foot of a tree', () => {
    const state = createGame();
    const tree = state.trees[0];
    state.trees = [tree];
    const node = state.nodes[0];
    node.x = tree.x + 0.4; node.y = tree.y + 0.2;
    state.nodes = [node];
    expect(pickTapTarget(state, node.x, node.y)).toMatchObject({ kind: 'node', id: node.id });
  });
});

describe('loose stone piles', () => {
  it('picks a loose pile within one tile', () => {
    const state = createGame();
    state.nodes = [];
    state.trees = [];
    state.stonePiles = [{ id: 'pile-a', x: 5, y: 5, count: 2, area: 'camp' }];
    expect(pickTapTarget(state, 5.6, 5)).toMatchObject({ kind: 'pile', id: 'pile-a' });
  });

  it('maps a pile to pickUpStone', () => {
    expect(targetAction({ kind: 'pile', id: 'pile-a', x: 0, y: 0 })).toEqual({ type: 'pickUpStone', pileId: 'pile-a' });
  });

  it('closestGatherable prefers the nearer of a pile and a node', () => {
    const state = createGame();
    const node = state.nodes[0];
    state.nodes = [node];
    node.x = 5; node.y = 5;
    state.stonePiles = [{ id: 'pile-a', x: 6.5, y: 5, count: 1, area: 'camp' }];
    state.player.x = 6; state.player.y = 5;
    expect(closestGatherable(state)).toMatchObject({ kind: 'pile', pile: { id: 'pile-a' } });
    state.player.x = 5.4;
    expect(closestGatherable(state)).toMatchObject({ kind: 'node', node: { id: node.id } });
    node.amount = 0;
    expect(closestGatherable(state)).toMatchObject({ kind: 'pile' });
    state.player.x = 20;
    expect(closestGatherable(state)).toBeUndefined();
  });
});

describe('walk cancellation', () => {
  const ground: TapTarget = { kind: 'ground', x: 3, y: 3 };
  const fire: TapTarget = { kind: 'fire', x: BALANCE.campX, y: BALANCE.campY };

  it('a new tap replaces the walk in progress', () => {
    expect(nextWalk(ground, { kind: 'tap', target: fire })).toBe(fire);
    expect(nextWalk(undefined, { kind: 'tap', target: ground })).toBe(ground);
  });

  it('a movement key or another action cancels the walk', () => {
    expect(nextWalk(ground, { kind: 'keyMove' })).toBeUndefined();
    expect(nextWalk(ground, { kind: 'action' })).toBeUndefined();
  });
});

describe('the quarry area', () => {
  const quarryState = () => ({ ...createGame(), area: 'quarry' as const });

  it('taps in the quarry area never pick camp things', () => {
    const state = quarryState();
    const node = state.nodes.find(item => item.id === 'branch-0')!;
    expect(pickTapTarget(state, node.x, node.y)).toEqual({ kind: 'ground', x: node.x, y: node.y });
    const tree = state.trees[0];
    expect(pickTapTarget(state, tree.x, tree.y).kind).toBe('ground');
    expect(pickTapTarget(state, SITES.spring.x, SITES.spring.y).kind).toBe('ground');
    expect(pickTapTarget(state, LOOKOUT.x, LOOKOUT.y).kind).toBe('ground');
    expect(pickTapTarget(state, BALANCE.campX, BALANCE.campY).kind).toBe('ground');
    state.stonePiles = [{ id: 'camp-pile', x: 30, y: 20, count: 1, area: 'camp' }, { id: 'quarry-pile', x: 30, y: 25, count: 1, area: 'quarry' }];
    expect(pickTapTarget(state, 30, 20).kind).toBe('ground');
    expect(pickTapTarget(state, 30, 25)).toMatchObject({ kind: 'pile', id: 'quarry-pile' });
  });

  it('taps at camp never pick quarry-area piles or the quarry', () => {
    const state = createGame();
    state.nodes = [];
    state.trees = [];
    state.stonePiles = [{ id: 'quarry-pile', x: 30, y: 25, count: 1, area: 'quarry' }];
    expect(pickTapTarget(state, 30, 25).kind).toBe('ground');
    expect(pickTapTarget(state, QUARRY_SITE.x, QUARRY_SITE.y).kind).toBe('ground');
    expect(pickTapTarget(state, RUBBLE_SITE.x, RUBBLE_SITE.y).kind).toBe('ground');
  });

  it('picks the quarry and the rubble', () => {
    const state = quarryState();
    expect(pickTapTarget(state, QUARRY_SITE.x + 0.3, QUARRY_SITE.y)).toEqual({ kind: 'quarry', x: QUARRY_SITE.x, y: QUARRY_SITE.y });
    expect(pickTapTarget(state, RUBBLE_SITE.x, RUBBLE_SITE.y + 0.4)).toEqual({ kind: 'rubble', x: RUBBLE_SITE.x, y: RUBBLE_SITE.y });
  });

  it('tapping the path end picks the crossing once open', () => {
    const state = createGame();
    expect(pickTapTarget(state, 0.3, 15).kind).not.toBe('crossing');
    state.structures.shelter = true;
    expect(pickTapTarget(state, 0.3, 15)).toEqual({ kind: 'crossing', x: CAMP_EXIT.x, y: CAMP_EXIT.y });
    expect(pickTapTarget(state, -0.5, 15)).toEqual({ kind: 'crossing', x: CAMP_EXIT.x, y: CAMP_EXIT.y });
    const quarry = quarryState();
    expect(pickTapTarget(quarry, 38.7, 15)).toEqual({ kind: 'crossing', x: QUARRY_EXIT.x, y: QUARRY_EXIT.y });
    expect(pickTapTarget(quarry, 0.3, 15).kind).toBe('ground');
  });

  it('arrives at the crossing within 0.4 tile of the exit', () => {
    const state = createGame();
    const target: TapTarget = { kind: 'crossing', x: CAMP_EXIT.x, y: CAMP_EXIT.y };
    state.player.x = 0.39; state.player.y = 15;
    expect(hasArrived(state, target)).toBe(true);
    state.player.x = 0.45;
    expect(hasArrived(state, target)).toBe(false);
  });

  it('closestGatherable finds rubble and the quarry', () => {
    const state = quarryState();
    state.player.x = RUBBLE_SITE.x + 1; state.player.y = RUBBLE_SITE.y;
    expect(closestGatherable(state)).toEqual({ kind: 'rubble' });
    state.rubbleReadyDay = state.day + 1;
    expect(closestGatherable(state)).toBeUndefined();
    state.player.x = QUARRY_SITE.x; state.player.y = QUARRY_SITE.y + 1;
    expect(closestGatherable(state)).toEqual({ kind: 'quarry' });
    state.progress.pickaxeCrafted = true;
    expect(closestGatherable(state)).toEqual({ kind: 'quarry' });
    state.quarryReadyDay = state.day + 1;
    expect(closestGatherable(state)).toBeUndefined();
    const camp = createGame();
    camp.nodes = [];
    camp.player.x = QUARRY_SITE.x; camp.player.y = QUARRY_SITE.y;
    expect(closestGatherable(camp)).toBeUndefined();
  });

  it('closestGatherable ignores camp nodes and other-area piles', () => {
    const state = quarryState();
    const node = state.nodes[0];
    state.player.x = node.x; state.player.y = node.y;
    state.stonePiles = [{ id: 'camp-pile', x: node.x, y: node.y, count: 1, area: 'camp' }];
    expect(closestGatherable(state)).toBeUndefined();
    state.stonePiles = [{ id: 'quarry-pile', x: node.x, y: node.y, count: 1, area: 'quarry' }];
    expect(closestGatherable(state)).toMatchObject({ kind: 'pile', pile: { id: 'quarry-pile' } });
  });

  it('maps the new targets to actions', () => {
    expect(targetAction({ kind: 'crossing', x: 0, y: 15 })).toEqual({ type: 'cross' });
    expect(targetAction({ kind: 'quarry', x: 12, y: 12 })).toEqual({ type: 'digQuarry' });
    expect(targetAction({ kind: 'rubble', x: 16, y: 16 })).toEqual({ type: 'gatherRubble' });
  });
});

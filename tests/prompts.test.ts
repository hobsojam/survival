import { describe, expect, it } from 'vitest';
import { nightStart } from '../src/game/calendar';
import { BALANCE, LOOKOUT, SITES, createGame, type GameState } from '../src/game/state';
import { CAMP_EXIT, QUARRY_EXIT, QUARRY_SITE, RUBBLE_SITE } from '../src/game/areas';
import { markedTrees } from '../src/game/clearing';
import { KEY_ACTIONS, actionPose, closestSite, closestTree, gatherKeyAction, gatherSpot, promptFor } from '../src/scene/prompts';
import { stock } from './stock';
import { addFood, emptyFood } from '../src/game/food';

/** A camp with nothing to gather, chop or explore, so each test adds only what it checks. */
function bareCamp(x: number = BALANCE.campX, y: number = BALANCE.campY): GameState {
  const state = createGame();
  return { ...state, nodes: [], trees: [], player: { ...state.player, x, y } };
}

const at = (state: GameState, x: number, y: number): GameState => ({ ...state, player: { ...state.player, x, y } });

describe('camp prompts', () => {
  it('offers the fire, rest and building by day at camp', () => {
    expect(promptFor(bareCamp())).toBe('At camp · F Fire · R Rest · Click an upgrade to build');
  });

  it('offers only clearing comforts on grown ground away from the fire', () => {
    const state = { ...createGame(), nodes: [], trees: [], clearing: { cleared: ['east-near' as const], marked: null, felled: [] } };
    expect(promptFor(at(state, BALANCE.campX + 6, BALANCE.campY))).toBe('In the clearing · G Stargaze · Click an upgrade to build');
  });

  it('offers night comforts at camp after dark', () => {
    expect(promptFor({ ...bareCamp(), timeOfDay: nightStart(1) + 1 })).toBe('At camp · C Cook · G Stargaze · F Fire · R Rest');
  });

  it('offers sleep at camp once sleep is allowed', () => {
    const state = { ...bareCamp(), timeOfDay: nightStart(1) + 1, structures: { ...createGame().structures, shelter: true } };
    expect(promptFor(state)).toBe('At camp · C Cook · G Stargaze · Z Sleep · F Fire');
  });

  it('names the dish C would cook after dark', () => {
    // Every animal has had its offering today, so the berry is left for the pot.
    const camp = bareCamp();
    const night = { ...camp, timeOfDay: nightStart(1) + 1, fireFuel: 30, companion: { ...camp.companion, lastOffer: { bird: 1, fox: 1, wolf: 1 } } };
    expect(promptFor({ ...night, inventory: { ...night.inventory, food: stock(1) } })).toBe('C  Cook a berry · G Stargaze · F Fire · R Rest');
    const tea = { ...night, progress: { ...night.progress, potCrafted: true },
      inventory: { ...night.inventory, food: addFood(emptyFood(), 'pineNeedles', 1, 1) } };
    expect(promptFor(tea)).toBe('C  Cook pine needle tea · G Stargaze · F Fire · R Rest');
  });

  it('shows movement help away from camp with nothing nearby', () => {
    expect(promptFor(bareCamp(5, 25))).toBe('WASD / arrows  Move');
  });

  it('points west only once the shelter opens the path', () => {
    const closed = bareCamp(CAMP_EXIT.x + 1, CAMP_EXIT.y);
    expect(promptFor(closed)).toBe('WASD / arrows  Move');
    const open = { ...closed, structures: { ...closed.structures, shelter: true } };
    expect(promptFor(open)).toBe('Walk west to leave camp');
  });

  it('names what E would gather, by kind', () => {
    const state = bareCamp(5, 25);
    const node = (kind: 'branch' | 'berry' | 'fiber' | 'stone') => ({ ...state, nodes: [{ id: kind, kind, x: 5, y: 25, amount: 1, readyDay: 1 }] });
    expect(promptFor(node('branch'))).toBe('E  Pick up fallen branches');
    expect(promptFor(node('berry'))).toBe('E  Pick berries');
    expect(promptFor(node('fiber'))).toBe('E  Gather fiber');
    expect(promptFor(node('stone'))).toBe('E  Collect stone');
  });

  it('names the forage E would gather, in its season', () => {
    const forage = (kind: 'hazel' | 'pine' | 'greens' | 'honey', day: number) =>
      ({ ...bareCamp(5, 25), day, nodes: [{ id: kind, kind, x: 5, y: 25, amount: 1, readyDay: 1 }] });
    expect(promptFor(forage('hazel', 1))).toBe('E  Gather hazelnuts');
    expect(promptFor(forage('pine', 11))).toBe('E  Gather pine needles');
    expect(promptFor(forage('greens', 21))).toBe('E  Pick wild greens');
    expect(promptFor(forage('honey', 31))).toBe('E  Take wild honey');
    expect(promptFor(forage('honey', 1))).not.toMatch(/^E /);
  });

  it('counts the stones in a loose pile', () => {
    const state = { ...bareCamp(5, 25), stonePiles: [{ id: 'p', x: 5, y: 25, count: 3, area: 'camp' as const }] };
    expect(promptFor(state)).toBe('E  Pick up stone (×3)');
  });

  it('adds sleep after the gather prompt when sleep is allowed', () => {
    const base = bareCamp();
    const state = { ...base, timeOfDay: nightStart(1) + 1, structures: { ...base.structures, shelter: true },
      nodes: [{ id: 'b', kind: 'branch' as const, x: base.player.x, y: base.player.y, amount: 1, readyDay: 1 }] };
    expect(promptFor(state)).toBe('E  Pick up fallen branches · Z Sleep until morning');
  });

  it('walks the lookout through damaged, repairable and restored', () => {
    const damaged = bareCamp(LOOKOUT.x, LOOKOUT.y);
    expect(promptFor(damaged)).toBe('Lookout · weather the cold night first');
    const repairable = { ...damaged, progress: { ...damaged.progress, hearthUnlocked: true } };
    expect(promptFor(repairable)).toBe('L  Repair lookout');
    expect(promptFor({ ...repairable, progress: { ...repairable.progress, lookoutRepaired: true } })).toBe('The lookout stands again');
  });

  it('describes a nearby tree by axe and regrowth', () => {
    const state = { ...bareCamp(5, 25), trees: [{ id: 't', x: 5, y: 25, sprite: 'treePine' as const, readyDay: 1 }] };
    expect(promptFor(state)).toBe('Mature tree · craft an axe at camp');
    expect(promptFor({ ...state, progress: { ...state.progress, axeCrafted: true } })).toBe('X  Chop mature tree');
    expect(promptFor({ ...state, trees: [{ ...state.trees[0], readyDay: 9 }] })).toBe('Stump · regrows day 9');
  });

  it('treats a marked tree like any tree to chop, and its stump as part of the clearing', () => {
    const marked = { ...bareCamp(), clearing: { cleared: [], marked: 'north-near' as const, felled: [] }, progress: { ...createGame().progress, axeCrafted: true } };
    const [, second] = markedTrees(marked);
    const beside = at(marked, second.x, second.y);
    expect(closestTree(beside)?.id).toBe('mark-north-near-1');
    expect(promptFor(beside)).toBe('X  Chop mature tree');
    expect(gatherSpot({ type: 'chopTree', treeId: 'mark-north-near-1' }, marked)).toEqual({ x: second.x, y: second.y, kind: 'branch' });
    const felled = { ...beside, clearing: { ...marked.clearing, felled: [1] } };
    expect(promptFor(felled)).toBe('Stump · this ground is being cleared');
  });

  it('pairs the gather prompt with the nearby place', () => {
    const tree = { id: 't', x: 5, y: 25, sprite: 'treePine' as const, readyDay: 1 };
    const state = { ...bareCamp(5, 25), trees: [tree], nodes: [{ id: 'f', kind: 'fiber' as const, x: 5, y: 25, amount: 1, readyDay: 1 }] };
    expect(promptFor(state)).toBe('E  Gather fiber · Mature tree · craft an axe at camp');
  });

  it('offers to explore a site along the path', () => {
    const { x, y } = SITES.cairn;
    expect(promptFor(bareCamp(x, y))).toBe('V  Explore nearby place');
  });
});

describe('quarry prompts', () => {
  const quarry = (x: number, y: number): GameState => ({ ...bareCamp(x, y), area: 'quarry', structures: { ...createGame().structures, shelter: true } });

  it('offers the rubble by hand', () => {
    expect(promptFor(quarry(RUBBLE_SITE.x, RUBBLE_SITE.y))).toBe('E  Gather rubble');
  });

  it('asks for a pickaxe at the quarry face, then offers to dig', () => {
    const state = quarry(QUARRY_SITE.x, QUARRY_SITE.y);
    expect(promptFor(state)).toBe('Quarry · craft a pickaxe at the toolshed');
    expect(promptFor({ ...state, progress: { ...state.progress, pickaxeCrafted: true } })).toBe('E  Dig the quarry');
  });

  it('still mentions the quarry face when a loose pile beside it is nearer', () => {
    const pile = { id: 'p', x: QUARRY_SITE.x + 1, y: QUARRY_SITE.y, count: 2, area: 'quarry' as const };
    const state = { ...quarry(QUARRY_SITE.x + 1, QUARRY_SITE.y), stonePiles: [pile] };
    expect(promptFor(state)).toBe('E  Pick up stone (×2) · Quarry · craft a pickaxe at the toolshed');
    const withPickaxe = { ...state, progress: { ...state.progress, pickaxeCrafted: true } };
    expect(promptFor(withPickaxe)).toBe('E  Pick up stone (×2) · Quarry · tap the face to dig');
    expect(promptFor({ ...withPickaxe, quarryReadyDay: 2 })).toBe('E  Pick up stone (×2) · Quarry · worked out until morning');
    expect(promptFor({ ...state, player: { ...state.player, x: 30, y: 3 }, stonePiles: [{ ...pile, x: 30, y: 3 }] })).toBe('E  Pick up stone (×2)');
  });

  it('says the face is worked out until morning', () => {
    const state = { ...quarry(QUARRY_SITE.x, QUARRY_SITE.y), quarryReadyDay: 2 };
    expect(promptFor(state)).toBe('Quarry · worked out until morning');
  });

  it('points east at the way home and otherwise shows movement help', () => {
    expect(promptFor(quarry(QUARRY_EXIT.x - 0.5, QUARRY_EXIT.y))).toBe('Walk east to return to camp');
    expect(promptFor(quarry(30, 3))).toBe('WASD / arrows  Move');
  });

  it("ignores camp trees and sites while in the quarry", () => {
    const { x, y } = SITES.cairn;
    const state = { ...quarry(x, y), trees: [{ id: 't', x, y, sprite: 'treePine' as const, readyDay: 1 }] };
    expect(closestTree(state)).toBeUndefined();
    expect(closestSite(state)).toBeUndefined();
  });
});

describe('closest tree and site', () => {
  it('picks the nearer of two trees in reach', () => {
    const state = { ...bareCamp(5, 25), trees: [{ id: 'far', x: 6.5, y: 25, sprite: 'treePine' as const, readyDay: 1 }, { id: 'near', x: 5.5, y: 25, sprite: 'treePine' as const, readyDay: 1 }] };
    expect(closestTree(state)?.id).toBe('near');
    expect(closestTree(at(state, 15, 5))).toBeUndefined();
  });

  it('finds a site within reach', () => {
    const { x, y } = SITES.spring;
    expect(closestSite(bareCamp(x + 1, y))?.id).toBe('spring');
  });
});

describe('the E key', () => {
  it('gathers the nearest node, pile, rubble or quarry face', () => {
    const state = bareCamp(5, 25);
    expect(gatherKeyAction({ ...state, nodes: [{ id: 'n', kind: 'berry', x: 5, y: 25, amount: 1, readyDay: 1 }] })).toEqual({ type: 'gather', nodeId: 'n' });
    expect(gatherKeyAction({ ...state, stonePiles: [{ id: 'p', x: 5, y: 25, count: 1, area: 'camp' }] })).toEqual({ type: 'pickUpStone', pileId: 'p' });
    const quarry = { ...state, area: 'quarry' as const, progress: { ...state.progress, pickaxeCrafted: true } };
    expect(gatherKeyAction(at(quarry, RUBBLE_SITE.x, RUBBLE_SITE.y))).toEqual({ type: 'gatherRubble' });
    expect(gatherKeyAction(at(quarry, QUARRY_SITE.x, QUARRY_SITE.y))).toEqual({ type: 'digQuarry' });
  });

  it('rests at camp when there is nothing to gather, and does nothing elsewhere', () => {
    expect(gatherKeyAction(bareCamp())).toEqual({ type: 'rest' });
    expect(gatherKeyAction(bareCamp(5, 25))).toBeUndefined();
  });
});

describe('single-press keys', () => {
  it('map each letter to one action', () => {
    const keys = Object.fromEntries(KEY_ACTIONS.map(([key, action]) => [key, action.type]));
    expect(keys).toEqual({ F: 'stokeFire', R: 'rest', Q: 'eat', T: 'eatTrailFood', P: 'prepareTrailFood', C: 'cook', G: 'stargaze', Z: 'sleep', L: 'repairLookout', O: 'befriend' });
  });
});

describe('action feedback', () => {
  it('poses the survivor for gathering, resting, cooking and stargazing', () => {
    expect(actionPose('gather')).toBe('gather');
    expect(actionPose('chopTree')).toBe('gather');
    expect(actionPose('digQuarry')).toBe('gather');
    expect(actionPose('rest')).toBe('rest');
    expect(actionPose('cook')).toBe('cook');
    expect(actionPose('stargaze')).toBe('stargaze');
    expect(actionPose('build')).toBeUndefined();
  });

  it('places the pick-up sparkle where the thing was gathered', () => {
    const state = { ...bareCamp(5, 25),
      nodes: [{ id: 'n', kind: 'fiber' as const, x: 3, y: 4, amount: 1, readyDay: 1 }],
      trees: [{ id: 't', x: 7, y: 8, sprite: 'treePine' as const, readyDay: 1 }],
      stonePiles: [{ id: 'p', x: 9, y: 10, count: 2, area: 'camp' as const }] };
    expect(gatherSpot({ type: 'gather', nodeId: 'n' }, state)).toMatchObject({ x: 3, y: 4, kind: 'fiber' });
    expect(gatherSpot({ type: 'chopTree', treeId: 't' }, state)).toEqual({ x: 7, y: 8, kind: 'branch' });
    expect(gatherSpot({ type: 'pickUpStone', pileId: 'p' }, state)).toEqual({ x: 9, y: 10, kind: 'stone' });
    expect(gatherSpot({ type: 'gatherRubble' }, state)).toEqual({ ...RUBBLE_SITE, kind: 'stone' });
    expect(gatherSpot({ type: 'digQuarry' }, state)).toEqual({ ...QUARRY_SITE, kind: 'stone' });
    expect(gatherSpot({ type: 'chopTree', treeId: 'missing' }, state)).toBeUndefined();
    expect(gatherSpot({ type: 'eat' }, state)).toBeUndefined();
  });
});

describe('winter prompts', () => {
  it('offers to search a bare bush, and E tries it so the survivor hears why it is empty', () => {
    const bush = createGame().nodes.find(node => node.id === 'berry-0')!;
    const winter = { ...bareCamp(bush.x, bush.y), day: 12, nodes: [bush] };
    expect(promptFor(winter)).toContain('E  Search the bare bush');
    expect(gatherKeyAction(winter)).toEqual({ type: 'gather', nodeId: 'berry-0' });
    expect(promptFor({ ...winter, day: 2 })).toContain('E  Pick berries');
  });
});

describe('offering prompts', () => {
  it('offers the fox a berry with O while it sits at dusk', () => {
    const dusk = { ...bareCamp(), timeOfDay: nightStart(1) - 5, inventory: { ...createGame().inventory, food: stock(1) } };
    expect(promptFor(dusk)).toBe('O  Leave a berry for the fox · At camp · F Fire · R Rest · Click an upgrade to build');
    expect(KEY_ACTIONS).toContainEqual(['O', { type: 'befriend' }]);
  });

  it('adds the offering beside a bush the birds visit', () => {
    const bush = createGame().nodes.find(node => node.id === 'berry-0')!;
    const spring = { ...bareCamp(19, 14), day: 22, timeOfDay: 60, nodes: [bush], inventory: { ...createGame().inventory, food: stock(1) } };
    expect(promptFor(spring)).toBe('E  Pick berries · O  Scatter a berry for the birds');
  });
});

import { describe, expect, it } from 'vitest';
import { BALANCE, BUILDINGS, LOOKOUT, SITES, createGame, type GameState } from '../src/game/state';
import { QUARRY_SITE, RUBBLE_SITE } from '../src/game/areas';
import { FULL_BAG_MESSAGE, advanceTime, isAtCamp, isInClearing, isColdNight, isFreezingNight, applyAction, buildStatus, carriedCount, freeSpaces, lookoutRepairBlocker, pickaxeBlocker, sleepBlocker } from '../src/game/rules';
import { nightStart, seasonMessage } from '../src/game/calendar';

// Night falls at 181 s on day 1, and the day-three cold night's night starts at 174 s.
const NIGHT = nightStart(1);
const STORM_NIGHT = nightStart(3);
const STORM_LENGTH = BALANCE.daySeconds - STORM_NIGHT;
// The nearest branch pile lies under a tree at the clearing's edge, a short walk from where the survivor starts.
const besideBranch = (state: GameState): GameState => {
  const branch = state.nodes.find(node => node.id === 'branch-0')!;
  return { ...state, player: { ...state.player, x: branch.x + 1, y: branch.y } };
};

describe('gathering and inventory', () => {
  it('prepares a trail ration only at a built rack in camp, including with a full bag', () => {
    const state = createGame();
    state.inventory.food = 1;
    expect(applyAction(state, { type: 'prepareTrailFood' }).state).toBe(state);
    state.structures.dryingRack = true;
    state.player.x = 0;
    expect(applyAction(state, { type: 'prepareTrailFood' }).state).toBe(state);
    state.player.x = BALANCE.campX;
    state.inventory.wood = 7;
    const prepared = applyAction(state, { type: 'prepareTrailFood' }).state;
    expect(prepared.inventory).toMatchObject({ wood: 7, food: 0, trailFood: 1 });
    expect(prepared.timeOfDay).toBe(BALANCE.trailFoodSeconds);
    expect(applyAction(prepared, { type: 'prepareTrailFood' }).state).toBe(prepared);
    expect(applyAction(prepared, { type: 'gather', nodeId: 'branch-0' }).state).toBe(prepared);
  });

  it('eats a ration anywhere for 45 hunger and consumes exactly one', () => {
    const state = createGame();
    state.player.x = 0;
    state.player.hunger = 40;
    state.inventory.trailFood = 2;
    const eaten = applyAction(state, { type: 'eatTrailFood' }).state;
    expect(eaten.player.hunger).toBe(85);
    expect(eaten.inventory.trailFood).toBe(1);
    expect(applyAction({ ...eaten, player: { ...eaten.player, hunger: 90 } }, { type: 'eatTrailFood' }).state.player.hunger).toBe(100);
  });

  it('counts rations for discovery rewards, and eating one makes room', () => {
    const state = createGame();
    state.inventory.trailFood = 7;
    state.player.x = 8;
    state.player.y = 8;
    state.player.hunger = 50;
    const blocked = applyAction(state, { type: 'visitSite', siteId: 'basket' });
    expect(blocked.state).toBe(state);
    expect(state.progress.discoveries.basket).toBe(false);
    const eaten = applyAction(state, { type: 'eatTrailFood' });
    expect(eaten.state.inventory.trailFood).toBe(6);
    expect(applyAction(eaten.state, { type: 'visitSite', siteId: 'basket' }).state.progress.discoveries.basket).toBe(true);
  });
  it('gathers nearby wood and spends energy without mutating the old state', () => {
    const before = besideBranch(createGame());
    const result = applyAction(before, { type: 'gather', nodeId: 'branch-0' });
    expect(result.state.inventory.wood).toBe(1);
    expect(result.state.player.energy).toBe(96);
    expect(result.state.nodes[0].amount).toBe(0);
    expect(before.inventory.wood).toBe(0);
    expect(before.nodes[0].amount).toBe(1);
  });

  it('gathers fiber, counts it in the bag, and regrows it at dawn', () => {
    const state = createGame();
    state.player.x = 21;
    state.player.y = 14;
    const gathered = applyAction(state, { type: 'gather', nodeId: 'fiber-0' });
    expect(gathered.state.inventory.fiber).toBe(1);
    expect(gathered.state.nodes.find(node => node.id === 'fiber-0')?.amount).toBe(0);
    expect(advanceTime(gathered.state, 240).nodes.find(node => node.id === 'fiber-0')?.amount).toBe(1);
  });

  it('collects stone from a rock once, and counts it as two bag spaces', () => {
    const state = createGame();
    const stone = state.nodes.find(node => node.kind === 'stone')!;
    state.player.x = stone.x;
    state.player.y = stone.y;
    const gathered = applyAction(state, { type: 'gather', nodeId: stone.id });
    expect(gathered.state.inventory.stone).toBe(1);
    expect(gathered.state.nodes.find(node => node.id === stone.id)?.amount).toBe(0);
    expect(advanceTime(gathered.state, 240).nodes.find(node => node.id === stone.id)?.amount).toBe(0);
    const fullBag = gathered.state;
    fullBag.inventory.wood = 5;
    const secondStone = fullBag.nodes.find(node => node.kind === 'stone' && node.amount > 0)!;
    fullBag.player.x = secondStone.x;
    fullBag.player.y = secondStone.y;
    expect(applyAction(fullBag, { type: 'gather', nodeId: secondStone.id }).message).toMatch(/full/i);
  });


  it('counts fiber toward carrying capacity', () => {
    const state = createGame();
    state.inventory.wood = 6;
    state.inventory.fiber = 2;
    expect(applyAction(besideBranch(state), { type: 'gather', nodeId: 'branch-0' }).message).toMatch(/full/i);
  });

  it('gathers berries into food', () => {
    const state = createGame();
    state.player.x = 19;
    state.player.y = 13;
    expect(applyAction(state, { type: 'gather', nodeId: 'berry-0' }).state.inventory.food).toBe(1);
  });

  it('does not gather a distant or depleted node', () => {
    const state = createGame();
    const far = applyAction(state, { type: 'gather', nodeId: 'branch-11' });
    expect(far.state.inventory.wood).toBe(0);
    state.nodes[0].amount = 0;
    const depleted = applyAction(state, { type: 'gather', nodeId: 'branch-0' });
    expect(depleted.state.inventory.wood).toBe(0);
  });

  it('eats one food to restore hunger within its bound', () => {
    const state = createGame();
    state.inventory.food = 1;
    state.player.hunger = 80;
    const result = applyAction(state, { type: 'eat' });
    expect(result.state.inventory.food).toBe(0);
    expect(result.state.player.hunger).toBe(100);
  });

  it('leaves a full bag and the node untouched with useful feedback', () => {
    const state = createGame();
    state.inventory.wood = 8;
    const result = applyAction(besideBranch(state), { type: 'gather', nodeId: 'branch-0' });
    expect(result.state.inventory.wood).toBe(8);
    expect(result.state.nodes[0].amount).toBe(1);
    expect(result.message.toLowerCase()).toContain('full');
  });

  it('allows gathering at zero energy so the player cannot soft lock', () => {
    const state = createGame();
    state.player.energy = 0;
    expect(applyAction(besideBranch(state), { type: 'gather', nodeId: 'branch-0' }).state.inventory.wood).toBe(1);
  });
});

describe('lookout repair', () => {
  const readyCamp = () => {
    const state = createGame();
    state.day = 4;
    state.player.x = 30;
    state.player.y = 8;
    state.inventory.wood = 4;
    state.inventory.fiber = 2;
    state.inventory.stone = 2;
    return state;
  };

  it('requires a weathered cold night and proximity to the lookout', () => {
    const state = readyCamp();
    const locked = applyAction(state, { type: 'repairLookout' });
    expect(locked.state).toBe(state);
    expect(locked.message).toMatch(/cold night/i);
    state.progress.hearthUnlocked = true;
    state.progress.nextStormDay = null;
    state.player.x = 20;
    state.player.y = 15;
    expect(applyAction(state, { type: 'repairLookout' }).state).toBe(state);
  });

  it('spends eight carried materials and twelve seconds exactly once', () => {
    const state = readyCamp();
    state.progress.hearthUnlocked = true;
    state.progress.nextStormDay = null;
    const repaired = applyAction(state, { type: 'repairLookout' }).state;
    expect(repaired.progress.lookoutRepaired).toBe(true);
    expect(repaired.inventory).toEqual({ wood: 0, food: 0, fiber: 0, stone: 0, trailFood: 0 });
    expect(repaired.timeOfDay).toBe(12);
    expect(repaired.player.energy).toBe(94);
    expect(applyAction(repaired, { type: 'repairLookout' }).state).toBe(repaired);
  });

  it('leaves supplies untouched when the repair cost is missing', () => {
    const state = readyCamp();
    state.progress.hearthUnlocked = true;
    state.progress.nextStormDay = null;
    state.inventory.stone = 1;
    const result = applyAction(state, { type: 'repairLookout' });
    expect(result.state).toBe(state);
    expect(result.message).toMatch(/stone/i);
  });
});

describe('stone axe and tree chopping', () => {
  it('crafts the axe at camp after the cold night using one of each material', () => {
    const state = createGame();
    state.inventory.wood = 1;
    state.inventory.fiber = 1;
    state.inventory.stone = 1;
    expect(applyAction(state, { type: 'craftAxe' }).state).toBe(state);
    state.progress.hearthUnlocked = true;
    state.progress.nextStormDay = null;
    state.structures.toolshed = true;
    const crafted = applyAction(state, { type: 'craftAxe' }).state;
    expect(crafted.progress.axeCrafted).toBe(true);
    expect(crafted.inventory).toEqual({ wood: 0, food: 0, fiber: 0, stone: 0, trailFood: 0 });
    expect(crafted.timeOfDay).toBe(12);
    expect(applyAction(crafted, { type: 'craftAxe' }).state).toBe(crafted);
  });

  it('cuts one mature tree for two wood, leaves a stump, and regrows it after three dawns', () => {
    const state = createGame();
    state.day = 4;
    state.progress.hearthUnlocked = true;
    state.progress.nextStormDay = null;
    state.progress.axeCrafted = true;
    state.player.x = state.trees[0].x;
    state.player.y = state.trees[0].y;
    const cut = applyAction(state, { type: 'chopTree', treeId: state.trees[0].id }).state;
    expect(cut.inventory.wood).toBe(2);
    expect(cut.player.energy).toBe(92);
    expect(cut.timeOfDay).toBe(10);
    expect(cut.trees[0].readyDay).toBe(7);
    expect(applyAction(cut, { type: 'chopTree', treeId: cut.trees[0].id }).state).toBe(cut);
    const regrown = advanceTime(cut, 3 * BALANCE.daySeconds);
    expect(regrown.day).toBe(7);
    // Three days awake leaves the survivor exhausted; refresh them so only the tree is under test.
    const refreshed = { ...regrown, player: { ...regrown.player, energy: 100, hunger: 100 } };
    expect(applyAction(refreshed, { type: 'chopTree', treeId: regrown.trees[0].id }).state.inventory.wood).toBe(4);
  });

  it('does not chop from a distance or with fewer than two free bag slots', () => {
    const state = createGame();
    state.progress.axeCrafted = true;
    const tree = state.trees[0];
    expect(applyAction(state, { type: 'chopTree', treeId: tree.id }).state).toBe(state);
    state.player.x = tree.x;
    state.player.y = tree.y;
    state.inventory.wood = 7;
    const blocked = applyAction(state, { type: 'chopTree', treeId: tree.id });
    expect(blocked.state).toBe(state);
    expect(blocked.message).toMatch(/bag/i);
  });
});

describe('places beyond camp', () => {
  it('finds berries in the old basket once without losing them to a full bag', () => {
    const state = createGame();
    state.player.x = 8;
    state.player.y = 8;
    state.inventory.wood = 7;
    const blocked = applyAction(state, { type: 'visitSite', siteId: 'basket' });
    expect(blocked.state).toBe(state);
    expect(blocked.message).toMatch(/bag/i);
    state.inventory.wood = 0;
    const found = applyAction(state, { type: 'visitSite', siteId: 'basket' }).state;
    expect(found.inventory.food).toBe(2);
    expect(found.progress.discoveries.basket).toBe(true);
    expect(applyAction(found, { type: 'visitSite', siteId: 'basket' }).state).toBe(found);
  });

  it('finds two stones at the cairn and refuses distant searches', () => {
    const state = createGame();
    expect(applyAction(state, { type: 'visitSite', siteId: 'cairn' }).state).toBe(state);
    state.player.x = 31;
    state.player.y = 21;
    const found = applyAction(state, { type: 'visitSite', siteId: 'cairn' }).state;
    expect(found.inventory.stone).toBe(2);
    expect(found.progress.discoveries.cairn).toBe(true);
  });

  it('allows repeatable short rests at the spring and remembers the first visit', () => {
    const state = createGame();
    state.player.x = 10;
    state.player.y = 20;
    state.player.energy = 40;
    const first = applyAction(state, { type: 'visitSite', siteId: 'spring' }).state;
    expect(first.player.energy).toBe(60);
    expect(first.timeOfDay).toBe(20);
    expect(first.progress.discoveries.spring).toBe(true);
    const second = applyAction(first, { type: 'visitSite', siteId: 'spring' }).state;
    expect(second.player.energy).toBe(80);
    expect(second.timeOfDay).toBe(40);
  });
});

describe('time and gentle survival', () => {
  it('rolls the day over at 240 seconds and replenishes gathered nodes', async () => {
    const { advanceTime } = await import('../src/game/rules');
    const state = createGame();
    state.nodes[0].amount = 0;
    state.nodes[0].readyDay = 2;
    const next = advanceTime(state, 240);
    expect(next.day).toBe(2);
    expect(next.timeOfDay).toBe(0);
    expect(next.nodes[0].amount).toBe(1);
  });

  it('handles two dawns in one time step', async () => {
    const { advanceTime } = await import('../src/game/rules');
    const state = createGame();
    state.nodes[0].amount = 0;
    state.nodes[0].readyDay = 2;
    const next = advanceTime(state, 490);
    expect(next.day).toBe(3);
    expect(next.timeOfDay).toBe(10);
    expect(next.nodes[0].amount).toBe(1);
  });

  it('starts cold exposure at night and keeps meters within bounds', async () => {
    const { advanceTime } = await import('../src/game/rules');
    const state = createGame();
    state.player.x = 0;
    state.player.y = 0;
    state.player.hunger = 1;
    state.timeOfDay = NIGHT - 1;
    const beforeNight = advanceTime(state, 1);
    expect(beforeNight.player.warmth).toBe(100);
    const atNight = advanceTime(beforeNight, 2);
    expect(atNight.player.warmth).toBe(99);
    expect(atNight.player.hunger).toBeGreaterThanOrEqual(0);
    const longNight = advanceTime(atNight, 3000);
    expect(longNight.player.hunger).toBe(0);
    expect(longNight.player.warmth).toBeGreaterThanOrEqual(0);
    expect(longNight.player.warmth).toBeLessThanOrEqual(100);
  });

  it('slows but never blocks movement at depleted meters', async () => {
    const { movementFactor } = await import('../src/game/rules');
    const state = createGame();
    state.player.energy = 0;
    state.player.hunger = 0;
    state.player.warmth = 0;
    expect(movementFactor(state)).toBe(0.65);
    expect(applyAction(state, { type: 'move', dx: 1, dy: 0 }).state.player.x).toBeGreaterThan(20);
    expect(applyAction(besideBranch(state), { type: 'gather', nodeId: 'branch-0' }).state.inventory.wood).toBe(1);
  });

  it('stops movement at the map boundary', () => {
    const state = createGame();
    const startX = state.player.x;
    expect(applyAction(state, { type: 'move', dx: 1, dy: 0 }).state.player.x).toBe(startX + 1);
    state.player.x = 39;
    state.player.y = 0;
    const moved = applyAction(state, { type: 'move', dx: 2, dy: -2 }).state;
    expect(moved.player.x).toBe(39);
    expect(moved.player.y).toBe(0);
  });

  it('rest advances time and restores energy', () => {
    const state = createGame();
    state.player.energy = 30;
    const rested = applyAction(state, { type: 'rest' }).state;
    expect(rested.player.energy).toBe(55);
    expect(rested.timeOfDay).toBe(20);
  });
});

describe('fire and camp upgrades', () => {
  it('names the structure in plain words when it is built', () => {
    const state = createGame();
    state.inventory.wood = 4;
    expect(applyAction(state, { type: 'build', structureId: 'dryingRack' }).message).toBe('Built the drying rack.');
  });

  it('builds while standing at the visible shelter and crate sites', () => {
    const shelterState = createGame();
    shelterState.inventory.wood = 6;
    shelterState.inventory.fiber = 2;
    shelterState.player.x = 17;
    shelterState.player.y = 13;
    expect(applyAction(shelterState, { type: 'build', structureId: 'shelter' }).state.structures.shelter).toBe(true);

    const crateState = createGame();
    crateState.inventory.wood = 4;
    crateState.player.x = 23;
    crateState.player.y = 16;
    expect(applyAction(crateState, { type: 'build', structureId: 'crate' }).state.structures.crate).toBe(true);
  });

  it('uses one wood to fuel the fire for 90 seconds', async () => {
    const { advanceTime } = await import('../src/game/rules');
    const state = createGame();
    state.inventory.wood = 1;
    const lit = applyAction(state, { type: 'stokeFire' }).state;
    expect(lit.inventory.wood).toBe(0);
    expect(lit.fireFuel).toBe(90);
    expect(advanceTime(lit, 100).fireFuel).toBe(0);
  });

  it('builds the shelter with six wood, two fiber, and six energy', () => {
    const state = createGame();
    state.inventory.wood = 6;
    state.inventory.fiber = 2;
    const built = applyAction(state, { type: 'build', structureId: 'shelter' }).state;
    expect(built.structures.shelter).toBe(true);
    expect(built.inventory.wood).toBe(0);
    expect(built.player.energy).toBe(94);
  });

  it('requires both wood and fiber for a shelter', () => {
    const state = createGame();
    state.inventory.wood = 6;
    expect(applyAction(state, { type: 'build', structureId: 'shelter' }).state).toBe(state);
    state.inventory.fiber = 2;
    const built = applyAction(state, { type: 'build', structureId: 'shelter' }).state;
    expect(built.structures.shelter).toBe(true);
    expect(built.inventory.wood).toBe(0);
    expect(built.inventory.fiber).toBe(0);
  });

  it('bed improves rest and costs four wood', () => {
    const state = createGame();
    state.structures.shelter = true;
    state.inventory.wood = 4;
    state.inventory.fiber = 1;
    state.player.energy = 20;
    const built = applyAction(state, { type: 'build', structureId: 'bed' }).state;
    expect(built.structures.bed).toBe(true);
    expect(built.inventory.wood).toBe(0);
    expect(applyAction(built, { type: 'rest' }).state.player.energy).toBe(64);
  });

  it('crate costs four wood and raises carrying capacity to sixteen', () => {
    const state = createGame();
    state.inventory.wood = 4;
    const built = applyAction(state, { type: 'build', structureId: 'crate' }).state;
    expect(built.structures.crate).toBe(true);
    expect(built.inventory.wood).toBe(0);
    built.inventory.wood = 8;
    expect(applyAction(besideBranch(built), { type: 'gather', nodeId: 'branch-0' }).state.inventory.wood).toBe(9);
  });

  it('does not build twice, overspend, or build away from camp', () => {
    const state = createGame();
    expect(applyAction(state, { type: 'build', structureId: 'shelter' }).state.structures.shelter).toBe(false);
    state.inventory.wood = 8;
    state.inventory.fiber = 2;
    state.player.x = 0;
    expect(applyAction(state, { type: 'build', structureId: 'shelter' }).state.inventory.wood).toBe(8);
    state.player.x = 20;
    const built = applyAction(state, { type: 'build', structureId: 'shelter' }).state;
    expect(applyAction(built, { type: 'build', structureId: 'shelter' }).state.inventory.wood).toBe(2);
  });

  it('shelter and fire reduce cold exposure at camp', async () => {
    const { advanceTime } = await import('../src/game/rules');
    const state = createGame();
    state.timeOfDay = NIGHT;
    state.player.warmth = 50;
    const outdoors = advanceTime(state, 4).player.warmth;
    state.structures.shelter = true;
    const sheltered = advanceTime(state, 4).player.warmth;
    state.fireFuel = 10;
    const byFire = advanceTime(state, 4).player.warmth;
    expect(outdoors).toBe(48);
    expect(sheltered).toBe(49);
    expect(byFire).toBe(52);
  });
});

describe('daylight spent on work', () => {
  it('gathering takes six seconds of daylight', () => {
    const result = applyAction(besideBranch(createGame()), { type: 'gather', nodeId: 'branch-0' });
    expect(result.state.timeOfDay).toBe(6);
    expect(result.state.player.hunger).toBe(99.25);
  });

  it('building takes twelve seconds of daylight', () => {
    const state = createGame();
    state.inventory.wood = 6;
    state.inventory.fiber = 2;
    const result = applyAction(state, { type: 'build', structureId: 'shelter' });
    expect(result.state.timeOfDay).toBe(12);
    expect(result.state.player.hunger).toBe(98.5);
  });
});

describe('tiredness and sleep', () => {
  const nightAtCamp = () => {
    const state = createGame();
    state.timeOfDay = NIGHT + 10;
    state.structures.shelter = true;
    state.player.energy = 20;
    return state;
  };

  it('drains energy slowly while awake but not while resting', () => {
    const state = createGame();
    expect(advanceTime(state, 60).player.energy).toBeCloseTo(100 - 60 * BALANCE.energyDrainPerSecond);
    expect(advanceTime(state, 60, 'resting').player.energy).toBe(100);
    expect(advanceTime(state, 60, 'working').player.energy).toBe(100);
    state.player.energy = 1;
    expect(advanceTime(state, 600).player.energy).toBe(0);
  });

  it('sleeps through to dawn, letting the night play out', () => {
    const state = nightAtCamp();
    state.fireFuel = 30;
    const result = applyAction(state, { type: 'sleep' });
    expect(result.state.day).toBe(2);
    expect(result.state.timeOfDay).toBe(0);
    expect(result.state.fireFuel).toBe(0);
    expect(result.state.player.hunger).toBeLessThan(state.player.hunger);
    expect(result.state.player.energy).toBe(20 + BALANCE.sleepEnergyGain);
    expect(result.message).toMatch(/morning/i);
  });

  it('sleeps fully restored in a bed', () => {
    const state = nightAtCamp();
    state.structures.bed = true;
    expect(applyAction(state, { type: 'sleep' }).state.player.energy).toBe(100);
  });

  it('only sleeps at night, at camp, with a shelter', () => {
    const day = nightAtCamp();
    day.timeOfDay = 60;
    expect(applyAction(day, { type: 'sleep' })).toMatchObject({ state: day, message: expect.stringMatching(/night/i) });
    const away = nightAtCamp();
    away.player.x = 0;
    expect(applyAction(away, { type: 'sleep' })).toMatchObject({ state: away, message: expect.stringMatching(/camp/i) });
    const unsheltered = nightAtCamp();
    unsheltered.structures.shelter = false;
    expect(applyAction(unsheltered, { type: 'sleep' })).toMatchObject({ state: unsheltered, message: expect.stringMatching(/shelter/i) });
  });
});

describe('optional night activities', () => {
  it('cooks one berry by a lit campfire for a warm meal', () => {
    const state = createGame();
    state.timeOfDay = NIGHT + 10;
    state.inventory.food = 1;
    state.fireFuel = 30;
    state.player.hunger = 30;
    state.player.warmth = 40;
    const cooked = applyAction(state, { type: 'cook' });
    expect(cooked.state.inventory.food).toBe(0);
    expect(cooked.state.timeOfDay).toBe(NIGHT + 18);
    expect(cooked.state.fireFuel).toBe(22);
    expect(cooked.state.player.hunger).toBeCloseTo(64);
    expect(cooked.state.player.warmth).toBe(54);
    expect(state.inventory.food).toBe(1);
  });

  it('does not cook in daylight, away from camp, without berries, or without fire', () => {
    const state = createGame();
    state.inventory.food = 1;
    state.fireFuel = 20;
    for (const setup of [
      (s: typeof state) => { s.timeOfDay = 100; },
      (s: typeof state) => { s.timeOfDay = NIGHT + 10; s.player.x = 0; },
      (s: typeof state) => { s.timeOfDay = NIGHT + 10; s.inventory.food = 0; },
      (s: typeof state) => { s.timeOfDay = NIGHT + 10; s.fireFuel = 0; }
    ]) {
      const attempt = structuredClone(state);
      setup(attempt);
      expect(applyAction(attempt, { type: 'cook' }).state).toBe(attempt);
    }
  });

  it('stargazes at camp at night, restoring a little energy without supplies', () => {
    const state = createGame();
    state.timeOfDay = 230;
    state.player.energy = 15;
    const result = applyAction(state, { type: 'stargaze' });
    expect(result.state.day).toBe(2);
    expect(result.state.timeOfDay).toBe(2);
    expect(result.state.player.energy).toBe(25);
    expect(result.state.inventory).toEqual(state.inventory);
    expect(result.message).toMatch(/stars|sky|moon/i);
  });

  it('does not stargaze during daylight or away from camp', () => {
    const state = createGame();
    expect(applyAction(state, { type: 'stargaze' }).state).toBe(state);
    state.timeOfDay = NIGHT + 10;
    state.player.x = 0;
    expect(applyAction(state, { type: 'stargaze' }).state).toBe(state);
  });

  it('does not undo a failed cold-night penalty when stargazing crosses dawn', () => {
    const state = createGame();
    state.day = 3;
    state.timeOfDay = 232;
    state.player.energy = 30;
    const dawn = applyAction(state, { type: 'stargaze' }).state;
    expect(dawn.progress.nextStormDay).toBe(6);
    expect(dawn.player.energy).toBe(25);
  });
});

describe('more camp structures', () => {
  it('builds a drying rack for four wood without a prerequisite', () => {
    const state = createGame();
    state.inventory.wood = 4;
    const built = applyAction(state, { type: 'build', structureId: 'dryingRack' }).state;
    expect(built.structures.dryingRack).toBe(true);
    expect(built.inventory.wood).toBe(0);
    expect(built.player.energy).toBe(94);
    expect(built.timeOfDay).toBe(12);
    expect(applyAction(built, { type: 'build', structureId: 'dryingRack' }).state).toBe(built);
  });

  it('builds a windbreak for five wood and rejects an underfunded attempt', () => {
    const state = createGame();
    state.inventory.wood = 4;
    expect(applyAction(state, { type: 'build', structureId: 'windbreak' }).state).toBe(state);
    state.inventory.wood = 5;
    const built = applyAction(state, { type: 'build', structureId: 'windbreak' }).state;
    expect(built.structures.windbreak).toBe(true);
    expect(built.inventory.wood).toBe(0);
  });

  it('makes cooked berries more filling without changing supplies or cooking time', () => {
    const state = createGame();
    state.timeOfDay = NIGHT + 10;
    state.inventory.food = 1;
    state.fireFuel = 30;
    state.player.hunger = 20;
    const plain = applyAction(state, { type: 'cook' }).state;
    state.structures.dryingRack = true;
    const improved = applyAction(state, { type: 'cook' }).state;
    expect(plain.player.hunger).toBeCloseTo(54);
    expect(improved.player.hunger).toBeCloseTo(69);
    expect(improved.inventory.food).toBe(0);
    expect(improved.timeOfDay).toBe(NIGHT + 18);
    expect(improved.fireFuel).toBe(22);
  });

  it('halves unlit night warmth loss at camp but not fire gain or outdoor loss', () => {
    const state = createGame();
    state.timeOfDay = NIGHT + 10;
    state.player.warmth = 80;
    state.structures.shelter = true;
    const ordinary = advanceTime(state, 4).player.warmth;
    state.structures.windbreak = true;
    expect(ordinary).toBe(79);
    expect(advanceTime(state, 4).player.warmth).toBe(79.5);
    state.fireFuel = 10;
    expect(advanceTime(state, 4).player.warmth).toBe(82);
    state.fireFuel = 0;
    state.player.x = 0;
    expect(advanceTime(state, 4).player.warmth).toBe(78);
  });

  it('halves warmth loss during a cold night without changing its retry rule', () => {
    const state = createGame();
    state.day = 3;
    state.timeOfDay = STORM_NIGHT + 10;
    state.player.warmth = 80;
    state.structures.shelter = true;
    state.structures.windbreak = true;
    expect(advanceTime(state, 4).player.warmth).toBe(78.5);
    expect(advanceTime(state, 70).progress.nextStormDay).toBe(6);
  });
});

describe('forecast cold night', () => {
  it('forecasts day three and starts the cold night only at nightfall', () => {
    const state = createGame();
    expect(state.progress).toMatchObject({ nextStormDay: 3, hearthUnlocked: false, lookoutRepaired: false, axeCrafted: false });
    state.day = 3;
    state.timeOfDay = STORM_NIGHT - 5;
    state.fireFuel = 20;
    expect(advanceTime(state, 5).fireFuel).toBe(15);
    expect(advanceTime(state, 10).fireFuel).toBe(5);
    state.day = 2;
    state.timeOfDay = nightStart(2);
    expect(advanceTime(state, 5).fireFuel).toBe(15);
  });

  it('makes an unlit sheltered storm night colder', () => {
    const state = createGame();
    state.day = 3;
    state.timeOfDay = STORM_NIGHT;
    state.structures.shelter = true;
    state.player.warmth = 80;
    expect(advanceTime(state, 10).player.warmth).toBe(72.5);
  });

  it('unlocks the hearth after a sheltered night with fire through dawn', () => {
    const state = createGame();
    state.day = 3;
    state.timeOfDay = STORM_NIGHT;
    state.structures.shelter = true;
    state.fireFuel = 180;
    const dawn = advanceTime(state, STORM_LENGTH);
    expect(dawn.day).toBe(4);
    expect(dawn.timeOfDay).toBe(0);
    expect(dawn.fireFuel).toBe(180 - 2 * STORM_LENGTH);
    expect(dawn.progress).toMatchObject({ nextStormDay: null, hearthUnlocked: true, lookoutRepaired: false, axeCrafted: false });
  });

  it('retries after a missed storm and costs the next morning', () => {
    const state = createGame();
    state.day = 3;
    state.timeOfDay = STORM_NIGHT;
    state.structures.shelter = true;
    state.fireFuel = 90;
    const dawn = advanceTime(state, STORM_LENGTH);
    expect(dawn.progress).toMatchObject({ nextStormDay: 6, hearthUnlocked: false, lookoutRepaired: false, axeCrafted: false });
    expect(dawn.day).toBe(4);
    expect(dawn.timeOfDay).toBe(30);
    expect(dawn.player.energy).toBe(25);
    expect(dawn.fireFuel).toBe(0);
    expect(applyAction(besideBranch(dawn), { type: 'gather', nodeId: 'branch-0' }).state.inventory.wood).toBe(1);
  });

  it('requires fire after the last storm second and the survivor at camp', () => {
    const state = createGame();
    state.day = 3;
    state.timeOfDay = STORM_NIGHT;
    state.structures.shelter = true;
    state.fireFuel = 2 * STORM_LENGTH;
    expect(advanceTime(state, STORM_LENGTH).progress.hearthUnlocked).toBe(false);
    state.fireFuel = 180;
    state.player.x = 0;
    expect(advanceTime(state, STORM_LENGTH).progress.hearthUnlocked).toBe(false);
  });

  it('resolves each retry once when advancing over several days', () => {
    const state = createGame();
    state.day = 3;
    state.timeOfDay = STORM_NIGHT;
    const later = advanceTime(state, 800);
    expect(later.day).toBe(7);
    expect(later.progress.nextStormDay).toBe(9);
    expect(later.progress.hearthUnlocked).toBe(false);
  });

  it('does not let sleep bypass the storm setback', () => {
    const state = createGame();
    state.day = 3;
    state.timeOfDay = STORM_NIGHT;
    state.structures.shelter = true;
    state.structures.bed = true;
    state.player.energy = 10;
    const dawn = applyAction(state, { type: 'sleep' }).state;
    expect(dawn.progress.nextStormDay).toBe(6);
    expect(dawn.player.energy).toBe(25);
    expect(dawn.timeOfDay).toBe(30);
  });

  it('keeps the hearth locked until success, then grants longer fuel', () => {
    const state = createGame();
    state.inventory.wood = 2;
    const locked = applyAction(state, { type: 'build', structureId: 'hearth' });
    expect(locked.state).toBe(state);
    expect(locked.message).toMatch(/cold night/i);
    state.progress.hearthUnlocked = true;
    state.progress.nextStormDay = null;
    expect(applyAction(state, { type: 'build', structureId: 'hearth' }).message).toMatch(/stone/i);
    state.inventory.stone = 3;
    const built = applyAction(state, { type: 'build', structureId: 'hearth' }).state;
    expect(built.structures.hearth).toBe(true);
    expect(built.inventory.wood).toBe(0);
    expect(built.inventory.stone).toBe(0);
    built.inventory.wood = 1;
    expect(applyAction(built, { type: 'stokeFire' }).state.fireFuel).toBe(150);
  });
});

describe('heavy stone and fiber fuel', () => {
  const atCamp = () => {
    const state = createGame();
    state.player.x = BALANCE.campX;
    state.player.y = BALANCE.campY;
    return state;
  };

  it('counts stone as two spaces', () => {
    const state = createGame();
    state.inventory = { wood: 2, food: 0, fiber: 0, stone: 1, trailFood: 0 };
    expect(carriedCount(state)).toBe(4);
    expect(freeSpaces(state)).toBe(4);
  });

  it('refuses a rock when only one space is free', () => {
    const state = createGame();
    const rock = state.nodes.find(node => node.id === 'stone-0')!;
    state.player.x = rock.x;
    state.player.y = rock.y;
    state.inventory.wood = 7;
    const refused = applyAction(state, { type: 'gather', nodeId: rock.id });
    expect(refused.state).toBe(state);
    expect(refused.message).toBe(FULL_BAG_MESSAGE);
    state.inventory.wood = 6;
    expect(applyAction(state, { type: 'gather', nodeId: rock.id }).state.inventory.stone).toBe(1);
  });

  it("needs four free spaces for the cairn's two stones", () => {
    const state = createGame();
    state.player.x = SITES.cairn.x;
    state.player.y = SITES.cairn.y;
    state.inventory.wood = 5;
    expect(applyAction(state, { type: 'visitSite', siteId: 'cairn' }).state).toBe(state);
    state.inventory.wood = 4;
    expect(applyAction(state, { type: 'visitSite', siteId: 'cairn' }).state.inventory.stone).toBe(2);
  });

  it('burns fiber for thirty seconds at camp only', () => {
    const state = atCamp();
    state.inventory.fiber = 1;
    const burned = applyAction(state, { type: 'burnFiber' }).state;
    expect(burned.fireFuel).toBe(30);
    expect(burned.inventory.fiber).toBe(0);
    state.structures.hearth = true;
    expect(applyAction(state, { type: 'burnFiber' }).state.fireFuel).toBe(30);
    const away = createGame();
    away.player.x = 0;
    away.inventory.fiber = 1;
    expect(applyAction(away, { type: 'burnFiber' }).state).toBe(away);
    const none = atCamp();
    expect(applyAction(none, { type: 'burnFiber' }).state).toBe(none);
  });

  it('never burns fiber when stoking the fire', () => {
    const state = atCamp();
    state.inventory.fiber = 2;
    const result = applyAction(state, { type: 'stokeFire' });
    expect(result.state).toBe(state);
    expect(state.inventory.fiber).toBe(2);
  });

  it('does not refill rocks at dawn, but still refills branches', () => {
    let state = createGame();
    for (const id of ['stone-0', 'branch-0']) {
      const node = state.nodes.find(item => item.id === id)!;
      state.player.x = node.x;
      state.player.y = node.y;
      state = applyAction(state, { type: 'gather', nodeId: id }).state;
    }
    const morning = advanceTime(state, BALANCE.daySeconds);
    expect(morning.nodes.find(node => node.id === 'stone-0')!.amount).toBe(0);
    expect(morning.nodes.find(node => node.id === 'branch-0')!.amount).toBe(1);
  });
});

describe('loose stone', () => {
  const at = (x: number, y: number, stone = 2) => {
    const state = createGame();
    state.player.x = x;
    state.player.y = y;
    state.inventory.stone = stone;
    return state;
  };

  it('drops one stone where the survivor stands', () => {
    const state = at(5, 5);
    const dropped = applyAction(state, { type: 'dropStone' }).state;
    expect(dropped.inventory.stone).toBe(1);
    expect(dropped.stonePiles).toEqual([{ id: expect.any(String), x: 5, y: 5, count: 1, area: 'camp' }]);
    const empty = at(5, 5, 0);
    expect(applyAction(empty, { type: 'dropStone' }).state).toBe(empty);
  });

  it('adds to a pile within one tile instead of starting another', () => {
    let state = at(5, 5, 3);
    state = applyAction(state, { type: 'dropStone' }).state;
    state = { ...state, player: { ...state.player, x: 5.8 } };
    state = applyAction(state, { type: 'dropStone' }).state;
    expect(state.stonePiles).toEqual([{ id: expect.any(String), x: 5, y: 5, count: 2, area: 'camp' }]);
    state = { ...state, player: { ...state.player, x: 6.5 } };
    state = applyAction(state, { type: 'dropStone' }).state;
    expect(state.stonePiles).toHaveLength(2);
  });

  it('joins a pile dropped on an earlier day', () => {
    let state = applyAction(at(5, 5), { type: 'dropStone' }).state;
    state = advanceTime(state, BALANCE.daySeconds);
    state = { ...state, player: { ...state.player, x: 5.8 } };
    state = applyAction(state, { type: 'dropStone' }).state;
    expect(state.stonePiles).toEqual([{ id: expect.any(String), x: 5, y: 5, count: 2, area: 'camp' }]);
  });

  it('picks up one stone from a nearby pile with two free spaces', () => {
    const state = at(5, 5, 0);
    state.stonePiles = [{ id: 'pile-a', x: 6.5, y: 5, count: 2, area: 'camp' }];
    const picked = applyAction(state, { type: 'pickUpStone', pileId: 'pile-a' }).state;
    expect(picked.stonePiles[0].count).toBe(1);
    expect(picked.inventory.stone).toBe(1);
    expect(picked.timeOfDay).toBeCloseTo(BALANCE.pickUpSeconds);
    expect(picked.player.energy).toBe(state.player.energy);
    const full = at(5, 5, 0);
    full.inventory.wood = 7;
    full.stonePiles = [{ id: 'pile-a', x: 6.5, y: 5, count: 2, area: 'camp' }];
    const refused = applyAction(full, { type: 'pickUpStone', pileId: 'pile-a' });
    expect(refused.state).toBe(full);
    expect(refused.message).toBe(FULL_BAG_MESSAGE);
    const far = at(5, 5, 0);
    far.stonePiles = [{ id: 'pile-a', x: 8, y: 5, count: 2, area: 'camp' }];
    expect(applyAction(far, { type: 'pickUpStone', pileId: 'pile-a' }).state).toBe(far);
  });

  it('removes a pile when its last stone is picked up', () => {
    const state = at(5, 5, 0);
    state.stonePiles = [{ id: 'pile-a', x: 5, y: 5, count: 1, area: 'camp' }];
    expect(applyAction(state, { type: 'pickUpStone', pileId: 'pile-a' }).state.stonePiles).toEqual([]);
  });

  it('can set down a stone-filled bag and still build the shelter', () => {
    let state = at(5, 5, 4);
    for (let i = 0; i < 4; i++) state = applyAction(state, { type: 'dropStone' }).state;
    expect(state.inventory.stone).toBe(0);
    state.inventory = { ...state.inventory, wood: 6, fiber: 2 };
    state = { ...state, player: { ...state.player, x: BALANCE.campX, y: BALANCE.campY } };
    expect(applyAction(state, { type: 'build', structureId: 'shelter' }).state.structures.shelter).toBe(true);
  });
});

describe('the stone pile at camp', () => {
  const camp = () => {
    const state = createGame();
    state.player.x = BALANCE.campX;
    state.player.y = BALANCE.campY;
    return state;
  };
  const unlocked = (state: ReturnType<typeof createGame>) => {
    state.progress = { ...state.progress, hearthUnlocked: true, nextStormDay: null };
    return state;
  };

  it('builds the stone pile from three wood', () => {
    const state = camp();
    state.inventory.wood = 3;
    expect(buildStatus(state, 'stonePile')).toBe('ready');
    const built = applyAction(state, { type: 'build', structureId: 'stonePile' }).state;
    expect(built.structures.stonePile).toBe(true);
    expect(built.inventory.wood).toBe(0);
  });

  it('stores and takes stone at camp, up to twelve', () => {
    const state = camp();
    state.inventory.stone = 1;
    expect(applyAction(state, { type: 'storeStone' }).state).toBe(state);
    state.structures.stonePile = true;
    const stored = applyAction(state, { type: 'storeStone' }).state;
    expect(stored.inventory.stone).toBe(0);
    expect(stored.storedStone).toBe(1);
    const full = { ...state, storedStone: BALANCE.stonePileCapacity };
    expect(applyAction(full, { type: 'storeStone' }).state).toBe(full);
    const crowded = { ...stored, inventory: { ...stored.inventory, wood: 7 } };
    expect(applyAction(crowded, { type: 'takeStone' }).state).toBe(crowded);
    const taken = applyAction(stored, { type: 'takeStone' }).state;
    expect(taken.inventory.stone).toBe(1);
    expect(taken.storedStone).toBe(0);
    const away = { ...stored, player: { ...stored.player, x: 0, y: 0 } };
    expect(applyAction(away, { type: 'takeStone' }).state).toBe(away);
    const awayStore = { ...state, player: { ...state.player, x: 0, y: 0 } };
    expect(applyAction(awayStore, { type: 'storeStone' }).state).toBe(awayStore);
  });

  it('pays for the hearth from the bag first, then the pile', () => {
    const state = unlocked(camp());
    state.structures.stonePile = true;
    state.inventory.wood = 2;
    state.inventory.stone = 1;
    state.storedStone = 2;
    expect(buildStatus(state, 'hearth')).toBe('ready');
    const built = applyAction(state, { type: 'build', structureId: 'hearth' }).state;
    expect(built.structures.hearth).toBe(true);
    expect(built.inventory.stone).toBe(0);
    expect(built.storedStone).toBe(0);
  });

  it('spends bag stone before touching the pile', () => {
    const state = unlocked(camp());
    state.structures.stonePile = true;
    state.inventory.wood = 2;
    state.inventory.stone = 3;
    state.storedStone = 2;
    const built = applyAction(state, { type: 'build', structureId: 'hearth' }).state;
    expect(built.inventory.stone).toBe(0);
    expect(built.storedStone).toBe(2);
  });

  it('crafts the axe with stone from the pile', () => {
    const state = unlocked(camp());
    state.structures.stonePile = true;
    state.inventory.wood = 1;
    state.inventory.fiber = 1;
    state.storedStone = 1;
    state.structures.toolshed = true;
    const crafted = applyAction(state, { type: 'craftAxe' }).state;
    expect(crafted.progress.axeCrafted).toBe(true);
    expect(crafted.storedStone).toBe(0);
  });

  it('does not offer the lookout repair from the quarry area', () => {
    const state = unlocked(createGame());
    state.area = 'quarry';
    state.player.x = LOOKOUT.x;
    state.player.y = LOOKOUT.y;
    state.inventory = { ...state.inventory, wood: 4, fiber: 2, stone: 3 };
    expect(lookoutRepairBlocker(state)).toBe('There is nothing like that here.');
  });

  it('repairs the lookout with pile stone from far away', () => {
    const state = unlocked(createGame());
    state.player.x = LOOKOUT.x;
    state.player.y = LOOKOUT.y + 1;
    state.structures.stonePile = true;
    state.inventory = { ...state.inventory, wood: 4, fiber: 2, stone: 0 };
    state.storedStone = 3;
    expect(lookoutRepairBlocker(state)).toBeNull();
    const repaired = applyAction(state, { type: 'repairLookout' }).state;
    expect(repaired.progress.lookoutRepaired).toBe(true);
    expect(repaired.storedStone).toBe(1);
  });
});

describe('the second area', () => {
  function sheltered() {
    const state = createGame();
    state.structures.shelter = true;
    return state;
  }

  it('walking off the west edge at the path crosses into the quarry', () => {
    const state = sheltered();
    state.player.x = 0.05;
    state.player.y = 15;
    expect(applyAction(state, { type: 'move', dx: -1, dy: 0 }).state.area).toBe('quarry');
  });

  it('walking off the quarry east edge at the path returns to camp', () => {
    const state = sheltered();
    state.area = 'quarry';
    state.player.x = BALANCE.mapWidth - 1 - 0.05;
    state.player.y = 15;
    const next = applyAction(state, { type: 'move', dx: 1, dy: 0 }).state;
    expect(next.area).toBe('camp');
    expect(next.player.x).toBe(0.5);
  });

  it('the west edge still blocks away from the path', () => {
    const state = sheltered();
    state.player.x = 0.05;
    state.player.y = 10;
    const moved = applyAction(state, { type: 'move', dx: -1, dy: 0 }).state;
    expect(moved.area).toBe('camp');
    expect(moved.player.x).toBe(0);
  });

  it('cross needs to stand at the path end', () => {
    const state = sheltered();
    state.player.x = 5;
    state.player.y = 15;
    const refused = applyAction(state, { type: 'cross' });
    expect(refused.state).toBe(state);
    expect(refused.message).toBe('Walk to the end of the west path to cross.');
    state.player.x = 0.4;
    expect(applyAction(state, { type: 'cross' }).state.area).toBe('quarry');
  });

  it('camp actions need the camp area', () => {
    const state = sheltered();
    state.area = 'quarry';
    state.timeOfDay = NIGHT;
    state.player.x = 20;
    state.player.y = 15;
    state.inventory.wood = 20;
    state.inventory.fiber = 20;
    expect(isAtCamp(state)).toBe(false);
    for (const action of [{ type: 'stokeFire' }, { type: 'sleep' }, { type: 'build', structureId: 'bed' }] as const) {
      const result = applyAction(state, action);
      expect(result.state).toBe(state);
      expect(result.message).toMatch(/^Return to/);
    }
  });

  it('sites and the lookout only answer in the camp area', () => {
    const state = createGame();
    state.area = 'quarry';
    state.player.x = SITES.spring.x;
    state.player.y = SITES.spring.y;
    expect(applyAction(state, { type: 'visitSite', siteId: 'spring' }).message).toBe('There is nothing like that here.');
    expect(applyAction(state, { type: 'repairLookout' }).message).toBe('There is nothing like that here.');
  });

  it('the cold night counts the quarry as away from camp', () => {
    const make = (area: 'camp' | 'quarry') => {
      const state = createGame();
      state.area = area;
      state.day = 3;
      state.timeOfDay = STORM_NIGHT + 10;
      state.player.warmth = 80;
      state.player.x = 20;
      state.player.y = 15;
      state.structures.shelter = true;
      state.structures.windbreak = true;
      return state;
    };
    const atCamp = advanceTime(make('camp'), 4).player.warmth;
    const away = advanceTime(make('quarry'), 4).player.warmth;
    expect(away).toBeLessThan(atCamp);
  });
});

describe('quarry and tools', () => {
  function inQuarry(x: number, y: number) {
    const state = createGame();
    state.area = 'quarry';
    state.player.x = x;
    state.player.y = y;
    return state;
  }
  function atCamp() {
    const state = createGame();
    state.player.x = BALANCE.campX;
    state.player.y = BALANCE.campY;
    return state;
  }

  it('reaching the quarry finds it', () => {
    const state = inQuarry(QUARRY_SITE.x + 3, QUARRY_SITE.y);
    expect(applyAction(state, { type: 'move', dx: -0.5, dy: 0 }).state.progress.quarryFound).toBe(false);
    const found = applyAction(state, { type: 'move', dx: -1.5, dy: 0 });
    expect(found.state.progress.quarryFound).toBe(true);
    expect(found.message).toBe('You found an old quarry. A pickaxe could work this stone.');
  });

  it('crafts the pickaxe only at camp', () => {
    const state = atCamp();
    state.structures = { ...state.structures, shelter: true, toolshed: true };
    state.progress.quarryFound = true;
    state.inventory = { ...state.inventory, wood: 2, fiber: 1, stone: 2 };
    expect(pickaxeBlocker(state)).toBeNull();
    const away = { ...state, player: { ...state.player, x: 5, y: 25 } };
    expect(pickaxeBlocker(away)).toBe('Return to camp to craft the pickaxe.');
    expect(applyAction(away, { type: 'craftPickaxe' }).state).toBe(away);
  });

  it('digs and gathers rubble only beside them in the quarry area', () => {
    const quarry = inQuarry(QUARRY_SITE.x, QUARRY_SITE.y);
    quarry.progress.pickaxeCrafted = true;
    const farFromFace = { ...quarry, player: { ...quarry.player, x: QUARRY_SITE.x + 5 } };
    expect(applyAction(farFromFace, { type: 'digQuarry' }).message).toBe('Move closer to the quarry face.');
    const sameSpotAtCamp = { ...quarry, area: 'camp' as const };
    expect(applyAction(sameSpotAtCamp, { type: 'digQuarry' }).message).toBe('Move closer to the quarry face.');
    const farFromRubble = inQuarry(RUBBLE_SITE.x - 5, RUBBLE_SITE.y);
    expect(applyAction(farFromRubble, { type: 'gatherRubble' }).message).toBe('Move closer to the rubble.');
    const rubbleSpotAtCamp = { ...inQuarry(RUBBLE_SITE.x, RUBBLE_SITE.y), area: 'camp' as const };
    expect(applyAction(rubbleSpotAtCamp, { type: 'gatherRubble' }).message).toBe('Move closer to the rubble.');
  });

  it('rubble gives one stone and refills three dawns later', () => {
    const state = inQuarry(RUBBLE_SITE.x + 1, RUBBLE_SITE.y);
    const first = applyAction(state, { type: 'gatherRubble' }).state;
    expect(first.inventory.stone).toBe(1);
    expect(first.rubbleReadyDay).toBe(state.day + 3);
    const again = applyAction(first, { type: 'gatherRubble' });
    expect(again.state).toBe(first);
    expect(again.message).toBe('The rubble is picked over. More will loosen in a few days.');
    const later = { ...first, day: state.day + 3 };
    expect(applyAction(later, { type: 'gatherRubble' }).state.inventory.stone).toBe(2);
  });

  it('rubble needs room for heavy stone', () => {
    const state = inQuarry(RUBBLE_SITE.x, RUBBLE_SITE.y);
    state.inventory.wood = 7;
    const result = applyAction(state, { type: 'gatherRubble' });
    expect(result.message).toBe(FULL_BAG_MESSAGE);
    expect(result.state).toBe(state);
  });

  it('the toolshed needs the shelter and costs 5 wood and 2 fiber', () => {
    const state = atCamp();
    state.inventory.wood = 5;
    state.inventory.fiber = 2;
    expect(BUILDINGS.toolshed.cost).toEqual({ wood: 5, fiber: 2 });
    expect(buildStatus(state, 'toolshed')).toBe('needsShelter');
    state.structures.shelter = true;
    expect(buildStatus(state, 'toolshed')).toBe('ready');
    const built = applyAction(state, { type: 'build', structureId: 'toolshed' }).state;
    expect(built.structures.toolshed).toBe(true);
    expect(built.inventory.wood).toBe(0);
    expect(built.inventory.fiber).toBe(0);
  });

  it('keeps shelter prerequisites distinct from later upgrade prerequisites', () => {
    const state = createGame();
    expect(buildStatus(state, 'shelterThatched')).toBe('needsShelter');
    state.structures.shelter = true;
    expect(buildStatus(state, 'shelterThatched')).toBe('unavailable');
    expect(buildStatus(state, 'shelterStonework')).toBe('needsPrerequisite');
  });

  it('the axe needs the toolshed', () => {
    const state = atCamp();
    state.progress.hearthUnlocked = true;
    state.progress.nextStormDay = null;
    state.inventory = { ...state.inventory, wood: 1, fiber: 1, stone: 1 };
    const result = applyAction(state, { type: 'craftAxe' });
    expect(result.state).toBe(state);
    expect(result.message).toBe('Build a toolshed first.');
  });

  it('the pickaxe needs the toolshed and the quarry, not the axe', () => {
    const state = atCamp();
    state.inventory = { ...state.inventory, wood: 2, fiber: 1, stone: 1 };
    state.storedStone = 1;
    state.structures.stonePile = true;
    expect(applyAction(state, { type: 'craftPickaxe' }).message).toBe('Find the quarry first.');
    state.progress.quarryFound = true;
    expect(applyAction(state, { type: 'craftPickaxe' }).message).toBe('Build a toolshed first.');
    state.structures.toolshed = true;
    expect(pickaxeBlocker(state)).toBeNull();
    const crafted = applyAction(state, { type: 'craftPickaxe' }).state;
    expect(crafted.progress.pickaxeCrafted).toBe(true);
    expect(crafted.progress.axeCrafted).toBe(false);
    expect(crafted.inventory.stone).toBe(0);
    expect(crafted.storedStone).toBe(0);
    expect(crafted.inventory.wood).toBe(0);
    expect(crafted.inventory.fiber).toBe(0);
  });

  it('digging needs the pickaxe and works once a day', () => {
    const state = inQuarry(QUARRY_SITE.x + 1, QUARRY_SITE.y);
    const refused = applyAction(state, { type: 'digQuarry' });
    expect(refused.state).toBe(state);
    expect(refused.message).toBe('You need a pickaxe to work the quarry.');
    state.progress.pickaxeCrafted = true;
    const dug = applyAction(state, { type: 'digQuarry' }).state;
    expect(dug.inventory.stone).toBe(1);
    expect(dug.player.energy).toBe(state.player.energy - 8);
    expect(dug.timeOfDay).toBe(state.timeOfDay + 10);
    expect(dug.quarryReadyDay).toBe(state.day + 1);
    const again = applyAction(dug, { type: 'digQuarry' });
    expect(again.state).toBe(dug);
    expect(again.message).toBe('The quarry face is worked out until morning.');
  });

  it('dropped stone stays in its area', () => {
    const state = inQuarry(10, 10);
    state.inventory.stone = 2;
    const dropped = applyAction(state, { type: 'dropStone' }).state;
    expect(dropped.stonePiles).toEqual([{ id: expect.stringContaining('quarry'), x: 10, y: 10, count: 1, area: 'quarry' }]);
    const home = { ...dropped, area: 'camp' as const };
    const inCamp = applyAction(home, { type: 'dropStone' }).state;
    expect(inCamp.stonePiles).toHaveLength(2);
    expect(inCamp.stonePiles[0].count).toBe(1);
    const pileId = dropped.stonePiles[0].id;
    const picked = applyAction({ ...home, inventory: { ...home.inventory, stone: 0 } }, { type: 'pickUpStone', pileId });
    expect(picked.message).toBe('There is no stone pile within reach.');
    expect(picked.state.inventory.stone).toBe(0);
  });

  it("camp nodes and trees can't be used from the quarry area", () => {
    const state = createGame();
    state.area = 'quarry';
    state.progress.axeCrafted = true;
    const node = state.nodes[0];
    state.player.x = node.x;
    state.player.y = node.y;
    expect(applyAction(state, { type: 'gather', nodeId: node.id }).state).toBe(state);
    const tree = state.trees[0];
    state.player.x = tree.x;
    state.player.y = tree.y;
    const chop = applyAction(state, { type: 'chopTree', treeId: tree.id });
    expect(chop.state).toBe(state);
    expect(chop.message).toBe('Move closer to a mature tree.');
  });

  it('rubble and dawns alone always lead to a pickaxe', () => {
    let state = createGame();
    state.nodes = state.nodes.map(node => node.kind === 'stone' ? { ...node, amount: 0 } : node);
    state.progress.discoveries.cairn = true;
    state.structures.shelter = true;
    state.structures.toolshed = true;
    state.progress.quarryFound = true;
    state.inventory.wood = 2;
    state.inventory.fiber = 1;
    let crafted = false;
    for (let day = 0; day < 20 && !crafted; day += 1) {
      state = { ...state, area: 'quarry', player: { ...state.player, x: RUBBLE_SITE.x, y: RUBBLE_SITE.y } };
      state = applyAction(state, { type: 'gatherRubble' }).state;
      state = { ...state, area: 'camp', player: { ...state.player, x: BALANCE.campX, y: BALANCE.campY } };
      state = applyAction(state, { type: 'craftPickaxe' }).state;
      crafted = state.progress.pickaxeCrafted;
      state = advanceTime({ ...state, player: { ...state.player, energy: 100, hunger: 100, warmth: 100 } }, BALANCE.daySeconds - state.timeOfDay);
    }
    expect(crafted).toBe(true);
  });
});

describe('shelter upgrades', () => {
  it('builds each shelter stage in order and requires the stone hearth for stonework', () => {
    const state = createGame();
    state.structures.shelter = true;
    state.inventory.fiber = 4;
    expect(buildStatus(state, 'shelterThatched')).toBe('ready');
    const thatched = applyAction(state, { type: 'build', structureId: 'shelterThatched' }).state;
    expect(thatched.structures.shelterThatched).toBe(true);
    expect(thatched.inventory.fiber).toBe(0);

    thatched.storedStone = 5;
    expect(buildStatus(thatched, 'shelterStonework')).toBe('needsPrerequisite');
    thatched.structures.hearth = true;
    thatched.progress = { ...thatched.progress, hearthUnlocked: true, nextStormDay: null };
    expect(buildStatus(thatched, 'shelterStonework')).toBe('ready');
    const stonework = applyAction(thatched, { type: 'build', structureId: 'shelterStonework' }).state;
    expect(stonework.structures.shelterStonework).toBe(true);
    expect(stonework.storedStone).toBe(0);

    stonework.inventory.wood = 5;
    stonework.storedStone = 3;
    const porch = applyAction(stonework, { type: 'build', structureId: 'shelterPorch' }).state;
    expect(porch.structures.shelterPorch).toBe(true);
    expect(porch.inventory.wood).toBe(2);
    expect(porch.storedStone).toBe(0);

    porch.inventory.fiber = 2;
    const finished = applyAction(porch, { type: 'build', structureId: 'shelterFinished' }).state;
    expect(finished.structures.shelterFinished).toBe(true);
    expect(finished.inventory.wood).toBe(0);
    expect(finished.inventory.fiber).toBe(0);
  });

  it('reduces ordinary sheltered warmth loss but leaves cold-night and lit-fire warmth unchanged', () => {
    const state = createGame();
    state.timeOfDay = NIGHT + 10;
    state.player.warmth = 80;
    state.structures.shelter = true;
    state.structures.shelterThatched = true;
    expect(advanceTime(state, 4).player.warmth).toBeCloseTo(79.2);

    state.day = 3;
    state.timeOfDay = STORM_NIGHT + 10;
    state.progress.nextStormDay = 3;
    expect(advanceTime(state, 4).player.warmth).toBeCloseTo(77);
    state.fireFuel = 10;
    expect(advanceTime(state, 4).player.warmth).toBeCloseTo(82);
  });
});

describe('night through the year', () => {
  const sheltered = (day: number, timeOfDay: number) => {
    const state = createGame();
    state.day = day;
    state.timeOfDay = timeOfDay;
    state.structures.shelter = true;
    state.player.x = BALANCE.campX;
    state.player.y = BALANCE.campY;
    return state;
  };

  it('lets you sleep early on a winter evening but not on a summer one', () => {
    expect(sleepBlocker(sheltered(16, 150))).toBeNull();
    expect(sleepBlocker(sheltered(36, 160))).toMatch(/once night falls/);
  });

  it('starts the day-three cold night at that day’s nightfall', () => {
    expect(isColdNight(sheltered(3, 170))).toBe(false);
    expect(isColdNight(sheltered(3, 175))).toBe(true);
  });

  it('sleeps across the edge of winter into its first morning', () => {
    const state = sheltered(10, 160);
    state.progress.nextStormDay = null;
    const woke = applyAction(state, { type: 'sleep' }).state;
    expect([woke.day, woke.timeOfDay]).toEqual([11, 0]);
    expect(seasonMessage(state.day, woke.day)).toBe('Snow fell in the night. Winter has come.');
  });
});

describe('winter nights', () => {
  const base = createGame();
  const winterNight = { ...base, day: 12, timeOfDay: nightStart(12) + 1,
    progress: { ...base.progress, hearthUnlocked: true, nextStormDay: null } };

  it('makes every winter night freezing, and autumn nights not', () => {
    expect(isFreezingNight(winterNight)).toBe(true);
    expect(isFreezingNight({ ...winterNight, timeOfDay: nightStart(12) - 1 })).toBe(false);
    expect(isFreezingNight({ ...winterNight, day: 8, timeOfDay: nightStart(8) + 1 })).toBe(false);
  });

  it('burns the fire twice as fast and chills the survivor away from it', () => {
    const atFire = advanceTime({ ...winterNight, fireFuel: 50 }, 10);
    expect(atFire.fireFuel).toBeCloseTo(30);
    const away = advanceTime({ ...winterNight, player: { ...winterNight.player, x: 5, y: 25, warmth: 80 } }, 10);
    expect(away.player.warmth).toBeCloseTo(80 - 12.5);
  });

  it('gives winter nights no penalty, but keeps the cold night\'s', () => {
    const dawn = advanceTime({ ...winterNight, timeOfDay: 239, player: { ...winterNight.player, energy: 90 } }, 2);
    expect(dawn).toMatchObject({ day: 13, progress: { nextStormDay: null } });
    expect(dawn.timeOfDay).toBeCloseTo(1);
    expect(dawn.player.energy).toBeGreaterThan(BALANCE.coldNightFailureEnergy);
    const front = { ...winterNight, timeOfDay: 239, progress: { ...winterNight.progress, hearthUnlocked: false, nextStormDay: 12 } };
    const failed = advanceTime(front, 2);
    expect(failed.progress.nextStormDay).toBe(12 + BALANCE.coldNightRetryDays);
    expect(failed.player.energy).toBeLessThanOrEqual(BALANCE.coldNightFailureEnergy);
  });
});

describe('winter larder', () => {
  const base = createGame();
  const bush = base.nodes.find(node => node.id === 'berry-0')!;
  const winterDay = { ...base, day: 12, player: { ...base.player, x: bush.x, y: bush.y } };
  const atSpringInWinter = { ...base, day: 12, player: { ...base.player, x: SITES.spring.x, y: SITES.spring.y, energy: 50 } };

  it('leaves the bushes bare all winter', () => {
    const result = applyAction(winterDay, { type: 'gather', nodeId: 'berry-0' });
    expect(result.message).toBe('The bushes are bare until spring.');
    expect(result.state).toBe(winterDay);
    expect(applyAction({ ...winterDay, day: 51 }, { type: 'gather', nodeId: 'berry-0' }).state).toMatchObject({ day: 51 });
    expect(applyAction({ ...winterDay, day: 51 }, { type: 'gather', nodeId: 'berry-0' }).message).toBe('The bushes are bare until spring.');
    expect(applyAction({ ...winterDay, day: 21 }, { type: 'gather', nodeId: 'berry-0' }).state.inventory.food).toBe(1);
  });

  it('freezes the quiet spring, but still marks it found', () => {
    const result = applyAction(atSpringInWinter, { type: 'visitSite', siteId: 'spring' });
    expect(result.message).toBe('The spring is frozen over.');
    expect(result.state.player.energy).toBe(atSpringInWinter.player.energy);
    expect(result.state.timeOfDay).toBe(atSpringInWinter.timeOfDay);
    expect(result.state.progress.discoveries.spring).toBe(true);
  });
});

describe('spring growth', () => {
  it('regrows trees in two days when chopped in spring', () => {
    const base = createGame();
    const tree = base.trees[0];
    const ready = { ...base, progress: { ...base.progress, hearthUnlocked: true, nextStormDay: null, axeCrafted: true },
      player: { ...base.player, x: tree.x, y: tree.y } };
    expect(applyAction({ ...ready, day: 30 }, { type: 'chopTree', treeId: tree.id }).state.trees[0].readyDay).toBe(32);
    expect(applyAction({ ...ready, day: 8 }, { type: 'chopTree', treeId: tree.id }).state.trees[0].readyDay).toBe(11);
    expect(BALANCE.springTreeRegrowDays).toBe(2);
  });
});

describe('summer', () => {
  const base = createGame();
  const bush = base.nodes.find(node => node.id === 'berry-0')!;
  const night = (day: number, warmth: number, away: boolean, extra: Partial<GameState> = {}): GameState => ({
    ...base, day, timeOfDay: nightStart(day) + 10, ...extra,
    player: { ...base.player, warmth, ...(away ? { x: 5, y: 25 } : {}) }
  });
  const atBush = (day: number): GameState => ({ ...base, day, player: { ...base.player, x: bush.x, y: bush.y } });

  it('keeps warmth steady on a summer night away from the fire', () => {
    expect(advanceTime(night(34, 60, true), 20).player.warmth).toBeCloseTo(60);
  });

  it('still warms you by a lit fire on a summer night', () => {
    expect(advanceTime(night(34, 60, false, { fireFuel: 50 }), 10).player.warmth).toBeCloseTo(65);
  });

  it('keeps the forecast cold night cold, even in summer', () => {
    const front = night(33, 60, true, { progress: { ...base.progress, nextStormDay: 33 } });
    expect(advanceTime(front, 10).player.warmth).toBeLessThan(60);
  });

  it('chills nights again once autumn returns', () => {
    expect(advanceTime(night(41, 60, true), 10).player.warmth).toBeCloseTo(55);
  });

  it('sleeps through a summer night without getting colder', () => {
    const state = night(34, 50, false, { structures: { ...base.structures, shelter: true } });
    const woke = applyAction(state, { type: 'sleep' }).state;
    expect(woke.day).toBe(35);
    expect(woke.player.warmth).toBeGreaterThanOrEqual(50);
  });

  it('makes you hungry faster in the midday heat', () => {
    const lost = (day: number, from: number, to: number) =>
      100 - advanceTime({ ...base, day, timeOfDay: from }, to - from, 'resting').player.hunger;
    expect(lost(34, 55, 65)).toBeCloseTo(5 / 8 + 5 * 1.25 / 8);
    expect(lost(34, 130, 140)).toBeCloseTo(10 / 8);
    expect(lost(24, 70, 80)).toBeCloseTo(10 / 8);
  });

  it('picks two berries from a summer bush', () => {
    const result = applyAction(atBush(34), { type: 'gather', nodeId: 'berry-0' });
    expect(result.state.inventory.food).toBe(base.inventory.food + 2);
    expect(result.state.nodes.find(node => node.id === 'berry-0')!.amount).toBe(0);
    expect(result.message).toBe('Picked two handfuls of berries.');
  });

  it('picks one berry when the bag has a single space', () => {
    const state = atBush(34);
    state.inventory = { ...state.inventory, wood: freeSpaces(state) - 1 + state.inventory.wood };
    expect(freeSpaces(state)).toBe(1);
    const result = applyAction(state, { type: 'gather', nodeId: 'berry-0' });
    expect(result.state.inventory.food).toBe(state.inventory.food + 1);
    expect(result.message).toBe('Picked berries.');
  });

  it('picks one berry in autumn', () => {
    expect(applyAction(atBush(41), { type: 'gather', nodeId: 'berry-0' }).state.inventory.food).toBe(base.inventory.food + 1);
  });
});

describe('the grown clearing', () => {
  const grown = (): GameState => {
    const state = createGame();
    state.clearing.cleared = ['north-near'];
    state.player.x = 20;
    state.player.y = 9.5;
    return state;
  };

  it('counts new ground as the clearing but not as camp', () => {
    const state = grown();
    expect(isInClearing(state)).toBe(true);
    expect(isAtCamp(state)).toBe(false);
  });

  it('lets the survivor build on new ground', () => {
    const state = grown();
    state.inventory.wood = 5;
    expect(buildStatus(state, 'windbreak')).toBe('ready');
  });

  it('keeps rest and sleep for the warmth around the fire', () => {
    const state = grown();
    expect(applyAction(state, { type: 'rest' }).state).toBe(state);
    state.timeOfDay = NIGHT;
    state.structures.shelter = true;
    expect(sleepBlocker(state)).toBe('Return to the marked camp area to sleep.');
  });

  it('gives no warmth on new ground', () => {
    const night = (x: number, y: number, cleared: GameState['clearing']['cleared']) => {
      const state = createGame();
      state.timeOfDay = NIGHT;
      state.fireFuel = 50;
      state.structures.shelter = true;
      state.structures.windbreak = true;
      state.clearing.cleared = cleared;
      state.player.x = x;
      state.player.y = y;
      return advanceTime(state, 10).player.warmth;
    };
    expect(night(20, 9.5, ['north-near'])).toBe(night(20, 9.5, []));
  });

  it('matches the camp ring exactly while nothing is cleared', () => {
    for (let i = 0; i < 50; i++) {
      const state = createGame();
      state.player.x = Math.random() * 40;
      state.player.y = Math.random() * 30;
      expect(isInClearing(state)).toBe(isAtCamp(state));
    }
  });
});

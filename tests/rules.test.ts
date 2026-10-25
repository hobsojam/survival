import { describe, expect, it } from 'vitest';
import { BALANCE, SITES, createGame } from '../src/game/state';
import { FULL_BAG_MESSAGE, advanceTime, applyAction, carriedCount, freeSpaces } from '../src/game/rules';

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
    const before = createGame();
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
    expect(applyAction(state, { type: 'gather', nodeId: 'branch-0' }).message).toMatch(/full/i);
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
    const result = applyAction(state, { type: 'gather', nodeId: 'branch-0' });
    expect(result.state.inventory.wood).toBe(8);
    expect(result.state.nodes[0].amount).toBe(1);
    expect(result.message.toLowerCase()).toContain('full');
  });

  it('allows gathering at zero energy so the player cannot soft lock', () => {
    const state = createGame();
    state.player.energy = 0;
    expect(applyAction(state, { type: 'gather', nodeId: 'branch-0' }).state.inventory.wood).toBe(1);
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

  it('requires a weathered cold front and proximity to the lookout', () => {
    const state = readyCamp();
    const locked = applyAction(state, { type: 'repairLookout' });
    expect(locked.state).toBe(state);
    expect(locked.message).toMatch(/cold front/i);
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
  it('crafts the axe at camp after the cold front using one of each material', () => {
    const state = createGame();
    state.inventory.wood = 1;
    state.inventory.fiber = 1;
    state.inventory.stone = 1;
    expect(applyAction(state, { type: 'craftAxe' }).state).toBe(state);
    state.progress.hearthUnlocked = true;
    state.progress.nextStormDay = null;
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
    expect(applyAction(regrown, { type: 'chopTree', treeId: regrown.trees[0].id }).state.inventory.wood).toBe(4);
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
    state.timeOfDay = 159;
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
    expect(applyAction(state, { type: 'gather', nodeId: 'branch-0' }).state.inventory.wood).toBe(1);
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
    expect(applyAction(built, { type: 'gather', nodeId: 'branch-0' }).state.inventory.wood).toBe(9);
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
    state.timeOfDay = 160;
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
    const result = applyAction(createGame(), { type: 'gather', nodeId: 'branch-0' });
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
    state.timeOfDay = BALANCE.nightStart + 10;
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
    state.timeOfDay = 170;
    state.inventory.food = 1;
    state.fireFuel = 30;
    state.player.hunger = 30;
    state.player.warmth = 40;
    const cooked = applyAction(state, { type: 'cook' });
    expect(cooked.state.inventory.food).toBe(0);
    expect(cooked.state.timeOfDay).toBe(178);
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
      (s: typeof state) => { s.timeOfDay = 170; s.player.x = 0; },
      (s: typeof state) => { s.timeOfDay = 170; s.inventory.food = 0; },
      (s: typeof state) => { s.timeOfDay = 170; s.fireFuel = 0; }
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
    state.timeOfDay = 170;
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
    state.timeOfDay = 170;
    state.inventory.food = 1;
    state.fireFuel = 30;
    state.player.hunger = 20;
    const plain = applyAction(state, { type: 'cook' }).state;
    state.structures.dryingRack = true;
    const improved = applyAction(state, { type: 'cook' }).state;
    expect(plain.player.hunger).toBeCloseTo(54);
    expect(improved.player.hunger).toBeCloseTo(69);
    expect(improved.inventory.food).toBe(0);
    expect(improved.timeOfDay).toBe(178);
    expect(improved.fireFuel).toBe(22);
  });

  it('halves unlit night warmth loss at camp but not fire gain or outdoor loss', () => {
    const state = createGame();
    state.timeOfDay = 170;
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

  it('halves warmth loss during a cold front without changing its retry rule', () => {
    const state = createGame();
    state.day = 3;
    state.timeOfDay = 170;
    state.player.warmth = 80;
    state.structures.shelter = true;
    state.structures.windbreak = true;
    expect(advanceTime(state, 4).player.warmth).toBe(78.5);
    expect(advanceTime(state, 70).progress.nextStormDay).toBe(6);
  });
});

describe('forecast cold night', () => {
  it('forecasts day three and starts the front only at nightfall', () => {
    const state = createGame();
    expect(state.progress).toMatchObject({ nextStormDay: 3, hearthUnlocked: false, lookoutRepaired: false, axeCrafted: false });
    state.day = 3;
    state.timeOfDay = BALANCE.nightStart - 5;
    state.fireFuel = 20;
    expect(advanceTime(state, 5).fireFuel).toBe(15);
    expect(advanceTime(state, 10).fireFuel).toBe(5);
    state.day = 2;
    state.timeOfDay = BALANCE.nightStart;
    expect(advanceTime(state, 5).fireFuel).toBe(15);
  });

  it('makes an unlit sheltered storm night colder', () => {
    const state = createGame();
    state.day = 3;
    state.timeOfDay = BALANCE.nightStart;
    state.structures.shelter = true;
    state.player.warmth = 80;
    expect(advanceTime(state, 10).player.warmth).toBe(72.5);
  });

  it('unlocks the hearth after a sheltered night with fire through dawn', () => {
    const state = createGame();
    state.day = 3;
    state.timeOfDay = BALANCE.nightStart;
    state.structures.shelter = true;
    state.fireFuel = 180;
    const dawn = advanceTime(state, 80);
    expect(dawn.day).toBe(4);
    expect(dawn.timeOfDay).toBe(0);
    expect(dawn.fireFuel).toBe(20);
    expect(dawn.progress).toMatchObject({ nextStormDay: null, hearthUnlocked: true, lookoutRepaired: false, axeCrafted: false });
  });

  it('retries after a missed storm and costs the next morning', () => {
    const state = createGame();
    state.day = 3;
    state.timeOfDay = BALANCE.nightStart;
    state.structures.shelter = true;
    state.fireFuel = 90;
    const dawn = advanceTime(state, 80);
    expect(dawn.progress).toMatchObject({ nextStormDay: 6, hearthUnlocked: false, lookoutRepaired: false, axeCrafted: false });
    expect(dawn.day).toBe(4);
    expect(dawn.timeOfDay).toBe(30);
    expect(dawn.player.energy).toBe(25);
    expect(dawn.fireFuel).toBe(0);
    expect(applyAction(dawn, { type: 'gather', nodeId: 'branch-0' }).state.inventory.wood).toBe(1);
  });

  it('requires fire after the last storm second and the survivor at camp', () => {
    const state = createGame();
    state.day = 3;
    state.timeOfDay = BALANCE.nightStart;
    state.structures.shelter = true;
    state.fireFuel = 160;
    expect(advanceTime(state, 80).progress.hearthUnlocked).toBe(false);
    state.fireFuel = 180;
    state.player.x = 0;
    expect(advanceTime(state, 80).progress.hearthUnlocked).toBe(false);
  });

  it('resolves each retry once when advancing over several days', () => {
    const state = createGame();
    state.day = 3;
    state.timeOfDay = BALANCE.nightStart;
    const later = advanceTime(state, 800);
    expect(later.day).toBe(7);
    expect(later.progress.nextStormDay).toBe(9);
    expect(later.progress.hearthUnlocked).toBe(false);
  });

  it('does not let sleep bypass the storm setback', () => {
    const state = createGame();
    state.day = 3;
    state.timeOfDay = BALANCE.nightStart;
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

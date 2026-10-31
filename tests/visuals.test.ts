import { describe, expect, it } from 'vitest';
import { BALANCE, createGame } from '../src/game/state';
import { nightStart } from '../src/game/calendar';
import { sceneVisuals, playerVisualDepth, GROUND_DECAL_DEPTH, NIGHT_DEPTH, LIGHT_DEPTH, WEATHER_DEPTH } from '../src/scene/visuals';
import { sprites } from '../src/art/sprites';
import { worldX, worldY } from '../src/scene/art';
import { QUARRY_SITE, RUBBLE_SITE } from '../src/game/areas';
import { CLEARING_STEPS } from '../src/game/clearing';
import { validateSprite } from '../src/art/textures';
import { stock } from './stock';

describe('native-size scene art', () => {
  it('selects pixel textures for every resource and camp site', () => {
    const visuals = sceneVisuals(createGame(), 0);
    const keys = visuals.map(item => item.texture);
    expect(keys).toContain('branchPile:ready');
    expect(keys).toContain('berryBush:ready');
    expect(keys).toContain('fiberReeds:ready');
    expect(keys).toContain('rock0:still');
    expect(keys).toContain('shelterSite:still');
    expect(keys).toContain('dryingRackSite:still');
    expect(keys).toContain('windbreakSite:still');
    expect(keys).toContain('logSeat:still');
    expect(keys).toContain('lookout:damaged');
    expect(keys).toContain('firePit:unlit');
    expect(keys).not.toContain('hearthSite:still');
    const sites = new Set(['shelter', 'dryingRack', 'garden', 'windbreak', 'stonePile', 'toolshed']);
    for (const item of visuals) {
      const [name, frame] = item.texture.split(':');
      expect(sprites[name]?.frames[frame], item.texture).toBeDefined();
      expect(Number.isInteger(item.x) && Number.isInteger(item.y)).toBe(true);
      expect(item.depth).toBe(sites.has(item.id) ? GROUND_DECAL_DEPTH : item.y);
    }
  });

  it('draws each shelter upgrade and adds the bed to the current stage', () => {
    const state = createGame();
    const shelter = () => sceneVisuals(state, 0).find(item => item.id === 'shelter')!;
    expect(shelter()).toMatchObject({ texture: 'shelterSite:still', depth: GROUND_DECAL_DEPTH });

    state.structures.shelter = true;
    for (const [upgrade, texture] of [
      ['shelterThatched', 'shelter:thatched'],
      ['shelterStonework', 'shelter:stonework'],
      ['shelterPorch', 'shelter:porch'],
      ['shelterFinished', 'shelter:finished']
    ] as const) {
      state.structures[upgrade] = true;
      expect(shelter().texture).toBe(texture);
      expect(shelter().depth).toBe(shelter().y);
    }
    state.structures.bed = true;
    expect(shelter().texture).toBe('shelter:finishedBed');
  });

  it('draws forage spots only in their season', () => {
    const ids = (day: number) => new Set(sceneVisuals({ ...createGame(), day }, 0).map(item => item.id));
    const autumn = ids(1), winter = ids(11), summer = ids(31);
    expect(autumn.has('hazel-0') && !autumn.has('pine-0') && !autumn.has('greens-0') && !autumn.has('honey-0')).toBe(true);
    expect(winter.has('pine-2') && !winter.has('hazel-0')).toBe(true);
    expect(summer.has('honey-0') && !summer.has('greens-1')).toBe(true);
    expect(autumn.has('berry-0') && winter.has('berry-0')).toBe(true);
  });

  it('draws each forage kind with its own sprite, gathered or ready', () => {
    const texture = (id: string, day: number, amount: number) => {
      const state = createGame();
      state.day = day;
      state.nodes.find(item => item.id === id)!.amount = amount;
      return sceneVisuals(state, 0).find(item => item.id === id)?.texture;
    };
    expect(texture('hazel-0', 1, 1)).toBe('hazelSpot:ready');
    expect(texture('hazel-0', 1, 0)).toBe('hazelSpot:gathered');
    expect(texture('pine-0', 11, 0)).toBe('pineForage:gathered');
    expect(texture('greens-0', 21, 1)).toBe('greensPatch:ready');
    expect(texture('honey-0', 31, 0)).toBe('hollowTree:gathered');
    const buzzing = new Set(Array.from({ length: 8 }, (_, i) => {
      const state = createGame();
      state.day = 31;
      return sceneVisuals(state, i * 500).find(item => item.id === 'honey-0')?.texture;
    }));
    expect(buzzing).toEqual(new Set(['hollowTree:ready', 'hollowTree:bees0', 'hollowTree:bees1']));
  });

  it('draws the garden bed and each seasonal plant frame', () => {
    const state = createGame();
    state.structures.garden = true;
    state.day = 21;
    state.gardenPlots = [
      { plantedYear: 1, harvestedYear: null, harvestReady: false },
      { plantedYear: 1, harvestedYear: null, harvestReady: true },
      { plantedYear: 1, harvestedYear: 1, harvestReady: false }
    ];
    expect(sceneVisuals(state, 0).map(item => item.texture)).toContain('garden:built');
    const thirdPlot = state.gardenPlots[2];
    state.gardenPlots[2] = { plantedYear: null, harvestedYear: null, harvestReady: false };
    expect(sceneVisuals(state, 0).some(item => item.id === 'garden-plant-2')).toBe(false);
    state.gardenPlots[2] = thirdPlot;
    expect(sceneVisuals(state, 0).filter(item => item.id.startsWith('garden-plant-')).map(item => item.texture))
      .toEqual(['gardenPlant:seedling', 'gardenPlant:ripe', 'gardenPlant:dormant']);
    state.day = 31;
    expect(sceneVisuals(state, 0).find(item => item.id === 'garden-plant-0')?.texture).toBe('gardenPlant:growing');
    state.day = 11;
    state.gardenPlots[2].harvestedYear = null;
    expect(sceneVisuals(state, 0).find(item => item.id === 'garden-plant-0')?.texture).toBe('gardenPlant:dormant');
    expect(() => validateSprite(sprites.garden)).not.toThrow();
    expect(() => validateSprite(sprites.gardenPlant)).not.toThrow();
  });

  it('restores the lookout art after repair', () => {
    const state = createGame();
    state.progress.hearthUnlocked = true;
    state.progress.nextStormDay = null;
    state.progress.lookoutRepaired = true;
    expect(sceneVisuals(state, 0).find(item => item.id === 'lookout')?.texture).toBe('lookout:restored');
    expect(() => validateSprite(sprites.lookout)).not.toThrow();
  });

  it('shows chop targets as standing trees or stumps based on regrowth day', () => {
    const state = createGame();
    const tree = state.trees[0];
    expect(sceneVisuals(state, 0).find(item => item.id === tree.id)?.texture).toBe(`${tree.sprite}:still`);
    tree.readyDay = 4;
    expect(sceneVisuals(state, 0).find(item => item.id === tree.id)?.texture).toBe('stump:still');
    state.day = 4;
    expect(sceneVisuals(state, 0).find(item => item.id === tree.id)?.texture).toBe(`${tree.sprite}:still`);
  });

  it('shows marked trees with a tie and felled ones as stumps', () => {
    const state = createGame();
    state.clearing = { cleared: [], marked: 'north-near', felled: [0] };
    const visuals = sceneVisuals(state, 0);
    expect(visuals.find(item => item.id === 'mark-north-near-0')?.texture).toBe('stump:still');
    const standing = CLEARING_STEPS['north-near'].trees;
    for (const index of [1, 2, 3]) expect(visuals.find(item => item.id === `mark-north-near-${index}`)?.texture).toBe(`${standing[index].sprite}:marked`);
    expect(sceneVisuals(createGame(), 0).some(item => item.id.startsWith('mark-'))).toBe(false);
    for (const name of ['treeBroadleaf', 'treePine']) expect(sprites[name].frames.marked, name).toBeDefined();
  });

  it('shows the path places and their searched states', () => {
    const state = createGame();
    const first = sceneVisuals(state, 0);
    expect(first.find(item => item.id === 'site-basket')?.texture).toBe('oldBasket:full');
    expect(first.find(item => item.id === 'site-spring')?.texture).toBe('spring:still');
    expect(first.find(item => item.id === 'site-cairn')?.texture).toBe('cairn:full');
    state.progress.discoveries.basket = true;
    state.progress.discoveries.cairn = true;
    const visited = sceneVisuals(state, 0);
    expect(visited.find(item => item.id === 'site-basket')?.texture).toBe('oldBasket:empty');
    expect(visited.find(item => item.id === 'site-cairn')?.texture).toBe('cairn:empty');
    for (const name of ['oldBasket', 'spring', 'cairn']) expect(() => validateSprite(sprites[name])).not.toThrow();
  });

  it('changes sprite frames when nodes, structures, and the fire change', () => {
    const state = createGame();
    state.nodes[0].amount = 0;
    state.nodes.find(node => node.kind === 'berry')!.amount = 0;
    state.nodes.find(node => node.kind === 'fiber')!.amount = 0;
    state.nodes.find(node => node.kind === 'stone')!.amount = 0;
    state.structures.shelter = true;
    state.structures.bed = true;
    state.structures.hearth = true;
    state.structures.dryingRack = true;
    state.structures.windbreak = true;
    state.fireFuel = 30;
    const keys = sceneVisuals(state, 0).map(item => item.texture);
    expect(keys).toEqual(expect.arrayContaining([
      'branchPile:depleted', 'berryBush:picked', 'fiberReeds:cut', 'pebbles0:still',
      'shelter:builtBed', 'dryingRack:built', 'windbreak:built', 'hearth:burning0'
    ]));
    expect(keys).not.toContain('firePit:unlit');
  });

  it('shows an unlocked hearth site and selects low and windy fire frames', () => {
    const state = createGame();
    state.progress.hearthUnlocked = true;
    state.fireFuel = 20;
    expect(sceneVisuals(state, 0).map(item => item.texture)).toContain('hearthSite:still');
    expect(sceneVisuals(state, 0).map(item => item.texture)).toContain('firePit:low0');
    state.day = 3;
    state.timeOfDay = 200;
    state.progress.nextStormDay = 3;
    expect(sceneVisuals(state, 180).map(item => item.texture)).toContain('firePit:lowWindy1');
    expect(sceneVisuals(state, 180).map(item => item.texture)).toContain('flame:lowWindy1');
    state.structures.hearth = true;
    expect(sceneVisuals(state, 180).map(item => item.texture)).toContain('hearth:lowWindy1');
    expect(sceneVisuals(state, 180).map(item => item.texture)).toContain('hearthFlame:lowWindy1');
    expect(sceneVisuals(state, 180).map(item => item.texture)).not.toContain('hearthSite:still');
  });

  it('blows the fire about on winter nights, but not on autumn nights', () => {
    const state = createGame();
    state.progress = { ...state.progress, hearthUnlocked: true, nextStormDay: null };
    state.fireFuel = 60;
    state.day = 12;
    state.timeOfDay = nightStart(12) + 5;
    expect(sceneVisuals(state, 0).map(item => item.texture)).toContain('firePit:windy0');
    state.day = 8;
    state.timeOfDay = nightStart(8) + 5;
    expect(sceneVisuals(state, 0).map(item => item.texture)).toContain('firePit:burning0');
  });

  it('shows bare bushes and an iced spring in winter', () => {
    const textures = (day: number) => sceneVisuals({ ...createGame(), day }, 0).map(item => item.texture);
    const bushes = (day: number) => textures(day).filter(texture => texture.startsWith('berryBush:'));
    expect(bushes(12).length).toBeGreaterThan(0);
    expect(bushes(12).every(texture => texture === 'berryBush:picked')).toBe(true);
    expect(textures(12)).toContain('spring:frozen');
    expect(bushes(2).every(texture => texture === 'berryBush:ready')).toBe(true);
    expect(textures(2)).toContain('spring:still');
    expect(sprites.spring.frames.frozen).toBeDefined();
  });

  it('circles the fire pit with wolf tracks until the next nightfall', () => {
    const state = { ...createGame(), day: 13, timeOfDay: 30, lastWolf: { day: 12, took: 'ration' as const } };
    const tracks = sceneVisuals(state, 0).find(item => item.texture === 'wolfTracks:still');
    expect(tracks).toMatchObject({ x: Math.round(worldX(BALANCE.campX)), y: Math.round(worldY(BALANCE.campY)), depth: GROUND_DECAL_DEPTH });
    expect(sceneVisuals({ ...state, timeOfDay: nightStart(13) }, 0).some(item => item.texture === 'wolfTracks:still')).toBe(false);
    expect(sceneVisuals({ ...state, area: 'quarry' }, 0).some(item => item.texture === 'wolfTracks:still')).toBe(false);
  });

  it('gathers puddles at camp from the start of a shower until the day ends', () => {
    const puddles = (changes: Partial<ReturnType<typeof createGame>>) =>
      sceneVisuals({ ...createGame(), ...changes }, 0).filter(item => item.texture === 'puddle:still');
    expect(puddles({ day: 22, timeOfDay: 40 })).toHaveLength(4);
    expect(puddles({ day: 22, timeOfDay: 40 }).every(item => item.depth === GROUND_DECAL_DEPTH)).toBe(true);
    expect(puddles({ day: 22, timeOfDay: 200 })).toHaveLength(4);
    expect(puddles({ day: 22, timeOfDay: 20 })).toHaveLength(0);
    expect(puddles({ day: 21, timeOfDay: 40 })).toHaveLength(0);
    expect(puddles({ day: 22, timeOfDay: 40, area: 'quarry' })).toHaveLength(0);
  });

  it('draws loose piles by count', () => {
    const state = createGame();
    state.stonePiles = [{ id: 'p1', x: 5, y: 5, count: 1, area: 'camp' }, { id: 'p2', x: 8, y: 5, count: 2, area: 'camp' }, { id: 'p5', x: 11, y: 5, count: 5, area: 'camp' }];
    const visuals = sceneVisuals(state, 0);
    expect(visuals.find(item => item.id === 'p1')?.texture).toBe('looseStones:one');
    expect(visuals.find(item => item.id === 'p2')?.texture).toBe('looseStones:two');
    expect(visuals.find(item => item.id === 'p5')?.texture).toBe('looseStones:many');
    expect(() => validateSprite(sprites.looseStones)).not.toThrow();
  });

  it('labels loose piles of two or more with their count above the stones', () => {
    const state = createGame();
    state.stonePiles = [{ id: 'p1', x: 5, y: 5, count: 1, area: 'camp' }, { id: 'p3', x: 8, y: 5, count: 3, area: 'camp' }, { id: 'p12', x: 11, y: 5, count: 12, area: 'camp' }];
    const visuals = sceneVisuals(state, 0);
    expect(visuals.find(item => item.id === 'p1-count')).toBeUndefined();
    const label = visuals.find(item => item.id === 'p3-count')!;
    const pile = visuals.find(item => item.id === 'p3')!;
    expect(label.texture).toBe('pileCount:n3');
    expect(label.y).toBeLessThan(pile.y);
    expect(label.depth).toBeGreaterThan(pile.depth);
    expect(visuals.find(item => item.id === 'p12-count')?.texture).toBe('pileCount:lots');
    expect(() => validateSprite(sprites.pileCount)).not.toThrow();
  });

  it('draws the stone pile site, then the built pile', () => {
    const state = createGame();
    const site = sceneVisuals(state, 0).find(item => item.id === 'stonePile')!;
    expect(site.texture).toBe('stonePileSite:still');
    expect(site.depth).toBe(GROUND_DECAL_DEPTH);
    state.structures.stonePile = true;
    const built = sceneVisuals(state, 0).find(item => item.id === 'stonePile')!;
    expect(built.texture).toBe('stonePile:built');
    expect(built.depth).toBe(built.y);
    for (const name of ['stonePile', 'stonePileSite']) expect(() => validateSprite(sprites[name])).not.toThrow();
  });

  it('keeps hearth construction marks below standing objects', () => {
    const state = createGame();
    state.progress.hearthUnlocked = true;
    const site = sceneVisuals(state, 0).find(item => item.id === 'hearthSite')!;
    expect(site.depth).toBe(GROUND_DECAL_DEPTH);
    expect(site.depth).toBeLessThan(playerVisualDepth(state));
    expect(sceneVisuals(state, 0).find(item => item.id === 'logSeat')!.depth).toBeGreaterThan(site.depth);
  });

  it('sways ready reeds out of step while cut reeds stay still', () => {
    const state = createGame();
    const fiber = state.nodes.filter(node => node.kind === 'fiber');
    const atStart = sceneVisuals(state, 0).filter(item => fiber.some(node => node.id === item.id));
    const later = sceneVisuals(state, 800).filter(item => fiber.some(node => node.id === item.id));
    expect(atStart.some((item, i) => item.texture !== later[i].texture)).toBe(true);
    fiber[0].amount = 0;
    expect(sceneVisuals(state, 800).find(item => item.id === fiber[0].id)?.texture).toBe('fiberReeds:cut');
  });

  it('plays a brief berry rustle after gathering before showing the picked bush', () => {
    const state = createGame();
    const berry = state.nodes.find(node => node.kind === 'berry')!;
    berry.amount = 0;
    expect(sceneVisuals(state, 100, { id: berry.id, atMs: 100 }).find(item => item.id === berry.id)?.texture).toBe('berryBush:rustle0');
    expect(sceneVisuals(state, 250, { id: berry.id, atMs: 100 }).find(item => item.id === berry.id)?.texture).toBe('berryBush:rustle1');
    expect(sceneVisuals(state, 450, { id: berry.id, atMs: 100 }).find(item => item.id === berry.id)?.texture).toBe('berryBush:picked');
  });

  it('keeps every new scene sprite on an integer pixel grid', () => {
    for (const name of ['berryBush', 'fiberReeds', 'shelter', 'dryingRack', 'windbreak', 'firePit', 'hearth', 'flame', 'survivor', 'bird', 'fox', 'firefly']) {
      const def = sprites[name];
      expect(def, name).toBeDefined();
      expect(() => validateSprite(def), name).not.toThrow();
    }
    expect(sceneVisuals(createGame(), 0).find(item => item.id === 'fire')?.x).toBe((BALANCE.campX + 0.5) * 16);
  });

  it('layers night over the entire world and lights and weather over night', () => {
    const bottomEdge = BALANCE.mapHeight * 16;
    expect(NIGHT_DEPTH).toBeGreaterThan(bottomEdge);
    expect(LIGHT_DEPTH).toBeGreaterThan(NIGHT_DEPTH);
    expect(WEATHER_DEPTH).toBeGreaterThan(LIGHT_DEPTH);
  });

  it('keeps the survivor visible when standing at the lit fire', () => {
    const state = createGame();
    state.player.x = BALANCE.campX;
    state.player.y = BALANCE.campY;
    state.fireFuel = 20;
    expect(playerVisualDepth(state)).toBeGreaterThan(LIGHT_DEPTH);
    expect(playerVisualDepth(state)).toBeLessThan(WEATHER_DEPTH);
    state.player.x += 2;
    expect(playerVisualDepth(state)).toBe((state.player.y + 0.5) * 16);
    state.player.x = BALANCE.campX;
    state.fireFuel = 0;
    expect(playerVisualDepth(state)).toBe((state.player.y + 0.5) * 16);
  });
});

describe('the quarry area', () => {
  const quarryState = () => ({ ...createGame(), area: 'quarry' as const });

  it('the quarry area shows only its own things', () => {
    const state = quarryState();
    state.stonePiles = [{ id: 'here', x: 14, y: 14, count: 1, area: 'quarry' }, { id: 'there', x: 5, y: 5, count: 1, area: 'camp' }];
    state.fireFuel = 40;
    state.timeOfDay = 200;
    const visuals = sceneVisuals(state, 0);
    const ids = visuals.map(item => item.id);
    const keys = visuals.map(item => item.texture);
    expect(keys).toContain('quarry:ready');
    expect(keys).toContain('rubble:ready');
    expect(ids).toContain('here');
    expect(ids).not.toContain('there');
    for (const node of state.nodes) expect(ids).not.toContain(node.id);
    for (const tree of state.trees) expect(ids).not.toContain(tree.id);
    for (const id of ['shelter', 'dryingRack', 'windbreak', 'stonePile', 'toolshed', 'logSeat', 'hearthSite', 'fire', 'flame', 'lookout', 'site-basket', 'site-spring', 'site-cairn'])
      expect(ids).not.toContain(id);
    const quarry = visuals.find(item => item.id === 'quarry')!;
    expect(quarry.x).toBe((QUARRY_SITE.x + 0.5) * 16);
    expect(visuals.find(item => item.id === 'rubble')!.y).toBe((RUBBLE_SITE.y + 0.5) * 16);
    for (const item of visuals) expect(item.depth).toBe(item.y);
  });

  it('spent quarry and gathered rubble', () => {
    const state = quarryState();
    state.quarryReadyDay = state.day + 1;
    state.rubbleReadyDay = state.day + 3;
    const keys = sceneVisuals(state, 0).map(item => item.texture);
    expect(keys).toContain('quarry:spent');
    expect(keys).toContain('rubble:gathered');
    state.day += 3;
    expect(sceneVisuals(state, 0).map(item => item.texture)).toEqual(expect.arrayContaining(['quarry:ready', 'rubble:ready']));
    for (const name of ['quarry', 'rubble']) expect(() => validateSprite(sprites[name])).not.toThrow();
  });

  it('the toolshed site, then the toolshed', () => {
    const state = createGame();
    const site = sceneVisuals(state, 0).find(item => item.id === 'toolshed')!;
    expect(site.texture).toBe('toolshedSite:still');
    expect(site.depth).toBe(GROUND_DECAL_DEPTH);
    state.structures.toolshed = true;
    const built = sceneVisuals(state, 0).find(item => item.id === 'toolshed')!;
    expect(built.texture).toBe('toolshed:built');
    expect(built.depth).toBe(built.y);
    for (const name of ['toolshed', 'toolshedSite']) expect(() => validateSprite(sprites[name])).not.toThrow();
  });

  it('the camp view never shows quarry-area piles', () => {
    const state = createGame();
    state.stonePiles = [{ id: 'here', x: 5, y: 5, count: 3, area: 'camp' }, { id: 'away', x: 8, y: 5, count: 3, area: 'quarry' }];
    const ids = sceneVisuals(state, 0).map(item => item.id);
    expect(ids).toEqual(expect.arrayContaining(['here', 'here-count']));
    expect(ids).not.toContain('away');
    expect(ids).not.toContain('away-count');
    expect(ids).not.toContain('quarry');
    expect(ids).not.toContain('rubble');
  });

  it('keeps the survivor in normal depth order by the quarry, with no camp fire there', () => {
    const state = quarryState();
    state.player.x = BALANCE.campX;
    state.player.y = BALANCE.campY;
    state.fireFuel = 20;
    expect(playerVisualDepth(state)).toBe((state.player.y + 0.5) * 16);
  });

  it('hangs the pot on its tripod over the fire once made, steaming while the fire burns', () => {
    const state = createGame();
    expect(sceneVisuals(state, 0).some(item => item.id === 'potTripod')).toBe(false);
    state.progress.potCrafted = true;
    const fire = sceneVisuals(state, 0).find(item => item.id === 'fire')!;
    const still = sceneVisuals(state, 0).find(item => item.id === 'potTripod')!;
    expect(still).toMatchObject({ texture: 'potTripod:still', x: fire.x, y: fire.y });
    expect(still.depth).toBeGreaterThan(fire.depth);
    state.fireFuel = 40;
    expect(sceneVisuals(state, 0).find(item => item.id === 'potTripod')!.texture).toBe('potTripod:steaming0');
    expect(sceneVisuals(state, 600).find(item => item.id === 'potTripod')!.texture).toBe('potTripod:steaming1');
    expect(() => validateSprite(sprites.potTripod)).not.toThrow();
    for (const frame of ['still', 'steaming0', 'steaming1']) expect(sprites.potTripod.frames[frame], frame).toBeDefined();
  });
});

describe('the larder', () => {
  const north = { cleared: ['north-near' as const], marked: null, felled: [] };
  const larder = (state: ReturnType<typeof createGame>) => sceneVisuals(state, 0).find(item => item.id === 'larder');

  it('is not drawn until the north side\'s near ground is cleared', () => {
    expect(larder(createGame())).toBeUndefined();
    const built = createGame();
    built.structures.larder = true;
    expect(larder(built)).toBeUndefined();
  });

  it('draws a flat site on the cleared ground, then the raised cache showing what it keeps', () => {
    const state = { ...createGame(), clearing: north };
    expect(larder(state)).toMatchObject({ texture: 'larderSite:still', depth: GROUND_DECAL_DEPTH });
    state.structures.larder = true;
    expect(larder(state)!.texture).toBe('larder:empty');
    expect(larder(state)!.depth).toBe(larder(state)!.y);
    const kept = (berries: number) => larder({ ...state, larder: stock(berries) })!.texture;
    expect([kept(1), kept(6), kept(7), kept(10)]).toEqual(['larder:some', 'larder:some', 'larder:full', 'larder:full']);
    for (const name of ['larder', 'larderSite']) expect(() => validateSprite(sprites[name])).not.toThrow();
    for (const frame of ['empty', 'some', 'full']) expect(sprites.larder.frames[frame], frame).toBeDefined();
  });
});

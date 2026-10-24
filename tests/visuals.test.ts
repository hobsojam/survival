import { describe, expect, it } from 'vitest';
import { BALANCE, createGame } from '../src/game/state';
import { sceneVisuals, playerVisualDepth, GROUND_DECAL_DEPTH, NIGHT_DEPTH, LIGHT_DEPTH, WEATHER_DEPTH } from '../src/scene/visuals';
import { sprites } from '../src/art/sprites';
import { validateSprite } from '../src/art/textures';

describe('native-size scene art', () => {
  it('selects pixel textures for every resource and camp site', () => {
    const visuals = sceneVisuals(createGame(), 0);
    const keys = visuals.map(item => item.texture);
    expect(keys).toContain('branchPile:ready');
    expect(keys).toContain('berryBush:ready');
    expect(keys).toContain('fiberReeds:ready');
    expect(keys).toContain('rock0:still');
    expect(keys).toContain('shelterSite:still');
    expect(keys).toContain('crateSite:still');
    expect(keys).toContain('dryingRackSite:still');
    expect(keys).toContain('windbreakSite:still');
    expect(keys).toContain('logSeat:still');
    expect(keys).toContain('lookout:damaged');
    expect(keys).toContain('firePit:unlit');
    expect(keys).not.toContain('hearthSite:still');
    const sites = new Set(['shelter', 'crate', 'dryingRack', 'windbreak']);
    for (const item of visuals) {
      const [name, frame] = item.texture.split(':');
      expect(sprites[name]?.frames[frame], item.texture).toBeDefined();
      expect(Number.isInteger(item.x) && Number.isInteger(item.y)).toBe(true);
      expect(item.depth).toBe(sites.has(item.id) ? GROUND_DECAL_DEPTH : item.y);
    }
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
    state.structures.crate = true;
    state.structures.hearth = true;
    state.structures.dryingRack = true;
    state.structures.windbreak = true;
    state.fireFuel = 30;
    const keys = sceneVisuals(state, 0).map(item => item.texture);
    expect(keys).toEqual(expect.arrayContaining([
      'branchPile:depleted', 'berryBush:picked', 'fiberReeds:cut', 'pebbles0:still',
      'shelter:builtBed', 'crate:built', 'dryingRack:built', 'windbreak:built', 'hearth:burning0'
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
    for (const name of ['berryBush', 'fiberReeds', 'shelter', 'crate', 'dryingRack', 'windbreak', 'firePit', 'hearth', 'flame', 'survivor', 'bird', 'fox', 'firefly']) {
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

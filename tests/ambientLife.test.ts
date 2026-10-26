import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGame } from '../src/game/state';
import { worldX } from '../src/scene/art';
import { BIRD_HOMES, EYE_SPOTS } from '../src/scene/ambient';
import { AmbientLife } from '../src/scene/ambientLife';

function sceneWithImages() {
  const images: Array<{ kind: string; texture: string; x: number; visible: boolean }> = [];
  const scene = {
    add: {
      image: (_x: number, _y: number, key: string) => {
        const image = {
          // What the image was made as (bird, fox, eyes...), so tests don't depend on creation order.
          kind: key.split(':')[0], texture: key, x: 0, visible: false,
          setOrigin() { return this; },
          setDepth() { return this; },
          setVisible(value: boolean) { this.visible = value; return this; },
          setTexture(value: string) { this.texture = value; return this; },
          setPosition(x: number) { this.x = x; return this; },
          setFlipX() { return this; },
          setAlpha() { return this; }
        };
        images.push(image);
        return image;
      }
    }
  };
  const of = (kind: string) => images.filter(image => image.kind === kind);
  return { scene, images, of };
}

describe('ambient bird foraging', () => {
  afterEach(() => vi.restoreAllMocks());

  it('flies to a berry bush and pecks without taking the player’s berries', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.49);
    const { scene, of } = sceneWithImages();
    const life = new AmbientLife(scene as never);
    const bird = of('bird')[0];
    const state = createGame();
    const berriesBefore = state.nodes.filter(node => node.kind === 'berry').map(node => node.amount);
    life.update(state, 0, 0);
    life.update(state, 1.6, 1600);
    life.update(state, 0.1, 1700);
    expect(bird.visible).toBe(true);
    expect(bird.texture).toMatch(/^bird:peck/);
    expect(bird.x).not.toBe(Math.round(worldX(BIRD_HOMES[0].x)));
    life.update(state, 0.1, 5200);
    life.update(state, 1.6, 6800);
    life.update(state, 0.1, 6900);
    expect(bird.x).toBe(Math.round(worldX(BIRD_HOMES[0].x)));
    expect(state.nodes.filter(node => node.kind === 'berry').map(node => node.amount)).toEqual(berriesBefore);
  });

  it('flees from a bush when the survivor approaches', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.49);
    const { scene, of } = sceneWithImages();
    const life = new AmbientLife(scene as never);
    const bird = of('bird')[0];
    const state = createGame();
    life.update(state, 0, 0);
    life.update(state, 1.6, 1600);
    life.update(state, 0.1, 1700);
    state.player.x = 16;
    state.player.y = 18;
    life.update(state, 0.1, 1800);
    expect(bird.visible).toBe(false);
    life.update(state, 0.1, 1900);
    expect(bird.texture).toMatch(/^bird:fly/);
  });
});

describe('ambient life by area', () => {
  it('hides the birds, the fox and the fireflies in the quarry area', () => {
    const { scene, images, of } = sceneWithImages();
    const life = new AmbientLife(scene as never);
    const state = createGame();
    // A summer night, when the fireflies are out.
    state.day = 32;
    state.timeOfDay = 220;
    life.update(state, 0.1, 0);
    expect(images.some(image => image.visible)).toBe(true);
    life.update({ ...state, area: 'quarry' }, 0.1, 100);
    expect(images.filter(image => image.kind !== 'eyes' && image.visible)).toEqual([]);
    life.update({ ...state, area: 'quarry', day: 2, timeOfDay: 60 }, 0.1, 1000);
    expect(of('leaf').filter(image => image.visible)).toEqual([]);
  });
});

describe('seasonal life at camp', () => {
  const glowing = (day: number) => {
    const { scene, of } = sceneWithImages();
    const life = new AmbientLife(scene as never);
    const state = { ...createGame(), day, timeOfDay: 230 };
    let seen = 0;
    for (let t = 0; t < 4000; t += 250) { life.update(state, 0.25, t); seen += of('firefly').filter(image => image.visible).length; }
    return seen;
  };

  it('brings out the fireflies on summer nights only', () => {
    expect(glowing(31)).toBeGreaterThan(0);
    expect(glowing(1)).toBe(0);
    expect(glowing(21)).toBe(0);
  });

  it('lets leaves fall on autumn days only', () => {
    const falling = (day: number) => {
      const { scene, of } = sceneWithImages();
      const life = new AmbientLife(scene as never);
      const state = { ...createGame(), day, timeOfDay: 60 };
      let seen = 0;
      for (let t = 0; t < 9000; t += 500) { life.update(state, 0.5, t); seen += of('leaf').filter(image => image.visible).length; }
      return seen;
    };
    expect(falling(1)).toBeGreaterThan(0);
    expect(falling(11)).toBe(0);
  });
});

describe('ambient quarry eyes', () => {
  it('shows no eyes at camp, by day or by night', () => {
    const { scene, of } = sceneWithImages();
    const life = new AmbientLife(scene as never);
    const eyes = of('eyes');
    expect(eyes).toHaveLength(EYE_SPOTS.length);
    const state = createGame();
    state.timeOfDay = 200;
    for (let t = 0; t < 12000; t += 500) life.update(state, 0.5, t);
    expect(eyes.every(image => !image.visible)).toBe(true);
  });

  it('shows some eyes at the quarry at night, none by day', () => {
    const { scene, of } = sceneWithImages();
    const life = new AmbientLife(scene as never);
    const eyes = of('eyes');
    const state = createGame();
    state.area = 'quarry';
    state.player.x = 38; state.player.y = 2;
    state.timeOfDay = 10;
    life.update(state, 0.5, 3000);
    expect(eyes.every(image => !image.visible)).toBe(true);
    state.timeOfDay = 200;
    life.update(state, 0.5, 3000);
    expect(eyes.some(image => image.visible)).toBe(true);
  });
});

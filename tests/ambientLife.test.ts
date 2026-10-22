import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGame } from '../src/game/state';
import { worldX } from '../src/scene/art';
import { BIRD_HOMES } from '../src/scene/ambient';
import { AmbientLife } from '../src/scene/ambientLife';

function sceneWithImages() {
  const images: Array<{ texture: string; x: number; visible: boolean }> = [];
  const scene = {
    add: {
      image: () => {
        const image = {
          texture: '', x: 0, visible: false,
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
  return { scene, images };
}

describe('ambient bird foraging', () => {
  afterEach(() => vi.restoreAllMocks());

  it('flies to a berry bush and pecks without taking the player’s berries', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.49);
    const { scene, images } = sceneWithImages();
    const life = new AmbientLife(scene as never);
    const state = createGame();
    const berriesBefore = state.nodes.filter(node => node.kind === 'berry').map(node => node.amount);
    life.update(state, 0, 0);
    life.update(state, 1.6, 1600);
    life.update(state, 0.1, 1700);
    expect(images[0].visible).toBe(true);
    expect(images[0].texture).toMatch(/^bird:peck/);
    expect(images[0].x).not.toBe(Math.round(worldX(BIRD_HOMES[0].x)));
    life.update(state, 0.1, 5200);
    life.update(state, 1.6, 6800);
    life.update(state, 0.1, 6900);
    expect(images[0].x).toBe(Math.round(worldX(BIRD_HOMES[0].x)));
    expect(state.nodes.filter(node => node.kind === 'berry').map(node => node.amount)).toEqual(berriesBefore);
  });

  it('flees from a bush when the survivor approaches', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.49);
    const { scene, images } = sceneWithImages();
    const life = new AmbientLife(scene as never);
    const state = createGame();
    life.update(state, 0, 0);
    life.update(state, 1.6, 1600);
    life.update(state, 0.1, 1700);
    state.player.x = 16;
    state.player.y = 18;
    life.update(state, 0.1, 1800);
    expect(images[0].visible).toBe(false);
    life.update(state, 0.1, 1900);
    expect(images[0].texture).toMatch(/^bird:fly/);
  });
});

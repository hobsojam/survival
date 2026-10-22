import Phaser from 'phaser';
import type { GameState, ResourceKind } from '../game/state';
import { sprites } from '../art/sprites';
import { effectVisuals, type EffectEvent, type EffectKind } from './effectVisuals';

/** Sprite effects are scene-local and never enter the saved game state. */
export class SceneEffects {
  private readonly images = new Map<string, Phaser.GameObjects.Image>();
  private events: EffectEvent[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  trigger(kind: EffectKind, timeMs: number, x: number, y: number, resource?: ResourceKind): void {
    this.events.push({ kind, startedAtMs: timeMs, x, y, resource });
  }

  update(state: GameState, timeMs: number): void {
    this.events = this.events.filter(event => timeMs - event.startedAtMs < 30000);
    const shown = new Set<string>();
    for (const effect of effectVisuals(state, timeMs, this.events)) {
      shown.add(effect.id);
      let image = this.images.get(effect.id);
      if (!image) {
        const [name] = effect.texture.split(':');
        const art = sprites[name];
        image = this.scene.add.image(effect.x, effect.y, effect.texture)
          .setOrigin(art.anchor[0] / art.size[0], art.anchor[1] / art.size[1]);
        this.images.set(effect.id, image);
      }
      if (image.texture.key !== effect.texture) image.setTexture(effect.texture);
      image.setPosition(effect.x, effect.y).setDepth(effect.depth).setAlpha(effect.alpha).setVisible(true);
    }
    for (const [id, image] of this.images) if (!shown.has(id)) { image.destroy(); this.images.delete(id); }
  }
}

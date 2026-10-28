import Phaser from 'phaser';
import type { GameState } from '../game/state';
import { BALANCE } from '../game/state';
import { FIREFLY_HOMES, fireflyGlow, fireflyOffset } from './ambient';
import { firefliesOut } from '../game/calendar';
import { worldX, worldY } from './art';
import { fireGlow, lightMaskPixels, lightScreenPosition, lightingTint, withSunrise, type LightRadii } from './lighting';
import { NIGHT_DEPTH } from './visuals';

/** One screen-sized tint with palette-aware, stepped light holes erased from it. */
export class SceneLighting {
  private readonly layer: Phaser.GameObjects.RenderTexture;

  constructor(private readonly scene: Phaser.Scene, width: number, height: number) {
    this.layer = scene.add.renderTexture(0, 0, width, height)
      .setOrigin(0).setScrollFactor(0).setDepth(NIGHT_DEPTH);
  }

  resize(width: number, height: number): void {
    this.layer.resize(width, height, false);
  }

  /** Draws the tint for the state; a sunrise that began sunriseAgeMs ago warms it for a few seconds. */
  update(state: GameState, timeMs: number, sunriseAgeMs: number): void {
    const tint = withSunrise(lightingTint(state), sunriseAgeMs);
    if (tint.alpha <= 0) {
      this.layer.setVisible(false);
      return;
    }
    this.layer.setVisible(true);
    this.layer.clear();
    this.layer.fill(tint.color, tint.alpha);
    const camera = this.scene.cameras.main;
    const radii = fireGlow(state, timeMs);
    if (radii) {
      const position = lightScreenPosition(worldX(BALANCE.campX), worldY(BALANCE.campY), camera.scrollX, camera.scrollY);
      this.layer.erase(this.mask(radii), position.x, position.y);
    }
    // Fireflies live at camp and only come out in summer.
    if (state.area === 'camp' && firefliesOut(state.day)) FIREFLY_HOMES.forEach((home, index) => {
      const glow = fireflyGlow(index, timeMs, tint.alpha / 0.55);
      if (glow < 0.08) return;
      const offset = fireflyOffset(index, timeMs);
      const position = lightScreenPosition(worldX(home.x + offset.x), worldY(home.y + offset.y), camera.scrollX, camera.scrollY);
      const strength = Math.min(1, Math.ceil(glow * 4) / 4);
      this.layer.erase(this.mask({ inner: 1, middle: 3, outer: 5 }, strength), position.x, position.y);
    });
    this.layer.render();
  }

  private mask(radii: LightRadii, strength = 1): string {
    const key = `lighting:${radii.inner}:${radii.middle}:${radii.outer}:${strength}`;
    if (this.scene.textures.exists(key)) return key;
    const { size, pixels } = lightMaskPixels(radii);
    if (strength < 1) for (let offset = 3; offset < pixels.length; offset += 4)
      pixels[offset] = Math.round(pixels[offset] * strength);
    const texture = this.scene.textures.createCanvas(key, size, size);
    if (!texture) throw new Error(`Could not create light mask ${key}.`);
    const image = texture.context.createImageData(size, size);
    image.data.set(pixels);
    texture.context.putImageData(image, 0, 0);
    texture.refresh();
    return key;
  }
}

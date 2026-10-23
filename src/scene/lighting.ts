import type { GameState } from '../game/state';
import { BALANCE } from '../game/state';
import { isColdNight } from '../game/rules';
import { palette } from '../art/palette';
import { darkness } from './ambient';

export interface LightingTint { color: number; alpha: number }
export interface LightRadii { inner: number; middle: number; outer: number }

const color = (hex: string): number => parseInt(hex.slice(1), 16);
const mixColor = (from: number, to: number, amount: number): number => {
  const channel = (shift: number) => Math.round(((from >> shift) & 255) * (1 - amount) + ((to >> shift) & 255) * amount);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
};

export function lightingTint(state: GameState): LightingTint {
  const time = state.timeOfDay;
  if (state.day > 1 && time < 25) {
    if (time <= 12.5) return {
      color: mixColor(color(palette.night), color(palette.dawn), time / 12.5),
      alpha: 0.55 + (0.15 - 0.55) * time / 12.5
    };
    return { color: color(palette.dawn), alpha: 0.15 * (25 - time) / 12.5 };
  }
  if (time >= BALANCE.nightStart) {
    const storm = isColdNight(state);
    return { color: color(storm ? palette.storm : palette.night), alpha: darkness(state.day, time) * (storm ? 0.64 : 0.55) };
  }
  const duskStart = BALANCE.nightStart - 30;
  const alpha = time > duskStart ? 0.12 * (time - duskStart) / 30 : 0;
  return { color: color(palette.dusk), alpha };
}

/** Fire radii are whole art pixels. The frame sequence matches the 180 ms flame cycle. */
export function fireRadii(fuel: number, hearth: boolean, timeMs: number): LightRadii | null {
  if (fuel <= 0) return null;
  const strength = 0.6 + 0.4 * Math.min(1, fuel / 60);
  const phase = Math.floor(timeMs / 180) % 4;
  const flicker = [0, 1, 0, -1][phase];
  const extra = hearth ? 1 : 0;
  return {
    inner: Math.round(18 * strength) + flicker + extra,
    middle: Math.round(36 * strength) + flicker + extra,
    outer: Math.round(54 * strength) + flicker + extra
  };
}

/** A white alpha mask for ERASE blending into the lighting RenderTexture. */
export function lightMaskPixels(radii: LightRadii): { size: number; pixels: Uint8ClampedArray } {
  const size = radii.outer * 2 + 1;
  const pixels = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const distanceSquared = (x - radii.outer) ** 2 + (y - radii.outer) ** 2;
    let alpha = 0;
    if (distanceSquared <= radii.outer ** 2) alpha = 77;
    if (distanceSquared <= radii.middle ** 2) alpha = 153;
    if (distanceSquared <= radii.inner ** 2) alpha = 255;
    const offset = (y * size + x) * 4;
    pixels[offset] = 255;
    pixels[offset + 1] = 255;
    pixels[offset + 2] = 255;
    pixels[offset + 3] = alpha;
  }
  return { size, pixels };
}

export function lightScreenPosition(worldX: number, worldY: number, scrollX: number, scrollY: number): { x: number; y: number } {
  return { x: Math.round(worldX - scrollX), y: Math.round(worldY - scrollY) };
}

import { duskLength, isSummer, nightStart } from '../game/calendar';
import type { GameState } from '../game/state';
import { isFreezingNight } from '../game/rules';
import { rainFade } from '../game/rain';
import { coldNightApproach } from '../game/coldNight';
import { palette } from '../art/palette';
import { darkness } from './ambient';
import { fireplaceBurning } from '../game/home';

export interface LightingTint { color: number; alpha: number }
export interface LightRadii { inner: number; middle: number; outer: number }

const color = (hex: string): number => Number.parseInt(hex.slice(1), 16);
const mixColor = (from: number, to: number, amount: number): number => {
  const channel = (shift: number) => Math.round(((from >> shift) & 255) * (1 - amount) + ((to >> shift) & 255) * amount);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
};

/** Freezing nights take a deep icy blue, still dark but plainly bluer than an ordinary night. */
export const ICY_NIGHT = mixColor(color(palette.storm), color(palette.flower4), 0.15);

/** How long the warm sunrise lasts after the fire held through the cold night. */
export const SUNRISE_MS = 6000;

/** Lays a golden sunrise over the tint, fading out over SUNRISE_MS. */
export function withSunrise(tint: LightingTint, ageMs: number): LightingTint {
  const left = 1 - ageMs / SUNRISE_MS;
  if (left <= 0) return tint;
  const glow = 0.24 * left;
  return { color: mixColor(tint.color, color(palette.golden), glow / (glow + tint.alpha)), alpha: Math.max(glow, tint.alpha) };
}

export function lightingTint(state: GameState): LightingTint {
  const time = state.timeOfDay;
  if (state.day > 1 && time < 25) {
    if (time <= 12.5) return {
      color: mixColor(color(palette.night), color(palette.dawn), time / 12.5),
      alpha: 0.55 + (0.15 - 0.55) * time / 12.5
    };
    return { color: color(palette.dawn), alpha: 0.15 * (25 - time) / 12.5 };
  }
  if (time >= nightStart(state.day)) {
    const storm = isFreezingNight(state);
    return { color: storm ? ICY_NIGHT : color(palette.night), alpha: darkness(state.day, time) * (storm ? 0.64 : 0.55) };
  }
  // Summer evenings glow gold, longer and a little stronger.
  const summer = isSummer(state.day);
  const length = duskLength(state.day);
  const duskStart = nightStart(state.day) - length;
  const duskStrength = summer ? 0.16 : 0.12;
  const dusk = time > duskStart ? duskStrength * (time - duskStart) / length : 0;
  // On the cold night's day the afternoon greys and the dusk comes in icy rather than gold.
  const cold = coldNightApproach(state);
  // The blue takes over early, since halfway between gold and blue is only grey.
  const glow = mixColor(color(summer ? palette.golden : palette.dusk), ICY_NIGHT, Math.min(1, cold * 3));
  const alpha = Math.max(dusk, 0.34 * cold);
  // A shower greys the day as it builds and eases off; a late one shares the sky with the dusk glow.
  const rain = 0.18 * rainFade(state);
  if (rain <= 0) return { color: glow, alpha };
  return { color: mixColor(glow, color(palette.storm), rain / (rain + alpha)), alpha: Math.max(rain, alpha) };
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

/** The camp fire's glow, or null when it's out or the survivor is in another area. */
export function fireGlow(state: GameState, timeMs: number): LightRadii | null {
  if (state.area !== 'camp') return null;
  return fireRadii(state.fireFuel, state.structures.hearth, timeMs);
}

/** The house window's small warm glow at night while the fireplace burns, or null when it's out or the survivor is in another area. */
export function houseGlow(state: GameState): LightRadii | null {
  if (state.area !== 'camp' || !fireplaceBurning(state)) return null;
  return { inner: 5, middle: 11, outer: 18 };
}

/** Where the house's light sits, in world pixels from the house's foot: the window, 6 across and 9 up. */
export const HOUSE_WINDOW_OFFSET = { x: 6, y: -9 } as const;

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

import type { Season } from '../game/calendar';
import { palette, type PaletteKey } from './palette';

const ramp = (prefix: 'grass' | 'crown' | 'leaf' | 'path', colors: string): Partial<Record<PaletteKey, string>> =>
  Object.fromEntries(colors.split(' ').map((color, index) => [`${prefix}${index}`, color]));

/** Summer is the painted look; the other seasons recolour the grass and the trees. */
const OVERRIDES: Record<Season, Partial<Record<PaletteKey, string>>> = {
  autumn: {
    ...ramp('grass', '#3f4a2c #5a6b35 #7d8a40 #a3a24c #c9b862'),
    ...ramp('crown', '#4a1e14 #8a3418 #c25a24 #e88a3e #f2c25a')
  },
  winter: {
    ...ramp('grass', '#8a98a8 #b4c2cc #d4e0e6 #e6eef0 #f6fafa'),
    ...ramp('crown', '#2e2420 #4a3a32 #6b5a4c #8a7a6a #b0a494'),
    ...ramp('leaf', '#142826 #1c3a32 #2a5040 #3e6a50 #c8dce0'),
    ...ramp('path', '#6a7480 #8a96a2 #aab6c0 #c4ced6 #dce4ea')
  },
  spring: {
    ...ramp('grass', '#33603a #457a42 #64a04a #86bc52 #b4d866'),
    ...ramp('crown', '#1f4a3a #2f6b44 #5a9a4c #86c05a #b8e07a')
  },
  summer: {}
};

export function seasonPalette(s: Season): Record<PaletteKey, string> {
  return { ...palette, ...OVERRIDES[s] };
}

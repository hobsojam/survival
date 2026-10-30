import { season, type Season } from './calendar';
import type { FoodItem } from './food';
import { rainWindow } from './rain';
import { BALANCE, type GameState, type ResourceKind, type ResourceNode } from './state';

// Wild food that comes and goes with the year: each kind of spot is there only in its season.

export type ForageKind = Extract<ResourceKind, 'hazel' | 'pine' | 'greens' | 'honey'>;

export const FORAGE: Record<ForageKind, { season: Season; item: FoodItem; regrowDays: number }> = {
  hazel: { season: 'autumn', item: 'hazelnut', regrowDays: 1 },
  pine: { season: 'winter', item: 'pineNeedles', regrowDays: 1 },
  greens: { season: 'spring', item: 'greens', regrowDays: 1 },
  honey: { season: 'summer', item: 'honey', regrowDays: BALANCE.honeyRegrowDays }
};

/** Greens patches that come up only once a spring shower has started that day. */
export const SHOWER_GREENS: readonly string[] = ['greens-3', 'greens-4'];

export function isForage(kind: ResourceKind): kind is ForageKind {
  return Object.hasOwn(FORAGE, kind);
}

/** Whether a node is there to see and gather now: forage kinds only in their season; shower greens only from the start of that day's shower. */
export function nodeShown(state: GameState, node: ResourceNode): boolean {
  if (!isForage(node.kind)) return true;
  if (season(state.day) !== FORAGE[node.kind].season) return false;
  if (!SHOWER_GREENS.includes(node.id)) return true;
  const shower = rainWindow(state.day);
  return shower !== null && state.timeOfDay >= shower.start;
}

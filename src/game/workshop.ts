import { availableFiber, availableStone, availableWood, isInClearing } from './camp';
import { TOO_TIRED_MESSAGE, isExhausted } from './needs';
import { BALANCE, type GameState } from './state';

// The workshop on the east far ground, and the three upgrades made there once each: a saw that doubles the wood from
// felling, a handcart that catches felled wood, and bed tools that keep a dry vegetable bed alive a day longer.

export type UpgradeId = 'saw' | 'handcart' | 'bedTools';

type Cost = { wood: number; fiber: number; stone: number };

export const WORKSHOP_UPGRADES: Record<UpgradeId, { name: string; cost: Cost }> = {
  saw: { name: 'saw', cost: { wood: 3, fiber: 0, stone: 3 } },
  handcart: { name: 'handcart', cost: { wood: 8, fiber: 2, stone: 1 } },
  bedTools: { name: 'bed tools', cost: { wood: 3, fiber: 1, stone: 1 } }
};

export const UPGRADE_MESSAGES: Record<UpgradeId, string> = {
  saw: 'You made a saw. A felled tree gives twice the wood now.',
  handcart: 'You built a handcart. Felled wood goes into the cart now.',
  bedTools: 'You made a hoe and a watering can. A dry bed holds on a day longer before it withers.'
};

/** "3 wood and 3 stone", or "8 wood, 2 fiber, and 1 stone": the cost's parts, leaving out any it doesn't need. */
export function costPhrase(cost: Cost): string {
  const parts = (['wood', 'fiber', 'stone'] as const).filter(key => cost[key] > 0).map(key => `${cost[key]} ${key}`);
  if (parts.length < 3) return parts.join(' and ');
  return `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}`;
}

/** Why an upgrade can't be made right now, or null if it can. Its cost can come from the bag and the camp stores. */
export function upgradeBlocker(state: GameState, id: UpgradeId): string | null {
  const { name, cost } = WORKSHOP_UPGRADES[id];
  if (state.progress.workshop[id]) return `You already made the ${name}.`;
  if (!state.structures.workshop) return 'Build a workshop first.';
  if (id === 'bedTools' && !state.structures.vegetableBeds) return 'Build the vegetable beds first.';
  if (!isInClearing(state)) return 'Return to camp to work at the workshop.';
  if (isExhausted(state)) return TOO_TIRED_MESSAGE;
  if (availableWood(state) < cost.wood || availableFiber(state) < cost.fiber || availableStone(state) < cost.stone) {
    return `Need ${costPhrase(cost)} for the ${name}.`;
  }
  return null;
}

/** Room left in the handcart, or none before it is made. */
export function cartSpace(state: GameState): number {
  return state.progress.workshop.handcart ? BALANCE.handcartCapacity - state.cartWood : 0;
}

const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

/** A small count spelled out, as the copy writes it: "two", "four", up to the twelve a cart holds. */
export function countWord(count: number): string {
  return COUNT_WORDS[count] ?? String(count);
}

/** Wood one felled tree gives: twice as much with the saw. */
export function fellingWood(state: GameState): number {
  return state.progress.workshop.saw ? BALANCE.sawWood : 2;
}

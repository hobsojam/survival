import { spendCastleStone } from './castleSites';
import { TOO_TIRED_MESSAGE, isExhausted } from './needs';
import { ARCH_STONE, BRIDGE_NEEDS, BRIDGE_STONE, PIERS_STONE, bridgeOpen, bridgeStage, stageDone, type BridgeStage, type BridgeState } from './bridge';
import { BALANCE, type GameState } from './state';

// EASTER EGG: the town, see src/game/town.ts. Where the bridge stands, over the stream on the hills' south edge, and
// how it is built: its piers stone by stone, the arch's beams and then its stone, the parapet's stone and its cramps.

/** The bridge, in the gap between the houses at the foot of the street, over the stream on the hills' last row. */
export const BRIDGE_SITE = { x: 25, y: 28.6 } as const;

/** Where the bridge can be worked on now, or null while it can't. */
export const bridgeSpot = (state: GameState): { area: 'hills'; x: number; y: number } | null =>
  (bridgeOpen(state) ? { area: 'hills', ...BRIDGE_SITE } : null);

type Need = 'stone' | 'beams' | 'fittings';

/** What the bridge takes next: the arch's beams before its stone, the parapet's cramps after its stone. */
function bridgeNeed(bridge: BridgeState): Need {
  const stage = bridgeStage(bridge);
  if (stage === 'arch' && bridge.beams < BRIDGE_NEEDS.arch.beams) return 'beams';
  if (stage === 'parapet' && bridge.stone >= BRIDGE_STONE) return 'fittings';
  return 'stone';
}

const cartStone = (state: GameState): number => (state.castle.cart.at === 'hills' ? state.castle.cart.stone : 0);
const has = (state: GameState, need: Need): boolean =>
  (need === 'stone' ? state.inventory.stone + cartStone(state) : state.castle.goods[need]) >= 1;

const SHORT: Record<Need, string> = { stone: 'Bring stone up from the quarry.', beams: 'Make beams at the workshop.', fittings: 'Make an iron fitting at the forge.' };
const ASK: Record<Need, string> = { stone: 'bring stone up from the quarry', beams: 'make beams at the workshop', fittings: 'make an iron fitting at the forge' };

/** Why the next piece of the bridge can't be laid now, or null if it can. */
export function bridgeWorkBlocker(state: GameState): string | null {
  if (!bridgeOpen(state)) return 'There is nothing to build here yet.';
  if (state.area !== 'hills' || Math.hypot(state.player.x - BRIDGE_SITE.x, state.player.y - BRIDGE_SITE.y) > BALANCE.interactionRadius) return 'Move closer to the bridge.';
  const need = bridgeNeed(state.town.bridge);
  if (!has(state, need)) return SHORT[need];
  return isExhausted(state) ? TOO_TIRED_MESSAGE : null;
}

/** What the prompt says at the bridge: the work on offer, or what is missing for it. */
export function bridgePrompt(state: GameState): string {
  const { bridge } = state.town;
  const need = bridgeNeed(bridge);
  if (!has(state, need)) return `Bridge · ${ASK[need]}`;
  if (need === 'beams') return `Set an arch beam (${bridge.beams}/${BRIDGE_NEEDS.arch.beams})`;
  if (need === 'fittings') return `Fit an iron cramp (${bridge.fittings}/${BRIDGE_NEEDS.parapet.fittings})`;
  const stage = bridgeStage(bridge);
  if (stage === 'piers') return `Lay a pier stone (${bridge.stone}/${PIERS_STONE})`;
  if (stage === 'arch') return `Lay an arch stone (${bridge.stone - PIERS_STONE}/${BRIDGE_NEEDS.arch.stone})`;
  return `Lay a parapet stone (${bridge.stone - ARCH_STONE}/${BRIDGE_NEEDS.parapet.stone})`;
}

/** The state with one more piece of the bridge laid: stone from the cart and the bag, a beam or a cramp from the castle goods. */
export function doBridgeWork(state: GameState): GameState {
  const before = state.town.bridge;
  const need = bridgeNeed(before);
  const paid = need === 'stone' ? spendCastleStone(state)
    : { ...state, castle: { ...state.castle, goods: { ...state.castle.goods, [need]: state.castle.goods[need] - 1 } } };
  if (!paid) return state;
  const laid = { ...before, [need]: before[need] + 1 };
  const finished = (['piers', 'arch', 'parapet'] as BridgeStage[]).filter(stage => !stageDone(before, stage) && stageDone(laid, stage));
  const doneDays = finished.reduce((days, stage) => ({ ...days, [stage]: state.day }), before.doneDays);
  return { ...paid, town: { ...paid.town, bridge: { ...laid, doneDays } } };
}

/** What a piece of work on the bridge says, read from the bridge after it. */
export function bridgeWorkLine(after: BridgeState): string {
  const stage = bridgeStage(after);
  if (stage === null) return 'The bridge is finished. The far bank is open.';
  if (stage === 'arch' && after.stone === PIERS_STONE && after.beams === 0) return 'The piers stand in the stream.';
  if (stage === 'parapet' && after.stone === ARCH_STONE && after.fittings === 0) return 'The arch is closed. It holds.';
  return 'You lay another stone on the bridge.';
}

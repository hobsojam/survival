import type { GameState } from './state';

// EASTER EGG: the town, see src/game/town.ts. The stone bridge over the stream at the foot of the hills, built once the
// street is well along: its piers in the water, an arch set on beams, and a parapet held with iron cramps. Beyond it
// lies the meadow.

export type BridgeStage = 'piers' | 'arch' | 'parapet';
export const BRIDGE_STAGES: readonly BridgeStage[] = ['piers', 'arch', 'parapet'];

/** What each stage takes, in the order it is laid: the arch's beams are set before its stone, the parapet's cramps after. */
export const BRIDGE_NEEDS = { piers: { stone: 24 }, arch: { beams: 4, stone: 16 }, parapet: { stone: 10, fittings: 2 } } as const;

/** How many houses must be finished before the bridge is begun. */
export const BRIDGE_HOUSES = 8;

/** What is laid of the bridge, counted across all its stages, and the day each stage was finished. */
export interface BridgeState { stone: number; beams: number; fittings: number; doneDays: Partial<Record<BridgeStage, number>> }

export const emptyBridge = (): BridgeState => ({ stone: 0, beams: 0, fittings: 0, doneDays: {} });

/** The stone the bridge holds once the piers, and then the arch, are done. */
export const PIERS_STONE = BRIDGE_NEEDS.piers.stone;
export const ARCH_STONE = PIERS_STONE + BRIDGE_NEEDS.arch.stone;
export const BRIDGE_STONE = ARCH_STONE + BRIDGE_NEEDS.parapet.stone;

/** The stage being built, or null once the bridge is done. */
export function bridgeStage(bridge: BridgeState): BridgeStage | null {
  if (bridge.stone < PIERS_STONE) return 'piers';
  if (bridge.beams < BRIDGE_NEEDS.arch.beams || bridge.stone < ARCH_STONE) return 'arch';
  if (bridge.stone < BRIDGE_STONE || bridge.fittings < BRIDGE_NEEDS.parapet.fittings) return 'parapet';
  return null;
}

/** Whether a stage is finished. */
export const stageDone = (bridge: BridgeState, stage: BridgeStage): boolean => {
  const now = bridgeStage(bridge);
  return now === null || BRIDGE_STAGES.indexOf(now) > BRIDGE_STAGES.indexOf(stage);
};

export const bridgeDone = (bridge: BridgeState): boolean => bridgeStage(bridge) === null;

/** Whether the bridge can be worked on: the eighth house is finished, and the bridge isn't. */
export const bridgeOpen = (state: GameState): boolean =>
  state.town.houses.filter(house => house.doneDay !== null).length >= BRIDGE_HOUSES && !bridgeDone(state.town.bridge);

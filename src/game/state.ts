export type ResourceKind = 'branch' | 'berry' | 'fiber';
export type StructureId = 'shelter' | 'bed' | 'crate' | 'hearth';

export interface ResourceNode {
  id: string;
  kind: ResourceKind;
  x: number;
  y: number;
  amount: number;
  readyDay: number;
}

export interface GameState {
  day: number;
  timeOfDay: number;
  player: { x: number; y: number; energy: number; hunger: number; warmth: number };
  inventory: { wood: number; food: number; fiber: number };
  fireFuel: number;
  structures: Record<StructureId, boolean>;
  progress: { nextStormDay: number | null; hearthUnlocked: boolean };
  nodes: ResourceNode[];
}

export const BALANCE = {
  mapWidth: 40,
  mapHeight: 30,
  campX: 20,
  campY: 15,
  daySeconds: 240,
  afternoonStart: 110,
  nightStart: 160,
  baseCapacity: 8,
  crateCapacity: 16,
  gatherEnergyCost: 4,
  gatherSeconds: 6,
  buildEnergyCost: 6,
  buildSeconds: 12,
  eatHungerGain: 25,
  cookSeconds: 8,
  cookHungerGain: 35,
  cookWarmthGain: 10,
  stargazeSeconds: 12,
  stargazeEnergyGain: 10,
  restSeconds: 20,
  restEnergyGain: 25,
  bedRestEnergyGain: 50,
  sleepEnergyGain: 60,
  energyDrainPerSecond: 1 / 6,
  fireSecondsPerWood: 90,
  hearthFireSecondsPerWood: 150,
  coldNightStartDay: 3,
  coldNightRetryDays: 3,
  coldNightFireBurn: 2,
  coldNightShelteredWarmthLossPerSecond: 0.75,
  coldNightOutdoorWarmthLossPerSecond: 1.25,
  coldNightFailureEnergy: 25,
  coldNightFailureMorningLoss: 30,
  interactionRadius: 2,
  campRadius: 4,
  buildCosts: { shelter: { wood: 6, fiber: 2 }, bed: { wood: 4, fiber: 1 }, crate: { wood: 4, fiber: 0 }, hearth: { wood: 4, fiber: 0 } } satisfies Record<StructureId, { wood: number; fiber: number }>
} as const;

const branchPositions = [
  [22, 15], [18, 16], [21, 18], [16, 14], [24, 13], [13, 12],
  [27, 17], [19, 22], [29, 9], [10, 18], [32, 21], [7, 8]
];
const berryPositions = [
  [19, 13], [23, 17], [16, 18], [25, 11],
  [12, 15], [28, 20], [9, 10], [33, 8]
];

const fiberPositions = [
  [21, 14], [17, 19], [24, 18], [14, 16],
  [27, 12], [10, 14], [30, 18], [8, 21]
];

export function createGame(): GameState {
  const nodes: ResourceNode[] = [
    ...branchPositions.map(([x, y], index) => ({ id: `branch-${index}`, kind: 'branch' as const, x, y, amount: 1, readyDay: 1 })),
    ...berryPositions.map(([x, y], index) => ({ id: `berry-${index}`, kind: 'berry' as const, x, y, amount: 1, readyDay: 1 })),
    ...fiberPositions.map(([x, y], index) => ({ id: `fiber-${index}`, kind: 'fiber' as const, x, y, amount: 1, readyDay: 1 }))
  ];
  return {
    day: 1,
    timeOfDay: 0,
    player: { x: BALANCE.campX, y: BALANCE.campY, energy: 100, hunger: 100, warmth: 100 },
    inventory: { wood: 0, food: 0, fiber: 0 },
    fireFuel: 0,
    structures: { shelter: false, bed: false, crate: false, hearth: false },
    progress: { nextStormDay: BALANCE.coldNightStartDay, hearthUnlocked: false },
    nodes
  };
}

export type ResourceKind = 'branch' | 'berry' | 'fiber' | 'stone';

export const BUILDINGS = {
  shelter: { name: 'Shelter', description: 'A roof against the night cold', symbol: '⌂', cost: { wood: 6, fiber: 2 }, prerequisite: null },
  bed: { name: 'Bed', description: 'Rest more deeply at camp', symbol: '▣', cost: { wood: 4, fiber: 1 }, prerequisite: 'shelter' },
  crate: { name: 'Storage crate', description: 'Carry up to 16 supplies', symbol: '▤', cost: { wood: 4, fiber: 0 }, prerequisite: null },
  hearth: { name: 'Stone hearth', description: 'Each log keeps the fire longer', symbol: '♨', cost: { wood: 2, fiber: 0, stone: 3 }, prerequisite: 'coldNight' },
  dryingRack: { name: 'Drying rack', description: 'Cooked berries are more filling', symbol: '☼', cost: { wood: 4, fiber: 0 }, prerequisite: null },
  windbreak: { name: 'Windbreak', description: 'Stay warmer when the fire fades', symbol: '▥', cost: { wood: 5, fiber: 0 }, prerequisite: null }
} as const;

export type StructureId = keyof typeof BUILDINGS;

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
  inventory: { wood: number; food: number; fiber: number; stone: number };
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
  rackCookHungerGain: 50,
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
  campRadius: 4
} as const;

const branchPositions = [
  [22, 15], [18, 16], [21, 18], [16, 14], [24, 13],
  [13, 7], [29, 5], [35, 13], [34, 25], [24, 25], [12, 25], [5, 15]
];
const berryPositions = [
  [19, 13], [23, 17], [16, 18], [25, 11],
  [12, 15], [28, 20], [9, 10], [33, 8]
];

const fiberPositions = [
  [21, 14], [17, 19], [24, 18], [14, 16],
  [27, 12], [10, 14], [30, 18], [8, 21]
];
const stonePositions = [[8, 12], [31, 10], [11, 22], [29, 21], [6, 18], [33, 23]];

export function createGame(): GameState {
  const nodes: ResourceNode[] = [
    ...branchPositions.map(([x, y], index) => ({ id: `branch-${index}`, kind: 'branch' as const, x, y, amount: 1, readyDay: 1 })),
    ...berryPositions.map(([x, y], index) => ({ id: `berry-${index}`, kind: 'berry' as const, x, y, amount: 1, readyDay: 1 })),
    ...fiberPositions.map(([x, y], index) => ({ id: `fiber-${index}`, kind: 'fiber' as const, x, y, amount: 1, readyDay: 1 })),
    ...stonePositions.map(([x, y], index) => ({ id: `stone-${index}`, kind: 'stone' as const, x, y, amount: 1, readyDay: 1 }))
  ];
  return {
    day: 1,
    timeOfDay: 0,
    player: { x: BALANCE.campX + 1, y: BALANCE.campY + 1, energy: 100, hunger: 100, warmth: 100 },
    inventory: { wood: 0, food: 0, fiber: 0, stone: 0 },
    fireFuel: 0,
    structures: { shelter: false, bed: false, crate: false, hearth: false, dryingRack: false, windbreak: false },
    progress: { nextStormDay: BALANCE.coldNightStartDay, hearthUnlocked: false },
    nodes
  };
}

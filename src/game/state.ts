export type ResourceKind = 'branch' | 'berry';

export const BUILDINGS = {
  shelter: { name: 'Shelter', description: 'A roof against the night cold', symbol: '⌂', cost: 6, prerequisite: null },
  bed: { name: 'Bed', description: 'Rest more deeply at camp', symbol: '▣', cost: 4, prerequisite: 'shelter' },
  crate: { name: 'Storage crate', description: 'Carry up to 16 supplies', symbol: '▤', cost: 4, prerequisite: null },
  hearth: { name: 'Stone hearth', description: 'Each log keeps the fire longer', symbol: '♨', cost: 4, prerequisite: 'coldNight' },
  dryingRack: { name: 'Drying rack', description: 'Cooked berries are more filling', symbol: '☼', cost: 4, prerequisite: null },
  windbreak: { name: 'Windbreak', description: 'Stay warmer when the fire fades', symbol: '▥', cost: 5, prerequisite: null }
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
  inventory: { wood: number; food: number };
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
  [22, 15], [18, 16], [21, 18], [16, 14], [24, 13], [13, 12],
  [27, 17], [19, 22], [29, 9], [10, 18], [32, 21], [7, 8]
];
const berryPositions = [
  [19, 13], [23, 17], [16, 18], [25, 11],
  [12, 15], [28, 20], [9, 10], [33, 8]
];

export function createGame(): GameState {
  const nodes: ResourceNode[] = [
    ...branchPositions.map(([x, y], index) => ({ id: `branch-${index}`, kind: 'branch' as const, x, y, amount: 1, readyDay: 1 })),
    ...berryPositions.map(([x, y], index) => ({ id: `berry-${index}`, kind: 'berry' as const, x, y, amount: 1, readyDay: 1 }))
  ];
  return {
    day: 1,
    timeOfDay: 0,
    player: { x: BALANCE.campX, y: BALANCE.campY, energy: 100, hunger: 100, warmth: 100 },
    inventory: { wood: 0, food: 0 },
    fireFuel: 0,
    structures: { shelter: false, bed: false, crate: false, hearth: false, dryingRack: false, windbreak: false },
    progress: { nextStormDay: BALANCE.coldNightStartDay, hearthUnlocked: false },
    nodes
  };
}

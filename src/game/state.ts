export type ResourceKind = 'branch' | 'berry';
export type StructureId = 'shelter' | 'bed' | 'crate';

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
  nodes: ResourceNode[];
}

export const BALANCE = {
  mapWidth: 40,
  mapHeight: 30,
  campX: 20,
  campY: 15,
  daySeconds: 240,
  nightStart: 160,
  baseCapacity: 8,
  crateCapacity: 16,
  gatherEnergyCost: 4,
  gatherSeconds: 6,
  buildEnergyCost: 6,
  buildSeconds: 12,
  eatHungerGain: 25,
  restSeconds: 20,
  restEnergyGain: 25,
  bedRestEnergyGain: 50,
  fireSecondsPerWood: 90,
  interactionRadius: 2,
  buildCosts: { shelter: 6, bed: 4, crate: 4 } satisfies Record<StructureId, number>
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
    structures: { shelter: false, bed: false, crate: false },
    nodes
  };
}

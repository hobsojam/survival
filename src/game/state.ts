export type ResourceKind = 'branch' | 'berry' | 'fiber' | 'stone';

export const BUILDINGS = {
  shelter: { name: 'Shelter', description: 'A roof against the night cold', symbol: '⌂', cost: { wood: 6, fiber: 2 }, prerequisite: null },
  bed: { name: 'Bed', description: 'Rest more deeply at camp', symbol: '▣', cost: { wood: 4, fiber: 1 }, prerequisite: 'shelter' },
  crate: { name: 'Storage crate', description: 'Carry up to 16 supplies', symbol: '▤', cost: { wood: 4, fiber: 0 }, prerequisite: null },
  toolshed: { name: 'Toolshed', description: 'Make tools here', symbol: '⚒', cost: { wood: 5, fiber: 2 }, prerequisite: 'shelter' },
  hearth: { name: 'Stone hearth', description: 'Each log keeps the fire longer', symbol: '♨', cost: { wood: 2, fiber: 0, stone: 3 }, prerequisite: 'coldNight' },
  dryingRack: { name: 'Drying rack', description: 'Prepare rations; improve cooked berries', symbol: '☼', cost: { wood: 4, fiber: 0 }, prerequisite: null },
  stonePile: { name: 'Stone pile', description: 'Keep up to 12 stone at camp', symbol: '◆', cost: { wood: 3, fiber: 0 }, prerequisite: null },
  windbreak: { name: 'Windbreak', description: 'Stay warmer when the fire fades', symbol: '▥', cost: { wood: 5, fiber: 0 }, prerequisite: null }
} as const;

export type StructureId = keyof typeof BUILDINGS;

export const PICKAXE = { cost: { wood: 2, fiber: 1, stone: 2 } } as const;

export const LOOKOUT = { x: 30, y: 8, cost: { wood: 4, fiber: 2, stone: 2 } } as const;

export const SITES = {
  basket: { name: 'Old basket', x: 8, y: 8 },
  spring: { name: 'Quiet spring', x: 10, y: 20 },
  cairn: { name: 'Stone cairn', x: 31, y: 21 }
} as const;
export type SiteId = keyof typeof SITES;

export interface ResourceNode {
  id: string;
  kind: ResourceKind;
  x: number;
  y: number;
  amount: number;
  readyDay: number;
}

export interface TreeNode {
  id: string;
  x: number;
  y: number;
  sprite: 'treeBroadleaf' | 'treePine';
  readyDay: number;
}

/** Stone set down on the ground; it stays until picked back up. */
export interface StonePile {
  id: string;
  x: number;
  y: number;
  count: number;
  area: AreaId;
}

export type AreaId = 'camp' | 'quarry';

/** What a wolf took on its last visit. */
export type WolfTake = 'ration' | 'berry' | 'nothing';

export interface GameState {
  area: AreaId;
  day: number;
  timeOfDay: number;
  player: { x: number; y: number; energy: number; hunger: number; warmth: number };
  inventory: { wood: number; food: number; fiber: number; stone: number; trailFood: number };
  fireFuel: number;
  structures: Record<StructureId, boolean>;
  progress: { nextStormDay: number | null; hearthUnlocked: boolean; lookoutRepaired: boolean; axeCrafted: boolean;
    quarryFound: boolean; pickaxeCrafted: boolean;
    discoveries: Record<SiteId, boolean> };
  nodes: ResourceNode[];
  trees: TreeNode[];
  stonePiles: StonePile[];
  /** Stone kept in the camp stone pile, outside the bag. */
  storedStone: number;
  /** First day the quarry face can be dug again. */
  quarryReadyDay: number;
  /** First day the rubble pile gives stone again. */
  rubbleReadyDay: number;
  /** The last winter night a wolf came into the dark camp, and what it took. */
  lastWolf: { day: number; took: WolfTake } | null;
}

export const BALANCE = {
  mapWidth: 40,
  mapHeight: 30,
  campX: 20,
  campY: 15,
  daySeconds: 240,
  baseCapacity: 8,
  crateCapacity: 16,
  gatherEnergyCost: 4,
  gatherSeconds: 6,
  buildEnergyCost: 6,
  buildSeconds: 12,
  chopEnergyCost: 8,
  chopSeconds: 10,
  treeRegrowDays: 3,
  /** Trees chopped in spring grow back faster. */
  springTreeRegrowDays: 2,
  rubbleRegrowDays: 3,
  digSeconds: 10,
  digEnergyCost: 8,
  eatHungerGain: 25,
  trailFoodHungerGain: 45,
  trailFoodSeconds: 12,
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
  /** At or below this, energy and hunger read as low: tired or hungry. */
  lowNeed: 20,
  /** Below this energy, heavy work is refused. */
  exhaustedEnergy: 10,
  tiredWorkFactor: 1.5,
  /** A hungry survivor regains this share of the energy rest would give. */
  hungryRecoveryFactor: 0.5,
  /** Sleeping hungry can't lift energy past this. */
  hungrySleepCap: 50,
  /** Extra energy lost each second at zero hunger, whatever the survivor is doing. */
  starvingEnergyDrainPerSecond: 0.25,
  fireSecondsPerWood: 90,
  /** Kindling: the same with or without the hearth. */
  fiberFireSeconds: 30,
  /** Stone is heavy: each one takes this many bag spaces. */
  stoneSpaces: 2,
  /** A stone dropped this close to a pile joins it. */
  pileMergeRadius: 1,
  pickUpSeconds: 2,
  stonePileCapacity: 12,
  hearthFireSecondsPerWood: 150,
  coldNightStartDay: 3,
  coldNightRetryDays: 3,
  coldNightFireBurn: 2,
  /** A spring shower makes the fire burn this much faster. */
  rainFireBurn: 1.5,
  /** Summer's midday heat: from this time of day until the end, hunger falls faster by the factor. */
  summerHeatStart: 60,
  summerHeatEnd: 130,
  summerHeatHunger: 1.25,
  /** Berries a summer bush gives with each gather. */
  summerBerries: 2,
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
const stonePositions = [[31, 10], [11, 22], [29, 21]];
const treePositions = [
  [20, 7, 'treeBroadleaf'], [17, 9, 'treeBroadleaf'], [27, 5, 'treeBroadleaf'],
  [22, 23, 'treePine'], [32, 14, 'treePine'], [15, 24, 'treePine']
] as const;

export function createGame(): GameState {
  const nodes: ResourceNode[] = [
    ...branchPositions.map(([x, y], index) => ({ id: `branch-${index}`, kind: 'branch' as const, x, y, amount: 1, readyDay: 1 })),
    ...berryPositions.map(([x, y], index) => ({ id: `berry-${index}`, kind: 'berry' as const, x, y, amount: 1, readyDay: 1 })),
    ...fiberPositions.map(([x, y], index) => ({ id: `fiber-${index}`, kind: 'fiber' as const, x, y, amount: 1, readyDay: 1 })),
    ...stonePositions.map(([x, y], index) => ({ id: `stone-${index}`, kind: 'stone' as const, x, y, amount: 1, readyDay: 1 }))
  ];
  const trees: TreeNode[] = treePositions.map(([x, y, sprite], index) => ({ id: `tree-${index}`, x, y, sprite, readyDay: 1 }));
  return {
    area: 'camp',
    day: 1,
    timeOfDay: 0,
    player: { x: BALANCE.campX + 1, y: BALANCE.campY + 1, energy: 100, hunger: 100, warmth: 100 },
    inventory: { wood: 0, food: 0, fiber: 0, stone: 0, trailFood: 0 },
    fireFuel: 0,
    structures: { shelter: false, bed: false, crate: false, hearth: false, dryingRack: false, windbreak: false, stonePile: false, toolshed: false },
    progress: { nextStormDay: BALANCE.coldNightStartDay, hearthUnlocked: false, lookoutRepaired: false, axeCrafted: false,
      quarryFound: false, pickaxeCrafted: false,
      discoveries: { basket: false, spring: false, cairn: false } },
    nodes,
    trees,
    stonePiles: [],
    storedStone: 0,
    quarryReadyDay: 1,
    rubbleReadyDay: 1,
    lastWolf: null
  };
}

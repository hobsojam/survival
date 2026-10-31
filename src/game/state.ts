import type { JournalEntry } from './journalEntries';
import type { ClearingState } from './clearing';
import { emptyFood, type FoodStore } from './foodStore';
import type { Bed } from './beds';
import type { UpgradeId } from './workshop';
export type ResourceKind = 'branch' | 'berry' | 'fiber' | 'stone' | 'hazel' | 'pine' | 'greens' | 'honey';

export const BUILDINGS = {
  shelter: { name: 'Shelter', description: 'A roof against the night cold', symbol: '⌂', cost: { wood: 6, fiber: 2 }, prerequisite: null },
  shelterThatched: { name: 'Thatched roof', description: 'A thicker roof holds warmth after dark', symbol: '⌂', cost: { wood: 0, fiber: 4 }, prerequisite: 'shelter' },
  shelterStonework: { name: 'Stone footing and chimney', description: 'Set the shelter on stone and add a chimney', symbol: '◆', cost: { wood: 0, fiber: 0, stone: 5 }, prerequisite: 'shelterThatched', alsoRequires: 'hearth' },
  shelterPorch: { name: 'Small porch', description: 'Add a little covered space at the entrance', symbol: '⌂', cost: { wood: 3, fiber: 0, stone: 3 }, prerequisite: 'shelterStonework' },
  shelterFinished: { name: 'Door and shutters', description: 'Finish the shelter with a door and shutters', symbol: '▣', cost: { wood: 2, fiber: 2 }, prerequisite: 'shelterPorch' },
  bed: { name: 'Bed', description: 'Rest more deeply at camp', symbol: '▣', cost: { wood: 4, fiber: 1 }, prerequisite: 'shelter' },
  toolshed: { name: 'Toolshed', description: 'Make tools here', symbol: '⚒', cost: { wood: 5, fiber: 2 }, prerequisite: 'shelter' },
  hearth: { name: 'Stone hearth', description: 'Each log keeps the fire longer', symbol: '♨', cost: { wood: 2, fiber: 0, stone: 3 }, prerequisite: 'coldNight' },
  dryingRack: { name: 'Drying rack', description: 'Prepare rations; improve cooked berries', symbol: '☼', cost: { wood: 4, fiber: 0 }, prerequisite: null },
  garden: { name: 'Garden', description: 'Plant berry bushes and gather a little each autumn', symbol: '♧', cost: { wood: 4, fiber: 2 }, prerequisite: null },
  stonePile: { name: 'Stone pile', description: 'Keep up to 12 stone at camp', symbol: '◆', cost: { wood: 3, fiber: 0 }, prerequisite: null },
  windbreak: { name: 'Windbreak', description: 'Stay warmer when the fire fades', symbol: '▥', cost: { wood: 5, fiber: 0 }, prerequisite: null },
  /** Stands on cleared ground: the step named by `ground` must be cleared first. */
  larder: { name: 'Larder', description: 'Keep up to 10 food raised off the ground', symbol: '▥', cost: { wood: 5, fiber: 2, stone: 2 }, prerequisite: null, ground: 'north-near' },
  woodpile: { name: 'Woodpile', description: 'Keep up to 12 wood split and dry', symbol: '▤', cost: { wood: 3, fiber: 1 }, prerequisite: null, ground: 'east-near' },
  fibreStack: { name: 'Fibre stack', description: 'Keep up to 12 fiber dry under thatch', symbol: '≋', cost: { wood: 2, fiber: 3 }, prerequisite: null, ground: 'east-near' },
  vegetableBeds: { name: 'Vegetable beds', description: 'Three raised beds for potatoes, beans and carrots', symbol: '▦', cost: { wood: 6, fiber: 2 }, prerequisite: null, ground: 'west-near' },
  well: { name: 'Well', description: 'Draw water for the beds and the pot', symbol: '◉', cost: { wood: 2, fiber: 0, stone: 6 }, prerequisite: 'vegetableBeds', ground: 'west-far' },
  /** The survivor moves in the moment it is built, and the shelter becomes a woodshed. */
  house: { name: 'House', description: 'A home with a fireplace of its own', symbol: '⌂', cost: { wood: 12, fiber: 6, stone: 8 }, prerequisite: 'shelterFinished', alsoRequires: 'bed', ground: 'north-far' },
  /** Where the saw, the handcart and the bed tools are made, once each. */
  workshop: { name: 'Workshop', description: 'Make a saw, a handcart and bed tools', symbol: '⚒', cost: { wood: 10, fiber: 4, stone: 6 }, prerequisite: 'toolshed', ground: 'east-far' }
} as const;

export type StructureId = keyof typeof BUILDINGS;

export const PICKAXE = { cost: { wood: 2, fiber: 1, stone: 2 } } as const;

/** A woven pack, made at the toolshed: the survivor wears it, and it carries packCapacity. */
export const PACK = { cost: { wood: 2, fiber: 4, stone: 0 } } as const;

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

/** One perennial berry bush in a camp garden. */
export interface GardenPlot {
  plantedYear: number | null;
  harvestedYear: number | null;
  harvestReady: boolean;
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

/** What a wolf took on its last visit: a ration left out for it counts as its visit, and a friendly wolf sees the others off. */
export type WolfTake = 'ration' | 'berry' | 'nothing' | 'offered' | 'chased';

/** The wild animals that can become the camp's one friend. */
export type Friend = 'bird' | 'fox' | 'wolf';

export interface Companion {
  /** The friend, once one has stayed; it never leaves. */
  friend: Friend | null;
  since: number | null;
  /** Offerings each animal has taken, and the day (or night) of the last. */
  trust: Record<Friend, number>;
  lastOffer: Record<Friend, number>;
  /** Fur or feathers picked up, kept outside the bag, and whether a piece lies by the fire. */
  keepsakes: number;
  keepsakeLying: boolean;
  /** The last dawn a piece was shed, and the last the fox brought a berry. */
  lastFind: number;
  lastGift: number;
  pillow: boolean;
  cloak: boolean;
  /** The last winter night the bird woke the sleeper. */
  alarmDay: number;
  /** The last evening the wild fox was startled away; it doesn't come back that evening. */
  foxFled: number;
}

export interface GameState {
  area: AreaId;
  day: number;
  timeOfDay: number;
  player: { x: number; y: number; energy: number; hunger: number; warmth: number };
  inventory: { wood: number; fiber: number; stone: number; food: FoodStore };
  fireFuel: number;
  /** Seconds the house's fireplace has left to burn; it stays 0 until the house is built. */
  fireplaceFuel: number;
  structures: Record<StructureId, boolean>;
  progress: { nextStormDay: number | null; hearthUnlocked: boolean; lookoutRepaired: boolean; axeCrafted: boolean;
    quarryFound: boolean; pickaxeCrafted: boolean; potCrafted: boolean; packWoven: boolean;
    /** The workshop's upgrades, each made once. */
    workshop: Record<UpgradeId, boolean>;
    discoveries: Record<SiteId, boolean> };
  nodes: ResourceNode[];
  trees: TreeNode[];
  stonePiles: StonePile[];
  gardenPlots: GardenPlot[];
  /** The three raised vegetable beds: potatoes, beans and carrots, in that order. */
  beds: Bed[];
  /** Stone kept in the camp stone pile, outside the bag. */
  storedStone: number;
  /** Wood split and stacked on the woodpile, outside the bag: it counts for building and the fire, from anywhere. */
  storedWood: number;
  /** Fiber kept dry in the fibre stack, outside the bag: it counts for building, crafting and kindling, from anywhere. */
  storedFiber: number;
  /** Food kept in the larder, outside the bag: reachable only in the clearing, and it keeps fresh food longer. */
  larder: FoodStore;
  /** First day the quarry face can be dug again. */
  quarryReadyDay: number;
  /** First day the rubble pile gives stone again. */
  rubbleReadyDay: number;
  /** The last winter night a wolf came into the dark camp, and what it took. */
  lastWolf: { day: number; took: WolfTake } | null;
  /** The last dawn that threw out food gone soft, and how much. */
  lastSpoiled: { day: number; berry: number; greens: number } | null;
  /** A honey cake eaten: the next rest or sleep at camp restores a little more energy. */
  cakeBonus: boolean;
  /** What the survivor has written in the year journal. */
  journal: JournalEntry[];
  companion: Companion;
  /** How far the camp clearing has been widened, and the step whose trees are being felled. */
  clearing: ClearingState;
}

export const BALANCE = {
  mapWidth: 40,
  mapHeight: 30,
  campX: 20,
  campY: 15,
  daySeconds: 240,
  /** Game seconds advanced per real second while the player is awake. */
  clockRate: 8 / 11,
  baseCapacity: 8,
  packCapacity: 16,
  gatherEnergyCost: 4,
  gatherSeconds: 6,
  buildEnergyCost: 6,
  buildSeconds: 12,
  /** The house takes twice the standard build time. */
  houseBuildSeconds: 24,
  chopEnergyCost: 8,
  chopSeconds: 10,
  /** Wood a felled tree gives once the saw is made, against 2 without it. */
  sawWood: 4,
  treeRegrowDays: 3,
  /** Trees chopped in spring grow back faster. */
  springTreeRegrowDays: 2,
  rubbleRegrowDays: 3,
  digSeconds: 10,
  digEnergyCost: 8,
  eatHungerGain: 25,
  /** Forage eaten raw; honey gives a little energy too. Roasted hazelnuts come from the cooking pot. */
  greensHunger: 15,
  hazelnutHunger: 15,
  honeyHunger: 20,
  /** Vegetables from the beds, eaten raw. */
  vegetableHunger: 20,
  honeyEnergy: 5,
  roastedHazelnutHunger: 50,
  /** Dawns before the hollow tree has honey again. */
  honeyRegrowDays: 3,
  trailFoodHungerGain: 45,
  trailFoodSeconds: 12,
  /** Days a fresh berry keeps in the bag, and in the larder. */
  bagFreshDays: 3,
  larderFreshDays: 5,
  cookSeconds: 8,
  cookHungerGain: 35,
  rackCookHungerGain: 50,
  cookWarmthGain: 10,
  /** Pot dishes, cooked like berries; none should beat rest and shelter as the way to recover. */
  teaWarmthGain: 20,
  teaEnergyGain: 5,
  saladHungerGain: 40,
  saladEnergyGain: 10,
  honeyCakeHungerGain: 60,
  honeyCakeRestBonus: 10,
  /** Vegetable stew, cooked in the pot once the well stands. */
  stewHungerGain: 55,
  stewWarmthGain: 15,
  stargazeSeconds: 12,
  /** Leaving an offering out for a wild animal. */
  offerSeconds: 3,
  stargazeEnergyGain: 10,
  restSeconds: 20,
  restEnergyGain: 25,
  bedRestEnergyGain: 50,
  /** A feather pillow adds this to resting in the bed, and to the hungry-sleep cap. */
  pillowEnergyGain: 10,
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
  larderCapacity: 10,
  woodpileCapacity: 12,
  /** The shelter, once the house stands, holds this much more wood as a woodshed. */
  woodshedCapacity: 24,
  /** Each log the fireplace takes from the wood store burns this long. */
  fireplaceSecondsPerWood: 200,
  /** How near the house counts as home. */
  homeRadius: 2.5,
  fibreStackCapacity: 12,
  hearthFireSecondsPerWood: 150,
  coldNightStartDay: 3,
  coldNightRetryDays: 3,
  coldNightFireBurn: 2,
  /** A friendly bird wakes the sleeper as a winter fire falls to this much fuel. */
  alarmFuel: 20,
  /** A spring shower makes the fire burn this much faster. */
  rainFireBurn: 1.5,
  /** Summer's midday heat: from this time of day until the end, hunger falls faster by the factor. */
  summerHeatStart: 60,
  summerHeatEnd: 130,
  summerHeatHunger: 1.25,
  /** Days a bed's crop grows before it is ripe, and the vegetables a ripe bed gives. */
  cropGrowDays: 3,
  cropYield: 2,
  /** Berries a summer bush gives with each gather. */
  summerBerries: 2,
  thatchedShelteredWarmthLossPerSecond: 0.2,
  coldNightShelteredWarmthLossPerSecond: 0.75,
  coldNightOutdoorWarmthLossPerSecond: 1.25,
  /** A fur cloak leaves this share of any warmth lost at night. */
  cloakWarmthLoss: 0.75,
  coldNightFailureEnergy: 25,
  coldNightFailureMorningLoss: 30,
  interactionRadius: 2,
  campRadius: 4
} as const;

// The first five lie under the trees at the edge of the camp clearing, a short walk from the fire.
const branchPositions = [
  [18, 11], [21, 9], [18, 21], [22, 21], [16, 11],
  [14, 7], [29, 5], [35, 13], [34, 25], [24, 25], [12, 25], [5, 15]
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
// Seasonal forage. Hazels stand at the foot of broadleaf trees and pines out in the woods; greens grow by the spring and in
// the open meadow, and the last two patches come up only after a spring shower. The hollow tree keeps a bees' nest.
const hazelPositions = [[15, 5], [25.5, 5.5], [26.75, 6.5]];
const pinePositions = [[9.5, 12.5], [23, 5.5], [19.5, 25]];
const greensPositions = [[9.5, 17.5], [12.5, 21.5], [27, 22.5], [30.5, 16.5], [12.5, 8]];
const honeyPositions = [[16, 6.5]];
const treePositions = [
  [20, 5, 'treeBroadleaf'], [17, 9, 'treeBroadleaf'], [27, 5, 'treeBroadleaf'],
  [22, 23, 'treePine'], [32, 14, 'treePine'], [15, 24, 'treePine']
] as const;

export function createGame(): GameState {
  const nodes: ResourceNode[] = [
    ...branchPositions.map(([x, y], index) => ({ id: `branch-${index}`, kind: 'branch' as const, x, y, amount: 1, readyDay: 1 })),
    ...berryPositions.map(([x, y], index) => ({ id: `berry-${index}`, kind: 'berry' as const, x, y, amount: 1, readyDay: 1 })),
    ...fiberPositions.map(([x, y], index) => ({ id: `fiber-${index}`, kind: 'fiber' as const, x, y, amount: 1, readyDay: 1 })),
    ...stonePositions.map(([x, y], index) => ({ id: `stone-${index}`, kind: 'stone' as const, x, y, amount: 1, readyDay: 1 })),
    ...hazelPositions.map(([x, y], index) => ({ id: `hazel-${index}`, kind: 'hazel' as const, x, y, amount: 1, readyDay: 1 })),
    ...pinePositions.map(([x, y], index) => ({ id: `pine-${index}`, kind: 'pine' as const, x, y, amount: 1, readyDay: 1 })),
    ...greensPositions.map(([x, y], index) => ({ id: `greens-${index}`, kind: 'greens' as const, x, y, amount: 1, readyDay: 1 })),
    ...honeyPositions.map(([x, y], index) => ({ id: `honey-${index}`, kind: 'honey' as const, x, y, amount: 1, readyDay: 1 }))
  ];
  const trees: TreeNode[] = treePositions.map(([x, y, sprite], index) => ({ id: `tree-${index}`, x, y, sprite, readyDay: 1 }));
  return {
    area: 'camp',
    day: 1,
    timeOfDay: 0,
    player: { x: BALANCE.campX + 1, y: BALANCE.campY + 1, energy: 100, hunger: 100, warmth: 100 },
    inventory: { wood: 0, fiber: 0, stone: 0, food: emptyFood() },
    fireFuel: 0,
    fireplaceFuel: 0,
    structures: { shelter: false, shelterThatched: false, shelterStonework: false, shelterPorch: false, shelterFinished: false, bed: false, hearth: false, dryingRack: false, garden: false, windbreak: false, stonePile: false, toolshed: false, larder: false, woodpile: false, fibreStack: false, vegetableBeds: false, well: false, house: false, workshop: false },
    progress: { nextStormDay: BALANCE.coldNightStartDay, hearthUnlocked: false, lookoutRepaired: false, axeCrafted: false,
      quarryFound: false, pickaxeCrafted: false, potCrafted: false, packWoven: false,
      workshop: { saw: false, handcart: false, bedTools: false },
      discoveries: { basket: false, spring: false, cairn: false } },
    nodes,
    trees,
    stonePiles: [],
    gardenPlots: Array.from({ length: 3 }, () => ({ plantedYear: null, harvestedYear: null, harvestReady: false })),
    beds: Array.from({ length: 3 }, () => ({ sown: false, grown: 0, dryDays: 0, wateredDay: null })),
    storedStone: 0,
    storedWood: 0,
    storedFiber: 0,
    larder: emptyFood(),
    quarryReadyDay: 1,
    rubbleReadyDay: 1,
    lastWolf: null,
    lastSpoiled: null,
    cakeBonus: false,
    journal: [],
    clearing: { cleared: [], marked: null, felled: [] },
    companion: {
      friend: null, since: null, trust: { bird: 0, fox: 0, wolf: 0 }, lastOffer: { bird: 0, fox: 0, wolf: 0 },
      keepsakes: 0, keepsakeLying: false, lastFind: 0, lastGift: 0, pillow: false, cloak: false, alarmDay: 0, foxFled: 0
    }
  };
}

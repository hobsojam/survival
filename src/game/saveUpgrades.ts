import { emptyField } from './field';
import { emptyOrchard } from './orchard';
import { emptyPony } from './pony';
import { emptyKeep } from './keep';
import { emptyCastle } from './castle';
import { HOUSE_COUNT, emptyHouse, emptyTown } from './town';

// Bringing an older save up to date as it loads. Every change to the saved shape bumps SAVE_VERSION by one and adds
// the step that upgrades a save from the version before: SAVE_UPGRADES[23] turns a version 23 save into version 24.
// A step gives anything new its starting value (a new building unbuilt, a new store empty) and never takes away
// anything the player had. Loading runs every step a save needs, in order, then validates the result as usual.

/** The saved shape's version. Bump it by one with every change to the shape, and add its upgrade step below. */
export const SAVE_VERSION = 41;

/** The oldest save that can still be brought up to date: earlier formats were never upgraded and don't load. */
export const OLDEST_UPGRADABLE_VERSION = 23;

/** Turns a parsed save from one version into the next. It is handed its own copy, so it may change it freely. */
export type SaveUpgrade = (state: unknown) => unknown;

type Upgradable = Record<string, unknown>;

/** Each step, keyed by the version it upgrades from. */
export const SAVE_UPGRADES: Readonly<Record<number, SaveUpgrade>> = {
  // Version 24: the survivor can fall sick, their story can end, and the frozen spring can be fished.
  // An older camp comes in well, with no fishing line and no fish.
  23: old => {
    const state = old as Upgradable & { progress: Upgradable; inventory: Upgradable & { food: Upgradable }; larder: Upgradable };
    return { ...state,
      sickness: { starvedSeconds: 0, sick: false, sickFromDay: null, cared: 0, uncared: 0, ateWarm: false, restedWarm: false },
      ending: null,
      fishingMisses: 0,
      progress: { ...state.progress, fishingLine: false },
      inventory: { ...state.inventory, food: { ...state.inventory.food, fish: 0 } },
      larder: { ...state.larder, fish: 0 } };
  },
  // Version 25: a wolf friend can bring rabbits home in winter. An older camp has none.
  24: old => {
    const state = old as Upgradable & { inventory: Upgradable & { food: Upgradable }; larder: Upgradable };
    return { ...state,
      inventory: { ...state.inventory, food: { ...state.inventory.food, rabbit: 0 } },
      larder: { ...state.larder, rabbit: 0 } };
  },
  // Version 26: a grain field and a granary on the south ground, wild grain for seed, and flour and bread.
  // An older camp has neither building, no harvest tools or quern, a bare field, and no flour or bread.
  25: old => {
    const state = old as Upgradable & { structures: Upgradable; progress: Upgradable & { workshop: Upgradable }; nodes: { id?: unknown }[];
      inventory: Upgradable & { food: Upgradable }; larder: Upgradable; lastSpoiled: Upgradable | null };
    // Each part is added only where it is missing, so a step run on a camp that already has it leaves it as it was.
    const withFlour = (store: Upgradable) => ({ flour: 0, bread: [], ...store });
    return { ...state,
      structures: { field: false, granary: false, ...state.structures },
      progress: { ...state.progress, workshop: { harvestTools: false, quern: false, ...state.progress.workshop } },
      field: state.field ?? emptyField(),
      nodes: state.nodes.some(node => node.id === 'wildGrain-0') ? state.nodes
        : [...state.nodes, { id: 'wildGrain-0', kind: 'wildGrain', x: 25, y: 23, amount: 1, readyDay: 1 }],
      inventory: { ...state.inventory, food: withFlour(state.inventory.food) },
      larder: withFlour(state.larder),
      lastSpoiled: state.lastSpoiled && { bread: 0, ...state.lastSpoiled } };
  },
  26: old => {
    const state = old as Upgradable & { structures: Upgradable };
    // Each part is added only where it is missing, so a step run on a camp that already has it leaves it as it was.
    return { ...state,
      structures: { windmill: false, bakery: false, ...state.structures },
      millFlour: state.millFlour ?? 0,
      bakery: { resumed: null, ...(state.bakery ?? { shelf: [], lastBaked: null }) } };
  },
  // Version 28: a beehive on the north far ground. An older camp has none, and an empty hive.
  27: old => {
    const state = old as Upgradable & { structures: Upgradable };
    // Each part is added only where it is missing, so a step run on a camp that already has it leaves it as it was.
    return { ...state,
      structures: { beehive: false, ...state.structures },
      beehive: state.beehive ?? { honey: 0, nextHoney: null } };
  },
  // Version 29: the broadleaf that stood on the north far ground moves out into the woods, so no wild tree stands in camp.
  // It keeps its regrowth; a camp whose tree has already moved is left as it was.
  28: old => {
    const state = old as Upgradable & { trees: (Upgradable & { id?: unknown })[] };
    return { ...state, trees: state.trees.map(tree => tree.id === 'tree-1' && tree.x === 17 && tree.y === 9 ? { ...tree, x: 16, y: 4 } : tree) };
  },
  // Version 30: a built house can have paint, flower boxes and three short fence sections.
  29: old => ({ ...(old as Upgradable), decorations: { paint: 'natural', flowerBoxes: false, fence: 0 } }),
  // Version 31: a larger woodpile can become a timber yard, and timber supports allow a second daily quarry dig.
  30: old => {
    const state = old as Upgradable & { structures: Upgradable; progress: Upgradable };
    return { ...state,
      structures: { timberYard: false, ...state.structures },
      progress: { ...state.progress, mineBuilt: false },
      mineReadyDay: 1 };
  },
  // Version 32: the existing larder can be expanded into a storehouse.
  31: old => {
    const state = old as Upgradable & { structures: Upgradable };
    return { ...state, structures: { storehouse: false, ...state.structures } };
  },
  // Version 33: the east homestead, its chickens and orchard, and room for every animal friend.
  32: old => {
    const state = old as Upgradable & { structures: Upgradable; progress: Upgradable; companion: Upgradable;
      inventory: Upgradable & { food: Upgradable }; larder: Upgradable; lastSpoiled: Upgradable | null };
    const first = state.companion.friend;
    const since = state.companion.since;
    return { ...state,
      structures: { chickenCoop: false, birdhouse: false, wolfHouse: false, foxDen: false, ...state.structures },
      progress: { homesteadFound: false, ...state.progress },
      companion: { ...state.companion,
        keepsakesByKind: { feather: first === 'bird' ? state.companion.keepsakes : 0,
          fur: first === 'fox' || first === 'wolf' ? state.companion.keepsakes : 0 },
        lyingByKind: { feather: first === 'bird' ? state.companion.keepsakeLying : false,
          fur: first === 'fox' || first === 'wolf' ? state.companion.keepsakeLying : false },
        lastFindByKind: { feather: first === 'bird' ? state.companion.lastFind : 0,
          fur: first === 'fox' || first === 'wolf' ? state.companion.lastFind : 0 },
        lastGiftByFriend: { fox: first === 'fox' ? state.companion.lastGift : 0,
          wolf: first === 'wolf' ? state.companion.lastGift : 0 },
        friends: {
        bird: first === 'bird' ? since : null,
        fox: first === 'fox' ? since : null,
        wolf: first === 'wolf' ? since : null
      } },
      chickens: { discovered: false, following: false, rescued: false, eggs: 0, nextEggDay: 1 },
      homestead: { applesReadyDay: 1, shedSearched: false },
      inventory: { ...state.inventory, food: { apple: [], egg: [], ...state.inventory.food } },
      larder: { apple: [], egg: [], ...state.larder },
      lastSpoiled: state.lastSpoiled && { apple: 0, egg: 0, ...state.lastSpoiled }
    };
  },
  // Version 34: a sheep pen and a loom, straw from threshing, and shears at the workshop. An older camp has none of them yet.
  33: old => {
    const state = old as Upgradable & { structures: Upgradable; field: Upgradable; progress: Upgradable & { workshop: Upgradable } };
    return { ...state,
      structures: { ...state.structures, sheepPen: false, loom: false },
      field: { ...state.field, straw: 0 },
      progress: { ...state.progress, workshop: { ...state.progress.workshop, shears: false } },
      sheep: { arrived: false, fluff: 0, fedUntil: null, lastShornYear: null, wool: 0, woven: { blanket: false, jumper: false, rug: false } } };
  },
  // Version 35: names for the animals. Every animal in an older camp is unnamed, and friends can be named by tapping them.
  34: old => ({ ...(old as Upgradable), names: { bird: null, fox: null, wolf: null, sheep: [null, null, null], chickens: [null, null, null] } }),
  // Version 36: pips can be saved and an orchard planted. An older camp has neither.
  35: old => {
    const state = old as Upgradable & { structures: Upgradable };
    return { ...state, structures: { ...state.structures, orchard: false }, orchard: emptyOrchard() };
  },
  // Version 37: the hills, ore, the forge and the pony. An older camp has none of them, and any piles it left are stone.
  36: old => {
    const state = old as Upgradable & { inventory: Upgradable; progress: Upgradable & { workshop: Upgradable }; names: Upgradable; stonePiles: Upgradable[] };
    return { ...state,
      inventory: { ...state.inventory, ore: 0 },
      progress: { ...state.progress, hillsFound: false, oreFoundDay: null, workshop: { ...state.progress.workshop, forge: false, horseshoes: false, ironPickaxe: false } },
      names: { ...state.names, pony: null },
      stonePiles: state.stonePiles.map(pile => ({ ...pile, item: 'stone' })),
      storedOre: 0, outcrop: { day: 0, dug: 0 }, pony: emptyPony() };
  },
  // Version 38: the stone keep. An older camp has laid no stones and made no hinges.
  37: old => {
    const state = old as Upgradable & { progress: Upgradable & { workshop: Upgradable } };
    return { ...state, keep: emptyKeep(), progress: { ...state.progress, workshop: { ...state.progress.workshop, hinges: false } } };
  },
  // Version 39: the castle after the keep. An older camp has revealed and built nothing, and made no cart or portcullis.
  38: old => {
    const state = old as Upgradable & { progress: Upgradable & { workshop: Upgradable } };
    return { ...state, castle: emptyCastle(), progress: { ...state.progress, workshop: { ...state.progress.workshop, stoneCart: false, portcullis: false } } };
  },
  // Version 40: the town after the castle. An older camp has no traveller, people or houses.
  39: old => ({ ...(old as Upgradable), town: emptyTown() }),
  // Version 41: the town's street of eight plots. A version 40 town has one.
  40: old => {
    const state = old as Upgradable & { town: Upgradable & { houses: unknown[] } };
    const houses = Array.isArray(state.town?.houses) ? state.town.houses : [];
    return { ...state, town: { ...state.town, houses: [...houses, ...Array.from({ length: Math.max(0, HOUSE_COUNT - houses.length) }, emptyHouse)] } };
  }
};

export type UpgradeResult = { ok: true; state: unknown } | { ok: false; reason: string };

const NOT_UP_TO_DATE = 'This save could not be brought up to date.';

/** Runs every step from a save's version up to the current one, without touching the state it was given. */
export function upgradeSave(version: unknown, state: unknown, current: number = SAVE_VERSION,
  upgrades: Readonly<Record<number, SaveUpgrade>> = SAVE_UPGRADES): UpgradeResult {
  if (!Number.isInteger(version)) return { ok: false, reason: 'This save uses an unsupported version.' };
  const from = version as number;
  if (from < OLDEST_UPGRADABLE_VERSION) return { ok: false, reason: 'This save is from an older version of the game.' };
  if (from > current) return { ok: false, reason: 'This save is from a newer version of the game.' };
  let upgraded = state;
  for (let step = from; step < current; step++) {
    const upgrade = upgrades[step];
    if (!upgrade) return { ok: false, reason: NOT_UP_TO_DATE };
    try {
      upgraded = upgrade(structuredClone(upgraded));
    } catch {
      return { ok: false, reason: NOT_UP_TO_DATE };
    }
  }
  return { ok: true, state: upgraded };
}

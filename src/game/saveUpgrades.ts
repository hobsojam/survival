import { emptyField } from './field';

// Bringing an older save up to date as it loads. Every change to the saved shape bumps SAVE_VERSION by one and adds
// the step that upgrades a save from the version before: SAVE_UPGRADES[23] turns a version 23 save into version 24.
// A step gives anything new its starting value (a new building unbuilt, a new store empty) and never takes away
// anything the player had. Loading runs every step a save needs, in order, then validates the result as usual.

/** The saved shape's version. Bump it by one with every change to the shape, and add its upgrade step below. */
export const SAVE_VERSION = 32;

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

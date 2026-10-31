// Bringing an older save up to date as it loads. Every change to the saved shape bumps SAVE_VERSION by one and adds
// the step that upgrades a save from the version before: SAVE_UPGRADES[23] turns a version 23 save into version 24.
// A step gives anything new its starting value (a new building unbuilt, a new store empty) and never takes away
// anything the player had. Loading runs every step a save needs, in order, then validates the result as usual.

/** The saved shape's version. Bump it by one with every change to the shape, and add its upgrade step below. */
export const SAVE_VERSION = 24;

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

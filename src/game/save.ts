import { BALANCE, createGame, type GameState } from './state';

export const SAVE_KEY = 'hearthwild.save';
const SAVE_VERSION = 4;
export type SaveResult = { ok: true } | { ok: false; error: string };
export type LoadResult = { kind: 'empty' } | { kind: 'loaded'; state: GameState } | { kind: 'invalid'; reason: string };

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): value is ObjectValue => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const meter = (value: unknown): boolean => finite(value) && value >= 0 && value <= 100;
const whole = (value: unknown): value is number => Number.isInteger(value) && finite(value);

function validCore(value: unknown, hasFiber: boolean): boolean {
  if (!object(value) || !object(value.player) || !object(value.inventory) || !object(value.structures) || !Array.isArray(value.nodes)) return false;
  const { player, inventory, structures, nodes } = value;
  if (!whole(value.day) || value.day < 1 || !finite(value.timeOfDay) || value.timeOfDay < 0 || value.timeOfDay >= BALANCE.daySeconds) return false;
  if (!finite(player.x) || player.x < 0 || player.x >= BALANCE.mapWidth || !finite(player.y) || player.y < 0 || player.y >= BALANCE.mapHeight) return false;
  if (!meter(player.energy) || !meter(player.hunger) || !meter(player.warmth)) return false;
  if (!whole(inventory.wood) || inventory.wood < 0 || !whole(inventory.food) || inventory.food < 0) return false;
  if (hasFiber && (!whole(inventory.fiber) || inventory.fiber < 0)) return false;
  if (!hasFiber && 'fiber' in inventory) return false;
  if (typeof structures.shelter !== 'boolean' || typeof structures.bed !== 'boolean' || typeof structures.crate !== 'boolean') return false;
  if (inventory.wood + inventory.food + (hasFiber ? (inventory.fiber as number) : 0) > (structures.crate ? BALANCE.crateCapacity : BALANCE.baseCapacity)) return false;
  if (!finite(value.fireFuel) || value.fireFuel < 0) return false;
  const expected = createGame().nodes.filter(node => hasFiber || node.kind !== 'fiber');
  if (nodes.length !== expected.length) return false;
  return nodes.every((node, index) => {
    const base = expected[index];
    return object(node) && node.id === base.id && node.kind === base.kind && node.x === base.x && node.y === base.y
      && whole(node.amount) && (node.amount === 0 || node.amount === 1)
      && whole(node.readyDay) && node.readyDay >= 1 && node.readyDay <= (value.day as number) + 1;
  });
}

function validProgress(value: unknown, hasFiber: boolean): boolean {
  if (!validCore(value, hasFiber) || !object(value) || !object(value.structures) || !object(value.progress)) return false;
  const { structures, progress } = value;
  if (typeof structures.hearth !== 'boolean' || typeof progress.hearthUnlocked !== 'boolean') return false;
  if (structures.hearth && !progress.hearthUnlocked) return false;
  if (progress.hearthUnlocked) return progress.nextStormDay === null;
  return whole(progress.nextStormDay) && progress.nextStormDay >= BALANCE.coldNightStartDay
    && progress.nextStormDay >= (value.day as number);
}

function validState(value: unknown): value is GameState {
  return validProgress(value, true) && object(value) && object(value.structures)
    && typeof value.structures.dryingRack === 'boolean'
    && typeof value.structures.windbreak === 'boolean';
}

function withFiber(value: GameState): GameState {
  return {
    ...value,
    inventory: { ...value.inventory, fiber: 0 },
    nodes: [...value.nodes, ...createGame().nodes.filter(node => node.kind === 'fiber')]
  };
}

function migrateV1(value: unknown): GameState | null {
  if (!validCore(value, false)) return null;
  const legacy = value as GameState;
  const migrated: GameState = {
    ...withFiber(legacy),
    structures: { ...legacy.structures, hearth: false, dryingRack: false, windbreak: false },
    progress: { nextStormDay: Math.max(BALANCE.coldNightStartDay, legacy.day + 2), hearthUnlocked: false }
  };
  return validState(migrated) ? migrated : null;
}

function migrateV2(value: unknown): GameState | null {
  if (!validProgress(value, false)) return null;
  const legacy = value as GameState;
  const migrated: GameState = {
    ...withFiber(legacy),
    structures: { ...legacy.structures, dryingRack: false, windbreak: false }
  };
  return validState(migrated) ? migrated : null;
}

function migrateV3(value: unknown): GameState | null {
  if (!object(value) || !object(value.structures)) return null;
  const structures = value.structures;
  if (validProgress(value, false) && typeof structures.dryingRack === 'boolean' && typeof structures.windbreak === 'boolean') {
    const migrated = withFiber(value as unknown as GameState);
    return validState(migrated) ? migrated : null;
  }
  if (validProgress(value, true) && !('dryingRack' in structures) && !('windbreak' in structures)) {
    const legacy = value as unknown as GameState;
    const migrated: GameState = { ...legacy, structures: { ...legacy.structures, dryingRack: false, windbreak: false } };
    return validState(migrated) ? migrated : null;
  }
  return null;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function saveGame(storage: Storage, state: GameState): SaveResult {
  if (!validState(state)) return { ok: false, error: 'The game state is invalid and was not saved.' };
  try {
    storage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state }));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

export function loadGame(storage: Storage): LoadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch (error) {
    return { kind: 'invalid', reason: `Could not read local save: ${errorText(error)}` };
  }
  if (raw === null) return { kind: 'empty' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: 'invalid', reason: 'The local save is not valid JSON.' };
  }
  if (!object(parsed) || (parsed.version !== SAVE_VERSION && parsed.version !== 3 && parsed.version !== 2 && parsed.version !== 1)) {
    return { kind: 'invalid', reason: 'This save uses an unsupported version.' };
  }
  let state: GameState | null = null;
  if (parsed.version === 1) state = migrateV1(parsed.state);
  else if (parsed.version === 2) state = migrateV2(parsed.state);
  else if (parsed.version === 3) state = migrateV3(parsed.state);
  else if (validState(parsed.state)) state = parsed.state;
  if (!state) return { kind: 'invalid', reason: 'The local save contains invalid game data.' };
  return { kind: 'loaded', state };
}

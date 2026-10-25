import { BALANCE, BUILDINGS, SITES, createGame, type GameState } from './state';
import { bagCapacity, carriedCount } from './rules';

export const SAVE_KEY = 'hearthwild.save';
const SAVE_VERSION = 12;
export type SaveResult = { ok: true } | { ok: false; error: string };
export type LoadResult = { kind: 'empty' } | { kind: 'loaded'; state: GameState } | { kind: 'invalid'; reason: string };

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): value is ObjectValue => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const meter = (value: unknown): boolean => finite(value) && value >= 0 && value <= 100;
const whole = (value: unknown): value is number => Number.isInteger(value) && finite(value);
const count = (value: unknown): value is number => whole(value) && value >= 0;
const onMap = (x: unknown, y: unknown): boolean => finite(x) && x >= 0 && x <= BALANCE.mapWidth - 1 && finite(y) && y >= 0 && y <= BALANCE.mapHeight - 1;

/** Checks a version 12 save: two areas, the toolshed's tools and the quarry's timers. */
function validState(value: unknown): value is GameState {
  if (!object(value) || !object(value.player) || !object(value.inventory) || !object(value.structures) || !object(value.progress)) return false;
  if (!Array.isArray(value.nodes) || !Array.isArray(value.trees) || !Array.isArray(value.stonePiles)) return false;
  const { player, inventory, structures, progress } = value;
  if (!whole(value.day) || value.day < 1 || !finite(value.timeOfDay) || value.timeOfDay < 0 || value.timeOfDay >= BALANCE.daySeconds) return false;
  if (!onMap(player.x, player.y) || !meter(player.energy) || !meter(player.hunger) || !meter(player.warmth)) return false;
  if (!(['wood', 'food', 'fiber', 'stone', 'trailFood'] as const).every(key => count(inventory[key]))) return false;
  if (!(Object.keys(BUILDINGS) as (keyof typeof BUILDINGS)[]).every(id => typeof structures[id] === 'boolean')) return false;
  if (value.area !== 'camp' && value.area !== 'quarry') return false;
  if (!finite(value.fireFuel) || value.fireFuel < 0) return false;
  if (typeof progress.hearthUnlocked !== 'boolean' || typeof progress.lookoutRepaired !== 'boolean' || typeof progress.axeCrafted !== 'boolean') return false;
  if (typeof progress.quarryFound !== 'boolean' || typeof progress.pickaxeCrafted !== 'boolean') return false;
  if ((value.area === 'quarry' || progress.quarryFound) && !structures.shelter) return false;
  if (progress.pickaxeCrafted && !(progress.quarryFound && structures.toolshed)) return false;
  if (progress.axeCrafted && !structures.toolshed) return false;
  if ((structures.hearth || progress.lookoutRepaired || progress.axeCrafted) && !progress.hearthUnlocked) return false;
  if (progress.hearthUnlocked ? progress.nextStormDay !== null
    : !(whole(progress.nextStormDay) && progress.nextStormDay >= BALANCE.coldNightStartDay && progress.nextStormDay >= value.day)) return false;
  const discoveries = progress.discoveries;
  if (!object(discoveries) || !(Object.keys(SITES) as (keyof typeof SITES)[]).every(id => typeof discoveries[id] === 'boolean')) return false;
  if (!count(value.storedStone) || value.storedStone > BALANCE.stonePileCapacity || (!structures.stonePile && value.storedStone > 0)) return false;
  const day = value.day;
  if (!whole(value.quarryReadyDay) || value.quarryReadyDay < 1 || value.quarryReadyDay > day + 1) return false;
  if (!whole(value.rubbleReadyDay) || value.rubbleReadyDay < 1 || value.rubbleReadyDay > day + BALANCE.rubbleRegrowDays) return false;
  const fresh = createGame();
  const nodesMatch = value.nodes.length === fresh.nodes.length && value.nodes.every((node, index) => {
    const base = fresh.nodes[index];
    return object(node) && node.id === base.id && node.kind === base.kind && node.x === base.x && node.y === base.y
      && (node.amount === 0 || node.amount === 1) && whole(node.readyDay) && node.readyDay >= 1 && node.readyDay <= day + 1;
  });
  const treesMatch = value.trees.length === fresh.trees.length && value.trees.every((tree, index) => {
    const base = fresh.trees[index];
    return object(tree) && tree.id === base.id && tree.x === base.x && tree.y === base.y && tree.sprite === base.sprite
      && whole(tree.readyDay) && tree.readyDay >= 1 && tree.readyDay <= day + BALANCE.treeRegrowDays;
  });
  const pilesValid = value.stonePiles.every(pile => object(pile) && typeof pile.id === 'string' && onMap(pile.x, pile.y)
    && whole(pile.count) && pile.count >= 1 && (pile.area === 'camp' || pile.area === 'quarry'));
  return nodesMatch && treesMatch && pilesValid && carriedCount(value as unknown as GameState) <= bagCapacity(value as unknown as GameState);
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Autosave interval, stretched to 10, 30 and then 60 seconds after consecutive failures. */
export function autosaveDelayMs(failures: number): number {
  return [10000, 10000, 30000][failures] ?? 60000;
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
  if (!object(parsed) || parsed.version !== SAVE_VERSION) return { kind: 'invalid', reason: 'This save uses an unsupported version.' };
  if (!validState(parsed.state)) return { kind: 'invalid', reason: 'The local save contains invalid game data.' };
  return { kind: 'loaded', state: parsed.state };
}

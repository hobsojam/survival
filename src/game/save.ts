import { BALANCE, BUILDINGS, SITES, createGame, type GameState } from './state';
import { bagCapacity, carriedCount } from './rules';

export const SAVE_KEY = 'hearthwild.save';
const SAVE_VERSION = 13;
export type SaveResult = { ok: true } | { ok: false; error: string };
export type LoadResult = { kind: 'empty' } | { kind: 'loaded'; state: GameState } | { kind: 'invalid'; reason: string };

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): value is ObjectValue => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const meter = (value: unknown): boolean => finite(value) && value >= 0 && value <= 100;
const whole = (value: unknown): value is number => Number.isInteger(value) && finite(value);
const count = (value: unknown): value is number => whole(value) && value >= 0;
const onMap = (x: unknown, y: unknown): boolean => finite(x) && x >= 0 && x <= BALANCE.mapWidth - 1 && finite(y) && y >= 0 && y <= BALANCE.mapHeight - 1;

type SaveShape = ObjectValue & { player: ObjectValue; inventory: ObjectValue; structures: ObjectValue; progress: ObjectValue; nodes: unknown[]; trees: unknown[]; stonePiles: unknown[] };
const bool = (value: unknown): value is boolean => typeof value === 'boolean';

function hasShape(value: unknown): value is SaveShape {
  return object(value) && object(value.player) && object(value.inventory) && object(value.structures) && object(value.progress)
    && Array.isArray(value.nodes) && Array.isArray(value.trees) && Array.isArray(value.stonePiles);
}

function validClock(value: SaveShape): boolean {
  return whole(value.day) && value.day >= 1 && finite(value.timeOfDay) && value.timeOfDay >= 0 && value.timeOfDay < BALANCE.daySeconds
    && finite(value.fireFuel) && value.fireFuel >= 0;
}

function validSurvivor({ player, inventory, area }: SaveShape): boolean {
  return onMap(player.x, player.y) && meter(player.energy) && meter(player.hunger) && meter(player.warmth)
    && (['wood', 'food', 'fiber', 'stone', 'trailFood'] as const).every(key => count(inventory[key]))
    && (area === 'camp' || area === 'quarry');
}

/** Flags are booleans, and nothing is unlocked without what unlocks it. */
function validProgress({ structures, progress, area }: SaveShape): boolean {
  if (!(Object.keys(BUILDINGS) as (keyof typeof BUILDINGS)[]).every(id => bool(structures[id]))) return false;
  if (!(['hearthUnlocked', 'lookoutRepaired', 'axeCrafted', 'quarryFound', 'pickaxeCrafted'] as const).every(key => bool(progress[key]))) return false;
  if ((area === 'quarry' || progress.quarryFound) && !structures.shelter) return false;
  if (progress.pickaxeCrafted && !(progress.quarryFound && structures.toolshed)) return false;
  if (progress.axeCrafted && !structures.toolshed) return false;
  const needsColdNight = [structures.hearth, progress.lookoutRepaired, progress.axeCrafted].includes(true);
  return progress.hearthUnlocked === true || !needsColdNight;
}

function validStorm({ progress, day }: SaveShape): boolean {
  if (progress.hearthUnlocked) return progress.nextStormDay === null;
  return whole(progress.nextStormDay) && whole(day) && progress.nextStormDay >= BALANCE.coldNightStartDay && progress.nextStormDay >= day;
}

function validDiscoveries({ progress }: SaveShape): boolean {
  const discoveries = progress.discoveries;
  return object(discoveries) && (Object.keys(SITES) as (keyof typeof SITES)[]).every(id => bool(discoveries[id]));
}

const readyBy = (value: unknown, latest: number): boolean => whole(value) && value >= 1 && value <= latest;

function validStone({ structures, storedStone, quarryReadyDay, rubbleReadyDay, day }: SaveShape): boolean {
  const today = day as number;
  return count(storedStone) && storedStone <= BALANCE.stonePileCapacity && (structures.stonePile === true || storedStone === 0)
    && readyBy(quarryReadyDay, today + 1) && readyBy(rubbleReadyDay, today + BALANCE.rubbleRegrowDays);
}

function validWorld({ nodes, trees, stonePiles, day }: SaveShape): boolean {
  const today = day as number;
  const fresh = createGame();
  const nodesMatch = nodes.length === fresh.nodes.length && nodes.every((node, index) => {
    const base = fresh.nodes[index];
    return object(node) && node.id === base.id && node.kind === base.kind && node.x === base.x && node.y === base.y
      && (node.amount === 0 || node.amount === 1) && readyBy(node.readyDay, today + 1);
  });
  const treesMatch = trees.length === fresh.trees.length && trees.every((tree, index) => {
    const base = fresh.trees[index];
    return object(tree) && tree.id === base.id && tree.x === base.x && tree.y === base.y && tree.sprite === base.sprite
      && readyBy(tree.readyDay, today + BALANCE.treeRegrowDays);
  });
  const pilesValid = stonePiles.every(pile => object(pile) && typeof pile.id === 'string' && onMap(pile.x, pile.y)
    && whole(pile.count) && pile.count >= 1 && (pile.area === 'camp' || pile.area === 'quarry'));
  return nodesMatch && treesMatch && pilesValid;
}

const WOLF_TAKES: readonly unknown[] = ['ration', 'berry', 'nothing'];

/** No wolf yet, or one that came on a day already lived, taking something it could take. */
function validWolf({ lastWolf, day }: SaveShape): boolean {
  if (lastWolf === null) return true;
  return object(lastWolf) && whole(lastWolf.day) && lastWolf.day >= 1 && lastWolf.day <= (day as number) && WOLF_TAKES.includes(lastWolf.took);
}

/** Checks a version 13 save: two areas, the toolshed's tools, the quarry's timers and the last wolf visit. */
function validState(value: unknown): value is GameState {
  if (!hasShape(value)) return false;
  const checks = [validClock, validSurvivor, validProgress, validStorm, validDiscoveries, validStone, validWorld, validWolf];
  return checks.every(check => check(value)) && carriedCount(value as unknown as GameState) <= bagCapacity(value as unknown as GameState);
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

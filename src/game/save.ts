import { BALANCE, BUILDINGS, SITES, createGame, type GameState, type StructureId } from './state';
import { bagCapacity, carriedCount } from './rules';
import { season, yearOf } from './calendar';
import { journalEntry, journalSeason, type JournalId } from './journalEntries';
import type { ClearingState, StepId } from './clearing';
import { CLEARING_STEPS, STEP_IDS, placeBranches } from './clearing';
import { KEEPSAKES_NEEDED, TRUST_TARGET } from './companion';
import { FOOD_ITEMS, isFresh, storeTotal, type FoodStore } from './food';
import { FORAGE, isForage } from './forage';
import { woodStoreCapacity } from './home';
import { BED_CROPS } from './beds';

export const SAVE_KEY = 'hearthwild.save';
const SAVE_VERSION = 22;
export type SaveResult = { ok: true } | { ok: false; error: string };
export type LoadResult = { kind: 'empty' } | { kind: 'loaded'; state: GameState } | { kind: 'invalid'; reason: string };

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): value is ObjectValue => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const meter = (value: unknown): boolean => finite(value) && value >= 0 && value <= 100;
const whole = (value: unknown): value is number => Number.isInteger(value) && finite(value);
const count = (value: unknown): value is number => whole(value) && value >= 0;
const onMap = (x: unknown, y: unknown): boolean => finite(x) && x >= 0 && x <= BALANCE.mapWidth - 1 && finite(y) && y >= 0 && y <= BALANCE.mapHeight - 1;

type SaveShape = ObjectValue & { player: ObjectValue; inventory: ObjectValue; structures: ObjectValue; progress: ObjectValue; nodes: unknown[]; trees: unknown[]; stonePiles: unknown[]; gardenPlots: unknown[] };
const bool = (value: unknown): value is boolean => typeof value === 'boolean';

function hasShape(value: unknown): value is SaveShape {
  return object(value) && object(value.player) && object(value.inventory) && object(value.structures) && object(value.progress)
    && Array.isArray(value.nodes) && Array.isArray(value.trees) && Array.isArray(value.stonePiles) && Array.isArray(value.gardenPlots);
}

function validClock(value: SaveShape): boolean {
  return whole(value.day) && value.day >= 1 && finite(value.timeOfDay) && value.timeOfDay >= 0 && value.timeOfDay < BALANCE.daySeconds
    && finite(value.fireFuel) && value.fireFuel >= 0;
}

/** Every item is there: fresh food as the whole days it was picked, from day 1 to today, and kept food as counts. */
function validFood(store: unknown, day: unknown): boolean {
  if (!object(store) || !whole(day)) return false;
  return FOOD_ITEMS.every(item => (isFresh(item)
    ? Array.isArray(store[item]) && store[item].every(picked => whole(picked) && picked >= 1 && picked <= day)
    : count(store[item])));
}

function validSurvivor({ player, inventory, area, day, cakeBonus }: SaveShape): boolean {
  return bool(cakeBonus) && onMap(player.x, player.y) && meter(player.energy) && meter(player.hunger) && meter(player.warmth)
    && (['wood', 'fiber', 'stone'] as const).every(key => count(inventory[key])) && validFood(inventory.food, day)
    && (area === 'camp' || area === 'quarry');
}

function validStructureDependencies(structures: ObjectValue): boolean {
  for (const id of Object.keys(BUILDINGS) as (keyof typeof BUILDINGS)[]) {
    const prerequisite = BUILDINGS[id].prerequisite;
    if (structures[id] && prerequisite && prerequisite !== 'coldNight' && prerequisite in BUILDINGS && !structures[prerequisite]) return false;
    const definition = BUILDINGS[id];
    if (structures[id] && 'alsoRequires' in definition && !structures[definition.alsoRequires]) return false;
  }
  return true;
}

function validProgressDependencies(structures: ObjectValue, progress: ObjectValue, area: unknown): boolean {
  if ((area === 'quarry' || progress.quarryFound) && !structures.shelter) return false;
  if (progress.pickaxeCrafted && !(progress.quarryFound && structures.toolshed)) return false;
  if ((progress.axeCrafted || progress.potCrafted || progress.packWoven) && !structures.toolshed) return false;
  const needsColdNight = [structures.hearth, progress.lookoutRepaired, progress.axeCrafted].includes(true);
  return progress.hearthUnlocked === true || !needsColdNight;
}

/** Flags are booleans, and nothing is unlocked without what unlocks it. */
function validProgress({ structures, progress, area }: SaveShape): boolean {
  const buildingIds = Object.keys(BUILDINGS) as (keyof typeof BUILDINGS)[];
  // Exactly the buildings there are, and no others.
  if (Object.keys(structures).length !== buildingIds.length || !buildingIds.every(id => bool(structures[id]))) return false;
  if (!validStructureDependencies(structures)) return false;
  const flags = ['hearthUnlocked', 'lookoutRepaired', 'axeCrafted', 'quarryFound', 'pickaxeCrafted', 'potCrafted', 'packWoven'] as const;
  return flags.every(key => bool(progress[key])) && validProgressDependencies(structures, progress, area);
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

/** The wood store holds no more than the woodpile and the woodshed between them, and nothing until one is built. */
function validWoodStore(value: SaveShape): boolean {
  return count(value.storedWood) && value.storedWood <= woodStoreCapacity(value as unknown as GameState);
}

/** The fireplace's fuel is never negative, and there is none until the house stands. */
function validFireplace({ structures, fireplaceFuel }: SaveShape): boolean {
  return finite(fireplaceFuel) && fireplaceFuel >= 0 && (structures.house === true || fireplaceFuel === 0);
}

function validFibreStack({ structures, storedFiber }: SaveShape): boolean {
  return count(storedFiber) && storedFiber <= BALANCE.fibreStackCapacity && (structures.fibreStack === true || storedFiber === 0);
}

function validStone({ structures, storedStone, quarryReadyDay, rubbleReadyDay, day }: SaveShape): boolean {
  const today = day as number;
  return count(storedStone) && storedStone <= BALANCE.stonePileCapacity && (structures.stonePile === true || storedStone === 0)
    && readyBy(quarryReadyDay, today + 1) && readyBy(rubbleReadyDay, today + BALANCE.rubbleRegrowDays);
}

function validGarden({ gardenPlots, structures, day }: SaveShape): boolean {
  if (gardenPlots.length !== 3) return false;
  return gardenPlots.every(plot => {
    if (!object(plot) || !bool(plot.harvestReady)) return false;
    const plantedYear = plot.plantedYear;
    const harvestedYear = plot.harvestedYear;
    if (plantedYear !== null && (!count(plantedYear) || plantedYear < 1 || plantedYear > yearOf(day as number))) return false;
    if (harvestedYear !== null && (!count(harvestedYear) || plantedYear === null || harvestedYear < plantedYear || harvestedYear > yearOf(day as number))) return false;
    if (plot.harvestReady && (plantedYear === null || plantedYear >= yearOf(day as number) || harvestedYear === yearOf(day as number) || !structures.garden)) return false;
    if (plantedYear !== null && !structures.garden) return false;
    return true;
  });
}

/** Three beds, each empty and bare or sown with its growth and dryness in range, watered no later than today, and sown only once the beds are built. */
function validBeds({ beds, structures, day }: SaveShape): boolean {
  if (!Array.isArray(beds) || beds.length !== BED_CROPS.length) return false;
  return beds.every(bed => {
    if (!object(bed) || !bool(bed.sown) || !count(bed.grown) || !count(bed.dryDays)) return false;
    if (bed.grown > BALANCE.cropGrowDays || bed.dryDays > 3) return false;
    if (bed.wateredDay !== null && !readyBy(bed.wateredDay, day as number)) return false;
    if (!bed.sown) return bed.grown === 0 && bed.dryDays === 0;
    return structures.vegetableBeds === true;
  });
}

/** Cleared steps are real, once each, and a far step follows its near one; the marked step is still to do; felled trees are the marked step's own. */
function validClearing({ clearing }: SaveShape): boolean {
  if (!object(clearing) || !Array.isArray(clearing.cleared) || !Array.isArray(clearing.felled)) return false;
  const { cleared, marked, felled } = clearing as ObjectValue & { cleared: unknown[]; felled: unknown[] };
  const step = (value: unknown): value is StepId => typeof value === 'string' && (STEP_IDS as readonly string[]).includes(value);
  if (!cleared.every(step) || new Set(cleared).size !== cleared.length) return false;
  const nearDone = (id: StepId): boolean => !id.endsWith('-far') || cleared.includes(id.replace('-far', '-near') as StepId);
  if (!cleared.every(nearDone)) return false;
  if (marked === null) return felled.length === 0;
  if (!step(marked) || cleared.includes(marked) || !nearDone(marked)) return false;
  const trees = CLEARING_STEPS[marked].trees.length;
  return felled.every(index => whole(index) && index >= 0 && index < trees) && new Set(felled).size === felled.length;
}

/** Buildings on cleared ground stand only where it is cleared; the larder holds real food, no more than fits, and only once built. */
function validLarder({ larder, structures, day, clearing }: SaveShape): boolean {
  const { cleared } = clearing as ClearingState;
  const grounded = (Object.keys(BUILDINGS) as StructureId[]).every(id => {
    const definition = BUILDINGS[id];
    return !structures[id] || !('ground' in definition) || cleared.includes(definition.ground);
  });
  if (!grounded || !validFood(larder, day)) return false;
  const stored = storeTotal(larder as FoodStore);
  return stored <= BALANCE.larderCapacity && (structures.larder === true || stored === 0);
}

function validWorld({ nodes, trees, stonePiles, day, clearing }: SaveShape): boolean {
  const today = day as number;
  const fresh = createGame();
  const placed = placeBranches(fresh.nodes, (clearing as ClearingState).cleared);
  const nodesMatch = nodes.length === fresh.nodes.length && nodes.every((node, index) => {
    const base = placed[index];
    return object(node) && node.id === base.id && node.kind === base.kind && node.x === base.x && node.y === base.y
      && (node.amount === 0 || node.amount === 1) && readyBy(node.readyDay, today + (isForage(base.kind) ? FORAGE[base.kind].regrowDays : 1));
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

const WOLF_TAKES: readonly unknown[] = ['ration', 'berry', 'nothing', 'offered', 'chased'];

/** The last spoiled dawn was a lived day, and something really was thrown out. */
function validSpoiled({ lastSpoiled, day }: SaveShape): boolean {
  if (lastSpoiled === null) return true;
  return object(lastSpoiled) && whole(lastSpoiled.day) && lastSpoiled.day >= 1 && lastSpoiled.day <= (day as number)
    && count(lastSpoiled.berry) && count(lastSpoiled.greens) && (lastSpoiled.berry as number) + (lastSpoiled.greens as number) >= 1;
}

/** No wolf yet, or one that came on a day already lived, taking something it could take. */
function validWolf({ lastWolf, day }: SaveShape): boolean {
  if (lastWolf === null) return true;
  return object(lastWolf) && whole(lastWolf.day) && lastWolf.day >= 1 && lastWolf.day <= (day as number) && WOLF_TAKES.includes(lastWolf.took);
}

/** Each journal entry is a known moment, once a year, on a lived day in its own season, told by one of its lines. */
function validJournal({ journal, day }: SaveShape): boolean {
  if (!Array.isArray(journal)) return false;
  const seen = new Set<string>();
  return journal.every(entry => {
    if (!object(entry) || typeof entry.id !== 'string' || !whole(entry.day) || !whole(entry.year) || !count(entry.variant)) return false;
    const known = journalEntry(entry.id as JournalId);
    const key = `${entry.year}:${entry.id}`;
    if (!known || seen.has(key)) return false;
    seen.add(key);
    return entry.day >= 1 && entry.day <= (day as number) && yearOf(entry.day) === entry.year
      && season(entry.day) === journalSeason(entry.id as JournalId) && entry.variant < known.lines.length;
  });
}

const FRIENDS = ['bird', 'fox', 'wolf'] as const;

type CompanionShape = ObjectValue & { trust: ObjectValue; lastOffer: ObjectValue };

function companionShape(value: unknown): value is CompanionShape {
  return object(value) && object(value.trust) && object(value.lastOffer);
}

function validCompanionItems(companion: CompanionShape): boolean {
  const { friend, keepsakes, keepsakeLying, pillow, cloak } = companion;
  const knownFriend = friend === null || FRIENDS.includes(friend as typeof FRIENDS[number]);
  return knownFriend && bool(keepsakeLying) && bool(pillow) && bool(cloak)
    && count(keepsakes) && keepsakes <= KEEPSAKES_NEEDED;
}

function validCompanionHistory(companion: CompanionShape, day: number): boolean {
  const lived = (value: unknown): boolean => count(value) && value <= day;
  if (!(['lastFind', 'lastGift', 'alarmDay', 'foxFled'] as const).every(key => lived(companion[key]))) return false;
  return FRIENDS.every(animal => count(companion.trust[animal]) && companion.trust[animal] <= TRUST_TARGET[animal]
    && lived(companion.lastOffer[animal]));
}

function validUnbefriendedCompanion(companion: CompanionShape): boolean {
  const { since, trust, keepsakes, keepsakeLying, pillow, cloak } = companion;
  return since === null && FRIENDS.every(animal => (trust[animal] as number) < TRUST_TARGET[animal])
    && keepsakes === 0 && !keepsakeLying && !pillow && !cloak;
}

function validBefriendedCompanion(companion: CompanionShape, day: number, structures: ObjectValue): boolean {
  const { friend, since, keepsakes, keepsakeLying, pillow, cloak } = companion;
  const made = pillow || cloak;
  return count(since) && since >= 1 && since <= day && !(pillow && cloak)
    && (!pillow || (friend === 'bird' && structures.bed === true)) && (!cloak || friend !== 'bird')
    && (!made || (keepsakes === 0 && !keepsakeLying));
}

/**
 * No friend and trust still short of every target, or one friend that came on a lived day.
 * Keepsakes come only from a friend, at most six, and each item only from its own friend's fur or feathers.
 */
function validCompanion({ companion, day, structures }: SaveShape): boolean {
  if (!companionShape(companion)) return false;
  if (!validCompanionItems(companion) || !validCompanionHistory(companion, day as number)) return false;
  if (companion.friend === null) return validUnbefriendedCompanion(companion);
  return validBefriendedCompanion(companion, day as number, structures);
}

/** Checks a version 22 save: the clearing, the larder, the wood store and the fibre stack, the house and its fireplace, shelter upgrades, garden plots, vegetable beds, tools, quarry timers, the year journal and companion. */
function validState(value: unknown): value is GameState {
  if (!hasShape(value)) return false;
  const checks = [validClock, validSurvivor, validProgress, validStorm, validDiscoveries, validStone, validWoodStore, validFireplace, validFibreStack, validGarden, validBeds, validClearing, validLarder, validWorld, validWolf, validSpoiled, validJournal, validCompanion];
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

/** Where branch piles lay before they were moved under trees, by id. */
const OLD_BRANCH_SPOTS: Record<string, readonly [number, number]> = {
  'branch-0': [22, 15], 'branch-1': [18, 16], 'branch-2': [21, 18], 'branch-3': [16, 14], 'branch-4': [24, 13], 'branch-5': [13, 7]
};

/** Moves an older save's branch piles to where they lie now, keeping whether each was picked. */
function movedBranches(state: unknown): void {
  if (!object(state) || !Array.isArray(state.nodes)) return;
  const now = new Map(createGame().nodes.map(node => [node.id, node]));
  for (const node of state.nodes) {
    if (!object(node) || typeof node.id !== 'string') continue;
    const spot = OLD_BRANCH_SPOTS[node.id];
    const fresh = now.get(node.id);
    if (spot && fresh && node.x === spot[0] && node.y === spot[1]) Object.assign(node, { x: fresh.x, y: fresh.y });
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
  movedBranches(parsed.state);
  if (!validState(parsed.state)) return { kind: 'invalid', reason: 'The local save contains invalid game data.' };
  return { kind: 'loaded', state: parsed.state };
}

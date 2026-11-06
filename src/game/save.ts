import { cleanName } from './names';
import { PONY_SPOTS } from './pony';
import { BALANCE, BUILDINGS, SITES, createGame, foodStoreCapacity, type GameState, type StructureId } from './state';
import { fullCapacity } from './camp';
import { carriedCount } from './rules';
import { season, yearOf } from './calendar';
import { journalEntry, journalSeason, type JournalId } from './journalEntries';
import type { ClearingState, StepId } from './clearing';
import { CLEARING_STEPS, STEP_IDS, placeBranches, previousStep } from './clearing';
import { KEEPSAKES_NEEDED, TRUST_TARGET } from './companion';
import { FOOD_ITEMS, isFresh, storeTotal, type FoodStore } from './food';
import { FORAGE, isForage } from './forage';
import { woodStoreCapacity } from './home';
import { BED_CROPS, dryLimitsFor } from './beds';
import { WORKSHOP_UPGRADES, type UpgradeId } from './workshop';
import { FIELD_STRIPS, ripeDay } from './field';
import { ORCHARD_SPOTS } from './orchard';

import { SAVE_VERSION, upgradeSave } from './saveUpgrades';

export { SAVE_VERSION };
export const SAVE_KEY = 'hearthwild.save';
export type SaveResult = { ok: true } | { ok: false; error: string };
export type LoadResult = { kind: 'empty' } | { kind: 'loaded'; state: GameState } | { kind: 'invalid'; reason: string };

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): value is ObjectValue => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const meter = (value: unknown): boolean => finite(value) && value >= 0 && value <= 100;
const whole = (value: unknown): value is number => Number.isInteger(value) && finite(value);
const count = (value: unknown): value is number => whole(value) && value >= 0;
const onMap = (x: unknown, y: unknown): boolean => finite(x) && x >= 0 && x <= BALANCE.mapWidth - 1 && finite(y) && y >= 0 && y <= BALANCE.mapHeight - 1;

type SaveShape = ObjectValue & { sheep: unknown; player: ObjectValue; inventory: ObjectValue; structures: ObjectValue; progress: ObjectValue; nodes: unknown[]; trees: unknown[]; stonePiles: unknown[]; gardenPlots: unknown[] };
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
    && (['wood', 'fiber', 'stone', 'ore'] as const).every(key => count(inventory[key])) && validFood(inventory.food, day)
    && (area === 'camp' || area === 'quarry' || area === 'homestead' || area === 'hills');
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
  if ((area === 'quarry' || area === 'homestead' || progress.quarryFound || progress.homesteadFound) && !structures.shelter) return false;
  if (progress.pickaxeCrafted && !(progress.quarryFound && structures.toolshed)) return false;
  if (progress.mineBuilt && !progress.pickaxeCrafted) return false;
  if ((progress.axeCrafted || progress.potCrafted || progress.packWoven) && !structures.toolshed) return false;
  const needsColdNight = [structures.hearth, progress.lookoutRepaired, progress.axeCrafted].includes(true);
  return progress.hearthUnlocked === true || !needsColdNight;
}

/** Exactly the three upgrades, each a boolean, none made before the workshop stands, and the bed tools only for built beds. */
function validWorkshop(structures: ObjectValue, progress: ObjectValue): boolean {
  const made = progress.workshop;
  const ids = Object.keys(WORKSHOP_UPGRADES) as UpgradeId[];
  if (!object(made) || Object.keys(made).length !== ids.length || !ids.every(id => bool(made[id]))) return false;
  if (made.bedTools && !structures.vegetableBeds) return false;
  if (made.harvestTools && !structures.field) return false;
  if (made.quern && !structures.granary) return false;
  return structures.workshop === true || !ids.some(id => made[id]);
}

/** Flags are booleans, and nothing is unlocked without what unlocks it. */
function validProgress({ structures, progress, area }: SaveShape): boolean {
  const buildingIds = Object.keys(BUILDINGS) as (keyof typeof BUILDINGS)[];
  // Exactly the buildings there are, and no others.
  if (Object.keys(structures).length !== buildingIds.length || !buildingIds.every(id => bool(structures[id]))) return false;
  if (!validStructureDependencies(structures)) return false;
  const flags = ['hearthUnlocked', 'lookoutRepaired', 'axeCrafted', 'quarryFound', 'homesteadFound', 'pickaxeCrafted', 'mineBuilt', 'potCrafted', 'packWoven', 'fishingLine'] as const;
  return flags.every(key => bool(progress[key])) && validWorkshop(structures, progress) && validProgressDependencies(structures, progress, area);
}

function validDecorations({ decorations, structures }: SaveShape): boolean {
  if (!object(decorations) || Object.keys(decorations).length !== 3) return false;
  const { paint, flowerBoxes, fence } = decorations;
  if (paint !== 'natural' && paint !== 'berry' && paint !== 'leaf') return false;
  if (!bool(flowerBoxes) || !whole(fence) || fence < 0 || fence > 3) return false;
  return structures.house === true || (paint === 'natural' && !flowerBoxes && fence === 0);
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

/** The wood store holds no more than the woodpile and the woodshed between them, and nothing until one is built; the cart holds its load only once made. */
function validWoodStore(value: SaveShape): boolean {
  const handcart = object(value.progress.workshop) && value.progress.workshop.handcart === true;
  return count(value.storedWood) && value.storedWood <= woodStoreCapacity(value as unknown as GameState)
    && count(value.cartWood) && value.cartWood <= BALANCE.handcartCapacity && (handcart || value.cartWood === 0);
}

/** The fireplace's fuel is never negative, and there is none until the house stands. */
function validFireplace({ structures, fireplaceFuel }: SaveShape): boolean {
  return finite(fireplaceFuel) && fireplaceFuel >= 0 && (structures.house === true || fireplaceFuel === 0);
}

function validFibreStack({ structures, storedFiber }: SaveShape): boolean {
  return count(storedFiber) && storedFiber <= BALANCE.fibreStackCapacity && (structures.fibreStack === true || storedFiber === 0);
}

function validStone({ structures, storedStone, quarryReadyDay, mineReadyDay, rubbleReadyDay, day, progress }: SaveShape): boolean {
  const today = day as number;
  return count(storedStone) && storedStone <= BALANCE.stonePileCapacity && (structures.stonePile === true || storedStone === 0)
    && readyBy(quarryReadyDay, today + 1) && readyBy(mineReadyDay, today + 1)
    && (progress.mineBuilt === true || mineReadyDay === 1)
    && readyBy(rubbleReadyDay, today + BALANCE.rubbleRegrowDays);
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
function validBeds({ beds, structures, progress, day }: SaveShape): boolean {
  if (!Array.isArray(beds) || beds.length !== BED_CROPS.length || !object(progress.workshop)) return false;
  // The most dry days in a row a bed can show without having withered.
  const maxDryDays = dryLimitsFor(progress.workshop.bedTools === true).wither - 1;
  return beds.every(bed => {
    if (!object(bed) || !bool(bed.sown) || !count(bed.grown) || !count(bed.dryDays)) return false;
    if (bed.grown > BALANCE.cropGrowDays || bed.dryDays > maxDryDays) return false;
    if (bed.wateredDay !== null && !readyBy(bed.wateredDay, day as number)) return false;
    if (!bed.sown) return bed.grown === 0 && bed.dryDays === 0;
    // A ripe crop never dries out: ripening resets its dryness.
    if (bed.grown >= BALANCE.cropGrowDays && bed.dryDays > 0) return false;
    return structures.vegetableBeds === true;
  });
}

/** Four strips, each bare, or sown on a day already lived and cut only once ripe; sown only once the field stands; seed for at most every strip; grain only in a built granary, no more than it holds. */
function validField({ field, structures, day }: SaveShape): boolean {
  if (!object(field) || !Array.isArray(field.strips) || field.strips.length !== FIELD_STRIPS) return false;
  const today = day as number;
  const stripsOk = field.strips.every(strip => {
    if (!object(strip) || !bool(strip.cut)) return false;
    if (strip.sownDay === null) return !strip.cut;
    if (!readyBy(strip.sownDay, today) || structures.field !== true) return false;
    return !strip.cut || ripeDay(strip.sownDay as number) <= today;
  });
  const seedOk = count(field.seed) && field.seed <= FIELD_STRIPS;
  const grainOk = count(field.grain) && field.grain <= BALANCE.granaryCapacity && (structures.granary === true || field.grain === 0);
  const strawOk = count(field.straw) && field.straw <= BALANCE.strawCapacity;
  return stripsOk && seedOk && grainOk && strawOk;
}

/** Flour only in a built windmill's bin and no more than it holds; loaves only on a built bakery's shelf, no more than it holds, each baked on a day already lived, as are the last bake and the last fresh start, which comes no later than it. */
function validBakehouse({ millFlour, bakery, structures, day }: SaveShape): boolean {
  const today = day as number;
  if (!count(millFlour) || millFlour > BALANCE.millFlourCapacity || (millFlour > 0 && structures.windmill !== true)) return false;
  if (!object(bakery) || !Array.isArray(bakery.shelf) || bakery.shelf.length > BALANCE.bakeryShelfCapacity) return false;
  if (!bakery.shelf.every(baked => readyBy(baked, today))) return false;
  if (bakery.lastBaked !== null && !readyBy(bakery.lastBaked, today)) return false;
  if (bakery.resumed !== null && (!readyBy(bakery.resumed, today) || bakery.lastBaked === null || (bakery.resumed as number) > (bakery.lastBaked as number))) return false;
  return structures.bakery === true || (bakery.shelf.length === 0 && bakery.lastBaked === null && bakery.resumed === null);
}

/** Honey only in a built hive and no more than it holds; a built hive always knows its next honey day, an unbuilt one never. */
function validBeehive({ beehive, structures }: SaveShape): boolean {
  if (!object(beehive) || !count(beehive.honey) || beehive.honey > BALANCE.hiveHoneyCapacity) return false;
  if (structures.beehive !== true) return beehive.honey === 0 && beehive.nextHoney === null;
  return whole(beehive.nextHoney) && beehive.nextHoney >= 1;
}

/** Cleared steps are real, once each, and a far step follows its near one; the marked step is still to do; felled trees are the marked step's own. */
function validClearing({ clearing }: SaveShape): boolean {
  if (!object(clearing) || !Array.isArray(clearing.cleared) || !Array.isArray(clearing.felled)) return false;
  const { cleared, marked, felled } = clearing as ObjectValue & { cleared: unknown[]; felled: unknown[] };
  const step = (value: unknown): value is StepId => typeof value === 'string' && (STEP_IDS as readonly string[]).includes(value);
  if (!cleared.every(step) || new Set(cleared).size !== cleared.length) return false;
  const nearDone = (id: StepId): boolean => { const before = previousStep(id); return !before || cleared.includes(before); };
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
  return stored <= foodStoreCapacity({ structures: { storehouse: structures.storehouse === true } }) && (structures.larder === true || stored === 0);
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
    && whole(pile.count) && pile.count >= 1 && (pile.area === 'camp' || pile.area === 'quarry' || pile.area === 'homestead' || pile.area === 'hills')
    && (pile.item === 'stone' || pile.item === 'ore'));
  return nodesMatch && treesMatch && pilesValid;
}

const WOLF_TAKES: readonly unknown[] = ['ration', 'berry', 'nothing', 'offered', 'chased'];

/** The last spoiled dawn was a lived day, and something really was thrown out. */
function validSpoiled({ lastSpoiled, day }: SaveShape): boolean {
  if (lastSpoiled === null) return true;
  return object(lastSpoiled) && whole(lastSpoiled.day) && lastSpoiled.day >= 1 && lastSpoiled.day <= (day as number)
    && count(lastSpoiled.berry) && count(lastSpoiled.greens) && count(lastSpoiled.bread) && count(lastSpoiled.apple) && count(lastSpoiled.egg)
    && (lastSpoiled.berry as number) + (lastSpoiled.greens as number) + (lastSpoiled.bread as number)
      + (lastSpoiled.apple as number) + (lastSpoiled.egg as number) >= 1;
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
      && season(entry.day) === journalSeason(entry.id as JournalId) && entry.variant < known.lines.length
      // A line with a place for a name has one, and only those lines do.
      && (known.lines[entry.variant].includes('{name}') ? typeof entry.name === 'string' && cleanName(entry.name) === entry.name : entry.name === undefined);
  });
}

const FRIENDS = ['bird', 'fox', 'wolf'] as const;

type CompanionShape = ObjectValue & { trust: ObjectValue; lastOffer: ObjectValue; friends: ObjectValue;
  keepsakesByKind: ObjectValue; lyingByKind: ObjectValue; lastFindByKind: ObjectValue; lastGiftByFriend: ObjectValue };

function companionShape(value: unknown): value is CompanionShape {
  return object(value) && object(value.trust) && object(value.lastOffer) && object(value.friends)
    && object(value.keepsakesByKind) && object(value.lyingByKind)
    && object(value.lastFindByKind) && object(value.lastGiftByFriend);
}

function validCompanionItems(companion: CompanionShape): boolean {
  const { friend, keepsakes, keepsakeLying, pillow, cloak } = companion;
  const knownFriend = friend === null || FRIENDS.includes(friend as typeof FRIENDS[number]);
  return knownFriend && bool(keepsakeLying) && bool(pillow) && bool(cloak)
    && count(keepsakes) && keepsakes <= KEEPSAKES_NEEDED
    && (['feather', 'fur'] as const).every(kind => count(companion.keepsakesByKind[kind])
      && (companion.keepsakesByKind[kind] as number) <= KEEPSAKES_NEEDED && bool(companion.lyingByKind[kind]));
}

function validCompanionHistory(companion: CompanionShape, day: number): boolean {
  const lived = (value: unknown): boolean => count(value) && value <= day;
  if (!(['lastFind', 'lastGift', 'alarmDay', 'foxFled'] as const).every(key => lived(companion[key]))) return false;
  if (!(['feather', 'fur'] as const).every(kind => lived(companion.lastFindByKind[kind]))) return false;
  if (!(['fox', 'wolf'] as const).every(animal => lived(companion.lastGiftByFriend[animal]))) return false;
  if (Object.keys(companion.friends).length !== FRIENDS.length) return false;
  return FRIENDS.every(animal => {
    const since = companion.friends[animal];
    return count(companion.trust[animal]) && lived(companion.lastOffer[animal])
      && (since === null
        ? (companion.trust[animal] as number) < TRUST_TARGET[animal]
        : lived(since) && (since as number) >= 1 && (companion.trust[animal] as number) === TRUST_TARGET[animal]);
  });
}

function validUnbefriendedCompanion(companion: CompanionShape): boolean {
  const { since, trust, keepsakes, keepsakeLying, pillow, cloak } = companion;
  return since === null && FRIENDS.every(animal => companion.friends[animal] === null && (trust[animal] as number) < TRUST_TARGET[animal])
    && keepsakes === 0 && !keepsakeLying && !pillow && !cloak
    && companion.keepsakesByKind.feather === 0 && companion.keepsakesByKind.fur === 0
    && !companion.lyingByKind.feather && !companion.lyingByKind.fur;
}

function validBefriendedCompanion(companion: CompanionShape, day: number, structures: ObjectValue): boolean {
  const { friend, since, pillow, cloak } = companion;
  return FRIENDS.includes(friend as typeof FRIENDS[number]) && count(since) && since >= 1 && since <= day
    && companion.friends[friend as typeof FRIENDS[number]] === since
    && (!pillow || (companion.friends.bird !== null && structures.bed === true))
    && (!cloak || companion.friends.fox !== null || companion.friends.wolf !== null)
    && (!pillow || (companion.keepsakesByKind.feather === 0 && !companion.lyingByKind.feather))
    && (!cloak || (companion.keepsakesByKind.fur === 0 && !companion.lyingByKind.fur))
    && (companion.friends.bird !== null || (companion.keepsakesByKind.feather === 0 && !companion.lyingByKind.feather))
    && (companion.friends.fox !== null || companion.friends.wolf !== null
      || (companion.keepsakesByKind.fur === 0 && !companion.lyingByKind.fur));
}

/**
 * No friend and trust still short of every target, or one friend that came on a lived day.
 * Keepsakes come only from a friend, at most six, and each item only from its own friend's fur or feathers.
 */
function validCompanion({ companion, day, structures }: SaveShape): boolean {
  if (!companionShape(companion)) return false;
  if (!validCompanionItems(companion) || !validCompanionHistory(companion, day as number)) return false;
  if ((structures.birdhouse && companion.friends.bird === null)
    || (structures.wolfHouse && companion.friends.wolf === null)
    || (structures.foxDen && companion.friends.fox === null)) return false;
  if (companion.friend === null) return validUnbefriendedCompanion(companion);
  return validBefriendedCompanion(companion, day as number, structures);
}

/** The flock cannot be following and at home at once; a coop and a discovered route precede the rescue. */
function validChickens({ chickens, homestead, structures, progress, area, day }: SaveShape): boolean {
  if (!object(chickens) || !object(homestead)) return false;
  if (!bool(chickens.discovered) || !bool(chickens.following) || !bool(chickens.rescued)
    || !count(chickens.eggs) || chickens.eggs > 3 || !whole(chickens.nextEggDay) || chickens.nextEggDay < 1) return false;
  if (!whole(homestead.applesReadyDay) || homestead.applesReadyDay < 1 || !bool(homestead.shedSearched)) return false;
  if (area === 'homestead' && !progress.homesteadFound) return false;
  if ((chickens.discovered || homestead.shedSearched) && !progress.homesteadFound) return false;
  if (chickens.following && (chickens.rescued || !chickens.discovered || !structures.chickenCoop)) return false;
  if (chickens.rescued && (!chickens.discovered || !structures.chickenCoop)) return false;
  if (chickens.eggs > 0 && !chickens.rescued) return false;
  if (chickens.nextEggDay > (day as number) + 4 && !chickens.rescued) return false;
  return !structures.chickenCoop || chickens.discovered;
}

/** No more than two empty goes at the ice in a row; well, or sick since a lived day with fewer cared-for and uncared-for days than settle it; a story that has ended, ended on a lived day. */
function validSickness({ sickness, ending, day, fishingMisses }: SaveShape): boolean {
  if (!count(fishingMisses) || fishingMisses > BALANCE.fishingMaxMisses) return false;
  if (!object(sickness) || !finite(sickness.starvedSeconds) || sickness.starvedSeconds < 0) return false;
  const { sick, sickFromDay, cared, uncared, ateWarm, restedWarm } = sickness;
  if (!bool(sick) || !bool(ateWarm) || !bool(restedWarm) || !count(cared) || !count(uncared)) return false;
  const endingOk = ending === null || (object(ending) && whole(ending.day) && ending.day >= 1 && ending.day <= (day as number));
  if (!endingOk) return false;
  if (!sick) return sickFromDay === null && cared === 0 && uncared === 0 && !ateWarm && !restedWarm;
  return whole(sickFromDay) && sickFromDay >= 1 && sickFromDay <= (day as number)
    && cared < BALANCE.sickDaysToRecover && (uncared < BALANCE.sickDaysToDie || ending !== null);
}

/** Each name is a kept name on an animal that's really there, with three places each for the sheep and the hens. */
function validNames({ names, sheep, chickens, companion }: SaveShape): boolean {
  if (!object(names) || !object(sheep) || !object(chickens) || !object(companion) || !object(companion.friends)) return false;
  const ok = (name: unknown): boolean => name === null || (typeof name === 'string' && cleanName(name) === name);
  const flock = (places: unknown, here: boolean): boolean => Array.isArray(places) && places.length === 3 && places.every(ok) && (here || places.every(name => name === null));
  const friendsOk = (['bird', 'fox', 'wolf'] as const).every(animal => ok(names[animal])
    && (names[animal] === null || (companion.friends as ObjectValue)[animal] !== null || companion.friend === animal));
  return friendsOk && flock(names.sheep, sheep.arrived === true) && flock(names.chickens, chickens.rescued === true);
}

/** Sheep need their pen; a shearing needs sheep and shears; the loom follows a shearing, and each woven item its loom and what it goes with. */
function validSheep({ sheep, structures, progress, day }: SaveShape): boolean {
  if (!object(sheep) || !object(sheep.woven) || !bool(sheep.arrived) || !object(progress.workshop)) return false;
  const { arrived, fluff, fedUntil, lastShornYear, wool, woven } = sheep as ObjectValue & { woven: ObjectValue };
  if (!count(fluff) || fluff > BALANCE.fluffCap || !count(wool) || wool > BALANCE.woolCapacity) return false;
  if (fedUntil !== null && (!whole(fedUntil) || fedUntil > (day as number) + BALANCE.feedDays)) return false;
  if (fedUntil !== null && structures.sheepPen !== true) return false;
  if (arrived ? (structures.sheepPen !== true || fedUntil === null) : fluff !== 0) return false;
  const shorn = lastShornYear !== null;
  if (shorn && (!whole(lastShornYear) || !arrived || progress.workshop.shears !== true)) return false;
  if (!shorn && (wool !== 0 || structures.loom === true)) return false;
  const items = ['blanket', 'jumper', 'rug'] as const;
  if (Object.keys(woven).length !== items.length || !items.every(item => bool(woven[item]))) return false;
  if (items.some(item => woven[item]) && structures.loom !== true) return false;
  return (!woven.blanket || structures.bed === true) && (!woven.rug || structures.house === true);
}

/** Pips and the orchard follow the old homestead's apples, a tree needs the orchard and non-frozen ground, and pips and trees together never pass the spots. */
function validOrchard({ orchard, structures, progress, day }: SaveShape): boolean {
  if (!object(orchard) || !count(orchard.pips) || !Array.isArray(orchard.trees) || orchard.trees.length !== ORCHARD_SPOTS.length) return false;
  const today = day as number;
  const treeOk = (tree: unknown): boolean => tree === null || (object(tree) && count(tree.plantedDay) && tree.plantedDay >= 1 && tree.plantedDay <= today
    && season(tree.plantedDay) !== 'winter' && count(tree.ripeDay) && tree.ripeDay >= tree.plantedDay && tree.ripeDay <= today + BALANCE.orchardRipenDays);
  const trees = (orchard.trees as unknown[]).filter(tree => tree !== null);
  if (!orchard.trees.every(treeOk) || orchard.pips + trees.length > ORCHARD_SPOTS.length) return false;
  if (trees.length > 0 && structures.orchard !== true) return false;
  return progress.homesteadFound === true || (orchard.pips === 0 && structures.orchard !== true);
}

/** The hills follow the quarry; ore follows its finding; the forge follows the ore and the workshop; what it makes follows the forge; the pony is won by offers, and shod only with made horseshoes. */
function validHills({ progress, structures, area, inventory, storedOre, outcrop, pony, names, stonePiles, day }: SaveShape): boolean {
  if (!object(progress.workshop) || !object(outcrop) || !object(pony) || !object(names) || !bool(progress.hillsFound)) return false;
  const made = progress.workshop;
  const oreDay = progress.oreFoundDay;
  const oreFound = oreDay !== null;
  const dayOk = (value: unknown): boolean => value === null || (whole(value) && value >= 1 && value <= (day as number));
  if (!dayOk(oreDay) || (progress.hillsFound && progress.quarryFound !== true) || (area === 'hills' && !progress.hillsFound) || (oreFound && !progress.hillsFound)) return false;
  if (!count(storedOre) || storedOre > BALANCE.forgeOreCapacity || (storedOre > 0 && made.forge !== true)) return false;
  if ((inventory.ore as number) > 0 && !oreFound) return false;
  if ((stonePiles as ObjectValue[]).some(pile => pile.item === 'ore') && !oreFound) return false;
  if (!count(outcrop.day) || !count(outcrop.dug) || outcrop.dug > BALANCE.outcropPerDay || outcrop.day > (day as number)) return false;
  if (made.forge && (!oreFound || structures.workshop !== true)) return false;
  if ((made.horseshoes || made.ironPickaxe) && !made.forge) return false;
  if (made.ironPickaxe && progress.pickaxeCrafted !== true) return false;
  const { trust, lastOffer, won, home, shod, spot, toldHooves } = pony;
  if (!count(trust) || trust > BALANCE.ponyTrustTarget || !dayOk(lastOffer) || !dayOk(won) || !dayOk(shod) || !bool(home) || !bool(toldHooves)) return false;
  if (!whole(spot) || spot < 0 || spot >= PONY_SPOTS.length) return false;
  if ((won !== null) !== (trust === BALANCE.ponyTrustTarget) || (won === null && (home || toldHooves))) return false;
  if ((shod !== null) !== (made.horseshoes === true) || (shod !== null && won === null)) return false;
  return names.pony === null || won !== null;
}

/** Checks a version 24 save, with the survivor's sickness and whether their story has ended, and: the clearing, the larder, the wood store and the fibre stack, the house and its fireplace, the workshop and its handcart, shelter upgrades, garden plots, vegetable beds, tools, quarry timers, the year journal and companion. */
function validState(value: unknown): value is GameState {
  if (!hasShape(value)) return false;
  const checks = [validHills, validClock, validSurvivor, validProgress, validDecorations, validStorm, validDiscoveries, validStone, validWoodStore, validFireplace, validFibreStack, validGarden, validBeds, validField, validBakehouse, validBeehive, validClearing, validLarder, validWorld, validWolf, validSpoiled, validJournal, validCompanion, validChickens, validSickness, validSheep, validNames, validOrchard];
  return checks.every(check => check(value)) && carriedCount(value as unknown as GameState) <= fullCapacity(value as unknown as GameState);
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Autosave interval, stretched to 10, 30 and then 60 seconds after consecutive failures. */
export function autosaveDelayMs(failures: number): number {
  return [10000, 10000, 30000][failures] ?? 60000;
}

/** Removes the save of an ended story; if the browser won't, writes the ended story over it, which loads as no camp at all. */
function forgetSave(storage: Storage, state: GameState): SaveResult {
  try {
    storage.removeItem(SAVE_KEY);
    return { ok: true };
  } catch {
    try {
      storage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state }));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: errorText(error) };
    }
  }
}

export function saveGame(storage: Storage, state: GameState): SaveResult {
  // A story that has ended is never kept: the camp must not come back on the next visit.
  if (state.ending) return forgetSave(storage, state);
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
  if (!object(parsed)) return { kind: 'invalid', reason: 'This save uses an unsupported version.' };
  // An older save is brought up to date first, then checked exactly as a current one is.
  const upgraded = upgradeSave(parsed.version, parsed.state);
  if (!upgraded.ok) return { kind: 'invalid', reason: upgraded.reason };
  movedBranches(upgraded.state);
  if (!validState(upgraded.state)) return { kind: 'invalid', reason: 'The local save contains invalid game data.' };
  // A story that has ended is over: its save holds no camp to continue.
  if (upgraded.state.ending) return { kind: 'empty' };
  return { kind: 'loaded', state: upgraded.state };
}

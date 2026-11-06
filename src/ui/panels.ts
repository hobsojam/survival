import { cutStripBlocker, grindGrainBlocker, sowStripBlocker, stripStage, threshStripBlocker, type StripStage } from '../game/field';
import { SEASON_LENGTH, daysLeftInSeason, isSpring, isWinter, nightStart, season } from '../game/calendar';
import { millGrainBlocker, takeLoafBlocker } from '../game/bakehouse';
import { takeHoneyBlocker } from '../game/beehive';
import { takeEggBlocker } from '../game/chickens';
import { friendCalled, rosterLine } from '../game/names';
import { WOVEN, feedBlocker, shearBlocker, sheepStage, weaveBlocker, type SheepStage, type WovenId } from '../game/sheep';
import { FOOD_ITEMS, availableFood, emptyFood, foodCount, goingSoft, isFresh, storeTotal, type FoodItem, type KeptFood } from '../game/food';
import { foodIconUrl } from '../art/foodIcons';
import { BALANCE, BUILDINGS, foodStoreCapacity, type GameState, type StructureId } from '../game/state';
import { gardenPlotLabel, gardenPlotStage } from '../game/garden';
import { BED_CROPS, bedSoil, bedStage, drawWaterBlocker, harvestBedBlocker, sowBedBlocker, type BedSoil, type BedStage } from '../game/beds';
import { workSeconds } from '../game/needs';
import { hasWoodStore, livesInHouse, woodStoreCapacity } from '../game/home';
import { availableFiber, availableWood, isAtCamp, axeBlocker, treeRegrowDays, bagCapacity, buildStatus, carriedCount, groundBlocker, harvestGardenBlocker, isInClearing, isColdNight, isFreezingNight, lookoutRepairBlocker, mineBlocker, packBlocker, plantGardenBlocker, pickaxeBlocker, storeFoodBlocker, takeFoodBlocker, trailFoodBlocker } from '../game/rules';
import { availableOre } from '../game/hills';
import { ponyWith } from '../game/pony';
import { WORKSHOP_UPGRADES, upgradeBlocker, type UpgradeId } from '../game/workshop';
import { logsInStore } from '../game/wood';
import { forecastFireCheck, logsForColdNight } from '../game/forecast';
import type { LoadResult } from '../game/save';
import { CLEARING_STEPS, STEP_IDS, clearGroundBlocker, markBlocker, nextStep, roomLine, stepDepth, stepGround, stepWhere, type Side } from '../game/clearing';
import { KEEPSAKES_NEEDED, cloakBlocker, keepsakeStock, pillowBlocker } from '../game/companion';
import { DISHES, DISH_ORDER, cookBlocker, dishBlocker, foodWord, ingredientList, potBlocker, type DishId } from '../game/cooking';
import { fishingLineBlocker } from '../game/fishing';
import { DECORATION_COSTS, decorationBlocker, type DecorationChoice } from '../game/rules';

export interface GardenPlotPanelView {
  label: string;
  plantDisabled: boolean;
  plantTitle: string;
  harvestDisabled: boolean;
  harvestTitle: string;
}

export interface GardenPanelView { shown: boolean; hint: string; plots: GardenPlotPanelView[] }

export function gardenPanelView(state: GameState): GardenPanelView {
  const shown = state.structures.garden;
  const plots = state.gardenPlots.map((plot, index) => {
    const plantBlocker = plantGardenBlocker(state, index);
    const harvestBlocker = harvestGardenBlocker(state, index);
    return {
      label: gardenPlotLabel(gardenPlotStage(state, plot), plot.harvestReady),
      plantDisabled: Boolean(plantBlocker),
      plantTitle: plantBlocker ?? 'Plant a berry bush.',
      harvestDisabled: Boolean(harvestBlocker),
      harvestTitle: harvestBlocker ?? 'Pick 2 berries.'
    };
  });
  const hint = shown
    ? 'Plant one berry in spring. Each bush bears berries every autumn and will wait safely until picked.'
    : 'Build a garden from the Build tab to plant berry bushes.';
  return { shown, hint, plots };
}

export function gardenPlotMarkup(plot: GardenPlotPanelView, index: number): string {
  const plantDisabled = plot.plantDisabled ? ` disabled title="${plot.plantTitle}"` : '';
  const harvestDisabled = plot.harvestDisabled ? ` disabled title="${plot.harvestTitle}"` : '';
  return `<div class="garden-plot"><span><strong>Plot ${index + 1}</strong><small>${plot.label}</small></span><button type="button" data-action="plantGarden" data-plot-index="${index}"${plantDisabled}>Plant</button><button type="button" data-action="harvestGarden" data-plot-index="${index}"${harvestDisabled}>Pick</button></div>`;
}

const BED_STAGE_WORDS: Record<BedStage, string> = { empty: 'Empty, ready to sow', sprout: 'Sprouting', growing: 'Growing', ripe: 'Ready to harvest' };
const BED_SOIL_WORDS: Record<BedSoil, string | null> = { fresh: null, dry: 'Dry, water soon', wilted: 'Wilting, water today', frost: 'Resting under the frost' };

export interface BedPanelView { label: string; action: 'sowBed' | 'harvestBed'; verb: string; disabled: boolean; title: string }

/** The Draw water button under the beds: shown once the well stands, with why it is refused as its hint. */
export interface DrawWaterView { shown: boolean; disabled: boolean; hint: string }

/** How the beds get their water: the well once it stands, otherwise spring rain, or a nudge toward the well. */
function wateringHint(state: GameState): string {
  if (state.structures.well) return 'Rain waters the beds, and a bucket from the well waters them all for the day';
  if (isSpring(state.day)) return 'Rain waters the beds';
  return 'No rain falls until spring; a well on the west ground would water them';
}

/** The Vegetable beds panel, once built: a line per bed naming its crop, how far it has grown and how its soil is, with Sow or Harvest, and Draw water once the well stands. */
export function bedsPanelView(state: GameState): { shown: boolean; hint: string; beds: BedPanelView[]; water: DrawWaterView } {
  const beds = state.beds.map((bed, index) => {
    const crop = BED_CROPS[index];
    const resting = !bed.sown && isWinter(state.day);
    const words = resting ? ['Empty, resting for winter'] : [BED_STAGE_WORDS[bedStage(bed)], BED_SOIL_WORDS[bedSoil(state, bed)]];
    const label = [capitalised(crop), ...words].filter(Boolean).join(' · ');
    if (!bed.sown) {
      const blocker = sowBedBlocker(state, index);
      return { label, action: 'sowBed' as const, verb: 'Sow', disabled: Boolean(blocker), title: blocker ?? `Sow the ${crop}.` };
    }
    const blocker = harvestBedBlocker(state, index);
    return { label, action: 'harvestBed' as const, verb: 'Harvest', disabled: Boolean(blocker), title: blocker ?? `Harvest ${BALANCE.cropYield} vegetables.` };
  });
  const watering = wateringHint(state);
  const tools = state.progress.workshop.bedTools ? ' The watering can keeps a wilting crop alive a day longer.' : '';
  const hint = `Each bed keeps its own seed, so sowing costs nothing. ${watering}. Left dry for a few days, a crop wilts and then withers.${tools} A ripe crop waits safely until you harvest it.`;
  const blocker = drawWaterBlocker(state);
  return { shown: state.structures.vegetableBeds, hint, beds, water: { shown: state.structures.well, disabled: Boolean(blocker), hint: blocker ?? '' } };
}

export function bedMarkup(bed: BedPanelView, index: number): string {
  const disabled = bed.disabled ? ' disabled' : '';
  return `<div class="garden-plot"><span><small>${bed.label}</small></span><button type="button" data-action="${bed.action}" data-bed-index="${index}" title="${bed.title}"${disabled}>${bed.verb}</button></div>`;
}

const STRIP_WORDS: Record<StripStage, string> = {
  bare: 'Bare, ready to sow', shoots: 'Green shoots', green: 'Growing tall', gold: 'Gold, ready to cut', stooks: 'Sheaves in stooks'
};

/** The job each stage is ready for: sowing a bare strip, cutting gold grain, threshing stooks; nothing while it grows. */
const STRIP_JOBS: Record<StripStage, { action: StripPanelView['action']; verb: string; done: string; blocker: (state: GameState, index: number) => string | null } | null> = {
  bare: { action: 'sowStrip', verb: 'Sow', done: 'Sow the strip.', blocker: sowStripBlocker },
  shoots: null,
  green: null,
  gold: { action: 'cutStrip', verb: 'Cut', done: 'Cut the strip.', blocker: cutStripBlocker },
  stooks: { action: 'threshStrip', verb: 'Thresh', done: 'Thresh the strip.', blocker: threshStripBlocker }
};

export interface StripPanelView { label: string; action: 'sowStrip' | 'cutStrip' | 'threshStrip' | null; verb: string; disabled: boolean; title: string }

/** The Grain field panel, once built: a line per strip naming how it stands, with the job it is ready for. */
export function fieldPanelView(state: GameState): { shown: boolean; hint: string; strips: StripPanelView[] } {
  const strips = state.field.strips.map((strip, index): StripPanelView => {
    const stage = stripStage(strip, state.day);
    const words = stage === 'bare' && isWinter(state.day) ? 'Bare, resting for winter' : STRIP_WORDS[stage];
    const label = `Strip ${index + 1} · ${words}`;
    const job = STRIP_JOBS[stage];
    if (!job) return { label, action: null, verb: '', disabled: true, title: '' };
    const blocker = job.blocker(state, index);
    return { label, action: job.action, verb: job.verb, disabled: Boolean(blocker), title: blocker ?? job.done };
  });
  const tools = state.progress.workshop.harvestTools ? '' : ' The workshop can make a sickle and flail.';
  const wantsSeed = state.field.seed === 0 && state.field.strips.some(strip => strip.sownDay === null);
  const seed = wantsSeed ? ' Wild grain grows at the edge of the clearing.' : '';
  const hint = `Sow in spring, and the grain grows by itself through summer. Once it turns gold, cut it and thresh it. Ripe grain waits for you.${tools}${seed}`;
  return { shown: state.structures.field, hint, strips };
}

export function stripMarkup(strip: StripPanelView, index: number): string {
  const button = strip.action
    ? `<button type="button" data-action="${strip.action}" data-strip-index="${index}" title="${strip.title}"${strip.disabled ? ' disabled' : ''}>${strip.verb}</button>`
    : '';
  return `<div class="garden-plot"><span><small>${strip.label}</small></span>${button}</div>`;
}

/** The Granary panel, once built: the grain stored against its room, the seed kept, and Grind once the quern is made. */
export function granaryPanelView(state: GameState): { shown: boolean; stored: string; seed: string; grind: { shown: boolean; disabled: boolean; hint: string } } {
  const { grain, seed } = state.field;
  const seedLine = seed === 0 ? 'No seed kept' : `Seed for ${seed} ${seed === 1 ? 'strip' : 'strips'}`;
  const blocker = grindGrainBlocker(state);
  return {
    shown: state.structures.granary,
    stored: `${grain} of ${BALANCE.granaryCapacity} grain`,
    seed: seedLine,
    grind: { shown: state.progress.workshop.quern, disabled: Boolean(blocker), hint: blocker ?? '' }
  };
}

/** The Windmill panel, once built: the flour in its bin against its room, and whether milling can go ahead. */
export function windmillPanelView(state: GameState): { shown: boolean; stored: string; mill: { disabled: boolean; hint: string } } {
  const blocker = millGrainBlocker(state);
  return {
    shown: state.structures.windmill,
    stored: `${state.millFlour} of ${BALANCE.millFlourCapacity} flour`,
    mill: { disabled: Boolean(blocker), hint: blocker ?? '' }
  };
}

const FLOCK_WORDS: Record<SheepStage, string> = {
  shorn: 'Skinny, and rather cross about it.',
  woolly: 'Three woolly sheep.',
  round: 'Three very round sheep.',
  cloud: 'You can hardly see the sheep for the wool.'
};

function flockStatus({ sheep }: GameState): string {
  if (sheep.arrived) return FLOCK_WORDS[sheepStage(sheep.fluff)];
  return sheep.fedUntil === null ? 'The pen is empty. Put out some feed.' : 'The pen is empty, with feed in the rack.';
}

/** The friends with names, for the field journal. */
export function friendRosterView({ names }: GameState): { shown: boolean; text: string } {
  const text = rosterLine([names.bird, names.fox, names.wolf, names.pony]);
  return { shown: text !== '', text };
}

/** The Sheep panel, once the pen stands: how the flock looks, what's in store, and the two jobs. Shearing is hidden until the shears exist. */
export function sheepPanelView(state: GameState): { shown: boolean; status: string; names: string; straw: string; wool: string; feed: { disabled: boolean; hint: string }; shear: { shown: boolean; disabled: boolean; hint: string } } {
  const { sheep } = state;
  const feed = feedBlocker(state);
  const shear = shearBlocker(state);
  return {
    shown: state.structures.sheepPen,
    status: flockStatus(state),
    names: rosterLine(state.names.sheep),
    straw: `${state.field.straw} of ${BALANCE.strawCapacity} straw`,
    wool: `${sheep.wool} of ${BALANCE.woolCapacity} wool`,
    feed: { disabled: Boolean(feed), hint: feed ?? '' },
    shear: { shown: state.progress.workshop.shears, disabled: Boolean(shear), hint: shear ?? '' }
  };
}

/** The saved pips, for the Bag panel; nothing until there are some. */
export function pipsLine(state: GameState): string {
  const { pips } = state.orchard;
  if (pips === 0) return '';
  return pips === 1 ? '1 apple pip' : `${pips} apple pips`;
}

export interface LoomItemView { id: WovenId; name: string; cost: string; disabled: boolean; hint: string }

const LOOM_NAMES: Record<WovenId, string> = { blanket: 'Wool blanket', jumper: 'Warm jumper', rug: 'Rug' };

/** The Loom panel, once built: each item not yet made, and what's stopping it. */
export function loomPanelView(state: GameState): { shown: boolean; note: string; items: LoomItemView[] } {
  const items = (Object.keys(WOVEN) as WovenId[]).filter(id => !state.sheep.woven[id]).map(id => {
    const blocker = weaveBlocker(state, id);
    return { id, name: LOOM_NAMES[id], cost: `${WOVEN[id].wool} wool`, disabled: Boolean(blocker), hint: blocker ?? '' };
  });
  return { shown: state.structures.loom, note: items.length === 0 ? "You've made everything the loom can make." : '', items };
}

export function loomItemMarkup(item: LoomItemView): string {
  const disabled = item.disabled ? ' disabled' : '';
  return `<div class="tool-row"><button type="button" class="${item.disabled ? '' : 'ready'}" data-weave="${item.id}"${disabled}>${item.name}</button><small>${item.cost}${item.hint ? `. ${item.hint}` : ''}</small></div>`;
}

/** The Bakery panel, once built: the loaves on the shelf, any going soft at the next dawn, and whether one can be taken. */
export function bakeryPanelView(state: GameState): { shown: boolean; shelf: string; note: string; take: { disabled: boolean; hint: string } } {
  const { shelf } = state.bakery;
  const soft = goingSoft({ ...emptyFood(), bread: shelf }, 'bread', state.day, BALANCE.larderFreshDays);
  const blocker = takeLoafBlocker(state);
  return {
    shown: state.structures.bakery,
    shelf: `${shelf.length} of ${BALANCE.bakeryShelfCapacity} loaves on the shelf`,
    note: soft ? `(${soft} going soft)` : '',
    take: { disabled: Boolean(blocker), hint: blocker ?? '' }
  };
}

/** The Beehive panel, once built: the honey waiting in the hive, and whether it can be taken. */
export function beehivePanelView(state: GameState): { shown: boolean; stored: string; take: { disabled: boolean; hint: string } } {
  const blocker = takeHoneyBlocker(state);
  return {
    shown: state.structures.beehive,
    stored: `${state.beehive.honey} of ${BALANCE.hiveHoneyCapacity} honey`,
    take: { disabled: Boolean(blocker), hint: blocker ?? '' }
  };
}

/** The flock's home and the eggs waiting there. */
export function chickenCoopPanelView(state: GameState): { shown: boolean; status: string; names: string; stored: string; take: { disabled: boolean; hint: string } } {
  const { chickens } = state;
  let status = 'The coop is ready. Lead the flock here from the old homestead.';
  if (chickens.following) status = 'The flock is following you. Walk them to the coop.';
  if (chickens.rescued) status = 'The flock is safely home.';
  const blocker = takeEggBlocker(state);
  return {
    shown: state.structures.chickenCoop,
    status,
    names: rosterLine(state.names.chickens),
    stored: `${chickens.eggs} of 3 eggs waiting`,
    take: { disabled: Boolean(blocker), hint: blocker ?? '' }
  };
}

/** What a panel with one action button shows: its heading, its copy, its price line and its button state. */
export interface ActionPanelView { title: string; copy: string; cost: string; disabled: boolean; ready: boolean; shown?: boolean }

/** What each workshop upgrade does, shown while it can be made. */
const UPGRADE_COPY: Record<UpgradeId, { title: string; copy: string; made: string }> = {
  saw: { title: 'Saw', copy: 'Felling a tree gives four wood instead of two.', made: 'Felling a tree gives four wood.' },
  handcart: { title: 'Handcart', copy: 'Felled wood goes into a cart by the workshop, and counts as stored wood.', made: 'Felled wood goes into the cart, and from there onto the wood store whenever it has room.' },
  bedTools: { title: 'Hoe and watering can', copy: 'A dry bed holds on a day longer before it withers.', made: 'A dry bed holds on a day longer before it withers.' },
  harvestTools: { title: 'Sickle and flail', copy: 'Cut and thresh the grain field.', made: 'Cut and thresh the grain field.' },
  quern: { title: 'Hand quern', copy: 'Grind the granary\'s grain into flour.', made: 'Grind the granary\'s grain into flour.' },
  shears: { title: 'Shears', copy: 'Shear the flock once a year, in spring.', made: 'Shear the flock once a year, in spring.' },
  forge: { title: 'Forge', copy: 'Add a stone lean-to and an anvil, to work the ore from the hills.', made: 'Ore from the hills is kept at the forge.' },
  horseshoes: { title: 'Horseshoes', copy: 'Shoe the pony, so it can come with you and carry a load.', made: 'The pony can come with you and carry a load.' },
  ironPickaxe: { title: 'Iron pickaxe', copy: 'Each dig at the quarry face gives two stone.', made: 'Each dig at the quarry face gives two stone.' },
  hinges: { title: 'Iron hinges', copy: 'For the door of the keep, when its walls are ready.', made: 'They wait for the keep door.' }
};

/** Whether an upgrade's row shows: the bed tools once there are beds, the harvest tools once there is a field, the quern once there is a granary. */
const UPGRADE_SHOWN: Record<UpgradeId, (state: GameState) => boolean> = {
  saw: () => true, handcart: () => true, bedTools: state => state.structures.vegetableBeds,
  harvestTools: state => state.structures.field, quern: state => state.structures.granary, shears: state => state.structures.sheepPen,
  forge: state => state.progress.oreFoundDay !== null, horseshoes: state => state.progress.workshop.forge && state.pony.won !== null, ironPickaxe: state => state.progress.workshop.forge, hinges: state => state.progress.workshop.forge
};

/** "3 wood · 3 stone": an upgrade's cost, leaving out what it doesn't need. */
const costLabel = (cost: Record<'wood' | 'fiber' | 'stone', number> & { ore?: number }): string =>
  (['wood', 'fiber', 'stone', 'ore'] as const).filter(key => (cost[key] ?? 0) > 0).map(key => `${cost[key]} ${key}`).join(' · ');

export interface WorkshopView {
  shown: boolean;
  rows: Record<UpgradeId, ActionPanelView & { shown: boolean }>;
}

/** What each Burn or Drop button spends, as a count in the bag; Eat buttons follow the bag view instead. */
const SUPPLY_COUNTS: Record<string, (inventory: GameState['inventory']) => number> = {
  wood: inventory => inventory.wood,
  fiber: inventory => inventory.fiber,
  stone: inventory => inventory.stone,
  ore: inventory => inventory.ore,
  pineNeedles: inventory => inventory.food.pineNeedles
};
/** Burn reaches the woodpile and the fibre stack at camp; everything else follows the bag. */
const AT_CAMP_COUNTS: Record<string, (state: GameState) => number> = { wood: availableWood, fiber: availableFiber };
export const supplyCount = (state: GameState, supply: string): number =>
  (isAtCamp(state) ? AT_CAMP_COUNTS[supply]?.(state) : undefined) ?? SUPPLY_COUNTS[supply]?.(state.inventory) ?? 0;

/** The workshop panel, once it stands: each upgrade with its cost or why it can't be made. */
export function workshopView(state: GameState): WorkshopView {
  const row = (id: UpgradeId): ActionPanelView & { shown: boolean } => {
    const { title, copy, made } = UPGRADE_COPY[id];
    const shown = UPGRADE_SHOWN[id](state);
    if (state.progress.workshop[id]) return { shown: false, title, copy: made, cost: 'Made', disabled: true, ready: false };
    const blocker = upgradeBlocker(state, id);
    return { shown, title, copy: blocker ?? copy, cost: costLabel(WORKSHOP_UPGRADES[id].cost), disabled: false, ready: !blocker };
  };
  const rows = { saw: row('saw'), handcart: row('handcart'), bedTools: row('bedTools'), harvestTools: row('harvestTools'), quern: row('quern'), shears: row('shears'), forge: row('forge'), horseshoes: row('horseshoes'), ironPickaxe: row('ironPickaxe'), hinges: row('hinges') };
  return { shown: state.structures.workshop && Object.values(rows).some(item => item.shown), rows };
}

export function lookoutView(state: GameState): ActionPanelView {
  const { hearthUnlocked, lookoutRepaired } = state.progress;
  const button = { disabled: !hearthUnlocked || lookoutRepaired, ready: !lookoutRepairBlocker(state) };
  if (lookoutRepaired) {
    return { ...button, shown: false, title: 'A place to call home', copy: 'The old lookout stands again. Your journal surveys the areas beyond camp.', cost: 'Restored' };
  }
  if (hearthUnlocked) {
    return { ...button, title: 'Restore the old lookout', copy: 'Repair it to survey the areas beyond camp. Follow the northeast path and stand beside it.', cost: '4 wood · 2 fiber · 2 stone' };
  }
  return { ...button, title: 'The old lookout', copy: 'A damaged lookout waits along the northeast path. Weather the cold night before repairing it.', cost: 'Unlocks after the cold night' };
}

export function axeView(state: GameState): ActionPanelView {
  const { hearthUnlocked, axeCrafted } = state.progress;
  const button = { disabled: !hearthUnlocked || axeCrafted, ready: !axeBlocker(state) };
  if (axeCrafted) {
    return { ...button, shown: false, title: 'Stone axe ready', copy: `Tap a mature tree, or stand by one and press X, to gather two wood. Stumps regrow after ${treeRegrowDays(state.day) === 2 ? 'two' : 'three'} dawns.`, cost: 'Crafted' };
  }
  if (hearthUnlocked) {
    const copy = state.structures.toolshed
      ? 'Use stone, fiber, and wood at camp to work with the mature trees. Fallen branches remain easy to gather.'
      : 'Build a toolshed first.';
    return { ...button, title: 'Craft a stone axe', copy, cost: '1 wood · 1 fiber · 1 stone' };
  }
  return { ...button, title: 'Stone axe', copy: 'Weather the cold night to learn how to make a useful forest tool.', cost: 'Unlocks after the cold night' };
}

/** The pickaxe row only shows once the quarry is found. */
export function pickaxeView(state: GameState): ActionPanelView & { shown: boolean } {
  const { quarryFound, pickaxeCrafted } = state.progress;
  const blocker = pickaxeBlocker(state);
  const button = { shown: quarryFound && !pickaxeCrafted, disabled: !quarryFound || pickaxeCrafted, ready: quarryFound && !blocker };
  if (pickaxeCrafted) {
    return { ...button, title: 'Pickaxe ready', copy: 'Tap the quarry face, or stand at it and press E, to dig a stone. It is ready again each dawn.', cost: 'Crafted' };
  }
  return { ...button, title: 'Craft a pickaxe', copy: blocker ?? 'Your toolshed is ready. Craft a pickaxe to work the quarry face.', cost: '2 wood · 1 fiber · 2 stone' };
}

export function mineView(state: GameState): ActionPanelView {
  const shown = state.progress.pickaxeCrafted && !state.progress.mineBuilt;
  if (state.progress.mineBuilt) {
    const digs = Number(state.quarryReadyDay <= state.day) + Number(state.mineReadyDay <= state.day);
    return { shown, title: 'Timber-supported mine', copy: `${digs} ${digs === 1 ? 'dig' : 'digs'} left today. Each dig gives one stone; both return at dawn.`, cost: 'Built', disabled: true, ready: false };
  }
  const blocker = mineBlocker(state);
  return { shown, title: 'Build a mine', copy: blocker ?? 'Brace the quarry face with timber for two digs each day.', cost: '16 wood · 4 fiber', disabled: Boolean(blocker), ready: !blocker };
}

export function potView(state: GameState): ActionPanelView {
  if (state.progress.potCrafted) {
    return { shown: false, title: 'Cooking pot', copy: 'It hangs over the fire. Cook tea, salad, roasted nuts and honey cake whenever the fire is ready.', cost: 'Made', disabled: true, ready: false };
  }
  const blocker = potBlocker(state);
  return { title: 'Cooking pot', copy: blocker ?? 'A pot on a little tripod, for tea, salad, roasted nuts and honey cake.', cost: '1 wood · 2 stone', disabled: false, ready: !blocker };
}

export function packView(state: GameState): ActionPanelView {
  if (state.progress.packWoven) {
    return { shown: false, title: 'Woven pack', copy: `You wear it on your back. It carries ${BALANCE.packCapacity}.`, cost: 'Made', disabled: true, ready: false };
  }
  const blocker = packBlocker(state);
  return { title: 'Woven pack', copy: blocker ?? `A pack of woven fiber on a wooden frame, to carry ${BALANCE.packCapacity}.`, cost: '2 wood · 4 fiber', disabled: false, ready: !blocker };
}

/** The Forest tools panel's fishing line: made in the clearing from a wood and a fiber, for the frozen spring. */
export function fishingLineView(state: GameState): ActionPanelView {
  if (state.progress.fishingLine) {
    return { shown: false, title: 'Fishing line', copy: 'In winter, fish through the ice at the quiet spring.', cost: 'Made', disabled: true, ready: false };
  }
  const blocker = fishingLineBlocker(state);
  return { title: 'Fishing line', copy: blocker ?? 'A line of twisted fiber on a stick, to fish through the frozen spring in winter.', cost: '1 wood · 1 fiber', disabled: false, ready: !blocker };
}

export interface DishView { dish: Exclude<DishId, 'berries'>; name: string; icon: string; cost: string; disabled: boolean; title: string }

/** Dishes offered only while their one ingredient is in reach: a fish, a rabbit, and a loaf from flour. */
const OFFERED_WHEN_HELD: Partial<Record<DishId, FoodItem>> = { fish: 'fish', rabbit: 'rabbit', loaf: 'flour', omelette: 'egg', bakedApple: 'apple', eggOnBread: 'egg' };

/** The camp panel's toasted berry: greyed out, saying why, when it can't be cooked. */
export function cookBerryView(state: GameState): { disabled: boolean; title: string } {
  const blocker = cookBlocker(state);
  return { disabled: Boolean(blocker), title: blocker ?? 'Toast a berry by the fire.' };
}

/** The camp panel's dishes beyond a toasted berry: a fish whenever there is one, a loaf whenever there is flour, and the pot dishes once the pot is made. Each says why it can't be cooked yet. */
export function nightDishesView(state: GameState): DishView[] {
  const offered = (dish: DishId): dish is DishView['dish'] =>
    OFFERED_WHEN_HELD[dish] ? availableFood(state, OFFERED_WHEN_HELD[dish]) > 0 : DISHES[dish].potOnly && state.progress.potCrafted;
  return DISH_ORDER.filter(offered).map(dish => {
    const blocker = dishBlocker(state, dish);
    const name = capitalised(DISHES[dish].name);
    return { dish, name, icon: foodIconUrl(dish), cost: `${ingredientList(dish)} · ${BALANCE.cookSeconds} seconds`, disabled: Boolean(blocker), title: blocker ?? `Cook ${DISHES[dish].name}.` };
  });
}

/** A hidden button for each dish beyond a toasted berry in the camp panel, shown once it can be offered. */
export function nightDishMarkup(): string {
  return DISH_ORDER.filter(dish => dish !== 'berries').map(dish =>
    `<button type="button" data-action="cook" data-dish="${dish}" id="dish-${dish}" hidden><img class="food-icon" src="${foodIconUrl(dish as DishView['dish'])}" alt=""><strong>${capitalised(DISHES[dish].name)}</strong><small>${ingredientList(dish)} · ${BALANCE.cookSeconds} seconds</small></button>`
  ).join('');
}

/** The fur or feathers gathered toward the friend's one item; gone once it is made. */
export function keepsakeView(state: GameState): { shown: boolean; text: string } {
  const { friends, pillow, cloak } = state.companion;
  const parts: string[] = [];
  if (friends.bird !== null && !pillow) parts.push(`Feathers ${keepsakeStock(state, 'feather')}/${KEEPSAKES_NEEDED}`);
  if ((friends.fox !== null || friends.wolf !== null) && !cloak) parts.push(`Fur ${keepsakeStock(state, 'fur')}/${KEEPSAKES_NEEDED}`);
  return { shown: parts.length > 0, text: parts.join(' · ') };
}

function keepsakeItemView(made: boolean, shown: boolean, blocker: string | null,
  words: { title: string; ready: string; done: string; cost: string }): ActionPanelView & { shown: boolean } {
  if (made) return { shown: false, title: words.title, copy: words.done, cost: 'Made', disabled: true, ready: false };
  return { shown, title: words.title, copy: blocker ?? words.ready, cost: words.cost, disabled: false, ready: !blocker };
}

export function pillowView(state: GameState): ActionPanelView & { shown: boolean } {
  return keepsakeItemView(state.companion.pillow, state.companion.friends.bird !== null, pillowBlocker(state), {
    title: 'Feather pillow', ready: `${friendCalled(state, 'bird', 'Your bird')}'s feathers would make the bed softer.`, done: 'Resting in the bed goes a little deeper.',
    cost: `${KEEPSAKES_NEEDED} feathers`
  });
}

export function cloakView(state: GameState): ActionPanelView & { shown: boolean } {
  const { fox, wolf } = state.companion.friends;
  return keepsakeItemView(state.companion.cloak, fox !== null || wolf !== null, cloakBlocker(state), {
    title: 'Fur cloak', ready: 'Enough fur for a warm cloak against the night.', done: 'The nights bite a little less.',
    cost: `${KEEPSAKES_NEEDED} fur`
  });
}

/** The places along the paths found so far, for the Follow the paths panel. */
export function nightHint(state: GameState): string {
  if (!isInClearing(state)) return 'Return to the clearing to cook or stargaze.';
  if (state.timeOfDay < nightStart(state.day)) return 'Cook by the fire any time. Stargazing waits for nightfall.';
  return 'Optional comforts while the night passes.';
}

export interface ForecastView { active: boolean; title: string; copy: string; shelter: string; fire: string;
  /** How much food is laid by for winter, in autumn's last three days; otherwise empty. */
  food: string;
  /** Shown only while a cold night is due or under way, or in winter: otherwise there is nothing to forecast. */
  shown: boolean }

// A cold night always needs two to three logs: 132 s to 220 s of fuel at 90 s a log.
const LOG_WORDS: Record<number, string> = { 2: 'two', 3: 'three' };

/** Once the cold night is behind the survivor, winter's nights take over the forecast. */
function winterForecast(state: GameState): ForecastView {
  const active = isFreezingNight(state);
  return {
    active, shown: true,
    title: active ? 'A bitter night' : 'Winter nights',
    copy: `Winter nights are bitter. Keep the ${livesInHouse(state) ? 'fireplace' : 'fire'} alive until dawn, or the wolves will come close.`,
    shelter: state.structures.shelter ? '✓ Shelter ready' : '○ Shelter needed',
    fire: forecastFireCheck(state),
    food: ''
  };
}

/** Hunger a day of winter burns: an eighth of a point a second, over a 240 s day. */
const HUNGER_A_DAY = 30;

/** The hunger each kept food fills, for the food laid by: a fish counts as the cooked meal it makes, and pine needles make tea, not meals. */
const LAID_BY_HUNGER: Record<KeptFood, number> = {
  hazelnut: BALANCE.hazelnutHunger, honey: BALANCE.honeyHunger, pineNeedles: 0, roastedHazelnuts: BALANCE.roastedHazelnutHunger,
  trailFood: BALANCE.trailFoodHungerGain, vegetables: BALANCE.vegetableHunger, fish: BALANCE.cookedFishHunger, rabbit: BALANCE.cookedRabbitHunger,
  flour: BALANCE.breadHunger
};

/** Whole days of winter hunger the kept food in the bag and the larder, the granary's grain and the hive's honey would fill, up to the season's ten. */
export function foodLaidByDays(state: GameState): number {
  const kept = (Object.keys(LAID_BY_HUNGER) as KeptFood[])
    .reduce((total, item) => total + (state.inventory.food[item] + state.larder[item]) * LAID_BY_HUNGER[item], 0);
  // The granary's grain counts as the loaves it would make, as flour does; the mill's flour and the bakery's loaves count too.
  const loaves = Math.floor(state.field.grain / BALANCE.grainPerFlour) + state.millFlour + state.bakery.shelf.length;
  const hunger = kept + loaves * BALANCE.breadHunger + state.beehive.honey * BALANCE.honeyHunger;
  return Math.min(SEASON_LENGTH, Math.floor(hunger / HUNGER_A_DAY));
}

const isLateAutumn = (day: number): boolean => season(day) === 'autumn' && daysLeftInSeason(day) <= 3;

/** The food laid by for winter, shown on every forecast card in autumn's last three days. */
function foodLaidByLine(state: GameState): string {
  if (!isLateAutumn(state.day)) return '';
  const days = foodLaidByDays(state);
  return `${days >= SEASON_LENGTH ? '✓' : '○'} Food laid by: enough for ${days} of ${SEASON_LENGTH} days`;
}

/** Autumn's last three days, with no cold night to warn of instead: winter is coming, and the bushes stay bare through it. */
function winterComingForecast(state: GameState): ForecastView | null {
  const coldNightDue = !state.progress.hearthUnlocked && state.progress.nextStormDay !== null;
  if (coldNightDue || !isLateAutumn(state.day)) return null;
  return {
    active: false, shown: true,
    title: 'Winter is coming',
    copy: 'The bushes stay bare all winter. Lay by food that keeps: dry rations and gather hazelnuts. The quiet spring freezes in winter, and a fishing line could see you through.',
    shelter: '', fire: '', food: foodLaidByLine(state)
  };
}

export function forecastView(state: GameState): ForecastView {
  const winterComing = winterComingForecast(state);
  if (winterComing) return winterComing;
  const storm = isColdNight(state);
  if (state.progress.hearthUnlocked) {
    // With the cold night weathered, only winter's nights are left to forecast.
    return isWinter(state.day) ? winterForecast(state) : { active: false, shown: false, title: '', copy: '', shelter: '', fire: '', food: '' };
  }
  const day = state.progress.nextStormDay!;
  const sheltered = state.structures.shelter;
  return {
    active: storm, shown: true,
    title: storm ? 'The cold night is here' : `Cold night · day ${day}`,
    copy: storm ? 'Stay at camp and keep the fire alive until dawn.' : `Build a shelter and bring ${LOG_WORDS[logsForColdNight(day)]} logs to camp before nightfall on day ${day}.`,
    shelter: sheltered ? '✓ Shelter ready' : '○ Shelter needed',
    fire: forecastFireCheck(state),
    food: foodLaidByLine(state)
  };
}

/** The line under the start screen's buttons, about the save waiting in this browser. */
export function startNote(save: LoadResult, storageAvailable: boolean): string {
  if (!storageAvailable) return 'Browser storage is unavailable, so this camp will not be saved.';
  if (save.kind === 'loaded') return `Your camp is waiting on day ${save.state.day}.`;
  if (save.kind === 'invalid') return `Your existing save could not be loaded: ${save.reason}`;
  return 'A fresh camp is ready whenever you are.';
}

/** The Bag panel's forage cells, shown only while the bag holds some; all but pine needles, flour and the rabbit can be eaten from here. */
export const BAG_FOODS = [
  { item: 'apple', label: 'Apples', eat: 'Eat an apple' },
  { item: 'egg', label: 'Eggs', eat: null },
  { item: 'greens', label: 'Greens', eat: 'Eat a handful of greens' },
  { item: 'hazelnut', label: 'Hazelnuts', eat: 'Eat a hazelnut' },
  { item: 'honey', label: 'Honey', eat: 'Eat some honey' },
  { item: 'pineNeedles', label: 'Pine needles', eat: null },
  { item: 'roastedHazelnuts', label: 'Roasted hazelnuts', eat: 'Eat the roasted hazelnuts' },
  { item: 'vegetables', label: 'Vegetables', eat: 'Eat some raw vegetables' },
  { item: 'fish', label: 'Fish', eat: 'Eat a raw fish' },
  { item: 'bread', label: 'Bread', eat: 'Eat a loaf of bread' },
  { item: 'flour', label: 'Flour', eat: null },
  // EASTER EGG: only ever brought by a wolf friend, and shown only while there is one. Left out of the
  // README on purpose; see the wolf's gift in src/game/companion.ts and AGENTS.md.
  { item: 'rabbit', label: 'Rabbit', eat: null }
] as const;
export type BagFood = (typeof BAG_FOODS)[number]['item'];

/** Every forage cell, hidden until the bag panel shows it; fresh food has a line for what is going soft. */
export function bagFoodMarkup(): string {
  return BAG_FOODS.map(({ item, label, eat }) => {
    let button = eat ? `<button type="button" class="supply-action" data-action="eat" data-item="${item}" data-supply="${item}" aria-label="${eat}">Eat</button>` : '';
    if (item === 'pineNeedles') button = '<button type="button" class="supply-action" data-action="burnPineNeedles" data-supply="pineNeedles" aria-label="Burn one bunch of pine needles">Burn</button><button type="button" class="supply-action" data-action="dropPineNeedles" data-supply="pineNeedles" aria-label="Drop one bunch of pine needles">Drop</button>';
    const note = isFresh(item) ? `<small id="${item}-note" class="supply-note"></small>` : '';
    return `<div data-food="${item}" hidden><img class="food-icon" src="${foodIconUrl(item)}" alt=""><strong id="${item}-count">0</strong><small>${label}</small>${note}${button}</div>`;
  }).join('');
}

/** The foods the Bag panel has an Eat button for. */
export const EATABLE_FOODS = ['berry', 'trailFood', ...BAG_FOODS.filter(cell => cell.eat).map(cell => cell.item)] as const satisfies readonly FoodItem[];
export type EatableFood = (typeof EATABLE_FOODS)[number];

export interface BagView { oreAtForge: string; oreShown: boolean; foods: Record<BagFood, { count: number; shown: boolean; note: string }>; eatable: Record<EatableFood, boolean>; berries: string; spaces: string; spacesLabel: string; packHint: string; prepareReady: boolean; prepareHint: string; storedAtCamp: string; woodAtCamp: string; fiberAtCamp: string; fire: string }

export function bagView(state: GameState): BagView {
  const prepareBlocker = trailFoodBlocker(state);
  const pile = state.structures.stonePile;
  // The woodpile and, once the house stands, the woodshed keep one wood store between them.
  const woodStore = hasWoodStore(state);
  /** "(2 going soft)" for the bag's fresh pieces gone at the next dawn, or nothing. */
  const softNote = (item: FoodItem): string => {
    const soft = isFresh(item) ? goingSoft(state.inventory.food, item, state.day, BALANCE.bagFreshDays) : 0;
    return soft ? ` (${soft} going soft)` : '';
  };
  // Eat reaches the larder in the clearing, so a cell shows with its button while there is any to eat, even with none in the bag.
  const eatable = Object.fromEntries(EATABLE_FOODS.map(item => [item, availableFood(state, item) > 0])) as BagView['eatable'];
  const foods = Object.fromEntries(BAG_FOODS.map(({ item, eat }) => {
    const count = foodCount(state.inventory.food, item);
    return [item, { count, shown: count > 0 || (eat !== null && availableFood(state, item) > 0), note: softNote(item).trim() }];
  })) as BagView['foods'];
  return {
    foods,
    eatable,
    berries: `Berries ${foodCount(state.inventory.food, 'berry')}${softNote('berry')}`,
    spaces: `${carriedCount(state)}/${bagCapacity(state)}`,
    spacesLabel: ['Carried', ...(state.progress.packWoven ? ['woven pack'] : []), ...(ponyWith(state) ? ['the pony'] : [])].join(' · '),
    packHint: state.progress.packWoven ? '' : `Weave a pack at the toolshed to carry ${BALANCE.packCapacity}.`,
    prepareReady: !prepareBlocker,
    prepareHint: prepareBlocker ?? `1 berry · ${workSeconds(state, BALANCE.trailFoodSeconds)} seconds · 1 ration`,
    storedAtCamp: pile ? `+${state.storedStone} at camp` : '',
    oreAtForge: state.progress.workshop.forge ? `+${state.storedOre} at the forge` : '',
    oreShown: availableOre(state) > 0 || state.inventory.ore > 0,
    // The handcart's load counts as wood at camp even before there is a woodpile to unload it onto.
    woodAtCamp: woodStore || state.progress.workshop.handcart ? `+${logsInStore(state)} at camp` : '',
    fiberAtCamp: state.structures.fibreStack ? `+${state.storedFiber} at camp` : '',
    fire: fireLine(state)
  };
}

/** The fire that keeps the survivor warm: the campfire's fuel, or once they live in the house, the fireplace and the logs it has to draw on. */
function fireLine(state: GameState): string {
  if (!livesInHouse(state)) return state.fireFuel > 0 ? `Fire burning · ${Math.ceil(state.fireFuel)}s of warmth` : 'The fire is unlit';
  const night = state.timeOfDay >= nightStart(state.day);
  const stored = logsInStore(state);
  if (night && state.fireplaceFuel <= 0 && stored === 0) return 'The fireplace is out. Stock the wood store.';
  const logs = `${stored} log${stored === 1 ? '' : 's'} in store`;
  if (stored <= 2) return `Wood is running low · ${logs}`;
  return `${night ? 'The fireplace is burning' : 'The fireplace is banked'} · ${logs}`;
}

const LARDER_LABELS: Record<FoodItem, string> = {
  berry: 'Berries', apple: 'Apples', egg: 'Eggs', greens: 'Greens', hazelnut: 'Hazelnuts', honey: 'Honey', pineNeedles: 'Pine needles', roastedHazelnuts: 'Roasted hazelnuts', trailFood: 'Rations', vegetables: 'Vegetables', fish: 'Fish', rabbit: 'Rabbit', flour: 'Flour', bread: 'Bread'
};

export interface LarderRowView { item: FoodItem; label: string; kept: number; storeDisabled: boolean; storeTitle: string; takeDisabled: boolean; takeTitle: string }

/** The larder's controls under its build button, once built: how full it is, and a row for each food in the bag or the larder. */
export function larderView(state: GameState): { shown: boolean; stored: string; rows: LarderRowView[] } {
  const rows = FOOD_ITEMS.filter(item => foodCount(state.inventory.food, item) + foodCount(state.larder, item) > 0).map(item => {
    const storeBlocker = storeFoodBlocker(state, item), takeBlocker = takeFoodBlocker(state, item);
    return {
      item, label: LARDER_LABELS[item], kept: foodCount(state.larder, item),
      storeDisabled: Boolean(storeBlocker), storeTitle: storeBlocker ?? `Store 1 ${foodWord(item, 1)}.`,
      takeDisabled: Boolean(takeBlocker), takeTitle: takeBlocker ?? `Take 1 ${foodWord(item, 1)}.`
    };
  });
  return { shown: state.structures.larder, stored: `Stored food ${storeTotal(state.larder)}/${foodStoreCapacity(state)}`, rows };
}

/** The larder's controls, hidden until built, with a hidden row for every food. */
export function larderMarkup(): string {
  const rows = FOOD_ITEMS.map(item => `<div class="larder-row" data-larder-item="${item}" hidden><span>${LARDER_LABELS[item]} <b id="larder-${item}-count">0</b></span><button type="button" data-action="storeFood" data-item="${item}">Store 1</button><button type="button" data-action="takeFood" data-item="${item}">Take 1</button></div>`).join('');
  return `<div id="larder-controls" class="stone-pile-controls larder-controls" hidden><span id="larder-stored">Stored food 0/${BALANCE.larderCapacity}</span>${rows}</div>`;
}

export type CampStoreId = 'wood' | 'fiber' | 'stone' | 'ore' | 'cart';
export interface CampStoresView { shown: boolean; lines: { id: CampStoreId; text: string; shown: boolean }[] }

export function campStoresView(state: GameState): CampStoresView {
  const { structures } = state;
  const handcart = state.progress.workshop.handcart;
  const lines: CampStoresView['lines'] = [
    { id: 'wood', text: `Wood ${state.storedWood}/${woodStoreCapacity(state)}`, shown: hasWoodStore(state) },
    { id: 'fiber', text: `Fiber ${state.storedFiber}/${BALANCE.fibreStackCapacity}`, shown: structures.fibreStack },
    { id: 'stone', text: `Stone ${state.storedStone}/${BALANCE.stonePileCapacity}`, shown: structures.stonePile },
    { id: 'ore', text: `Ore ${state.storedOre}/${BALANCE.forgeOreCapacity}`, shown: state.progress.workshop.forge },
    { id: 'cart', text: `Cart ${state.cartWood}/${BALANCE.handcartCapacity}`, shown: handcart }
  ];
  return { shown: structures.larder || lines.some(line => line.shown), lines };
}

/** Every building's button for the build list, in order, with the Shelter upgrades heading above the first upgrade. */
export function buildListMarkup(): string {
  return (Object.keys(BUILDINGS) as StructureId[]).map(id => {
    const { name, description, symbol } = BUILDINGS[id];
    const groupHeading = id === 'shelterThatched' ? '<h3 id="shelter-upgrades-heading" class="build-group-heading">Shelter upgrades</h3>' : '';
    return groupHeading + `<button type="button" class="build-item" data-build="${id}"><span class="build-symbol">${symbol}</span><span class="build-copy"><strong>${name}</strong><small>${description}</small></span><span class="build-cost"><b class="build-verb">Build</b><small class="build-price"></small></span></button>`;
  }).join('');
}

const CAMP_STORE_IDS: readonly CampStoreId[] = ['wood', 'fiber', 'stone', 'ore', 'cart'];

/** The Camp stores panel, hidden until a store exists, with a hidden line per store and the larder's controls. */
export function campStoresMarkup(): string {
  const lines = CAMP_STORE_IDS.map(id => `<p id="store-line-${id}" class="store-line" hidden></p>`).join('');
  return `<section class="panel stores-panel" id="stores-panel" data-tab="bag" hidden><p class="eyebrow">CAMP STORES</p><div class="store-lines">${lines}</div>${larderMarkup()}</section>`;
}

export interface BuildButtonView { shown: boolean; disabled: boolean; built: boolean; locked: boolean; ready: boolean; description: string; verb: string; price: string }

const BLOCKED_LABELS = { built: ['Built', 'Complete'], locked: ['Locked', 'Weather cold night'] } as const;

function buildPrice(id: StructureId): string {
  const cost = BUILDINGS[id].cost;
  const stone = 'stone' in cost ? cost.stone : 0;
  return [cost.wood ? `${cost.wood} wood` : '', cost.fiber ? `${cost.fiber} fiber` : '', stone ? `${stone} stone` : '']
    .filter(Boolean).join(' · ');
}

function prerequisiteDescription(id: StructureId): string {
  const definition = BUILDINGS[id];
  const prerequisite = definition.prerequisite;
  const prerequisiteNames: string[] = [];
  if (prerequisite && prerequisite !== 'coldNight') prerequisiteNames.push(BUILDINGS[prerequisite].name.toLowerCase());
  if ('alsoRequires' in definition) prerequisiteNames.push(BUILDINGS[definition.alsoRequires].name.toLowerCase());
  return prerequisiteNames.length ? `Requires ${prerequisiteNames.join(' and ')}` : 'Requires its previous shelter upgrade';
}

function buildDescription(state: GameState, id: StructureId, status: ReturnType<typeof buildStatus>): string {
  if (status === 'needsGround') return (groundBlocker(state, id) ?? '').replace(/\.$/, '');
  if (status === 'needsPrerequisite' || status === 'needsShelter') return prerequisiteDescription(id);
  return BUILDINGS[id].description;
}

export function buildButtonView(state: GameState, id: StructureId): BuildButtonView {
  const status = buildStatus(state, id);
  const blocked = status === 'needsPrerequisite' || status === 'needsShelter' || status === 'needsGround';
  const view = {
    shown: status === 'ready' || status === 'unavailable',
    disabled: status === 'built' || status === 'locked' || blocked,
    built: status === 'built',
    locked: status === 'locked' || blocked,
    ready: status === 'ready',
    description: buildDescription(state, id, status),
    verb: blocked ? 'Blocked' : 'Build',
    price: buildPrice(id)
  };
  if (status === 'built' || status === 'locked') {
    const [verb, label] = BLOCKED_LABELS[status];
    return { ...view, verb, price: label };
  }
  return view;
}

const SHELTER_UPGRADES: readonly StructureId[] = ['shelterThatched', 'shelterStonework', 'shelterPorch', 'shelterFinished'];

/** Whether a gold strip stands in the field with no sickle and flail made to bring it in. */
const ripeGrainWaitsForTools = (state: GameState): boolean => state.structures.field && !state.progress.workshop.harvestTools
  && state.field.strips.some(strip => stripStage(strip, state.day) === 'gold');

export interface BuildListView { shelterHeading: boolean; empty: boolean; hint: string }

export function buildListView(state: GameState): BuildListView {
  const shown = (Object.keys(BUILDINGS) as StructureId[]).filter(id => buildButtonView(state, id).shown);
  const empty = shown.length === 0;
  let hint = isInClearing(state) ? 'In the clearing — click an upgrade to build.' : 'Stand anywhere in the clearing to build.';
  if (empty) hint = 'Nothing new to build for now. Clear more land or explore to find what comes next.';
  if (empty && STEP_IDS.every(id => state.clearing.cleared.includes(id))) hint = 'No structures left to build.';
  if (ripeGrainWaitsForTools(state)) hint += ' Ripe grain is waiting. Make a sickle and flail at the workshop.';
  return { shelterHeading: SHELTER_UPGRADES.some(id => shown.includes(id)), empty, hint };
}

export interface ClearingSideView { side: Side; label: string; detail: string; disabled: boolean; done: boolean; chosen: boolean }

const CLEARING_SIDES: readonly Side[] = ['north', 'east', 'south', 'west'];

const capitalised = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

function clearingSideView(state: GameState, side: Side): ClearingSideView {
  const step = nextStep(state, side);
  const name = capitalised(side);
  if (!step) return { side, label: `${name} · cleared`, detail: '', disabled: true, done: true, chosen: false };
  const { trees, cost } = CLEARING_STEPS[step];
  const room = roomLine(step, state.structures, id => Object.hasOwn(BUILDINGS, id) && buildStatus(state, id as StructureId) !== 'locked');
  const price = cost.stone > 0
    ? `${trees.length} trees, then ${cost.wood} wood, ${cost.fiber} fiber and ${cost.stone} stone`
    : `${trees.length} trees, then ${cost.wood} wood and ${cost.fiber} fiber`;
  return {
    side,
    label: `${name} · ${stepDepth(step)}`,
    detail: room ? `${price}.${room}` : price,
    disabled: Boolean(markBlocker(state, step)),
    done: false,
    chosen: state.clearing.marked === step
  };
}

/** The Build tab's "Clear the land" group: unfinished sides, compact progress, then the active ground action. */
export function clearingView(state: GameState): { shown: boolean; sides: ClearingSideView[]; progress: string; clear: ActionPanelView } {
  const { marked, felled } = state.clearing;
  const blocker = clearGroundBlocker(state);
  const sides = CLEARING_SIDES.map(side => clearingSideView(state, side));
  const complete = sides.every(side => side.done);
  const clear = { title: 'Clear the ground', shown: !complete, disabled: Boolean(blocker), ready: !blocker };
  let progress = '';
  if (complete) progress = 'All ground cleared.';
  else if (state.clearing.cleared.length > 0) progress = `Cleared ground: ${state.clearing.cleared.map(step => step.replace('-', ' ')).join(', ')}.`;
  const shown = state.progress.axeCrafted;
  if (!marked) return { shown, sides, progress, clear: { ...clear, copy: 'Choose a side to mark its trees for felling.', cost: 'Choose a side first' } };
  const { trees, cost } = CLEARING_STEPS[marked];
  const left = trees.length - felled.length;
  let copy = `Ready to clear ${stepGround(marked)}.`;
  if (left > 0) {
    const treeWord = left === 1 ? 'tree' : 'trees';
    copy = `Fell the ${left} marked ${treeWord} left ${stepWhere(marked)}.`;
  }
  return { shown, sides, progress, clear: { ...clear, copy, cost: `${cost.wood} wood · ${cost.fiber} fiber${cost.stone > 0 ? ` · ${cost.stone} stone` : ''}` } };
}

export const DECORATION_CHOICES: readonly DecorationChoice[] = ['berryPaint', 'leafPaint', 'flowerBoxes', 'fence'];
const DECORATION_NAMES: Record<DecorationChoice, string> = {
  berryPaint: 'Berry red walls', leafPaint: 'Leaf green walls', flowerBoxes: 'Flower boxes', fence: 'Wooden fence'
};

export function decorationMarkup(): string {
  return DECORATION_CHOICES.map(choice => `<button type="button" class="build-item" data-decorate="${choice}"><span class="build-symbol">✿</span><span class="build-copy"><strong>${DECORATION_NAMES[choice]}</strong><small class="decor-description"></small></span><span class="build-cost"><b class="build-verb"></b><small class="build-price"></small></span></button>`).join('');
}

export function decorationButtonView(state: GameState, choice: DecorationChoice): BuildButtonView {
  const blocker = decorationBlocker(state, choice);
  const cost = DECORATION_COSTS[choice];
  const price = [cost.wood && `${cost.wood} wood`, cost.fiber && `${cost.fiber} fiber`, cost.berry && `${cost.berry} berries`, cost.greens && `${cost.greens} greens`].filter(Boolean).join(' · ');
  let built = choice === 'flowerBoxes' && state.decorations.flowerBoxes;
  if (choice === 'fence') built = state.decorations.fence >= 3;
  if (choice === 'berryPaint') built = state.decorations.paint === 'berry';
  if (choice === 'leafPaint') built = state.decorations.paint === 'leaf';
  let description = 'Color the house with gathered pigment';
  if (choice === 'flowerBoxes') description = 'A pair beneath the window';
  if (choice === 'fence') description = `Section ${Math.min(3, state.decorations.fence + 1)} of 3 · fixed around the yard`;
  return { shown: state.structures.house, disabled: Boolean(blocker), built, locked: Boolean(blocker) && !built,
    ready: !blocker, description, verb: built ? 'Done' : 'Make', price };
}

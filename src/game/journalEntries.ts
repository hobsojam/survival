import { duskLength, nightStart, season, seasonMessage, yearOf, type Season } from './calendar';
import { defaultDish, type DishId } from './cooking';
import { keepsakeStock } from './companion';
import { foodCount, type FoodItem } from './food';
import { firstSheepName, lineWithName, nameForDay } from './names';
import { rainMessage } from './rain';
import { sheepStage } from './sheep';
import { fuelLeft, isAtHome, livesInHouse, warmFuel } from './home';
import { isColdNight, isInClearing, type GameAction } from './rules';
import { LOOKOUT, type GameState } from './state';
import { RABBIT_HOMES } from './wildlife';
import { wolfMessage } from './wolves';

// The year journal is a keepsake: the survivor writes small moments down as they happen,
// once a year each, and nothing written here ever changes the game.

export type JournalId =
  | 'leaves' | 'fox' | 'coldFront' | 'driedBerries' | 'stars'
  | 'firstSnow' | 'wolfTracks' | 'frozenSpring' | 'winterFire' | 'winterCooking'
  | 'firstRain' | 'rabbits' | 'bushesFull' | 'stumpGrowing' | 'springRest'
  | 'fireflies' | 'twoHandfuls' | 'goldEvening' | 'warmSleep' | 'lookoutEvening'
  | 'hazelnuts' | 'pineTea' | 'salad' | 'wildHoney' | 'fireside' | 'grainIn' | 'winterBread'
  | 'autumnGrain' | 'summerBread' | 'ovenBread' | 'shearing' | 'orchardApple'
  | 'hillsAutumn' | 'hillsWinter' | 'hillsSpring' | 'hillsSummer'
  | 'keepViewAutumn' | 'keepViewWinter' | 'keepViewSpring' | 'keepViewSummer'
  | 'keepFinishedAutumn' | 'keepFinishedWinter' | 'keepFinishedSpring' | 'keepFinishedSummer'
  | 'autumnKeepsake' | 'winterKeepsake' | 'springKeepsake' | 'summerKeepsake'
  | 'namedAutumn' | 'namedWinter' | 'namedSpring' | 'namedSummer';

/** `name` is the animal's name when the line was written, so naming one later never changes old lines. */
export interface JournalEntry { year: number; id: JournalId; day: number; variant: number; name?: string }

interface PageEntry {
  id: JournalId;
  lines: readonly string[];
  /** Announced already by its own message, so writing it adds no second line. */
  silent?: boolean;
}

export const JOURNAL_PAGES: Record<Season, readonly PageEntry[]> = {
  autumn: [
    { id: 'leaves', lines: ['The first leaves came down over camp.'] },
    { id: 'orchardApple', lines: ['Picked an apple from a tree I grew myself.'] },
    { id: 'hillsAutumn', lines: ['The bracken has gone rusty up on the hills.'] },
    { id: 'keepViewAutumn', lines: ['From the top of the keep, the woods have all turned.'] },
    { id: 'keepFinishedAutumn', lines: ['Laid the last stone on the keep.'] },
    { id: 'fox', lines: ['A fox nosed around the berry bushes at dusk.'] },
    { id: 'coldFront', lines: ['The cold night came. I kept the fire through it.', 'The cold night came, and it got the better of me.',
      'A cold autumn night, and the fire kept me warm.'] },
    { id: 'driedBerries', lines: ['Dried berries for the winter.'] },
    { id: 'stars', lines: ['Lay back and counted stars.'] },
    { id: 'hazelnuts', lines: ['Found hazelnuts in the leaf litter.'] },
    { id: 'fireside', lines: ['A night by the fireplace, the door shut against the wind.'] },
    { id: 'autumnGrain', lines: ['Threshed the grain with the leaves coming down.'] },
    { id: 'autumnKeepsake', lines: ['Found a feather by the fire, among the fallen leaves.', 'Found a tuft of fur by the fire, among the fallen leaves.'] },
    { id: 'namedAutumn', lines: ['{name} watched the leaves come down, and seemed to take it personally.'] }
  ],
  winter: [
    { id: 'firstSnow', lines: ['Snow fell in the night.'], silent: true },
    { id: 'wolfTracks', lines: ['Paw prints round the fire this morning.'], silent: true },
    { id: 'frozenSpring', lines: ['The quiet spring had frozen over.'] },
    { id: 'winterFire', lines: ['Kept the fire alive through a whole winter night.'] },
    { id: 'winterCooking', lines: ['Cooked berries by the fire, with the snow coming down.', 'Cooked a fish by the fire, with the snow coming down.',
      'Cooked a warm supper by the fire, with the snow coming down.'] },
    { id: 'pineTea', lines: ['Pine needle tea, hot in the snow.'] },
    { id: 'hillsWinter', lines: ['Snow on the hills.'] },
    { id: 'keepViewWinter', lines: ['Snow as far as I can see from the top of the keep.'] },
    { id: 'keepFinishedWinter', lines: ['Laid the last stone on the keep.'] },
    { id: 'winterBread', lines: ['Bread from my own field, warm by the fire.'] },
    { id: 'winterKeepsake', lines: ['A feather by the fire, bright against the snow.', 'A tuft of fur by the fire, frost on its tips.'] },
    { id: 'namedWinter', lines: ['{name} and I agreed that it was cold.'] }
  ],
  spring: [
    { id: 'firstRain', lines: ['The first rain of spring.'], silent: true },
    { id: 'rabbits', lines: ['Rabbits in the meadow.'] },
    { id: 'hillsSpring', lines: ['Gorse in flower on the hills.'] },
    { id: 'keepViewSpring', lines: ['From the top of the keep, the gorse is out all the way down.'] },
    { id: 'keepFinishedSpring', lines: ['Laid the last stone on the keep.'] },
    { id: 'bushesFull', lines: ['The bushes are full again.'] },
    { id: 'stumpGrowing', lines: ['A stump I cut is growing back already.'] },
    { id: 'springRest', lines: ['Sat a while at the spring, now that it\'s thawed.'] },
    { id: 'salad', lines: ['Greens and berries, the first salad of spring.'] },
    { id: 'ovenBread', lines: ['Woke to warm bread from my own oven.'] },
    { id: 'shearing', lines: ['Sheared the flock. They looked smaller and rather cross.', 'Sheared the cloud. There was a sheep in there after all.',
      'Sheared {name} and the others. They looked smaller and rather cross.', 'Sheared the cloud. There was a {name} in there after all.'] },
    { id: 'namedSpring', lines: ['Spring, and {name} is still here. I\'m glad.'] },
    { id: 'springKeepsake', lines: ['A new feather by the fire, soft as the morning.', 'A tuft of winter fur by the fire, shed for spring.'] }
  ],
  summer: [
    { id: 'fireflies', lines: ['Fireflies over camp.'] },
    { id: 'twoHandfuls', lines: ['Two handfuls from one bush.'] },
    { id: 'goldEvening', lines: ['The evening went gold.'] },
    { id: 'warmSleep', lines: ['Slept out without a fire, and it was warm.'] },
    { id: 'lookoutEvening', lines: ['Watched the land from the lookout on a long evening.'] },
    { id: 'wildHoney', lines: ['Wild honey from the hollow tree.'] },
    { id: 'grainIn', lines: ['Brought the grain in. The granary smells of summer.'] },
    { id: 'summerBread', lines: ['The first loaf from the new grain, still warm.'] },
    { id: 'hillsSummer', lines: ['Heather out on the hills.'] },
    { id: 'keepViewSummer', lines: ['Heather as far as I can see from the top of the keep.'] },
    { id: 'keepFinishedSummer', lines: ['Laid the last stone on the keep.'] },
    { id: 'summerKeepsake', lines: ['A feather by the fire on a warm morning.', 'A wisp of fur by the fire on a warm morning.'] },
    { id: 'namedSummer', lines: ['A long warm evening with {name}. Neither of us did much.'] }
  ]
};

const ENTRIES = new Map(Object.values(JOURNAL_PAGES).flat().map(entry => [entry.id, entry]));
export const journalEntry = (id: JournalId): PageEntry | undefined => ENTRIES.get(id);
/** The season whose page an entry belongs on. */
export const journalSeason = (id: JournalId): Season | undefined =>
  (Object.keys(JOURNAL_PAGES) as Season[]).find(s => JOURNAL_PAGES[s].some(entry => entry.id === id));

/** A moment just noticed: the day it belongs to, which line tells it, and whether its own message already said so. */
interface Noticed { day: number; variant?: number; silent?: boolean; name?: string }
interface Moment { before: GameState; after: GameState; action?: GameAction }

const awake = ({ action }: Moment): boolean => action?.type !== 'sleep';
const done = ({ before, after }: Moment): boolean => after !== before;
const dawn = ({ before, after }: Moment): boolean => after.day > before.day;
const daylight = (state: GameState): boolean => state.timeOfDay < nightStart(state.day);
const atDusk = (state: GameState): boolean => daylight(state) && state.timeOfDay >= nightStart(state.day) - duskLength(state.day);
const within = (state: GameState, point: { x: number; y: number }, tiles: number): boolean =>
  Math.hypot(state.player.x - point.x, state.player.y - point.y) <= tiles;
const acted = (m: Moment, type: GameAction['type']): boolean => m.action?.type === type && done(m);
const onAfter = (m: Moment, when: boolean): Noticed | null => (when ? { day: m.after.day } : null);
const onBefore = (m: Moment, when: boolean): Noticed | null => (when ? { day: m.before.day } : null);
const berries = (state: GameState): number => foodCount(state.inventory.food, 'berry');
/** A successful gather that brought more of one food into the bag. */
const gathered = (m: Moment, item: FoodItem): boolean =>
  acted(m, 'gather') && foodCount(m.after.inventory.food, item) > foodCount(m.before.inventory.food, item);
/** A successful cook of this dish: the one named, or on a bare C press the one C picks, wherever its ingredients were kept. */
const cooked = (m: Moment, dish: DishId): boolean =>
  m.action?.type === 'cook' && done(m) && (m.action.dish ?? defaultDish(m.before)) === dish;
/** A visit to the quiet spring, or a go at fishing through its ice. */
const atSpring = (m: Moment): boolean => ((m.action?.type === 'visitSite' && m.action.siteId === 'spring') || m.action?.type === 'fish') && done(m);

/** A strip threshed that put grain into the granary, not into a granary already full. */
const grainWentIn = (m: Moment): boolean => acted(m, 'threshStrip') && m.after.field.grain > m.before.field.grain;

/** A feather or a tuft of fur just picked up by the fire, told by its own line. */
const keepJustFinished = (m: Moment): Noticed | null => onBefore(m, acted(m, 'layStone') && m.before.keep.finishedDay === null && m.after.keep.finishedDay !== null);
const lookedOut = (m: Moment): Noticed | null => onBefore(m, acted(m, 'climbKeep'));
const upOnHills = (m: Moment): Noticed | null => onAfter(m, awake(m) && m.after.area === 'hills' && daylight(m.after));

function keepsakeFound(m: Moment): Noticed | null {
  if (keepsakeStock(m.after, 'feather') > keepsakeStock(m.before, 'feather')) return { day: m.after.day, variant: 0 };
  return keepsakeStock(m.after, 'fur') > keepsakeStock(m.before, 'fur') ? { day: m.after.day, variant: 1 } : null;
}

/** The shearing's line: a flock or a cloud, by a sheep's name once one has been given. */
function shorn(m: Moment): Noticed | null {
  if (m.after.sheep.lastShornYear === m.before.sheep.lastShornYear) return null;
  const cloud = sheepStage(m.before.sheep.fluff) === 'cloud' ? 1 : 0;
  const name = firstSheepName(m.before);
  return name ? { day: m.before.day, variant: cloud + 2, name } : { day: m.before.day, variant: cloud };
}

/** The first dawn of a season with something named goes on that season's page, with one of the names. */
function namedMoment(m: Moment): Noticed | null {
  const name = dawn(m) ? nameForDay(m.after, m.after.day) : null;
  return name ? { day: m.after.day, name } : null;
}

/** Which winter cooking line a meal gets: berries, a fish, or any other supper. */
function winterMealLine(m: Moment): number {
  if (cooked(m, 'berries')) return 0;
  return cooked(m, 'fish') ? 1 : 2;
}

const RULES: Record<JournalId, (m: Moment) => Noticed | null> = {
  // Not in the day's first moments, so the morning's own message (a new game, a waking) stays on screen.
  leaves: m => onAfter(m, awake(m) && m.before.timeOfDay >= 30 && isInClearing(m.after) && daylight(m.after)),
  fox: m => onAfter(m, awake(m) && isInClearing(m.after) && atDusk(m.after)),
  coldFront: m => {
    if (isColdNight(m.before) && !isColdNight(m.after)) return { day: m.before.day, variant: m.after.progress.hearthUnlocked ? 0 : 1, silent: true };
    // Once the cold night is long weathered, any autumn night kept warm at home fills its place in later years.
    const weathered = m.before.progress.hearthUnlocked && m.before.progress.nextStormDay === null;
    return dawn(m) && weathered && isAtHome(m.before) && fuelLeft(m.before) > 0 ? { day: m.before.day, variant: 2 } : null;
  },
  driedBerries: m => onBefore(m, acted(m, 'prepareTrailFood')),
  stars: m => onBefore(m, acted(m, 'stargaze')),
  firstSnow: m => onAfter(m, seasonMessage(m.before.day, m.after.day) !== null),
  wolfTracks: m => (wolfMessage(m.before, m.after) !== null && m.after.lastWolf ? { day: m.after.lastWolf.day } : null),
  frozenSpring: m => onBefore(m, atSpring(m)),
  // Slept through at camp: a fire still burning at dawn never went out in the sleep, since nobody fed it.
  // Before lying down, a fire that went out brought a wolf (or the friend's chase); a ration left out says nothing either way.
  winterFire: m => onBefore(m, acted(m, 'sleep') && dawn(m) && isAtHome(m.before) && fuelLeft(m.after) > 0
    && (m.before.lastWolf?.day !== m.before.day || m.before.lastWolf.took === 'offered')),
  // A meal cooked in the snow, told by what it was. Tea has a line of its own, and is no meal.
  // A loaf has a line of its own too.
  winterCooking: m => (acted(m, 'cook') && !cooked(m, 'pineTea') && !cooked(m, 'loaf') ? { day: m.before.day, variant: winterMealLine(m) } : null),
  firstRain: m => onAfter(m, rainMessage(m.before, m.after) !== null),
  rabbits: m => onAfter(m, awake(m) && m.after.area === 'camp' && daylight(m.after) && RABBIT_HOMES.some(home => within(m.after, home, 4))),
  bushesFull: m => onBefore(m, m.action?.type === 'gather' && done(m) && berries(m.after) > berries(m.before)),
  stumpGrowing: m => onAfter(m, dawn(m) && m.after.trees.some(tree => tree.readyDay === m.after.day && tree.readyDay > 1)),
  springRest: m => onBefore(m, atSpring(m)),
  fireflies: m => onAfter(m, awake(m) && isInClearing(m.after) && !daylight(m.after)),
  twoHandfuls: m => onBefore(m, m.action?.type === 'gather' && berries(m.after) - berries(m.before) === 2),
  goldEvening: m => onAfter(m, awake(m) && isInClearing(m.after) && m.before.day === m.after.day
    && daylight(m.before) && !daylight(m.after)),
  warmSleep: m => onBefore(m, acted(m, 'sleep') && !livesInHouse(m.before) && warmFuel(m.after) === 0),
  lookoutEvening: m => onAfter(m, awake(m) && m.after.progress.lookoutRepaired && m.after.area === 'camp'
    && within(m.after, LOOKOUT, 2) && atDusk(m.after)),
  hazelnuts: m => onBefore(m, gathered(m, 'hazelnut')),
  pineTea: m => onBefore(m, cooked(m, 'pineTea')),
  salad: m => onBefore(m, cooked(m, 'salad')),
  wildHoney: m => onBefore(m, gathered(m, 'honey')),
  // The harvest is told on whichever page it lands: summer's last days, or the autumn after.
  grainIn: m => onBefore(m, grainWentIn(m)),
  shearing: shorn,
  hillsAutumn: upOnHills,
  hillsWinter: upOnHills,
  hillsSpring: upOnHills,
  hillsSummer: upOnHills,
  keepViewAutumn: lookedOut,
  keepFinishedAutumn: keepJustFinished,
  keepViewWinter: lookedOut,
  keepFinishedWinter: keepJustFinished,
  keepViewSpring: lookedOut,
  keepFinishedSpring: keepJustFinished,
  keepViewSummer: lookedOut,
  keepFinishedSummer: keepJustFinished,
  orchardApple: m => onBefore(m, acted(m, 'pickOrchardApple') && m.after.orchard !== m.before.orchard),
  autumnGrain: m => onBefore(m, grainWentIn(m)),
  // A loaf is told on summer's page or winter's, each with its own line.
  summerBread: m => onBefore(m, cooked(m, 'loaf')),
  winterBread: m => onBefore(m, cooked(m, 'loaf')),
  // Woke in camp on a dawn the bakery's oven baked its loaf.
  ovenBread: m => onAfter(m, dawn(m) && m.after.bakery.lastBaked === m.after.day && isInClearing(m.after)),
  // The first keepsake of each season goes on that season's page.
  autumnKeepsake: keepsakeFound,
  winterKeepsake: keepsakeFound,
  springKeepsake: keepsakeFound,
  summerKeepsake: keepsakeFound,
  namedAutumn: namedMoment,
  namedWinter: namedMoment,
  namedSpring: namedMoment,
  namedSummer: namedMoment,
  // Slept through at home in the house, the fireplace still alight at dawn.
  fireside: m => onBefore(m, acted(m, 'sleep') && dawn(m) && livesInHouse(m.before) && isAtHome(m.before) && fuelLeft(m.after) > 0)
};

/**
 * Writes down whatever moments passed between two states, each at most once a year and only on its own season's page.
 * Returns `after` itself when nothing new was written.
 */
export function recordJournal(before: GameState, after: GameState, action?: GameAction): { state: GameState; messages: string[] } {
  const moment: Moment = { before, after, action };
  const written: JournalEntry[] = [];
  const messages: string[] = [];
  for (const [s, entries] of Object.entries(JOURNAL_PAGES) as [Season, readonly PageEntry[]][]) {
    for (const entry of entries) {
      const noticed = RULES[entry.id](moment);
      if (!noticed || season(noticed.day) !== s) continue;
      const year = yearOf(noticed.day);
      if (after.journal.some(item => item.year === year && item.id === entry.id)) continue;
      const variant = noticed.variant ?? 0;
      written.push({ year, id: entry.id, day: noticed.day, variant, ...(noticed.name === undefined ? {} : { name: noticed.name }) });
      if (!entry.silent && !noticed.silent) messages.push(`Written in your journal: ${lineWithName(entry.lines[variant], noticed.name)}`);
    }
  }
  return written.length ? { state: { ...after, journal: [...after.journal, ...written] }, messages } : { state: after, messages };
}

import { inKeep } from './keep';
import { NEEDS, TOWERS, moatFill, towerFinished, wallFinished } from './castle';
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
  | 'castleLineAutumn' | 'castleLineWinter' | 'castleLineSpring' | 'castleLineSummer' | CastleJournalId | TownJournalId
  | 'autumnKeepsake' | 'winterKeepsake' | 'springKeepsake' | 'summerKeepsake'
  | 'namedAutumn' | 'namedWinter' | 'namedSpring' | 'namedSummer';

/** What the castle's progress leaves in the journal, each told once and on the page of the season it happened in. EASTER EGG: the castle, see src/game/castle.ts. */
type CastleMoment = 'castleRoad' | 'castleWall' | 'castleTowers' | 'castleGatehouse' | 'castleMoatFull' | 'castleFeast' | 'castleFinished';
type SeasonWord = 'Autumn' | 'Winter' | 'Spring' | 'Summer';
export type CastleJournalId = `${CastleMoment}${SeasonWord}`;
const CASTLE_MOMENTS: readonly CastleMoment[] = ['castleRoad', 'castleWall', 'castleTowers', 'castleGatehouse', 'castleMoatFull', 'castleFeast', 'castleFinished'];
const SEASON_WORDS: readonly SeasonWord[] = ['Autumn', 'Winter', 'Spring', 'Summer'];
const CASTLE_LINES: Record<CastleMoment, string> = {
  castleRoad: 'Laid the last stone of the road from the quarry to the keep.',
  castleWall: 'The curtain wall is closed all the way round.',
  castleTowers: 'All four towers have their roofs.',
  castleGatehouse: 'The gatehouse is up, and the portcullis works.',
  castleMoatFull: 'Rain filled the moat. There is water all the way round.',
  castleFeast: 'Set the first dish on the table in the great hall.',
  castleFinished: 'Set down the last dish. The castle is finished.'
};
const castlePage = (word: SeasonWord): PageEntry[] => CASTLE_MOMENTS.map(moment => ({ id: `${moment}${word}` as CastleJournalId, lines: [CASTLE_LINES[moment]] }));

/** What the town leaves in the journal: the first traveller at the door, and each neighbour who stays, by name. EASTER EGG: the town, see src/game/town.ts. */
type TownMoment = 'traveller' | 'neighbour' | 'meadowFound' | 'meadowRoad';
export type TownJournalId = `${TownMoment}${SeasonWord}`;
const TOWN_MOMENTS: readonly TownMoment[] = ['traveller', 'neighbour', 'meadowFound', 'meadowRoad'];
const TOWN_LINES: Record<TownMoment, string> = {
  traveller: 'A lost traveller came to the hall door. The first face I have seen in years.',
  neighbour: '{name} is staying on.',
  meadowFound: 'Built a bridge over the stream, and found the meadow beyond.',
  meadowRoad: 'Cleared the old road and set a milestone by it.'
};
const townPage = (word: SeasonWord): PageEntry[] => TOWN_MOMENTS.map(moment => ({ id: `${moment}${word}` as TownJournalId, lines: [TOWN_LINES[moment]], ...(moment === 'neighbour' ? { perName: true } : {}) }));

/** `name` is the animal's name when the line was written, so naming one later never changes old lines. */
export interface JournalEntry { year: number; id: JournalId; day: number; variant: number; name?: string }

interface PageEntry {
  id: JournalId;
  lines: readonly string[];
  /** Announced already by its own message, so writing it adds no second line. */
  silent?: boolean;
  /** Written once for each name, so two neighbours in one season each get their line. */
  perName?: boolean;
}

export const JOURNAL_PAGES: Record<Season, readonly PageEntry[]> = {
  autumn: [
    { id: 'leaves', lines: ['The first leaves came down over camp.'] },
    { id: 'orchardApple', lines: ['Picked an apple from a tree I grew myself.'] },
    { id: 'hillsAutumn', lines: ['The bracken has gone rusty up on the hills.'] },
    { id: 'keepViewAutumn', lines: ['From the top of the keep, the woods have all turned.'] },
    { id: 'keepFinishedAutumn', lines: ['Laid the last stone on the keep.'] },
    { id: 'castleLineAutumn', lines: ['A line of old stones showed in the grass below the keep.'] },
    ...castlePage('Autumn'),
    ...townPage('Autumn'),
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
    { id: 'castleLineWinter', lines: ['A line of old stones showed in the grass below the keep.'] },
    ...castlePage('Winter'),
    ...townPage('Winter'),
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
    { id: 'castleLineSpring', lines: ['A line of old stones showed in the grass below the keep.'] },
    ...castlePage('Spring'),
    ...townPage('Spring'),
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
    { id: 'castleLineSummer', lines: ['A line of old stones showed in the grass below the keep.'] },
    ...castlePage('Summer'),
    ...townPage('Summer'),
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

/** The last stone just laid on the keep. */
const keepJustFinished = (m: Moment): Noticed | null => onBefore(m, acted(m, 'layStone') && m.before.keep.finishedDay === null && m.after.keep.finishedDay !== null);
/** The climb that showed the line of stones. EASTER EGG: the castle, see src/game/castle.ts. */
const lineJustSeen = (m: Moment): Noticed | null => onBefore(m, acted(m, 'climbKeep') && m.before.castle.revealedDay === null && m.after.castle.revealedDay !== null);
/** A climb to the top of the keep. */
const lookedOut = (m: Moment): Noticed | null => onBefore(m, acted(m, 'climbKeep'));
const upOnHills = (m: Moment): Noticed | null => onAfter(m, awake(m) && m.after.area === 'hills' && daylight(m.after));

/** A feather or a tuft of fur just picked up by the fire, told by its own line. */
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

/** A section finished by this moment, as the day it was marked done shows. */
const sectionDone = (m: Moment, section: keyof GameState['castle']['doneDays']): boolean =>
  m.before.castle.doneDays[section] === undefined && m.after.castle.doneDays[section] !== undefined;
const dishesLaid = (state: GameState): number => Object.values(state.castle.feast).reduce((total, count) => total + count, 0);
const CASTLE_RULES: Record<CastleMoment, (m: Moment) => Noticed | null> = {
  castleRoad: m => onBefore(m, sectionDone(m, 'road')),
  castleWall: m => onBefore(m, wallFinished(m.after.castle) && !wallFinished(m.before.castle)),
  castleTowers: m => onBefore(m, TOWERS.every(id => towerFinished(m.after.castle.towers[id])) && !TOWERS.every(id => towerFinished(m.before.castle.towers[id]))),
  castleGatehouse: m => onBefore(m, sectionDone(m, 'gatehouse')),
  // The dawn the spring's rain has filled a dug moat.
  castleMoatFull: m => onAfter(m, m.after.castle.moat.stretches === NEEDS.moat && moatFill(m.before) < 1 && moatFill(m.after) >= 1),
  castleFeast: m => onBefore(m, dishesLaid(m.before) === 0 && dishesLaid(m.after) > 0),
  castleFinished: m => onBefore(m, m.before.castle.finishedDay === null && m.after.castle.finishedDay !== null)
};
const newcomer = (m: Moment): Noticed | null => {
  const { people } = m.after.town;
  return people.length > m.before.town.people.length ? { day: m.before.day, name: people[people.length - 1].name } : null;
};
const TOWN_RULES: Record<TownMoment, (m: Moment) => Noticed | null> = {
  // Only the first: the first face in years.
  traveller: m => onAfter(m, m.before.town.namesUsed === 0 && m.after.town.namesUsed > 0),
  neighbour: newcomer,
  // The first crossing to the meadow, over the finished bridge.
  meadowFound: m => onAfter(m, !m.before.progress.meadowFound && m.after.progress.meadowFound),
  meadowRoad: m => onBefore(m, m.before.town.road.doneDays.milestone === undefined && m.after.town.road.doneDays.milestone !== undefined)
};
const townRules = Object.fromEntries(SEASON_WORDS.flatMap(word => TOWN_MOMENTS.map(moment => [`${moment}${word}`, TOWN_RULES[moment]]))) as Record<TownJournalId, (m: Moment) => Noticed | null>;
const castleRules = Object.fromEntries(SEASON_WORDS.flatMap(word => CASTLE_MOMENTS.map(moment => [`${moment}${word}`, CASTLE_RULES[moment]]))) as Record<CastleJournalId, (m: Moment) => Noticed | null>;

const RULES: Record<JournalId, (m: Moment) => Noticed | null> = {
  ...castleRules,
  ...townRules,
  // Not in the day's first moments, so the morning's own message (a new game, a waking) stays on screen.
  leaves: m => onAfter(m, awake(m) && m.before.timeOfDay >= 30 && isInClearing(m.after) && daylight(m.after)),
  fox: m => onAfter(m, awake(m) && isInClearing(m.after) && atDusk(m.after)),
  coldFront: m => {
    if (isColdNight(m.before) && !isColdNight(m.after)) return inKeep(m.before) ? null : { day: m.before.day, variant: m.after.progress.hearthUnlocked ? 0 : 1, silent: true };
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
  warmSleep: m => onBefore(m, acted(m, 'sleep') && !livesInHouse(m.before) && !inKeep(m.before) && warmFuel(m.after) === 0),
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
  castleLineAutumn: lineJustSeen,
  keepViewWinter: lookedOut,
  keepFinishedWinter: keepJustFinished,
  castleLineWinter: lineJustSeen,
  keepViewSpring: lookedOut,
  keepFinishedSpring: keepJustFinished,
  castleLineSpring: lineJustSeen,
  keepViewSummer: lookedOut,
  keepFinishedSummer: keepJustFinished,
  castleLineSummer: lineJustSeen,
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
      if (after.journal.some(item => item.year === year && item.id === entry.id && (!entry.perName || item.name === noticed.name))) continue;
      const variant = noticed.variant ?? 0;
      written.push({ year, id: entry.id, day: noticed.day, variant, ...(noticed.name === undefined ? {} : { name: noticed.name }) });
      if (!entry.silent && !noticed.silent) messages.push(`Written in your journal: ${lineWithName(entry.lines[variant], noticed.name)}`);
    }
  }
  return written.length ? { state: { ...after, journal: [...after.journal, ...written] }, messages } : { state: after, messages };
}

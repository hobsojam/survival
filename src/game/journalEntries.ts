import { duskLength, nightStart, season, seasonMessage, yearOf, type Season } from './calendar';
import { foodCount } from './food';
import { rainMessage } from './rain';
import { isAtCamp, isColdNight, isInClearing, type GameAction } from './rules';
import { LOOKOUT, type GameState } from './state';
import { RABBIT_HOMES } from './wildlife';
import { wolfMessage } from './wolves';

// The year journal is a keepsake: the survivor writes small moments down as they happen,
// once a year each, and nothing written here ever changes the game.

export type JournalId =
  | 'leaves' | 'fox' | 'coldFront' | 'driedBerries' | 'stars'
  | 'firstSnow' | 'wolfTracks' | 'frozenSpring' | 'winterFire' | 'winterCooking'
  | 'firstRain' | 'rabbits' | 'bushesFull' | 'stumpGrowing' | 'springRest'
  | 'fireflies' | 'twoHandfuls' | 'goldEvening' | 'warmSleep' | 'lookoutEvening';

export interface JournalEntry { year: number; id: JournalId; day: number; variant: number }

interface PageEntry {
  id: JournalId;
  lines: readonly string[];
  /** Announced already by its own message, so writing it adds no second line. */
  silent?: boolean;
}

export const JOURNAL_PAGES: Record<Season, readonly PageEntry[]> = {
  autumn: [
    { id: 'leaves', lines: ['The first leaves came down over camp.'] },
    { id: 'fox', lines: ['A fox nosed around the berry bushes at dusk.'] },
    { id: 'coldFront', lines: ['The cold night came. I kept the fire through it.', 'The cold night came, and it got the better of me.',
      'A cold autumn night, and the fire kept me warm.'] },
    { id: 'driedBerries', lines: ['Dried berries for the winter.'] },
    { id: 'stars', lines: ['Lay back and counted stars.'] }
  ],
  winter: [
    { id: 'firstSnow', lines: ['Snow fell in the night.'], silent: true },
    { id: 'wolfTracks', lines: ['Paw prints round the fire this morning.'], silent: true },
    { id: 'frozenSpring', lines: ['The quiet spring had frozen over.'] },
    { id: 'winterFire', lines: ['Kept the fire alive through a whole winter night.'] },
    { id: 'winterCooking', lines: ['Cooked berries by the fire, with the snow coming down.'] }
  ],
  spring: [
    { id: 'firstRain', lines: ['The first rain of spring.'], silent: true },
    { id: 'rabbits', lines: ['Rabbits in the meadow.'] },
    { id: 'bushesFull', lines: ['The bushes are full again.'] },
    { id: 'stumpGrowing', lines: ['A stump I cut is growing back already.'] },
    { id: 'springRest', lines: ['Sat a while at the spring, now that it\'s thawed.'] }
  ],
  summer: [
    { id: 'fireflies', lines: ['Fireflies over camp.'] },
    { id: 'twoHandfuls', lines: ['Two handfuls from one bush.'] },
    { id: 'goldEvening', lines: ['The evening went gold.'] },
    { id: 'warmSleep', lines: ['Slept out without a fire, and it was warm.'] },
    { id: 'lookoutEvening', lines: ['Watched the land from the lookout on a long evening.'] }
  ]
};

const ENTRIES = new Map(Object.values(JOURNAL_PAGES).flat().map(entry => [entry.id, entry]));
export const journalEntry = (id: JournalId): PageEntry | undefined => ENTRIES.get(id);
/** The season whose page an entry belongs on. */
export const journalSeason = (id: JournalId): Season | undefined =>
  (Object.keys(JOURNAL_PAGES) as Season[]).find(s => JOURNAL_PAGES[s].some(entry => entry.id === id));

/** A moment just noticed: the day it belongs to, which line tells it, and whether its own message already said so. */
interface Noticed { day: number; variant?: number; silent?: boolean }
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
const atSpring = (m: Moment): boolean => m.action?.type === 'visitSite' && m.action.siteId === 'spring' && done(m);

const RULES: Record<JournalId, (m: Moment) => Noticed | null> = {
  // Not in the day's first moments, so the morning's own message (a new game, a waking) stays on screen.
  leaves: m => onAfter(m, awake(m) && m.before.timeOfDay >= 30 && isInClearing(m.after) && daylight(m.after)),
  fox: m => onAfter(m, awake(m) && isInClearing(m.after) && atDusk(m.after)),
  coldFront: m => {
    if (isColdNight(m.before) && !isColdNight(m.after)) return { day: m.before.day, variant: m.after.progress.hearthUnlocked ? 0 : 1, silent: true };
    // Once the cold night is long weathered, any autumn night kept warm at camp fills its place in later years.
    const weathered = m.before.progress.hearthUnlocked && m.before.progress.nextStormDay === null;
    return dawn(m) && weathered && isAtCamp(m.before) && m.before.fireFuel > 0 ? { day: m.before.day, variant: 2 } : null;
  },
  driedBerries: m => onBefore(m, acted(m, 'prepareTrailFood')),
  stars: m => onBefore(m, acted(m, 'stargaze')),
  firstSnow: m => onAfter(m, seasonMessage(m.before.day, m.after.day) !== null),
  wolfTracks: m => (wolfMessage(m.before, m.after) !== null && m.after.lastWolf ? { day: m.after.lastWolf.day } : null),
  frozenSpring: m => onBefore(m, atSpring(m)),
  // Slept through at camp: a fire still burning at dawn never went out in the sleep, since nobody fed it.
  // Before lying down, a fire that went out brought a wolf (or the friend's chase); a ration left out says nothing either way.
  winterFire: m => onBefore(m, acted(m, 'sleep') && dawn(m) && isAtCamp(m.before) && m.after.fireFuel > 0
    && (m.before.lastWolf?.day !== m.before.day || m.before.lastWolf.took === 'offered')),
  winterCooking: m => onBefore(m, acted(m, 'cook')),
  firstRain: m => onAfter(m, rainMessage(m.before, m.after) !== null),
  rabbits: m => onAfter(m, awake(m) && m.after.area === 'camp' && daylight(m.after) && RABBIT_HOMES.some(home => within(m.after, home, 4))),
  bushesFull: m => onBefore(m, m.action?.type === 'gather' && done(m) && berries(m.after) > berries(m.before)),
  stumpGrowing: m => onAfter(m, dawn(m) && m.after.trees.some(tree => tree.readyDay === m.after.day && tree.readyDay > 1)),
  springRest: m => onBefore(m, atSpring(m)),
  fireflies: m => onAfter(m, awake(m) && isInClearing(m.after) && !daylight(m.after)),
  twoHandfuls: m => onBefore(m, m.action?.type === 'gather' && berries(m.after) - berries(m.before) === 2),
  goldEvening: m => onAfter(m, awake(m) && isInClearing(m.after) && m.before.day === m.after.day
    && daylight(m.before) && !daylight(m.after)),
  warmSleep: m => onBefore(m, acted(m, 'sleep') && m.after.fireFuel === 0),
  lookoutEvening: m => onAfter(m, awake(m) && m.after.progress.lookoutRepaired && m.after.area === 'camp'
    && within(m.after, LOOKOUT, 2) && atDusk(m.after))
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
      written.push({ year, id: entry.id, day: noticed.day, variant });
      if (!entry.silent && !noticed.silent) messages.push(`Written in your journal: ${entry.lines[variant]}`);
    }
  }
  return written.length ? { state: { ...after, journal: [...after.journal, ...written] }, messages } : { state: after, messages };
}

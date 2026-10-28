import { duskLength, nightStart, season, seasonMessage, yearOf, type Season } from './calendar';
import { rainMessage } from './rain';
import { isAtCamp, isColdNight, type GameAction } from './rules';
import { LOOKOUT, RABBIT_HOMES, type GameState } from './state';
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
  icon: string;
  lines: readonly string[];
  /** Announced already by its own message, so writing it adds no second line. */
  silent?: boolean;
}

export const JOURNAL_PAGES: Record<Season, readonly PageEntry[]> = {
  autumn: [
    { id: 'leaves', icon: '🍂', lines: ['The first leaves came down over camp.'] },
    { id: 'fox', icon: '🦊', lines: ['A fox came by the bushes at dusk.'] },
    { id: 'coldFront', icon: '❄️', lines: ['The cold front came. I kept the fire through it.', 'The cold front came, and the fire didn\'t last.'] },
    { id: 'driedBerries', icon: '🫐', lines: ['Dried berries for the winter.'] },
    { id: 'stars', icon: '✨', lines: ['Lay back and counted stars.'] }
  ],
  winter: [
    { id: 'firstSnow', icon: '🌨️', lines: ['Snow fell in the night.'], silent: true },
    { id: 'wolfTracks', icon: '🐾', lines: ['Paw prints round the fire this morning.'] },
    { id: 'frozenSpring', icon: '🧊', lines: ['The quiet spring had frozen over.'] },
    { id: 'winterFire', icon: '🔥', lines: ['Kept the fire alive through a whole winter night.'] },
    { id: 'winterCooking', icon: '🍲', lines: ['Cooked berries by the fire, with the snow coming down.'] }
  ],
  spring: [
    { id: 'firstRain', icon: '🌧️', lines: ['The first rain of spring.'], silent: true },
    { id: 'rabbits', icon: '🐇', lines: ['Rabbits in the meadow.'] },
    { id: 'bushesFull', icon: '🌿', lines: ['The bushes are full again.'] },
    { id: 'stumpGrowing', icon: '🌱', lines: ['A stump I cut is growing back already.'] },
    { id: 'springRest', icon: '💧', lines: ['Sat a while at the spring, now that it\'s thawed.'] }
  ],
  summer: [
    { id: 'fireflies', icon: '🌟', lines: ['Fireflies over camp.'] },
    { id: 'twoHandfuls', icon: '🍓', lines: ['Two handfuls from one bush.'] },
    { id: 'goldEvening', icon: '🌇', lines: ['The evening went gold.'] },
    { id: 'warmSleep', icon: '🌙', lines: ['Slept out without a fire, and it was warm.'] },
    { id: 'lookoutEvening', icon: '🔭', lines: ['Watched the land from the lookout on a long evening.'] }
  ]
};

const ENTRIES = new Map(Object.values(JOURNAL_PAGES).flat().map(entry => [entry.id, entry]));
export const journalEntry = (id: JournalId): PageEntry | undefined => ENTRIES.get(id);
/** The season whose page an entry belongs on. */
export const journalSeason = (id: JournalId): Season | undefined =>
  (Object.keys(JOURNAL_PAGES) as Season[]).find(s => JOURNAL_PAGES[s].some(entry => entry.id === id));

/** A moment just noticed: the day it belongs to, and which line tells it. */
interface Noticed { day: number; variant?: number }
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
const atSpring = (m: Moment): boolean => m.action?.type === 'visitSite' && m.action.siteId === 'spring' && done(m);

const RULES: Record<JournalId, (m: Moment) => Noticed | null> = {
  leaves: m => onAfter(m, awake(m) && isAtCamp(m.after) && daylight(m.after)),
  fox: m => onAfter(m, awake(m) && isAtCamp(m.after) && atDusk(m.after)),
  coldFront: m => (isColdNight(m.before) && !isColdNight(m.after)
    ? { day: m.before.day, variant: m.after.progress.hearthUnlocked ? 0 : 1 } : null),
  driedBerries: m => onBefore(m, acted(m, 'prepareTrailFood')),
  stars: m => onBefore(m, acted(m, 'stargaze')),
  firstSnow: m => onAfter(m, seasonMessage(m.before.day, m.after.day) !== null),
  wolfTracks: m => (wolfMessage(m.before, m.after) !== null && m.after.lastWolf ? { day: m.after.lastWolf.day } : null),
  frozenSpring: m => onBefore(m, atSpring(m)),
  // A wolf comes the moment a winter night's fire goes out, so a night without one kept its fire.
  winterFire: m => onBefore(m, dawn(m) && isAtCamp(m.before) && m.before.lastWolf?.day !== m.before.day),
  winterCooking: m => onBefore(m, acted(m, 'cook')),
  firstRain: m => onAfter(m, rainMessage(m.before, m.after) !== null),
  rabbits: m => onAfter(m, awake(m) && m.after.area === 'camp' && daylight(m.after) && RABBIT_HOMES.some(home => within(m.after, home, 4))),
  bushesFull: m => onBefore(m, m.action?.type === 'gather' && done(m) && m.after.inventory.food > m.before.inventory.food),
  stumpGrowing: m => onAfter(m, dawn(m) && m.after.trees.some(tree => tree.readyDay === m.after.day && tree.readyDay > 1)),
  springRest: m => onBefore(m, atSpring(m)),
  fireflies: m => onAfter(m, awake(m) && isAtCamp(m.after) && !daylight(m.after)),
  twoHandfuls: m => onBefore(m, m.after.inventory.food - m.before.inventory.food === 2),
  goldEvening: m => onAfter(m, awake(m) && isAtCamp(m.after) && m.before.day === m.after.day
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
      if (!entry.silent) messages.push(`Written in your journal: ${entry.lines[variant]}`);
    }
  }
  return written.length ? { state: { ...after, journal: [...after.journal, ...written] }, messages } : { state: after, messages };
}

import { QUARRY_SITE } from './areas';
import { NEEDS, isRevealed, type CastleState, type FeastItem, type TowerId, type WallSide } from './castle';
import { HILLS_EXIT, QUARRY_HILLS_EXIT } from './hills';
import { KEEP_SITE } from './keep';
import { TOO_TIRED_MESSAGE, isExhausted } from './needs';
import { BALANCE, type AreaId, type GameState } from './state';

// EASTER EGG: the castle, see src/game/castle.ts. The sections of it that can be worked on, kept apart from the saved
// state in castle.ts because the places they stand are drawn from areas.ts, which needs the state module to load first.
// Each section is a row of SITE_RULES: a new one adds a row and a place on the map.

export type CastleSite = 'road' | 'frames' | `wall-${WallSide}` | `tower-${TowerId}` | 'gatehouse' | 'moat' | 'hall' | 'table';
export interface SiteSpot { site: CastleSite; area: AreaId; x: number; y: number }
export type SiteNeed =
  | { kind: 'stone' }
  | { kind: 'wood'; amount: number }
  | { kind: 'good'; good: 'beams' | 'fittings' | 'hangings' }
  | { kind: 'dig' }
  | { kind: 'food'; item: FeastItem }
  | { kind: 'portcullis' };

/** The road's first ten stones lie on the quarry, and the other twenty on the hills. */
const ROAD_QUARRY = 10;
/** Where the road comes up the hills: in from the east edge, round the bend, and up to the keep's door. */
const ROAD_HILLS: readonly { x: number; y: number }[] = [HILLS_EXIT, { x: 26, y: 13 }, { x: KEEP_SITE.x, y: KEEP_SITE.y + 1 }];

/** A point a fraction of the way along a line of corners, by distance. */
const along = (corners: readonly { x: number; y: number }[], fraction: number): { x: number; y: number } => {
  const lengths = corners.slice(1).map((corner, i) => Math.hypot(corner.x - corners[i].x, corner.y - corners[i].y));
  let left = fraction * lengths.reduce((total, length) => total + length, 0);
  for (let i = 0; i < lengths.length; i++) {
    if (left <= lengths[i] || i === lengths.length - 1) {
      const t = left / lengths[i];
      return { x: corners[i].x + (corners[i + 1].x - corners[i].x) * t, y: corners[i].y + (corners[i + 1].y - corners[i].y) * t };
    }
    left -= lengths[i];
  }
  return corners[corners.length - 1];
};

/** Where the nth stone of the road (counting from 1) lies. */
export const roadStone = (n: number): { area: AreaId; x: number; y: number } => {
  if (n <= ROAD_QUARRY) return { area: 'quarry', ...along([QUARRY_SITE, QUARRY_HILLS_EXIT], n / ROAD_QUARRY) };
  return { area: 'hills', ...along(ROAD_HILLS, (n - ROAD_QUARRY) / (NEEDS.road - ROAD_QUARRY)) };
};

/** One section of the castle: what it asks for next (null once done), where the next piece goes, and what each piece says. */
interface SiteRule {
  need: (castle: CastleState) => SiteNeed | null;
  spot: (castle: CastleState) => { area: AreaId; x: number; y: number };
  far: string;
  done: string;
  /** The castle with one more piece laid. */
  lay: (castle: CastleState, day: number) => CastleState;
  /** What the piece just laid says, read from the castle after it. */
  line: (castle: CastleState) => string;
  /** How much of the section is laid, so a piece of work can be told from what it changed. */
  count: (castle: CastleState) => number;
  /** The prompt for a spot that can be worked now, and for one that is short of something. */
  label: (castle: CastleState) => string;
  ask: string;
  /** The refusal for the same shortage. */
  short: string;
}

const ROAD_LINES: Record<number, string> = {
  1: 'You lay the first stone of a road.',
  [ROAD_QUARRY]: 'The road reaches the edge of the quarry.',
  20: 'The road is halfway to the keep.',
  [NEEDS.road]: 'You lay the last stone. The road runs from the quarry to the keep.'
};

const SITE_RULES: Partial<Record<CastleSite, SiteRule>> = {
  road: {
    need: castle => (castle.road < NEEDS.road ? { kind: 'stone' } : null),
    spot: castle => roadStone(castle.road + 1),
    far: 'Move closer to the road.',
    done: 'The road is finished.',
    lay: (castle, day) => ({ ...castle, road: castle.road + 1, roadDay: castle.road + 1 === NEEDS.road ? day : castle.roadDay }),
    line: castle => ROAD_LINES[castle.road] ?? 'You lay another stone of the road.',
    count: castle => castle.road,
    label: castle => `Lay a road stone (${castle.road}/${NEEDS.road})`,
    ask: 'Road · bring stone to lay it',
    short: 'Bring stone to lay the road.'
  }
};

/** The sites that can be worked on now, once the line of stones has shown. */
export const castleSpots = (state: GameState): SiteSpot[] => {
  if (!isRevealed(state)) return [];
  return (Object.entries(SITE_RULES) as [CastleSite, SiteRule][])
    .filter(([, rule]) => rule.need(state.castle) !== null)
    .map(([site, rule]) => ({ site, ...rule.spot(state.castle) }));
};

/** The nearest open site in the area the survivor is in. */
export const nearestCastleSpot = (state: GameState): SiteSpot | null => {
  const here = castleSpots(state).filter(spot => spot.area === state.area);
  const gap = (spot: SiteSpot): number => Math.hypot(spot.x - state.player.x, spot.y - state.player.y);
  return here.reduce<SiteSpot | null>((best, spot) => (best === null || gap(spot) < gap(best) ? spot : best), null);
};

/** What a site asks for next, or null once it is done or is not open. */
export const siteNeed = (state: GameState, site: CastleSite): SiteNeed | null => SITE_RULES[site]?.need(state.castle) ?? null;

const NOTHING_HERE = 'There is nothing to build here yet.';

/** What the bag can't cover of a need, as a line, or null if it is covered. */
const lacking = (state: GameState, need: SiteNeed, rule: SiteRule): string | null =>
  need.kind === 'stone' && state.inventory.stone < 1 ? rule.short : null;

/** Why a piece can't be laid at a site right now, or null if it can. */
export const castleWorkBlocker = (state: GameState, site: CastleSite): string | null => {
  const rule = SITE_RULES[site];
  if (!rule || !isRevealed(state)) return NOTHING_HERE;
  const need = rule.need(state.castle);
  if (!need) return rule.done;
  const spot = rule.spot(state.castle);
  if (state.area !== spot.area || Math.hypot(state.player.x - spot.x, state.player.y - spot.y) > BALANCE.interactionRadius) return rule.far;
  const short = lacking(state, need, rule);
  if (short) return short;
  return isExhausted(state) ? TOO_TIRED_MESSAGE : null;
};

/** What the prompt says at a spot: the work on offer, or what is missing for it. */
export const castlePrompt = (state: GameState, spot: SiteSpot): string => {
  const rule = SITE_RULES[spot.site];
  if (!rule) return '';
  const need = rule.need(state.castle);
  const short = need ? lacking(state, need, rule) : null;
  return short ? rule.ask : rule.label(state.castle);
};

/** The state with one piece laid at a site, paying what it needs from the bag. Time and energy are the action's. */
export const doCastleWork = (state: GameState, site: CastleSite): GameState => {
  const rule = SITE_RULES[site];
  const need = rule?.need(state.castle);
  if (!rule || !need) return state;
  const inventory = need.kind === 'stone' ? { ...state.inventory, stone: state.inventory.stone - 1 } : state.inventory;
  return { ...state, inventory, castle: rule.lay(state.castle, state.day) };
};

/** What a piece of work says, read from the castle before and after it. */
export const castleWorkLine = (before: GameState, after: GameState): string => {
  const rule = Object.values(SITE_RULES).find(each => each.count(before.castle) !== each.count(after.castle));
  return rule?.line(after.castle) ?? '';
};

/** The mornings after a section is finished. Each is worked out from the saved day, so it comes once. */
export const castleNews = (before: GameState, after: GameState): string[] => {
  if (after.day <= before.day) return [];
  const notes: string[] = [];
  if (after.castle.roadDay === before.day) notes.push('The road is finished. The pony could pull a cart along it now.');
  return notes;
};

import { QUARRY_SITE } from './areas';
import { NEEDS, TOWERS, isRevealed, type CastleState, type FeastItem, type TowerId, type WallSide } from './castle';
import { HILLS_EXIT, QUARRY_HILLS_EXIT, availableOre } from './hills';
import { availableWood, freeSpaces, isInClearing, spaceFor } from './camp';
import { isWinter } from './calendar';
import { KEEP_SITE } from './keep';
import { TOO_TIRED_MESSAGE, isExhausted } from './needs';
import { ponyWith } from './pony';
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

/** The road starts a little past the quarry face and stops a little short of the keep's door, so reaching for a stone never reaches the face or the door too. */
const ROAD_START = { x: QUARRY_SITE.x - 2.4, y: QUARRY_SITE.y + 0.6 };
const ROAD_END = { x: KEEP_SITE.x + 2.2, y: KEEP_SITE.y + 1.55 };

/** The road's first ten stones lie on the quarry, and the other twenty on the hills. */
const ROAD_QUARRY = 10;
/** Where the road comes up the hills: in from the east edge, round the bend, and up to the keep's door. */
const ROAD_HILLS: readonly { x: number; y: number }[] = [HILLS_EXIT, { x: 26, y: 13 }, ROAD_END];

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
  if (n <= ROAD_QUARRY) return { area: 'quarry', ...along([ROAD_START, QUARRY_HILLS_EXIT], n / ROAD_QUARRY) };
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
    lay: (castle, day) => ({ ...castle, road: castle.road + 1, doneDays: castle.road + 1 === NEEDS.road ? { ...castle.doneDays, road: day } : castle.doneDays }),
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

/** Where the cart stands in each area, clear of the quarry face and rubble, the road and the paths on one side, and of the keep, the outcrop and the road on the other. */
export const CART_SPOTS = { quarry: { x: 24, y: 8 }, hills: { x: 30, y: 7 } } as const;

/** How much more the cart can take, or none before it is made. */
export const cartRoom = (state: GameState): number => (state.progress.workshop.stoneCart ? NEEDS.cartStone - state.castle.cart.stone : 0);

/** The cart's stone that building can use: only while it stands on the hills, where the building is. */
const cartLoad = (state: GameState): number => (state.castle.cart.at === 'hills' ? state.castle.cart.stone : 0);

/** Where a dig's stones go: into the cart while it stands at the quarry, then into the bag, never more than there is room for. */
export const stoneIntake = (state: GameState, stones: number): { toCart: number; toBag: number } => {
  const toCart = Math.min(stones, state.castle.cart.at === 'quarry' ? cartRoom(state) : 0);
  return { toCart, toBag: Math.min(stones - toCart, Math.floor(freeSpaces(state) / spaceFor('stone'))) };
};

/** The state with that intake put away. */
export const withStoneIntake = (state: GameState, { toCart, toBag }: { toCart: number; toBag: number }): GameState => ({
  ...state, inventory: { ...state.inventory, stone: state.inventory.stone + toBag }, castle: { ...state.castle, cart: { ...state.castle.cart, stone: state.castle.cart.stone + toCart } }
});

/** What a dig or a rubble says about where its stone went. */
export const intakeNote = ({ toCart, toBag }: { toCart: number; toBag: number }): string => {
  if (toCart === 0) return '';
  if (toBag > 0) return ' One went into the cart.';
  return toCart === 1 ? ' It went into the cart.' : ' Both went into the cart.';
};

/** The state with one stone spent on the castle: from a cart on the hills first, then the bag. Null if there is none. */
export const spendCastleStone = (state: GameState): GameState | null => {
  if (cartLoad(state) > 0) return { ...state, castle: { ...state.castle, cart: { ...state.castle.cart, stone: state.castle.cart.stone - 1 } } };
  return state.inventory.stone > 0 ? { ...state, inventory: { ...state.inventory, stone: state.inventory.stone - 1 } } : null;
};

/** The cart goes between the quarry and the hills with the shod pony, which is with the survivor by day and out of the hills' snow. */
export const cartFollows = (before: GameState, after: GameState): GameState => {
  const { cart } = after.castle;
  if (before.area === after.area || !after.progress.workshop.stoneCart || cart.at !== before.area) return after;
  if ((after.area !== 'quarry' && after.area !== 'hills') || !ponyWith(before) || isWinter(after.day)) return after;
  return { ...after, castle: { ...after.castle, cart: { ...cart, at: after.area } } };
};

/** The cart's spot if the survivor is within reach of it. */
export const cartWithin = (state: GameState): boolean => {
  const spot = CART_SPOTS[state.castle.cart.at];
  return state.progress.workshop.stoneCart && state.area === state.castle.cart.at && Math.hypot(state.player.x - spot.x, state.player.y - spot.y) <= BALANCE.interactionRadius;
};

/** Why stone can't be taken from the cart now, or null if it can. */
export const takeCartBlocker = (state: GameState): string | null => {
  if (!cartWithin(state)) return 'Move closer to the cart.';
  if (state.castle.cart.stone < 1) return 'The cart is empty.';
  return null;
};

/** What the bag can't cover of a need, as a line, or null if it is covered. */
const lacking = (state: GameState, need: SiteNeed, rule: SiteRule): string | null =>
  need.kind === 'stone' && state.inventory.stone + cartLoad(state) < 1 ? rule.short : null;

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

/** The state with one piece laid at a site, paying what it needs from the cart and the bag. Time and energy are the action's. */
export const doCastleWork = (state: GameState, site: CastleSite): GameState => {
  const rule = SITE_RULES[site];
  const need = rule?.need(state.castle);
  if (!rule || !need) return state;
  const paid = need.kind === 'stone' ? spendCastleStone(state) : state;
  if (!paid) return state;
  return { ...paid, castle: rule.lay(paid.castle, state.day) };
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
  if (after.castle.doneDays.road === before.day) notes.push('The road is finished. The pony could pull a cart along it now.');
  return notes;
};

export type CastleGood = 'beams' | 'fittings' | 'hangings';

/** What the camp makes for the castle: how many come at once and what a batch costs. Hangings are made at the loom from wool. */
export const GOODS = {
  beams: { batch: 4, cost: { wood: 8 } },
  fittings: { batch: 1, cost: { wood: 1, ore: 1 } },
  hangings: { batch: 1, wool: 3 }
} as const;

/** What the whole castle takes of a good, and how much of it is already built into the towers and the hall. */
const goodTotals = (castle: CastleState, good: CastleGood): { needed: number; built: number } => {
  if (good === 'hangings') return { needed: NEEDS.hallHangings, built: castle.hall.hangings };
  const key = good === 'beams' ? 'beams' : 'fittings';
  const perTower = good === 'beams' ? NEEDS.towerBeams : NEEDS.towerFittings;
  const hall = good === 'beams' ? NEEDS.hallBeams : NEEDS.hallFittings;
  return { needed: perTower * TOWERS.length + hall, built: TOWERS.reduce((sum, id) => sum + castle.towers[id][key], castle.hall[key]) };
};

/** How many of a good are still worth making: what the castle needs, less what is made and what is already built in. */
export const goodRoom = (castle: CastleState, good: CastleGood): number => {
  const { needed, built } = goodTotals(castle, good);
  return Math.max(0, needed - built - castle.goods[good]);
};

/** How many of a good one making gives: a full batch, or what is left if less. */
export const goodBatch = (castle: CastleState, good: CastleGood): number => Math.min(GOODS[good].batch, goodRoom(castle, good));

/** Why a good can't be made right now, or null if it can. The cost can come from the bag and the camp stores. */
export function goodBlocker(state: GameState, good: CastleGood): string | null {
  if (!isRevealed(state)) return 'There is nothing to make that for yet.';
  if (good === 'hangings') return 'Hangings are made at the loom.';
  if (!state.structures.workshop) return 'Build a workshop first.';
  if (good === 'fittings' && !state.progress.workshop.forge) return 'Add a forge to the workshop first.';
  if (state.castle.frames === 0) return 'Begin the timber frames first.';
  if (goodRoom(state.castle, good) === 0) return `The castle has enough ${good} now.`;
  if (!isInClearing(state)) return 'Return to camp to work at the workshop.';
  if (isExhausted(state)) return TOO_TIRED_MESSAGE;
  const { cost } = GOODS[good];
  const ore = 'ore' in cost ? cost.ore : 0;
  if (availableWood(state) < cost.wood || availableOre(state) < ore) {
    return good === 'beams' ? `Need ${cost.wood} wood for the beams.` : 'Need 1 wood and 1 ore for a fitting.';
  }
  return null;
}

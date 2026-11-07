import { QUARRY_SITE } from './areas';
import { CASTLE_SECTIONS, NEEDS, SIDES, TOWERS, WALLS, isRevealed, towerFinished, wallFinished, type CastleSection, type CastleState, type FeastItem, type TowerId, type WallSide } from './castle';
import { HILLS_EXIT, QUARRY_HILLS_EXIT, availableOre } from './hills';
import { availableWood, freeSpaces, isInClearing, spaceFor, spendWood } from './camp';
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
  need: (state: GameState) => SiteNeed | null;
  /** Whether the section is finished, as against not yet open. */
  finished: (castle: CastleState) => boolean;
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
  ask: (castle: CastleState) => string;
  /** The refusal for the same shortage. */
  short: (castle: CastleState) => string;
}

const ROAD_LINES: Record<number, string> = {
  1: 'You lay the first stone of a road.',
  [ROAD_QUARRY]: 'The road reaches the edge of the quarry.',
  20: 'The road is halfway to the keep.',
  [NEEDS.road]: 'You lay the last stone. The road runs from the quarry to the keep.'
};

/** Where the frames go: inside the line, clear of the keep and the paths. */
export const FRAMES_SPOT = { area: 'hills' as AreaId, x: 21, y: 13.5 };
/** Each wall side's work stands at the middle of that side, and each tower's a tile in from its corner, so no two are within reach of each other. */
const SIDE_SPOTS: Record<WallSide, { x: number; y: number }> = {
  north: { x: (WALLS.left + WALLS.right) / 2, y: WALLS.top }, south: { x: (WALLS.left + WALLS.right) / 2, y: WALLS.bottom },
  west: { x: WALLS.left, y: (WALLS.top + WALLS.bottom) / 2 }, east: { x: WALLS.right, y: (WALLS.top + WALLS.bottom) / 2 }
};
const TOWER_SPOTS: Record<TowerId, { x: number; y: number }> = {
  nw: { x: WALLS.left + 1, y: WALLS.top + 1 }, ne: { x: WALLS.right - 1, y: WALLS.top + 1 },
  se: { x: WALLS.right - 1, y: WALLS.bottom - 1 }, sw: { x: WALLS.left + 1, y: WALLS.bottom - 1 }
};
const TOWER_NAMES: Record<TowerId, string> = { nw: 'north-west', ne: 'north-east', se: 'south-east', sw: 'south-west' };

/** The timber frames and the hoist: wood, two at a time, from the stores or the bag, once the cart is made. */
function framesRule(): SiteRule {
  const wood = 2;
  return {
    need: ({ castle, progress }) => (progress.workshop.stoneCart && castle.frames < NEEDS.frames ? { kind: 'wood', amount: wood } : null),
    finished: castle => castle.frames === NEEDS.frames,
    spot: () => FRAMES_SPOT,
    far: 'Move closer to the frames.',
    done: 'The frames are finished.',
    lay: (castle, day) => {
      const frames = Math.min(NEEDS.frames, castle.frames + wood);
      return { ...castle, frames, doneDays: frames === NEEDS.frames ? { ...castle.doneDays, frames: day } : castle.doneDays };
    },
    line: castle => {
      if (castle.frames === NEEDS.frames) return 'The frames and the hoist are up. The wall can start now.';
      return castle.frames === wood ? 'You set the first timbers of the frames.' : 'You raise more of the frames.';
    },
    count: castle => castle.frames,
    label: castle => `Raise the timber frames (${castle.frames}/${NEEDS.frames})`,
    ask: () => 'Frames · bring wood to raise them',
    short: () => 'Bring wood to raise the frames.'
  };
}

/** One side of the curtain wall, a stone at a time, once the frames are up. */
function wallRule(side: WallSide): SiteRule {
  return {
    need: ({ castle }) => (castle.frames === NEEDS.frames && castle.wall[side] < NEEDS.wallSide ? { kind: 'stone' } : null),
    finished: castle => castle.wall[side] === NEEDS.wallSide,
    spot: () => ({ area: 'hills', ...SIDE_SPOTS[side] }),
    far: 'Move closer to the wall.',
    done: `The ${side} wall is finished.`,
    lay: (castle, day) => {
      const stones = castle.wall[side] + 1;
      return { ...castle, wall: { ...castle.wall, [side]: stones }, doneDays: stones === NEEDS.wallSide ? { ...castle.doneDays, [`wall-${side}`]: day } : castle.doneDays };
    },
    line: castle => {
      const stones = castle.wall[side];
      if (stones === NEEDS.wallSide) return `The ${side} wall is finished.`;
      if (stones === NEEDS.wallSide / 2) return `The ${side} wall is halfway.`;
      return stones === 1 ? `You lay the first stone of the ${side} wall.` : 'You lay another stone of the wall.';
    },
    count: castle => castle.wall[side],
    label: castle => `Lay a wall stone, ${side} side (${castle.wall[side]}/${NEEDS.wallSide})`,
    ask: () => 'Wall · bring stone to build it',
    short: () => 'Bring stone to build the wall.'
  };
}

/** What a tower asks for next: its stones, then its roof beams, then its iron. */
const towerStage = (castle: CastleState, id: TowerId): 'stones' | 'beams' | 'fittings' | null => {
  const tower = castle.towers[id];
  if (tower.stones < NEEDS.towerStones) return 'stones';
  if (tower.beams < NEEDS.towerBeams) return 'beams';
  return tower.fittings < NEEDS.towerFittings ? 'fittings' : null;
};

/** One corner tower, once the wall is done. Beams and fittings are made at camp and move from the castle's goods into the tower. */
function towerRule(id: TowerId): SiteRule {
  const name = TOWER_NAMES[id];
  const stage = (castle: CastleState) => towerStage(castle, id) ?? 'fittings';
  return {
    need: ({ castle }) => {
      const next = wallFinished(castle) ? towerStage(castle, id) : null;
      if (next === null) return null;
      return next === 'stones' ? { kind: 'stone' } : { kind: 'good', good: next };
    },
    finished: castle => towerFinished(castle.towers[id]),
    spot: () => ({ area: 'hills', ...TOWER_SPOTS[id] }),
    far: 'Move closer to the tower.',
    done: `The ${name} tower is finished.`,
    lay: (castle, day) => {
      const next = stage(castle);
      const tower = { ...castle.towers[id], [next]: castle.towers[id][next] + 1 };
      const goods = next === 'stones' ? castle.goods : { ...castle.goods, [next]: castle.goods[next] - 1 };
      return { ...castle, goods, towers: { ...castle.towers, [id]: tower }, doneDays: towerFinished(tower) ? { ...castle.doneDays, [`tower-${id}`]: day } : castle.doneDays };
    },
    line: castle => {
      const tower = castle.towers[id];
      if (towerFinished(tower)) return `The ${name} tower is roofed and fitted.`;
      if (tower.fittings > 0) return `You fit iron to the ${name} tower roof.`;
      if (tower.beams > 0) return `You set a roof beam on the ${name} tower.`;
      if (tower.stones === NEEDS.towerStones) return `You lay the last stone of the ${name} tower. It wants a roof.`;
      return tower.stones === 1 ? `You lay the first stone of the ${name} tower.` : 'You lay another stone of the tower.';
    },
    count: castle => castle.towers[id].stones + castle.towers[id].beams + castle.towers[id].fittings,
    label: castle => {
      const tower = castle.towers[id];
      const next = stage(castle);
      if (next === 'stones') return `Lay a tower stone, ${name} (${tower.stones}/${NEEDS.towerStones})`;
      return next === 'beams' ? `Set a roof beam on the ${name} tower (${tower.beams}/${NEEDS.towerBeams})` : `Fit iron to the ${name} tower roof (${tower.fittings}/${NEEDS.towerFittings})`;
    },
    ask: castle => TOWER_ASKS[stage(castle)],
    short: castle => TOWER_SHORTS[stage(castle)]
  };
}

const TOWER_ASKS = { stones: 'Tower · bring stone to build it', beams: 'Tower · make oak beams at the workshop', fittings: 'Tower · make iron fittings at the forge' } as const;
const TOWER_SHORTS = { stones: 'Bring stone to build the tower.', beams: 'Make oak beams at the workshop for the tower.', fittings: 'Make iron fittings at the forge for the tower.' } as const;

const SITE_RULES: Partial<Record<CastleSite, SiteRule>> = {
  road: {
    need: ({ castle }) => (castle.road < NEEDS.road ? { kind: 'stone' } : null),
    finished: castle => castle.road === NEEDS.road,
    spot: castle => roadStone(castle.road + 1),
    far: 'Move closer to the road.',
    done: 'The road is finished.',
    lay: (castle, day) => ({ ...castle, road: castle.road + 1, doneDays: castle.road + 1 === NEEDS.road ? { ...castle.doneDays, road: day } : castle.doneDays }),
    line: castle => ROAD_LINES[castle.road] ?? 'You lay another stone of the road.',
    count: castle => castle.road,
    label: castle => `Lay a road stone (${castle.road}/${NEEDS.road})`,
    ask: () => 'Road · bring stone to lay it',
    short: () => 'Bring stone to lay the road.'
  },
  frames: framesRule(),
  ...Object.fromEntries(SIDES.map(side => [`wall-${side}`, wallRule(side)])),
  ...Object.fromEntries(TOWERS.map(id => [`tower-${id}`, towerRule(id)]))
};

/** The sites that can be worked on now, once the line of stones has shown. */
export const castleSpots = (state: GameState): SiteSpot[] => {
  if (!isRevealed(state)) return [];
  return (Object.entries(SITE_RULES) as [CastleSite, SiteRule][])
    .filter(([, rule]) => rule.need(state) !== null)
    .map(([site, rule]) => ({ site, ...rule.spot(state.castle) }));
};

/** The nearest open site in the area the survivor is in. */
export const nearestCastleSpot = (state: GameState): SiteSpot | null => {
  const here = castleSpots(state).filter(spot => spot.area === state.area);
  const gap = (spot: SiteSpot): number => Math.hypot(spot.x - state.player.x, spot.y - state.player.y);
  return here.reduce<SiteSpot | null>((best, spot) => (best === null || gap(spot) < gap(best) ? spot : best), null);
};

/** Whether the open site the survivor is at asks for stone, which is the one thing the cart can carry. */
export const castleNeedsStone = (state: GameState, spot: SiteSpot | null): boolean => spot !== null && siteNeed(state, spot.site)?.kind === 'stone';

/** What a site asks for next, or null once it is done or is not open. */
export const siteNeed = (state: GameState, site: CastleSite): SiteNeed | null => SITE_RULES[site]?.need(state) ?? null;

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

/** What the bag, the stores and the goods can't cover of a need, as a line, or null if it is covered. */
const lacking = (state: GameState, need: SiteNeed, rule: SiteRule): string | null => {
  const covered = {
    stone: state.inventory.stone + cartLoad(state) >= 1,
    wood: need.kind === 'wood' && availableWood(state) >= need.amount,
    good: need.kind === 'good' && state.castle.goods[need.good] >= 1
  };
  return need.kind in covered && !covered[need.kind as keyof typeof covered] ? rule.short(state.castle) : null;
};

/** Why a piece can't be laid at a site right now, or null if it can. */
export const castleWorkBlocker = (state: GameState, site: CastleSite): string | null => {
  const rule = SITE_RULES[site];
  if (!rule || !isRevealed(state)) return NOTHING_HERE;
  const need = rule.need(state);
  if (!need) return rule.finished(state.castle) ? rule.done : NOTHING_HERE;
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
  const need = rule.need(state);
  const short = need ? lacking(state, need, rule) : null;
  return short ? rule.ask(state.castle) : rule.label(state.castle);
};

/** The state with a need paid: stone from the cart and the bag, wood from the stores and the bag. Goods are moved by the piece laid. */
const payFor = (state: GameState, need: SiteNeed): GameState | null => {
  if (need.kind === 'stone') return spendCastleStone(state);
  return need.kind === 'wood' ? spendWood(state, need.amount) : state;
};

/** The state with one piece laid at a site, paying what it needs from the cart and the bag. Time and energy are the action's. */
export const doCastleWork = (state: GameState, site: CastleSite): GameState => {
  const rule = SITE_RULES[site];
  const need = rule?.need(state);
  if (!rule || !need) return state;
  const paid = payFor(state, need);
  if (!paid) return state;
  return { ...paid, castle: rule.lay(paid.castle, state.day) };
};

/** What a piece of work says, read from the castle before and after it. */
export const castleWorkLine = (before: GameState, after: GameState): string => {
  const rule = Object.values(SITE_RULES).find(each => each.count(before.castle) !== each.count(after.castle));
  return rule?.line(after.castle) ?? '';
};

/** What the morning after a section is finished says. */
const NEWS: Partial<Record<CastleSection, string>> = {
  road: 'The road is finished. The pony could pull a cart along it now.',
  frames: 'The frames stand finished. The wall can start now.',
  ...Object.fromEntries(SIDES.map(side => [`wall-${side}`, `The ${side} wall stands finished.`])),
  ...Object.fromEntries(TOWERS.map(id => [`tower-${id}`, `The ${TOWER_NAMES[id]} tower stands finished.`]))
};

/** The mornings after a section is finished. Each is worked out from the saved day, so it comes once. */
export const castleNews = (before: GameState, after: GameState): string[] => {
  if (after.day <= before.day) return [];
  return CASTLE_SECTIONS.filter(section => NEWS[section] && after.castle.doneDays[section] === before.day).map(section => NEWS[section] as string);
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

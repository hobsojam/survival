import { BALANCE, LOOKOUT, SITES, type GameState, type ResourceNode, type SiteId, type StonePile } from '../game/state';
import { isAtCamp, type GameAction } from '../game/rules';
import { choppableTrees } from '../game/clearing';
import { nodeShown } from '../game/forage';
import { sprites } from '../art/sprites';
import { CAMP_EXIT, CAMP_HOMESTEAD_EXIT, HOMESTEAD_EXIT, QUARRY_EXIT, QUARRY_SITE, RUBBLE_SITE, hillsPathOpen, pathOpen } from '../game/areas';
import { wildPonyAt } from '../game/pony';
import { HILLS_EXIT, OUTCROP_SITE, QUARRY_HILLS_EXIT, outcropLeft } from '../game/hills';
import { CHICKEN_SITE, COOP_SITE } from '../game/chickens';
import { APPLE_TREE, HOMESTEAD_SHED } from '../game/homestead';
import { ORCHARD_SPOTS, spotAction, treeStage } from '../game/orchard';

/** What a tap on the map points at, in tile units like `state.player`. */
export type TapTarget =
  | { kind: 'node'; id: string; x: number; y: number }
  | { kind: 'pile'; id: string; x: number; y: number }
  | { kind: 'tree'; id: string; x: number; y: number }
  | { kind: 'site'; id: SiteId; x: number; y: number }
  | { kind: 'lookout'; x: number; y: number }
  | { kind: 'fire'; x: number; y: number }
  | { kind: 'crossing'; x: number; y: number }
  | { kind: 'quarry'; x: number; y: number }
  | { kind: 'rubble'; x: number; y: number }
  | { kind: 'outcrop'; x: number; y: number }
  | { kind: 'pony'; x: number; y: number }
  | { kind: 'chickens'; x: number; y: number; action: 'meetChickens' | 'leadChickens' }
  | { kind: 'appleTree' | 'shed' | 'coop'; x: number; y: number }
  | { kind: 'orchard'; spot: number; x: number; y: number; action: GameAction | null }
  | { kind: 'ground'; x: number; y: number };

/** A tap this close to something counts as tapping it. */
export const TAP_HIT_RADIUS = 1;
/** Tiles per second, matching keyboard walking. */
export const WALK_SPEED = 3.5;
const GROUND_ARRIVAL = 0.1;
/** Inside the 0.5 tile that `cross` allows, so arriving at the path's end always crosses. */
const CROSSING_ARRIVAL = 0.4;
/** Matches TILE in art.ts, which can't be imported here without pulling in Phaser. */
const TILE_PIXELS = 16;

const distance = (x1: number, y1: number, x2: number, y2: number) => Math.hypot(x1 - x2, y1 - y2);
const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));

/** What a tap or key press does to the walk in progress. */
export type WalkEvent = { kind: 'tap'; target: TapTarget } | { kind: 'keyMove' } | { kind: 'action' };

/** A new tap replaces the walk; moving by key or starting another action cancels it. */
export function nextWalk(_current: TapTarget | undefined, event: WalkEvent): TapTarget | undefined {
  return event.kind === 'tap' ? event.target : undefined;
}

/** How far a tap is from a target, in tiles. Anywhere on tall art (trees, the lookout) counts as within the hit radius. */
function tapDistance(target: TapTarget, sprite: string | undefined, x: number, y: number): number {
  const fromTile = distance(target.x, target.y, x, y);
  if (!sprite) return fromTile;
  const { size, anchor } = sprites[sprite];
  const left = target.x - anchor[0] / TILE_PIXELS;
  const top = target.y - anchor[1] / TILE_PIXELS;
  const onArt = x >= left && x <= left + size[0] / TILE_PIXELS && y >= top && y <= top + size[1] / TILE_PIXELS;
  // On the art, rank by distance from its middle so a pile at a tree's foot still wins a tap on itself.
  if (!onArt) return fromTile;
  const fromMiddle = distance(left + size[0] / TILE_PIXELS / 2, top + size[1] / TILE_PIXELS / 2, x, y);
  return Math.min(fromTile, Math.min(fromMiddle, TAP_HIT_RADIUS));
}

/** Each spot of a standing orchard; a tree old enough to have branches can be tapped on them. */
function orchardTargets(state: GameState): { target: TapTarget; sprite?: string }[] {
  if (!state.structures.orchard) return [];
  return ORCHARD_SPOTS.map((place, spot) => {
    const tree = state.orchard.trees[spot];
    const target: TapTarget = { kind: 'orchard', spot, ...place, action: spotAction(state, spot) };
    return tree && treeStage(tree, state.day) === 'grown' ? { target, sprite: 'orchardTree' } : { target };
  });
}

/** The closest interactive thing near the tap, or the tapped ground. */
export function pickTapTarget(state: GameState, x: number, y: number): TapTarget {
  const piles = state.stonePiles.filter(pile => pile.area === state.area)
    .map(pile => ({ target: { kind: 'pile' as const, id: pile.id, x: pile.x, y: pile.y } }));
  let candidates: { target: TapTarget; sprite?: string }[];
  if (state.area === 'quarry') {
    candidates = [...piles,
      { target: { kind: 'quarry', x: QUARRY_SITE.x, y: QUARRY_SITE.y }, sprite: 'quarry' },
      { target: { kind: 'rubble', x: RUBBLE_SITE.x, y: RUBBLE_SITE.y } },
      { target: { kind: 'crossing', x: QUARRY_EXIT.x, y: QUARRY_EXIT.y } },
      ...(hillsPathOpen(state) ? [{ target: { kind: 'crossing' as const, ...QUARRY_HILLS_EXIT } }] : [])];
  } else if (state.area === 'hills') {
    const wild = wildPonyAt(state);
    candidates = [...piles,
      { target: { kind: 'outcrop', ...OUTCROP_SITE }, sprite: 'outcrop' },
      ...(wild ? [{ target: { kind: 'pony' as const, ...wild }, sprite: 'pony' }] : []),
      { target: { kind: 'crossing', ...HILLS_EXIT } }];
  } else if (state.area === 'homestead') {
    candidates = [...piles,
      { target: { kind: 'shed', ...HOMESTEAD_SHED } },
      { target: { kind: 'appleTree', ...APPLE_TREE } },
      ...(!state.chickens.rescued ? [{ target: { kind: 'chickens' as const, ...CHICKEN_SITE,
        action: state.chickens.discovered ? 'leadChickens' as const : 'meetChickens' as const } }] : []),
      { target: { kind: 'crossing', ...HOMESTEAD_EXIT } }];
  } else {
    candidates = [
      ...state.nodes.filter(node => node.amount > 0 && nodeShown(state, node)).map(node => ({ target: { kind: 'node' as const, id: node.id, x: node.x, y: node.y } })),
      ...piles,
      ...choppableTrees(state).map(tree => ({ target: { kind: 'tree' as const, id: tree.id, x: tree.x, y: tree.y }, sprite: tree.sprite })),
      ...(Object.keys(SITES) as SiteId[]).map(id => ({ target: { kind: 'site' as const, id, x: SITES[id].x, y: SITES[id].y } })),
      { target: { kind: 'lookout', x: LOOKOUT.x, y: LOOKOUT.y }, sprite: 'lookout' },
      { target: { kind: 'fire', x: BALANCE.campX, y: BALANCE.campY } },
      ...(state.chickens.rescued ? [{ target: { kind: 'coop' as const, ...COOP_SITE } }] : []),
      ...orchardTargets(state),
      ...(pathOpen(state) ? [{ target: { kind: 'crossing' as const, ...CAMP_EXIT } }, { target: { kind: 'crossing' as const, ...CAMP_HOMESTEAD_EXIT } }] : [])
    ];
  }
  const hit = candidates
    .map(({ target, sprite }) => ({ target, away: tapDistance(target, sprite, x, y) }))
    .filter(({ away }) => away <= TAP_HIT_RADIUS)
    .sort((a, b) => a.away - b.away)[0];
  return hit?.target ?? { kind: 'ground', x: clamp(x, BALANCE.mapWidth - 1), y: clamp(y, BALANCE.mapHeight - 1) };
}

/** What E can act on: a node, a loose pile, the rubble or the quarry face. */
export type Gatherable = { kind: 'node'; node: ResourceNode } | { kind: 'pile'; pile: StonePile } | { kind: 'rubble' } | { kind: 'quarry' } | { kind: 'outcrop' };

/** The nearest thing E can act on within reach: ready camp nodes in season and this area's loose piles, or the quarry's rubble and face when ready. */
export function closestGatherable(state: GameState): Gatherable | undefined {
  const { x, y } = state.player;
  const options: { found: Gatherable; away: number }[] =
    state.stonePiles.filter(pile => pile.area === state.area).map(pile => ({ found: { kind: 'pile' as const, pile }, away: distance(pile.x, pile.y, x, y) }));
  if (state.area === 'quarry') {
    if (state.rubbleReadyDay <= state.day) options.push({ found: { kind: 'rubble' }, away: distance(RUBBLE_SITE.x, RUBBLE_SITE.y, x, y) });
    if (state.quarryReadyDay <= state.day || (state.progress.mineBuilt && state.mineReadyDay <= state.day)) options.push({ found: { kind: 'quarry' }, away: distance(QUARRY_SITE.x, QUARRY_SITE.y, x, y) });
  } else if (state.area === 'hills') {
    if (outcropLeft(state) > 0) options.push({ found: { kind: 'outcrop' }, away: distance(OUTCROP_SITE.x, OUTCROP_SITE.y, x, y) });
  } else if (state.area === 'camp') {
    options.push(...state.nodes.filter(node => node.amount > 0 && nodeShown(state, node)).map(node => ({ found: { kind: 'node' as const, node }, away: distance(node.x, node.y, x, y) })));
  }
  return options.filter(option => option.away <= BALANCE.interactionRadius).sort((a, b) => a.away - b.away)[0]?.found;
}

/** Whether the survivor is close enough to act on the target. */
export function hasArrived(state: GameState, target: TapTarget): boolean {
  if (target.kind === 'fire') return isAtCamp(state);
  const away = distance(state.player.x, state.player.y, target.x, target.y);
  if (target.kind === 'ground') return away <= GROUND_ARRIVAL;
  return away <= (target.kind === 'crossing' ? CROSSING_ARRIVAL : BALANCE.interactionRadius);
}

/** One frame of walking toward the target, before the movement factor, never overshooting. */
export function moveStep(state: GameState, target: TapTarget, dt: number): { dx: number; dy: number } {
  const dx = target.x - state.player.x;
  const dy = target.y - state.player.y;
  const away = Math.hypot(dx, dy);
  if (away === 0) return { dx: 0, dy: 0 };
  const step = Math.min(WALK_SPEED * dt, away);
  return { dx: dx / away * step, dy: dy / away * step };
}

/** The action to perform on arrival; ground has none. */
export function targetAction(target: TapTarget): GameAction | null {
  switch (target.kind) {
    case 'node': return { type: 'gather', nodeId: target.id };
    case 'pile': return { type: 'pickUpStone', pileId: target.id };
    case 'tree': return { type: 'chopTree', treeId: target.id };
    case 'site': return { type: 'visitSite', siteId: target.id };
    case 'lookout': return { type: 'repairLookout' };
    case 'fire': return { type: 'stokeFire' };
    case 'crossing': return { type: 'cross' };
    case 'quarry': return { type: 'digQuarry' };
    case 'rubble': return { type: 'gatherRubble' };
    case 'outcrop': return { type: 'digOre' };
    case 'pony': return { type: 'offerPony' };
    case 'chickens': return { type: target.action };
    case 'appleTree': return { type: 'gatherApples' };
    case 'shed': return { type: 'searchShed' };
    case 'coop': return { type: 'takeEgg' };
    case 'orchard': return target.action;
    case 'ground': return null;
  }
}

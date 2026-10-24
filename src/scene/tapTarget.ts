import { BALANCE, LOOKOUT, SITES, type GameState, type SiteId } from '../game/state';
import { isAtCamp, type GameAction } from '../game/rules';
import { sprites } from '../art/sprites';

/** What a tap on the map points at, in tile units like `state.player`. */
export type TapTarget =
  | { kind: 'node'; id: string; x: number; y: number }
  | { kind: 'tree'; id: string; x: number; y: number }
  | { kind: 'site'; id: SiteId; x: number; y: number }
  | { kind: 'lookout'; x: number; y: number }
  | { kind: 'fire'; x: number; y: number }
  | { kind: 'ground'; x: number; y: number };

/** A tap this close to something counts as tapping it. */
export const TAP_HIT_RADIUS = 1;
/** Tiles per second, matching keyboard walking. */
export const WALK_SPEED = 3.5;
const GROUND_ARRIVAL = 0.1;
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

/** The closest interactive thing near the tap, or the tapped ground. */
export function pickTapTarget(state: GameState, x: number, y: number): TapTarget {
  const candidates: { target: TapTarget; sprite?: string }[] = [
    ...state.nodes.filter(node => node.amount > 0).map(node => ({ target: { kind: 'node' as const, id: node.id, x: node.x, y: node.y } })),
    ...state.trees.map(tree => ({ target: { kind: 'tree' as const, id: tree.id, x: tree.x, y: tree.y }, sprite: tree.sprite })),
    ...(Object.keys(SITES) as SiteId[]).map(id => ({ target: { kind: 'site' as const, id, x: SITES[id].x, y: SITES[id].y } })),
    { target: { kind: 'lookout', x: LOOKOUT.x, y: LOOKOUT.y }, sprite: 'lookout' },
    { target: { kind: 'fire', x: BALANCE.campX, y: BALANCE.campY } }
  ];
  const hit = candidates
    .map(({ target, sprite }) => ({ target, away: tapDistance(target, sprite, x, y) }))
    .filter(({ away }) => away <= TAP_HIT_RADIUS)
    .sort((a, b) => a.away - b.away)[0];
  return hit?.target ?? { kind: 'ground', x: clamp(x, BALANCE.mapWidth - 1), y: clamp(y, BALANCE.mapHeight - 1) };
}

/** Whether the survivor is close enough to act on the target. */
export function hasArrived(state: GameState, target: TapTarget): boolean {
  if (target.kind === 'fire') return isAtCamp(state);
  const away = distance(state.player.x, state.player.y, target.x, target.y);
  return away <= (target.kind === 'ground' ? GROUND_ARRIVAL : BALANCE.interactionRadius);
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
    case 'tree': return { type: 'chopTree', treeId: target.id };
    case 'site': return { type: 'visitSite', siteId: target.id };
    case 'lookout': return { type: 'repairLookout' };
    case 'fire': return { type: 'stokeFire' };
    case 'ground': return null;
  }
}

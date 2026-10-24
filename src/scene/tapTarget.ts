import { BALANCE, LOOKOUT, SITES, type GameState, type SiteId } from '../game/state';
import { isAtCamp, type GameAction } from '../game/rules';

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

const distance = (x1: number, y1: number, x2: number, y2: number) => Math.hypot(x1 - x2, y1 - y2);
const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));

/** The closest interactive thing near the tap, or the tapped ground. */
export function pickTapTarget(state: GameState, x: number, y: number): TapTarget {
  const candidates: TapTarget[] = [
    ...state.nodes.filter(node => node.amount > 0).map(node => ({ kind: 'node' as const, id: node.id, x: node.x, y: node.y })),
    ...state.trees.map(tree => ({ kind: 'tree' as const, id: tree.id, x: tree.x, y: tree.y })),
    ...(Object.keys(SITES) as SiteId[]).map(id => ({ kind: 'site' as const, id, x: SITES[id].x, y: SITES[id].y })),
    { kind: 'lookout', x: LOOKOUT.x, y: LOOKOUT.y },
    { kind: 'fire', x: BALANCE.campX, y: BALANCE.campY }
  ];
  const hit = candidates
    .filter(target => distance(target.x, target.y, x, y) <= TAP_HIT_RADIUS)
    .sort((a, b) => distance(a.x, a.y, x, y) - distance(b.x, b.y, x, y))[0];
  return hit ?? { kind: 'ground', x: clamp(x, BALANCE.mapWidth - 1), y: clamp(y, BALANCE.mapHeight - 1) };
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

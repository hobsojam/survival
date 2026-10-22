import { BALANCE, type GameState } from '../game/state';
import { TILE, worldX, worldY } from './art';

export const NIGHT_DEPTH = BALANCE.mapHeight * TILE + 1;
export const LIGHT_DEPTH = NIGHT_DEPTH + 1;
export const WEATHER_DEPTH = LIGHT_DEPTH + 1;

export function playerVisualDepth(state: GameState): number {
  const nearFire = state.fireFuel > 0 && Math.hypot(state.player.x - BALANCE.campX, state.player.y - BALANCE.campY) < 1;
  return nearFire ? LIGHT_DEPTH + 0.5 : Math.round(worldY(state.player.y));
}

export interface SceneVisual {
  id: string;
  texture: string;
  x: number;
  y: number;
  depth: number;
}

export function sceneVisuals(state: GameState, timeMs: number): SceneVisual[] {
  const visuals: SceneVisual[] = [];
  const add = (id: string, texture: string, tileX: number, tileY: number) => {
    const x = Math.round(worldX(tileX));
    const y = Math.round(worldY(tileY));
    visuals.push({ id, texture, x, y, depth: y });
  };
  for (const node of state.nodes) {
    const sprite = node.kind === 'branch' ? 'branchPile' : node.kind === 'berry' ? 'berryBush' : 'fiberReeds';
    add(node.id, `${sprite}:${node.amount > 0 ? 'ready' : 'depleted'}`, node.x, node.y);
  }
  const { campX: x, campY: y } = BALANCE;
  add('shelter', `shelter:${state.structures.shelter ? (state.structures.bed ? 'builtBed' : 'built') : 'site'}`, x - 3, y - 2);
  add('crate', `crate:${state.structures.crate ? 'built' : 'site'}`, x + 3, y + 1);
  add('dryingRack', `dryingRack:${state.structures.dryingRack ? 'built' : 'site'}`, x + 2, y - 2);
  add('windbreak', `windbreak:${state.structures.windbreak ? 'built' : 'site'}`, x - 2, y + 2);
  const fire = state.structures.hearth ? 'hearth' : 'firePit';
  const phase = Math.floor(timeMs / 180) % 2;
  add('fire', `${fire}:${state.fireFuel > 0 ? (phase ? 'burningB' : 'burning') : 'unlit'}`, x, y);
  visuals.push({
    id: 'flame', texture: `flame:${state.fireFuel > 0 ? (phase ? 'burningB' : 'burning') : 'out'}`,
    x: Math.round(worldX(x)), y: Math.round(worldY(y)), depth: LIGHT_DEPTH
  });
  return visuals;
}

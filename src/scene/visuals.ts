import { BALANCE, type GameState } from '../game/state';
import { isColdNight } from '../game/rules';
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

export function sceneVisuals(state: GameState, timeMs: number, gathered?: { id: string; atMs: number }): SceneVisual[] {
  const visuals: SceneVisual[] = [];
  const add = (id: string, texture: string, tileX: number, tileY: number) => {
    const x = Math.round(worldX(tileX));
    const y = Math.round(worldY(tileY));
    visuals.push({ id, texture, x, y, depth: y });
  };
  for (const node of state.nodes) {
    const sprite = node.kind === 'branch' ? 'branchPile' : node.kind === 'berry' ? 'berryBush' : 'fiberReeds';
    const sinceGather = gathered?.id === node.id ? timeMs - gathered.atMs : -1;
    const frame = node.kind === 'berry' && sinceGather >= 0 && sinceGather < 300 ? `rustle${Math.floor(sinceGather / 150)}`
      : node.amount <= 0 ? node.kind === 'berry' ? 'picked' : node.kind === 'fiber' ? 'cut' : 'depleted'
      : node.kind === 'fiber' ? ['ready', 'sway0', 'ready', 'sway1'][(Math.floor(timeMs / 500) + node.id.length + node.x) % 4] : 'ready';
    add(node.id, `${sprite}:${frame}`, node.x, node.y);
  }
  const { campX: x, campY: y } = BALANCE;
  add('shelter', state.structures.shelter ? `shelter:${state.structures.bed ? 'builtBed' : 'built'}` : 'shelterSite:still', x - 3, y - 2);
  add('crate', state.structures.crate ? 'crate:built' : 'crateSite:still', x + 3, y + 1);
  add('dryingRack', state.structures.dryingRack ? 'dryingRack:built' : 'dryingRackSite:still', x + 2, y - 2);
  add('windbreak', state.structures.windbreak ? 'windbreak:built' : 'windbreakSite:still', x - 2, y + 2);
  add('logSeat', 'logSeat:still', x - 1, y + 1);
  if (state.progress.hearthUnlocked && !state.structures.hearth) add('hearthSite', 'hearthSite:still', x + 1, y + 2);
  const fire = state.structures.hearth ? 'hearth' : 'firePit';
  const phase = Math.floor(timeMs / 180) % 4;
  const mode = state.fireFuel <= 0 ? 'unlit' : isColdNight(state) ? 'windy' : state.fireFuel < 30 ? 'low' : 'burning';
  add('fire', `${fire}:${mode === 'unlit' ? mode : `${mode}${phase}`}`, x, y);
  if (state.fireFuel > 0 && state.timeOfDay >= BALANCE.nightStart) visuals.push({
    id: 'flame', texture: `flame:${mode}${phase}`,
    x: Math.round(worldX(x)), y: Math.round(worldY(y)), depth: LIGHT_DEPTH
  });
  return visuals;
}

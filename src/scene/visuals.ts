import { BALANCE, type GameState } from '../game/state';
import { isColdNight } from '../game/rules';
import { TILE, worldX, worldY } from './art';

export const NIGHT_DEPTH = BALANCE.mapHeight * TILE + 1;
export const LIGHT_DEPTH = NIGHT_DEPTH + 1;
export const WEATHER_DEPTH = LIGHT_DEPTH + 1;
export const GROUND_DECAL_DEPTH = -50;

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
  const add = (id: string, texture: string, tileX: number, tileY: number, depth?: number) => {
    const x = Math.round(worldX(tileX));
    const y = Math.round(worldY(tileY));
    visuals.push({ id, texture, x, y, depth: depth ?? y });
  };
  for (const node of state.nodes) {
    if (node.kind === 'stone') {
      add(node.id, node.amount > 0 ? 'rock0:still' : 'pebbles0:still', node.x, node.y);
      continue;
    }
    let sprite = 'fiberReeds';
    if (node.kind === 'branch') sprite = 'branchPile';
    else if (node.kind === 'berry') sprite = 'berryBush';
    const sinceGather = gathered?.id === node.id ? timeMs - gathered.atMs : -1;
    let frame = 'ready';
    if (node.kind === 'berry' && sinceGather >= 0 && sinceGather < 300) {
      frame = `rustle${Math.floor(sinceGather / 150)}`;
    } else if (node.amount <= 0) {
      if (node.kind === 'berry') frame = 'picked';
      else if (node.kind === 'fiber') frame = 'cut';
      else frame = 'depleted';
    } else if (node.kind === 'fiber') {
      frame = ['ready', 'sway0', 'ready', 'sway1'][(Math.floor(timeMs / 500) + node.id.length + node.x) % 4];
    }
    add(node.id, `${sprite}:${frame}`, node.x, node.y);
  }
  const { campX: x, campY: y } = BALANCE;
  let shelterTexture = 'shelterSite:still';
  if (state.structures.shelter) {
    const shelterFrame = state.structures.bed ? 'builtBed' : 'built';
    shelterTexture = `shelter:${shelterFrame}`;
  }
  add('shelter', shelterTexture, x - 3, y - 2, state.structures.shelter ? undefined : GROUND_DECAL_DEPTH);
  add('crate', state.structures.crate ? 'crate:built' : 'crateSite:still', x + 3, y + 1,
    state.structures.crate ? undefined : GROUND_DECAL_DEPTH);
  add('dryingRack', state.structures.dryingRack ? 'dryingRack:built' : 'dryingRackSite:still', x + 2, y - 2,
    state.structures.dryingRack ? undefined : GROUND_DECAL_DEPTH);
  add('windbreak', state.structures.windbreak ? 'windbreak:built' : 'windbreakSite:still', x - 2, y + 2,
    state.structures.windbreak ? undefined : GROUND_DECAL_DEPTH);
  add('logSeat', 'logSeat:still', x - 1, y + 1);
  if (state.progress.hearthUnlocked && !state.structures.hearth) add('hearthSite', 'hearthSite:still', x + 1, y + 2, GROUND_DECAL_DEPTH);
  const fire = state.structures.hearth ? 'hearth' : 'firePit';
  const phase = Math.floor(timeMs / 180) % 4;
  const storm = isColdNight(state);
  const low = state.fireFuel < 30;
  let mode = 'burning';
  if (state.fireFuel <= 0) mode = 'unlit';
  else if (low && storm) mode = 'lowWindy';
  else if (storm) mode = 'windy';
  else if (low) mode = 'low';
  add('fire', `${fire}:${mode === 'unlit' ? mode : `${mode}${phase}`}`, x, y);
  if (state.fireFuel > 0 && state.timeOfDay >= BALANCE.nightStart) visuals.push({
    id: 'flame', texture: `${state.structures.hearth ? 'hearthFlame' : 'flame'}:${mode}${phase}`,
    x: Math.round(worldX(x)), y: Math.round(worldY(y)), depth: LIGHT_DEPTH
  });
  return visuals;
}

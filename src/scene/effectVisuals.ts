import { BALANCE, type GameState, type ResourceKind } from '../game/state';
import { isFreezingNight } from '../game/rules';
import { TILE, worldX, worldY } from './art';
import { GROUND_DECAL_DEPTH, LIGHT_DEPTH, WEATHER_DEPTH } from './visuals';

export type EffectKind = 'gather' | 'cook' | 'stargaze' | 'frost';
export interface EffectEvent {
  kind: EffectKind;
  startedAtMs: number;
  x: number;
  y: number;
  resource?: ResourceKind;
}
export interface EffectVisual {
  id: string;
  texture: string;
  x: number;
  y: number;
  depth: number;
  alpha: number;
}

const wrap = (value: number, limit: number): number => ((value % limit) + limit) % limit;
const visual = (id: string, texture: string, x: number, y: number, depth: number, alpha = 1): EffectVisual =>
  ({ id, texture, x: Math.round(x), y: Math.round(y), depth, alpha });

export function effectVisuals(state: GameState, timeMs: number, events: EffectEvent[]): EffectVisual[] {
  const results: EffectVisual[] = [];
  if (state.area === 'camp' && state.fireFuel > 0) results.push(...fireVisuals(timeMs));
  if (isFreezingNight(state)) results.push(...weatherVisuals(timeMs));
  events.forEach((event, index) => {
    const age = timeMs - event.startedAtMs;
    if (age >= 0) results.push(...eventVisuals(state, event, index, age));
  });
  return results;
}

/** Smoke puffs and sparks rising from the camp fire. */
function fireVisuals(timeMs: number): EffectVisual[] {
  const results: EffectVisual[] = [];
  const fireX = Math.round(worldX(BALANCE.campX));
  const fireY = Math.round(worldY(BALANCE.campY));
  for (let i = 0; i < 2; i++) {
    const age = wrap(timeMs + i * 700, 1400);
    if (age >= 1000) continue;
    const frame = Math.min(2, Math.floor(age / 334));
    const x = fireX - 3 + i * 4 + Math.floor(age / 400);
    const y = fireY - 11 - Math.floor(age / 110);
    results.push(visual(`fire:smoke:${i}`, `smokePuff:puff${frame}`, x, y, fireY + 1, (1 - age / 1300) * 0.65));
  }
  for (let i = 0; i < 2; i++) {
    const age = wrap(timeMs + i * 450, 900);
    if (age >= 350) continue;
    const x = fireX - 3 + i * 5 + Math.floor(age / 140);
    const y = fireY - 9 - Math.floor(age / 70);
    results.push(visual(`fire:spark:${i}`, 'spark:still', x, y, LIGHT_DEPTH + 0.2, 1 - age / 400));
  }
  return results;
}

/** Wind streaks and sleet blowing across the whole map on the cold night. */
function weatherVisuals(timeMs: number): EffectVisual[] {
  const results: EffectVisual[] = [];
  const width = BALANCE.mapWidth * TILE;
  const height = BALANCE.mapHeight * TILE;
  for (let i = 0; i < 20; i++) {
    const x = wrap(i * 83 - Math.floor(timeMs / 36), width);
    const y = wrap(i * 47 + Math.floor(timeMs / 300), height);
    const frame = Math.floor(timeMs / 125 + i) % 3;
    results.push(visual(`weather:wind:${i}`, `windStreak:streak${frame}`, x, y, WEATHER_DEPTH, 0.32));
  }
  for (let i = 0; i < 40; i++) {
    const x = wrap(i * 137 - Math.floor(timeMs / 20), width);
    const y = wrap(i * 61 + Math.floor(timeMs / 10), height);
    results.push(visual(`weather:sleet:${i}`, 'sleetFleck:still', x, y, WEATHER_DEPTH, 0.48));
  }
  return results;
}

const POP_RESOURCES: ReadonlySet<string> = new Set(['berry', 'fiber', 'stone']);

function eventVisuals(state: GameState, event: EffectEvent, index: number, age: number): EffectVisual[] {
  const x = Math.round(worldX(event.x));
  const y = Math.round(worldY(event.y));
  const id = `event:${index}`;
  const frame = Math.min(2, Math.floor(age / 400));
  if (event.kind === 'gather' && age < 600) {
    const resource = event.resource && POP_RESOURCES.has(event.resource) ? event.resource : 'wood';
    return [visual(id, `gatherPop:${resource}`, x, y - 15 - Math.floor(age * 9 / 600), LIGHT_DEPTH + 0.1, 1 - age / 750)];
  }
  if (event.kind === 'cook' && age < 1200) {
    return [visual(id, `cookSteam:steam${frame}`, x + 7, y - 19 - Math.floor(age / 200), LIGHT_DEPTH + 0.1, 1 - age / 1500)];
  }
  if (event.kind === 'stargaze' && age < 1200) {
    return [visual(id, `shootingStar:star${frame}`, x - 60 + Math.floor(age / 16), y - 93, LIGHT_DEPTH + 0.1, 1 - age / 1200)];
  }
  if (event.kind === 'frost' && state.area === 'camp' && age < 30000) {
    return [[-32, 16], [16, -32], [48, 32]].map(([dx, dy], i) => visual(`${id}:frost:${i}`, `morningFrost:frost${i}`, x + dx, y + dy,
      GROUND_DECAL_DEPTH + 1, 0.75 * (1 - age / 30000)));
  }
  return [];
}

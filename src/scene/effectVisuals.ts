import { BALANCE, type GameState, type ResourceKind } from '../game/state';
import { isColdNight } from '../game/rules';
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
  const fireX = Math.round(worldX(BALANCE.campX));
  const fireY = Math.round(worldY(BALANCE.campY));
  if (state.area === 'camp' && state.fireFuel > 0) {
    for (let i = 0; i < 2; i++) {
      const age = wrap(timeMs + i * 700, 1400);
      if (age < 1000) {
        const frame = Math.min(2, Math.floor(age / 334));
        const x = fireX - 3 + i * 4 + Math.floor(age / 400);
        const y = fireY - 11 - Math.floor(age / 110);
        results.push(visual(`fire:smoke:${i}`, `smokePuff:puff${frame}`, x, y, fireY + 1, (1 - age / 1300) * 0.65));
      }
    }
    for (let i = 0; i < 2; i++) {
      const age = wrap(timeMs + i * 450, 900);
      if (age >= 350) continue;
      const x = fireX - 3 + i * 5 + Math.floor(age / 140);
      const y = fireY - 9 - Math.floor(age / 70);
      results.push(visual(`fire:spark:${i}`, 'spark:still', x, y, LIGHT_DEPTH + 0.2, 1 - age / 400));
    }
  }
  if (isColdNight(state)) {
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
  }
  events.forEach((event, index) => {
    const age = timeMs - event.startedAtMs;
    if (age < 0) return;
    const x = Math.round(worldX(event.x));
    const y = Math.round(worldY(event.y));
    if (event.kind === 'gather' && age < 600) {
      let resource = 'wood';
      if (event.resource === 'berry' || event.resource === 'fiber' || event.resource === 'stone') resource = event.resource;
      const rise = Math.floor(age * 9 / 600);
      results.push(visual(`event:${index}`, `gatherPop:${resource}`, x, y - 15 - rise, LIGHT_DEPTH + 0.1, 1 - age / 750));
    }
    if (event.kind === 'cook' && age < 1200) {
      const frame = Math.min(2, Math.floor(age / 400));
      results.push(visual(`event:${index}`, `cookSteam:steam${frame}`, x + 7, y - 19 - Math.floor(age / 200), LIGHT_DEPTH + 0.1, 1 - age / 1500));
    }
    if (event.kind === 'stargaze' && age < 1200) {
      const frame = Math.min(2, Math.floor(age / 400));
      results.push(visual(`event:${index}`, `shootingStar:star${frame}`, x - 60 + Math.floor(age / 16), y - 93,
        LIGHT_DEPTH + 0.1, 1 - age / 1200));
    }
    if (event.kind === 'frost' && state.area === 'camp' && age < 30000) {
      for (let i = 0; i < 3; i++) {
        const dx = [-32, 16, 48][i];
        const dy = [16, -32, 32][i];
        results.push(visual(`event:${index}:frost:${i}`, `morningFrost:frost${i}`, x + dx, y + dy,
          GROUND_DECAL_DEPTH + 1, 0.75 * (1 - age / 30000)));
      }
    }
  });
  return results;
}

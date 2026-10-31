import { BALANCE, type GameState, type ResourceKind } from '../game/state';
import { isFreezingNight } from '../game/rules';
import { rainFade } from '../game/rain';
import { coldNightApproach } from '../game/coldNight';
import { HOUSE_SPOT, fireplaceBurning } from '../game/home';
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
  // The wind rises through the cold night's afternoon; once a freezing night falls the snow comes with it.
  const freezing = isFreezingNight(state);
  const wind = freezing ? 1 : coldNightApproach(state);
  if (state.area === 'camp' && state.fireFuel > 0) results.push(...fireVisuals(timeMs, wind));
  if (state.area === 'camp' && fireplaceBurning(state)) results.push(...chimneyVisuals(timeMs, wind));
  if (wind > 0) results.push(...weatherVisuals(timeMs, wind, freezing));
  const shower = rainFade(state);
  if (shower > 0) results.push(...rainVisuals(timeMs, shower));
  events.forEach((event, index) => {
    const age = timeMs - event.startedAtMs;
    if (age >= 0) results.push(...eventVisuals(state, event, index, age));
  });
  return results;
}

/** Smoke puffs and sparks rising from the camp fire, streaming sideways as the wind gets up. */
function fireVisuals(timeMs: number, wind: number): EffectVisual[] {
  const fireX = Math.round(worldX(BALANCE.campX));
  const fireY = Math.round(worldY(BALANCE.campY));
  const results = smokeVisuals('fire', fireX, fireY, fireY + 1, timeMs, wind);
  for (let i = 0; i < 2; i++) {
    const age = wrap(timeMs + i * 450, 900);
    if (age >= 350) continue;
    const x = fireX - 3 + i * 5 + Math.floor(age / 140) + Math.round(wind * age / 30);
    const y = fireY - 9 - Math.floor(age / 70);
    results.push(visual(`fire:spark:${i}`, 'spark:still', x, y, LIGHT_DEPTH + 0.2, 1 - age / 400));
  }
  return results;
}

/** Where the chimney smoke starts, in world pixels from the house's foot: the sprite is anchored 20 across and 30 down, and the
 * chimney's mouth is at 31, 0, so the puffs, which rise from 11 pixels above their start, leave the mouth itself. */
const CHIMNEY_OFFSET = { x: 11, y: -19 } as const;

/** The campfire's smoke, rising from the house chimney while the fireplace burns. */
function chimneyVisuals(timeMs: number, wind: number): EffectVisual[] {
  const houseY = Math.round(worldY(HOUSE_SPOT.y));
  return smokeVisuals('chimney', Math.round(worldX(HOUSE_SPOT.x)) + CHIMNEY_OFFSET.x, houseY + CHIMNEY_OFFSET.y, houseY + 1, timeMs, wind);
}

/** Two smoke puffs rising from 11 pixels above a fire, drifting with the wind. */
function smokeVisuals(source: string, fromX: number, fromY: number, depth: number, timeMs: number, wind: number): EffectVisual[] {
  const results: EffectVisual[] = [];
  for (let i = 0; i < 2; i++) {
    const age = wrap(timeMs + i * 700, 1400);
    if (age >= 1000) continue;
    const frame = Math.min(2, Math.floor(age / 334));
    const x = fromX - 3 + i * 4 + Math.floor(age / 400) + Math.round(wind * (4 + age / 60));
    const y = fromY - 11 - Math.floor(age / 110);
    results.push(visual(`${source}:smoke:${i}`, `smokePuff:puff${frame}`, x, y, depth, (1 - age / 1300) * 0.65));
  }
  return results;
}

/** Wind streaks across the whole map, as strong as the wind is, and on a freezing night thick snow blowing with them. */
function weatherVisuals(timeMs: number, wind: number, snowing: boolean): EffectVisual[] {
  const results: EffectVisual[] = [];
  const width = BALANCE.mapWidth * TILE;
  const height = BALANCE.mapHeight * TILE;
  for (let i = 0; i < 24; i++) {
    const x = wrap(i * 83 - Math.floor(timeMs / 30), width);
    const y = wrap(i * 47 + Math.floor(timeMs / 300), height);
    const frame = Math.floor(timeMs / 125 + i) % 3;
    results.push(visual(`weather:wind:${i}`, `windStreak:streak${frame}`, x, y, WEATHER_DEPTH, 0.6 * wind));
  }
  if (!snowing) return results;
  for (let i = 0; i < 90; i++) {
    // Big flakes fall a little slower than small ones, so the snow has some depth.
    const big = i % 3 === 0;
    const x = wrap(i * 137 - Math.floor(timeMs / (big ? 24 : 16)), width);
    const y = wrap(i * 61 + Math.floor(timeMs / (big ? 16 : 11)), height);
    results.push(visual(`weather:snow:${i}`, `snowFlake:${big ? 'big' : 'small'}`, x, y, WEATHER_DEPTH, big ? 0.95 : 0.85));
  }
  return results;
}

/** Spring rain: forty streaks falling steeply across the whole map, leaning a little, as bold as the shower is heavy. */
function rainVisuals(timeMs: number, heaviness: number): EffectVisual[] {
  const width = BALANCE.mapWidth * TILE;
  const height = BALANCE.mapHeight * TILE;
  return Array.from({ length: 40 }, (_, i) => {
    const x = wrap(i * 113 - Math.floor(timeMs / 60), width);
    const y = wrap(i * 71 + Math.floor(timeMs / 4), height);
    return visual(`weather:rain:${i}`, 'rainStreak:still', x, y, WEATHER_DEPTH, 0.8 * heaviness);
  });
}

/** Resources with a pop of their own; branches (and anything else) pop a stick. */
const POP_RESOURCES: ReadonlySet<string> = new Set(['berry', 'fiber', 'stone', 'hazel', 'pine', 'greens', 'honey']);

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

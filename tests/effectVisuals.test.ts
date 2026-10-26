import { describe, expect, it } from 'vitest';
import { createGame } from '../src/game/state';
import { effectVisuals, type EffectEvent } from '../src/scene/effectVisuals';
import { sprites } from '../src/art/sprites';
import { nightStart } from '../src/game/calendar';

const state = createGame();

function event(kind: EffectEvent['kind'], startedAtMs = 1000): EffectEvent {
  return { kind, startedAtMs, x: 20, y: 15, resource: 'berry' };
}

describe('phase 5 scene effects', () => {
  it('rises eight whole pixels for 0.6 seconds after a successful gather', () => {
    const first = effectVisuals(state, 1000, [event('gather')]).find(visual => visual.id === 'event:0');
    const last = effectVisuals(state, 1599, [event('gather')]).find(visual => visual.id === 'event:0');
    expect(first?.texture).toBe('gatherPop:berry');
    expect(first?.x).toBe(last?.x);
    expect(first!.y - last!.y).toBe(8);
    expect(effectVisuals(state, 1600, [event('gather')]).some(visual => visual.id === 'event:0')).toBe(false);
    expect(effectVisuals(state, 1000, [{ ...event('gather'), resource: 'branch' }])[0].texture).toBe('gatherPop:wood');
  });

  it('shows smoke and sparks only for a burning fire', () => {
    const burning = { ...state, fireFuel: 100 };
    const visuals = effectVisuals(burning, 2000, []);
    expect(visuals.some(visual => visual.texture.startsWith('smokePuff:'))).toBe(true);
    expect(visuals.some(visual => visual.texture === 'spark:still')).toBe(true);
    expect(effectVisuals(state, 2000, []).some(visual => visual.id.startsWith('fire:'))).toBe(false);
  });

  it('plays cook steam and one shooting star, then expires', () => {
    const events = [event('cook'), event('stargaze')];
    const visuals = effectVisuals(state, 1200, events);
    expect(visuals.some(visual => visual.texture.startsWith('cookSteam:'))).toBe(true);
    expect(visuals.some(visual => visual.texture.startsWith('shootingStar:'))).toBe(true);
    expect(effectVisuals(state, 3000, events).some(visual => visual.id.startsWith('event:'))).toBe(false);
  });

  it('restricts wind and sleet to a cold front and keeps every position integral', () => {
    const storm = { ...state, day: 3, timeOfDay: 190, progress: { ...state.progress, nextStormDay: 3 } };
    const visuals = effectVisuals(storm, 2000, []);
    expect(visuals.some(visual => visual.texture.startsWith('windStreak:'))).toBe(true);
    expect(visuals.some(visual => visual.texture === 'sleetFleck:still')).toBe(true);
    expect(effectVisuals(state, 2000, []).some(visual => visual.id.startsWith('weather:'))).toBe(false);
    for (const visual of visuals) {
      expect(Number.isInteger(visual.x), visual.id).toBe(true);
      expect(Number.isInteger(visual.y), visual.id).toBe(true);
    }
    for (const timeMs of [0, 2000, 10000, 30000]) {
      const visible = effectVisuals(storm, timeMs, []).filter(effect =>
        effect.x >= 80 && effect.x < 560 && effect.y >= 90 && effect.y < 390);
      expect(visible.filter(effect => effect.id.startsWith('weather:wind:')).length).toBeGreaterThanOrEqual(9);
      expect(visible.filter(effect => effect.id.startsWith('weather:sleet:')).length).toBeGreaterThanOrEqual(18);
    }
  });

  it('keeps the camp fire effects and morning frost out of the quarry', () => {
    const quarry = { ...state, area: 'quarry' as const, fireFuel: 100 };
    expect(effectVisuals(quarry, 2000, []).some(visual => visual.id.startsWith('fire:'))).toBe(false);
    expect(effectVisuals({ ...quarry, area: 'camp' }, 2000, []).some(visual => visual.id.startsWith('fire:'))).toBe(true);
    expect(effectVisuals(quarry, 1000, [event('frost')]).some(visual => visual.texture.startsWith('morningFrost:'))).toBe(false);
  });

  it('fades optional morning frost after a failed front without changing state', () => {
    const before = structuredClone(state);
    const frost = [event('frost')];
    expect(effectVisuals(state, 1000, frost).filter(visual => visual.texture.startsWith('morningFrost:'))).toHaveLength(3);
    expect(effectVisuals(state, 31000, frost).some(visual => visual.texture.startsWith('morningFrost:'))).toBe(false);
    expect(state).toEqual(before);
  });

  it('only emits registered textures for every resource and weather state', () => {
    const storm = { ...state, day: 3, timeOfDay: 190, fireFuel: 100,
      progress: { ...state.progress, nextStormDay: 3 } };
    const events: EffectEvent[] = [
      ...(['branch', 'berry', 'fiber', 'stone'] as const).map(resource => ({ ...event('gather'), resource })),
      event('cook'), event('stargaze'), event('frost')
    ];
    for (const timeMs of [1000, 1250, 1500, 2000]) for (const effect of effectVisuals(storm, timeMs, events)) {
      const [name, frame] = effect.texture.split(':');
      expect(sprites[name]?.frames[frame], effect.texture).toBeDefined();
    }
  });
});

describe('winter weather', () => {
  it('blows sleet across every winter night, and not across autumn nights', () => {
    const weathered = { ...state.progress, hearthUnlocked: true, nextStormDay: null };
    const winter = { ...state, day: 12, timeOfDay: nightStart(12) + 5, progress: weathered };
    expect(effectVisuals(winter, 0, []).some(visual => visual.id.startsWith('weather:'))).toBe(true);
    const autumn = { ...winter, day: 8, timeOfDay: nightStart(8) + 5 };
    expect(effectVisuals(autumn, 0, []).some(visual => visual.id.startsWith('weather:'))).toBe(false);
  });
});

describe('spring rain', () => {
  it('falls in streaks only while it rains', () => {
    const shower = { ...state, day: 22, timeOfDay: 40 };
    const visuals = effectVisuals(shower, 0, []);
    expect(visuals.filter(visual => visual.id.startsWith('weather:rain:'))).toHaveLength(40);
    expect(visuals.some(visual => visual.id.startsWith('weather:sleet'))).toBe(false);
    expect(visuals.every(visual => !visual.id.startsWith('weather:rain:') || visual.texture === 'rainStreak:still')).toBe(true);
    expect(effectVisuals({ ...shower, timeOfDay: 80 }, 0, []).some(visual => visual.id.startsWith('weather:rain:'))).toBe(false);
  });
});

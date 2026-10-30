import { describe, expect, it } from 'vitest';
import { createGame } from '../src/game/state';
import { effectVisuals, type EffectEvent } from '../src/scene/effectVisuals';
import { sprites } from '../src/art/sprites';
import { afternoonStart, nightStart } from '../src/game/calendar';

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

  it('pops each forage find as itself, never as wood', () => {
    for (const resource of ['hazel', 'pine', 'greens', 'honey'] as const) {
      const texture = effectVisuals(state, 1000, [{ ...event('gather'), resource }])[0].texture;
      expect(texture, resource).toBe(`gatherPop:${resource}`);
      expect(sprites.gatherPop.frames[resource], resource).toBeDefined();
    }
    expect(new Set(['hazel', 'pine', 'greens', 'honey', 'berry', 'wood'].map(frame => sprites.gatherPop.frames[frame].join(''))).size).toBe(6);
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

  it('restricts wind and snow to a cold night and keeps every position integral', () => {
    const storm = { ...state, day: 3, timeOfDay: 190, progress: { ...state.progress, nextStormDay: 3 } };
    const visuals = effectVisuals(storm, 2000, []);
    expect(visuals.some(visual => visual.texture.startsWith('windStreak:'))).toBe(true);
    expect(visuals.some(visual => visual.texture.startsWith('snowFlake:'))).toBe(true);
    expect(effectVisuals(state, 2000, []).some(visual => visual.id.startsWith('weather:'))).toBe(false);
    for (const visual of visuals) {
      expect(Number.isInteger(visual.x), visual.id).toBe(true);
      expect(Number.isInteger(visual.y), visual.id).toBe(true);
    }
    for (const timeMs of [0, 2000, 10000, 30000]) {
      const visible = effectVisuals(storm, timeMs, []).filter(effect =>
        effect.x >= 80 && effect.x < 560 && effect.y >= 90 && effect.y < 390);
      expect(visible.filter(effect => effect.id.startsWith('weather:wind:')).length).toBeGreaterThanOrEqual(9);
      expect(visible.filter(effect => effect.id.startsWith('weather:snow:')).length).toBeGreaterThanOrEqual(25);
    }
  });

  it('blows snow thick and bold enough to see on the cold night', () => {
    const storm = { ...state, day: 3, timeOfDay: 190, progress: { ...state.progress, nextStormDay: 3 } };
    const snow = effectVisuals(storm, 2000, []).filter(effect => effect.id.startsWith('weather:snow:'));
    expect(snow.length).toBeGreaterThanOrEqual(60);
    expect(snow.every(effect => effect.alpha >= 0.8)).toBe(true);
    expect(effectVisuals(storm, 2000, []).filter(effect => effect.id.startsWith('weather:wind:')).every(effect => effect.alpha >= 0.5)).toBe(true);
  });

  it('raises the wind through the cold night\'s afternoon, before any snow', () => {
    const coldDay = (timeOfDay: number) => ({ ...state, day: 3, timeOfDay, progress: { ...state.progress, nextStormDay: 3 } });
    const windAlpha = (timeOfDay: number) => Math.max(0, ...effectVisuals(coldDay(timeOfDay), 2000, [])
      .filter(effect => effect.id.startsWith('weather:wind:')).map(effect => effect.alpha));
    const from = afternoonStart(3), to = nightStart(3);
    expect(windAlpha(from - 1)).toBe(0);
    expect(windAlpha(from + (to - from) / 4)).toBeGreaterThan(0);
    expect(windAlpha(from + (to - from) / 4)).toBeLessThan(windAlpha(to - 1));
    expect(effectVisuals(coldDay(from + (to - from) / 4), 2000, []).some(effect => effect.id.startsWith('weather:snow:'))).toBe(false);
  });

  it('streams the fire\'s smoke sideways in the cold night\'s wind', () => {
    const smoke = (s: typeof state) => effectVisuals({ ...s, fireFuel: 100 }, 500, []).filter(effect => effect.id.startsWith('fire:smoke:'));
    const calm = smoke({ ...state, timeOfDay: 100 });
    const windy = smoke({ ...state, day: 3, timeOfDay: 190, progress: { ...state.progress, nextStormDay: 3 } });
    expect(windy[0].x - calm[0].x).toBeGreaterThanOrEqual(4);
  });

  it('keeps the camp fire effects and morning frost out of the quarry', () => {
    const quarry = { ...state, area: 'quarry' as const, fireFuel: 100 };
    expect(effectVisuals(quarry, 2000, []).some(visual => visual.id.startsWith('fire:'))).toBe(false);
    expect(effectVisuals({ ...quarry, area: 'camp' }, 2000, []).some(visual => visual.id.startsWith('fire:'))).toBe(true);
    expect(effectVisuals(quarry, 1000, [event('frost')]).some(visual => visual.texture.startsWith('morningFrost:'))).toBe(false);
  });

  it('fades optional morning frost after a failed cold night without changing state', () => {
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
      ...(['branch', 'berry', 'fiber', 'stone', 'hazel', 'pine', 'greens', 'honey'] as const).map(resource => ({ ...event('gather'), resource })),
      event('cook'), event('stargaze'), event('frost')
    ];
    for (const timeMs of [1000, 1250, 1500, 2000]) for (const effect of effectVisuals(storm, timeMs, events)) {
      const [name, frame] = effect.texture.split(':');
      expect(sprites[name]?.frames[frame], effect.texture).toBeDefined();
    }
  });
});

describe('winter weather', () => {
  it('blows snow across every winter night, and not across autumn nights', () => {
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
    expect(visuals.some(visual => visual.id.startsWith('weather:snow'))).toBe(false);
    expect(visuals.every(visual => !visual.id.startsWith('weather:rain:') || visual.texture === 'rainStreak:still')).toBe(true);
    expect(effectVisuals({ ...shower, timeOfDay: 80 }, 0, []).some(visual => visual.id.startsWith('weather:rain:'))).toBe(false);
    // The streaks fade in with the shower's first seconds, and are bold once it's falling.
    const streaks = (time: number) => effectVisuals({ ...shower, day: 22, timeOfDay: time }, 0, []).filter(visual => visual.id.startsWith('weather:rain:'));
    expect(streaks(32)[0].alpha).toBeLessThan(streaks(50)[0].alpha);
    expect(streaks(50)[0].alpha).toBeGreaterThanOrEqual(0.75);
  });
});

import { describe, expect, it } from 'vitest';
import { createGame, type GameState } from '../src/game/state';
import { applyAction } from '../src/game/rules';
import { newsBetween } from '../src/game/news';

describe('news of what happened while time passed', () => {
  it('announces rain that began during a timed action', () => {
    const base = createGame();
    const branch = base.nodes.find(node => node.kind === 'branch')!;
    const before: GameState = { ...base, day: 22, timeOfDay: 26, player: { ...base.player, x: branch.x, y: branch.y } };
    const after = applyAction(before, { type: 'gather', nodeId: branch.id }).state;
    expect(after.timeOfDay).toBeGreaterThan(30);
    expect(newsBetween(before, after)).toEqual(['Rain is coming in.']);
  });

  it('gives rain, then the wolf, then the new season, and nothing when nothing happened', () => {
    const base = createGame();
    const before: GameState = { ...base, day: 20, timeOfDay: 239, lastWolf: null };
    const after: GameState = { ...base, day: 21, timeOfDay: 1, lastWolf: { day: 20, took: 'nothing' } };
    expect(newsBetween(before, after)).toEqual(['A wolf circled the dark camp but found nothing to take.', 'The snow is melting. Spring has come.']);
    expect(newsBetween(before, before)).toEqual([]);
  });

  it('warns of the midday heat on the first day of each summer only', () => {
    const base = createGame();
    const at = (day: number, timeOfDay: number): GameState => ({ ...base, day, timeOfDay });
    const heat = ['The midday sun is hot. You will get hungry a little faster.'];
    expect(newsBetween(at(31, 55), at(31, 62))).toEqual(heat);
    expect(newsBetween(at(34, 55), at(34, 62))).toEqual([]);
    expect(newsBetween(at(71, 55), at(71, 62))).toEqual(heat);
    expect(newsBetween(at(24, 55), at(24, 62))).toEqual([]);
    expect(newsBetween(at(31, 61), at(31, 70))).toEqual([]);
  });

  it('warns of the thinning bushes on the dawn into autumn day 8 only, even through sleep', () => {
    const base = createGame();
    const at = (day: number, timeOfDay: number): GameState => ({ ...base, day, timeOfDay });
    const warning = ["The bushes are thinning. Berries won't keep through the winter; dry some, and gather nuts."];
    expect(newsBetween(at(7, 230), at(8, 2))).toEqual(warning);
    expect(newsBetween(at(8, 2), at(8, 30))).toEqual([]);
    expect(newsBetween(at(8, 230), at(9, 2))).toEqual([]);
    expect(newsBetween(at(9, 230), at(10, 2))).toEqual([]);
    expect(newsBetween(at(37, 230), at(38, 2))).toEqual([]);
    const sleeper: GameState = { ...at(7, 200), player: { ...base.player, x: 19, y: 14 }, structures: { ...base.structures, shelter: true } };
    const slept = applyAction(sleeper, { type: 'sleep' });
    expect(slept.state.day).toBe(8);
    expect(newsBetween(sleeper, slept.state)).toContain(warning[0]);
  });
});


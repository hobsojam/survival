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

  it('warns of the midday heat on a summer day only', () => {
    const base = createGame();
    const at = (day: number, timeOfDay: number): GameState => ({ ...base, day, timeOfDay });
    expect(newsBetween(at(34, 55), at(34, 62))).toEqual(['The midday sun is hot. You will get hungry a little faster.']);
    expect(newsBetween(at(24, 55), at(24, 62))).toEqual([]);
    expect(newsBetween(at(34, 61), at(34, 70))).toEqual([]);
  });
});

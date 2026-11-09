import { describe, expect, it, vi } from 'vitest';
import { MILESTONES } from './playthrough/milestones';
import { Player, type RunResult, type Style } from './playthrough/player';
import { reportTables } from './playthrough/report';

// Plays whole games through the real rules, from a new camp to the finished keep and on to the castle made home, so a change that strands a player somewhere
// fails here. To regenerate the tables in docs/playthrough: VITE_PLAYTHROUGH_REPORT=1 npx vitest run tests/playthrough.test.ts --disable-console-intercept --silent=false

// A whole game is many thousands of actions, and the first test to ask for one plays it, so the usual limit would fail on a busy machine.
vi.setConfig({ testTimeout: 120000 });

const GAMES: ReadonlyArray<readonly [number, Style]> = [[1, 'orderly'], [2, 'wandering'], [3, 'wandering'], [4, 'unhurried'], [7, 'unhurried']];
/** Over twelve years: well past any of these games to the castle made home, so this only trips on a real stall. */
const MOST_DAYS = 500;
/** The animal houses wait on a wild animal choosing to stay, which is chance, so a game may end without them. */
const UP_TO_CHANCE = new Set(['build:birdhouse', 'build:wolfHouse', 'build:foxDen']);
const ENDS_THE_GAME = ['keep-finished', 'keep-night', 'keep-climbed', 'castle-finished', 'castle-home', 'town-traveller', 'town-neighbour', 'town-house'];
/** The castle's days, from the keep's last stone to the feast's last dish: about 200 of steady play. The orderly game is quickest at about 130. */
const CASTLE_DAYS = [110, 280] as const;
/** The longest wait between one of the castle's finishes and the next: the cart, each section, the moat filling, the first dish and the last. The wall's first side and the hall's wool are the long ones, at about 30 to 40. */
const LONGEST_WAIT = 45;

const played = new Map<string, RunResult>();
function game(seed: number, style: Style): RunResult {
  const key = `${style}-${seed}`;
  if (!played.has(key)) played.set(key, new Player(seed, style).run(MOST_DAYS));
  return played.get(key)!;
}

describe.each(GAMES)('a whole game, seed %i, played in a %s way', (seed, style) => {
  it('reaches the finished keep, sleeps in it and climbs it, and finishes the castle and moves in', () => {
    const run = game(seed, style);
    expect(run.ended).toBe('finished');
    expect(run.hits.map(hit => hit.id)).toEqual(expect.arrayContaining(ENDS_THE_GAME));
  });

  it('passes every milestone on the way', () => {
    const reached = new Set(game(seed, style).hits.map(hit => hit.id));
    expect(MILESTONES.map(milestone => milestone.id).filter(id => !reached.has(id))).toEqual([]);
  });

  it('is never refused something the panels offered and that it had paid for', () => {
    expect(game(seed, style).offeredButRefused).toEqual({});
  });

  it('leaves nothing undone that isn\'t up to chance', () => {
    expect(game(seed, style).neverDone.filter(id => !UP_TO_CHANCE.has(id))).toEqual([]);
  });

  it('raises the castle in about the days it was meant to take, with a finish never far off', () => {
    const run = game(seed, style);
    const day = (id: string) => run.hits.find(hit => hit.id === id)?.day;
    const [keep, castle] = [day('keep-finished')!, day('castle-finished')!];
    expect(castle - keep).toBeGreaterThanOrEqual(CASTLE_DAYS[0]);
    expect(castle - keep).toBeLessThanOrEqual(CASTLE_DAYS[1]);
    const finishes = [keep, castle, day('cart'), day('moat-full'), day('feast'), ...Object.values(run.castleDoneDays)]
      .filter((each): each is number => each !== undefined && each <= castle).sort((a, b) => a - b);
    const waits = finishes.slice(1).map((each, i) => each - finishes[i]);
    expect(Math.max(...waits)).toBeLessThanOrEqual(LONGEST_WAIT);
  });

  it('never falls sick', () => {
    expect(game(seed, style).sickDays).toBe(0);
  });
});

describe('the player itself', () => {
  it('plays the same game again from the same seed', () => {
    const again = new Player(2, 'wandering').run(MOST_DAYS);
    expect(again).toEqual(game(2, 'wandering'));
  });

  it('notices a game that cannot be finished', () => {
    const run = new Player(1, 'orderly').run(10);
    expect(run.ended).toBe('out of days');
    expect(run.hits.map(hit => hit.id)).not.toContain('keep-finished');
  });
});

describe.runIf(import.meta.env.VITE_PLAYTHROUGH_REPORT)('the report', () => {
  it('prints its tables', () => {
    const runs = (['orderly', 'wandering', 'unhurried'] as const).flatMap(style => Array.from({ length: style === 'orderly' ? 1 : 15 }, (_, i) => new Player(i + 1, style).run(600)));
    console.log(reportTables(runs));
  }, 300000);
});

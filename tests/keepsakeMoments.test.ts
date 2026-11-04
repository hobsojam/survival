import { describe, expect, it } from 'vitest';
import { season } from '../src/game/calendar';
import { createGame, type GameState } from '../src/game/state';
import { applyAction, type GameAction } from '../src/game/rules';
import { KEEPSAKE_SPOT, TRUST_TARGET, feathersFound } from '../src/game/companion';
import { journalSeason, recordJournal, type JournalId } from '../src/game/journalEntries';
import { sceneVisuals } from '../src/scene/visuals';
import { journalPageView } from '../src/ui/yearJournal';
import { saveGame, loadGame } from '../src/game/save';

const base = createGame();
const AUTUMN = 5, WINTER = 15, SPRING = 25, SUMMER = 35;
const KEEPSAKE_IDS: JournalId[] = ['autumnKeepsake', 'winterKeepsake', 'springKeepsake', 'summerKeepsake'];
const STEP: GameAction = { type: 'move', dx: -0.1, dy: 0 };

/** Standing by the fire on `day` with a friend's keepsake of this kind lying there, or none. */
function byTheFire(day: number, lying: 'feather' | 'fur' | null = 'feather', changes: Partial<GameState['companion']> = {}): GameState {
  const animal = lying === 'fur' ? 'fox' : 'bird';
  return {
    ...base,
    day,
    timeOfDay: 30,
    structures: { ...base.structures, shelter: true },
    player: { ...base.player, x: KEEPSAKE_SPOT.x + 0.5, y: KEEPSAKE_SPOT.y },
    companion: { ...base.companion, friend: animal, since: 1, friends: { ...base.companion.friends, [animal]: 1 },
      trust: { ...base.companion.trust, [animal]: TRUST_TARGET[animal] },
      lyingByKind: { feather: lying === 'feather', fur: lying === 'fur' }, ...changes }
  };
}
const pickUp = (state: GameState) => recordJournal(state, applyAction(state, STEP).state, STEP);
const keepsakeEntries = (state: GameState) => state.journal.filter(entry => KEEPSAKE_IDS.includes(entry.id));

describe('keepsakes in the year journal', () => {
  it('writes the first feather of the season, on that season\'s page, with a quiet line', () => {
    const { state, messages } = pickUp(byTheFire(AUTUMN));
    expect(keepsakeEntries(state)).toEqual([{ year: 1, id: 'autumnKeepsake', day: AUTUMN, variant: 0 }]);
    expect(messages).toContain('Written in your journal: Found a feather by the fire, among the fallen leaves.');
  });

  it('tells fur apart from a feather', () => {
    const { state, messages } = pickUp(byTheFire(AUTUMN, 'fur'));
    expect(keepsakeEntries(state)).toEqual([{ year: 1, id: 'autumnKeepsake', day: AUTUMN, variant: 1 }]);
    expect(messages).toContain('Written in your journal: Found a tuft of fur by the fire, among the fallen leaves.');
  });

  it.each([
    [AUTUMN, 'autumnKeepsake', 'Found a feather by the fire, among the fallen leaves.', 'Found a tuft of fur by the fire, among the fallen leaves.'],
    [WINTER, 'winterKeepsake', 'A feather by the fire, bright against the snow.', 'A tuft of fur by the fire, frost on its tips.'],
    [SPRING, 'springKeepsake', 'A new feather by the fire, soft as the morning.', 'A tuft of winter fur by the fire, shed for spring.'],
    [SUMMER, 'summerKeepsake', 'A feather by the fire on a warm morning.', 'A wisp of fur by the fire on a warm morning.']
  ] as const)('on day %i writes %s with the agreed lines', (day, id, feather, fur) => {
    expect(pickUp(byTheFire(day)).messages).toContain(`Written in your journal: ${feather}`);
    expect(pickUp(byTheFire(day, 'fur')).messages).toContain(`Written in your journal: ${fur}`);
    expect(journalSeason(id)).toBe(season(day));
    expect(keepsakeEntries(pickUp(byTheFire(day)).state).map(entry => entry.id)).toEqual([id]);
  });

  it('writes it only once a season, and again the next year', () => {
    const first = pickUp(byTheFire(AUTUMN)).state;
    const second = pickUp({ ...first, companion: { ...first.companion, lyingByKind: { feather: true, fur: false } } });
    expect(keepsakeEntries(second.state)).toHaveLength(1);
    expect(second.messages.some(line => line.includes('feather'))).toBe(false);
    const nextYear = pickUp({ ...first, day: AUTUMN + 40, companion: { ...first.companion, lyingByKind: { feather: true, fur: false } } });
    expect(keepsakeEntries(nextYear.state).map(entry => entry.year)).toEqual([1, 2]);
  });

  it('writes nothing for a walk past the fire with no keepsake lying there', () => {
    expect(keepsakeEntries(pickUp(byTheFire(AUTUMN, null)).state)).toEqual([]);
  });

  it('writes nothing when the feathers are spent on the pillow', () => {
    const state = byTheFire(AUTUMN, null, { keepsakesByKind: { feather: 6, fur: 0 }, keepsakes: 6 });
    const after = { ...state, companion: { ...state.companion, keepsakesByKind: { feather: 0, fur: 0 }, keepsakes: 0, pillow: true } };
    expect(keepsakeEntries(recordJournal(state, after).state)).toEqual([]);
  });

  it('keeps a save with a keepsake line in it', () => {
    const { state } = pickUp(byTheFire(1));
    const storage = new Map<string, string>();
    const fake = { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => void storage.set(k, v) } as unknown as Storage;
    saveGame(fake, state);
    const loaded = loadGame(fake);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind === 'loaded') expect(keepsakeEntries(loaded.state)).toEqual(keepsakeEntries(state));
  });
});

describe('the keepsake line on the journal page', () => {
  const blanks = (state: GameState, page = 0) => journalPageView(state, page).blanks;
  const noFriend: GameState = { ...base, day: AUTUMN };

  it('leaves no blank for it until there is a friend to leave one', () => {
    expect(blanks(byTheFire(AUTUMN, null)) - blanks(noFriend)).toBe(1);
  });

  it('leaves no blank once the friend has nothing more to give', () => {
    expect(blanks(byTheFire(AUTUMN, null, { pillow: true }))).toBe(blanks(noFriend));
    const foxOnly = byTheFire(AUTUMN, 'fur', { cloak: true, lyingByKind: { feather: false, fur: false } });
    expect(blanks(foxOnly)).toBe(blanks(noFriend));
  });

  it('still leaves a blank while a second friend has more to give', () => {
    const state = byTheFire(AUTUMN, null, { pillow: true });
    const both = { ...state, companion: { ...state.companion, friends: { ...state.companion.friends, fox: 1 } } };
    expect(blanks(both) - blanks(noFriend)).toBe(1);
  });

  it('keeps a written line and no phantom blank after the item is made', () => {
    const written = pickUp(byTheFire(AUTUMN)).state;
    const page = journalPageView({ ...written, companion: { ...written.companion, pillow: true } }, 0);
    expect(page.entries.some(entry => entry.line.includes('feather'))).toBe(true);
    expect(page.blanks).toBeGreaterThanOrEqual(0);
    expect(page.entries.length + page.blanks).toBe(journalPageView(written, 0).entries.length + journalPageView(written, 0).blanks);
  });
});

describe('feathers on the shelter', () => {
  const shows = (state: GameState) => sceneVisuals(state, 0).some(visual => visual.id === 'shelter-feathers');

  it('stays bare until a feather has been found', () => {
    expect(feathersFound(byTheFire(AUTUMN))).toBe(false);
    expect(shows(byTheFire(AUTUMN))).toBe(false);
  });

  it('shows them from the first feather', () => {
    const found = applyAction(byTheFire(AUTUMN), STEP).state;
    expect(feathersFound(found)).toBe(true);
    expect(shows(found)).toBe(true);
  });

  it('keeps them after the feathers go into the pillow', () => {
    const made = byTheFire(AUTUMN, null, { keepsakesByKind: { feather: 0, fur: 0 }, pillow: true });
    expect(shows(made)).toBe(true);
  });

  it('adds nothing for fur', () => {
    expect(shows(applyAction(byTheFire(AUTUMN, 'fur'), STEP).state)).toBe(false);
  });

  it('keeps them once the shelter has become the woodshed', () => {
    const found = applyAction(byTheFire(AUTUMN), STEP).state;
    expect(shows({ ...found, structures: { ...found.structures, house: true } })).toBe(true);
  });

  it('needs a shelter to tuck them into', () => {
    const found = applyAction(byTheFire(AUTUMN), STEP).state;
    expect(shows({ ...found, structures: { ...found.structures, shelter: false } })).toBe(false);
  });
});

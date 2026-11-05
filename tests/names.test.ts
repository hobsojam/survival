import { describe, expect, it } from 'vitest';
import { createGame, type GameState } from '../src/game/state';
import { alarmMessage, applyAction } from '../src/game/rules';
import { placeBranches } from '../src/game/clearing';
import { companionNews } from '../src/game/companion';
import { newsBetween } from '../src/game/news';
import { wolfMessage } from '../src/game/wolves';
import { endingView } from '../src/ui/ending';
import { pillowView } from '../src/ui/panels';
import { recordJournal } from '../src/game/journalEntries';
import { loadGame, saveGame } from '../src/game/save';
import { currentPage, journalPageView, renderJournalPage, type JournalNode } from '../src/ui/yearJournal';
import { SAVE_VERSION, upgradeSave } from '../src/game/saveUpgrades';
import { anyNamed, cleanName, friendCalled, nameBlocker, nameOf, named, namedNote, type NameTarget } from '../src/game/names';

const fakeStorage = (): Storage => {
  const items = new Map<string, string>();
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) } as unknown as Storage;
};
const saves = (state: GameState): boolean => saveGame(fakeStorage(), state).ok;
const game = createGame();

/** A game whose fox has stayed. */
const withFox = (changes: Partial<GameState> = {}): GameState => ({
  ...game,
  companion: { ...game.companion, friend: 'fox', since: 1, friends: { ...game.companion.friends, fox: 1 }, trust: { ...game.companion.trust, fox: 4 } },
  ...changes
});
const FOX: NameTarget = { kind: 'friend', animal: 'fox' };
const name = (state: GameState, target: NameTarget, text: string) => applyAction(state, { type: 'nameAnimal', target, name: text });
const withNames = (state: GameState, names: Partial<GameState['names']>): GameState => ({ ...state, names: { ...state.names, ...names } });

describe('the rules for a name', () => {
  it('trims it', () => {
    expect(cleanName('  Maud ')).toBe('Maud');
  });

  it('turns down a blank', () => {
    expect(cleanName('')).toBeNull();
    expect(cleanName('   ')).toBeNull();
  });

  it('allows twelve characters and no more', () => {
    expect(cleanName('a'.repeat(12))).toBe('a'.repeat(12));
    expect(cleanName('a'.repeat(13))).toBeNull();
  });
});

describe('naming an animal', () => {
  it('starts with every animal unnamed', () => {
    expect(game.names).toEqual({ bird: null, fox: null, wolf: null, sheep: [null, null, null], chickens: [null, null, null] });
    expect(anyNamed(game)).toBe(false);
  });

  it('sets that animal\'s name and nothing else', () => {
    const before = withFox();
    const { state: after } = name(before, FOX, ' Rusty ');
    expect(nameOf(after, FOX)).toBe('Rusty');
    expect(anyNamed(after)).toBe(true);
    expect(after).toEqual({ ...before, names: { ...before.names, fox: 'Rusty' } });
  });

  it('names one sheep and one hen by their place in the flock', () => {
    const flock: GameState = { ...game, structures: { ...game.structures, sheepPen: true }, sheep: { ...game.sheep, arrived: true, fluff: 40, fedUntil: 1 }, chickens: { ...game.chickens, discovered: true, rescued: true } };
    const sheep = name(flock, { kind: 'sheep', index: 1 }, 'Maud').state;
    expect(sheep.names.sheep).toEqual([null, 'Maud', null]);
    const hen = name(flock, { kind: 'chicken', index: 2 }, 'Dot').state;
    expect(hen.names.chickens).toEqual([null, null, 'Dot']);
  });

  it('lets two animals share a name', () => {
    const named = withNames(withFox(), { bird: 'Rusty' });
    expect(nameBlocker(named, FOX, 'Rusty')).toBeNull();
  });

  it.each<[string, () => GameState, NameTarget, string, string]>([
    ['a blank name', withFox, FOX, '  ', 'Give it a name of one to twelve letters.'],
    ['too long a name', withFox, FOX, 'a'.repeat(13), 'Give it a name of one to twelve letters.'],
    ['a second name', () => withNames(withFox(), { fox: 'Rusty' }), FOX, 'Copper', 'Rusty already has a name.'],
    ['a friend not yet made', () => game, FOX, 'Rusty', 'That animal isn\'t here.'],
    ['a sheep before they come', () => game, { kind: 'sheep', index: 0 }, 'Maud', 'That animal isn\'t here.'],
    ['a hen before she is home', () => game, { kind: 'chicken', index: 0 }, 'Dot', 'That animal isn\'t here.']
  ])('refuses %s without changing anything', (_label, state, target, text, message) => {
    const before = state();
    const result = name(before, target, text);
    expect(result.message).toBe(message);
    expect(result.state.names).toEqual(before.names);
  });

  it('uses a friend\'s name in its place, or the wording it had', () => {
    expect(friendCalled(withFox(), 'fox', 'The fox')).toBe('The fox');
    expect(friendCalled(withNames(withFox(), { fox: 'Rusty' }), 'fox', 'The fox')).toBe('Rusty');
  });
});

describe('saving names', () => {
  const flock = (): GameState => ({
    ...withFox(),
    structures: { ...game.structures, shelter: true, chickenCoop: true },
    progress: { ...game.progress, homesteadFound: true },
    chickens: { ...game.chickens, discovered: true, rescued: true }
  });

  it('saves a named friend', () => {
    expect(saves(withNames(withFox(), { fox: 'Rusty' }))).toBe(true);
  });

  it('saves a named hen', () => {
    expect(saves(flock())).toBe(true);
    expect(saves(withNames(flock(), { chickens: ['Dot', null, null] }))).toBe(true);
  });

  it.each<[string, GameState]>([
    ['too long a name', withNames(withFox(), { fox: 'a'.repeat(13) })],
    ['a blank name', withNames(withFox(), { fox: '  ' })],
    ['a name that is not text', withNames(withFox(), { fox: 7 as unknown as string })],
    ['too few sheep', withNames(game, { sheep: [null, null] })],
    ['too many hens', withNames(game, { chickens: [null, null, null, null] })],
    ['a name on a friend not made', withNames(game, { wolf: 'Grey' })],
    ['a name on a sheep not come', withNames(game, { sheep: ['Maud', null, null] })],
    ['a name on a hen not home', withNames(game, { chickens: ['Dot', null, null] })]
  ])('rejects %s', (_label, state) => {
    expect(saves(state)).toBe(false);
  });

  it('brings a version 34 save up with its friends and no names', () => {
    const { names: _names, ...old } = withFox();
    const upgraded = upgradeSave(34, old) as { ok: true; state: GameState };
    expect(upgraded.ok).toBe(true);
    expect(upgraded.state.names).toEqual(game.names);
    expect(upgraded.state.companion.friends.fox).toBe(1);
  });
});

describe('lines about a named friend', () => {
  const friends = (...animals: ('bird' | 'fox' | 'wolf')[]): GameState['companion'] => ({
    ...game.companion,
    friend: animals[0],
    since: 1,
    friends: { ...game.companion.friends, ...Object.fromEntries(animals.map(animal => [animal, 1])) }
  });
  const dayOnly = (changes: Partial<GameState>): GameState => ({ ...game, ...changes });

  it.each([
    ['fox', 'The fox left a berry by your bedroll.', 'Rusty left a berry by your bedroll.'],
    ['wolf', 'Your wolf left a rabbit by your bedroll.', 'Rusty left a rabbit by your bedroll.']
  ] as const)('tells of the %s\'s gift by name', (animal, plain, withName) => {
    const before = dayOnly({ companion: friends(animal) });
    const after: GameState = { ...before, companion: { ...before.companion, lastGiftByFriend: { ...before.companion.lastGiftByFriend, [animal]: 5 } } };
    expect(companionNews(before, after)).toContain(plain);
    const called = { ...game.names, [animal]: 'Rusty' };
    expect(companionNews({ ...before, names: called }, { ...after, names: called })).toContain(withName);
  });

  it('tells of the wolf chasing the others off by name', () => {
    const before = dayOnly({ day: 15, companion: friends('wolf') });
    const after: GameState = { ...before, lastWolf: { day: 15, took: 'chased' } };
    expect(wolfMessage(before, after)).toBe('Your wolf saw the others off into the dark.');
    expect(wolfMessage(before, withNames(after, { wolf: 'Grey' }))).toBe('Grey saw the others off into the dark.');
  });

  it('keeps the wording for a wild wolf, whatever the friendly one is called', () => {
    const before = withNames(dayOnly({ day: 15, companion: friends('wolf') }), { wolf: 'Grey' });
    expect(wolfMessage(before, { ...before, lastWolf: { day: 15, took: 'ration' } })).toBe('A wolf slipped into the dark camp and took a ration.');
  });

  it('says who woke you', () => {
    expect(alarmMessage(dayOnly({ companion: friends('bird') }))).toMatch(/^Your bird woke you\./);
    expect(alarmMessage(withNames(dayOnly({ companion: friends('bird') }), { bird: 'Pip' }))).toMatch(/^Pip woke you\./);
  });

  it('names the bird in the pillow\'s panel', () => {
    const state = dayOnly({ companion: friends('bird'), structures: { ...game.structures, shelter: true, bed: true, toolshed: true } });
    const ready = (view: GameState) => pillowView({ ...view, companion: { ...view.companion, keepsakesByKind: { ...view.companion.keepsakesByKind, feather: 6 } }, player: { ...view.player, x: 20, y: 15 } }).copy;
    expect(ready(state)).toBe("Your bird's feathers would make the bed softer.");
    expect(ready(withNames(state, { bird: 'Pip' }))).toBe("Pip's feathers would make the bed softer.");
  });

  it('remembers friends by name at the end of the story', () => {
    const one = dayOnly({ companion: friends('fox'), ending: { day: 5 } });
    expect(endingView(one).summary).toContain('a friend in the fox');
    expect(endingView(withNames(one, { fox: 'Rusty' })).summary).toContain('a friend in Rusty');
    const three = dayOnly({ companion: friends('fox', 'wolf', 'bird'), ending: { day: 5 } });
    expect(endingView(withNames(three, { fox: 'Rusty' })).summary).toContain('3 animal friends: bird, Rusty, wolf');
  });
});

describe('morning notes about named animals', () => {
  const DAYS = Array.from({ length: 400 }, (_, i) => i + 1);
  const rusty = () => withNames(withFox(), { fox: 'Rusty' });

  it('says nothing with nothing named', () => {
    expect(DAYS.map(day => namedNote(withFox(), day)).filter(Boolean)).toEqual([]);
  });

  it('comes about one day in ten, and always uses the name', () => {
    const notes = DAYS.map(day => namedNote(rusty(), day)).filter((note): note is string => note !== null);
    expect(notes.length).toBeGreaterThanOrEqual(20);
    expect(notes.length).toBeLessThanOrEqual(60);
    for (const note of notes) expect(note).toContain('Rusty');
  });

  it('gives the same note for the same day', () => {
    for (const day of DAYS) expect(namedNote(rusty(), day)).toBe(namedNote(rusty(), day));
  });

  it('uses a name with odd characters exactly as written', () => {
    const notes = DAYS.map(day => namedNote(withNames(withFox(), { fox: '$& <b>' }), day)).filter((note): note is string => note !== null);
    for (const note of notes) expect(note).toContain('$& <b>');
  });

  it('only ever names the animals that have names', () => {
    const state = withNames(rusty(), {});
    for (const day of DAYS) expect(namedNote(state, day) ?? 'Rusty').toContain('Rusty');
  });

  it('arrives once across a dawn, and not within a day', () => {
    const noteDay = DAYS.find(day => namedNote(rusty(), day) !== null)!;
    const before = { ...rusty(), day: noteDay - 1 };
    const after = { ...before, day: noteDay };
    expect(newsBetween(before, after).filter(line => line === namedNote(rusty(), noteDay))).toHaveLength(1);
    const same = { ...rusty(), day: noteDay };
    expect(newsBetween(same, same)).not.toContain(namedNote(rusty(), noteDay));
  });
});

describe('the journal and names', () => {
  const CLEARED: GameState['clearing']['cleared'] = ['east-near', 'east-far', 'east-outer', 'south-near', 'south-far'];
  /** A flock on a spring morning, ready to shear. */
  const ready = (fluff: number, sheepNames: (string | null)[] = [null, null, null]): GameState => {
    const state: GameState = {
      ...game,
      day: 21,
      timeOfDay: 30,
      player: { ...game.player, x: 20, y: 15 },
      nodes: game.nodes.map((node, i) => ({ ...node, ...placeBranches(game.nodes, CLEARED)[i] })),
      structures: { ...game.structures, shelter: true, toolshed: true, workshop: true, field: true, sheepPen: true },
      progress: { ...game.progress, nextStormDay: null, hearthUnlocked: true, workshop: { ...game.progress.workshop, shears: true } },
      clearing: { cleared: CLEARED, marked: null, felled: [] },
      sheep: { ...game.sheep, arrived: true, fluff, fedUntil: 1 }
    };
    return withNames(state, { sheep: sheepNames });
  };
  const shear = (state: GameState) => {
    const action = { type: 'shearFlock' } as const;
    return recordJournal(state, applyAction(state, action).state, action);
  };
  const shearing = (state: GameState) => state.journal.find(entry => entry.id === 'shearing')!;
  const line = (state: GameState, id: string): string | undefined =>
    journalPageView(state, currentPage(state.day)).entries.find((_, i) => state.journal[i]?.id === id)?.line;
  /** The dawn after a state, in its journal. */
  const dawnAfter = (state: GameState) => {
    const after = { ...state, day: state.day + 1, timeOfDay: 1 };
    return recordJournal(state, after);
  };

  it('keeps today\'s shearing lines with no name', () => {
    expect(shear(ready(40)).messages).toContain('Written in your journal: Sheared the flock. They looked smaller and rather cross.');
    expect(shearing(shear(ready(40)).state).name).toBeUndefined();
  });

  it('shears a named sheep by name, using the first one named', () => {
    const { state, messages } = shear(ready(40, [null, 'Maud', 'Bess']));
    expect(messages).toContain('Written in your journal: Sheared Maud and the others. They looked smaller and rather cross.');
    expect(shearing(state).name).toBe('Maud');
  });

  it('finds a Maud in the cloud', () => {
    const { messages } = shear(ready(200, ['Maud', null, null]));
    expect(messages).toContain('Written in your journal: Sheared the cloud. There was a Maud in there after all.');
  });

  it('writes a named line at the first dawn of the season with something named', () => {
    const named = withNames(withFox({ day: 25 }), { fox: 'Rusty' });
    const { state, messages } = dawnAfter(named);
    const entry = state.journal.find(item => item.id === 'namedSpring')!;
    expect(entry).toMatchObject({ name: 'Rusty', day: 26, year: 1 });
    expect(messages.some(message => message.includes('Rusty'))).toBe(true);
    expect(dawnAfter(state).state.journal.filter(item => item.id === 'namedSpring')).toHaveLength(1);
  });

  it('writes no named line with nothing named', () => {
    expect(dawnAfter(withFox({ day: 25 })).state.journal.map(item => item.id)).not.toContain('namedSpring');
  });

  it('leaves no blank for it until something is named', () => {
    const plain = withFox({ day: 25 });
    expect(journalPageView(withNames(plain, { fox: 'Rusty' }), 2).blanks).toBe(journalPageView(plain, 2).blanks + 1);
  });

  it('keeps a line as written when an animal is named afterwards', () => {
    const { state } = shear(ready(40));
    const before = line(state, 'shearing');
    expect(before).toBe('Sheared the flock. They looked smaller and rather cross.');
    expect(line(named(state, { kind: 'sheep', index: 0 }, 'Maud'), 'shearing')).toBe(before);
  });

  it('keeps a name in a line through a save and load', () => {
    const storage = fakeStorage();
    const { state } = shear(ready(40, ['Maud', null, null]));
    expect(saveGame(storage, state).ok).toBe(true);
    const loaded = loadGame(storage);
    expect(loaded.kind === 'loaded' && line(loaded.state, 'shearing')).toBe('Sheared Maud and the others. They looked smaller and rather cross.');
  });

  it('draws a name with markup in it as plain characters', () => {
    const made: string[] = [];
    const node = (): JournalNode & { text: string[] } => {
      const self = {
        className: '', textContent: '' as string | null, disabled: false, text: [] as string[],
        classList: { toggle: () => undefined }, setAttribute: () => undefined,
        append: (...nodes: (JournalNode | string)[]) => { for (const item of nodes) if (typeof item === 'string') self.text.push(item); },
        replaceChildren: () => undefined
      };
      return self;
    };
    const rows: (JournalNode & { text: string[] })[] = [];
    const { state } = shear(ready(40, ['<b>x</b>', null, null]));
    renderJournalPage({ querySelector: () => node() }, journalPageView(state, 2), {
      createElement: (tag: string) => { made.push(tag); const item = node(); rows.push(item); return item; }
    });
    expect(made).not.toContain('b');
    expect(rows.some(item => item.text.some(text => text.includes('<b>x</b>')))).toBe(true);
  });

  it('turns down a named line with no name, and a name that would not be allowed', () => {
    const { state } = shear(ready(40, ['Maud', null, null]));
    const entry = shearing(state);
    const swap = (changes: object): GameState => ({ ...state, journal: state.journal.map(item => (item === entry ? { ...item, ...changes } : item)) });
    expect(saves(state)).toBe(true);
    expect(saves(swap({ name: undefined }))).toBe(false);
    expect(saves(swap({ name: 'a'.repeat(13) }))).toBe(false);
    expect(saves(swap({ name: 7 }))).toBe(false);
    expect(saves(swap({ variant: 0 }))).toBe(false);
  });
});

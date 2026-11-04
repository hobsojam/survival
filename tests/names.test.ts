import { describe, expect, it } from 'vitest';
import { createGame, type GameState } from '../src/game/state';
import { applyAction } from '../src/game/rules';
import { saveGame } from '../src/game/save';
import { SAVE_VERSION, upgradeSave } from '../src/game/saveUpgrades';
import { anyNamed, cleanName, friendCalled, nameBlocker, nameOf, type NameTarget } from '../src/game/names';

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
    structures: { ...game.structures, chickenCoop: true },
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
    expect(SAVE_VERSION).toBe(35);
    expect(upgraded.ok).toBe(true);
    expect(upgraded.state.names).toEqual(game.names);
    expect(upgraded.state.companion.friends.fox).toBe(1);
  });
});

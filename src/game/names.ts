import { BALANCE, type Friend, type GameState } from './state';
import { dayHash } from './wildlife';

// The names the player gives the animals that share the camp. Names are for reading: nothing here changes how the game plays.

export type NameTarget = { kind: 'friend'; animal: Friend } | { kind: 'sheep'; index: number } | { kind: 'chicken'; index: number } | { kind: 'pony' };

export type Names = GameState['names'];

export const emptyNames = (): Names => ({ bird: null, fox: null, wolf: null, pony: null, sheep: [null, null, null], chickens: [null, null, null] });

const friendIsHere = ({ companion }: GameState, animal: Friend): boolean => companion.friends[animal] !== null || companion.friend === animal;

/** The name to keep, or null if it won't do. */
export function cleanName(raw: string): string | null {
  const name = raw.trim();
  return name.length >= 1 && name.length <= BALANCE.nameLength ? name : null;
}

function isHere(state: GameState, target: NameTarget): boolean {
  if (target.kind === 'pony') return state.pony.won !== null;
  if (target.kind === 'friend') return friendIsHere(state, target.animal);
  return target.kind === 'sheep' ? state.sheep.arrived : state.chickens.rescued;
}

export function nameOf({ names }: GameState, target: NameTarget): string | null {
  if (target.kind === 'pony') return names.pony;
  if (target.kind === 'friend') return names[target.animal];
  return (target.kind === 'sheep' ? names.sheep : names.chickens)[target.index] ?? null;
}

/** Why this animal can't take this name, or null. A name is for keeps, so a second one is refused. */
export function nameBlocker(state: GameState, target: NameTarget, raw: string): string | null {
  if (!isHere(state, target)) return "That animal isn't here.";
  const already = nameOf(state, target);
  if (already) return `${already} already has a name.`;
  return cleanName(raw) ? null : 'Give it a name of one to twelve letters.';
}

/** The state with this animal called `name`. */
export function named(state: GameState, target: NameTarget, name: string): GameState {
  const { names } = state;
  if (target.kind === 'pony') return { ...state, names: { ...names, pony: name } };
  const placed = (flock: (string | null)[], index: number) => flock.map((old, i) => (i === index ? name : old));
  if (target.kind === 'friend') return { ...state, names: { ...names, [target.animal]: name } };
  if (target.kind === 'sheep') return { ...state, names: { ...names, sheep: placed(names.sheep, target.index) } };
  return { ...state, names: { ...names, chickens: placed(names.chickens, target.index) } };
}

/** A friend's name, or the wording used until it has one. */
export const friendCalled = (state: GameState, animal: Friend, fallback: string): string => state.names[animal] ?? fallback;

export const anyNamed = ({ names }: GameState): boolean =>
  [names.bird, names.fox, names.wolf, names.pony, ...names.sheep, ...names.chickens].some(name => name !== null);

const NOTE_CHANCE = 0.1;

const NOTES = {
  sheep: ['{name} was in the feed again.', '{name} has stopped pretending not to know you.', '{name} stood looking at the fence for a long time this morning.'],
  chicken: ['{name} had opinions about the coop this morning.', '{name} followed you about for a bit, in case you were food.', '{name} got out, looked around, and got back in.'],
  bird: ['{name} was singing before it was properly light.', '{name} was waiting on the woodpile this morning.', '{name} has found a new favourite branch.'],
  fox: ['{name} watched you work for a while, then pretended not to.', '{name} slept on your boots.', '{name} came home with a leaf stuck to one ear.'],
  pony: ['{name} was at the grass by the fire again.', '{name} stood and let you scratch the shaggy bit.', '{name} looked up when you came out, and went back to grazing.'],
  wolf: ['{name} was up before you, watching the trees.', '{name} leaned on your leg this morning, and neither of you mentioned it.', '{name} yawned at the sunrise.']
} as const;

const fellows = ({ names }: GameState): { name: string; kind: keyof typeof NOTES }[] => [
  ...(['bird', 'fox', 'wolf'] as const).flatMap(animal => { const name = names[animal]; return name ? [{ name, kind: animal }] : []; }),
  ...(names.pony ? [{ name: names.pony, kind: 'pony' as const }] : []),
  ...names.sheep.flatMap(name => (name ? [{ name, kind: 'sheep' as const }] : [])),
  ...names.chickens.flatMap(name => (name ? [{ name, kind: 'chicken' as const }] : []))
];

/** A line for this morning about a named animal, about one day in ten. It's worked out from the day alone, so nothing more is saved. */
export function namedNote(state: GameState, day: number): string | null {
  const animals = fellows(state);
  if (animals.length === 0 || dayHash(day * 7 + 311) >= NOTE_CHANCE) return null;
  const { name, kind } = animals[Math.floor(dayHash(day + 911) * animals.length)];
  const lines = NOTES[kind];
  return lines[Math.floor(dayHash(day + 1777) * lines.length)].replace('{name}', () => name);
}

/** One named animal's name for this day, or null with nothing named. */
export function nameForDay(state: GameState, day: number): string | null {
  const animals = fellows(state);
  return animals.length === 0 ? null : animals[Math.floor(dayHash(day + 2111) * animals.length)].name;
}

/** The first sheep's name that has been given, or null. */
export const firstSheepName = ({ names }: GameState): string | null => names.sheep.find(name => name !== null) ?? null;

/** A written line with the name it was written with put in. */
export const lineWithName = (line: string, name: string | undefined): string => (name === undefined ? line : line.replace('{name}', () => name));

/** Who has been named, for a panel. It lists only the names, so an unnamed animal is never a gap to fill. */
export function rosterLine(names: readonly (string | null)[]): string {
  const given = names.filter((name): name is string => name !== null);
  if (given.length === 0) return '';
  if (given.length === 1) return `${given[0]} lives here.`;
  return `${given.slice(0, -1).join(', ')} and ${given.at(-1)} live here.`;
}

/** Whether the pony has just been won over, between two states of the same game. */
export const newlyWon = (before: GameState, after: GameState): boolean => before.pony.won === null && after.pony.won !== null;

/** The animal that has just stayed, between two states of the same game. */
export function newlyStayed(before: GameState, after: GameState): Friend | null {
  return (['bird', 'fox', 'wolf'] as const).find(animal => before.companion.friends[animal] === null && after.companion.friends[animal] !== null) ?? null;
}

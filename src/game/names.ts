import { BALANCE, type Friend, type GameState } from './state';

// The names the player gives the animals that share the camp. Names are for reading: nothing here changes how the game plays.

export type NameTarget = { kind: 'friend'; animal: Friend } | { kind: 'sheep'; index: number } | { kind: 'chicken'; index: number };

export type Names = GameState['names'];

export const emptyNames = (): Names => ({ bird: null, fox: null, wolf: null, sheep: [null, null, null], chickens: [null, null, null] });

const friendIsHere = ({ companion }: GameState, animal: Friend): boolean => companion.friends[animal] !== null || companion.friend === animal;

/** The name to keep, or null if it won't do. */
export function cleanName(raw: string): string | null {
  const name = raw.trim();
  return name.length >= 1 && name.length <= BALANCE.nameLength ? name : null;
}

function isHere(state: GameState, target: NameTarget): boolean {
  if (target.kind === 'friend') return friendIsHere(state, target.animal);
  return target.kind === 'sheep' ? state.sheep.arrived : state.chickens.rescued;
}

export function nameOf({ names }: GameState, target: NameTarget): string | null {
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
  const placed = (flock: (string | null)[], index: number) => flock.map((old, i) => (i === index ? name : old));
  if (target.kind === 'friend') return { ...state, names: { ...names, [target.animal]: name } };
  if (target.kind === 'sheep') return { ...state, names: { ...names, sheep: placed(names.sheep, target.index) } };
  return { ...state, names: { ...names, chickens: placed(names.chickens, target.index) } };
}

/** A friend's name, or the wording used until it has one. */
export const friendCalled = (state: GameState, animal: Friend, fallback: string): string => state.names[animal] ?? fallback;

export const anyNamed = ({ names }: GameState): boolean =>
  [names.bird, names.fox, names.wolf, ...names.sheep, ...names.chickens].some(name => name !== null);

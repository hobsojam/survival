import type { NameTarget } from '../game/names';
import type { Friend } from '../game/state';

const FRIEND_WORDS: Record<Friend, string> = { bird: 'The little bird', fox: 'The fox', wolf: 'The young wolf' };

/** What the naming box says about the animal it's asking about. */
export function namePromptCopy(target: NameTarget): { title: string } {
  if (target.kind === 'friend') return { title: `${FRIEND_WORDS[target.animal]} has stayed. What will you call it?` };
  return { title: `What will you call this ${target.kind === 'sheep' ? 'sheep' : 'hen'}?` };
}

/** Keys pressed in the box are for the box: they stop here, before the game or the pause key hears them. */
export function keepKeysInDialog(dialog: { addEventListener(type: 'keydown' | 'keyup', listener: (event: { stopPropagation(): void }) => void): void }): void {
  for (const type of ['keydown', 'keyup'] as const) dialog.addEventListener(type, event => event.stopPropagation());
}

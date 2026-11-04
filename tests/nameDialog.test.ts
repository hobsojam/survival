import { describe, expect, it } from 'vitest';
import { namePromptCopy } from '../src/ui/nameDialog';

describe('asking for a name', () => {
  it.each([
    [{ kind: 'friend', animal: 'fox' }, 'The fox has stayed. What will you call it?'],
    [{ kind: 'friend', animal: 'wolf' }, 'The young wolf has stayed. What will you call it?'],
    [{ kind: 'friend', animal: 'bird' }, 'The little bird has stayed. What will you call it?'],
    [{ kind: 'sheep', index: 1 }, 'What will you call this sheep?'],
    [{ kind: 'chicken', index: 0 }, 'What will you call this hen?']
  ] as const)('words it for %j', (target, title) => {
    expect(namePromptCopy(target).title).toBe(title);
  });
});

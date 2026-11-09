import { describe, expect, it } from 'vitest';
import { MESSAGE_MERGE_MS, MessageLine } from '../src/scene/messageLine';

describe('the message line', () => {
  it('keeps the morning\'s notes when a journal line follows on the next tick', () => {
    const line = new MessageLine();
    expect(line.say('You sleep until morning. Autumn has come.', 1000)).toBe('You sleep until morning. Autumn has come.');
    expect(line.say('Written in your journal: The bracken has gone rusty up on the hills.', 1016))
      .toBe('You sleep until morning. Autumn has come. Written in your journal: The bracken has gone rusty up on the hills.');
  });

  it('shows a message on its own once the last has had its moment', () => {
    const line = new MessageLine();
    line.say('You gather berries.', 1000);
    expect(line.say('You gather more berries.', 1000 + MESSAGE_MERGE_MS + 1)).toBe('You gather more berries.');
  });

  it('times the window from the first of a run, so a stream of messages never piles up', () => {
    const line = new MessageLine();
    line.say('One.', 1000);
    line.say('Two.', 1000 + MESSAGE_MERGE_MS - 10);
    expect(line.say('Three.', 1000 + MESSAGE_MERGE_MS + 10)).toBe('Three.');
  });

  it('does not repeat a message said twice in a row', () => {
    const line = new MessageLine();
    line.say('Nothing to use here.', 1000);
    expect(line.say('Nothing to use here.', 1010)).toBe('Nothing to use here.');
  });
});

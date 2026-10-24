import { describe, expect, it } from 'vitest';
import { createGame } from '../src/game/state';
import { sitePrompt } from '../src/game/sitePrompt';

describe('site prompt', () => {
  it('keeps a nearby place unnamed until the first visit', () => {
    const state = createGame();
    expect(sitePrompt(state, 'basket')).toBe('V  Explore nearby place');
    state.progress.discoveries.basket = true;
    expect(sitePrompt(state, 'basket')).toBe('V  Explore old basket');
  });
});

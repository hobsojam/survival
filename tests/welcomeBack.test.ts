import { describe, expect, it } from 'vitest';
import { welcomeBack } from '../src/ui/welcomeBack';

describe('the welcome on loading a save', () => {
  it('says where the survivor is', () => {
    expect(welcomeBack('camp')).toBe('Welcome back to your camp.');
    expect(welcomeBack('quarry')).toBe('Welcome back. You are out by the old quarry.');
    expect(welcomeBack('homestead')).toBe('Welcome back. You are at the old homestead.');
    expect(welcomeBack('hills')).toBe('Welcome back. You are up on the hills.');
  });

  it('says so in the meadow over the bridge, not the camp', () => {
    expect(welcomeBack('meadow')).toBe('Welcome back. You are down in the meadow.');
  });
});
